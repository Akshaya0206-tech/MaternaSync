"""Doctor -> Consultations and Patient Questions: readable document titles, the note layout chosen before a note, the last approved visit,
a doctor's own saved replies, and closing a question that was handled by phone or in the clinic. Same isolated synthetic database as the
other tests; each test puts back what it changed."""
import unittest
import uuid
from datetime import date, datetime, timedelta, timezone

import testenv  # noqa: F401: sets the isolated database and settings before the app is imported

from backend.app import models
from backend.app.database import SessionLocal

from test_assistant_caregiver import Base

DOCTOR = "/api/v2/doctor"
NOTE = "I rang her this afternoon and we talked it through; she has what she needs."


class DoctorQuestionsConsultsTests(Base):
    def setUp(self):
        self.made = {"resources": [], "documents": [], "questions": [], "tasks": [], "items": [], "snippets": [], "consultations": []}

    def tearDown(self):
        with SessionLocal() as db:
            # a note started or approved in a test: take its approved copy, journey entry and queued assistant work away again
            for consultation_id in self.made["consultations"]:
                for approved in db.query(models.ApprovedConsultation).filter_by(consultation_id=consultation_id).all():
                    for event in db.query(models.JourneyEvent).filter_by(source_consultation_id=approved.id).all():
                        db.delete(event)
                    for run in db.query(models.AIRun).filter_by(source_id=approved.id).all():
                        for action in db.query(models.AIAction).filter_by(run_id=run.id).all():
                            db.delete(action)
                        db.delete(run)
                    for entry in db.query(models.ExceptionItem).filter_by(source_id=approved.id).all():
                        db.delete(entry)
                    db.delete(approved)
                db.flush()
                consultation = db.get(models.Consultation, consultation_id)
                if consultation is not None:
                    db.delete(consultation)
            db.commit()
        with SessionLocal() as db:
            for kind, model in (("items", models.ExceptionItem), ("tasks", models.Task), ("snippets", models.ReplySnippet), ("documents", models.MedicalDocument),
                                ("resources", models.ClinicalResource)):
                for item_id in self.made[kind]:
                    row = db.get(model, item_id)
                    if row is not None:
                        db.delete(row)
            for question_id in self.made["questions"]:
                question = db.get(models.PatientQuestion, question_id)
                if question is not None:
                    for notification in db.query(models.Notification).filter_by(related_entity_id=question_id).all():
                        db.delete(notification)
                    db.delete(question)
            db.commit()

    # ---------------------------------------------------------------- helpers
    def template(self, title="Booking visit layout", fields=("Presenting concern", "Plan"), approved=True, review_in_days=30):
        with SessionLocal() as db:
            resource = models.ClinicalResource(
                family_id=uuid.uuid4().hex, version=1, kind="template", title=title, configuration={"fields": list(fields)},
                status="APPROVED" if approved else "DRAFT", created_by_user_id=self.doctor_id, approved_by_user_id=self.doctor_id if approved else None,
                review_due=(date.today() + timedelta(days=review_in_days)).isoformat())
            db.add(resource)
            db.commit()
            self.made["resources"].append(resource.id)
            return resource.id

    def start(self, template_id=None, who="doctor", expected=200):
        made = self.call("POST", f"{DOCTOR}/consultations", who, {"episodeId": self.ep, "inputMode": "text", **({"templateId": template_id} if template_id else {})}, expected=expected)
        if expected == 200:
            self.made["consultations"].append(made["id"])
        return made

    def question(self, text="Can I take the bus to my sister's wedding?"):
        question = self.call("POST", "/api/v2/patient/questions", "patient", {"questionText": text})
        self.made["questions"].append(question["id"])
        with SessionLocal() as db:  # the care assistant (switched off in tests) would have assigned it to her doctor
            stored = db.get(models.PatientQuestion, question["id"])
            stored.assigned_to_user_id, stored.status = self.doctor_id, "ASSIGNED"
            db.commit()
        return question

    def doctor_row(self, question_id):
        return next(q for q in self.call("GET", f"{DOCTOR}/questions", "doctor") if q["id"] == question_id)

    # ---------------------------------------------------------------- readable titles for the documents in the brief
    def test_the_brief_carries_what_a_screen_needs_for_a_readable_title(self):
        with SessionLocal() as db:
            document = models.MedicalDocument(episode_id=self.ep, uploaded_by_user_id=self.sarah_id, uploaded_by_role="patient", filename="IMG_20261024_0001.jpg",
                                              file_path="", status="VERIFIED", description="Growth scan from the private clinic", document_type="scan", document_date="2026-10-24")
            db.add(document)
            db.commit()
            self.made["documents"].append(document.id)
        brief = self.call("GET", f"{DOCTOR}/episodes/{self.ep}/todays-brief", "doctor")
        mine = next(d for d in brief["relevantDocuments"] if d["id"] == self.made["documents"][0])
        self.assertEqual(mine["description"], "Growth scan from the private clinic")
        self.assertEqual(mine["documentType"], "scan")
        self.assertEqual(mine["filename"], "IMG_20261024_0001.jpg")  # still there for a screen that wants it
        for entry in brief["relevantDocuments"]:
            self.assertIn("description", entry)
            self.assertIn("documentType", entry)

    # ---------------------------------------------------------------- note layouts
    def test_only_approved_current_layouts_are_offered_and_only_to_a_doctor(self):
        good = self.template("Obstetric history (test)", ("Chief complaints", "Plan"))
        draft = self.template("Draft layout (test)", approved=False)
        lapsed = self.template("Lapsed layout (test)", review_in_days=-3)
        offered = {layout["id"]: layout for layout in self.call("GET", f"{DOCTOR}/note-layouts", "doctor")}
        self.assertIn(good, offered)
        self.assertNotIn(draft, offered)
        self.assertNotIn(lapsed, offered)
        self.assertEqual(offered[good]["fields"], ["Chief complaints", "Plan"])
        for who in ("patient", "ravi"):
            self.call("GET", f"{DOCTOR}/note-layouts", who, expected=403)

    def test_a_note_started_with_a_layout_gets_its_headings_as_empty_boxes_the_doctor_fills_in(self):
        layout = self.template("Booking visit (test)", ("Presenting concern", "Plan"))
        consultation = self.start(layout)
        draft = self.call("POST", f"{DOCTOR}/consultations/{consultation['id']}/drafts", "doctor")
        content = draft["structuredContent"]
        self.assertEqual(content["layout"], {"templateId": layout, "title": "Booking visit (test)", "version": 1})
        self.assertEqual(content["layoutSections"], {"Presenting concern": "", "Plan": ""})  # nothing is written for her
        saved = self.call("PATCH", f"{DOCTOR}/drafts/{draft['id']}", "doctor", {"layoutSections": {"Plan": "Review in two weeks."}})
        self.assertEqual(saved["structuredContent"]["layoutSections"], {"Presenting concern": "", "Plan": "Review in two weeks."})
        self.call("PATCH", f"{DOCTOR}/drafts/{draft['id']}", "doctor", {"layoutSections": {"Not a heading": "x"}}, expected=400)
        self.call("PATCH", f"{DOCTOR}/drafts/{draft['id']}", "doctor", {"layoutSections": {"Plan": "x" * 8001}}, expected=400)
        with SessionLocal() as db:
            started = [a for a in db.query(models.AuditLog).filter_by(action="consultation_started", object_id=consultation["id"]).all()]
            self.assertIn("Booking visit (test)", started[0].details)

    def test_a_note_started_without_a_layout_is_exactly_as_before_and_a_bad_layout_is_refused(self):
        plain = self.start()
        draft = self.call("POST", f"{DOCTOR}/consultations/{plain['id']}/drafts", "doctor")
        self.assertNotIn("layout", draft["structuredContent"])
        self.assertNotIn("layoutSections", draft["structuredContent"])
        self.call("PATCH", f"{DOCTOR}/drafts/{draft['id']}", "doctor", {"layoutSections": {"Plan": "x"}}, expected=400)  # no layout, so no headings
        self.start(self.template("Draft only (test)", approved=False), expected=400)
        self.start(self.template("Lapsed (test)", review_in_days=-1), expected=400)
        self.start("not-a-real-id", expected=400)
        education = self.template("Not a layout (test)")
        with SessionLocal() as db:
            db.get(models.ClinicalResource, education).kind = "education"
            db.commit()
        self.start(education, expected=400)

    def test_another_doctor_cannot_start_a_note_for_this_patient(self):
        self.start(self.template(), who="other_doctor", expected=403)

    def test_the_layout_headings_follow_the_note_into_what_a_document_is_drafted_from(self):
        layout = self.template("Booking visit (test)", ("Presenting concern", "Plan"))
        consultation = self.start(layout)
        draft = self.call("POST", f"{DOCTOR}/consultations/{consultation['id']}/drafts", "doctor")
        self.call("PATCH", f"{DOCTOR}/drafts/{draft['id']}", "doctor", {"layoutSections": {"Presenting concern": "Back ache for three days."}})
        approved = self.call("POST", f"{DOCTOR}/drafts/{draft['id']}/approve", "doctor")
        self.assertEqual(approved["finalContent"]["layoutSections"]["Presenting concern"], "Back ache for three days.")
        from backend.app.continuity_service import source_snapshot
        with SessionLocal() as db:
            episode = db.get(models.PregnancyEpisode, self.ep)
            text = source_snapshot(db, episode, "consultation", approved["id"])["text"]
        self.assertIn("Presenting concern: Back ache for three days.", text)
        self.assertNotIn("{", text)  # the layout is flattened to words, not pasted as a dictionary
        self.assertNotIn("Plan:", text)  # an empty heading adds nothing

    # ---------------------------------------------------------------- the last approved visit
    def test_the_last_approved_visit_is_the_note_the_doctor_approved_and_nothing_else(self):
        other_episode = self.episode_without_approved_note()
        if other_episode:
            with SessionLocal() as db:
                doctor_of_other = db.query(models.PatientDoctorAssignment).filter_by(episode_id=other_episode).first().doctor_user_id
            self.assertIsNone(self.call("GET", f"{DOCTOR}/episodes/{other_episode}/last-approved-visit", "doctor" if doctor_of_other == self.doctor_id else "other_doctor"))
        layout = self.template("Booking visit (test)", ("Presenting concern",))
        consultation = self.start(layout)
        draft = self.call("POST", f"{DOCTOR}/consultations/{consultation['id']}/drafts", "doctor")
        self.call("PATCH", f"{DOCTOR}/drafts/{draft['id']}", "doctor", {"documentedDiscussion": "Discussed diet and rest.", "layoutSections": {"Presenting concern": "Tired in the evenings."}})
        self.call("POST", f"{DOCTOR}/drafts/{draft['id']}/approve", "doctor")
        last = self.call("GET", f"{DOCTOR}/episodes/{self.ep}/last-approved-visit", "doctor")
        self.assertEqual(last["consultationId"], consultation["id"])
        self.assertEqual(last["layoutTitle"], "Booking visit (test)")
        self.assertTrue(last["approvedByName"])
        texts = {(s["heading"] or s["key"]): s["text"] for s in last["sections"]}
        self.assertEqual(texts["documentedDiscussion"], "Discussed diet and rest.")
        self.assertEqual(texts["Presenting concern"], "Tired in the evenings.")
        self.call("GET", f"{DOCTOR}/episodes/{self.ep}/last-approved-visit", "other_doctor", expected=403)
        self.call("GET", f"{DOCTOR}/episodes/{self.ep}/last-approved-visit", "patient", expected=403)

    def episode_without_approved_note(self):
        with SessionLocal() as db:
            for episode in db.query(models.PregnancyEpisode).all():
                has = db.query(models.ApprovedConsultation).join(models.Consultation, models.ApprovedConsultation.consultation_id == models.Consultation.id).filter(models.Consultation.episode_id == episode.id).count()
                if not has and episode.id != self.ep:
                    return episode.id
        return None

    # ---------------------------------------------------------------- a doctor's own saved replies
    def test_a_doctor_keeps_her_own_saved_replies_and_no_one_else_can_reach_them(self):
        made = self.call("POST", f"{DOCTOR}/reply-snippets", "doctor", {"title": "Bring your MCP card", "text": "Please bring your MCP card and any scan reports to the visit."})
        self.made["snippets"].append(made["id"])
        self.assertEqual([s["title"] for s in self.call("GET", f"{DOCTOR}/reply-snippets", "doctor") if s["id"] == made["id"]], ["Bring your MCP card"])
        self.assertEqual([s for s in self.call("GET", f"{DOCTOR}/reply-snippets", "other_doctor") if s["id"] == made["id"]], [])
        self.call("PATCH", f"{DOCTOR}/reply-snippets/{made['id']}", "other_doctor", {"title": "Mine now", "text": "Nope"}, expected=404)
        self.call("DELETE", f"{DOCTOR}/reply-snippets/{made['id']}", "other_doctor", expected=404)
        changed = self.call("PATCH", f"{DOCTOR}/reply-snippets/{made['id']}", "doctor", {"title": "Bring your MCP card", "text": "Please bring your MCP card."})
        self.assertEqual(changed["text"], "Please bring your MCP card.")
        for who in ("patient", "ravi"):
            self.call("GET", f"{DOCTOR}/reply-snippets", who, expected=403)
        self.call("POST", f"{DOCTOR}/reply-snippets", "doctor", {"title": "x", "text": "too short title"}, expected=422)
        self.call("DELETE", f"{DOCTOR}/reply-snippets/{made['id']}", "doctor")
        self.assertEqual([s for s in self.call("GET", f"{DOCTOR}/reply-snippets", "doctor") if s["id"] == made["id"]], [])
        with SessionLocal() as db:
            actions = [a.action for a in db.query(models.AuditLog).filter(models.AuditLog.object_id == made["id"]).order_by(models.AuditLog.timestamp).all()]
        self.assertEqual(actions, ["reply_snippet_added", "reply_snippet_changed", "reply_snippet_deleted"])

    def test_a_doctor_can_keep_only_so_many_saved_replies(self):
        with SessionLocal() as db:
            existing = db.query(models.ReplySnippet).filter_by(doctor_user_id=self.doctor_id).count()
            for number in range(50 - existing):
                snippet = models.ReplySnippet(doctor_user_id=self.doctor_id, title=f"Filler {number}", text="Filler text")
                db.add(snippet)
                db.flush()
                self.made["snippets"].append(snippet.id)
            db.commit()
        self.call("POST", f"{DOCTOR}/reply-snippets", "doctor", {"title": "One too many", "text": "This one does not fit."}, expected=409)

    # ---------------------------------------------------------------- handled by phone or in the clinic
    def test_closing_a_question_handled_by_phone_keeps_the_note_for_doctors_and_tells_her_in_a_fixed_message(self):
        question = self.question()
        task = self.open_task(question["id"])
        item = self.open_proposal(question["id"])
        closed = self.call("POST", f"{DOCTOR}/questions/{question['id']}/close-handled", "doctor", {"note": NOTE})
        self.assertEqual((closed["status"], closed["closedHow"], closed["closedNote"]), ("CLOSED", "phone_or_clinic", NOTE))
        self.assertTrue(closed["closedAt"] and closed["closedByName"])
        self.assertEqual(self.doctor_row(question["id"])["closedNote"], NOTE)
        # her own page: closed, and the doctor's note is nowhere in what she is sent
        mine = self.client.get("/api/v2/patient/questions", headers=self.headers["patient"])
        self.assertEqual(next(q for q in mine.json() if q["id"] == question["id"])["status"], "CLOSED")
        self.assertNotIn(NOTE, mine.text)
        self.assertNotIn("closedNote", mine.text)
        # the open work for this question is closed like a written reply would close it
        with SessionLocal() as db:
            self.assertEqual(db.get(models.Task, task).status, "COMPLETED")
            decided = db.get(models.ExceptionItem, item)
            self.assertEqual((decided.status, decided.decided_by_user_id), ("DISMISSED", self.doctor_id))
            note = db.query(models.Notification).filter_by(related_entity_id=question["id"], message_key="question_handled_offline").one()
            self.assertEqual(note.recipient_user_id, self.sarah_id)
            self.assertNotIn(NOTE, (note.title or "") + (note.body or ""))
            audit = db.query(models.AuditLog).filter_by(action="question_closed_offline", object_id=question["id"]).one()
            self.assertEqual(audit.actor_user_id, self.doctor_id)
            self.assertIn("rang her", audit.details)

    def test_she_reads_the_fixed_message_in_her_language_and_it_leads_to_my_questions(self):
        question = self.question("When is the glucose test?")
        self.call("POST", f"{DOCTOR}/questions/{question['id']}/close-handled", "doctor", {"note": NOTE})
        updates = self.call("GET", "/api/v2/patient/updates", "patient")
        mine = next(u for u in updates if "handled your question" in u["title"] or u["link"] == "/patient/questions")
        self.assertEqual(mine["title"], "Your doctor handled your question by phone or at the clinic")
        self.assertEqual(mine["link"], "/patient/questions")
        self.call("PATCH", "/api/v2/continuity/preferences", "patient", {"language": "ta"})
        try:
            tamil = next(u for u in self.call("GET", "/api/v2/patient/updates", "patient") if u["link"] == "/patient/questions" and "தொலைபேசி" in u["title"])
            self.assertNotIn("handled", tamil["title"])
        finally:
            self.call("PATCH", "/api/v2/continuity/preferences", "patient", {"language": "en"})
        self.assertGreaterEqual(self.call("GET", "/api/v2/patient/updates/unread-summary", "patient")["questions"], 1)  # it lights the My Questions dot

    def test_a_question_cannot_be_closed_twice_or_without_a_real_note_or_by_the_wrong_person(self):
        question = self.question()
        self.call("POST", f"{DOCTOR}/questions/{question['id']}/close-handled", "doctor", {"note": "ok"}, expected=422)
        self.call("POST", f"{DOCTOR}/questions/{question['id']}/close-handled", "doctor", {}, expected=422)
        self.call("POST", f"{DOCTOR}/questions/{question['id']}/close-handled", "other_doctor", {"note": NOTE}, expected=403)
        self.call("POST", f"{DOCTOR}/questions/{question['id']}/close-handled", "patient", {"note": NOTE}, expected=403)
        self.call("POST", f"{DOCTOR}/questions/{question['id']}/close-handled", "doctor", {"note": NOTE})
        self.call("POST", f"{DOCTOR}/questions/{question['id']}/close-handled", "doctor", {"note": NOTE}, expected=409)

    def test_an_answered_question_cannot_be_closed_this_way(self):
        question = self.question()
        self.call("POST", f"{DOCTOR}/questions/{question['id']}/draft", "doctor", {"responseText": "Yes, that is fine."})
        self.call("POST", f"{DOCTOR}/questions/{question['id']}/approve-response", "doctor")
        self.call("POST", f"{DOCTOR}/questions/{question['id']}/close-handled", "doctor", {"note": NOTE}, expected=409)

    def test_a_trusted_person_never_sees_the_doctors_note_either(self):
        question = self.question("Can she travel in the next two weeks?")
        self.call("POST", f"{DOCTOR}/questions/{question['id']}/close-handled", "doctor", {"note": NOTE})
        shown = self.client.get(f"/api/v2/caregiver/{self.ravi_link}/questions", headers=self.headers["ravi"])
        self.assertEqual(shown.status_code, 200, shown.text)
        self.assertNotIn(NOTE, shown.text)

    def test_the_doctors_list_shows_the_new_fields_empty_for_an_ordinary_question(self):
        question = self.question()
        row = self.doctor_row(question["id"])
        for key in ("closedHow", "closedNote", "closedAt", "closedByName"):
            self.assertIsNone(row[key])

    # ---------------------------------------------------------------- helpers for the open work around a question
    def open_task(self, question_id):
        with SessionLocal() as db:
            task = models.Task(episode_id=self.ep, title="Reply to a patient question", owner_user_id=self.doctor_id, created_by_user_id=self.doctor_id, source_type="question_response", source_id=question_id)
            db.add(task)
            db.commit()
            self.made["tasks"].append(task.id)
            return task.id

    def open_proposal(self, question_id):
        with SessionLocal() as db:
            item = models.ExceptionItem(episode_id=self.ep, kind="proposal", title="Suggested reply", source_type="PatientQuestion", source_id=question_id, status="OPEN")
            db.add(item)
            db.commit()
            self.made["items"].append(item.id)
            return item.id


if __name__ == "__main__":
    unittest.main()
