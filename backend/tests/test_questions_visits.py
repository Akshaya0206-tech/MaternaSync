"""My Questions (follow-ups, attached files, the clinic's usual reply time) and Appointments (asking to cancel or move a confirmed visit).
Same isolated synthetic database as the other tests; each test puts back what it made."""
import unittest
from datetime import datetime, timedelta, timezone

import fitz
import testenv  # noqa: F401: sets the isolated database and settings before the app is imported

from backend.app import models
from backend.app.database import SessionLocal

from test_assistant_caregiver import Base

QUESTIONS = "/api/v2/patient/questions"
APPOINTMENTS = "/api/v2/patient/appointments"
REPLY = "/api/v2/assistant/reply-time"


def pdf_bytes(text="Haemoglobin test report. Collected at the clinic laboratory.") -> bytes:
    document = fitz.open()
    document.new_page().insert_text((72, 72), text)
    return document.tobytes()


def iso(moment):
    return moment.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


class QuestionsAndVisits(Base):
    def setUp(self):
        self.made = {"questions": [], "appointments": [], "documents": [], "tasks": []}
        with SessionLocal() as db:
            row = db.get(models.AssistantSetting, "reply_time")
            self.reply_before = row.value if row is not None else None

    def tearDown(self):
        with SessionLocal() as db:
            for question_id in reversed(self.made["questions"]):
                question = db.get(models.PatientQuestion, question_id)
                if question is not None:
                    db.delete(question)
            db.flush()
            for kind, model in (("tasks", models.Task), ("appointments", models.Appointment), ("documents", models.MedicalDocument)):
                for item_id in self.made[kind]:
                    item = db.get(model, item_id)
                    if item is not None:
                        db.delete(item)
            row = db.get(models.AssistantSetting, "reply_time")
            if row is not None:
                row.value = self.reply_before if self.reply_before is not None else ""
            db.commit()

    # ---------------------------------------------------------------- questions
    def ask(self, text="Is this tiredness something to mention?", who="patient", **extra):
        made = self.call("POST", QUESTIONS, who, {"questionText": text, **extra})
        self.made["questions"].append(made["id"])
        return made

    def assign_to_doctor(self, question_id, status=None):
        with SessionLocal() as db:
            question = db.get(models.PatientQuestion, question_id)
            question.assigned_to_user_id = self.doctor_id
            if status:
                question.status = status
            db.commit()

    def test_a_follow_up_is_linked_to_her_earlier_question_and_the_doctor_sees_it(self):
        first = self.ask("Earlier question about tiredness")
        self.assign_to_doctor(first["id"], "ANSWERED")
        follow = self.ask("I still feel very tired. What should I do?", followUpOf=first["id"])
        self.assertEqual(follow["followUpOfId"], first["id"])
        self.assertEqual(follow["followUpOfText"], "Earlier question about tiredness")
        self.assertEqual(follow["status"], "NEW")  # it is a new question and takes the usual route to the doctor
        mine = {q["id"]: q for q in self.call("GET", QUESTIONS, "patient")}
        self.assertEqual(mine[follow["id"]]["followUpOfText"], "Earlier question about tiredness")
        self.assertIsNone(mine[first["id"]]["followUpOfId"])
        self.assign_to_doctor(follow["id"])
        seen = {q["id"]: q for q in self.call("GET", "/api/v2/doctor/questions", "doctor")}
        self.assertEqual(seen[follow["id"]]["followUpOfText"], "Earlier question about tiredness")
        self.assertIsNone(seen[first["id"]]["followUpOfText"])

    def test_a_follow_up_to_someone_elses_or_an_unknown_question_is_refused(self):
        hers = self.call("POST", QUESTIONS, "other_patient", {"questionText": "A question that belongs to Elena"})
        self.made["questions"].append(hers["id"])
        self.call("POST", QUESTIONS, "patient", {"questionText": "Following up on Elena's", "followUpOf": hers["id"]}, expected=404)
        self.call("POST", QUESTIONS, "patient", {"questionText": "Following up on nothing", "followUpOf": "no-such-question"}, expected=404)

    def test_a_file_attached_to_a_question_is_a_document_the_doctor_can_open(self):
        question = self.ask("I have a scan report, can you look at it?")
        sent = self.client.post(f"{QUESTIONS}/{question['id']}/attachments", headers=self.headers["patient"], files={"file": ("scan-report.pdf", pdf_bytes(), "application/pdf")})
        self.assertEqual(sent.status_code, 200, sent.text)
        attached = sent.json()
        self.made["documents"].append(attached["id"])
        self.assertEqual(attached["filename"], "scan-report.pdf")
        # on her list
        mine = {q["id"]: q for q in self.call("GET", QUESTIONS, "patient")}
        self.assertEqual(mine[question["id"]]["attachments"], [{"id": attached["id"], "filename": "scan-report.pdf"}])
        # it is an ordinary document waiting to be reviewed, like anything she uploads
        documents = {d["id"]: d for d in self.call("GET", "/api/v2/patient/documents", "patient")}
        self.assertEqual(documents[attached["id"]]["status"], "NEEDS_REVIEW")
        with SessionLocal() as db:
            self.assertEqual(db.query(models.AuditLog).filter_by(action="question_file_attached", object_id=question["id"]).count(), 1)
        # the doctor sees and opens it
        self.assign_to_doctor(question["id"])
        listed = {q["id"]: q for q in self.call("GET", "/api/v2/doctor/questions", "doctor")}
        self.assertEqual(listed[question["id"]]["attachments"], [{"id": attached["id"], "filename": "scan-report.pdf"}])
        opened = self.client.get(f"/api/v2/doctor/documents/{attached['id']}/file", headers=self.headers["doctor"])
        self.assertEqual(opened.status_code, 200)
        self.assertTrue(opened.content.startswith(b"%PDF"))
        # a doctor who is not hers cannot
        self.assertEqual(self.client.get(f"/api/v2/doctor/documents/{attached['id']}/file", headers=self.headers["other_doctor"]).status_code, 403)

    def test_attachments_are_limited_and_only_for_her_own_questions(self):
        question = self.ask("A question with several files")
        url = f"{QUESTIONS}/{question['id']}/attachments"
        for number in range(3):
            done = self.client.post(url, headers=self.headers["patient"], files={"file": (f"page-{number}.pdf", pdf_bytes(f"Page {number}"), "application/pdf")})
            self.assertEqual(done.status_code, 200, done.text)
            self.made["documents"].append(done.json()["id"])
        fourth = self.client.post(url, headers=self.headers["patient"], files={"file": ("page-3.pdf", pdf_bytes("Page 3"), "application/pdf")})
        self.assertEqual(fourth.status_code, 400)
        other = self.ask("Another question")
        wrong = self.client.post(f"{QUESTIONS}/{other['id']}/attachments", headers=self.headers["patient"], files={"file": ("notes.txt", b"hello", "text/plain")})
        self.assertEqual(wrong.status_code, 400)
        empty = self.client.post(f"{QUESTIONS}/{other['id']}/attachments", headers=self.headers["patient"], files={"file": ("empty.pdf", b"", "application/pdf")})
        self.assertEqual(empty.status_code, 400)
        stranger = self.client.post(url, headers=self.headers["other_patient"], files={"file": ("x.pdf", pdf_bytes(), "application/pdf")})
        self.assertEqual(stranger.status_code, 404)
        gone = self.client.post(f"{QUESTIONS}/no-such-question/attachments", headers=self.headers["patient"], files={"file": ("x.pdf", pdf_bytes(), "application/pdf")})
        self.assertEqual(gone.status_code, 404)

    def test_the_usual_reply_time_is_set_by_a_doctor_and_read_by_the_patient(self):
        self.assertEqual(self.call("GET", "/api/v2/patient/questions-info", "patient")["replyTime"], "")
        self.call("PUT", REPLY, "doctor", {"text": "  within 1 working day  "})
        self.assertEqual(self.call("GET", "/api/v2/patient/questions-info", "patient")["replyTime"], "within 1 working day")
        self.assertEqual(self.call("GET", REPLY, "doctor")["text"], "within 1 working day")
        with SessionLocal() as db:
            changed = db.query(models.AuditLog).filter_by(action="reply_time_changed").order_by(models.AuditLog.timestamp.desc()).first()
            self.assertEqual(changed.details, "within 1 working day")
        self.call("PUT", REPLY, "patient", {"text": "never"}, expected=403)
        self.call("GET", REPLY, "patient", expected=403)
        self.call("PUT", REPLY, "doctor", {"text": "x" * 101}, expected=422)
        self.call("PUT", REPLY, "doctor", {"text": ""})
        self.assertEqual(self.call("GET", "/api/v2/patient/questions-info", "patient")["replyTime"], "")

    def test_the_demonstration_question_reads_as_her_own_words(self):
        with SessionLocal() as db:
            asked = [q.question_text for q in db.query(models.PatientQuestion).filter_by(asked_by_user_id=self.sarah_id).all() if "134/86" in q.question_text]
        self.assertTrue(asked)
        for text in asked:
            self.assertFalse(text.startswith("Patient sent portal message"), text)
            self.assertTrue(text.startswith("My home BP was 134/86"), text)

    # ---------------------------------------------------------------- visits
    def visit(self, days=3, status="scheduled", kind="Check-up"):
        with SessionLocal() as db:
            appointment = models.Appointment(episode_id=self.ep, scheduled_at=(datetime.now(timezone.utc) + timedelta(days=days)).replace(tzinfo=None),
                                             appointment_type=kind, status=status, location="Test clinic, 4 Lake Road")
            db.add(appointment)
            db.commit()
            self.made["appointments"].append(appointment.id)
            return appointment.id

    def mine(self, appointment_id):
        return next(a for a in self.call("GET", APPOINTMENTS, "patient") if a["id"] == appointment_id)

    def task_for(self, appointment_id):
        with SessionLocal() as db:
            task = db.query(models.Task).filter_by(source_type="appointment_change", source_id=appointment_id).first()
            if task is not None and task.id not in self.made["tasks"]:
                self.made["tasks"].append(task.id)
            return (task.id, task.status, task.owner_user_id, task.title, task.description) if task else None

    def messages(self, user_id, key, appointment_id):
        with SessionLocal() as db:
            return db.query(models.Notification).filter_by(recipient_user_id=user_id, message_key=key, related_entity_id=appointment_id).count()

    def test_asking_to_cancel_only_asks_and_the_doctor_gets_a_task(self):
        visit = self.visit()
        asked = self.call("POST", f"{APPOINTMENTS}/{visit}/change-request", "patient", {"kind": "cancel", "note": "I cannot travel that day"})
        self.assertEqual(asked["status"], "scheduled")  # nothing changed
        self.assertEqual(asked["changeRequest"]["kind"], "cancel")
        self.assertEqual(asked["changeRequest"]["note"], "I cannot travel that day")
        self.assertEqual(self.mine(visit)["changeRequest"]["kind"], "cancel")
        task = self.task_for(visit)
        self.assertEqual(task[1], "OPEN")
        self.assertEqual(task[2], self.doctor_id)
        self.assertIn("cancel the visit", task[3])
        self.assertIn("Nothing has been changed", task[4])
        self.assertIn("I cannot travel that day", task[4])
        self.assertEqual(self.messages(self.doctor_id, "visit_change_requested", visit), 1)
        self.assertEqual(self.messages(self.sarah_id, "visit_change_sent", visit), 1)
        with SessionLocal() as db:
            self.assertEqual(db.query(models.AuditLog).filter_by(action="visit_change_requested", object_id=visit).count(), 1)
            self.assertEqual(db.query(models.Appointment).filter_by(episode_id=self.ep, status="requested", appointment_type="Check-up").count(), 0)
        self.call("POST", f"{APPOINTMENTS}/{visit}/change-request", "patient", {"kind": "cancel"}, expected=409)  # one at a time

    def test_withdrawing_a_request_closes_the_task_and_leaves_the_visit_alone(self):
        visit = self.visit()
        self.call("POST", f"{APPOINTMENTS}/{visit}/change-request", "patient", {"kind": "cancel"})
        back = self.call("DELETE", f"{APPOINTMENTS}/{visit}/change-request", "patient")
        self.assertEqual(back["status"], "scheduled")
        self.assertIsNone(back["changeRequest"])
        self.assertEqual(self.task_for(visit)[1], "COMPLETED")
        self.assertEqual(self.messages(self.doctor_id, "visit_change_withdrawn", visit), 1)
        self.call("DELETE", f"{APPOINTMENTS}/{visit}/change-request", "patient", expected=409)  # nothing left to withdraw
        self.call("POST", f"{APPOINTMENTS}/{visit}/change-request", "patient", {"kind": "cancel"})  # she can ask again

    def test_asking_to_move_a_visit_makes_a_visit_request_for_the_new_time(self):
        visit = self.visit(days=3)
        wanted = datetime.now(timezone.utc) + timedelta(days=6)
        asked = self.call("POST", f"{APPOINTMENTS}/{visit}/change-request", "patient", {"kind": "reschedule", "preferredAt": iso(wanted), "note": "Mornings are better"})
        self.assertEqual(asked["status"], "scheduled")
        self.assertEqual(asked["changeRequest"]["kind"], "reschedule")
        with SessionLocal() as db:
            old = db.get(models.Appointment, visit)
            new = db.get(models.Appointment, old.change_new_appointment_id)
            self.made["appointments"].append(new.id)
            self.assertEqual(new.status, "requested")
            self.assertEqual(new.appointment_type, "Check-up")
            self.assertAlmostEqual(new.scheduled_at.timestamp(), wanted.replace(tzinfo=None).timestamp(), delta=2)
            self.assertIn("Mornings are better", new.notes)
            self.assertEqual(db.query(models.AIRun).filter_by(workflow="appointment_request", source_id=new.id).count(), 1)  # the booking check runs on it
            new_id = new.id
        self.assertIn("move the visit", self.task_for(visit)[3])
        listed = {a["id"]: a for a in self.call("GET", APPOINTMENTS, "patient")}
        self.assertEqual(listed[new_id]["status"], "requested")
        self.call("DELETE", f"{APPOINTMENTS}/{visit}/change-request", "patient")
        self.assertNotIn(new_id, [a["id"] for a in self.call("GET", APPOINTMENTS, "patient")])  # her own withdrawn request is not listed as "not going ahead"
        with SessionLocal() as db:
            self.assertEqual(db.get(models.Appointment, new_id).status, "cancelled")  # it is withdrawn with the request, and stays on record
        self.assertEqual(self.mine(visit)["status"], "scheduled")

    def test_a_request_needs_a_confirmed_future_visit_of_her_own_and_a_sensible_time(self):
        visit = self.visit()
        self.call("POST", f"{APPOINTMENTS}/{visit}/change-request", "patient", {"kind": "reschedule"}, expected=422)  # no time given
        self.call("POST", f"{APPOINTMENTS}/{visit}/change-request", "patient", {"kind": "reschedule", "preferredAt": iso(datetime.now(timezone.utc) - timedelta(days=1))}, expected=422)
        self.call("POST", f"{APPOINTMENTS}/{visit}/change-request", "patient", {"kind": "reschedule", "preferredAt": "2030-01-01T10:00:00"}, expected=422)  # no time zone
        self.call("POST", f"{APPOINTMENTS}/{visit}/change-request", "patient", {"kind": "delete"}, expected=422)
        self.call("POST", f"{APPOINTMENTS}/{visit}/change-request", "other_patient", {"kind": "cancel"}, expected=404)
        waiting = self.visit(status="requested")
        self.call("POST", f"{APPOINTMENTS}/{waiting}/change-request", "patient", {"kind": "cancel"}, expected=409)
        past = self.visit(days=-2)
        self.call("POST", f"{APPOINTMENTS}/{past}/change-request", "patient", {"kind": "cancel"}, expected=409)
        self.call("POST", f"{APPOINTMENTS}/no-such-visit/change-request", "patient", {"kind": "cancel"}, expected=404)
        self.call("DELETE", f"{APPOINTMENTS}/{waiting}/change-request", "patient", expected=409)

    def test_a_doctor_cancelling_the_visit_answers_the_request(self):
        visit = self.visit()
        self.call("POST", f"{APPOINTMENTS}/{visit}/change-request", "patient", {"kind": "cancel"})
        self.assertEqual(self.task_for(visit)[1], "OPEN")
        self.call("PATCH", f"/api/v2/continuity/appointments/{visit}", "doctor", {"status": "cancelled"})
        self.assertEqual(self.task_for(visit)[1], "COMPLETED")
        after = self.mine(visit)
        self.assertEqual(after["status"], "cancelled")
        self.assertIsNone(after["changeRequest"])
        with SessionLocal() as db:
            self.assertIsNone(db.get(models.Appointment, visit).change_kind)

    def test_the_change_request_is_not_part_of_other_patients_lists_or_the_dashboard(self):
        visit = self.visit()
        self.call("POST", f"{APPOINTMENTS}/{visit}/change-request", "patient", {"kind": "cancel"})
        others = self.call("GET", APPOINTMENTS, "other_patient")
        self.assertNotIn(visit, [a["id"] for a in others])
        home = self.call("GET", "/api/v2/patient/dashboard", "patient")
        self.assertIn("nextAppointment", home)


if __name__ == "__main__":
    unittest.main()
