"""The care assistant's workflows, each a small LangGraph state machine: gather -> analyse (the model step) -> check
(plain code) -> decide (the policy engine and tools). A graph never touches the database except through `tools.act`.

Workflows here: document intake, question routing, and the two follow-up sweeps (missed check-ins, overdue tasks).
What it deliberately does not do: read the clinical meaning of a document, answer a clinical question, grade urgency
beyond the fixed warning-sign wording, or release anything to a patient without a doctor.
"""
import hashlib
import re
from datetime import date, datetime, time, timedelta, timezone
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from .. import models
from ..plain_language import format_when
from . import messages, tools
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
        for link in db.query(models.CaregiverLink).filter_by(episode_id=plan.episode_id, status="ACTIVE").all():
            if link.caregiver_user_id and (link.permissions or {}).get("check_in"):
                tools.act(db, run, "notify_user", {"user_id": link.caregiver_user_id, "title": messages.pick(messages.CHECKIN_TITLE, language),
                          "body": messages.pick(messages.CHECKIN_CAREGIVER, language).format(name=first_name), "kind": "assistant_reminder"},
                          key=f"checkin:{plan.episode_id}:{_now().date().isoformat()}:{link.id}")
        sent = db.query(models.AIRun).filter(models.AIRun.workflow == "missed_checkin", models.AIRun.episode_id == plan.episode_id, models.AIRun.created_at >= baseline.replace(tzinfo=None)).count()
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
