"""The doctor's search box: her own patients' names, record numbers and phones; the questions on her own list; the documents of her patients.
Same isolated synthetic database as the other tests; every row a test adds is removed again."""
import json
import logging
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

import testenv  # noqa: F401: sets the isolated database and settings before the app is imported

from backend.app import models
from backend.app.database import SessionLocal
from backend.app.routers import doctor_search
from backend.app.seed_role_data import PASSWORDS

from test_assistant_caregiver import Base

URL = "/api/v2/doctor/search"
ROOT = Path(__file__).resolve().parents[2]


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class DoctorSearchTests(Base):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        with SessionLocal() as db:
            mine = {row[0] for row in db.query(models.PatientDoctorAssignment.episode_id).filter_by(doctor_user_id=cls.doctor_id).all()}
            # An episode that belongs to a different doctor, and that doctor's own login.
            other = (db.query(models.PatientDoctorAssignment).filter(models.PatientDoctorAssignment.episode_id.notin_(mine)).first())
            cls.other_ep, other_doctor_id = other.episode_id, other.doctor_user_id
            cls.other_email = db.get(models.User, other_doctor_id).email
            cls.other_name = db.get(models.PregnancyEpisode, cls.other_ep).patient_name
            cls.mine = mine
        response = cls.client.post("/api/auth/login", json={"email": cls.other_email, "password": PASSWORDS[cls.other_email]})
        assert response.status_code == 200, response.text
        cls.headers["rival"] = {"Authorization": "Bearer " + response.json()["accessToken"]}

    def setUp(self):
        self.made = {"questions": [], "documents": []}

    def tearDown(self):
        with SessionLocal() as db:
            for question_id in reversed(self.made["questions"]):
                question = db.get(models.PatientQuestion, question_id)
                if question is not None:
                    db.delete(question)
            db.flush()
            for document_id in self.made["documents"]:
                document = db.get(models.MedicalDocument, document_id)
                if document is not None:
                    db.delete(document)
            db.commit()

    # ---------------------------------------------------------------- data helpers
    def question(self, text, *, episode=None, doctor_id=None, status="NEW", closed_how=None, follow_up_of=None, age_minutes=0):
        with SessionLocal() as db:
            row = models.PatientQuestion(episode_id=episode or self.ep, asked_by_user_id=self.sarah_id, question_text=text, status=status,
                                         assigned_to_user_id=doctor_id or self.doctor_id, closed_how=closed_how, follow_up_of_id=follow_up_of,
                                         created_at=utc_now() - timedelta(minutes=age_minutes))
            db.add(row)
            db.commit()
            self.made["questions"].append(row.id)
            return row.id

    def document(self, filename, *, episode=None, description=None, kind=None, date=None):
        with SessionLocal() as db:
            row = models.MedicalDocument(episode_id=episode or self.ep, uploaded_by_user_id=self.sarah_id, uploaded_by_role="patient", filename=filename,
                                         file_path="", description=description, document_type=kind, document_date=date, status="NEEDS_REVIEW")
            db.add(row)
            db.commit()
            self.made["documents"].append(row.id)
            return row.id

    def find(self, query, who="doctor", **params):
        return self.call("GET", URL, who, params={"q": query, **params})

    def labels(self, result, group):
        return [item["label"] for item in result[group]["items"]]

    # ---------------------------------------------------------------- who may search
    def test_only_a_doctor_may_search_and_a_login_is_needed(self):
        for who in ("patient", "staff", "ravi"):
            self.call("GET", URL, who, params={"q": "Sarah"}, expected=403)
            self.call("POST", URL, who, {"q": "Sarah"}, expected=403)
        self.assertEqual(self.client.get(URL, params={"q": "Sarah"}).status_code, 401)
        self.assertEqual(self.client.post(URL, json={"q": "Sarah"}).status_code, 401)

    # ---------------------------------------------------------------- the size of what is typed
    def test_short_empty_and_long_queries(self):
        for query in ("", "a", " a ", "  "):
            result = self.find(query)
            self.assertEqual([result[g]["total"] for g in ("patients", "questions", "documents")], [0, 0, 0], repr(query))
        self.call("GET", URL, "doctor", params={"q": "x" * 101}, expected=422)
        self.call("POST", URL, "doctor", {"q": "x" * 101}, expected=422)
        self.assertEqual(self.find("x" * 100)["patients"]["total"], 0)  # the longest allowed is simply not found
        for limit in (0, 51):
            self.call("GET", URL, "doctor", params={"q": "Sarah", "limit": limit}, expected=422)
            self.call("POST", URL, "doctor", {"q": "Sarah", "limit": limit}, expected=422)

    # ---------------------------------------------------------------- patients
    def test_patients_by_name_record_number_and_phone(self):
        by_name = self.find("sarah jen")
        self.assertEqual(self.labels(by_name, "patients"), [self.patient_name])
        item = by_name["patients"]["items"][0]
        self.assertEqual(item["link"], f"/doctor/patients/{self.ep}")
        self.assertEqual(item["matchedOn"], "name")
        self.assertEqual(self.labels(self.find("SARAH"), "patients"), [self.patient_name])  # capital letters do not matter

        by_number = self.find(self.mrn[:-1] if len(self.mrn) > 3 else self.mrn)
        mine = [i for i in by_number["patients"]["items"] if i["id"] == self.ep]
        self.assertTrue(mine and mine[0]["matchedOn"] == "mrn" and mine[0]["detail"] == self.mrn, by_number["patients"])

        with SessionLocal() as db:
            profile = db.query(models.PatientProfile).filter_by(user_id=self.sarah_id).first()
            before = profile.phone
            profile.phone = "+91 98765 43210"
            db.commit()
        try:
            for fragment in ("98765", "9876543210", "+91 98765", "543-210"):
                found = self.find(fragment)
                hit = [i for i in found["patients"]["items"] if i["id"] == self.ep]
                self.assertTrue(hit and hit[0]["matchedOn"] == "phone", fragment)
            self.assertEqual([i for i in self.find("98")["patients"]["items"] if i["id"] == self.ep], [])  # two digits are too few to be a phone fragment
        finally:
            with SessionLocal() as db:
                db.query(models.PatientProfile).filter_by(user_id=self.sarah_id).first().phone = before
                db.commit()

    # ---------------------------------------------------------------- questions
    def test_questions_are_found_by_text_and_by_the_patients_name(self):
        waiting = self.question("Zqprobe when should I stop the iron tablets?")
        handled = self.question("Zqprobe can my mother come to the scan?", status="CLOSED", closed_how="phone_or_clinic")
        answered = self.question("Zqprobe is the clinic open on Sunday?", status="ANSWERED")
        result = self.find("zqprobe")
        states = {item["id"]: item["state"] for item in result["questions"]["items"]}
        self.assertEqual(states, {waiting: "needs_reply", handled: "handled", answered: "answered"})
        for item in result["questions"]["items"]:
            self.assertEqual(item["matchedOn"], "text")
            self.assertEqual(item["patientName"], self.patient_name)
            self.assertEqual(item["link"], f"/doctor/questions?question={item['id']}")
            self.assertTrue(item["date"].endswith("+00:00") and item["label"].startswith("Zqprobe"))
        by_patient = self.find("jenkins", limit=50)["questions"]["items"]
        self.assertEqual({i["matchedOn"] for i in by_patient if i["id"] == waiting}, {"patient"})  # her name finds her questions

    def test_a_follow_up_is_found_through_the_question_it_follows(self):
        first = self.question("Zqfollow what is the best way to travel?", status="ANSWERED")
        second = self.question("I still have a question about that", follow_up_of=first)
        hits = {i["id"]: i["matchedOn"] for i in self.find("zqfollow")["questions"]["items"]}
        self.assertEqual(hits, {first: "text", second: "earlier"})

    def test_only_the_questions_on_her_own_list(self):
        mine = self.question("Zqown a question for me")
        not_mine = self.question("Zqown a question that nobody picked up", doctor_id=None)
        with SessionLocal() as db:
            db.get(models.PatientQuestion, not_mine).assigned_to_user_id = None
            db.commit()
        self.assertEqual({i["id"] for i in self.find("zqown")["questions"]["items"]}, {mine})

    def test_a_label_never_carries_more_than_120_characters(self):
        long_text = ("Zqlong " + "word " * 80).strip()
        self.question(long_text)
        result = self.find("zqlong")
        label = result["questions"]["items"][0]["label"]
        self.assertLessEqual(len(label), 120)
        self.assertTrue(label.endswith("…"))
        self.assertNotIn(long_text, json.dumps(result, ensure_ascii=False))
        self.assertNotIn("word " * 40, json.dumps(result, ensure_ascii=False))  # no longer stretch of it anywhere in the answer

    # ---------------------------------------------------------------- documents
    def test_documents_with_and_without_a_description(self):
        bare = self.document("ZQDOC-7731")
        described = self.document("ZQFILE-1.pdf", description="Zqdoc glucose result", kind="lab_report", date="2026-10-01")
        typed = self.document("ZQFILE-2.pdf", kind="scan", date="2026-09-12")
        by_title = {i["id"]: i for i in self.find("zqdoc")["documents"]["items"]}
        self.assertEqual(set(by_title), {bare, described})
        self.assertEqual(by_title[bare]["label"], "ZQDOC-7731")  # nothing better than the file's name: that is the label
        self.assertEqual(by_title[described]["label"], "Zqdoc glucose result")
        self.assertEqual(by_title[described]["link"], f"/doctor/patients/{self.ep}?tab=documents")
        self.assertEqual(by_title[described]["documentType"], "lab_report")
        by_file = {i["id"]: i for i in self.find("zqfile")["documents"]["items"]}
        self.assertEqual(by_file[typed]["label"], "Scan or ultrasound · 2026-09-12")  # the kind and date, as her own page names it
        self.assertEqual(by_file[typed]["matchedOn"], "filename")
        self.assertEqual(by_file[typed]["detail"], "ZQFILE-2.pdf")
        self.assertEqual(by_file[described]["detail"], "ZQFILE-1.pdf")  # a match on the file name says so when the label is something else

    def test_a_document_is_found_by_its_kind_in_any_of_the_four_languages(self):
        record = self.document("ZQKIND-1", kind="lab_report")
        for word in ("lab report", "लैब", "ஆய்வக", "ల్యాబ్"):
            self.assertIn(record, {i["id"] for i in self.find(word, limit=50)["documents"]["items"]}, word)

    # ---------------------------------------------------------------- how what is typed is compared
    def test_accents_and_capitals_do_not_matter_but_other_scripts_are_kept_exact(self):
        cafe = self.question("Zqacc Café résumé before the visit?")
        tamil = self.question("Zqtamil வணக்கம் மருத்துவரே")
        for query in ("cafe resume", "CAFÉ RÉSUMÉ", "café"):
            self.assertIn(cafe, {i["id"] for i in self.find(query)["questions"]["items"]}, query)
        self.assertIn(tamil, {i["id"] for i in self.find("மருத்துவரே")["questions"]["items"]})
        self.assertIn(tamil, {i["id"] for i in self.find("வணக்")["questions"]["items"]})
        self.assertNotIn(tamil, {i["id"] for i in self.find("வணக்கமா")["questions"]["items"]})  # a different vowel sign is a different word

    def test_percent_and_underscore_are_ordinary_characters(self):
        special = self.question("Zqwild is 100% sure_x right?")
        plain = self.question("Zqwild plain words only")
        self.assertEqual({i["id"] for i in self.find("100%")["questions"]["items"]}, {special})
        self.assertEqual({i["id"] for i in self.find("sure_x")["questions"]["items"]}, {special})
        self.assertEqual(self.find("%%")["questions"]["total"], 0)  # as a wildcard this would match everything
        self.assertEqual(self.find("__")["questions"]["total"], 0)
        self.assertNotIn(plain, {i["id"] for i in self.find("0% s")["questions"]["items"]})
        self.assertEqual(self.find(".*")["patients"]["total"], 0)  # not a pattern either
        self.assertEqual(self.find("(Sarah")["patients"]["total"], 0)

    def test_totals_and_the_number_shown(self):
        ids = [self.question(f"Zqmany number {n}", age_minutes=n) for n in range(7)]
        default = self.find("zqmany")["questions"]
        self.assertEqual(default["total"], 7)
        self.assertEqual(len(default["items"]), 5)
        self.assertEqual([i["id"] for i in default["items"]], ids[:5])  # newest first
        everything = self.find("zqmany", limit=50)["questions"]
        self.assertEqual([i["id"] for i in everything["items"]], ids)
        self.assertEqual(len(self.find("zqmany", limit=2)["questions"]["items"]), 2)

    def test_the_post_form_the_screens_use_gives_the_same_answer(self):
        self.question("Zqpost same either way")
        self.assertEqual(self.call("POST", URL, "doctor", {"q": "zqpost"}), self.find("zqpost"))
        self.assertEqual(self.call("POST", URL, "doctor", {"q": "zqpost", "limit": 1})["questions"]["total"], 1)

    # ---------------------------------------------------------------- her patients only
    def test_a_doctor_never_sees_another_doctors_patient_in_any_group(self):
        marker = "Zqother"
        foreign_question = self.question(f"{marker} a question from another doctor's patient", episode=self.other_ep, doctor_id=self.doctor_id)
        # (a question row pointing at her user but at someone else's patient must still not show: the patient is not hers)
        foreign_document = self.document(f"{marker}-file.pdf", episode=self.other_ep, description=f"{marker} report")
        own_question = self.question(f"{marker} mine")
        mine = self.find(marker, limit=50)
        self.assertEqual({i["id"] for i in mine["questions"]["items"]}, {own_question})
        self.assertEqual(mine["documents"]["total"], 0)
        self.assertEqual([i for i in self.find(self.other_name.split()[0], limit=50)["patients"]["items"] if i["id"] == self.other_ep], [])
        self.assertEqual(self.find(self.other_name)["patients"]["total"] if self.other_ep not in self.mine else 0, 0)
        theirs = self.find(marker, who="rival", limit=50)
        self.assertEqual({i["id"] for i in theirs["documents"]["items"]}, {foreign_document})
        self.assertEqual([i["id"] for i in theirs["patients"]["items"] if i["id"] == self.other_ep], [])  # (the name is not in the marker)
        self.assertEqual(self.find(self.other_name, who="rival")["patients"]["items"][0]["id"], self.other_ep)
        self.assertNotIn(foreign_question, {i["id"] for i in theirs["questions"]["items"]})  # on nobody's list: the row is assigned to the first doctor

    # ---------------------------------------------------------------- what is kept
    def test_nothing_is_written_to_the_audit_log_and_the_access_log_line_hides_the_query(self):
        with SessionLocal() as db:
            before = db.query(models.AuditLog).count()
        self.find("Sarah Jenkins")
        self.call("POST", URL, "doctor", {"q": "Sarah Jenkins"})
        with SessionLocal() as db:
            self.assertEqual(db.query(models.AuditLog).count(), before)
        record = logging.LogRecord("uvicorn.access", logging.INFO, __file__, 1, '%s - "%s %s HTTP/%s" %d', ("127.0.0.1:5", "GET", "/api/v2/doctor/search?q=Sarah%20Jenkins&limit=5", "1.1", 200), None)
        self.assertTrue(doctor_search._HideSearchQuery().filter(record))
        self.assertNotIn("Sarah", record.getMessage())
        self.assertIn("/api/v2/doctor/search?q=<hidden>", record.getMessage())
        other = logging.LogRecord("uvicorn.access", logging.INFO, __file__, 1, '%s - "%s %s HTTP/%s" %d', ("127.0.0.1:5", "GET", "/api/v2/doctor/questions", "1.1", 200), None)
        doctor_search._HideSearchQuery().filter(other)
        self.assertIn("/api/v2/doctor/questions", other.getMessage())

    def test_the_service_worker_never_keeps_an_api_answer(self):
        worker = (ROOT / "public" / "sw.js").read_text(encoding="utf-8")
        self.assertIn("url.pathname.startsWith('/api/')", worker)


if __name__ == "__main__":
    unittest.main()
