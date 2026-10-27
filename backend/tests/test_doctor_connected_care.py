"""Connected Care for the doctor: work owned by a care-team account whose login is off, the record of an export, and the doctor's three answers to a
patient's request to cancel or move a visit. Same isolated synthetic database as the other tests; each test puts back what it changed."""
import unittest
from datetime import datetime, time, timedelta, timezone
from unittest.mock import patch

import testenv  # noqa: F401: sets the isolated database and settings before the app is imported

from backend.app import config, models
from backend.app.ai_coordinator import scheduling
from backend.app.database import SessionLocal
from backend.app.owner_housekeeping import REASON, reassign_inactive_owners

from test_assistant_caregiver import Base

ROOT = "/api/v2/continuity"
APPOINTMENTS = "/api/v2/patient/appointments"
ACTIONS = ("task_owner_reassigned_login_off", "monitoring_owner_reassigned_login_off")


def iso(moment):
    return moment.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def clinic_slot(weekday: int, hour: int = 10, at_least_days: int = 8) -> datetime:
    """A time on the clinic's own clock (India, +330 minutes) on the next given weekday (0 = Monday) at least a week away, in UTC."""
    day = (datetime.now(timezone.utc) + timedelta(days=at_least_days)).date()
    while day.weekday() != weekday:
        day += timedelta(days=1)
    return (datetime.combine(day, time.min) + timedelta(minutes=hour * 60 - 330)).replace(tzinfo=timezone.utc)


class ConnectedCare(Base):
    def setUp(self):
        with SessionLocal() as db:
            self.brenda = db.query(models.User).filter_by(email="brenda.miller@maternasync.app").first().id
            self.owners_before = {t.id: (t.owner_user_id, t.status) for t in db.query(models.Task).all()}
            self.plans_before = {p.episode_id: p.owner_user_id for p in db.query(models.MonitoringPlan).all()}
        self.made = {"tasks": [], "appointments": [], "plans": []}

    def tearDown(self):
        with SessionLocal() as db:
            for task in db.query(models.Task).all():
                if task.id in self.owners_before:
                    task.owner_user_id, task.status = self.owners_before[task.id]
            for plan in db.query(models.MonitoringPlan).all():
                if plan.episode_id in self.plans_before:
                    plan.owner_user_id = self.plans_before[plan.episode_id]
            for episode_id in self.made["plans"]:
                plan = db.get(models.MonitoringPlan, episode_id)
                if plan is not None:
                    db.delete(plan)
            db.query(models.TaskAssignment).filter(models.TaskAssignment.note == REASON).delete()
            db.query(models.AuditLog).filter(models.AuditLog.action.in_(list(ACTIONS) + ["patient_entries_exported", "visit_change_confirmed_new_time",
                                                                                       "visit_change_other_times_offered"])).delete(synchronize_session=False)
            for task_id in self.made["tasks"]:
                db.query(models.TaskAssignment).filter_by(task_id=task_id).delete()
                task = db.get(models.Task, task_id)
                if task is not None:
                    db.delete(task)
            for appointment_id in self.made["appointments"]:
                appointment = db.get(models.Appointment, appointment_id)
                if appointment is not None:
                    db.delete(appointment)
            db.commit()

    def add_task(self, owner, status="OPEN", title="Housekeeping test task"):
        with SessionLocal() as db:
            task = models.Task(episode_id=self.ep, title=title, owner_user_id=owner, created_by_user_id=self.doctor_id, due_date="2026-01-01", status=status)
            db.add(task)
            db.commit()
            self.made["tasks"].append(task.id)
            return task.id

    # ---------------------------------------------------------------- who work can be given to
    def test_a_switched_off_care_team_account_is_not_offered_as_an_owner(self):
        members = {m["id"] for e in self.call("GET", f"{ROOT}/context", "doctor")["episodes"] if e["id"] == self.ep for m in e["members"]}
        self.assertIn(self.brenda, members)  # login on (the tests' default): she can be chosen
        with patch.object(config, "CARE_TEAM_ENABLED", False):
            members = {m["id"] for e in self.call("GET", f"{ROOT}/context", "doctor")["episodes"] if e["id"] == self.ep for m in e["members"]}
        self.assertNotIn(self.brenda, members)
        self.assertIn(self.doctor_id, members)

    def test_new_work_cannot_be_given_to_her_while_her_login_is_off_but_can_to_the_doctor(self):
        task = self.add_task(self.doctor_id)
        with patch.object(config, "CARE_TEAM_ENABLED", False):
            refused = self.client.patch(f"{ROOT}/tasks/{task}/assignment", headers=self.headers["doctor"], json={"ownerUserId": self.brenda, "dueDate": None})
            self.assertEqual(refused.status_code, 409, refused.text)
            self.assertIn("login is switched off", refused.json()["detail"])
            self.call("PATCH", f"{ROOT}/tasks/{task}/assignment", "doctor", {"ownerUserId": self.doctor_id, "dueDate": None})
            plan = self.client.put(f"{ROOT}/episodes/{self.ep}/monitoring-plan", headers=self.headers["doctor"], json={"intervalDays": 2, "active": True, "ownerUserId": self.brenda})
            self.assertIn(plan.status_code, (409, 404, 405, 422), plan.text)  # never accepted
        with SessionLocal() as db:
            self.assertEqual(db.get(models.Task, task).owner_user_id, self.doctor_id)

    # ---------------------------------------------------------------- the start-up housekeeping
    def test_open_work_owned_by_her_moves_to_the_doctor_once_with_a_reason(self):
        open_one, waiting, finished = self.add_task(self.brenda), self.add_task(self.brenda, "WAITING", "Waiting task"), self.add_task(self.brenda, "COMPLETED", "Finished task")
        with SessionLocal() as db:
            staff = [u.id for u in db.query(models.User).filter_by(role="care_team").all()]  # Brenda and the other care-team account
            existing = (db.query(models.Task).filter(models.Task.owner_user_id.in_(staff), models.Task.status.in_(("OPEN", "IN_PROGRESS", "WAITING"))).count()
                        + db.query(models.MonitoringPlan).filter(models.MonitoringPlan.owner_user_id.in_(staff)).count())  # tasks, and agreed follow-ups they own
        with patch.object(config, "CARE_TEAM_ENABLED", False), SessionLocal() as db:
            moved = reassign_inactive_owners(db)
            self.assertEqual(moved, existing)
            self.assertEqual(reassign_inactive_owners(db), 0)  # nothing more to do the second time
        with SessionLocal() as db:
            self.assertEqual(db.get(models.Task, open_one).owner_user_id, self.doctor_id)
            self.assertEqual(db.get(models.Task, waiting).owner_user_id, self.doctor_id)
            self.assertEqual(db.get(models.Task, finished).owner_user_id, self.brenda)  # a finished task is history: left as it was
            history = db.query(models.TaskAssignment).filter_by(task_id=open_one).all()
            self.assertEqual([h.note for h in history], [REASON])
            audit = db.query(models.AuditLog).filter_by(action="task_owner_reassigned_login_off", object_id=open_one).one()
            self.assertEqual(audit.previous_state["owner"], "Brenda Miller")
            self.assertEqual(audit.new_state["owner"], db.get(models.User, self.doctor_id).full_name)
            self.assertEqual(db.query(models.Notification).filter(models.Notification.related_entity_id == open_one).count(), 0)  # silent housekeeping

    def test_the_task_list_shows_the_reason_in_the_reassignment_history(self):
        task = self.add_task(self.brenda)
        with patch.object(config, "CARE_TEAM_ENABLED", False), SessionLocal() as db:
            reassign_inactive_owners(db)
        listed = {t["id"]: t for t in self.call("GET", f"{ROOT}/episodes/{self.ep}/tasks", "doctor")}
        self.assertEqual(listed[task]["history"][-1]["note"], REASON)
        self.assertEqual(listed[task]["ownerName"], "Dr. Eleanor Vance" if listed[task]["ownerName"].startswith("Dr.") else listed[task]["ownerName"])

    def test_nothing_moves_while_the_care_team_login_is_on(self):
        task = self.add_task(self.brenda)
        with SessionLocal() as db:
            self.assertEqual(reassign_inactive_owners(db), 0)
            self.assertEqual(db.get(models.Task, task).owner_user_id, self.brenda)

    def test_the_owner_of_an_agreed_check_in_follow_up_moves_too(self):
        with SessionLocal() as db:
            plan = db.get(models.MonitoringPlan, self.ep)
            if plan is None:
                db.add(models.MonitoringPlan(episode_id=self.ep, interval_days=2, active=True, owner_user_id=self.brenda))
                self.made["plans"].append(self.ep)
            else:
                plan.owner_user_id = self.brenda
            db.commit()
        with patch.object(config, "CARE_TEAM_ENABLED", False), SessionLocal() as db:
            self.assertGreaterEqual(reassign_inactive_owners(db), 1)
        with SessionLocal() as db:
            self.assertEqual(db.get(models.MonitoringPlan, self.ep).owner_user_id, self.doctor_id)
            self.assertEqual(db.query(models.AuditLog).filter_by(action="monitoring_owner_reassigned_login_off").count(), 1)

    # ---------------------------------------------------------------- the record that entries were exported
    def test_an_export_is_recorded_and_only_for_a_doctor_with_access(self):
        body = {"kind": "csv", "range": "30", "count": 14}
        self.call("POST", f"{ROOT}/episodes/{self.ep}/entries-export", "doctor", body)
        with SessionLocal() as db:
            row = db.query(models.AuditLog).filter_by(action="patient_entries_exported", episode_id=self.ep).one()
            self.assertEqual(row.new_state, {"how": "csv", "range": "30", "entries": 14})
        self.call("POST", f"{ROOT}/episodes/{self.ep}/entries-export", "patient", body, expected=403)
        self.assertIn(self.client.post(f"{ROOT}/episodes/{self.ep}/entries-export", headers=self.headers["other_doctor"], json=body).status_code, (403, 404))
        self.call("POST", f"{ROOT}/episodes/{self.ep}/entries-export", "doctor", {"kind": "xml", "range": "30", "count": 1}, expected=422)

    # ---------------------------------------------------------------- answering a request to cancel or move a visit
    def confirmed_visit(self, weekday=1):
        with SessionLocal() as db:
            visit = models.Appointment(episode_id=self.ep, scheduled_at=clinic_slot(weekday).replace(tzinfo=None), appointment_type="consultation", status="scheduled", location="Test clinic")
            db.add(visit)
            db.commit()
            self.made["appointments"].append(visit.id)
            return visit.id

    def ask(self, visit_id, kind, when=None):
        body = {"kind": kind, "note": "Test"} | ({"preferredAt": iso(when)} if when else {})
        self.call("POST", f"{APPOINTMENTS}/{visit_id}/change-request", "patient", body)
        with SessionLocal() as db:
            visit = db.get(models.Appointment, visit_id)
            if visit.change_new_appointment_id:
                self.made["appointments"].append(visit.change_new_appointment_id)
            self.made["tasks"].append(visit.change_task_id)
            return visit.change_new_appointment_id, visit.change_task_id

    def keys_for_patient(self):
        with SessionLocal() as db:
            return [n.message_key for n in db.query(models.Notification).filter_by(recipient_user_id=self.sarah_id).all()]

    def test_confirming_the_new_time_confirms_it_and_cancels_the_old_visit_in_one_step(self):
        visit = self.confirmed_visit(weekday=1)
        new_id, task_id = self.ask(visit, "reschedule", clinic_slot(2, 11))
        preview = self.call("GET", f"{ROOT}/appointments/{visit}/change-preview", "doctor")
        self.assertEqual(preview["kind"], "reschedule")
        self.assertIsNone(preview["outsideRules"])
        self.assertTrue(preview["newWhen"] and preview["visitWhen"])
        before = len(self.keys_for_patient())
        answer = self.call("POST", f"{ROOT}/appointments/{visit}/change/confirm-new-time", "doctor", {})
        self.assertEqual((answer["old"]["status"], answer["new"]["status"]), ("cancelled", "scheduled"))
        with SessionLocal() as db:
            self.assertEqual(db.get(models.Appointment, visit).change_kind, None)  # the request is closed
            self.assertEqual(db.get(models.Task, task_id).status, "COMPLETED")
            self.assertEqual(db.query(models.AuditLog).filter_by(action="visit_change_confirmed_new_time").count(), 1)
        new_keys = self.keys_for_patient()[before:]
        self.assertIn("visit_confirmed", new_keys)  # she is told in her language, with the existing messages
        self.assertTrue(any(k and k.startswith("appointment_cancelled") or k == "appointment_cancelled" for k in new_keys) or len(new_keys) >= 2)
        self.call("POST", f"{ROOT}/appointments/{visit}/change/confirm-new-time", "doctor", {}, expected=409)  # already answered

    def test_a_time_outside_the_booking_rules_needs_the_doctor_to_say_so(self):
        visit = self.confirmed_visit(weekday=1)
        self.ask(visit, "reschedule", clinic_slot(6, 10))  # a Sunday: the clinic does not see patients
        preview = self.call("GET", f"{ROOT}/appointments/{visit}/change-preview", "doctor")
        self.assertIn("does not see patients", preview["outsideRules"])
        refused = self.client.post(f"{ROOT}/appointments/{visit}/change/confirm-new-time", headers=self.headers["doctor"], json={})
        self.assertEqual(refused.status_code, 409)
        self.assertIn("outside the clinic's booking rules", refused.json()["detail"])
        with SessionLocal() as db:
            self.assertEqual(db.get(models.Appointment, visit).status, "scheduled")  # nothing changed
        done = self.call("POST", f"{ROOT}/appointments/{visit}/change/confirm-new-time", "doctor", {"acceptOutsideRules": True})
        self.assertEqual(done["new"]["status"], "scheduled")

    def test_offering_other_times_closes_her_request_and_leaves_the_old_visit_alone(self):
        visit = self.confirmed_visit(weekday=1)
        new_id, task_id = self.ask(visit, "reschedule", clinic_slot(2, 12))
        answer = self.call("POST", f"{ROOT}/appointments/{visit}/change/offer-other-times", "doctor")
        self.assertTrue(answer["offered"])
        with SessionLocal() as db:
            self.assertEqual(db.get(models.Appointment, visit).status, "scheduled")
            self.assertEqual(db.get(models.Appointment, visit).change_kind, None)
            self.assertEqual(db.get(models.Appointment, new_id).status, "cancelled")  # her visit request for the new time is closed
            self.assertEqual(db.get(models.Task, task_id).status, "COMPLETED")
            self.assertEqual(db.query(models.AuditLog).filter_by(action="visit_change_other_times_offered").count(), 1)
        self.assertIn("new_times_offered", self.keys_for_patient())
        self.call("POST", f"{ROOT}/appointments/{visit}/change/offer-other-times", "doctor", expected=409)

    def test_cancelling_the_visit_she_asked_to_cancel(self):
        visit = self.confirmed_visit(weekday=3)
        _, task_id = self.ask(visit, "cancel")
        wrong = self.client.post(f"{ROOT}/appointments/{visit}/change/offer-other-times", headers=self.headers["doctor"])
        self.assertEqual(wrong.status_code, 409)  # the wrong answer for a request to cancel
        self.call("POST", f"{ROOT}/appointments/{visit}/change/cancel-visit", "doctor")
        with SessionLocal() as db:
            self.assertEqual(db.get(models.Appointment, visit).status, "cancelled")
            self.assertEqual(db.get(models.Task, task_id).status, "COMPLETED")
        self.call("POST", f"{ROOT}/appointments/{visit}/change/cancel-visit", "doctor", expected=409)

    def test_only_the_patients_own_doctor_can_answer(self):
        visit = self.confirmed_visit(weekday=1)
        self.ask(visit, "cancel")
        self.call("POST", f"{ROOT}/appointments/{visit}/change/cancel-visit", "patient", expected=403)
        self.call("POST", f"{ROOT}/appointments/{visit}/change/cancel-visit", "staff", expected=403)
        other = self.client.post(f"{ROOT}/appointments/{visit}/change/cancel-visit", headers=self.headers["other_doctor"])
        self.assertIn(other.status_code, (403, 404))
        self.call("GET", f"{ROOT}/appointments/{visit}/change-preview", "patient", expected=403)


if __name__ == "__main__":
    unittest.main()
