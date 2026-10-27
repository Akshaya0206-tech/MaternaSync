"""The fingerprint on a topic review ("changed since reviewed") and marking several topics at once. Same isolated synthetic database as the other tests."""
import unittest

import testenv  # noqa: F401: sets the isolated database and settings before the app is imported

from sqlalchemy import inspect, text

from backend.app import models
from backend.app.database import SessionLocal, engine
from backend.app.migrations import ADDITIVE_COLUMNS, run_additive_migrations

from test_assistant_caregiver import Base

PATIENT_VIEW = "/api/v2/patient/reference-reviews"
DOCTOR_VIEW = "/api/v2/doctor/reference-reviews"
HASH_A = "a" * 64
HASH_B = "0123456789abcdef" * 4


class FingerprintTests(Base):
    def setUp(self):
        # The audit log is shared by every test in this run: start each test with none of these rows so the counts below are this test's own.
        with SessionLocal() as db:
            db.query(models.AuditLog).filter(models.AuditLog.action.in_(["patient_topic_reviewed", "patient_topic_review_cleared"])).delete(synchronize_session=False)
            db.commit()

    def tearDown(self):
        with SessionLocal() as db:
            db.query(models.PatientTopicReview).delete()
            db.commit()

    def audit_rows(self, action, topic=None):
        with SessionLocal() as db:
            rows = db.query(models.AuditLog).filter_by(action=action).all()
            return [r for r in rows if topic is None or f"Topic: {topic}" in (r.details or "")]

    # ---------------------------------------------------------------- one topic with a fingerprint
    def test_the_fingerprint_is_stored_and_both_screens_can_read_it(self):
        marked = self.call("PUT", f"{DOCTOR_VIEW}/breastfeeding", "doctor", {"note": "Read it", "contentHash": HASH_A})
        self.assertEqual(marked["contentHash"], HASH_A)
        self.assertEqual(self.call("GET", PATIENT_VIEW, "patient")["breastfeeding"]["contentHash"], HASH_A)
        self.assertEqual(self.call("GET", DOCTOR_VIEW, "doctor")["breastfeeding"]["contentHash"], HASH_A)
        self.assertNotIn("note", self.call("GET", PATIENT_VIEW, "patient")["breastfeeding"])  # the private note still stays private

    def test_a_review_made_without_a_fingerprint_still_works_and_has_none(self):
        marked = self.call("PUT", f"{DOCTOR_VIEW}/newborn-care", "doctor", {})
        self.assertIsNone(marked["contentHash"])
        self.assertIsNone(self.call("GET", PATIENT_VIEW, "patient")["newborn-care"]["contentHash"])

    def test_marking_again_replaces_the_fingerprint_and_the_audit_log_keeps_both(self):
        self.call("PUT", f"{DOCTOR_VIEW}/newborn-care", "doctor", {"contentHash": HASH_A})
        self.call("PUT", f"{DOCTOR_VIEW}/newborn-care", "doctor", {"contentHash": HASH_B})
        self.assertEqual(self.call("GET", PATIENT_VIEW, "patient")["newborn-care"]["contentHash"], HASH_B)
        rows = sorted(self.audit_rows("patient_topic_reviewed", "newborn-care"), key=lambda r: r.timestamp)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0].new_state["contentHash"], HASH_A)
        self.assertEqual(rows[1].previous_state["contentHash"], HASH_A)
        self.assertEqual(rows[1].new_state["contentHash"], HASH_B)

    def test_a_fingerprint_must_look_like_one(self):
        for bad in ("short", "A" * 64, "g" * 64, "a" * 63, "a" * 65, ""):
            self.call("PUT", f"{DOCTOR_VIEW}/breastfeeding", "doctor", {"contentHash": bad}, expected=422)
        self.assertEqual(self.call("GET", PATIENT_VIEW, "patient"), {})

    # ---------------------------------------------------------------- several topics at once
    def test_several_topics_are_marked_together_each_with_its_own_audit_row(self):
        self.call("PUT", f"{DOCTOR_VIEW}/labour-and-birth", "doctor", {"note": "Keep this private note"})
        done = self.call("POST", DOCTOR_VIEW, "doctor", {"topics": [
            {"topicId": "breastfeeding", "contentHash": HASH_A}, {"topicId": "newborn-care", "contentHash": HASH_B}, {"topicId": "labour-and-birth", "contentHash": HASH_A}]})
        self.assertEqual(sorted(done["reviewed"]), ["breastfeeding", "labour-and-birth", "newborn-care"])
        mine = self.call("GET", DOCTOR_VIEW, "doctor")
        self.assertEqual(mine["breastfeeding"]["contentHash"], HASH_A)
        self.assertEqual(mine["newborn-care"]["contentHash"], HASH_B)
        self.assertEqual(mine["breastfeeding"]["note"], "")  # a new review starts with no note
        self.assertEqual(mine["labour-and-birth"]["note"], "Keep this private note")  # one that existed keeps its note
        self.assertEqual(mine["labour-and-birth"]["contentHash"], HASH_A)
        for topic in ("breastfeeding", "newborn-care", "labour-and-birth"):
            self.assertEqual(len(self.audit_rows("patient_topic_reviewed", topic)), 2 if topic == "labour-and-birth" else 1, topic)
        replaced = [r for r in self.audit_rows("patient_topic_reviewed", "labour-and-birth") if r.previous_state]
        self.assertEqual(len(replaced), 1)  # the bulk mark replaced the single mark, and says so
        self.assertEqual(replaced[0].previous_state["note"], "Keep this private note")
        self.assertEqual(replaced[0].new_state["note"], "Keep this private note")

    def test_a_topic_named_twice_is_marked_once(self):
        self.call("POST", DOCTOR_VIEW, "doctor", {"topics": [{"topicId": "breastfeeding", "contentHash": HASH_A}, {"topicId": "breastfeeding", "contentHash": HASH_B}]})
        self.assertEqual(len(self.audit_rows("patient_topic_reviewed", "breastfeeding")), 1)
        self.assertEqual(self.call("GET", PATIENT_VIEW, "patient")["breastfeeding"]["contentHash"], HASH_A)

    def test_one_bad_topic_refuses_the_whole_request(self):
        for topics in ([{"topicId": "breastfeeding"}, {"topicId": "NOT A TOPIC"}], [{"topicId": "breastfeeding", "contentHash": "nope"}], [], [{"topicId": "x"}]):
            result = self.client.post(DOCTOR_VIEW, headers=self.headers["doctor"], json={"topics": topics})
            self.assertIn(result.status_code, (400, 422), topics)
        self.assertEqual(self.call("GET", PATIENT_VIEW, "patient"), {})  # nothing was marked
        too_many = [{"topicId": f"topic-{n}"} for n in range(101)]
        self.assertEqual(self.client.post(DOCTOR_VIEW, headers=self.headers["doctor"], json={"topics": too_many}).status_code, 422)

    def test_only_a_doctor_can_mark_several_and_a_stranger_cannot_even_try(self):
        body = {"topics": [{"topicId": "breastfeeding", "contentHash": HASH_A}]}
        for who in ("patient", "ravi", "staff"):
            self.call("POST", DOCTOR_VIEW, who, body, expected=403)
        self.assertEqual(self.client.post(DOCTOR_VIEW, json=body).status_code, 401)
        self.assertEqual(self.call("GET", PATIENT_VIEW, "patient"), {})

    def test_a_review_can_still_be_cleared_after_a_bulk_mark(self):
        self.call("POST", DOCTOR_VIEW, "doctor", {"topics": [{"topicId": "breastfeeding", "contentHash": HASH_A}]})
        self.call("DELETE", f"{DOCTOR_VIEW}/breastfeeding", "doctor")
        self.assertEqual(self.call("GET", PATIENT_VIEW, "patient"), {})

    # ---------------------------------------------------------------- an older database
    def test_an_older_database_gets_the_new_column_at_start_up_and_old_reviews_have_no_fingerprint(self):
        self.assertIn(("content_hash", "VARCHAR"), ADDITIVE_COLUMNS["patient_topic_reviews"])
        with engine.begin() as connection:
            connection.execute(text("DROP TABLE IF EXISTS patient_topic_reviews"))
            connection.execute(text("CREATE TABLE patient_topic_reviews (topic_id VARCHAR PRIMARY KEY, reviewed_by_user_id VARCHAR NOT NULL, reviewed_at DATETIME NOT NULL, note TEXT)"))
            connection.execute(text("INSERT INTO patient_topic_reviews VALUES ('breastfeeding', :doctor, '2026-10-20 10:00:00', 'old')"), {"doctor": self.doctor_id})
        try:
            run_additive_migrations(engine)
            self.assertIn("content_hash", {c["name"] for c in inspect(engine).get_columns("patient_topic_reviews")})
            old = self.call("GET", PATIENT_VIEW, "patient")["breastfeeding"]
            self.assertIsNone(old["contentHash"])  # nothing to compare, so the screens keep showing it as reviewed
            self.assertEqual(old["reviewedAt"][:10], "2026-10-20")
        finally:
            with engine.begin() as connection:
                connection.execute(text("DROP TABLE IF EXISTS patient_topic_reviews"))
            models.PatientTopicReview.__table__.create(bind=engine, checkfirst=True)


if __name__ == "__main__":
    unittest.main()
