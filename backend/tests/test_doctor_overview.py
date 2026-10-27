"""The Clinic Overview's date range, printed / downloaded summary record, and the doctor's Follow-ups page (what is assigned to her, what is not).
Same isolated synthetic database as the other tests; every test puts back what it added."""
import unittest
from datetime import date, datetime, timedelta, timezone

import testenv  # noqa: F401: sets the isolated database and settings before the app is imported

from backend.app import models
from backend.app.database import SessionLocal

from test_assistant_caregiver import Base

CLINIC = "/api/v2/continuity/clinic"
EXPORT = "/api/v2/continuity/clinic/export"
FOLLOW = "/api/v2/doctor/follow-ups/overview"


def at(text):
    """A moment on a given day, as the database keeps it (UTC, no zone)."""
    return datetime.fromisoformat(text)


class OverviewTests(Base):
    def setUp(self):
        self.made = {"logs": [], "appointments": [], "tasks": [], "outcomes": []}

    def tearDown(self):
        with SessionLocal() as db:
            for kind, model in (("outcomes", models.RecordedOutcome), ("logs", models.DailyLog), ("appointments", models.Appointment), ("tasks", models.Task)):
                for item_id in self.made[kind]:
                    item = db.get(model, item_id)
                    if item is not None:
                        db.delete(item)
            db.commit()

    def clinic(self, who="doctor", **params):
        return self.client.get(CLINIC, headers=self.headers[who], params=params)

    def sarah(self, data):
        return next(p for p in data["patients"] if p["episodeId"] == self.ep)

    def add_march_2020(self):
        """Dated rows in March and April 2020, far from any demo data, so the counts below are exact."""
        with SessionLocal() as db:
            document = db.query(models.MedicalDocument).filter_by(episode_id=self.ep).first()
            for stamp, skipped in (("2020-03-10T12:00:00", False), ("2020-03-10T18:00:00", False), ("2020-03-31T23:59:00", False), ("2020-04-01T00:00:00", False), ("2020-03-12T09:00:00", True)):
                log = models.DailyLog(episode_id=self.ep, recorded_at=at(stamp), systolic=110, diastolic=70, weight_kg=60, skipped=skipped)
                db.add(log)
                db.flush()
                self.made["logs"].append(log.id)
            for stamp, status in (("2020-03-15T10:00:00", "completed"), ("2020-03-20T10:00:00", "no_show"), ("2020-03-22T10:00:00", "cancelled"), ("2020-04-02T10:00:00", "completed")):
                visit = models.Appointment(episode_id=self.ep, scheduled_at=at(stamp), appointment_type="Check-up", status=status)
                db.add(visit)
                db.flush()
                self.made["appointments"].append(visit.id)
            for created, status, changed in (("2020-03-05T09:00:00", "OPEN", "2020-03-05T09:00:00"), ("2020-03-01T09:00:00", "COMPLETED", "2020-03-25T09:00:00"), ("2020-04-06T09:00:00", "OPEN", "2020-04-06T09:00:00")):
                task = models.Task(episode_id=self.ep, title="R4 range task", owner_user_id=self.doctor_id, created_by_user_id=self.doctor_id, status=status,
                                   created_at=at(created), updated_at=at(changed))
                db.add(task)
                db.flush()
                self.made["tasks"].append(task.id)
            for kind, value, event_date in (("scan", "on_time", "2020-03-18"), ("delivery", "vaginal", "2020-04-05")):
                outcome = models.RecordedOutcome(episode_id=self.ep, kind=kind, value=value, event_date=event_date, source_document_id=document.id, recorded_by_user_id=self.doctor_id)
                db.add(outcome)
                db.flush()
                self.made["outcomes"].append(outcome.id)
            db.commit()

    # ---------------------------------------------------------------- the range
    def test_without_a_range_the_page_works_as_before_and_says_so(self):
        data = self.clinic().json()
        self.assertIsNone(data["range"])
        self.assertIn("all recorded dates", data["definition"])
        for key in ("visits", "checkIns", "tasksCreated", "tasksCompleted"):
            self.assertIn(key, data["periodTotals"])
            self.assertIn(key, self.sarah(data)["inRange"])
        self.assertEqual(data["periodTotals"]["visits"], sum(p["inRange"]["visits"] for p in data["patients"]))
        self.assertIn("clinic", data)  # the clinic's own name and phone, for the printed summary

    def test_a_range_counts_both_end_days_and_nothing_outside(self):
        self.add_march_2020()
        march = self.clinic(**{"from": "2020-03-01", "to": "2020-03-31"}).json()
        self.assertEqual(march["range"], {"from": "2020-03-01", "to": "2020-03-31"})
        self.assertIn("within the chosen range", march["definition"])
        mine = self.sarah(march)["inRange"]
        self.assertEqual(mine["checkIns"], 3)  # 10 Mar twice and 31 Mar 23:59; the skipped one and 1 April do not count
        self.assertEqual(mine["visits"], 2)  # completed and no-show; a cancelled visit is not a visit that happened or is booked
        self.assertEqual(mine["tasksCreated"], 2)  # 1 Mar and 5 Mar
        self.assertEqual(mine["tasksCompleted"], 1)  # Completed, last changed 25 Mar
        self.assertEqual(march["metrics"]["recordedScans"], 1)
        self.assertEqual(march["metrics"]["onTimeScans"], 1)
        self.assertEqual(march["metrics"]["recordedDeliveries"], 0)
        self.assertEqual((march["metrics"]["attendedOrNoShow"], march["metrics"]["noShows"]), (2, 1))
        april = self.clinic(**{"from": "2020-04-01", "to": "2020-04-30"}).json()
        self.assertEqual(self.sarah(april)["inRange"]["checkIns"], 1)
        self.assertEqual(april["metrics"]["recordedDeliveries"], 1)
        self.assertEqual(april["metrics"]["deliveryOutcomes"], {"vaginal": 1})
        self.assertEqual((april["metrics"]["attendedOrNoShow"], april["metrics"]["noShows"]), (1, 0))
        one_day = self.clinic(**{"from": "2020-03-31", "to": "2020-03-31"}).json()
        self.assertEqual(self.sarah(one_day)["inRange"]["checkIns"], 1)

    def test_what_is_true_right_now_does_not_move_with_the_range(self):
        everything = self.sarah(self.clinic().json())
        narrow = self.sarah(self.clinic(**{"from": "2020-01-01", "to": "2020-01-02"}).json())
        for key in ("openTasks", "unassigned", "overdue", "upcomingVisits", "appointmentRequests", "lastCheckIn", "missingCheckIn"):
            self.assertEqual(everything[key], narrow[key], key)
        self.assertEqual(narrow["inRange"], {"visits": 0, "checkIns": 0, "tasksCreated": 0, "tasksCompleted": 0})

    def test_a_range_that_is_not_two_real_dates_in_order_is_refused(self):
        for params in ({"from": "2020-03-01"}, {"to": "2020-03-31"}, {"from": "March", "to": "2020-03-31"}, {"from": "2020-02-30", "to": "2020-03-31"},
                       {"from": "2020-03-31", "to": "2020-03-01"}, {"from": "2000-01-01", "to": "2026-10-26"}, {"from": "20200301", "to": "20200331"}):
            result = self.clinic(**params)
            self.assertEqual(result.status_code, 400, params)
            self.assertIn("detail", result.json())

    def test_the_overview_is_only_for_clinicians_and_only_their_own_patients(self):
        self.assertEqual(self.clinic("patient").status_code, 403)
        self.assertEqual(self.client.get(CLINIC).status_code, 401)
        self.assertEqual(self.clinic("staff").status_code, 200)  # the care-team login still works when it is switched on
        other = self.clinic("other_doctor").json()
        self.assertNotIn(self.ep, [p["episodeId"] for p in other["patients"]])  # another doctor does not see her patient

    # ---------------------------------------------------------------- the printed or downloaded summary
    def test_printing_or_downloading_the_summary_is_recorded_with_the_range(self):
        for kind in ("print", "csv"):
            result = self.client.post(EXPORT, headers=self.headers["doctor"], json={"kind": kind, "fromDate": "2026-10-01", "toDate": "2026-10-26", "patients": 2})
            self.assertEqual(result.status_code, 200, result.text)
        with SessionLocal() as db:
            rows = db.query(models.AuditLog).filter_by(action="clinic_report_exported").order_by(models.AuditLog.timestamp.desc()).limit(2).all()
            self.assertEqual({r.new_state["how"] for r in rows}, {"print", "csv"})
            self.assertEqual(rows[0].new_state["range"], {"from": "2026-10-01", "to": "2026-10-26"})
            self.assertEqual(rows[0].new_state["patients"], 2)
            self.assertEqual(rows[0].actor_user_id, self.doctor_id)
            self.assertIn("2026-10-01 to 2026-10-26", rows[0].details)
        result = self.client.post(EXPORT, headers=self.headers["doctor"], json={"kind": "csv", "patients": 2})
        self.assertEqual(result.status_code, 200)  # no range: all recorded dates
        with SessionLocal() as db:
            latest = db.query(models.AuditLog).filter_by(action="clinic_report_exported").order_by(models.AuditLog.timestamp.desc()).first()
            self.assertIsNone(latest.new_state["range"])
            self.assertIn("all recorded dates", latest.details)

    def test_the_export_record_refuses_bad_input_and_other_roles(self):
        bad = ({"kind": "csv", "fromDate": "2026-10-26", "toDate": "2026-10-01", "patients": 2}, {"kind": "csv", "fromDate": "2026-10-01", "patients": 2},
               {"kind": "csv", "patients": -1}, {"kind": "pdf", "patients": 2}, {"kind": "csv", "patients": 2, "extra": True})
        for body in bad:
            self.assertIn(self.client.post(EXPORT, headers=self.headers["doctor"], json=body).status_code, (400, 422), body)
        self.assertEqual(self.client.post(EXPORT, headers=self.headers["patient"], json={"kind": "csv", "patients": 1}).status_code, 403)
        self.assertEqual(self.client.post(EXPORT, json={"kind": "csv", "patients": 1}).status_code, 401)

    # ---------------------------------------------------------------- Follow-ups
    def add_tasks(self):
        today = datetime.now(timezone.utc).date()
        brenda = None
        with SessionLocal() as db:
            brenda = db.query(models.User).filter_by(email="brenda.miller@maternasync.app").first().id
            rows = (("R4 overdue 3", self.doctor_id, (today - timedelta(days=3)).isoformat(), "OPEN"), ("R4 due today", self.doctor_id, today.isoformat(), "IN_PROGRESS"),
                    ("R4 due later", self.doctor_id, (today + timedelta(days=5)).isoformat(), "WAITING"), ("R4 no date", self.doctor_id, None, "OPEN"),
                    ("R4 finished", self.doctor_id, (today - timedelta(days=9)).isoformat(), "COMPLETED"), ("R4 cancelled", self.doctor_id, None, "CANCELLED"),
                    ("R4 theirs", brenda, (today - timedelta(days=1)).isoformat(), "OPEN"), ("R4 nobody", None, None, "OPEN"))
            for title, owner, due, status in rows:
                task = models.Task(episode_id=self.ep, title=title, owner_user_id=owner, created_by_user_id=self.doctor_id, due_date=due, status=status)
                db.add(task)
                db.flush()
                self.made["tasks"].append(task.id)
            db.commit()
        return today

    def test_what_is_assigned_to_her_is_listed_oldest_due_first_with_days_overdue(self):
        today = self.add_tasks()
        data = self.client.get(FOLLOW, headers=self.headers["doctor"]).json()
        self.assertEqual(data["today"], today.isoformat())
        mine = [t for t in data["mine"] if t["title"].startswith("R4 ")]
        self.assertEqual([t["title"] for t in mine], ["R4 overdue 3", "R4 due today", "R4 due later", "R4 no date"])  # open ones only; undated last
        self.assertEqual([t["daysOverdue"] for t in mine], [3, None, None, None])
        self.assertEqual([t["isDue"] for t in mine], [True, True, False, False])
        self.assertTrue(all(t["ownedByYou"] for t in mine))
        self.assertTrue(all(t["patientName"] == self.patient_name and t["episodeId"] == self.ep for t in mine))
        self.assertTrue(all(t["status"] in ("OPEN", "IN_PROGRESS", "WAITING") for t in data["mine"] + data["others"]))

    def test_open_tasks_for_her_patients_that_someone_else_owns_are_listed_separately(self):
        self.add_tasks()
        data = self.client.get(FOLLOW, headers=self.headers["doctor"]).json()
        others = {t["title"]: t for t in data["others"] if t["title"].startswith("R4 ")}
        self.assertEqual(set(others), {"R4 theirs", "R4 nobody"})
        self.assertEqual(others["R4 theirs"]["ownerName"], "Brenda Miller")
        self.assertEqual(others["R4 theirs"]["daysOverdue"], 1)
        self.assertIsNone(others["R4 nobody"]["ownerName"])
        self.assertFalse(any(t["ownedByYou"] for t in data["others"]))
        self.assertFalse(any(t["title"].startswith("R4 ") for t in data["mine"] if t["title"] in others))

    def test_the_dashboard_tile_and_the_page_count_the_same_tasks(self):
        self.add_tasks()
        page = self.client.get(FOLLOW, headers=self.headers["doctor"]).json()
        dashboard = self.client.get("/api/v2/doctor/dashboard", headers=self.headers["doctor"]).json()
        self.assertEqual(dashboard["followUps"], len(page["mine"]))

    def test_another_doctor_never_sees_her_patients_tasks_and_other_roles_are_refused(self):
        self.add_tasks()
        other = self.client.get(FOLLOW, headers=self.headers["other_doctor"]).json()
        self.assertFalse(any(t["title"].startswith("R4 ") for t in other["mine"] + other["others"]))
        for who in ("patient", "ravi", "staff"):
            self.assertEqual(self.client.get(FOLLOW, headers=self.headers[who]).status_code, 403, who)
        self.assertEqual(self.client.get(FOLLOW).status_code, 401)


if __name__ == "__main__":
    unittest.main()
