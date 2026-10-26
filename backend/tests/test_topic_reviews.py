"""The "Reviewed by your clinic" record for topics on the patient References page. Same isolated synthetic database as the other tests."""
import unittest

import testenv  # noqa: F401: sets the isolated database and settings before the app is imported

from backend.app import models
from backend.app.database import SessionLocal

from test_assistant_caregiver import Base

PATIENT_VIEW = "/api/v2/patient/reference-reviews"
DOCTOR_VIEW = "/api/v2/doctor/reference-reviews"


class TopicReviewTests(Base):
    def tearDown(self):
        with SessionLocal() as db:
            db.query(models.PatientTopicReview).delete()
            db.commit()

    def audit_rows(self, action):
        with SessionLocal() as db:
            return db.query(models.AuditLog).filter_by(action=action).all()

    def test_nothing_is_reviewed_until_a_doctor_says_so(self):
        self.assertEqual(self.call("GET", PATIENT_VIEW, "patient"), {})
        self.assertEqual(self.call("GET", DOCTOR_VIEW, "doctor"), {})

    def test_a_doctor_marks_a_topic_and_the_patient_sees_who_and_when(self):
        marked = self.call("PUT", f"{DOCTOR_VIEW}/breastfeeding", "doctor", {"note": "Read on the ward round"})
        self.assertEqual(marked["note"], "Read on the ward round")
        self.assertTrue(marked["reviewedAt"].endswith("+00:00"))
        mine = self.call("GET", PATIENT_VIEW, "patient")
        self.assertEqual(list(mine), ["breastfeeding"])
        self.assertEqual(mine["breastfeeding"]["reviewerName"], marked["reviewerName"])
        self.assertTrue(mine["breastfeeding"]["reviewerName"].strip())
        self.assertNotIn("note", mine["breastfeeding"])  # the doctor's note is not shown to patients
        self.assertEqual(self.call("GET", DOCTOR_VIEW, "doctor")["breastfeeding"]["note"], "Read on the ward round")
        # a trusted person's login can read it too (it holds nothing about any patient)
        self.assertIn("breastfeeding", self.call("GET", PATIENT_VIEW, "ravi"))

    def test_marking_again_replaces_the_review_and_both_are_in_the_audit_log(self):
        first = self.call("PUT", f"{DOCTOR_VIEW}/newborn-care", "doctor", {})
        second = self.call("PUT", f"{DOCTOR_VIEW}/newborn-care", "other_doctor", {"note": "Checked again"})
        self.assertEqual(self.call("GET", PATIENT_VIEW, "patient")["newborn-care"]["reviewerName"], second["reviewerName"])
        self.assertNotEqual(first["reviewerName"], second["reviewerName"])
        rows = [r for r in self.audit_rows("patient_topic_reviewed") if "newborn-care" in (r.details or "")]
        self.assertEqual(len(rows), 2)
        self.assertEqual(sorted(r.actor_role for r in rows), ["doctor", "doctor"])
        by_reviewer = {r.new_state["reviewerName"]: r for r in rows}
        self.assertIsNone(by_reviewer[first["reviewerName"]].previous_state)  # the first mark replaced nothing
        self.assertEqual(by_reviewer[second["reviewerName"]].previous_state["reviewerName"], first["reviewerName"])  # the second replaced the first

    def test_clearing_a_review_removes_the_line_and_is_logged(self):
        self.call("PUT", f"{DOCTOR_VIEW}/family-planning-after-birth", "doctor", {})
        self.call("DELETE", f"{DOCTOR_VIEW}/family-planning-after-birth", "doctor")
        self.assertEqual(self.call("GET", PATIENT_VIEW, "patient"), {})
        cleared = [r for r in self.audit_rows("patient_topic_review_cleared") if "family-planning-after-birth" in (r.details or "")]
        self.assertEqual(len(cleared), 1)
        self.assertIn("reviewedAt", cleared[0].previous_state)
        self.call("DELETE", f"{DOCTOR_VIEW}/family-planning-after-birth", "doctor", expected=404)

    def test_only_a_doctor_can_mark_or_clear(self):
        for who in ("patient", "ravi", "staff"):
            self.call("PUT", f"{DOCTOR_VIEW}/breastfeeding", who, {}, expected=403)
            self.call("DELETE", f"{DOCTOR_VIEW}/breastfeeding", who, expected=403)
            self.call("GET", DOCTOR_VIEW, who, expected=403)
        for method, path in (("GET", PATIENT_VIEW), ("GET", DOCTOR_VIEW), ("PUT", f"{DOCTOR_VIEW}/breastfeeding"), ("DELETE", f"{DOCTOR_VIEW}/breastfeeding")):
            self.assertEqual(self.client.request(method, path, json={} if method == "PUT" else None).status_code, 401, (method, path))
        self.assertEqual(self.call("GET", PATIENT_VIEW, "patient"), {})

    def test_a_topic_name_must_look_like_one_and_a_note_is_short(self):
        for bad in ("Breast%20feeding", "-start", "a", "x" * 70, "UPPER"):
            result = self.client.put(f"{DOCTOR_VIEW}/{bad}", headers=self.headers["doctor"], json={})
            self.assertIn(result.status_code, (400, 404), bad)
        self.call("PUT", f"{DOCTOR_VIEW}/breastfeeding", "doctor", {"note": "x" * 501}, expected=422)
        self.call("PUT", f"{DOCTOR_VIEW}/breastfeeding", "doctor", {"surprise": 1}, expected=422)
        self.assertEqual(self.call("GET", PATIENT_VIEW, "patient"), {})


if __name__ == "__main__":
    unittest.main()
