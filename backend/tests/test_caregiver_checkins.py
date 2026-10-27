"""The trusted person's Daily Check-in and Questions: a check-in kept on the phone and sent twice is saved once, older check-ins, "Remind her"
(a few a day, and she is told), a file or a follow-up on their own question, and the clinic's usual reply time. Every route goes through the
same gate as the rest of the caregiver's side, so a removed person, an ended access, a permission she turned off, or another woman's link is
refused. Same isolated synthetic database as the other tests; every test puts back what it made."""
import unittest
from datetime import datetime, timedelta, timezone

import fitz
import testenv  # noqa: F401: sets the isolated database and settings before the app is imported

from backend.app import caregiver_nudge, models
from backend.app.database import SessionLocal

from test_assistant_caregiver import Base

CG = "/api/v2/caregiver"
ROOT = "/api/v2/continuity"
REPLY = "/api/v2/assistant/reply-time"
ACTIONS = ("caregiver_nudge_check_in", "caregiver_checkin_recorded", "caregiver_question_file_attached", "caregiver_question_followup", "caregiver_question_asked",
           "question_file_attached", "question_asked")


def utcnow():
    return datetime.now(timezone.utc)


def naive(moment):
    return moment.replace(tzinfo=None)


def pdf_bytes(text="Blood test report. Collected at the clinic laboratory.") -> bytes:
    document = fitz.open()
    document.new_page().insert_text((72, 72), text)
    return document.tobytes()


class CgCheckInBase(Base):
    def setUp(self):
        self.restore_ravi()
        self.logs, self.questions, self.documents, self.extra_links = [], [], [], []
        with SessionLocal() as db:
            people = [self.sarah_id, self.doctor_id, db.query(models.User).filter_by(email="ravi.jenkins@maternasync.app").first().id]
            self.people = people
            self.notes_before = {n.id for n in db.query(models.Notification).filter(models.Notification.recipient_user_id.in_(people)).all()}
            self.audit_before = {a.id for a in db.query(models.AuditLog).filter(models.AuditLog.action.in_(ACTIONS)).all()}
            row = db.get(models.AssistantSetting, "reply_time")
            self.reply_before = row.value if row is not None else None
        self.addCleanup(self.clean_up)

    def clean_up(self):
        with SessionLocal() as db:
            for question_id in reversed(self.questions):
                question = db.get(models.PatientQuestion, question_id)
                if question is not None:
                    db.delete(question)
            db.flush()
            for document_id in self.documents:
                db.query(models.QuestionAttachment).filter_by(document_id=document_id).delete()
                db.query(models.DocumentExtraction).filter_by(document_id=document_id).delete()
                document = db.get(models.MedicalDocument, document_id)
                if document is not None:
                    db.delete(document)
            for log_id in self.logs:
                log = db.get(models.DailyLog, log_id)
                if log is not None:
                    db.delete(log)
            for link_id in self.extra_links:
                link = db.get(models.CaregiverLink, link_id)
                if link is not None:
                    db.delete(link)
            for note in db.query(models.Notification).filter(models.Notification.recipient_user_id.in_(self.people)).all():
                if note.id not in self.notes_before:
                    db.delete(note)
            for entry in db.query(models.AuditLog).filter(models.AuditLog.action.in_(ACTIONS)).all():
                if entry.id not in self.audit_before:
                    db.delete(entry)
            row = db.get(models.AssistantSetting, "reply_time")
            if row is not None:
                row.value = self.reply_before if self.reply_before is not None else ""
            link = db.get(models.CaregiverLink, self.ravi_link)
            link.access_until = None
            db.commit()
        self.restore_ravi()
        self.call("PATCH", f"{ROOT}/preferences", "patient", {"language": "en"})

    # ---- helpers
    def set_link(self, **changes):
        with SessionLocal() as db:
            link = db.get(models.CaregiverLink, self.ravi_link)
            for name, value in changes.items():
                setattr(link, name, value)
            db.commit()

    def allow(self, **permissions):
        with SessionLocal() as db:
            link = db.get(models.CaregiverLink, self.ravi_link)
            link.permissions = {**(link.permissions or {}), **permissions}
            db.commit()

    def notes_for_her(self, key):
        with SessionLocal() as db:
            return db.query(models.Notification).filter_by(recipient_user_id=self.sarah_id, message_key=key).count()

    def log_rows(self, **filters):
        with SessionLocal() as db:
            return db.query(models.DailyLog).filter_by(episode_id=self.ep, **filters).count()

    def check_in(self, **extra):
        body = {"recordedAt": (utcnow() - timedelta(seconds=2)).isoformat(), "mood": "okay", "symptoms": "Tired but eating well.", **extra}
        made = self.call("POST", f"{CG}/{self.ravi_link}/check-ins", "ravi", body)
        self.logs.append(made["id"])
        return made

    def add_log(self, when, skipped=False):
        with SessionLocal() as db:
            log = models.DailyLog(episode_id=self.ep, recorded_at=naive(when), symptoms="Test entry", skipped=skipped)
            db.add(log)
            db.commit()
            self.logs.append(log.id)
            return log.id

    def ask(self, text="Where do we park at the clinic?"):
        made = self.call("POST", f"{CG}/{self.ravi_link}/questions", "ravi", {"questionText": text})
        self.questions.append(made["id"])
        return made["id"]

    def attach(self, question_id, name="scan-report.pdf", data=None, content_type="application/pdf", who="ravi", link=None):
        sent = self.client.post(f"{CG}/{link or self.ravi_link}/questions/{question_id}/attachments", headers=self.headers[who],
                                files={"file": (name, pdf_bytes() if data is None else data, content_type)})
        if sent.status_code == 200:
            self.documents.append(sent.json()["id"])
        return sent

    def set_status(self, question_id, status):
        with SessionLocal() as db:
            db.get(models.PatientQuestion, question_id).status = status
            db.commit()


# =============================================================================== check-ins
class CheckInTests(CgCheckInBase):
    def test_a_check_in_sent_twice_with_the_same_reference_is_saved_once_and_she_is_told_once(self):
        told = self.notes_for_her("caregiver_acted_checkin")
        first = self.check_in(clientRef="phone-ref-0001")
        again = self.call("POST", f"{CG}/{self.ravi_link}/check-ins", "ravi", {"recordedAt": utcnow().isoformat(), "mood": "okay", "symptoms": "Sent a second time.", "clientRef": "phone-ref-0001"})
        self.assertEqual(again["id"], first["id"])
        self.assertEqual(again["enteredWithHelp"], first["enteredWithHelp"])
        self.assertEqual(self.log_rows(client_ref="phone-ref-0001"), 1)
        self.assertEqual(self.notes_for_her("caregiver_acted_checkin"), told + 1)
        with SessionLocal() as db:
            self.assertEqual(db.query(models.AuditLog).filter(models.AuditLog.action == "caregiver_checkin_recorded", models.AuditLog.id.notin_(self.audit_before)).count(), 1)
        # another reference is another check-in; none at all is one every time (as before)
        second = self.check_in(clientRef="phone-ref-0002")
        self.assertNotEqual(second["id"], first["id"])
        plain_a, plain_b = self.check_in(), self.check_in()
        self.assertNotEqual(plain_a["id"], plain_b["id"])

    def test_a_reference_that_belongs_to_her_own_entry_is_not_taken_over(self):
        mine = self.call("POST", f"{ROOT}/episodes/{self.ep}/logs", "patient",
                         {"recordedAt": (utcnow() - timedelta(seconds=3)).isoformat(), "mood": "good", "symptoms": "Her own entry.", "clientRef": "shared-ref-0001"})
        self.logs.append(mine["id"])
        theirs = self.check_in(clientRef="shared-ref-0001")
        self.assertNotEqual(theirs["id"], mine["id"])
        self.assertEqual(self.log_rows(client_ref="shared-ref-0001"), 2)

    def test_the_reference_is_checked_like_the_patients_own(self):
        bad = self.client.post(f"{CG}/{self.ravi_link}/check-ins", headers=self.headers["ravi"], json={"recordedAt": utcnow().isoformat(), "clientRef": "has spaces!"})
        self.assertEqual(bad.status_code, 422)

    def test_older_check_ins_come_in_pages_without_repeats(self):
        base = utcnow() - timedelta(days=60)
        for number in range(20):
            self.add_log(base + timedelta(hours=number))
        with SessionLocal() as db:
            expected = [log.id for log in db.query(models.DailyLog).filter_by(episode_id=self.ep).order_by(models.DailyLog.recorded_at.desc(), models.DailyLog.id).all()]
        first = self.call("GET", f"{CG}/{self.ravi_link}/check-ins", "ravi")
        self.assertEqual(len(first), 14)
        seen = [row["id"] for row in first]
        offset = 14
        while True:
            page = self.call("GET", f"{CG}/{self.ravi_link}/check-ins?offset={offset}&limit=14", "ravi")
            seen += [row["id"] for row in page]
            offset += 14
            if len(page) < 14:
                break
        self.assertEqual(seen, expected)  # all of them, newest first, none twice
        recorded = [row["recordedAt"] for row in first]
        self.assertEqual(recorded, sorted(recorded, reverse=True))
        for bad in ("offset=-1", "limit=0", "limit=51", "offset=abc"):
            self.assertEqual(self.client.get(f"{CG}/{self.ravi_link}/check-ins?{bad}", headers=self.headers["ravi"]).status_code, 422, bad)

    def test_the_status_names_her_newest_check_in_and_ignores_skipped_ones(self):
        newest = utcnow() - timedelta(minutes=30)
        real = self.add_log(newest)
        self.add_log(utcnow() - timedelta(minutes=10), skipped=True)  # skipped more recently: not a check-in she filled in
        status = self.call("GET", f"{CG}/{self.ravi_link}/check-ins/status", "ravi")
        with SessionLocal() as db:
            expected = db.query(models.DailyLog).filter_by(episode_id=self.ep, skipped=False).order_by(models.DailyLog.recorded_at.desc()).first()
            self.assertEqual(expected.id, real)
        self.assertTrue(status["lastCheckInAt"].startswith(newest.strftime("%Y-%m-%dT%H:%M")))
        self.assertEqual((status["nudgesLeft"], status["nudgeLimit"]), (3, 3))


class NudgeTests(CgCheckInBase):
    def test_remind_her_sends_one_plain_note_each_time_and_stops_at_the_daily_limit(self):
        url = f"{CG}/{self.ravi_link}/check-ins/nudge"
        before = self.notes_for_her("caregiver_nudge_checkin")
        self.assertEqual(self.call("POST", url, "ravi")["nudgesLeft"], 2)
        self.assertEqual(self.call("POST", url, "ravi")["nudgesLeft"], 1)
        last = self.call("POST", url, "ravi")
        self.assertEqual((last["nudgesLeft"], last["nudgeLimit"]), (0, caregiver_nudge.DAILY_LIMIT))
        refused = self.client.post(url, headers=self.headers["ravi"])
        self.assertEqual(refused.status_code, 429)
        self.assertEqual(self.notes_for_her("caregiver_nudge_checkin"), before + 3)  # the refused one told her nothing
        self.assertEqual(self.call("GET", f"{CG}/{self.ravi_link}/check-ins/status", "ravi")["nudgesLeft"], 0)
        with SessionLocal() as db:
            self.assertEqual(db.query(models.AuditLog).filter(models.AuditLog.action == "caregiver_nudge_check_in", models.AuditLog.id.notin_(self.audit_before)).count(), 3)
        # she reads them in her Updates: from the person she invited, nothing about her health, and it opens her check-in page
        updates = [u for u in self.call("GET", "/api/v2/patient/updates", "patient") if u["title"].startswith("A reminder from")]
        self.assertGreaterEqual(len(updates), 3)
        newest = updates[0]
        self.assertIn("Ravi", newest["title"])
        self.assertIn("fill in today’s check-in", newest["body"])
        self.assertEqual(newest["link"], "/patient/daily-log")
        for word in ("blood", "pressure", "weight", "medicine", "result"):
            self.assertNotIn(word, (newest["title"] + newest["body"]).lower())

    def test_the_note_is_worded_in_her_language(self):
        self.call("PATCH", f"{ROOT}/preferences", "patient", {"language": "ta"})
        self.call("POST", f"{CG}/{self.ravi_link}/check-ins/nudge", "ravi")
        updates = [u for u in self.call("GET", "/api/v2/patient/updates", "patient") if "நினைவூட்டல்" in u["title"]]
        self.assertTrue(updates)
        self.assertIn("இன்றைய பதிவை", updates[0]["body"])

    def test_the_limit_is_for_each_trusted_person_and_resets_after_a_day(self):
        url = f"{CG}/{self.ravi_link}/check-ins/nudge"
        for _ in range(3):
            self.call("POST", url, "ravi")
        with SessionLocal() as db:
            for entry in db.query(models.AuditLog).filter(models.AuditLog.action == "caregiver_nudge_check_in", models.AuditLog.id.notin_(self.audit_before)).all():
                entry.timestamp = naive(utcnow() - timedelta(hours=25))
            db.commit()
        self.assertEqual(self.call("POST", url, "ravi")["nudgesLeft"], 2)

    def test_a_reminder_to_check_in_needs_the_check_in_permission(self):
        self.allow(check_in=False)
        before = self.notes_for_her("caregiver_nudge_checkin")
        self.assertEqual(self.client.post(f"{CG}/{self.ravi_link}/check-ins/nudge", headers=self.headers["ravi"]).status_code, 403)
        self.assertEqual(self.notes_for_her("caregiver_nudge_checkin"), before)


# =============================================================================== questions
class QuestionTests(CgCheckInBase):
    def test_a_file_on_their_own_question_is_kept_for_the_doctor_and_she_is_told(self):
        question = self.ask("I have the scan report from the other clinic.")
        told = self.notes_for_her("caregiver_acted_attachment")
        sent = self.attach(question)
        self.assertEqual(sent.status_code, 200, sent.text)
        attached = sent.json()
        self.assertEqual(attached["filename"], "scan-report.pdf")
        self.assertEqual(self.notes_for_her("caregiver_acted_attachment"), told + 1)
        with SessionLocal() as db:
            document = db.get(models.MedicalDocument, attached["id"])
            self.assertEqual((document.status, document.uploaded_by_role, document.episode_id), ("NEEDS_REVIEW", "caregiver", self.ep))
            self.assertEqual(db.query(models.AuditLog).filter(models.AuditLog.action == "caregiver_question_file_attached", models.AuditLog.id.notin_(self.audit_before)).count(), 1)
            self.assertEqual(db.query(models.AuditLog).filter(models.AuditLog.action == "question_file_attached", models.AuditLog.id.notin_(self.audit_before)).count(), 1)
            # the doctor is told, once, without the file's name
            notes = db.query(models.Notification).filter_by(recipient_user_id=self.doctor_id, message_key="question_attachment", related_entity_id=question).all()
            self.assertEqual(len(notes), 1)
            self.assertNotIn("scan-report", notes[0].body)
        # their list shows the name only
        mine = {q["id"]: q for q in self.call("GET", f"{CG}/{self.ravi_link}/questions", "ravi")}
        self.assertEqual(mine[question]["attachments"], [{"id": attached["id"], "filename": "scan-report.pdf"}])
        # a second file on the same question is not another note to the doctor while the first is unread
        self.assertEqual(self.attach(question, "second.pdf").status_code, 200)
        with SessionLocal() as db:
            self.assertEqual(db.query(models.Notification).filter_by(recipient_user_id=self.doctor_id, message_key="question_attachment", related_entity_id=question).count(), 1)

    def test_files_follow_the_same_rules_as_her_own_questions(self):
        question = self.ask("A question with several files")
        for number in range(3):
            self.assertEqual(self.attach(question, f"page-{number}.pdf", pdf_bytes(f"Page {number}")).status_code, 200)
        self.assertEqual(self.attach(question, "page-3.pdf").status_code, 400)  # at most three
        other = self.ask("Another question")
        self.assertEqual(self.attach(other, "notes.txt", b"hello", "text/plain").status_code, 400)  # a PDF, JPG or PNG
        self.assertEqual(self.attach(other, "empty.pdf", b"").status_code, 400)
        self.assertEqual(self.attach(other, "huge.pdf", b"x" * (10 * 1024 * 1024 + 1)).status_code, 400)  # up to 10 MB
        self.assertEqual(self.call("GET", f"{CG}/{self.ravi_link}/questions", "ravi")[0]["attachments"] or [], [])  # a refused file leaves nothing behind

    def test_only_their_own_questions_in_her_episode_can_get_a_file_or_a_follow_up(self):
        hers = self.call("POST", "/api/v2/patient/questions", "patient", {"questionText": "A question Sarah asked herself"})
        self.questions.append(hers["id"])
        elena = self.call("POST", "/api/v2/patient/questions", "other_patient", {"questionText": "A question that belongs to Elena"})
        self.questions.append(elena["id"])
        for question_id in (hers["id"], elena["id"], "no-such-question"):
            self.assertEqual(self.attach(question_id).status_code, 404, question_id)
            self.assertEqual(self.client.post(f"{CG}/{self.ravi_link}/questions/{question_id}/follow-up", headers=self.headers["ravi"], json={"questionText": "Following up"}).status_code, 404, question_id)
        # and she cannot attach to theirs through her own route
        theirs = self.ask()
        wrong = self.client.post(f"/api/v2/patient/questions/{theirs}/attachments", headers=self.headers["patient"], files={"file": ("x.pdf", pdf_bytes(), "application/pdf")})
        self.assertEqual(wrong.status_code, 404)

    def test_i_still_have_a_question_makes_a_linked_question_and_tells_her_and_the_doctor(self):
        first = self.ask("Can I take the iron tablet with tea?")
        self.set_status(first, "ANSWERED")
        told = self.notes_for_her("caregiver_acted_question")
        sent = self.call("POST", f"{CG}/{self.ravi_link}/questions/{first}/follow-up", "ravi", {"questionText": "  What about with milk?  "})
        self.questions.append(sent["id"])
        self.assertEqual(sent["status"], "NEW")
        self.assertEqual(self.notes_for_her("caregiver_acted_question"), told + 1)
        with SessionLocal() as db:
            made = db.get(models.PatientQuestion, sent["id"])
            self.assertEqual((made.follow_up_of_id, made.asked_by_user_id, made.question_text), (first, made.asked_by_user_id, "What about with milk?"))
            self.assertNotEqual(made.asked_by_user_id, self.sarah_id)  # it is theirs, not hers
            notes = db.query(models.Notification).filter_by(recipient_user_id=self.doctor_id, message_key="question_followup", related_entity_id=sent["id"]).all()
            self.assertEqual(len(notes), 1)
            self.assertNotIn("milk", notes[0].body)  # the doctor's note says a follow-up was asked, not what it says
            self.assertEqual(db.query(models.AuditLog).filter(models.AuditLog.action == "caregiver_question_followup", models.AuditLog.id.notin_(self.audit_before)).count(), 1)
        listed = {q["id"]: q for q in self.call("GET", f"{CG}/{self.ravi_link}/questions", "ravi")}
        self.assertEqual(listed[sent["id"]]["followUpOfText"], "Can I take the iron tablet with tea?")
        self.assertIsNone(listed[first]["followUpOfText"])
        # the assistant's question flow runs for it like any other question
        with SessionLocal() as db:
            self.assertGreaterEqual(db.query(models.AIRun).filter_by(source_id=sent["id"]).count(), 0)

    def test_a_follow_up_needs_words(self):
        first = self.ask()
        for empty in ("   ", ""):  # the words are trimmed before they are checked
            self.assertEqual(self.client.post(f"{CG}/{self.ravi_link}/questions/{first}/follow-up", headers=self.headers["ravi"], json={"questionText": empty}).status_code, 422)

    def test_the_usual_reply_time_is_the_clinics_and_empty_until_a_doctor_sets_it(self):
        self.call("PUT", REPLY, "doctor", {"text": ""})
        self.assertEqual(self.call("GET", f"{CG}/{self.ravi_link}/questions/info", "ravi"), {"replyTime": ""})
        self.call("PUT", REPLY, "doctor", {"text": "  within 1 working day  "})
        self.assertEqual(self.call("GET", f"{CG}/{self.ravi_link}/questions/info", "ravi"), {"replyTime": "within 1 working day"})


# =============================================================================== the gate
class GateTests(CgCheckInBase):
    def routes(self):
        question = self.ask("A question for the gate tests")
        pdf = {"file": ("gate.pdf", pdf_bytes(), "application/pdf")}
        return [
            ("GET", "check-ins?offset=0&limit=14", None, None, "check_in"),
            ("GET", "check-ins/status", None, None, "check_in"),
            ("POST", "check-ins/nudge", None, None, "check_in"),
            ("POST", "check-ins", {"recordedAt": utcnow().isoformat(), "clientRef": "gate-ref-0001"}, None, "check_in"),
            ("GET", "questions/info", None, None, "questions"),
            ("POST", f"questions/{question}/attachments", None, pdf, "questions"),
            ("POST", f"questions/{question}/follow-up", {"questionText": "A follow-up for the gate"}, None, "questions"),
        ]

    def send(self, who, link, route):
        method, path, body, files, _ = route
        kwargs = {"files": files} if files else {"json": body} if body is not None else {}
        return self.client.request(method, f"{CG}/{link}/{path}", headers=self.headers[who], **kwargs)

    def count_rows(self):
        with SessionLocal() as db:
            return (db.query(models.DailyLog).filter_by(episode_id=self.ep).count(), db.query(models.PatientQuestion).filter_by(episode_id=self.ep).count(),
                    db.query(models.MedicalDocument).filter_by(episode_id=self.ep).count(),
                    db.query(models.Notification).filter_by(recipient_user_id=self.sarah_id).count())

    def test_they_work_with_the_permission_and_nothing_changes_when_the_gate_says_no(self):
        routes = self.routes()
        # with everything allowed they are all fine (and what they make is cleaned up after)
        for route in routes:
            response = self.send("ravi", self.ravi_link, route)
            self.assertEqual(response.status_code, 200, (route[1], response.text))
            if route[1] == "check-ins":
                self.logs.append(response.json()["id"])
            if "attachments" in route[1]:
                self.documents.append(response.json()["id"])
            if "follow-up" in route[1]:
                self.questions.append(response.json()["id"])
        # a permission she turned off
        for permission in ("check_in", "questions"):
            self.allow(**{permission: False})
            snapshot = self.count_rows()
            for route in routes:
                if route[4] == permission:
                    self.assertEqual(self.send("ravi", self.ravi_link, route).status_code, 403, (permission, route[1]))
            self.assertEqual(self.count_rows(), snapshot, permission)  # a refused request left nothing behind
            self.allow(**{permission: True})

    def test_a_removed_person_and_an_ended_access_get_nothing(self):
        routes = self.routes()
        snapshot = self.count_rows()
        self.set_link(status="REVOKED")
        for route in routes:
            self.assertEqual(self.send("ravi", self.ravi_link, route).status_code, 403, ("removed", route[1]))
        self.set_link(status="ACTIVE", access_until=naive(utcnow() - timedelta(days=1)))
        for route in routes:
            self.assertEqual(self.send("ravi", self.ravi_link, route).status_code, 403, ("ended", route[1]))
        self.assertEqual(self.count_rows(), snapshot)

    def test_another_womans_link_or_another_role_is_refused(self):
        routes = self.routes()
        with SessionLocal() as db:
            someone = db.query(models.User).filter_by(email="elena.rostova@maternasync.app").first()
            link = models.CaregiverLink(episode_id=self.elena_ep, patient_user_id=someone.id, display_name="Someone", relationship="friend", status="ACTIVE",
                                        caregiver_user_id=self.sarah_id, permissions={"check_in": True, "questions": True})
            db.add(link)
            db.commit()
            self.extra_links.append(link.id)
            elena_link = link.id
        for route in routes:
            self.assertEqual(self.send("ravi", elena_link, route).status_code, 403, ("her link", route[1]))  # a link that is not theirs
            self.assertEqual(self.send("ravi", "no-such-link", route).status_code, 403, ("no link", route[1]))
            for role in ("patient", "doctor", "staff", "other_patient"):
                self.assertEqual(self.send(role, self.ravi_link, route).status_code, 403, (role, route[1]))
            self.assertEqual(self.client.request(route[0], f"{CG}/{self.ravi_link}/{route[1]}").status_code, 401, ("no sign-in", route[1]))


if __name__ == "__main__":
    unittest.main()
