"""The doctor's Dashboard ("Set up your clinic", "Needs you", Today's Patients extras) and My Patients (weeks pregnant, overdue tasks, a visit this week).
Same isolated synthetic database as the other tests; each test puts back what it changes."""
import unittest
from datetime import datetime, timedelta, timezone

import testenv  # noqa: F401: sets the isolated database and settings before the app is imported

from backend.app import models
from backend.app.ai_coordinator import controls, scheduling
from backend.app.database import SessionLocal
from backend.app.plain_language import LAB_NOTE_PREFIX

from test_assistant_caregiver import Base

SETUP = "/api/v2/doctor/setup-status"
NEEDS = "/api/v2/doctor/needs-you"
KEYS = ["clinic_contact", "booking_rules", "reply_time", "followup_rules", "hospitals", "education"]


def now():
    return datetime.now(timezone.utc)


def naive(moment):
    return moment.astimezone(timezone.utc).replace(tzinfo=None)


class OnlyDoctors(Base):
    def test_both_endpoints_are_for_doctors_only(self):
        for path in (SETUP, NEEDS):
            for who in ("patient", "ravi", "staff"):
                self.assertEqual(self.client.get(path, headers=self.headers[who]).status_code, 403, (path, who))
            self.assertEqual(self.client.get(path).status_code, 401, path)
            self.assertEqual(self.client.get(path, headers=self.headers["doctor"]).status_code, 200, path)


class SetupStatusTests(Base):
    def setUp(self):
        self.made = {"resources": [], "hospitals": []}
        with SessionLocal() as db:
            # Put the clinic's own setup aside, and back afterwards.
            self.saved = {
                "contact": db.get(models.ClinicContact, "clinic"),
                "reply": db.get(models.AssistantSetting, "reply_time"),
                "rules": db.get(models.AssistantSetting, controls.SCHEDULING),
            }
            self.saved = {k: (v.__dict__.copy() if v is not None else None) for k, v in self.saved.items()}
            for row in (db.get(models.ClinicContact, "clinic"), db.get(models.AssistantSetting, "reply_time"), db.get(models.AssistantSetting, controls.SCHEDULING)):
                if row is not None:
                    db.delete(row)
            self.hospitals_before = [{k: v for k, v in h.__dict__.items() if not k.startswith("_")} for h in db.query(models.ClinicHospital).all()]
            db.query(models.ClinicHospital).delete()
            self.status_before = {r.id: r.status for r in db.query(models.ClinicalResource).filter(models.ClinicalResource.kind.in_(["education", "rule"]), models.ClinicalResource.status == "APPROVED").all()}
            for r in db.query(models.ClinicalResource).filter(models.ClinicalResource.id.in_(list(self.status_before))).all():
                r.status = "DRAFT"
            db.commit()

    def tearDown(self):
        with SessionLocal() as db:
            for table, key in ((models.ClinicContact, "clinic"), (models.AssistantSetting, "reply_time"), (models.AssistantSetting, controls.SCHEDULING)):
                row = db.get(table, key)
                if row is not None:
                    db.delete(row)
            db.query(models.ClinicHospital).delete()
            for item in self.hospitals_before:
                db.add(models.ClinicHospital(**item))
            for name, table, key in (("contact", models.ClinicContact, "clinic"), ("reply", models.AssistantSetting, "reply_time"), ("rules", models.AssistantSetting, controls.SCHEDULING)):
                saved = self.saved[name]
                if saved is not None:
                    db.add(table(**{k: v for k, v in saved.items() if not k.startswith("_")}))
            for resource_id in self.made["resources"]:
                item = db.get(models.ClinicalResource, resource_id)
                if item is not None:
                    db.delete(item)
            for resource_id, status in self.status_before.items():
                item = db.get(models.ClinicalResource, resource_id)
                if item is not None:
                    item.status = status
            db.commit()

    def status(self):
        return {i["key"]: i for i in self.call("GET", SETUP, "doctor")["items"]}

    def resource(self, kind, family, status="APPROVED", review_due=None, configuration=None, language="en", version=1):
        with SessionLocal() as db:
            item = models.ClinicalResource(family_id=family, version=version, kind=kind, title=family, status=status, language=language, created_by_user_id=self.doctor_id,
                                           review_due=review_due or (datetime.now().date() + timedelta(days=90)).isoformat(), configuration=configuration or {})
            db.add(item)
            db.commit()
            self.made["resources"].append(item.id)

    def test_nothing_set_up_means_nothing_done(self):
        result = self.call("GET", SETUP, "doctor")
        self.assertEqual([i["key"] for i in result["items"]], KEYS)  # the card's order
        self.assertEqual((result["done"], result["total"]), (0, 6))
        self.assertTrue(all(not i["done"] for i in result["items"]))

    def test_the_clinic_name_and_phone_both_count(self):
        with SessionLocal() as db:
            db.add(models.ClinicContact(key="clinic", clinic_name="St Jude Clinic", clinic_phone=""))
            db.commit()
        self.assertFalse(self.status()["clinic_contact"]["done"])  # a name alone is not enough
        with SessionLocal() as db:
            db.get(models.ClinicContact, "clinic").clinic_phone = "+914412345678"
            db.commit()
        self.assertTrue(self.status()["clinic_contact"]["done"])

    def test_booking_rules_count_only_once_they_were_saved(self):
        self.assertFalse(self.status()["booking_rules"]["done"])  # the built-in defaults were never chosen by a doctor
        self.call("PUT", "/api/v2/assistant/scheduling-rules", "doctor",
                  {"days": [0, 1, 2], "start": "09:00", "end": "13:00", "minutes": 20, "noticeHours": 4, "offsetMinutes": 330, "graceHours": 2})
        self.assertTrue(self.status()["booking_rules"]["done"])

    def test_the_usual_reply_time_counts_when_it_has_words(self):
        self.assertFalse(self.status()["reply_time"]["done"])
        self.call("PUT", "/api/v2/assistant/reply-time", "doctor", {"text": "within one working day"})
        self.assertTrue(self.status()["reply_time"]["done"])
        self.call("PUT", "/api/v2/assistant/reply-time", "doctor", {"text": "   "})
        self.assertFalse(self.status()["reply_time"]["done"])  # cleared again

    def test_recommended_hospitals_are_counted(self):
        self.assertEqual(self.status()["hospitals"]["count"], 0)
        with SessionLocal() as db:
            db.add_all([models.ClinicHospital(name="City Women's Hospital"), models.ClinicHospital(name="St Mary's")])
            db.commit()
        item = self.status()["hospitals"]
        self.assertTrue(item["done"])
        self.assertEqual(item["count"], 2)

    def test_only_an_approved_follow_up_rule_that_is_still_in_date_counts(self):
        self.resource("rule", "w1-rule-draft", status="DRAFT", configuration={"metric": "missing_days"})
        self.resource("rule", "w1-rule-expired", review_due="2000-01-01", configuration={"metric": "missing_days"})
        self.resource("rule", "w1-rule-other-metric", configuration={"metric": "something_else"})
        self.assertFalse(self.status()["followup_rules"]["done"])
        self.resource("rule", "w1-rule-ok", configuration={"metric": "overdue_task_days"})
        item = self.status()["followup_rules"]
        self.assertTrue(item["done"])
        self.assertEqual(item["count"], 1)

    def test_education_counts_the_same_notes_the_care_companion_could_show(self):
        self.resource("education", "w1-edu-draft", status="DRAFT")
        self.resource("education", "w1-edu-expired", review_due="2000-01-01")
        self.resource("education", LAB_NOTE_PREFIX + "w1", )  # a lab-test note belongs to signed explanations, not to the companion
        self.assertFalse(self.status()["education"]["done"])
        self.resource("education", "w1-edu-good")
        self.resource("education", "w1-edu-good", language="hi", version=2)  # the same note in a second language is still one note
        item = self.status()["education"]
        self.assertTrue(item["done"])
        self.assertEqual(item["count"], 1)

    def test_the_count_of_done_items_follows_what_is_set(self):
        self.call("PUT", "/api/v2/assistant/reply-time", "doctor", {"text": "within a day"})
        with SessionLocal() as db:
            db.add(models.ClinicHospital(name="One"))
            db.commit()
        result = self.call("GET", SETUP, "doctor")
        self.assertEqual(result["done"], 2)
        self.assertEqual(result["total"], 6)


class NeedsYouTests(Base):
    def setUp(self):
        self.made = {"questions": [], "documents": [], "consultations": [], "outputs": [], "items": []}
        self.before = {}
        with SessionLocal() as db:
            # Whatever is already waiting is put aside so the list holds only what a test makes.
            for key, model, column, waiting, parked in (
                ("questions", models.PatientQuestion, "status", ("NEW", "ASSIGNED", "WAITING_FOR_RESPONSE"), "CLOSED"),
                ("documents", models.MedicalDocument, "status", ("NEEDS_REVIEW",), "VERIFIED"),
                ("drafts", models.ConsultationDraft, "status", ("DRAFT",), "REJECTED"),
                ("outputs", models.ClinicalOutput, "status", ("DRAFT",), "ARCHIVED"),
                ("items", models.ExceptionItem, "status", ("OPEN",), "DISMISSED"),
            ):
                rows = db.query(model).filter(getattr(model, column).in_(waiting)).all()
                self.before[key] = {r.id: getattr(r, column) for r in rows}
                for r in rows:
                    setattr(r, column, parked)
            db.commit()

    def tearDown(self):
        with SessionLocal() as db:
            for key, ids, model in (("questions", self.made["questions"], models.PatientQuestion), ("documents", self.made["documents"], models.MedicalDocument),
                                    ("outputs", self.made["outputs"], models.ClinicalOutput), ("items", self.made["items"], models.ExceptionItem)):
                for item_id in ids:
                    row = db.get(model, item_id)
                    if row is not None:
                        for response in list(getattr(row, "responses", [])):
                            db.delete(response)
                        db.delete(row)
            for consultation_id in self.made["consultations"]:
                for draft in db.query(models.ConsultationDraft).filter_by(consultation_id=consultation_id).all():
                    db.delete(draft)
                row = db.get(models.Consultation, consultation_id)
                if row is not None:
                    db.delete(row)
            for key, model in (("questions", models.PatientQuestion), ("documents", models.MedicalDocument), ("drafts", models.ConsultationDraft), ("outputs", models.ClinicalOutput), ("items", models.ExceptionItem)):
                for item_id, status in self.before[key].items():
                    row = db.get(model, item_id)
                    if row is not None:
                        row.status = status
            db.commit()

    def ago(self, days):
        return naive(now() - timedelta(days=days))

    def make_everything(self):
        question = self.call("POST", "/api/v2/patient/questions", "patient", {"questionText": "Can I travel by bus next week?"})
        self.made["questions"].append(question["id"])
        with SessionLocal() as db:
            q = db.get(models.PatientQuestion, question["id"])
            q.created_at = self.ago(5)
            q.assigned_to_user_id, q.status = self.doctor_id, "ASSIGNED"  # the assistant (not running in tests) hands every question to the doctor
            document = models.MedicalDocument(episode_id=self.ep, uploaded_by_user_id=self.sarah_id, uploaded_by_role="patient", filename="LAB-X-1", file_path="", description="Blood test report",
                                              status="NEEDS_REVIEW", uploaded_at=self.ago(4))
            consultation = models.Consultation(episode_id=self.ep, doctor_user_id=self.doctor_id, input_mode="text", status="documented")
            output = models.ClinicalOutput(episode_id=self.ep, kind="visit_summary", title="Visit summary", source_type="consultation", source_id="x", status="DRAFT",
                                           created_by_user_id=self.doctor_id, created_at=self.ago(2))
            proposal = models.ExceptionItem(episode_id=self.ep, kind="proposal", title="Confirm a visit", status="OPEN", created_at=self.ago(1))
            db.add_all([document, consultation, output, proposal])
            db.flush()
            db.add(models.ConsultationDraft(consultation_id=consultation.id, status="DRAFT", created_at=self.ago(3)))
            self.made["documents"].append(document.id)
            self.made["consultations"].append(consultation.id)
            self.made["outputs"].append(output.id)
            self.made["items"].append(proposal.id)
            db.commit()

    def test_everything_waiting_is_listed_oldest_first_and_nothing_else_decides_the_order(self):
        self.make_everything()
        result = self.call("GET", NEEDS, "doctor")
        self.assertEqual(result["total"], 5, result)
        self.assertEqual([i["kind"] for i in result["items"]], ["question", "document", "draft", "document_draft", "proposal"])
        since = [i["waitingSince"] for i in result["items"]]
        self.assertEqual(since, sorted(since))  # longest wait first
        self.assertTrue(all(i["patientName"] == self.patient_name for i in result["items"]))
        links = {i["kind"]: i["to"] for i in result["items"]}
        self.assertEqual(links["question"], "/doctor/questions")
        self.assertEqual(links["document"], f"/doctor/patients/{self.ep}?tab=documents")
        self.assertEqual(links["draft"], "/doctor/consultations?tab=history")
        self.assertEqual(links["document_draft"], f"/doctor/draft-studio?episodeId={self.ep}")
        self.assertEqual(links["proposal"], "/doctor/assistant")
        self.assertEqual(result["items"][1]["title"], "Blood test report")
        self.assertTrue(result["items"][0]["waitingSince"].endswith("+00:00") or result["items"][0]["waitingSince"].endswith("Z"))

    def test_a_newer_item_never_jumps_ahead_of_an_older_one(self):
        self.make_everything()
        with SessionLocal() as db:
            db.get(models.ExceptionItem, self.made["items"][0]).created_at = self.ago(30)  # the proposal has now waited the longest
            db.commit()
        kinds = [i["kind"] for i in self.call("GET", NEEDS, "doctor")["items"]]
        self.assertEqual(kinds[0], "proposal")

    def test_an_answered_or_verified_item_is_no_longer_listed(self):
        self.make_everything()
        with SessionLocal() as db:
            db.get(models.MedicalDocument, self.made["documents"][0]).status = "VERIFIED"
            db.get(models.PatientQuestion, self.made["questions"][0]).status = "ANSWERED"
            db.get(models.ExceptionItem, self.made["items"][0]).status = "APPROVED"
            db.commit()
        kinds = [i["kind"] for i in self.call("GET", NEEDS, "doctor")["items"]]
        self.assertEqual(kinds, ["draft", "document_draft"])

    def test_an_empty_list_is_empty(self):
        result = self.call("GET", NEEDS, "doctor")
        self.assertEqual(result, {"items": [], "total": 0})

    def test_a_doctor_only_sees_her_own_patients(self):
        self.make_everything()
        mine = self.call("GET", NEEDS, "doctor")
        theirs = self.call("GET", NEEDS, "other_doctor")
        self.assertEqual(theirs["items"], [])  # Sarah's work is not another doctor's
        # And the other way round: a question from a patient of the other doctor never shows up here.
        other = self.client.post("/api/v2/patient/questions", headers=self.headers["other_patient"], json={"questionText": "When is my scan?"})
        self.assertEqual(other.status_code, 200)
        self.made["questions"].append(other.json()["id"])
        again = self.call("GET", NEEDS, "doctor")
        self.assertEqual(len(again["items"]), len(mine["items"]))
        self.assertNotIn("When is my scan?", [i["title"] for i in again["items"]])


class PatientRowsTests(Base):
    def setUp(self):
        self.made = {"appointments": [], "tasks": [], "logs": []}
        with SessionLocal() as db:
            self.appointments_before = {a.id: a.status for a in db.query(models.Appointment).filter_by(episode_id=self.ep).all()}
            for a in db.query(models.Appointment).filter_by(episode_id=self.ep).all():
                a.status = "completed"
            self.tasks_before = {t.id: t.status for t in db.query(models.Task).filter_by(episode_id=self.ep).all()}
            for t in db.query(models.Task).filter_by(episode_id=self.ep).all():
                t.status = "COMPLETED"
            self.logs_before = {l.id: l.recorded_at for l in db.query(models.DailyLog).filter_by(episode_id=self.ep).all()}
            for l in db.query(models.DailyLog).filter_by(episode_id=self.ep).all():
                l.recorded_at = l.recorded_at - timedelta(days=400)
            db.commit()

    def tearDown(self):
        with SessionLocal() as db:
            for kind, model in (("appointments", models.Appointment), ("tasks", models.Task), ("logs", models.DailyLog)):
                for item_id in self.made[kind]:
                    row = db.get(model, item_id)
                    if row is not None:
                        db.delete(row)
            for item_id, status in self.appointments_before.items():
                db.get(models.Appointment, item_id).status = status
            for item_id, status in self.tasks_before.items():
                db.get(models.Task, item_id).status = status
            for item_id, recorded_at in self.logs_before.items():
                db.get(models.DailyLog, item_id).recorded_at = recorded_at
            db.commit()

    def row(self, who="doctor"):
        return next(r for r in self.call("GET", "/api/v2/doctor/patients", who) if r["episodeId"] == self.ep)

    def appointment(self, when, status="scheduled", kind="Check-up"):
        with SessionLocal() as db:
            item = models.Appointment(episode_id=self.ep, scheduled_at=naive(when), appointment_type=kind, status=status)
            db.add(item)
            db.commit()
            self.made["appointments"].append(item.id)
            return item.id

    def task(self, due, status="OPEN"):
        with SessionLocal() as db:
            item = models.Task(episode_id=self.ep, title="A follow-up", owner_user_id=self.doctor_id, created_by_user_id=self.doctor_id, due_date=due, status=status)
            db.add(item)
            db.commit()
            self.made["tasks"].append(item.id)

    def clinic_day_start(self):
        offset = scheduling.rules(SessionLocal())["offset_minutes"]
        local = now() + timedelta(minutes=offset)
        return local.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(minutes=offset)

    def test_weeks_pregnant_come_from_her_record(self):
        with SessionLocal() as db:
            episode = db.get(models.PregnancyEpisode, self.ep)
            weeks, days = episode.gestational_age_weeks, episode.gestational_age_days
        row = self.row()
        self.assertEqual((row["gestationalAgeWeeks"], row["gestationalAgeDays"]), (weeks, days))

    def test_overdue_tasks_are_open_tasks_whose_date_has_passed(self):
        today = now().date()
        self.task((today - timedelta(days=3)).isoformat())
        self.task((today - timedelta(days=1)).isoformat())
        self.task(today.isoformat())  # due today is not overdue
        self.task((today + timedelta(days=5)).isoformat())
        self.task((today - timedelta(days=9)).isoformat(), status="COMPLETED")  # done is done
        self.task(None)
        row = self.row()
        self.assertEqual(row["overdueTasks"], 2)
        self.assertEqual(row["openItems"], 5)  # the two overdue ones, today's, the future one and the one with no date

    def test_a_visit_this_week_counts_from_the_start_of_today_for_seven_days(self):
        start = self.clinic_day_start()
        self.assertFalse(self.row()["visitThisWeek"])  # nothing booked
        self.appointment(start + timedelta(minutes=5))
        self.assertTrue(self.row()["visitThisWeek"])  # earlier today still counts as today
        with SessionLocal() as db:
            db.query(models.Appointment).filter(models.Appointment.id.in_(self.made["appointments"])).update({"status": "cancelled"})
            db.commit()
        self.assertFalse(self.row()["visitThisWeek"])  # a cancelled visit is not a visit
        self.appointment(start + timedelta(days=6, hours=12))
        self.assertTrue(self.row()["visitThisWeek"])  # the last day of the window
        with SessionLocal() as db:
            db.query(models.Appointment).filter(models.Appointment.id == self.made["appointments"][-1]).update({"status": "cancelled"})
            db.commit()
        self.appointment(start + timedelta(days=7, minutes=5))
        self.assertFalse(self.row()["visitThisWeek"])  # the eighth day is next week
        self.appointment(start - timedelta(hours=2))
        self.assertFalse(self.row()["visitThisWeek"])  # yesterday is over

    def test_the_other_doctor_does_not_get_her_patient(self):
        self.assertNotIn(self.ep, [r["episodeId"] for r in self.call("GET", "/api/v2/doctor/patients", "other_doctor")])

    def test_todays_row_shows_the_visit_type_and_the_last_check_in(self):
        self.appointment(now(), kind="Antenatal check-up")
        last = now() - timedelta(days=3)
        with SessionLocal() as db:
            for when, skipped in ((last, False), (now() - timedelta(days=1), True)):  # a skipped day is not a check-in with entries
                log = models.DailyLog(episode_id=self.ep, recorded_at=naive(when), systolic=None, diastolic=None, skipped=skipped, symptoms="", mood="not_recorded", adherence="not_recorded")
                db.add(log)
                db.flush()
                self.made["logs"].append(log.id)
            db.commit()
        row = next(r for r in self.call("GET", "/api/v2/doctor/dashboard", "doctor")["todayPatientRows"] if r["episodeId"] == self.ep)
        self.assertEqual(row["visitType"], "Antenatal check-up")
        self.assertEqual(datetime.fromisoformat(row["lastCheckIn"].replace("Z", "+00:00")).replace(microsecond=0), last.replace(microsecond=0))

    def test_a_patient_with_no_check_in_has_none(self):
        amara = next(r for r in self.call("GET", "/api/v2/doctor/patients", "doctor") if r["patientName"] == "Amara Okafor")
        with SessionLocal() as db:
            if db.query(models.DailyLog).filter_by(episode_id=amara["episodeId"]).count():
                self.skipTest("this database already holds a check-in for her")
            item = models.Appointment(episode_id=amara["episodeId"], scheduled_at=naive(now()), appointment_type="Check-up", status="scheduled")
            db.add(item)
            db.commit()
            item_id = item.id
        try:
            row = next(r for r in self.call("GET", "/api/v2/doctor/dashboard", "doctor")["todayPatientRows"] if r["episodeId"] == amara["episodeId"])
            self.assertIsNone(row["lastCheckIn"])
        finally:
            with SessionLocal() as db:
                db.delete(db.get(models.Appointment, item_id))
                db.commit()


if __name__ == "__main__":
    unittest.main()
