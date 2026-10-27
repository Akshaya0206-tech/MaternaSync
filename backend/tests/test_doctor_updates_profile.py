"""The doctor's Updates (unread count, mark read, where each update leads, the new notices) and Profile (how her name appears to patients, the clinic's
opening hours). Same isolated synthetic database as the other tests; each test puts back what it made."""
import unittest
from datetime import datetime, timedelta, timezone

import fitz
import testenv  # noqa: F401: sets the isolated database and settings before the app is imported

from backend.app import doctor_names, doctor_update_links, models
from backend.app.database import SessionLocal

from test_assistant_caregiver import Base

QUESTIONS = "/api/v2/patient/questions"
UPDATES = "/api/v2/doctor/updates"
CONTACT = "/api/v2/clinic/emergency"


def pdf_bytes(text="Haemoglobin test report. Collected at the clinic laboratory.") -> bytes:
    document = fitz.open()
    document.new_page().insert_text((72, 72), text)
    return document.tobytes()


def note(key=None, type_="continuity", episode_id="EP1"):
    return models.Notification(recipient_user_id="x", episode_id=episode_id, type=type_, title="t", body="b", message_key=key)


class DoctorUpdates(Base):
    def setUp(self):
        self.made = {"questions": [], "appointments": [], "documents": [], "reminders": [], "tasks": []}
        with SessionLocal() as db:
            self.notes_before = {n.id: n.is_read for n in db.query(models.Notification).filter(models.Notification.recipient_user_id.in_([self.doctor_id, self.other_doctor_id()])).all()}

    def other_doctor_id(self):
        with SessionLocal() as db:
            return db.query(models.User).filter_by(email="dr.chen@maternasync.app").first().id

    def tearDown(self):
        with SessionLocal() as db:
            for question_id in reversed(self.made["questions"]):
                question = db.get(models.PatientQuestion, question_id)
                if question is not None:
                    db.delete(question)
            db.flush()
            for kind, model in (("tasks", models.Task), ("reminders", models.CareReminder), ("appointments", models.Appointment), ("documents", models.MedicalDocument)):
                for item_id in self.made[kind]:
                    item = db.get(model, item_id)
                    if item is not None:
                        db.delete(item)
            for n in db.query(models.Notification).filter(models.Notification.recipient_user_id.in_([self.doctor_id, self.other_doctor_id()])).all():
                if n.id not in self.notes_before:
                    db.delete(n)
                else:
                    n.is_read = self.notes_before[n.id]
            profile = db.query(models.DoctorProfile).filter_by(user_id=self.doctor_id).first()
            if profile is not None:
                profile.display_title = profile.display_name = None
            contact = db.get(models.ClinicContact, "clinic")
            if contact is not None:
                contact.clinic_hours = None
            db.commit()

    # ---------------------------------------------------------------- helpers
    def add_note(self, who_id=None, type_="brief_ready", episode_id=None, read=False, key=None):
        with SessionLocal() as db:
            made = models.Notification(recipient_user_id=who_id or self.doctor_id, episode_id=episode_id or self.ep, type=type_, title="Today's Brief ready for Sarah Jenkins",
                                       body="Context prepared from verified records.", is_read=read, message_key=key)
            db.add(made)
            db.commit()
            return made.id

    def unread(self, who="doctor"):
        return self.call("GET", UPDATES + "/unread-summary", who)["total"]

    def ask(self, text="Can I bring my mother to the visit?", **extra):
        made = self.call("POST", QUESTIONS, "patient", {"questionText": text, **extra})
        self.made["questions"].append(made["id"])
        return made

    def titles(self, who="doctor"):
        return [u["title"] for u in self.call("GET", UPDATES, who)]

    # ---------------------------------------------------------------- the unread count and marking read
    def test_the_unread_count_is_hers_and_marking_read_touches_only_hers(self):
        before = self.unread()
        mine = [self.add_note() for _ in range(3)]
        theirs = self.add_note(who_id=self.other_doctor_id())
        self.assertEqual(self.unread(), before + 3)
        other_before = self.unread("other_doctor")
        # one by id; an id that is another doctor's is ignored
        result = self.call("POST", UPDATES + "/mark-read", "doctor", {"scope": "ids", "ids": [mine[0], theirs]})
        self.assertEqual(result["total"], before + 2)
        self.assertEqual(self.unread("other_doctor"), other_before)  # untouched
        # everything
        self.assertEqual(self.call("POST", UPDATES + "/mark-read", "doctor", {"scope": "all"})["total"], 0)
        self.assertEqual(self.unread(), 0)
        self.assertEqual(self.unread("other_doctor"), other_before)
        # naming no updates is refused
        self.call("POST", UPDATES + "/mark-read", "doctor", {"scope": "ids", "ids": []}, expected=400)
        self.call("POST", UPDATES + "/mark-read", "doctor", {"scope": "ids"}, expected=400)

    def test_only_a_doctor_may_use_it(self):
        for who in ("patient", "ravi", "staff"):
            self.call("GET", UPDATES + "/unread-summary", who, expected=403)
            self.call("POST", UPDATES + "/mark-read", who, {"scope": "all"}, expected=403)
        self.assertEqual(self.client.get(UPDATES + "/unread-summary").status_code, 401)

    # ---------------------------------------------------------------- where each update leads
    def test_every_kind_of_update_leads_to_a_page(self):
        cases = {
            "question_needs_you": "/doctor/questions", "question_warning_wording": "/doctor/questions", "question_attachment": "/doctor/questions", "question_followup": "/doctor/questions",
            "document_for_review": "/doctor/patients/EP1?tab=documents", "document_verified_doctor": "/doctor/patients/EP1?tab=documents",
            "visit_change_requested": "/doctor/care-workspace?episodeId=EP1&tab=operations", "visit_change_withdrawn": "/doctor/care-workspace?episodeId=EP1&tab=operations",
            "appointment_requested": "/doctor/care-workspace?episodeId=EP1&tab=operations", "help_requested": "/doctor/care-workspace?episodeId=EP1&tab=operations",
            "task_overdue": "/doctor/care-workspace?episodeId=EP1&tab=operations", "task_due_soon": "/doctor/care-workspace?episodeId=EP1&tab=operations",
            "follow_up_assigned": "/doctor/care-workspace?episodeId=EP1&tab=operations", "pathway_assigned": "/doctor/care-workspace?episodeId=EP1&tab=operations",
            "referral_sent_doctor": "/doctor/patients/EP1?tab=referrals", "referral_review_doctor": "/doctor/patients/EP1?tab=referrals",
            "draft_ready": "/doctor/care-workspace?episodeId=EP1&tab=drafts", "handover_ready": "/doctor/handover",
            "assistant_item": "/doctor/assistant", "assistant_item_urgent": "/doctor/assistant", "weekly_summary": "/doctor/assistant",
            "account_closed": "/doctor/patients/EP1",
        }
        for key, link in cases.items():
            self.assertEqual(doctor_update_links.link_for(note(key)), link, key)
        # older and seeded notes carry only a type
        self.assertEqual(doctor_update_links.link_for(note(type_="brief_ready")), "/doctor/patients/EP1")
        self.assertEqual(doctor_update_links.link_for(note(type_="DOCUMENT_UPLOADED")), "/doctor/patients/EP1?tab=documents")
        self.assertEqual(doctor_update_links.link_for(note(type_="PATIENT_QUESTION_CREATED")), QUESTIONS.replace("/api/v2/patient/questions", "/doctor/questions"))
        self.assertEqual(doctor_update_links.link_for(note(type_="assistant_summary")), "/doctor/assistant")
        # a note about no patient opens the list, and an unknown one has no button
        self.assertEqual(doctor_update_links.link_for(note("account_closed", episode_id=None)), "/doctor/patients")
        self.assertIsNone(doctor_update_links.link_for(note(type_="something_else")))

    def test_the_list_carries_the_link_and_the_patients_list_is_unchanged(self):
        brief = self.add_note()
        listed = {u["id"]: u for u in self.call("GET", UPDATES, "doctor")}
        self.assertEqual(listed[brief]["link"], f"/doctor/patients/{self.ep}")
        self.assertFalse(listed[brief]["isRead"])
        # her own page still gets her own kind of link
        for update in self.call("GET", "/api/v2/patient/updates", "patient"):
            self.assertTrue(update["link"] is None or update["link"].startswith("/patient/"), update)

    # ---------------------------------------------------------------- the new notices
    def test_a_follow_up_question_tells_her_doctor_without_saying_what_she_asked(self):
        before = self.titles().count("A patient asked a follow-up question")
        first = self.ask("My first question")
        self.assertEqual(self.titles().count("A patient asked a follow-up question"), before)  # an ordinary question is not a follow-up
        second = self.ask("About my earlier question: the secret words are lavender and thunder", followUpOf=first["id"])
        updates = [u for u in self.call("GET", UPDATES, "doctor") if u["title"] == "A patient asked a follow-up question"]
        self.assertEqual(len(updates), before + 1)
        newest = updates[0]
        self.assertIn(self.patient_name, newest["body"])
        self.assertNotIn("lavender", newest["body"] + newest["title"])
        self.assertEqual(newest["link"], "/doctor/questions")
        self.assertFalse(newest["isRead"])
        self.assertEqual(self.titles("other_doctor").count("A patient asked a follow-up question"), 0)  # not her doctor
        self.assertTrue(second["id"])

    def test_files_on_one_question_make_one_note_until_it_is_read(self):
        question = self.ask("Here are my reports")
        url = f"{QUESTIONS}/{question['id']}/attachments"

        def attach(name):
            sent = self.client.post(url, headers=self.headers["patient"], files={"file": (name, pdf_bytes(name), "application/pdf")})
            self.assertEqual(sent.status_code, 200, sent.text)
            self.made["documents"].append(sent.json()["id"])

        def count():
            return [u for u in self.call("GET", UPDATES, "doctor") if u["title"] == "A patient attached a file to a question"]

        before = len(count())
        attach("report-one.pdf")
        attach("report-two.pdf")
        self.assertEqual(len(count()), before + 1)
        newest = count()[0]
        self.assertIn(self.patient_name, newest["body"])
        self.assertNotIn("report-one", newest["body"])  # not the file's name
        self.assertEqual(newest["link"], "/doctor/questions")
        self.assertEqual(self.titles("other_doctor").count("A patient attached a file to a question"), 0)
        # once she has read it, another file is news again
        self.call("PATCH", f"{UPDATES}/{newest['id']}/read", "doctor")
        attach("report-three.pdf")
        self.assertEqual(len(count()), before + 2)

    def test_a_request_to_change_a_visit_reaches_the_list_with_a_link_to_the_task(self):
        when = datetime.now(timezone.utc) + timedelta(days=6)
        with SessionLocal() as db:
            visit = models.Appointment(episode_id=self.ep, scheduled_at=when.replace(tzinfo=None), appointment_type="Check-up", status="scheduled", location="Clinic")
            db.add(visit)
            db.commit()
            self.made["appointments"].append(visit.id)
            visit_id = visit.id
        asked = self.call("POST", f"/api/v2/patient/appointments/{visit_id}/change-request", "patient", {"kind": "cancel", "note": "Cannot come"})
        self.assertEqual(asked["id"], visit_id)
        with SessionLocal() as db:
            self.made["tasks"] += [t.id for t in db.query(models.Task).filter_by(episode_id=self.ep, source_id=visit_id).all()]
            for other in db.query(models.Appointment).filter_by(episode_id=self.ep).all():
                if other.id not in self.made["appointments"] and other.change_task_id is None and other.status == "requested" and other.created_at and other.created_at > datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=5):
                    self.made["appointments"].append(other.id)
        found = [u for u in self.call("GET", UPDATES, "doctor") if u["title"] == "A patient asked to change a visit"]
        self.assertTrue(found)
        self.assertEqual(found[0]["link"], f"/doctor/care-workspace?episodeId={self.ep}&tab=operations")

    # ---------------------------------------------------------------- the brief's notes do not pile up
    def test_opening_a_patients_brief_reads_the_brief_notes_about_her_only(self):
        hers = self.add_note()
        other_patient = self.add_note(episode_id=self.elena_ep)
        self.assertEqual(self.client.get(f"/api/v2/doctor/episodes/{self.ep}/todays-brief", headers=self.headers["doctor"]).status_code, 200)
        with SessionLocal() as db:
            self.assertTrue(db.get(models.Notification, hers).is_read)
            self.assertFalse(db.get(models.Notification, other_patient).is_read)  # her other patient's note is still waiting

    # ---------------------------------------------------------------- how her name appears to patients
    def profile(self, body):
        return self.call("PATCH", "/api/v2/doctor/profile", "doctor", body)

    def test_the_title_and_name_are_put_together_the_same_way_everywhere(self):
        self.assertEqual(doctor_names.compose("Dr. Eleanor Vance", None, None), "Dr. Eleanor Vance")  # nothing chosen: as before
        self.assertEqual(doctor_names.compose("Dr. Eleanor Vance", "Dr.", None), "Dr. Eleanor Vance")  # not repeated
        self.assertEqual(doctor_names.compose("Dr. Eleanor Vance", "Prof.", None), "Prof. Dr. Eleanor Vance")
        self.assertEqual(doctor_names.compose("Eleanor Vance", "Prof.", "Eleanor V."), "Prof. Eleanor V.")
        self.assertEqual(doctor_names.compose("Eleanor Vance", "", "Dr E. Vance"), "Dr E. Vance")
        self.assertEqual(doctor_names.compose("Eleanor Vance", "  dr.  ", "Dr. E. Vance"), "Dr. E. Vance")  # a title already there, in any case
        self.assertIsNone(doctor_names.compose("", "Dr.", ""))

    def test_the_profile_keeps_her_real_name_and_says_what_patients_see(self):
        plain = self.call("GET", "/api/v2/doctor/profile", "doctor")
        self.assertEqual(plain["shownName"], plain["fullName"])
        self.assertIsNone(plain["displayTitle"])
        changed = self.profile({"displayTitle": "Prof.", "displayName": "Eleanor V."})
        self.assertEqual((changed["displayTitle"], changed["displayName"], changed["shownName"]), ("Prof.", "Eleanor V.", "Prof. Eleanor V."))
        self.assertEqual(changed["fullName"], plain["fullName"])  # her own screens keep the account name
        with SessionLocal() as db:
            self.assertEqual(db.query(models.AuditLog).filter_by(action="doctor_shown_name_changed", actor_user_id=self.doctor_id).count() >= 1, True)
        # empty again means as before
        cleared = self.profile({"displayTitle": "", "displayName": ""})
        self.assertEqual(cleared["shownName"], plain["fullName"])
        self.assertIsNone(cleared["displayTitle"])
        # too long, and not for anyone else
        self.call("PATCH", "/api/v2/doctor/profile", "doctor", {"displayTitle": "x" * 21}, expected=422)
        self.call("PATCH", "/api/v2/doctor/profile", "patient", {"displayName": "Someone"}, expected=403)

    def test_a_patient_sees_the_chosen_name_everywhere_and_the_doctor_still_sees_the_real_one(self):
        real = self.call("GET", "/api/v2/doctor/profile", "doctor")["fullName"]
        when = datetime.now(timezone.utc) + timedelta(days=5)
        with SessionLocal() as db:
            visit = models.Appointment(episode_id=self.ep, scheduled_at=when.replace(tzinfo=None), appointment_type="Check-up", status="scheduled", location="Clinic")
            db.add(visit)
            reminder = models.CareReminder(episode_id=self.ep, kind="follow_up", title="Bring your card", instructions="", scheduled_at=when.replace(tzinfo=None),
                                           created_by_user_id=self.doctor_id, approved_by_user_id=self.doctor_id)
            db.add(reminder)
            db.commit()
            self.made["appointments"].append(visit.id)
            self.made["reminders"].append(reminder.id)
        self.profile({"displayTitle": "Prof.", "displayName": "Eleanor V."})
        shown = "Prof. Eleanor V."
        # the dashboard's next visit, the visits list, the Emergency help page
        dashboard = self.call("GET", "/api/v2/patient/dashboard", "patient")
        self.assertEqual(dashboard["nextAppointment"]["doctorName"], shown)
        self.assertTrue(all(a["doctorName"] in (shown, None) for a in self.call("GET", "/api/v2/patient/appointments", "patient")))
        self.assertEqual(self.call("GET", "/api/v2/patient/emergency", "patient")["clinic"]["doctorName"], shown)
        # "Approved by ..." on her reminders: hers shows the chosen name, the doctor's own workspace the account name
        mine = {r["id"]: r for r in self.call("GET", f"/api/v2/continuity/episodes/{self.ep}", "patient")["reminders"]}
        self.assertEqual(mine[self.made["reminders"][0]]["approvedByName"], shown)
        theirs = {r["id"]: r for r in self.call("GET", f"/api/v2/continuity/episodes/{self.ep}", "doctor")["reminders"]}
        self.assertEqual(theirs[self.made["reminders"][0]]["approvedByName"], real)
        # the doctor's own view of the same visits
        self.assertEqual(self.call("GET", "/api/v2/doctor/profile", "doctor")["fullName"], real)

    # ---------------------------------------------------------------- the clinic's opening hours
    def test_the_opening_hours_are_part_of_the_clinic_details_patients_read(self):
        before = self.call("GET", CONTACT, "doctor")
        saved = self.call("PUT", CONTACT + "/contact", "doctor", {"clinicName": before["name"] or "Test clinic", "clinicPhone": before["phone"] or "+914412345678", "clinicHours": "  Mon-Sat 9:00-17:00  "})
        self.assertEqual(saved["hours"], "Mon-Sat 9:00-17:00")
        self.assertEqual(self.call("GET", CONTACT, "doctor")["hours"], "Mon-Sat 9:00-17:00")
        self.assertEqual(self.call("GET", "/api/v2/patient/emergency", "patient")["clinic"]["hours"], "Mon-Sat 9:00-17:00")
        with SessionLocal() as db:
            audit = db.query(models.AuditLog).filter_by(action="clinic_contact_changed").order_by(models.AuditLog.timestamp.desc()).first()
            self.assertEqual(audit.new_state["hours"], "Mon-Sat 9:00-17:00")
            self.assertIn("hours", audit.previous_state)
        # empty means none, too long is refused, and only a doctor may write it
        cleared = self.call("PUT", CONTACT + "/contact", "doctor", {"clinicName": saved["name"], "clinicPhone": saved["phone"], "clinicHours": ""})
        self.assertIsNone(cleared["hours"])
        self.call("PUT", CONTACT + "/contact", "doctor", {"clinicName": "x", "clinicPhone": None, "clinicHours": "h" * 201}, expected=422)
        self.call("PUT", CONTACT + "/contact", "patient", {"clinicName": "x", "clinicPhone": None, "clinicHours": "Always"}, expected=403)
        # a client that does not send the hours leaves them as they were
        self.call("PUT", CONTACT + "/contact", "doctor", {"clinicName": saved["name"], "clinicPhone": saved["phone"], "clinicHours": "Daily 8:00-12:00"})
        again = self.call("PUT", CONTACT + "/contact", "doctor", {"clinicName": saved["name"], "clinicPhone": saved["phone"]})
        self.assertEqual(again["hours"], "Daily 8:00-12:00")
        with SessionLocal() as db:  # put the clinic back as the other tests expect it
            contact = db.get(models.ClinicContact, "clinic")
            contact.clinic_name, contact.clinic_phone = before["name"], before["phone"]
            db.commit()

    def test_the_new_columns_are_added_to_an_older_database(self):
        from sqlalchemy import text
        with SessionLocal() as db:
            profile_columns = {row[1] for row in db.execute(text("PRAGMA table_info(doctor_profiles)"))}
            contact_columns = {row[1] for row in db.execute(text("PRAGMA table_info(clinic_contact)"))}
        self.assertLessEqual({"display_title", "display_name"}, profile_columns)
        self.assertIn("clinic_hours", contact_columns)


if __name__ == "__main__":
    unittest.main()
