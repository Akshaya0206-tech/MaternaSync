"""Words the assistant writes for a person are worded for THAT person, in the language they have when they read it.

Two faults were found when someone reported Tamil on a screen after switching to English: a missed-check-in reminder to a trusted person (and the
reply or urgent note for a question a trusted person asked) was worded in the PATIENT's language, and a few notes were saved as plain text in
the language of the moment, so they stayed in it for ever. Same isolated synthetic database as the other tests; each test puts back what it made."""
import re
import unittest
from datetime import datetime, timedelta, timezone

import testenv  # noqa: F401: sets the isolated database and settings before the app is imported

from backend.app import models, server_text
from backend.app.ai_coordinator import messages, orchestrator
from backend.app.database import SessionLocal

from test_assistant_caregiver import Base

TAMIL = re.compile(r"[஀-௿]")
CG = "/api/v2/caregiver"


def now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class NoteLanguageTests(Base):
    def setUp(self):
        self.restore_ravi()
        self.questions = []
        self.kept_logs = None
        self.addCleanup(self.clean_up)

    def clean_up(self):
        with SessionLocal() as db:
            for qid in self.questions:
                for model, column in ((models.Notification, "related_entity_id"), (models.ExceptionItem, "source_id")):
                    for row in db.query(model).filter(getattr(model, column) == qid).all():
                        db.delete(row)
                for run in db.query(models.AIRun).filter_by(source_id=qid).all():
                    for action in db.query(models.AIAction).filter_by(run_id=run.id).all():
                        db.delete(action)
                    db.delete(run)
                question = db.get(models.PatientQuestion, qid)
                if question is not None:
                    db.delete(question)
            db.query(models.AIRun).filter(models.AIRun.workflow == "missed_checkin", models.AIRun.episode_id == self.ep).delete()
            db.query(models.AIAction).filter(models.AIAction.idempotency_key.like(f"checkin:{self.ep}:%")).delete(synchronize_session=False)
            for note in db.query(models.Notification).filter_by(type="assistant_reminder", episode_id=self.ep).all():
                db.delete(note)
            plan = db.get(models.MonitoringPlan, self.ep)
            if plan is not None:
                plan.active = False
            if self.kept_logs is not None:  # the check-ins that were there before this test, put back
                db.query(models.DailyLog).filter_by(episode_id=self.ep).delete()
                for values in self.kept_logs:
                    db.add(models.DailyLog(**values))
            db.commit()
        self.set_language("patient", "en")
        self.set_language("ravi", "en")

    def set_language(self, who, language):
        path = f"{CG}/preferences" if who == "ravi" else "/api/v2/continuity/preferences"
        self.call("PATCH", path, who, {"language": language})

    def lapse_the_check_ins(self):
        with SessionLocal() as db:
            self.kept_logs = [{column.name: getattr(row, column.name) for column in models.DailyLog.__table__.columns}
                              for row in db.query(models.DailyLog).filter_by(episode_id=self.ep).all()]
            db.query(models.DailyLog).filter_by(episode_id=self.ep).delete()
            plan = db.get(models.MonitoringPlan, self.ep)
            if plan is None:
                plan = models.MonitoringPlan(episode_id=self.ep, interval_days=1, active=True, owner_user_id=self.doctor_id)
                db.add(plan)
            plan.active, plan.interval_days, plan.agreed_at = True, 1, now() - timedelta(days=5)
            db.query(models.AIRun).filter(models.AIRun.workflow == "missed_checkin", models.AIRun.episode_id == self.ep).delete()
            db.query(models.AIAction).filter(models.AIAction.idempotency_key.like(f"checkin:{self.ep}:%")).delete(synchronize_session=False)
            db.commit()

    def reminders(self, who):
        listed = self.call("GET", f"{CG}/notifications" if who == "ravi" else "/api/v2/patient/updates", who)
        return [n for n in listed if n["type"] == "assistant_reminder"]

    # ---------------------------------------------------------------- the missed check-in reminder
    def test_a_missed_check_in_reminder_is_worded_for_each_reader_and_follows_a_change_of_language(self):
        self.set_language("patient", "ta")
        self.set_language("ravi", "en")
        self.lapse_the_check_ins()
        orchestrator.run_sweeps()
        his, hers = self.reminders("ravi"), self.reminders("patient")
        self.assertTrue(his and hers)
        self.assertFalse(TAMIL.search(his[0]["title"] + his[0]["body"]), "he reads English, so the note must not be in her language")
        self.assertEqual(his[0]["title"], messages.CHECKIN_TITLE["en"])
        self.assertEqual(hers[0]["title"], messages.CHECKIN_TITLE["ta"])
        self.set_language("patient", "en")  # she switches back: the same note now reads in English
        again = self.reminders("patient")
        self.assertEqual(again[0]["title"], messages.CHECKIN_TITLE["en"])
        self.assertEqual(again[0]["body"], messages.CHECKIN_PATIENT["en"])
        self.set_language("ravi", "hi")  # and his follows his own language too
        self.assertEqual(self.reminders("ravi")[0]["title"], messages.CHECKIN_TITLE["hi"])

    # ---------------------------------------------------------------- a question a trusted person asked
    def ask_as_ravi(self, text):
        qid = self.call("POST", f"{CG}/{self.ravi_link}/questions", "ravi", {"questionText": text})["id"]
        self.questions.append(qid)
        return qid

    def process_until_done(self, qid):
        # The queue handles 25 jobs a call, oldest first, and other tests leave jobs behind: keep going until this question's own job has run.
        for _ in range(60):
            orchestrator.process_queue()
            with SessionLocal() as db:
                run = db.query(models.AIRun).filter_by(source_id=qid).first()
                if run is not None and run.status != "QUEUED":
                    return
        self.fail("the assistant never reached this question's job")

    def test_the_urgent_note_goes_to_whoever_asked_in_their_language_and_follows_a_change(self):
        self.set_language("patient", "ta")
        self.set_language("ravi", "en")
        qid = self.ask_as_ravi("She has heavy bleeding and severe pain")
        self.process_until_done(qid)
        with SessionLocal() as db:
            ravi_id = db.get(models.CaregiverLink, self.ravi_link).caregiver_user_id
            sent = db.query(models.Notification).filter_by(type="assistant_urgent", related_entity_id=qid).all()
        self.assertEqual([n.recipient_user_id for n in sent], [ravi_id])  # he asked, so it goes to him
        mine = [n for n in self.call("GET", f"{CG}/notifications", "ravi") if n["type"] == "assistant_urgent"]
        self.assertEqual(mine[0]["body"], messages.urgent_body("en"))  # in HIS language, not hers
        self.assertFalse(TAMIL.search(mine[0]["title"] + mine[0]["body"]))
        self.set_language("ravi", "ta")
        again = [n for n in self.call("GET", f"{CG}/notifications", "ravi") if n["type"] == "assistant_urgent"]
        self.assertEqual(again[0]["body"], messages.urgent_body("ta"))  # one note, read in whatever language he has now

    def test_the_suggested_reply_to_a_trusted_persons_question_is_in_their_language(self):
        self.set_language("patient", "ta")
        self.set_language("ravi", "en")
        qid = self.ask_as_ravi("When is the next appointment?")
        self.process_until_done(qid)
        with SessionLocal() as db:
            items = db.query(models.ExceptionItem).filter_by(source_id=qid, kind="proposal").all()
        suggested = [i.summary for i in items if "Suggested reply" in (i.summary or "")]
        if not suggested:
            self.skipTest("the assistant did not propose a reply to this question here")
        self.assertFalse(TAMIL.search(suggested[0]), suggested[0])

    # ---------------------------------------------------------------- notes saved before they had keys
    def test_an_older_fixed_note_saved_in_one_language_is_read_in_the_readers_language(self):
        with SessionLocal() as db:
            old = models.Notification(recipient_user_id=self.sarah_id, episode_id=self.ep, type="assistant_reminder",
                                      title=messages.CHECKIN_TITLE["ta"], body=messages.CHECKIN_PATIENT["ta"])
            self.assertEqual(server_text.texts(db, self.sarah_id, old), (messages.CHECKIN_TITLE["en"], messages.CHECKIN_PATIENT["en"]))  # she reads English
            urgent = models.Notification(recipient_user_id=self.sarah_id, episode_id=self.ep, type="assistant_urgent",
                                         title=messages.URGENT_TITLE["hi"], body=messages.urgent_body("hi"))
            self.assertEqual(server_text.texts(db, self.sarah_id, urgent), (messages.URGENT_TITLE["en"], messages.urgent_body("en")))
            written_by_a_person = models.Notification(recipient_user_id=self.sarah_id, type="x", title="Hello from the clinic", body="See you soon")
            self.assertEqual(server_text.texts(db, self.sarah_id, written_by_a_person), ("Hello from the clinic", "See you soon"))  # anything else stays as stored


if __name__ == "__main__":
    unittest.main()
