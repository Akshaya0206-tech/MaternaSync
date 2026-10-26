"""The patient's Updates (unread dots, mark read, where each update leads), the message preview on Sharing & Consent, and the words explained on
My Journey. Same isolated synthetic database as the other tests; each test puts back what it changed."""
import os
import unittest
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import testenv  # noqa: F401: sets the isolated database and settings before the app is imported

from backend.app import models, plain_language as pl, server_text, update_links
from backend.app.database import SessionLocal

from test_assistant_caregiver import Base

PATIENT = "/api/v2/patient"


class UpdatesBase(Base):
    def setUp(self):
        self.made = []  # (model, id) of what a test added
        with SessionLocal() as db:
            # Her demonstration updates are set aside (marked read) so that the counts below are only about what the test adds.
            self.was_unread = [n.id for n in db.query(models.Notification).filter_by(recipient_user_id=self.sarah_id, is_read=False).all()]
            for note in db.query(models.Notification).filter(models.Notification.id.in_(self.was_unread)).all():
                note.is_read = True
            db.commit()
        self.language = "en"

    def tearDown(self):
        with SessionLocal() as db:
            for model, row_id in self.made:
                item = db.get(model, row_id)
                if item is not None:
                    db.delete(item)
            for note in db.query(models.Notification).filter(models.Notification.id.in_(self.was_unread)).all():
                note.is_read = False
            db.commit()
        self.call("PATCH", "/api/v2/continuity/preferences", "patient", {"language": "en"})

    def add_update(self, key, who=None, **params):
        with SessionLocal() as db:
            note = server_text.notify_key(db, who or self.sarah_id, key, episode_id=self.ep, type_="test", params=params, flush=True)
            db.commit()
            self.made.append((models.Notification, note.id))
            return note.id

    def summary(self):
        return self.call("GET", f"{PATIENT}/updates/unread-summary", "patient")

    def updates(self):
        return {n["id"]: n for n in self.call("GET", f"{PATIENT}/updates", "patient")}


class UnreadAndLinksTests(UpdatesBase):
    def test_the_summary_counts_what_is_new_for_each_menu_item(self):
        self.assertEqual(self.summary(), {"total": 0, "questions": 0, "carePlan": 0})
        self.add_update("question_answered_doctor")
        self.add_update("reminders_added", title="Iron tablet")
        self.add_update("approved_document", title="Your visit summary")
        self.add_update("visit_confirmed", kind="Check-up", when="03-11-2026")  # belongs to Appointments: only counts in the total
        self.add_update("caregiver_acted_question", name="Ravi")  # a helper acted for her: in Updates, but nothing to read on My Questions
        self.assertEqual(self.summary(), {"total": 5, "questions": 1, "carePlan": 2})

    def test_marking_what_she_has_seen_clears_only_that_part(self):
        for key, params in (("question_answered", {}), ("reminder_due", {"title": "Calcium"}), ("visit_confirmed", {"kind": "Check-up", "when": "x"})):
            self.add_update(key, **params)
        after_questions = self.call("POST", f"{PATIENT}/updates/mark-read", "patient", {"scope": "questions"})
        self.assertEqual(after_questions, {"total": 2, "questions": 0, "carePlan": 1})
        after_plan = self.call("POST", f"{PATIENT}/updates/mark-read", "patient", {"scope": "care_plan"})
        self.assertEqual(after_plan, {"total": 1, "questions": 0, "carePlan": 0})
        self.assertEqual(self.call("POST", f"{PATIENT}/updates/mark-read", "patient", {"scope": "all"}), {"total": 0, "questions": 0, "carePlan": 0})
        self.call("POST", f"{PATIENT}/updates/mark-read", "patient", {"scope": "everything"}, expected=422)

    def test_one_update_marked_read_lowers_the_count_and_a_second_marking_changes_nothing(self):
        first = self.add_update("reminders_added", title="Folic acid")
        self.add_update("reminders_added", title="Calcium")
        self.call("PATCH", f"{PATIENT}/updates/{first}/read", "patient")
        self.assertEqual(self.summary()["carePlan"], 1)
        self.call("PATCH", f"{PATIENT}/updates/{first}/read", "patient")
        self.assertEqual(self.summary()["total"], 1)

    def test_every_update_a_patient_can_get_leads_to_a_page(self):
        expected = {
            "question_answered": "/patient/questions", "question_answered_doctor": "/patient/questions",
            "reminders_added": "/patient/care-plan", "reminder_due": "/patient/care-plan", "approved_document": "/patient/care-plan",
            "appointment_scheduled": "/patient/appointments", "visit_confirmed": "/patient/appointments", "new_times_offered": "/patient/appointments",
            "visit_missed": "/patient/appointments", "visit_prep_added": "/patient/appointments", "caregiver_visit_yes": "/patient/appointments",
            "document_verified_patient": "/patient/journey", "document_reviewed_named": "/patient/journey", "document_rejected_default": "/patient/records",
            "referral_sent_patient": "/patient/journey", "caregiver_acted_checkin": "/patient/daily-log",
            "caregiver_joined": "/patient/profile", "access_ending": "/patient/profile", "caregiver_whatsapp_on": "/patient/profile",
        }
        ids = {key: self.add_update(key, title="T", kind="K", when="W", name="N", date="D", slots="S", text="X", doctor="Dr") for key in expected}
        shown = self.updates()
        for key, path in expected.items():
            self.assertEqual(shown[ids[key]]["link"], path, key)

    def test_rows_written_before_keys_existed_still_lead_somewhere_and_free_text_does_not(self):
        with SessionLocal() as db:
            old = models.Notification(recipient_user_id=self.sarah_id, episode_id=self.ep, type="document_verified",
                                      title="Your care team reviewed your uploaded documents", body="Your journey has been updated.")
            typed = models.Notification(recipient_user_id=self.sarah_id, episode_id=self.ep, type="x", title="Hello from the clinic", body="Written by a person.")
            db.add_all([old, typed])
            db.commit()
            old_id, typed_id = old.id, typed.id
        self.made += [(models.Notification, old_id), (models.Notification, typed_id)]
        shown = self.updates()
        self.assertEqual(shown[old_id]["link"], "/patient/journey")
        self.assertIsNone(shown[typed_id]["link"])
        self.assertEqual(self.summary()["total"], 2)  # both are new, neither lights My Questions or My Care Plan
        self.assertEqual(self.summary()["questions"] + self.summary()["carePlan"], 0)

    def test_a_reviewed_document_update_names_the_document_in_her_language(self):
        note_id = self.add_update("document_reviewed_named", title="Anatomy scan")
        self.assertEqual(self.updates()[note_id]["title"], "Your document was reviewed: Anatomy scan")
        self.call("PATCH", "/api/v2/continuity/preferences", "patient", {"language": "hi"})
        shown = self.updates()[note_id]
        self.assertIn("Anatomy scan", shown["title"])
        self.assertNotIn("Your document", shown["title"])
        self.assertIn("यात्रा", shown["body"])

    def test_the_summary_and_marking_are_for_patients_and_touch_only_her_own_updates(self):
        self.call("GET", f"{PATIENT}/updates/unread-summary", "doctor", expected=403)
        self.call("POST", f"{PATIENT}/updates/mark-read", "doctor", {"scope": "all"}, expected=403)
        self.call("GET", f"{PATIENT}/consent-preview?purpose=reminders", "doctor", expected=403)
        with SessionLocal() as db:
            theirs = server_text.notify_key(db, self.elena_user, "question_answered", episode_id=self.elena_ep, type_="test", flush=True)
            db.commit()
            theirs_id = theirs.id
        self.made.append((models.Notification, theirs_id))
        self.call("POST", f"{PATIENT}/updates/mark-read", "patient", {"scope": "all"})
        with SessionLocal() as db:
            self.assertFalse(db.get(models.Notification, theirs_id).is_read)  # Sarah marking hers read does not touch Elena's
        self.call("PATCH", f"{PATIENT}/updates/{theirs_id}/read", "patient", expected=404)

    def test_a_document_checked_by_the_doctor_appears_on_the_journey_and_in_updates_but_one_waiting_does_not(self):
        marker = "w6-" + uuid.uuid4().hex[:8] + ".pdf"
        with SessionLocal() as db:
            doc = models.MedicalDocument(episode_id=self.ep, uploaded_by_user_id=self.sarah_id, uploaded_by_role="patient", filename=marker, file_path="none",
                                         status="NEEDS_REVIEW", description="A test upload")
            db.add(doc)
            db.commit()
            doc_id = doc.id
        self.made.append((models.MedicalDocument, doc_id))
        journey = self.call("GET", f"{PATIENT}/journey", "patient")
        self.assertNotIn(marker, [e["title"] for e in journey])  # waiting for the doctor: not on her journey
        self.call("POST", f"/api/v2/doctor/documents/{doc_id}/verify", "doctor")
        with SessionLocal() as db:
            for event in db.query(models.JourneyEvent).filter_by(source_document_id=doc_id).all():
                self.made.append((models.JourneyEvent, event.id))
            for review in db.query(models.DocumentReview).filter_by(document_id=doc_id).all():
                self.made.append((models.DocumentReview, review.id))
        self.assertIn(marker, [e["title"] for e in self.call("GET", f"{PATIENT}/journey", "patient")])
        mine = [n for n in self.updates().values() if marker in n["title"]]
        self.assertEqual(len(mine), 1)
        self.assertEqual(mine[0]["link"], "/patient/journey")
        self.assertEqual(mine[0]["title"], f"Your document was reviewed: {marker}")
        for note in self.updates().values():
            if marker in note["title"]:
                self.made.append((models.Notification, note["id"]))
        self.made.reverse()  # children before the document


class ConsentPreviewTests(UpdatesBase):
    def test_the_preview_is_the_text_the_server_sends_in_her_language(self):
        for purpose, kind in (("reminders", "reminder"), ("approved_documents", "output")):
            for language in ("en", "hi", "ta", "te"):
                self.call("PATCH", "/api/v2/continuity/preferences", "patient", {"language": language})
                shown = self.call("GET", f"{PATIENT}/consent-preview?purpose={purpose}", "patient")
                self.assertEqual(shown["text"], server_text.outreach_text(kind, language), (purpose, language))
                self.assertEqual(shown["language"], language)
                self.assertEqual(shown["purpose"], purpose)

    def test_the_preview_is_made_by_the_same_function_as_the_real_message(self):
        with patch.object(server_text, "outreach_text", return_value="WORDED BY THE SERVER") as worded:
            shown = self.call("GET", f"{PATIENT}/consent-preview?purpose=reminders", "patient")
        self.assertEqual(shown["text"], "WORDED BY THE SERVER")
        worded.assert_called_once_with("reminder", "en")

    def test_the_text_carries_no_name_result_or_medicine(self):
        for purpose in ("reminders", "approved_documents"):
            text = self.call("GET", f"{PATIENT}/consent-preview?purpose={purpose}", "patient")["text"]
            for word in ("Sarah", "Jenkins", self.patient_name, self.mrn, "mg", "BP"):
                self.assertNotIn(word, text)
            self.assertTrue(text.startswith("MaternaSync:"))

    def test_an_unknown_purpose_is_refused_and_a_template_is_reported(self):
        self.call("GET", f"{PATIENT}/consent-preview?purpose=anything", "patient", expected=400)
        self.assertFalse(self.call("GET", f"{PATIENT}/consent-preview?purpose=reminders", "patient")["viaTemplate"])
        with patch.dict(os.environ, {"MATERNASYNC_WHATSAPP_PROVIDER": "cloud_api", "MATERNASYNC_WHATSAPP_TEMPLATE": "care_reminder"}):
            self.assertTrue(self.call("GET", f"{PATIENT}/consent-preview?purpose=reminders", "patient")["viaTemplate"])
        with patch.dict(os.environ, {"MATERNASYNC_WHATSAPP_PROVIDER": "simulator", "MATERNASYNC_WHATSAPP_TEMPLATE": "care_reminder"}):
            self.assertFalse(self.call("GET", f"{PATIENT}/consent-preview?purpose=reminders", "patient")["viaTemplate"])


class JourneyWordsTests(UpdatesBase):
    def journey(self):
        return self.call("GET", f"{PATIENT}/journey", "patient")

    def test_the_shorthand_in_each_entry_is_explained_in_her_language_and_only_defined(self):
        entries = self.journey()
        self.assertTrue(entries)
        by_term = {}
        for entry in entries:
            for word in entry["words"]:
                by_term.setdefault(word["term"], []).append(word["meaning"])
            text = entry["title"] + "\n" + entry["summary"]
            for word in entry["words"]:
                self.assertIn(word["term"], text, "a word is only explained when it is in the entry")
        for term in ("NST", "FHR", "OGTT", "GDMA1", "EFW", "NIPT", "MFM", "CBC", "CRL", "EDD"):
            self.assertIn(term, by_term, f"{term} is in the demonstration journey but was not explained")
        # Definitions only: nothing that says what a result means for her.
        for meanings in by_term.values():
            for meaning in meanings:
                for judgement in ("normal", "abnormal", "healthy", "dangerous", "worry", "risk of", "you have", "your result"):
                    self.assertNotIn(judgement, meaning.lower())
        self.call("PATCH", "/api/v2/continuity/preferences", "patient", {"language": "ta"})
        tamil = {w["term"]: w["meaning"] for e in self.journey() for w in e["words"]}
        self.assertEqual(tamil["NST"], next(g for g in pl.GLOSSARY if "NST" in g["aliases"])["ta"])
        self.assertNotEqual(tamil["NST"], by_term["NST"][0])

    def test_each_word_is_listed_once_per_entry_and_an_entry_without_shorthand_has_none(self):
        for entry in self.journey():
            terms = [w["term"] for w in entry["words"]]
            self.assertEqual(len(terms), len(set(terms)))
        with SessionLocal() as db:
            plain = models.JourneyEvent(episode_id=self.ep, event_type="milestone", title="A quiet day", summary="Nothing to report here.",
                                        event_date="2026-10-01", gestational_age_weeks=30, gestational_age_days=0)
            db.add(plain)
            db.commit()
            plain_id = plain.id
        self.made.append((models.JourneyEvent, plain_id))
        self.assertEqual(next(e for e in self.journey() if e["id"] == plain_id)["words"], [])

    def test_the_added_glossary_words_are_explained_once_and_in_all_four_languages(self):
        samples = {"NST": "non-stress test", "GDMA1": "managed with changes to food", "GDMA2": "treated with medicine", "EFW": "estimated fetal weight",
                   "NIPT": "blood test of the mother", "MFM": "maternal-fetal medicine", "CRL": "crown-rump length", "AFI": "amniotic fluid index",
                   "Doppler": "how blood is flowing", "Trisomy": "extra copy of one chromosome", "Fetal fraction": "share of the DNA",
                   "Fundal height": "pubic bone to the top of the womb"}
        for term, fragment in samples.items():
            text, used = pl.explain_terms(f"The note says {term} today and {term} again.", "en")
            self.assertIn(fragment, text, term)
            self.assertEqual(len(used), 1, term)
            for language in ("hi", "ta", "te"):
                other, used_other = pl.explain_terms(f"{term} was discussed.", language)
                self.assertTrue(used_other and used_other[0][1] in other)
                self.assertNotIn(fragment, other)

    def test_a_patient_only_gets_her_own_journey(self):
        mine = {e["id"] for e in self.journey()}
        theirs = {e["id"] for e in self.call("GET", f"{PATIENT}/journey", "other_patient")}
        self.assertFalse(mine & theirs)


if __name__ == "__main__":
    unittest.main()
