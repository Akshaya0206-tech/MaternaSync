"""The trusted person's Appointments and Reminders pages: a request she made to move or cancel a visit (shown without her reason), and "Remind her"
(one short note, no names, three a day, only for her own unanswered reminders). Same isolated synthetic database as the other tests; every test
removes what it made so the other modules see the database as they expect."""
import json
import unittest
from datetime import timedelta

import testenv  # noqa: F401: sets the isolated database and settings before the app is imported

from backend.app import caregiver_nudge, models, server_text
from backend.app.database import SessionLocal

from test_care_partners import CG, FULL, MINE, ROOT, PartnerBase, naive, utcnow

PATIENT_VISITS = "/api/v2/patient/appointments"
REASON = "My private reason: my mother in law is unwell"


class VisitsBase(PartnerBase):
    def setUp(self):
        super().setUp()
        self.tasks = []
        self.addCleanup(self.clean_up_visits)

    def clean_up_visits(self):
        with SessionLocal() as db:
            db.query(models.AuditLog).filter(models.AuditLog.action == "caregiver_nudge_reminder", models.AuditLog.episode_id == self.ep).delete(synchronize_session=False)
            db.query(models.Notification).filter_by(recipient_user_id=self.sarah_id, message_key="caregiver_nudged_reminder").delete(synchronize_session=False)
            for task_id in self.tasks:
                task = db.get(models.Task, task_id)
                if task is not None:
                    db.delete(task)
            for visit in db.query(models.Appointment).filter(models.Appointment.episode_id == self.ep, models.Appointment.status == "requested").all():
                if visit.id not in self.visits:
                    db.delete(visit)  # the request she made for a new time
            db.commit()

    def ask_to_change(self, visit, body):
        asked = self.call("POST", f"{PATIENT_VISITS}/{visit}/change-request", "patient", body)
        with SessionLocal() as db:
            for task in db.query(models.Task).filter(models.Task.episode_id == self.ep, models.Task.title.like("Visit change requested%")).all():
                self.tasks.append(task.id)
        return asked

    def shown(self, visit):
        return next(a for a in self.call("GET", f"{CG}/{self.ravi_link}/appointments", "ravi") if a["id"] == visit)

    def nudge(self, reminder, expected=200, link=None, who="ravi"):
        return self.call("POST", f"{CG}/{link or self.ravi_link}/reminders/{reminder}/nudge", who, expected=expected)

    def her_notes(self):
        with SessionLocal() as db:
            return [n for n in db.query(models.Notification).filter_by(recipient_user_id=self.sarah_id, message_key="caregiver_nudged_reminder").all()]

    def log_in_as(self, email, password="Whatever123!"):
        response = self.client.post("/api/auth/login", json={"email": email, "password": password})
        self.assertEqual(response.status_code, 200, response.text)
        return {"Authorization": "Bearer " + response.json()["accessToken"]}


# =============================================================================== Appointments: she asked to move or cancel
class ChangeRequestShownTests(VisitsBase):
    def test_a_cancel_request_is_shown_as_its_kind_and_time_only_never_her_reason(self):
        visit = self.upcoming_visit()
        self.assertIsNone(self.shown(visit)["changeRequest"])
        self.ask_to_change(visit, {"kind": "cancel", "note": REASON})
        seen = self.shown(visit)
        self.assertEqual(set(seen["changeRequest"]), {"kind", "requestedAt"})
        self.assertEqual(seen["changeRequest"]["kind"], "cancel")
        self.assertTrue(seen["changeRequest"]["requestedAt"])
        text = json.dumps(self.call("GET", f"{CG}/{self.ravi_link}/appointments", "ravi"))
        for private in ("private reason", "mother in law", "preferred"):
            self.assertNotIn(private, text)

    def test_a_move_request_is_shown_without_the_time_she_asked_for_or_her_note(self):
        visit = self.upcoming_visit()
        wanted = (utcnow() + timedelta(days=9)).isoformat()
        self.ask_to_change(visit, {"kind": "reschedule", "preferredAt": wanted, "note": REASON})
        with SessionLocal() as db:
            for extra in db.query(models.Appointment).filter(models.Appointment.episode_id == self.ep, models.Appointment.status == "requested").all():
                if extra.id != visit:
                    self.visits.append(extra.id)
        seen = self.shown(visit)["changeRequest"]
        self.assertEqual((seen["kind"], set(seen)), ("reschedule", {"kind", "requestedAt"}))
        self.assertNotIn("mother in law", json.dumps(self.call("GET", f"{CG}/{self.ravi_link}/appointments", "ravi")))

    def test_the_request_goes_away_when_she_withdraws_it(self):
        visit = self.upcoming_visit()
        self.ask_to_change(visit, {"kind": "cancel", "note": ""})
        self.assertIsNotNone(self.shown(visit)["changeRequest"])
        self.call("DELETE", f"{PATIENT_VISITS}/{visit}/change-request", "patient")
        self.assertIsNone(self.shown(visit)["changeRequest"])

    def test_the_request_goes_away_when_the_clinic_cancels_the_visit(self):
        visit = self.upcoming_visit()
        self.ask_to_change(visit, {"kind": "cancel", "note": ""})
        self.call("PATCH", f"{ROOT}/appointments/{visit}", "doctor", {"status": "cancelled"})
        seen = self.shown(visit)
        self.assertEqual(seen["status"], "cancelled")
        self.assertIsNone(seen["changeRequest"])

    def test_without_the_appointments_permission_nothing_about_visits_is_shown(self):
        visit = self.upcoming_visit()
        self.ask_to_change(visit, {"kind": "cancel", "note": REASON})
        self.set_ravi({**FULL, "appointments": False})
        self.call("GET", f"{CG}/{self.ravi_link}/appointments", "ravi", expected=403)
        self.set_ravi(FULL)
        self.assertEqual(self.shown(visit)["changeRequest"]["kind"], "cancel")


# =============================================================================== Reminders: "Remind her"
class RemindHerTests(VisitsBase):
    def test_one_short_note_reaches_her_with_no_name_of_the_reminder_and_it_is_audited(self):
        medicine = self.due_reminder("medicine", "Folic acid tablets", "Take one with water", hours_ago=-5)
        answer = self.nudge(medicine)
        self.assertEqual((answer["left"], answer["limit"]), (caregiver_nudge.DAILY_LIMIT - 1, caregiver_nudge.DAILY_LIMIT))
        notes = self.her_notes()
        self.assertEqual(len(notes), 1)
        with SessionLocal() as db:
            title, body = server_text.texts(db, self.sarah_id, db.get(models.Notification, notes[0].id))
            audit = db.query(models.AuditLog).filter_by(action="caregiver_nudge_reminder", episode_id=self.ep).all()
        self.assertEqual(title, "Ravi (husband) sent you a reminder")
        shown_to_her = json.dumps([n for n in self.call("GET", "/api/v2/patient/updates", "patient") if n["title"] == title])
        for private in ("Folic", "tablets", "Take one", "medicine"):
            self.assertNotIn(private, shown_to_her + title + body)
        self.assertEqual([n["link"] for n in self.call("GET", "/api/v2/patient/updates", "patient") if n["title"] == title], ["/patient/care-plan"])
        self.assertEqual(len(audit), 1)
        self.assertNotIn("Folic", audit[0].details + audit[0].title)
        self.assertEqual((audit[0].actor_role, audit[0].object_id), ("caregiver", self.ravi_link))
        listed = self.call("GET", f"{CG}/{self.ravi_link}/reminders", "ravi")
        self.assertEqual((listed["nudgesLeft"], listed["nudgeLimit"]), (caregiver_nudge.DAILY_LIMIT - 1, caregiver_nudge.DAILY_LIMIT))

    def test_the_note_is_worded_in_her_language(self):
        reminder = self.due_reminder("appointment", "Visit tomorrow", hours_ago=-5)
        self.nudge(reminder)
        self.call("PATCH", f"{ROOT}/preferences", "patient", {"language": "hi"})
        titles = [n["title"] for n in self.call("GET", "/api/v2/patient/updates", "patient")]
        self.assertIn("Ravi (husband) ने आपको एक रिमाइंडर भेजा", titles)

    def test_a_few_a_day_then_a_clear_refusal_and_nothing_more_reaches_her(self):
        reminder = self.due_reminder("appointment", "Visit tomorrow", hours_ago=-5)
        lefts = [self.nudge(reminder)["left"] for _ in range(caregiver_nudge.DAILY_LIMIT)]
        self.assertEqual(lefts, list(range(caregiver_nudge.DAILY_LIMIT - 1, -1, -1)))
        refused = self.call("POST", f"{CG}/{self.ravi_link}/reminders/{reminder}/nudge", "ravi", expected=429)
        self.assertIn("reminded her", refused["detail"])
        self.assertEqual(len(self.her_notes()), caregiver_nudge.DAILY_LIMIT)
        self.assertEqual(self.call("GET", f"{CG}/{self.ravi_link}/reminders", "ravi")["nudgesLeft"], 0)

    def test_the_limit_is_for_each_trusted_person_and_older_ones_do_not_count(self):
        reminder = self.due_reminder("appointment", "Visit tomorrow", hours_ago=-5)
        meena_link, _ = self.second_helper({"appointments": True, "reminders": True})
        meena = self.log_in_as("meena.kumar.partner@example.org")
        self.headers["meena"] = meena
        for _ in range(caregiver_nudge.DAILY_LIMIT):
            self.nudge(reminder)
        self.call("POST", f"{CG}/{meena_link}/reminders/{reminder}/nudge", "meena")  # Ravi using his three does not use hers
        with SessionLocal() as db:  # three sent more than a day ago no longer count
            for row in db.query(models.AuditLog).filter_by(action="caregiver_nudge_reminder", object_id=self.ravi_link).all():
                row.timestamp = naive(utcnow() - timedelta(hours=25))
            db.commit()
        self.assertEqual(self.nudge(reminder)["left"], caregiver_nudge.DAILY_LIMIT - 1)

    def test_only_her_own_unanswered_reminders_that_are_due_soon_can_be_nudged(self):
        answered = self.due_reminder("appointment", "Visit", status="taken")
        far_off = self.due_reminder("appointment", "Visit", hours_ago=-24 * 40)
        long_ago = self.due_reminder("appointment", "Visit", hours_ago=24 * 5)
        self.nudge(answered, expected=409)
        self.nudge(far_off, expected=409)
        self.nudge(long_ago, expected=409)
        self.nudge("not-a-reminder", expected=404)
        with SessionLocal() as db:
            other = models.CareReminder(episode_id=self.elena_ep, kind="appointment", title="Elena's visit", instructions="", scheduled_at=naive(utcnow() + timedelta(hours=5)),
                                        source_id="x", created_by_user_id=self.doctor_id, approved_by_user_id=self.doctor_id, status="pending")
            db.add(other)
            db.commit()
            other_id = other.id
        try:
            self.nudge(other_id, expected=404)  # another woman's reminder, even with a valid link of his own
        finally:
            with SessionLocal() as db:
                db.delete(db.get(models.CareReminder, other_id))
                db.commit()
        self.assertEqual(self.her_notes(), [])
        with SessionLocal() as db:
            self.assertEqual(db.query(models.AuditLog).filter_by(action="caregiver_nudge_reminder", episode_id=self.ep).count(), 0)

    def test_it_needs_the_reminders_permission_and_a_current_link_that_is_his_own(self):
        reminder = self.due_reminder("appointment", "Visit tomorrow", hours_ago=-5)
        self.set_ravi({**FULL, "reminders": False})
        self.nudge(reminder, expected=403)
        self.set_ravi(FULL)
        meena_link, _ = self.second_helper({"appointments": True, "reminders": True})
        self.nudge(reminder, expected=403, link=meena_link)  # somebody else's link
        with SessionLocal() as db:
            link = db.get(models.CaregiverLink, self.ravi_link)
            link.access_until = naive(utcnow() - timedelta(days=1))  # her end date has passed
            db.commit()
        self.nudge(reminder, expected=403)
        self.set_ravi(FULL)
        with SessionLocal() as db:
            link = db.get(models.CaregiverLink, self.ravi_link)
            link.status = "REVOKED"  # she removed him
            db.commit()
        self.nudge(reminder, expected=403)
        self.assertEqual(self.her_notes(), [])

    def test_other_roles_cannot_use_it(self):
        reminder = self.due_reminder("appointment", "Visit tomorrow", hours_ago=-5)
        for who in ("patient", "doctor"):
            self.call("POST", f"{CG}/{self.ravi_link}/reminders/{reminder}/nudge", who, expected=403)

    def test_the_names_a_calendar_would_use_stay_hidden_unless_she_also_allows_her_summaries(self):
        self.set_ravi({**FULL, "care_plan": False})
        medicine = self.due_reminder("medicine", "Iron tablets", "Take one with water", hours_ago=-6)
        vaccine = self.due_reminder("vaccine", "Tetanus dose", "Left arm", hours_ago=-8)
        visit = self.due_reminder("appointment", "Bring the MCP card", "Keep it with your reports", hours_ago=-10)
        listed = self.call("GET", f"{CG}/{self.ravi_link}/reminders", "ravi")
        by_id = {i["id"]: i for i in listed["items"]}
        for reminder in (medicine, vaccine):
            self.assertEqual((by_id[reminder]["title"], by_id[reminder]["instructions"], by_id[reminder]["detailsHidden"]), (None, None, True))
        self.assertEqual((by_id[visit]["title"], by_id[visit]["instructions"]), ("Bring the MCP card", None))  # her doctor's instructions need the summaries permission
        text = json.dumps(listed)
        for hidden in ("Iron tablets", "Tetanus", "Take one with water", "Left arm", "Keep it with your reports"):
            self.assertNotIn(hidden, text)
        self.set_ravi(FULL)
        shown = {i["id"]: i for i in self.call("GET", f"{CG}/{self.ravi_link}/reminders", "ravi")["items"]}
        self.assertEqual((shown[medicine]["title"], shown[medicine]["instructions"]), ("Iron tablets", "Take one with water"))


if __name__ == "__main__":
    unittest.main()
