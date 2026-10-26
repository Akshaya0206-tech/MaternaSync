"""The patient's home page data: a next appointment that has not already passed, a pending visit request, the "Today" counts, and a check-in that
is never saved twice when it is sent again after a dropped connection. Same isolated synthetic database as the other tests; each test puts back
what it changed."""
import unittest
import uuid
from datetime import datetime, timedelta, timezone

import testenv  # noqa: F401: sets the isolated database and settings before the app is imported

from backend.app import models
from backend.app.continuity_service import now as service_now
from backend.app.database import SessionLocal

from test_assistant_caregiver import Base

HOME = "/api/v2/patient/dashboard"
LOGS = "/api/v2/continuity/episodes/{}/logs"
IST = -330  # JavaScript's getTimezoneOffset() for India


def iso(moment):
    return moment.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def day_start(offset):
    """The start of her local day in UTC, worked out the way the page asks for it."""
    local = service_now() - timedelta(minutes=offset)
    return local.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(minutes=offset)


class PatientHomeTests(Base):
    def setUp(self):
        self.made = {"appointments": [], "logs": [], "reminders": [], "questions": []}
        with SessionLocal() as db:
            # Move her existing appointments, today's check-ins and open reminders out of the way, and put them back afterwards.
            self.moved_appointments = {a.id: a.status for a in db.query(models.Appointment).filter_by(episode_id=self.ep).all()}
            for appointment in db.query(models.Appointment).filter_by(episode_id=self.ep).all():
                appointment.status = "completed"
            self.moved_logs = {l.id: l.recorded_at for l in db.query(models.DailyLog).filter(models.DailyLog.episode_id == self.ep, models.DailyLog.recorded_at >= service_now().replace(tzinfo=None) - timedelta(days=3)).all()}
            for log in db.query(models.DailyLog).filter(models.DailyLog.id.in_(list(self.moved_logs))).all():
                log.recorded_at = log.recorded_at - timedelta(days=30)
            self.moved_reminders = {r.id: r.status for r in db.query(models.CareReminder).filter_by(episode_id=self.ep).all()}
            for reminder in db.query(models.CareReminder).filter_by(episode_id=self.ep).all():
                reminder.status = "done"
            db.commit()

    def tearDown(self):
        with SessionLocal() as db:
            for kind, model in (("appointments", models.Appointment), ("logs", models.DailyLog), ("reminders", models.CareReminder), ("questions", models.PatientQuestion)):
                for item_id in self.made[kind]:
                    item = db.get(model, item_id)
                    if item is not None:
                        if kind == "questions":
                            for response in list(item.responses):
                                db.delete(response)
                        db.delete(item)
            for item_id, status in self.moved_appointments.items():
                db.get(models.Appointment, item_id).status = status
            for item_id, recorded_at in self.moved_logs.items():
                db.get(models.DailyLog, item_id).recorded_at = recorded_at
            for item_id, status in self.moved_reminders.items():
                db.get(models.CareReminder, item_id).status = status
            db.commit()

    def home(self, offset=None):
        return self.client.get(HOME, headers=self.headers["patient"], params={} if offset is None else {"tz_offset": offset}).json()

    def add_appointment(self, when, status):
        with SessionLocal() as db:
            appointment = models.Appointment(episode_id=self.ep, scheduled_at=when.replace(tzinfo=None), appointment_type="Check-up", status=status, location="Test clinic")
            db.add(appointment)
            db.commit()
            self.made["appointments"].append(appointment.id)
            return appointment.id

    def add_log(self, recorded_at, skipped=False):
        result = self.call("POST", LOGS.format(self.ep), "patient", {"recordedAt": iso(recorded_at), "skipped": skipped, "symptoms": "", "mood": "not_recorded", "adherence": "not_recorded"})
        self.made["logs"].append(result["id"])
        return result

    # ---------------------------------------------------------------- the next appointment
    def test_a_booked_time_that_has_passed_is_not_the_next_appointment(self):
        now = service_now()
        self.add_appointment(now - timedelta(days=9), "scheduled")
        self.assertIsNone(self.home()["nextAppointment"])  # only a past booking: nothing is coming up
        soon = self.add_appointment(now + timedelta(days=3), "scheduled")
        later = self.add_appointment(now + timedelta(days=10), "scheduled")
        self.assertEqual(self.home()["nextAppointment"]["id"], soon)
        self.assertNotEqual(self.home()["nextAppointment"]["id"], later)

    def test_a_visit_she_asked_for_is_reported_separately_until_it_is_confirmed(self):
        now = service_now()
        asked = self.add_appointment(now + timedelta(days=2), "requested")
        page = self.home()
        self.assertIsNone(page["nextAppointment"])
        self.assertEqual(page["visitRequest"]["id"], asked)
        self.assertEqual(page["visitRequest"]["status"], "requested")
        with SessionLocal() as db:
            db.get(models.Appointment, asked).status = "scheduled"
            db.commit()
        page = self.home()
        self.assertEqual(page["nextAppointment"]["id"], asked)
        self.assertIsNone(page["visitRequest"])

    def test_a_request_whose_time_has_passed_is_not_shown(self):
        self.add_appointment(service_now() - timedelta(days=1), "requested")
        self.assertIsNone(self.home()["visitRequest"])

    # ---------------------------------------------------------------- the Today card
    def test_the_day_starts_where_her_clock_says(self):
        start = day_start(IST)
        self.add_log(start - timedelta(seconds=1))
        self.assertEqual(self.home(IST)["checkInToday"], "none")  # the last second of her yesterday
        self.add_log(start)
        self.assertEqual(self.home(IST)["checkInToday"], "recorded")

    def test_a_skipped_check_in_is_reported_as_skipped_and_a_real_one_wins(self):
        recent = service_now() - timedelta(seconds=2)
        self.assertEqual(self.home(0)["checkInToday"], "none")
        self.add_log(recent, skipped=True)
        self.assertEqual(self.home(0)["checkInToday"], "skipped")
        self.add_log(recent - timedelta(seconds=1))
        self.assertEqual(self.home(0)["checkInToday"], "recorded")

    def test_reminders_waiting_are_counted_up_to_the_end_of_her_day_with_up_to_three_names(self):
        end = day_start(IST) + timedelta(days=1)
        with SessionLocal() as db:
            for title, when in (("Iron tablet", end - timedelta(hours=20)), ("Folic acid", end - timedelta(minutes=1)), ("Calcium", end - timedelta(days=3)),
                                ("Td vaccine", end - timedelta(hours=2)), ("Tomorrow", end + timedelta(minutes=1))):
                reminder = models.CareReminder(episode_id=self.ep, kind="medicine", title=title, instructions="", scheduled_at=when.replace(tzinfo=None),
                                               created_by_user_id=self.doctor_id, approved_by_user_id=self.doctor_id)
                db.add(reminder)
                db.flush()
                self.made["reminders"].append(reminder.id)
            db.commit()
        page = self.home(IST)
        self.assertEqual(page["remindersDueCount"], 4)  # an earlier one still waiting counts; tomorrow's does not
        self.assertEqual(page["remindersDue"], ["Calcium", "Iron tablet", "Td vaccine"])  # oldest first, three at most

    def test_a_question_counts_as_answered_only_when_a_visible_reply_is_recent(self):
        now = service_now()
        before = self.home()["answeredRecentlyCount"]  # the demo data may already hold a recent reply
        with SessionLocal() as db:
            for text, age, visible, status in (("Recent and shown", 1, True, "APPROVED"), ("Old reply", 10, True, "APPROVED"),
                                               ("Draft reply", 1, False, "DRAFT"), ("Approved but hidden", 1, False, "APPROVED")):
                question = models.PatientQuestion(episode_id=self.ep, asked_by_user_id=self.sarah_id, question_text=text, status="ANSWERED")
                db.add(question)
                db.flush()
                self.made["questions"].append(question.id)
                db.add(models.QuestionResponse(question_id=question.id, responder_user_id=self.doctor_id, responder_role="doctor", response_text="Reply", status=status,
                                               visible_to_patient=visible, created_at=(now - timedelta(days=age)).replace(tzinfo=None)))
            db.commit()
        self.assertEqual(self.home()["answeredRecentlyCount"], before + 1)

    def test_the_page_still_works_without_a_time_zone_and_refuses_a_nonsense_one(self):
        self.assertEqual(self.home()["checkInToday"], "none")
        refused = self.client.get(HOME, headers=self.headers["patient"], params={"tz_offset": 5000})
        self.assertEqual(refused.status_code, 422)

    # ---------------------------------------------------------------- a check-in sent twice
    def payload(self, **extra):
        return {"recordedAt": iso(service_now() - timedelta(seconds=5)), "systolic": 118, "diastolic": 76, "weightKg": 64.2, "symptoms": "Tiredness",
                "mood": "okay", "adherence": "done", "skipped": False, **extra}

    def test_the_same_check_in_sent_twice_is_saved_once(self):
        ref = uuid.uuid4().hex
        first = self.call("POST", LOGS.format(self.ep), "patient", self.payload(clientRef=ref))
        self.made["logs"].append(first["id"])
        second = self.call("POST", LOGS.format(self.ep), "patient", self.payload(clientRef=ref))
        self.assertEqual(first["id"], second["id"])
        with SessionLocal() as db:
            self.assertEqual(db.query(models.DailyLog).filter_by(episode_id=self.ep, client_ref=ref).count(), 1)
        other = self.call("POST", LOGS.format(self.ep), "patient", self.payload(clientRef=uuid.uuid4().hex))
        self.made["logs"].append(other["id"])
        self.assertNotEqual(first["id"], other["id"])

    def test_check_ins_without_a_reference_are_never_merged(self):
        one = self.call("POST", LOGS.format(self.ep), "patient", self.payload())
        two = self.call("POST", LOGS.format(self.ep), "patient", self.payload())
        self.made["logs"] += [one["id"], two["id"]]
        self.assertNotEqual(one["id"], two["id"])

    def test_a_reference_cannot_reach_another_patients_entry(self):
        ref = uuid.uuid4().hex
        mine = self.call("POST", LOGS.format(self.ep), "patient", self.payload(clientRef=ref))
        self.made["logs"].append(mine["id"])
        theirs = self.call("POST", LOGS.format(self.elena_ep), "other_patient", self.payload(clientRef=ref))
        self.assertNotEqual(mine["id"], theirs["id"])
        with SessionLocal() as db:
            db.delete(db.get(models.DailyLog, theirs["id"]))
            db.commit()

    def test_a_malformed_reference_is_refused_and_a_correction_keeps_the_reference(self):
        self.call("POST", LOGS.format(self.ep), "patient", self.payload(clientRef="has spaces!"), expected=422)
        ref = uuid.uuid4().hex
        entry = self.call("POST", LOGS.format(self.ep), "patient", self.payload(clientRef=ref))
        self.made["logs"].append(entry["id"])
        corrected = self.call("PATCH", f"/api/v2/continuity/logs/{entry['id']}", "patient", self.payload(clientRef="a-different-one", systolic=120, correctionReason="Typed it wrong"))
        self.assertEqual(corrected["systolic"], 120)
        with SessionLocal() as db:
            self.assertEqual(db.get(models.DailyLog, entry["id"]).client_ref, ref)  # a correction never rewrites who it came from


if __name__ == "__main__":
    unittest.main()
