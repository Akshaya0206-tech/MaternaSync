"""The care assistant's workflows, each a small LangGraph state machine: gather -> analyse (the model step) -> check
(plain code) -> decide (the policy engine and tools). A graph never touches the database except through `tools.act`.

Workflows here: document intake, question routing, visit requests (scheduling), referrals, paperwork drafts, and the sweeps
(missed check-ins, overdue tasks, visit reminders and missed visits, referral chasing, WhatsApp reminders, handover drafts, weekly counts).
What it deliberately does not do: read the clinical meaning of a document, answer a clinical question, grade urgency
beyond the fixed warning-sign wording, rank patients, record clinical outcomes from documents, or release anything to a
patient without a doctor.
"""
import hashlib
import re
from datetime import date, datetime, time, timedelta, timezone
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from .. import caregiver_service, caregiver_whatsapp, config, models, server_text, whatsapp
from ..plain_language import format_when
from . import messages, reporting, scheduling, tools
from .providers import ProviderError, rules_question

MIN_CONFIDENCE = 0.7  # below this a document is never proposed for verification


def _now():
    return datetime.now(timezone.utc)


def _utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _language(db, user_id: str) -> str:
    pref = db.get(models.PatientPreference, user_id)
    return pref.language if pref and pref.language in messages.LANGUAGES else "en"


def _norm(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (text or "").lower())


def _name_tokens(name: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", (name or "").lower())


def names_match(a: str, b: str) -> bool:
    """Same person's name, allowing a different order ("Jenkins, Sarah") and initials ("S. Jenkins")."""
    ta, tb = _name_tokens(a), _name_tokens(b)
    if not ta or not tb:
        return False
    short, long = (ta, tb) if len(ta) <= len(tb) else (tb, ta)
    return all(any(t == p or (len(t) == 1 and p.startswith(t)) or (len(p) == 1 and t.startswith(p)) for p in long) for t in short)


def _graph(state_type, nodes, edges):
    graph = StateGraph(state_type)
    for name, fn in nodes:
        graph.add_node(name, fn)
    for edge in edges:
        graph.add_edge(*edge) if len(edge) == 2 else graph.add_conditional_edges(*edge)
    return graph.compile()


# ================================================================= document intake
class IntakeState(TypedDict, total=False):
    skip: str
    ctx: dict
    analysis: dict
    analysis_error: str
    checks: list
    summary: str


def run_document_intake(db, run: models.AIRun, provider) -> str:
    def gather(state):
        document = db.get(models.MedicalDocument, run.source_id)
        if document is None or document.episode_id != run.episode_id:
            return {"skip": "The document no longer exists."}
        if document.status not in ("NEEDS_REVIEW", "PROCESSING"):
            return {"skip": "A person already handled this document."}
        episode = db.get(models.PregnancyEpisode, document.episode_id)
        ext = document.extraction
        text = (ext.raw_text if ext else "") or ""
        others = [d for d in db.query(models.MedicalDocument).filter(models.MedicalDocument.episode_id == document.episode_id,
                  models.MedicalDocument.id != document.id, models.MedicalDocument.status != "REJECTED").all() if d.extraction]
        ctx = {"document_id": document.id, "filename": document.filename, "language": _language(db, episode.patient_user_id), "text": text,
               "patient_name": episode.patient_name, "patient_mrn": episode.mrn, "found_name": ext.patient_name_found if ext else None,
               "found_mrn": ext.mrn_found if ext else None, "event_date": (ext.event_date if ext else None) or document.document_date,
               "record_type": ext.record_type if ext else None,
               "other_hashes": {hashlib.sha256(_norm(d.extraction.raw_text).encode()).hexdigest(): d.filename for d in others if len(_norm(d.extraction.raw_text)) >= 40}}
        run.inputs_digest = hashlib.sha256(f"{document.id}:{_norm(text)}".encode()).hexdigest()
        return {"ctx": ctx}

    def analyse(state):
        ctx = state["ctx"]
        try:
            analysis = provider.classify_document(ctx["text"], ctx["filename"], {"record_type": ctx["record_type"], "names": [ctx["patient_name"]], "identifiers": [ctx["patient_mrn"]]})
            return {"analysis": analysis.model_dump()}
        except ProviderError as exc:
            return {"analysis_error": str(exc)}

    def check(state):
        ctx = state["ctx"]
        checks = []
        if ctx["found_name"] and ctx["found_name"].lower() not in ("not found", ""):
            ok = names_match(ctx["patient_name"], ctx["found_name"])
            checks.append({"name": "Name", "ok": ok, "kind": "identity", "detail": f"matches ({ctx['patient_name']})" if ok else f"the document says '{ctx['found_name']}', the patient is '{ctx['patient_name']}'"})
        else:
            tokens = _name_tokens(ctx["patient_name"])
            ok = bool(tokens) and all(t in _name_tokens(ctx["text"]) for t in tokens)
            checks.append({"name": "Name", "ok": ok, "kind": "identity", "detail": "the patient's name appears in the text" if ok else "no matching name could be found on the document"})
        if ctx["patient_mrn"] and ctx["found_mrn"] and ctx["found_mrn"].lower() != "not found":
            ok = _norm(ctx["patient_mrn"]) == _norm(ctx["found_mrn"])
            checks.append({"name": "Record number", "ok": ok, "kind": "identity", "detail": "matches" if ok else f"the document says '{ctx['found_mrn']}', the patient's is '{ctx['patient_mrn']}'"})
        else:
            checks.append({"name": "Record number", "ok": True, "kind": "info", "detail": "not on the document, so nothing to compare"})
        try:
            when = date.fromisoformat(str(ctx["event_date"])[:10]) if ctx["event_date"] and str(ctx["event_date"]).lower() != "not found" else None
        except ValueError:
            when = None
        future = bool(when and when > date.today() + timedelta(days=1))
        checks.append({"name": "Date", "ok": not future, "kind": "date", "detail": "is in the future" if future else "is plausible"})
        copy = ctx["other_hashes"].get(hashlib.sha256(_norm(ctx["text"]).encode()).hexdigest()) if len(_norm(ctx["text"])) >= 40 else None
        checks.append({"name": "Duplicate", "ok": copy is None, "kind": "duplicate", "detail": f"looks the same as '{copy}'" if copy else "no copy found"})
        return {"checks": checks}

    def decide(state):
        ctx = state["ctx"]
        document_id, filename = ctx["document_id"], ctx["filename"]
        source = {"source_type": "MedicalDocument", "source_id": document_id}

        def attention(title, summary, action, urgency="normal"):
            tools.act(db, run, "create_attention", {"title": title, "summary": summary, "recommended_action": action, "urgency": urgency, "run_id": run.id, **source},
                      key=f"attention:document:{document_id}")
            return {"summary": f"Escalated to a doctor: {title}"}

        if state.get("analysis_error"):
            return attention("The care assistant could not check a document", f"{filename}: {state['analysis_error']}", "Please review this document yourself.")
        analysis, checks = state["analysis"], state["checks"]
        failed = [c for c in checks if not c["ok"]]
        describe = lambda items: "; ".join(c["name"] + " " + c["detail"] for c in items)  # noqa: E731
        evidence = describe(checks)
        identity_problems = describe([c for c in failed if c["kind"] == "identity"])
        if analysis["looks_urgent"]:
            return attention("A document says it is urgent", f"{filename} states that something is urgent. {evidence}", "Please read this document now.", "urgent")
        if not analysis["readable"]:  # with no text there is no name to compare, so this comes before the identity check
            tools.act(db, run, "reject_document", {"document_id": document_id, "note": messages.pick(messages.UNREADABLE, ctx["language"])}, key=f"reject:{document_id}",
                      proposal={"title": "Reject an unreadable document", "summary": f"{filename} could not be read ({analysis['reason']}). The patient would be asked to upload a clearer copy.",
                                "recommended_action": "Approve to ask the patient to upload it again."})
            return {"summary": "Proposed rejecting an unreadable document."}
        if identity_problems:
            return attention("This document may belong to someone else", f"{filename}: {identity_problems}.",
                             "Check the name and ID before verifying. Reject it if it belongs to another person.")
        if failed:
            return attention("A document needs a closer look", f"{filename}: {describe(failed)}.", "Check the document before verifying it.")
        if analysis["confidence"] < MIN_CONFIDENCE:
            return attention("The care assistant is not sure about a document", f"{filename}: type '{analysis['record_type']}', confidence {analysis['confidence']:.2f}. {evidence}", "Please review it yourself.")
        tools.act(db, run, "verify_document", {"document_id": document_id, "note": "Identity checks passed (proposed by the care assistant)."}, key=f"verify:{document_id}",
                  proposal={"title": "Verify a document", "summary": f"{filename} ({analysis['record_type']}). {evidence}. Verifying means it belongs to this patient and is readable. It does not mean the result is fine.",
                            "recommended_action": "Approve to add it to the patient's journey."})
        return {"summary": "Proposed verifying a document after every identity check passed."}

    app = _graph(IntakeState, [("gather", gather), ("analyse", analyse), ("check", check), ("decide", decide)],
                 [(START, "gather"), ("gather", lambda s: "end" if s.get("skip") else "analyse", {"end": END, "analyse": "analyse"}),
                  ("analyse", "check"), ("check", "decide"), ("decide", END)])
    result = app.invoke({})
    return result.get("summary") or result.get("skip") or ""


# ================================================================= question routing
class QuestionState(TypedDict, total=False):
    skip: str
    ctx: dict
    analysis: dict
    note: str
    summary: str


def run_question_routing(db, run: models.AIRun, provider) -> str:
    def gather(state):
        question = db.get(models.PatientQuestion, run.source_id)
        if question is None or question.episode_id != run.episode_id:
            return {"skip": "The question no longer exists."}
        if question.status in ("ANSWERED", "CLOSED"):
            return {"skip": "A person already answered this question."}
        episode = db.get(models.PregnancyEpisode, question.episode_id)
        language = _language(db, episode.patient_user_id)
        doctors = tools.doctor_ids(db, question.episode_id)
        run.inputs_digest = hashlib.sha256(f"{question.id}:{_norm(question.question_text)}".encode()).hexdigest()
        return {"ctx": {"question_id": question.id, "text": question.question_text, "asker_id": question.asked_by_user_id, "patient_id": episode.patient_user_id,
                        "language": language, "doctor_id": doctors[0] if doctors else None, "episode_id": question.episode_id}}

    def analyse(state):
        ctx = state["ctx"]
        try:
            return {"analysis": provider.classify_question(ctx["text"], ctx["language"]).model_dump()}
        except ProviderError as exc:
            # Safety never depends on the model: if it fails, the fixed warning-sign and clinical-wording lists decide.
            return {"analysis": rules_question(ctx["text"], ctx["language"]).model_dump(), "note": f"The model step failed ({exc}); the fixed rules routed this message."}

    def decide(state):
        ctx, analysis = state["ctx"], state["analysis"]
        qid, language = ctx["question_id"], ctx["language"]
        source = {"source_type": "PatientQuestion", "source_id": qid, "run_id": run.id}
        excerpt = ctx["text"][:200]
        assign = {"question_id": qid, "doctor_id": ctx["doctor_id"], "is_clinical": True}
        note = state.get("note", "")
        category = analysis["category"]
        if category == "administrative" and analysis["intent"] == "other":
            category = "unclear"  # nothing the assistant can answer from the patient's own records
        if category == "urgent":
            tools.act(db, run, "send_urgent_message", {"user_id": ctx["asker_id"], "language": language, "question_id": qid, "kind": "urgent"}, key=f"urgent:{qid}")
            tools.act(db, run, "assign_question_to_doctor", assign, key=f"assign:{qid}")
            tools.act(db, run, "create_attention", {"title": "Urgent wording in a patient message", "urgency": "urgent", "summary": f"“{excerpt}” ({analysis['reason']}) {note}".strip(),
                      "recommended_action": "Contact the patient now. The patient has already been shown the fixed emergency message.", **source}, key=f"attention:question:{qid}")
            return {"summary": "Urgent wording: the fixed emergency message was sent and the doctor was alerted."}
        if category == "administrative":
            if analysis["intent"] == "next_appointment":
                appointment = db.query(models.Appointment).filter(models.Appointment.episode_id == ctx["episode_id"], models.Appointment.status == "scheduled",
                                                                 models.Appointment.scheduled_at > datetime.utcnow()).order_by(models.Appointment.scheduled_at).first()
                body = messages.next_appointment(language, format_when(appointment.scheduled_at), appointment.appointment_type) if appointment else messages.pick(messages.NO_APPOINTMENT, language)
                origin = "the patient's own appointments list"
            else:
                body, origin = messages.pick(messages.UPLOAD_HELP, language), "the app's own instructions"
            text = f"{body}\n\n{messages.pick(messages.ASSISTANT_NOTE, language)}"
            # Every question reaches the doctor, even one the assistant can word a reply to: it is listed on Patient Questions and the reply below stays a proposal.
            tools.act(db, run, "assign_question_to_doctor", {**assign, "is_clinical": False}, key=f"assign:{qid}")
            tools.act(db, run, "answer_question", {"question_id": qid, "text": text}, key=f"answer:{qid}",
                      proposal={"title": "Suggested reply to an administrative question", "summary": f"Question: “{excerpt}”\nSuggested reply: {body}\nSource: {origin}.",
                                "recommended_action": "Approve to send this reply."})
            return {"summary": "Proposed a reply to an administrative question."}
        tools.act(db, run, "assign_question_to_doctor", assign, key=f"assign:{qid}")
        tools.act(db, run, "create_attention", {"title": "A patient question needs a clinician", "urgency": "normal", "summary": f"“{excerpt}” ({analysis['reason']}) {note}".strip(),
                  "recommended_action": "Answer it on the Patient Questions page. The assistant has not drafted an answer.", **source}, key=f"attention:question:{qid}")
        return {"summary": "Routed a clinical or unclear question to the doctor."}

    app = _graph(QuestionState, [("gather", gather), ("analyse", analyse), ("decide", decide)],
                 [(START, "gather"), ("gather", lambda s: "end" if s.get("skip") else "analyse", {"end": END, "analyse": "analyse"}), ("analyse", "decide"), ("decide", END)])
    result = app.invoke({})
    return result.get("summary") or result.get("skip") or ""


# ================================================================= while a doctor has paused the assistant
def run_held_question(db, run: models.AIRun) -> bool:
    """A doctor paused the assistant (for everyone, or for this patient). Nothing is routed or answered. Two things still
    happen, because a question must never become invisible or an emergency message delayed:
      - the fixed rule hands the question to the patient's doctor (tools.route_question_to_doctor);
      - if the wording contains a warning sign, the fixed emergency message is shown to her and the doctor is alerted,
        exactly as in a normal run. A doctor can still reverse that message afterwards.
    Returns True when the run is complete (an urgent one); otherwise it stays queued and runs again when the doctor resumes."""
    question = db.get(models.PatientQuestion, run.source_id)
    if question is None or question.episode_id != run.episode_id or question.status in ("ANSWERED", "CLOSED"):
        run.summary = "Nothing to do."
        return True
    episode = db.get(models.PregnancyEpisode, question.episode_id)
    language = _language(db, episode.patient_user_id)
    analysis = rules_question(question.question_text, language)
    if analysis.category != "urgent":
        tools.route_question_to_doctor(db, question)
        return False
    qid, excerpt = question.id, question.question_text[:200]
    doctors = tools.doctor_ids(db, question.episode_id)
    source = {"source_type": "PatientQuestion", "source_id": qid, "run_id": run.id}
    tools.act(db, run, "send_urgent_message", {"user_id": question.asked_by_user_id, "language": language, "question_id": qid, "kind": "urgent"}, key=f"urgent:{qid}", safety=True)
    tools.act(db, run, "assign_question_to_doctor", {"question_id": qid, "doctor_id": doctors[0] if doctors else None, "is_clinical": True}, key=f"assign:{qid}", safety=True)
    tools.act(db, run, "create_attention", {"title": "Urgent wording in a patient message", "urgency": "urgent", "summary": f"“{excerpt}” ({analysis.reason}) The assistant is paused, so only the fixed emergency message was sent.",
              "recommended_action": "Contact the patient now. The patient has already been shown the fixed emergency message.", **source}, key=f"attention:question:{qid}", safety=True)
    run.summary = "Paused: only the fixed emergency steps ran."
    return True


# ================================================================= follow-up sweeps
def sweep_missed_checkins(db, make_run, skip=frozenset()) -> int:
    """For each agreed check-in schedule that has run late: send the patient (and trusted people she allowed) a fixed
    reminder, once a day. After three reminders with no check-in, ask a doctor to look. A missing entry is never treated
    as evidence of a problem, and the wording says so."""
    done = 0
    for plan in db.query(models.MonitoringPlan).filter_by(active=True).all():
        if plan.episode_id in skip:  # a doctor paused the assistant for this patient
            continue
        latest =db.query(models.DailyLog).filter_by(episode_id=plan.episode_id, skipped=False).order_by(models.DailyLog.recorded_at.desc()).first()
        baseline = max(_utc(latest.recorded_at), _utc(plan.agreed_at)) if latest else _utc(plan.agreed_at)
        if _now() <= baseline + timedelta(days=plan.interval_days):
            continue
        episode = db.get(models.PregnancyEpisode, plan.episode_id)
        if episode is None:
            continue
        run = make_run("missed_checkin", plan.episode_id, "MonitoringPlan", plan.episode_id, f"missed_checkin:{plan.episode_id}:{_now().date().isoformat()}")
        if run is None:
            continue
        language = _language(db, episode.patient_user_id)
        tools.act(db, run, "notify_user", {"user_id": episode.patient_user_id, "title": messages.pick(messages.CHECKIN_TITLE, language), "body": messages.pick(messages.CHECKIN_PATIENT, language),
                  "kind": "assistant_reminder"}, key=f"checkin:{plan.episode_id}:{_now().date().isoformat()}:patient")
        first_name = (episode.patient_name or "").split(" ")[0]
        sent = db.query(models.AIRun).filter(models.AIRun.workflow == "missed_checkin", models.AIRun.episode_id == plan.episode_id, models.AIRun.created_at >= baseline.replace(tzinfo=None)).count()
        links = caregiver_service.active_links_for_episode(db, plan.episode_id, "check_in")
        helper = caregiver_service.helper_link(db, plan.episode_id)
        if helper is not None and any(l.id == helper[1].id for l in links):
            # A doctor asked one trusted person to help with check-ins, so their reminder comes first; the others join from the third reminder on.
            links = [l for l in links if l.id == helper[1].id or sent >= 3]
        for link in links:
            tools.act(db, run, "notify_user", {"user_id": link.caregiver_user_id, "title": messages.pick(messages.CHECKIN_TITLE, language),
                      "body": messages.pick(messages.CHECKIN_CAREGIVER, language).format(name=first_name), "kind": "assistant_reminder"},
                      key=f"checkin:{plan.episode_id}:{_now().date().isoformat()}:{link.id}")
            if sent <= 3 and whatsapp.automatic() and caregiver_whatsapp.usable(db, link, "checkin"):  # at most three nudges per lapse, so it never becomes a flood
                stamp = f"{plan.episode_id}:{_now().date().isoformat()}"
                tools.act(db, run, "send_caregiver_whatsapp", {"link_id": link.id, "kind": "checkin", "source_id": stamp}, key=f"wa:checkin:{stamp}:{link.id}",
                          proposal={"title": "Send a WhatsApp reminder to a trusted person", "summary": "A short “please sign in” message to the number they confirmed. It holds no name, result or medicine.",
                                    "recommended_action": "Approve to send it."})
        if sent >= 3 and not db.query(models.ExceptionItem).filter_by(episode_id=plan.episode_id, source_type="MonitoringPlan", status="OPEN").first():
            tools.act(db, run, "create_attention", {"title": "No check-in for several days", "urgency": "normal", "run_id": run.id, "source_type": "MonitoringPlan", "source_id": plan.episode_id,
                      "summary": f"{episode.patient_name} has not filled in the agreed check-in since {baseline.date().isoformat()}. {sent} reminders were sent. A missing entry is not evidence of a problem.",
                      "recommended_action": "Consider a call to ask whether she needs help filling it in."}, key=f"attention:checkin:{plan.episode_id}:{baseline.date().isoformat()}")
        run.summary = "Sent the fixed check-in reminder."
        done += 1
    return done


def sweep_overdue_tasks(db, make_run, days: int = 3, skip=frozenset()) -> int:
    """A task overdue by `days` or more is raised to the doctor once. The existing reminder sweep keeps nudging the owner."""
    done = 0
    limit = (_now().date() - timedelta(days=days)).isoformat()
    for task in db.query(models.Task).filter(models.Task.status.in_(["OPEN", "IN_PROGRESS", "WAITING"]), models.Task.due_date.isnot(None)).all():
        if str(task.due_date)[:10] > limit or task.episode_id in skip:
            continue
        run = make_run("overdue_task", task.episode_id, "Task", task.id, f"overdue_task:{task.id}")
        if run is None:
            continue
        tools.act(db, run, "create_attention", {"title": "A task is overdue", "urgency": "normal", "run_id": run.id, "source_type": "Task", "source_id": task.id,
                  "summary": f"“{task.title}” was due on {str(task.due_date)[:10]}.", "recommended_action": "Reassign it or close it."}, key=f"attention:task:{task.id}")
        run.summary = "Raised an overdue task to the doctor."
        done += 1
    return done


# ================================================================= visit requests (scheduling)
class SimpleState(TypedDict, total=False):
    skip: str
    ctx: dict
    summary: str


def _simple_graph(gather, decide, check=None):
    nodes = [("gather", gather)] + ([("check", check)] if check else []) + [("decide", decide)]
    after = "check" if check else "decide"
    edges = [(START, "gather"), ("gather", lambda s: "end" if s.get("skip") else after, {"end": END, after: after})]
    if check:
        edges.append(("check", "decide"))
    edges.append(("decide", END))
    result = _graph(SimpleState, nodes, edges).invoke({})
    return result.get("summary") or result.get("skip") or ""


def run_appointment_request(db, run: models.AIRun, provider) -> str:
    """A woman asks for a visit. Inside the clinic's rules and free: propose confirming it. Outside them: propose the next free
    times. Nothing about her health is looked at, so nobody is moved ahead of or behind anyone else."""
    def gather(state):
        appt = db.get(models.Appointment, run.source_id)
        if appt is None or appt.episode_id != run.episode_id:
            return {"skip": "The request no longer exists."}
        if appt.status != "requested":
            return {"skip": "A person already handled this request."}
        episode = db.get(models.PregnancyEpisode, appt.episode_id)
        run.inputs_digest = hashlib.sha256(f"{appt.id}:{appt.scheduled_at.isoformat()}".encode()).hexdigest()
        return {"ctx": {"appointment_id": appt.id, "kind": appt.appointment_type, "patient": episode.patient_name, "rules": scheduling.rules(db)}}

    def check(state):
        ctx = state["ctx"]
        appt = db.get(models.Appointment, ctx["appointment_id"])
        found = scheduling.problems(db, ctx["rules"], appt)
        slots = scheduling.free_slots(db, ctx["rules"], appt.episode_id, appt.scheduled_at) if found else []
        return {"ctx": {**ctx, "problems": found, "slots": slots, "asked": scheduling.local_text(appt.scheduled_at, ctx["rules"])}}

    def decide(state):
        ctx = state["ctx"]
        rules, appointment_id = ctx["rules"], ctx["appointment_id"]
        source = {"source_type": "Appointment", "source_id": appointment_id, "run_id": run.id}
        if not ctx["problems"]:
            tools.act(db, run, "confirm_appointment", {"appointment_id": appointment_id}, key=f"confirm:{appointment_id}",
                      proposal={"title": "Confirm a visit", "summary": f"{ctx['patient']} asked for a {ctx['kind']} visit on {ctx['asked']}. That time is inside the clinic's hours and nobody else is booked then.",
                                "recommended_action": "Approve to confirm the visit and tell her."})
            return {"summary": "Proposed confirming a visit inside the clinic's rules."}
        why = scheduling.explain(ctx["problems"], rules)
        if ctx["slots"]:
            options = ", ".join(scheduling.local_text(s, rules) for s in ctx["slots"])
            tools.act(db, run, "offer_new_times", {"appointment_id": appointment_id, "slots": [s.isoformat() for s in ctx["slots"]]}, key=f"offer:{appointment_id}",
                      proposal={"title": "Offer other times for a visit", "summary": f"{ctx['patient']} asked for {ctx['asked']}, but {why}. The next free times are: {options}.",
                                "recommended_action": "Approve to close this request and send her those times, or dismiss and answer it yourself."})
            return {"summary": "Proposed other times for a request outside the clinic's rules."}
        tools.act(db, run, "create_attention", {"title": "A visit request needs you", "urgency": "normal", "summary": f"{ctx['patient']} asked for {ctx['asked']}, but {why}. No free time was found in the next three weeks.",
                  "recommended_action": "Please answer the request yourself.", **source}, key=f"attention:visit:{appointment_id}")
        return {"summary": "Handed a visit request to the doctor: no free time inside the rules."}

    return _simple_graph(gather, decide, check)


# ================================================================= referrals
def run_referral_followup(db, run: models.AIRun, provider) -> str:
    """A doctor wrote a referral. Sending is a proposal the doctor approves (it leaves the clinic); the doctor's approval is the signature."""
    def gather(state):
        referral = db.get(models.Referral, run.source_id)
        if referral is None or referral.episode_id != run.episode_id:
            return {"skip": "The referral no longer exists."}
        if referral.status != "DRAFT":
            return {"skip": "A person already sent this referral."}
        episode = db.get(models.PregnancyEpisode, referral.episode_id)
        run.inputs_digest = hashlib.sha256(f"{referral.id}:{referral.destination}".encode()).hexdigest()
        return {"ctx": {"referral_id": referral.id, "code": referral.reference_code, "title": referral.title, "destination": referral.destination, "patient": episode.patient_name}}

    def decide(state):
        ctx = state["ctx"]
        if not ctx["destination"]:
            tools.act(db, run, "create_attention", {"title": "A referral has no destination", "urgency": "normal", "run_id": run.id, "source_type": "Referral", "source_id": ctx["referral_id"],
                      "summary": f"{ctx['code']} “{ctx['title']}” for {ctx['patient']} cannot be sent: no destination is written on it.", "recommended_action": "Add the destination, then send it."},
                      key=f"attention:referral:{ctx['referral_id']}:destination")
            return {"summary": "Handed a referral with no destination to the doctor."}
        tools.act(db, run, "send_referral", {"referral_id": ctx["referral_id"]}, key=f"send:{ctx['referral_id']}",
                  proposal={"title": "Send a referral", "summary": f"{ctx['code']} “{ctx['title']}” for {ctx['patient']} to {ctx['destination']}. Approving sends it now, under your name. The message holds the referral reason and your name only.",
                            "recommended_action": "Approve to send the referral."})
        return {"summary": "Proposed sending a referral."}

    return _simple_graph(gather, decide)


# ================================================================= paperwork
def run_paperwork(db, run: models.AIRun, provider) -> str:
    """After a doctor approves a consultation, prepare the patient's visit summary as an editable draft. The wording is the
    same fixed builder as Document Studio's button; the doctor reads, edits, signs and releases it. Nothing is released here."""
    def gather(state):
        approved = db.get(models.ApprovedConsultation, run.source_id)
        consultation = db.get(models.Consultation, approved.consultation_id) if approved else None
        if consultation is None or consultation.episode_id != run.episode_id:
            return {"skip": "The consultation no longer exists."}
        if db.query(models.ClinicalOutput).filter_by(episode_id=run.episode_id, source_type="consultation", source_id=approved.id, kind="visit_summary").first():
            return {"skip": "A summary for this visit already exists."}
        episode = db.get(models.PregnancyEpisode, run.episode_id)
        run.inputs_digest = hashlib.sha256(f"{approved.id}".encode()).hexdigest()
        return {"ctx": {"approved_id": approved.id, "language": _language(db, episode.patient_user_id), "patient": episode.patient_name}}

    def decide(state):
        ctx = state["ctx"]
        tools.act(db, run, "prepare_draft", {"kind": "visit_summary", "source_type": "consultation", "source_id": ctx["approved_id"], "language": ctx["language"]},
                  key=f"draft:visit_summary:{ctx['approved_id']}",
                  proposal={"title": "Prepare a visit summary draft", "summary": f"Prepare the plain-language visit summary for {ctx['patient']} from the consultation you approved, in her language. It stays a draft until you sign it.",
                            "recommended_action": "Approve to prepare the draft."})
        return {"summary": "Prepared an editable visit summary draft."}

    return _simple_graph(gather, decide)


# ================================================================= sweeps: visits, referrals, WhatsApp reminders, handover, weekly counts
def sweep_visits(db, make_run, skip=frozenset()) -> dict:
    """A fixed reminder the day before a confirmed visit (to the woman, and to a trusted person she allowed to see appointments),
    and a proposal to record a visit that is long past but still marked as scheduled. Whether she attended is for a person to say."""
    rules = scheduling.rules(db)
    now = _now()
    naive = now.replace(tzinfo=None)
    reminders = missed = 0
    for appt in db.query(models.Appointment).filter(models.Appointment.status == "scheduled", models.Appointment.scheduled_at > naive,
                                                    models.Appointment.scheduled_at <= naive + timedelta(hours=24)).all():
        episode = db.get(models.PregnancyEpisode, appt.episode_id)
        if episode is None or episode.id in skip:
            continue
        run = make_run("visit_reminder", episode.id, "Appointment", appt.id, f"visit_reminder:{appt.id}")
        if run is None:
            continue
        when = scheduling.local_text(appt.scheduled_at, rules)
        tools.act(db, run, "notify_user", {"user_id": episode.patient_user_id, "key": "visit_reminder", "params": {"kind": appt.appointment_type, "when": when}, "kind": "assistant_visit_reminder",
                  "entity_type": "Appointment", "entity_id": appt.id}, key=f"visit_reminder:{appt.id}:patient")
        first_name = (episode.patient_name or "").split(" ")[0]
        for link in caregiver_service.active_links_for_episode(db, episode.id, "appointments"):
            tools.act(db, run, "notify_user", {"user_id": link.caregiver_user_id, "key": "visit_reminder_caregiver", "params": {"name": first_name, "kind": appt.appointment_type, "when": when},
                      "kind": "assistant_visit_reminder", "entity_type": "Appointment", "entity_id": appt.id}, key=f"visit_reminder:{appt.id}:{link.id}")
            if whatsapp.automatic() and caregiver_whatsapp.usable(db, link, "visit"):
                tools.act(db, run, "send_caregiver_whatsapp", {"link_id": link.id, "kind": "visit", "source_id": appt.id}, key=f"wa:visit:{appt.id}:{link.id}",
                          proposal={"title": "Send a WhatsApp reminder to a trusted person", "summary": "A short “please sign in” message to the number they confirmed. It holds no name, result or medicine.",
                                    "recommended_action": "Approve to send it."})
        run.summary = "Sent the fixed visit reminder."
        reminders += 1
    grace = timedelta(minutes=rules["minutes"], hours=rules["grace_hours"])
    for appt in db.query(models.Appointment).filter(models.Appointment.status == "scheduled", models.Appointment.scheduled_at < naive - grace,
                                                    models.Appointment.scheduled_at > naive - timedelta(days=14)).all():
        episode = db.get(models.PregnancyEpisode, appt.episode_id)
        if episode is None or episode.id in skip:
            continue
        run = make_run("missed_visit", episode.id, "Appointment", appt.id, f"missed_visit:{appt.id}")
        if run is None:
            continue
        when = scheduling.local_text(appt.scheduled_at, rules)
        tools.act(db, run, "record_missed_visit", {"appointment_id": appt.id}, key=f"missed:{appt.id}",
                  proposal={"title": "Record a missed visit", "summary": f"{episode.patient_name}'s {appt.appointment_type} visit on {when} is still marked as scheduled. Did she come?",
                            "recommended_action": "Approve only if she did not come: the visit is recorded as missed and she is told she can ask for a new time. If she did come, dismiss this and mark the visit completed."})
        run.summary = "Asked a doctor whether a past visit was missed."
        missed += 1
    return {"reminders": reminders, "missed": missed}


CHASE_AFTER_SENT = (2, 4, 6)  # days after sending with no acknowledgement: first reminder, second reminder, then a doctor
CHASE_AFTER_VISIT = (7, 9, 11)  # days after the referral appointment with no response


def sweep_referrals(db, make_run, skip=frozenset()) -> int:
    """Chase a sent referral that has not been acknowledged, or has no response after its appointment: two reminders (each a
    proposal a doctor approves, as it is a message to a third party), then a hand-off to the doctor."""
    done = 0
    today = _now().date()
    for referral in db.query(models.Referral).filter(models.Referral.status.in_(["SENT", "APPOINTMENT_SCHEDULED"])).all():
        if referral.episode_id in skip:
            continue
        if referral.status == "SENT":
            waited, steps = ((_now() - _utc(referral.sent_at)).days if referral.sent_at else 0), CHASE_AFTER_SENT
        else:
            try:
                waited, steps = (today - date.fromisoformat(str(referral.appointment_date)[:10])).days, CHASE_AFTER_VISIT
            except ValueError:
                continue
        step = sum(waited >= limit for limit in steps)
        if step == 0:
            continue
        run = make_run("referral_chase", referral.episode_id, "Referral", referral.id, f"referral_chase:{referral.id}:{referral.status}:{step}")
        if run is None:
            continue
        episode = db.get(models.PregnancyEpisode, referral.episode_id)
        waiting_for = "an acknowledgement" if referral.status == "SENT" else "a response"
        if step < 3:
            tools.act(db, run, "chase_referral", {"referral_id": referral.id, "round": step}, key=f"chase:{referral.id}:{referral.status}:{step}",
                      proposal={"title": "Chase a referral", "summary": f"{referral.reference_code} “{referral.title}” for {episode.patient_name} is still waiting for {waiting_for} from {referral.destination} ({waited} days).",
                                "recommended_action": "Approve to record a reminder to them."})
        else:
            tools.act(db, run, "create_attention", {"title": "A referral has had no reply", "urgency": "normal", "run_id": run.id, "source_type": "Referral", "source_id": referral.id,
                      "summary": f"{referral.reference_code} “{referral.title}” for {episode.patient_name} is still waiting for {waiting_for} from {referral.destination} after two reminders ({waited} days).",
                      "recommended_action": "Please contact them yourself."}, key=f"attention:referral:{referral.id}:{referral.status}")
        run.summary = "Chased a referral." if step < 3 else "Handed an unanswered referral to the doctor."
        done += 1
    return done


def sweep_outreach(db, make_run, skip=frozenset()) -> int:
    """A reminder a doctor approved has come due and the woman has given an active permission to message a number about reminders:
    send the minimal "please sign in" WhatsApp message in her language. Permission is checked again in code on every send."""
    done = 0
    naive = _now().replace(tzinfo=None)
    for reminder in db.query(models.CareReminder).filter(models.CareReminder.status == "pending", models.CareReminder.scheduled_at <= naive,
                                                         models.CareReminder.scheduled_at > naive - timedelta(days=3)).all():
        if reminder.episode_id in skip:
            continue
        consent = (db.query(models.SharingConsent).filter(models.SharingConsent.episode_id == reminder.episode_id, models.SharingConsent.purpose == "reminders",
                   models.SharingConsent.revoked_at.is_(None), models.SharingConsent.expires_at > naive).order_by(models.SharingConsent.granted_at.desc()).first())
        if consent is None or db.query(models.Outreach).filter_by(episode_id=reminder.episode_id, source_type="reminder", source_id=reminder.id).first():
            continue
        run = make_run("outreach", reminder.episode_id, "CareReminder", reminder.id, f"outreach:{reminder.id}")
        if run is None:
            continue
        tools.act(db, run, "send_outreach", {"reminder_id": reminder.id, "consent_id": consent.id}, key=f"outreach:{reminder.id}",
                  proposal={"title": "Send a WhatsApp reminder", "summary": "A care reminder you approved is due and she has allowed WhatsApp reminders to this number. The message only asks her to sign in.",
                            "recommended_action": "Approve to send it."})
        run.summary = "Sent the minimal WhatsApp reminder."
        done += 1
    return done


def sweep_handover(db, make_run, skip=frozenset()) -> int:
    """Prepare a handover draft from open tasks, visit requests and unanswered questions. Handover is paused in the app
    (MATERNASYNC_HANDOVER_PAUSED), and while it is paused the assistant does nothing here."""
    if config.HANDOVER_PAUSED:
        return 0
    done = 0
    since = _now().replace(tzinfo=None) - timedelta(hours=24)
    for assignment in db.query(models.PatientDoctorAssignment).filter_by(is_primary=True).all():
        episode_id = assignment.episode_id
        if episode_id in skip or db.query(models.Handover).filter(models.Handover.episode_id == episode_id, models.Handover.created_at >= since).first():
            continue
        open_work = (db.query(models.Task).filter(models.Task.episode_id == episode_id, models.Task.status.in_(["OPEN", "IN_PROGRESS", "WAITING"])).count()
                     + db.query(models.Appointment).filter_by(episode_id=episode_id, status="requested").count()
                     + db.query(models.PatientQuestion).filter(models.PatientQuestion.episode_id == episode_id, models.PatientQuestion.status.in_(["NEW", "ASSIGNED", "WAITING_FOR_RESPONSE"])).count())
        if not open_work:
            continue
        stamp = _now().date().isoformat()
        run = make_run("handover", episode_id, "PregnancyEpisode", episode_id, f"handover:{episode_id}:{stamp}")
        if run is None:
            continue
        tools.act(db, run, "prepare_handover", {"doctor_id": assignment.doctor_user_id}, key=f"handover:{episode_id}:{stamp}",
                  proposal={"title": "Prepare a handover draft", "summary": "Prepare a handover draft from the open tasks, visit requests and unanswered questions. You edit and share it.", "recommended_action": "Approve to prepare it."})
        run.summary = "Prepared a handover draft."
        done += 1
    return done


def sweep_summary(db, make_run, skip=frozenset()) -> int:
    """Once a week, give each doctor plain counts for their own patients: arrived, handled, waited, what the assistant did.
    Every number is worked out by code (reporting.py); nothing is graded."""
    done = 0
    iso = _now().isocalendar()
    week = f"{iso.year}-W{iso.week:02d}"
    for doctor in db.query(models.User).filter_by(role="doctor").all():
        episode_ids = [a.episode_id for a in db.query(models.PatientDoctorAssignment).filter_by(doctor_user_id=doctor.id).all()]
        if not episode_ids:
            continue
        run = make_run("weekly_summary", None, "User", doctor.id, f"weekly_summary:{doctor.id}:{week}")
        if run is None:
            continue
        tools.act(db, run, "post_weekly_summary", {"doctor_id": doctor.id, "summary": reporting.summary(db, episode_ids, 7)}, key=f"weekly_summary:{doctor.id}:{week}",
                  proposal={"title": "Post the weekly counts", "summary": "Post this week's plain counts to your Updates.", "recommended_action": "Approve to post them."})
        run.summary = "Posted the weekly counts."
        done += 1
    return done


def sweep_caregiver_access(db, make_run, skip=frozenset()) -> int:
    """A trusted person's access has an end date the woman chose. Three days before it, and again when it has passed, she gets one
    short note (and can extend it from her Profile page). The block itself needs no step here: it is checked on every request."""
    done = 0
    now = _now()
    for link in db.query(models.CaregiverLink).filter(models.CaregiverLink.status == "ACTIVE", models.CaregiverLink.access_until.isnot(None)).all():
        episode = db.get(models.PregnancyEpisode, link.episode_id)
        if episode is None or episode.id in skip:
            continue
        until = _utc(link.access_until)
        if until <= now:
            stage = "ended" if now - until <= timedelta(days=30) else None
        else:
            stage = "ending" if until - now <= timedelta(days=3) else None
        if stage is None:
            continue
        stamp = until.date().isoformat()
        run = make_run("caregiver_access", episode.id, "CaregiverLink", link.id, f"caregiver_access:{link.id}:{stage}:{stamp}")
        if run is None:
            continue
        tools.act(db, run, "notify_user", {"user_id": episode.patient_user_id, "key": "access_ended" if stage == "ended" else "access_ending",
                  "params": {"name": link.display_name, "date": server_text.fmt_date(link.access_until)}, "kind": "assistant_access",
                  "entity_type": "CaregiverLink", "entity_id": link.id}, key=f"caregiver_access:{link.id}:{stage}:{stamp}")
        run.summary = "Told her a trusted person's access is ending." if stage == "ending" else "Told her a trusted person's access has ended."
        done += 1
    return done
