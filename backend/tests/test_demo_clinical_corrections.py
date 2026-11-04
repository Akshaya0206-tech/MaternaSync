"""Clinical demo refresh: old databases update without rewriting user records.

The historical fixture exists only to reproduce the prior synthetic defaults;
runtime migration keeps hashes, not the retired clinical wording.
"""
import json
import io
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

import testenv  # noqa: F401
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app import models
from backend.app.database import Base
from backend.app.seed_clinical_corrections import FINGERPRINTS, RECORD_FIELDS, ensure_demo_clinical_corrections
from backend.app.seed_data import SEED_JSON, run_seed
from backend.app.seed_documents import ensure_document_labels
from backend.app.seed_role_data import ANANYA_GLUCOSE_REPORT, ensure_additional_demo_accounts, run_seed_role_data


PRIOR = json.loads((Path(__file__).parent / "fixtures" / "demo_clinical_prior_fields.json").read_text(encoding="utf-8"))
CURRENT = next(ep for ep in json.loads(SEED_JSON.read_text(encoding="utf-8")) if ep["id"] == FINGERPRINTS["episodeId"])


class DemoClinicalCorrectionTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        # Authentication is outside this migration test; avoid repeatedly hashing
        # the fourteen synthetic account passwords for every isolated database.
        with patch("backend.app.seed_data.hash_password", return_value="unused-test-hash"), \
                patch("backend.app.seed_role_data.hash_password", return_value="unused-test-hash"), redirect_stdout(io.StringIO()):
            run_seed(self.db)
            run_seed_role_data(self.db)
            ensure_additional_demo_accounts(self.db)
            ensure_document_labels(self.db)
        self.sarah = self.episode("sarah.jenkins@maternasync.app")
        self.records = {record["id"]: record for record in CURRENT["records"]}

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def episode(self, email):
        return (self.db.query(models.PregnancyEpisode).join(models.User, models.User.id == models.PregnancyEpisode.patient_user_id)
                .filter(models.User.email == email).one())

    def document(self, record_id):
        return self.db.query(models.MedicalDocument).filter_by(
            episode_id=self.sarah.id, filename=self.records[record_id]["sourceId"], file_path="").one()

    def journey(self, document):
        return self.db.query(models.JourneyEvent).filter_by(source_document_id=document.id, event_type="document").one()

    def make_old(self):
        """Reproduce the individual original seed fields, preserving all object identities."""
        self.sarah.risk_notes = PRIOR["riskNotes"]
        self.db.get(models.Patient, CURRENT["id"]).risk_notes = PRIOR["riskNotes"]
        for record_id, fields in PRIOR["records"].items():
            doc = self.document(record_id)
            journey = self.journey(doc)
            legacy = self.db.get(models.Record, record_id)
            for key, value in fields.items():
                setattr(legacy, RECORD_FIELDS[key], value)
            if "title" in fields:
                doc.description = doc.extraction.record_type = journey.title = fields["title"]
                doc.extraction.field_status = {"recordType": {"value": fields["title"], "status": "extracted"}}
            if "fullContent" in fields:
                doc.extraction.raw_text = fields["fullContent"]
            if "summaryText" in fields:
                journey.summary = fields["summaryText"]
        for item_id, fields in PRIOR["workflowItems"].items():
            legacy = self.db.get(models.WorkflowItem, item_id)
            for key, value in fields.items():
                setattr(legacy, key, value)
            referral = self.db.query(models.Referral).filter_by(episode_id=self.sarah.id, title=legacy.title).one()
            referral.description = fields["description"]
        for item_id, fields in PRIOR["activityLogs"].items():
            for key, value in fields.items():
                setattr(self.db.get(models.ActivityLog, item_id), key, value)
        self.db.commit()

    def test_fresh_seed_has_corrected_content_and_needs_no_backfill(self):
        self.assertEqual(ensure_demo_clinical_corrections(self.db), 0)
        first = self.journey(self.document("REC-001")).summary.lower()
        for expected in ("hemoglobin", "blood group", "pre-pregnancy", "67 kg"):
            self.assertIn(expected, first)
        nipt = self.document("REC-002")
        self.assertNotIn("predicted sex", nipt.extraction.raw_text.lower())
        self.assertNotIn("fetal sex", self.journey(nipt).summary.lower())
        glucose = self.document("REC-004")
        self.assertIn("DIPSI", glucose.extraction.raw_text)
        self.assertIn("75 g", glucose.extraction.raw_text)
        self.assertNotIn("100g", glucose.extraction.raw_text)
        self.assertIn("hypertension", self.journey(self.document("REC-008")).summary.lower())

    def test_old_data_updates_role_and_legacy_views_once_without_changing_ids_or_status(self):
        self.make_old()
        identities = [(d.id, d.filename, d.status) for d in self.db.query(models.MedicalDocument).all()]
        self.assertGreater(ensure_demo_clinical_corrections(self.db), 0)
        for record_id, old in PRIOR["records"].items():
            legacy = self.db.get(models.Record, record_id)
            current = self.records[record_id]
            for key in old:
                self.assertEqual(getattr(legacy, RECORD_FIELDS[key]), current[key])
            doc = self.document(record_id)
            self.assertEqual(doc.extraction.raw_text, current["fullContent"])
            self.assertEqual(self.journey(doc).summary, current["summaryText"])
        glucose = self.document("REC-004")
        self.assertEqual(glucose.description, self.records["REC-004"]["title"])
        self.assertEqual(glucose.extraction.field_status["recordType"]["value"], glucose.description)
        self.assertEqual(glucose.extraction.field_status["recordType"]["status"], "extracted")
        referral = self.db.query(models.Referral).filter_by(episode_id=self.sarah.id).one()
        self.assertIn("hypertension", referral.description)
        self.assertIn("umbilical", referral.description)
        for item_id, fields in PRIOR["activityLogs"].items():
            current = next(item for item in CURRENT["activityLogs"] if item["id"] == item_id)
            for key in fields:
                self.assertEqual(getattr(self.db.get(models.ActivityLog, item_id), key), current[key])
        self.assertEqual(self.sarah.risk_notes, CURRENT["riskNotes"])
        self.assertEqual(identities, [(d.id, d.filename, d.status) for d in self.db.query(models.MedicalDocument).all()])
        self.assertEqual(ensure_demo_clinical_corrections(self.db), 0)

    def test_individually_edited_fields_and_workflow_progress_are_preserved(self):
        self.make_old()
        glucose = self.document("REC-004")
        glucose.description = "My own document title"
        glucose.extraction.raw_text = "Clinician corrected this record"
        glucose.extraction.field_status = {"recordType": {"value": "Reviewed title", "status": "reviewed"}}
        self.journey(glucose).summary = "Doctor's edited summary"
        self.sarah.risk_notes = "Clinician updated risk history"
        legacy = self.db.get(models.Record, "REC-004")
        legacy.summary_text = "Legacy edited summary"
        referral = self.db.query(models.Referral).filter_by(episode_id=self.sarah.id).one()
        referral.description, referral.status = "Individually reviewed referral", "CLOSED"
        item = self.db.get(models.WorkflowItem, "WF-102")
        item.status = "completed"
        self.db.commit()
        ensure_demo_clinical_corrections(self.db)
        self.assertEqual(glucose.description, "My own document title")
        self.assertEqual(glucose.extraction.raw_text, "Clinician corrected this record")
        self.assertEqual(glucose.extraction.field_status["recordType"], {"value": "Reviewed title", "status": "reviewed"})
        self.assertEqual(self.journey(glucose).summary, "Doctor's edited summary")
        self.assertEqual(self.sarah.risk_notes, "Clinician updated risk history")
        self.assertEqual(legacy.summary_text, "Legacy edited summary")
        self.assertEqual(referral.description, "Individually reviewed referral")
        self.assertEqual(referral.status, "CLOSED")
        self.assertEqual(item.status, "completed")
        self.assertEqual(glucose.extraction.record_type, self.records["REC-004"]["title"])

    def copy_old_document(self, episode, file_path="", event_type="document"):
        original = self.document("REC-004")
        old = PRIOR["records"]["REC-004"]
        doc = models.MedicalDocument(episode_id=episode.id, uploaded_by_user_id=episode.patient_user_id,
            uploaded_by_role="patient", filename=original.filename, file_path=file_path,
            document_date=original.document_date, uploaded_at=original.uploaded_at,
            description=old["title"], status="VERIFIED")
        self.db.add(doc)
        self.db.flush()
        doc.extraction = models.DocumentExtraction(document_id=doc.id, raw_text=old["fullContent"], record_type=old["title"])
        event = models.JourneyEvent(episode_id=episode.id, event_type=event_type, source_document_id=doc.id,
            title=old["title"], summary=old["summaryText"], event_date=doc.document_date)
        self.db.add(event)
        self.db.commit()
        return doc, event

    def test_uploaded_files_and_other_patient_with_same_filename_are_not_changed(self):
        uploaded, event = self.copy_old_document(self.sarah, "real-upload.pdf")
        other, other_event = self.copy_old_document(self.episode("elena.rostova@maternasync.app"))
        ensure_demo_clinical_corrections(self.db)
        for doc, journey in ((uploaded, event), (other, other_event)):
            self.assertEqual(doc.extraction.raw_text, PRIOR["records"]["REC-004"]["fullContent"])
            self.assertEqual(journey.summary, PRIOR["records"]["REC-004"]["summaryText"])
        legacy = self.db.get(models.Record, "REC-004")
        legacy.full_content = PRIOR["records"]["REC-004"]["fullContent"]
        legacy.document_path = "real-upload.pdf"
        self.db.commit()
        ensure_demo_clinical_corrections(self.db)
        self.assertEqual(legacy.full_content, PRIOR["records"]["REC-004"]["fullContent"])

    def test_matching_account_and_mrn_without_seed_provenance_is_untouched(self):
        another = models.PregnancyEpisode(patient_user_id=self.sarah.patient_user_id,
            patient_name=self.sarah.patient_name, mrn=self.sarah.mrn, edd="2028-01-01")
        self.db.add(another)
        self.db.flush()
        doc, event = self.copy_old_document(another)
        ensure_demo_clinical_corrections(self.db)
        self.assertEqual(doc.extraction.raw_text, PRIOR["records"]["REC-004"]["fullContent"])
        self.assertEqual(event.summary, PRIOR["records"]["REC-004"]["summaryText"])

    def test_approved_consultation_and_its_journey_are_untouched(self):
        self.make_old()
        doctor = self.db.query(models.User).filter_by(email="demo@maternasync.app").one()
        consultation = models.Consultation(episode_id=self.sarah.id, doctor_user_id=doctor.id, status="documented")
        self.db.add(consultation)
        self.db.flush()
        draft = models.ConsultationDraft(consultation_id=consultation.id, status="APPROVED")
        self.db.add(draft)
        self.db.flush()
        content = {"documented": PRIOR["records"]["REC-004"]["summaryText"]}
        approved = models.ApprovedConsultation(consultation_id=consultation.id, draft_id=draft.id,
            approved_by_user_id=doctor.id, final_content=content)
        self.db.add(approved)
        self.db.flush()
        original = self.document("REC-004")
        event = models.JourneyEvent(episode_id=self.sarah.id, event_type="consultation",
            source_document_id=original.id, source_consultation_id=approved.id,
            title=PRIOR["records"]["REC-004"]["title"], summary=content["documented"], event_date=original.document_date)
        self.db.add(event)
        self.db.commit()
        ensure_demo_clinical_corrections(self.db)
        self.assertEqual(approved.final_content, content)
        self.assertEqual(event.summary, content["documented"])

    def test_ananya_old_demo_updates_but_keeps_review_pending(self):
        episode = self.episode("ananya.kumar@maternasync.app")
        doc = self.db.query(models.MedicalDocument).filter_by(episode_id=episode.id, filename="glucose-tolerance-test-results.pdf").one()
        self.assertEqual(doc.extraction.raw_text, ANANYA_GLUCOSE_REPORT)
        doc.extraction.raw_text = "3-hour GTT: fasting 98, 1hr 192, 2hr 168, 3hr 142 \u2014 consistent with gestational diabetes."
        self.db.commit()
        self.assertEqual(ensure_demo_clinical_corrections(self.db), 1)
        self.assertEqual(doc.extraction.raw_text, ANANYA_GLUCOSE_REPORT)
        self.assertEqual(doc.status, "NEEDS_REVIEW")
        self.assertEqual(self.db.query(models.JourneyEvent).filter_by(source_document_id=doc.id).count(), 0)
        self.assertEqual(ensure_demo_clinical_corrections(self.db), 0)


if __name__ == "__main__":
    unittest.main()
