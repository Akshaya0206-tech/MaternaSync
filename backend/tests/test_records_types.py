"""My Records: the kind of document she says a file is when she uploads it, plain titles and types for the demo records, and the doctor's view of
the same document. Same isolated synthetic database as the other tests; each test removes what it uploaded."""
import unittest

import testenv  # noqa: F401: sets the isolated database and settings before the app is imported

import fitz

from backend.app import models
from backend.app.database import SessionLocal
from backend.app.document_types import DOCUMENT_TYPES, infer_document_type
from backend.app.seed_documents import ensure_document_labels

from test_assistant_caregiver import Base

DOCS = "/api/v2/patient/documents"


def one_page_pdf(text="Haemoglobin test report. Haemoglobin 11.2 g/dL. Collected at the clinic laboratory.") -> bytes:
    pdf = fitz.open()
    pdf.new_page().insert_text((72, 72), text)
    return pdf.tobytes()


class InferenceTests(unittest.TestCase):
    def test_the_demo_titles_get_sensible_types(self):
        cases = {
            ("28-Week Oral Glucose Tolerance Test (OGTT) & CBC", "LAB-OGTT-8812"): "lab_report",
            ("First Trimester Screening & NIPT Lab Results", "LAB-NIPT-9941"): "lab_report",
            ("20-Week Detailed Fetal Anatomy Ultrasound Survey", "RAD-US-2026-0702"): "scan",
            ("12-Week Nuchal Translucency & First Trimester Screen", "RAD-NT-2026-0720"): "scan",
            ("30-Week Prenatal Progress Visit & BP Evaluation", "EHR-CN-2026-0912"): "visit_note",
            ("Inbound Patient Portal Message: Morning BP & Headache", "MSG-9921"): "other",
            ("Referral Order: Maternal-Fetal Medicine (MFM) Growth & Doppler", "ORD-44910"): "other",
            ("Discharge summary", "x.pdf"): "discharge_summary",
            ("Tetanus vaccination card", "x.jpg"): "vaccination_card",
            ("Prescription for iron tablets", "x.pdf"): "prescription",
        }
        for (title, reference), expected in cases.items():
            self.assertEqual(infer_document_type(title, reference), expected, title)
            self.assertIn(expected, DOCUMENT_TYPES)
        self.assertEqual(infer_document_type(None, None), "other")


class RecordsTypeTests(Base):
    def setUp(self):
        self.made = []

    def tearDown(self):
        with SessionLocal() as db:
            for doc_id in self.made:
                doc = db.get(models.MedicalDocument, doc_id)
                if doc is not None:
                    db.delete(doc)
            db.commit()

    def upload(self, who="patient", expected=200, filename="report.pdf", **data):
        result = self.client.post(DOCS, headers=self.headers[who], files={"file": (filename, one_page_pdf(), "application/pdf")}, data=data)
        self.assertEqual(result.status_code, expected, result.text)
        if result.status_code == 200:
            self.made.append(result.json()["document"]["id"])
        return result.json()

    def mine(self):
        return {d["id"]: d for d in self.call("GET", DOCS, "patient")}

    def test_the_type_she_chooses_is_kept_and_returned(self):
        for kind in DOCUMENT_TYPES:
            body = self.upload(**{"document_type": kind}, description=f"A {kind}")
            self.assertEqual(body["document"]["documentType"], kind)
            self.assertEqual(self.mine()[body["document"]["id"]]["documentType"], kind)

    def test_a_document_with_no_type_still_uploads(self):
        body = self.upload(description="No type chosen")
        self.assertIsNone(body["document"]["documentType"])
        self.assertEqual(self.mine()[body["document"]["id"]]["description"], "No type chosen")

    def test_a_type_that_is_not_on_the_list_is_refused_and_nothing_is_saved(self):
        before = len(self.mine())
        self.upload(expected=400, **{"document_type": "x-ray-of-my-cat"})
        self.assertEqual(len(self.mine()), before)

    def test_the_doctor_sees_the_type_on_the_same_document(self):
        body = self.upload(**{"document_type": "lab_report"}, description="Blood test")
        doc_id = body["document"]["id"]
        seen = self.call("GET", f"/api/v2/doctor/documents/{doc_id}", "doctor")
        self.assertEqual(seen["documentType"], "lab_report")
        listed = {d["id"]: d for d in self.call("GET", "/api/v2/doctor/documents", "doctor")}
        self.assertEqual(listed[doc_id]["documentType"], "lab_report")

    def test_one_patient_cannot_see_the_type_of_anothers_document(self):
        body = self.upload(**{"document_type": "scan"})
        others = {d["id"] for d in self.call("GET", DOCS, "other_patient")}
        self.assertNotIn(body["document"]["id"], others)

    # ---------------------------------------------------------------- the demo records
    def test_the_demo_records_have_plain_titles_and_types(self):
        titles = {d["filename"]: d for d in self.mine().values() if d["filename"].startswith(("LAB-", "RAD-", "MSG-", "EHR-CN-"))}
        self.assertTrue(titles, "the demo records are there")
        ogtt = titles["LAB-OGTT-8812"]
        self.assertIn("Oral Glucose Tolerance", ogtt["description"])
        self.assertEqual(ogtt["documentType"], "lab_report")
        self.assertEqual(titles["RAD-US-2026-0702"]["documentType"], "scan")
        self.assertEqual(titles["MSG-9921"]["documentType"], "other")
        for record in titles.values():
            self.assertTrue(record["description"] and record["documentType"], record["filename"])

    def test_labelling_only_fills_what_is_empty_and_never_touches_an_uploaded_file(self):
        mine = self.upload(**{"document_type": "other"}, description="My own words")
        mine_id = mine["document"]["id"]
        with SessionLocal() as db:
            demo = db.query(models.MedicalDocument).filter_by(filename="LAB-OGTT-8812").first()
            demo_id, title = demo.id, demo.description
            demo.description, demo.document_type = None, None  # as it was in a database seeded before types existed
            uploaded_blank = models.MedicalDocument(episode_id=demo.episode_id, uploaded_by_user_id=demo.uploaded_by_user_id, uploaded_by_role="patient",
                                                    filename="a-real-upload.pdf", file_path="abc123.pdf", status="NEEDS_REVIEW")
            db.add(uploaded_blank)
            db.commit()
            self.made.append(uploaded_blank.id)
        with SessionLocal() as db:
            ensure_document_labels(db)
        with SessionLocal() as db:
            demo = db.get(models.MedicalDocument, demo_id)
            self.assertEqual(demo.description, title)  # taken from the record's own title
            self.assertEqual(demo.document_type, "lab_report")
            real = db.query(models.MedicalDocument).filter_by(filename="a-real-upload.pdf").first()
            self.assertIsNone(real.description)  # something someone uploaded is left exactly as it was
            self.assertIsNone(real.document_type)
            self.assertEqual(db.get(models.MedicalDocument, mine_id).description, "My own words")
            self.assertEqual(db.get(models.MedicalDocument, mine_id).document_type, "other")
        with SessionLocal() as db:  # running it again changes nothing
            ensure_document_labels(db)
            self.assertEqual(db.get(models.MedicalDocument, demo_id).description, title)


if __name__ == "__main__":
    unittest.main()
