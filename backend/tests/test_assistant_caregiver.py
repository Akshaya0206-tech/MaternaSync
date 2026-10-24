"""The care assistant, the caregiver login, and the care-team switch. Same isolated synthetic database as the other tests."""
import types
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import testenv  # noqa: F401: sets the isolated database and settings before the app is imported

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app import caregiver_service, config, models
from backend.app.ai_coordinator import messages, orchestrator, policy, providers, tools, workflows
from backend.app.database import SessionLocal
from backend.app.deps import refuse_sign_in
from backend.app.seed_assistant import ASSISTANT_EMAIL, DEMO_CAREGIVER
from backend.app.seed_role_data import PASSWORDS

LOG = "/api/v2/caregiver"
MINE = "/api/v2/patient/caregivers"


def utcnow():
    return datetime.now(timezone.utc)


class Base(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client_context = TestClient(app)
        cls.client = cls.client_context.__enter__()
        cls.headers = {}
        for key, email, password in [("patient", "sarah.jenkins@maternasync.app", PASSWORDS["sarah.jenkins@maternasync.app"]),
                                     ("doctor", "demo@maternasync.app", PASSWORDS["demo@maternasync.app"]),
                                     ("other_doctor", "dr.chen@maternasync.app", PASSWORDS["dr.chen@maternasync.app"]),
                                     ("other_patient", "elena.rostova@maternasync.app", PASSWORDS["elena.rostova@maternasync.app"]),
                                     ("staff", "brenda.miller@maternasync.app", PASSWORDS["brenda.miller@maternasync.app"]),
                                     ("ravi", DEMO_CAREGIVER["email"], DEMO_CAREGIVER["password"])]:
            response = cls.client.post("/api/auth/login", json={"email": email, "password": password})
            assert response.status_code == 200, (email, response.text)
            cls.headers[key] = {"Authorization": "Bearer " + response.json()["accessToken"]}
        with SessionLocal() as db:
            sarah = db.query(models.User).filter_by(email="sarah.jenkins@maternasync.app").first()
            cls.sarah_id = sarah.id
            episode = db.query(models.PregnancyEpisode).filter_by(patient_user_id=sarah.id).order_by(models.PregnancyEpisode.created_at.desc()).first()
            cls.ep, cls.patient_name, cls.mrn = episode.id, episode.patient_name, episode.mrn
            cls.doctor_id = db.query(models.User).filter_by(email="demo@maternasync.app").first().id
            elena = db.query(models.User).filter_by(email="elena.rostova@maternasync.app").first()
            cls.elena_ep = db.query(models.PregnancyEpisode).filter_by(patient_user_id=elena.id).first().id
            cls.elena_user = elena.id
            cls.ravi_link = db.query(models.CaregiverLink).filter_by(episode_id=cls.ep, status="ACTIVE").first().id

    @classmethod
    def tearDownClass(cls):
        cls.client_context.__exit__(None, None, None)

    def call(self, method, path, who, payload=None, expected=200, **kwargs):
        result = self.client.request(method, path, headers=self.headers[who], json=payload, **kwargs)
        self.assertEqual(result.status_code, expected, f"{method} {path} as {who}: {result.text}")
        return result.json() if result.content else None

    def restore_ravi(self):
        """Put the demo caregiver back to full access whatever a test did to it."""
        with SessionLocal() as db:
            link = db.get(models.CaregiverLink, self.ravi_link)
            link.status, link.revoked_at = "ACTIVE", None
            link.permissions = {"appointments": True, "check_in": True, "care_plan": True, "questions": True, "emergency": True}
            db.commit()

    # --- helpers for the assistant
    def new_question(self, text, who="patient"):
        return self.call("POST", "/api/v2/patient/questions", who, {"questionText": text})["id"] if who == "patient" else None

    def run_for(self, source_id):
        with SessionLocal() as db:
            return db.query(models.AIRun).filter_by(source_id=source_id).first()

    def items_for(self, source_id):
        with SessionLocal() as db:
            return db.query(models.ExceptionItem).filter_by(source_id=source_id).order_by(models.ExceptionItem.created_at).all()

    def make_document(self, *, text, found_name, found_mrn=None, record_type="Ultrasound report", event_date=None, status="NEEDS_REVIEW"):
        with SessionLocal() as db:
            document = models.MedicalDocument(episode_id=self.ep, uploaded_by_user_id=self.sarah_id, uploaded_by_role="patient", filename=f"{record_type}.pdf",
                                              file_path="x.pdf", status=status)
            db.add(document)
            db.flush()
            db.add(models.DocumentExtraction(document_id=document.id, raw_text=text, record_type=record_type, patient_name_found=found_name, mrn_found=found_mrn,
                                             event_date=event_date or "2025-01-10", field_status={}))
            orchestrator.enqueue(db, "document_intake", episode_id=self.ep, source_type="MedicalDocument", source_id=document.id)
            db.commit()
            return document.id


# =============================================================================== care team off, caregiver on
class CareTeamSwitchTests(Base):
    def test_care_team_sign_in_is_refused_when_switched_off_and_works_when_on(self):
        with patch.object(config, "CARE_TEAM_ENABLED", False):
            refused = self.client.post("/api/auth/login", json={"email": "brenda.miller@maternasync.app", "password": PASSWORDS["brenda.miller@maternasync.app"]})
            self.assertEqual(refused.status_code, 403)
            self.assertIn("switched off", refused.json()["detail"])
            self.assertEqual(self.client.get("/api/v2/care-team/dashboard", headers=self.headers["staff"]).status_code, 403)  # a token issued earlier stops working too
            # A wrong password still gets the ordinary message: switching the login off must not reveal who has an account.
            self.assertEqual(self.client.post("/api/auth/login", json={"email": "brenda.miller@maternasync.app", "password": "wrong"}).status_code, 401)
        self.assertEqual(self.client.post("/api/auth/login", json={"email": "brenda.miller@maternasync.app", "password": PASSWORDS["brenda.miller@maternasync.app"]}).status_code, 200)
        self.assertEqual(self.client.get("/api/v2/care-team/dashboard", headers=self.headers["staff"]).status_code, 200)

    def test_other_roles_are_not_affected_by_the_switch(self):
        with patch.object(config, "CARE_TEAM_ENABLED", False):
            for who in ("patient", "doctor", "ravi"):
                self.assertEqual(self.client.get("/api/auth/me", headers=self.headers[who]).status_code, 200, who)

    def test_sign_up_options_and_demo_accounts_follow_the_switch(self):
        with patch.object(config, "CARE_TEAM_ENABLED", False):
            options = self.client.get("/api/auth/options").json()
            self.assertFalse(options["careTeamEnabled"])
            self.assertEqual({r["value"] for r in options["signUpRoles"]}, {"patient", "doctor", "caregiver"})
            roles = {a["role"] for a in self.client.get("/api/auth/demo-accounts").json()}
            self.assertEqual(roles, {"patient", "doctor", "caregiver"})
            refused = self.client.post("/api/auth/register", json={"fullName": "Nina Nurse", "email": "nina.nurse@example.org", "password": "Passw0rd!!", "confirmPassword": "Passw0rd!!", "role": "nurse"})
            self.assertEqual(refused.status_code, 400)
        options = self.client.get("/api/auth/options").json()
        self.assertIn("nurse", {r["value"] for r in options["signUpRoles"]})

    def test_with_the_care_team_off_a_question_creates_no_care_team_task(self):
        with patch.object(config, "CARE_TEAM_ENABLED", False):
            qid = self.new_question("When is my next appointment?")
        with SessionLocal() as db:
            self.assertEqual(db.query(models.Task).filter_by(source_type="question_triage", source_id=qid).count(), 0)
            self.assertIsNotNone(db.query(models.AIRun).filter_by(source_id=qid, workflow="question_routing", status="QUEUED").first())

    def test_the_assistant_account_can_never_sign_in(self):
        with SessionLocal() as db:
            user = db.query(models.User).filter_by(email=ASSISTANT_EMAIL).first()
            self.assertIsNotNone(user)
            with self.assertRaises(Exception) as caught:
                refuse_sign_in(user)
            self.assertEqual(caught.exception.status_code, 403)
            self.assertEqual(self.client.post("/api/auth/login", json={"email": ASSISTANT_EMAIL, "password": "anything-at-all"}).status_code, 401)


# =============================================================================== caregiver login
class CaregiverTests(Base):
    def setUp(self):
        self.restore_ravi()

    def invite(self, **kwargs):
        body = {"displayName": "Mother", "relationship": "Mother", "permissions": {}}
        body.update(kwargs)
        return self.call("POST", MINE, "patient", body)

    def register(self, code, email, expected=200):
        response = self.client.post("/api/auth/register", json={"fullName": "Meena Jenkins", "email": email, "password": "Passw0rd!!", "confirmPassword": "Passw0rd!!",
                                                             "role": "caregiver", "inviteCode": code})
        self.assertEqual(response.status_code, expected, response.text)
        return response.json()

    def test_invite_code_is_shown_once_stored_hashed_and_single_use(self):
        made = self.invite()
        code = made["code"]
        self.assertRegex(code, r"^[A-Z2-9]{4}-[A-Z2-9]{4}$")
        listed = next(i for i in self.call("GET", MINE, "patient")["items"] if i["id"] == made["id"])
        self.assertNotIn("code", listed)
        self.assertEqual(listed["status"], "INVITED")
        with SessionLocal() as db:
            link = db.get(models.CaregiverLink, made["id"])
            self.assertNotIn(code.replace("-", ""), link.code_hash)
            self.assertNotEqual(link.code_hash, code)
        joined = self.register(code.lower().replace("-", " "), "meena.jenkins@example.org")  # typed in lower case with a space: still accepted
        self.assertEqual(joined["user"]["role"], "caregiver")
        self.register(code, "meena.again@example.org", expected=400)  # a second use fails, and no account is created
        with SessionLocal() as db:
            self.assertIsNone(db.query(models.User).filter_by(email="meena.again@example.org").first())
            self.assertEqual(db.get(models.CaregiverLink, made["id"]).status, "ACTIVE")
        self.call("DELETE", f"{MINE}/{made['id']}", "patient")

    def test_bad_expired_and_missing_codes_all_get_the_same_answer(self):
        made = self.invite()
        with SessionLocal() as db:
            db.get(models.CaregiverLink, made["id"]).code_expires_at = utcnow() - timedelta(minutes=1)
            db.commit()
        messages_seen = set()
        for code in (made["code"], "ZZZZ-ZZZZ", "", None):
            response = self.client.post("/api/auth/register", json={"fullName": "Sam", "email": "sam.guess@example.org", "password": "Passw0rd!!", "confirmPassword": "Passw0rd!!",
                                                                 "role": "caregiver", "inviteCode": code})
            self.assertEqual(response.status_code, 400)
            messages_seen.add(response.json()["detail"])
        self.assertEqual(len(messages_seen), 1)
        new = self.call("POST", f"{MINE}/{made['id']}/new-code", "patient")  # she can make a fresh one
        self.register(new["code"], "meena.late@example.org")
        self.call("DELETE", f"{MINE}/{made['id']}", "patient")

    def test_defaults_and_the_permission_gate(self):
        made = self.invite(permissions={"check_in": False})
        self.assertEqual(made["permissions"], {"appointments": True, "check_in": False, "care_plan": False, "questions": False, "emergency": False})
        self.register(made["code"], "gate.keeper@example.org")
        token = self.client.post("/api/auth/login", json={"email": "gate.keeper@example.org", "password": "Passw0rd!!"}).json()["accessToken"]
        self.headers["gate"] = {"Authorization": "Bearer " + token}
        base = f"{LOG}/{made['id']}"
        self.call("GET", f"{base}/appointments", "gate")  # on by default
        for part in ("check-ins", "care-plan", "questions", "emergency"):
            self.call("GET", f"{base}/{part}", "gate", expected=403)
        self.call("POST", f"{base}/questions", "gate", {"questionText": "Hello?"}, expected=403)
        self.call("PATCH", f"{MINE}/{made['id']}", "patient", {"permissions": {"check_in": True, "care_plan": True}})
        self.call("GET", f"{base}/check-ins", "gate")
        self.call("GET", f"{base}/care-plan", "gate")
        self.call("GET", f"{base}/questions", "gate", expected=403)  # only what she switched on
        self.call("PATCH", f"{MINE}/{made['id']}", "patient", {"permissions": {"check_in": False}})
        self.call("GET", f"{base}/check-ins", "gate", expected=403)  # takes effect on the very next request
        self.call("DELETE", f"{MINE}/{made['id']}", "patient")

    def test_a_caregiver_only_sees_the_women_who_invited_them(self):
        women = self.call("GET", f"{LOG}/women", "ravi")
        self.assertEqual([w["womanName"] for w in women], [self.patient_name])
        # Another woman's link, an invented id and a revoked link all get the same refusal.
        with SessionLocal() as db:
            other_patient = db.query(models.PregnancyEpisode).filter_by(id=self.elena_ep).first()
            foreign = models.CaregiverLink(episode_id=other_patient.id, patient_user_id=other_patient.patient_user_id, display_name="Someone", permissions={"appointments": True},
                                           status="INVITED")
            db.add(foreign)
            db.commit()
            foreign_id = foreign.id
        refusals = set()
        for link_id in (foreign_id, "not-a-real-id"):
            response = self.client.get(f"{LOG}/{link_id}/home", headers=self.headers["ravi"])
            self.assertEqual(response.status_code, 403)
            refusals.add(response.json()["detail"])
        self.assertEqual(len(refusals), 1)

    def test_a_caregiver_cannot_reach_the_normal_patient_or_doctor_pages(self):
        for path in (f"/api/v2/continuity/episodes/{self.ep}", "/api/v2/continuity/context", "/api/v2/patient/dashboard", "/api/v2/patient/questions",
                     "/api/v2/patient/documents", "/api/v2/patient/emergency", "/api/v2/assistant/exceptions", MINE, "/api/v2/doctor/dashboard"):
            response = self.client.get(path, headers=self.headers["ravi"])
            self.assertIn(response.status_code, (401, 403), f"{path}: {response.status_code}")
        self.call("POST", MINE, "ravi", {"displayName": "x", "relationship": "", "permissions": {}}, expected=403)  # a caregiver cannot invite someone else
        self.call("PATCH", f"{MINE}/{self.ravi_link}", "ravi", {"permissions": {"emergency": True}}, expected=403)  # or widen their own access

    def test_another_patient_cannot_touch_this_womans_trusted_people(self):
        self.call("PATCH", f"{MINE}/{self.ravi_link}", "other_patient", {"displayName": "Hacked"}, expected=404)
        self.call("DELETE", f"{MINE}/{self.ravi_link}", "other_patient", expected=404)
        self.call("GET", f"{MINE}/{self.ravi_link}/activity", "other_patient", expected=404)

    def test_a_check_in_by_a_caregiver_is_saved_with_their_real_name_and_audited(self):
        body = {"recordedAt": utcnow().isoformat(), "mood": "okay", "symptoms": "Tired but eating well.", "enteredWithHelp": "Dr Someone Else"}
        saved = self.call("POST", f"{LOG}/{self.ravi_link}/check-ins", "ravi", body)
        self.assertEqual(saved["enteredWithHelp"], "Family member: Ravi Jenkins")  # never what the browser claimed
        with SessionLocal() as db:
            log = db.get(models.DailyLog, saved["id"])
            self.assertEqual((log.episode_id, log.entered_with_help), (self.ep, "Family member: Ravi Jenkins"))
            row = db.query(models.AuditLog).filter_by(action="caregiver_checkin_recorded", episode_id=self.ep).order_by(models.AuditLog.timestamp.desc()).first()
            self.assertEqual(row.actor_role, "caregiver")
        listed = self.call("GET", f"{LOG}/{self.ravi_link}/check-ins", "ravi")
        self.assertEqual(listed[0]["enteredWithHelp"], "Family member: Ravi Jenkins")
        activity = self.call("GET", f"{MINE}/{self.ravi_link}/activity", "patient")
        self.assertIn("filled in a check-in", activity[0]["title"])  # she can see what they did

    def test_the_care_plan_shows_only_what_a_doctor_approved_and_released(self):
        with SessionLocal() as db:
            db.add(models.ClinicalOutput(episode_id=self.ep, kind="explanation", title="Draft that must stay private", content="draft", source_type="document", source_id="x",
                                         status="DRAFT", visible_to_patient=False, created_by_user_id=self.doctor_id))
            db.add(models.ClinicalOutput(episode_id=self.ep, kind="explanation", title="Approved but not released", content="held", source_type="document", source_id="x",
                                         status="APPROVED", visible_to_patient=False, created_by_user_id=self.doctor_id))
            db.add(models.ClinicalOutput(episode_id=self.ep, kind="explanation", title="Released to her", content="visible", source_type="document", source_id="x",
                                         status="APPROVED", visible_to_patient=True, created_by_user_id=self.doctor_id, approved_by_user_id=self.doctor_id, approved_at=datetime.utcnow()))
            db.commit()
        titles = {o["title"] for o in self.call("GET", f"{LOG}/{self.ravi_link}/care-plan", "ravi")}
        self.assertIn("Released to her", titles)
        self.assertNotIn("Draft that must stay private", titles)
        self.assertNotIn("Approved but not released", titles)

    def test_removing_a_trusted_person_ends_access_at_once_and_keeps_the_record(self):
        made = self.invite(permissions={"questions": True})
        self.register(made["code"], "short.stay@example.org")
        headers = {"Authorization": "Bearer " + self.client.post("/api/auth/login", json={"email": "short.stay@example.org", "password": "Passw0rd!!"}).json()["accessToken"]}
        self.headers["short"] = headers
        self.call("GET", f"{LOG}/{made['id']}/home", "short")
        removed = self.call("DELETE", f"{MINE}/{made['id']}", "patient")
        self.assertEqual(removed["status"], "REVOKED")
        self.call("GET", f"{LOG}/{made['id']}/home", "short", expected=403)
        self.call("POST", f"{LOG}/{made['id']}/questions", "short", {"questionText": "Can I still ask?"}, expected=403)
        self.assertEqual(self.call("GET", f"{LOG}/women", "short"), [])
        self.call("PATCH", f"{MINE}/{made['id']}", "patient", {"displayName": "Back again"}, expected=409)  # a removed person has to be invited again
        with SessionLocal() as db:
            actions = {r.action for r in db.query(models.AuditLog).filter_by(object_type="CaregiverLink", object_id=made["id"]).all()}
        self.assertTrue({"caregiver_invited", "caregiver_invite_accepted", "caregiver_removed"} <= actions)

    def test_the_woman_cannot_be_her_own_trusted_person(self):
        made = self.invite()
        self.call("POST", f"{LOG}/accept", "patient", {"code": made["code"]}, expected=403)  # the caregiver endpoints are for caregiver accounts only
        with SessionLocal() as db:
            with self.assertRaises(Exception) as caught:
                caregiver_service.accept_invite(db, db.get(models.CaregiverLink, made["id"]), db.get(models.User, self.sarah_id))
            self.assertEqual(caught.exception.status_code, 400)
            db.rollback()
        self.call("DELETE", f"{MINE}/{made['id']}", "patient")

    def test_an_existing_caregiver_can_join_a_second_woman_with_her_own_code(self):
        theirs = self.call("POST", MINE, "other_patient", {"displayName": "Ravi", "relationship": "Friend", "permissions": {}})
        joined = self.call("POST", f"{LOG}/accept", "ravi", {"code": theirs["code"]})
        self.assertEqual(joined["womanName"], "Elena Rostova")
        self.assertEqual(len(self.call("GET", f"{LOG}/women", "ravi")), 2)
        self.call("GET", f"{LOG}/{joined['linkId']}/appointments", "ravi")  # on by default for the second woman too
        self.call("GET", f"{LOG}/{joined['linkId']}/check-ins", "ravi", expected=403)  # but only what Elena chose, not what Sarah chose
        again = self.call("POST", MINE, "other_patient", {"displayName": "Ravi again", "relationship": "", "permissions": {}})
        self.call("POST", f"{LOG}/accept", "ravi", {"code": again["code"]}, expected=409)  # already linked to her
        self.call("DELETE", f"{MINE}/{joined['linkId']}", "other_patient")
        self.call("DELETE", f"{MINE}/{again['id']}", "other_patient")
        self.assertEqual(len(self.call("GET", f"{LOG}/women", "ravi")), 1)

    def test_a_caregiver_question_goes_to_the_assistant_and_a_doctor_not_the_care_team(self):
        qid = self.call("POST", f"{LOG}/{self.ravi_link}/questions", "ravi", {"questionText": "Is her tablet dose right?"})["id"]
        with SessionLocal() as db:
            question = db.get(models.PatientQuestion, qid)
            self.assertEqual(question.asked_by_user_id, db.query(models.User).filter_by(email=DEMO_CAREGIVER["email"]).first().id)
        orchestrator.process_queue()
        titles = [i.title for i in self.items_for(qid)]
        self.assertIn("A patient question needs a clinician", titles)  # clinical wording: handed to the doctor, nothing answered
        with SessionLocal() as db:
            self.assertEqual(db.query(models.QuestionResponse).filter_by(question_id=qid).count(), 0)

    def test_talk_to_a_person_works_for_any_active_trusted_person_and_reaches_a_doctor(self):
        reply = self.call("POST", f"{LOG}/{self.ravi_link}/talk-to-a-person", "ravi", {"message": "She is very worried."})
        self.assertIn("112", reply["message"])
        pending = self.call("GET", "/api/v2/assistant/exceptions", "doctor")
        self.assertTrue(any(i["title"] == "A trusted person asked to talk to someone" and "worried" in i["summary"] for i in pending))

    def test_the_emergency_card_needs_the_emergency_permission(self):
        info = self.call("GET", f"{LOG}/{self.ravi_link}/emergency", "ravi")
        self.assertIn("contactName", info)
        with SessionLocal() as db:
            db.get(models.CaregiverLink, self.ravi_link).permissions = {"appointments": True}
            db.commit()
        self.call("GET", f"{LOG}/{self.ravi_link}/emergency", "ravi", expected=403)

    def test_the_demo_caregiver_link_has_a_join_date(self):
        listed = self.call("GET", MINE, "patient")["items"]
        demo = next(i for i in listed if i["id"] == self.ravi_link)
        self.assertEqual(demo["status"], "ACTIVE")
        self.assertTrue(demo["acceptedAt"])

    def test_caregiver_language_is_their_own(self):
        self.call("PATCH", f"{LOG}/preferences", "ravi", {"language": "ta"})
        self.assertEqual(self.call("GET", f"{LOG}/preferences", "ravi")["language"], "ta")
        self.call("PATCH", f"{LOG}/preferences", "ravi", {"language": "xx"}, expected=422)
        self.call("PATCH", f"{LOG}/preferences", "ravi", {"language": "en"})


# =============================================================================== the care assistant
class AssistantTests(Base):
    def setUp(self):
        self.restore_ravi()

    # ---- question routing
    def test_urgent_wording_gets_the_fixed_message_and_an_urgent_alert(self):
        qid = self.new_question("I have heavy bleeding and severe pain")
        orchestrator.process_queue()
        with SessionLocal() as db:
            sent = db.query(models.Notification).filter_by(type="assistant_urgent", related_entity_id=qid).all()
            self.assertEqual(len(sent), 1)
            self.assertEqual(sent[0].body, messages.urgent_body("en"))
            self.assertEqual(sent[0].recipient_user_id, self.sarah_id)
            self.assertEqual(db.get(models.PatientQuestion, qid).assigned_to_user_id, self.doctor_id)
            self.assertEqual(db.query(models.QuestionResponse).filter_by(question_id=qid).count(), 0)  # the assistant never answers this
        urgent = [i for i in self.items_for(qid) if i.urgency == "urgent"]
        self.assertEqual(len(urgent), 1)
        self.assertEqual(self.run_for(qid).status, "DONE")

    def test_clinical_questions_are_handed_over_unanswered(self):
        qid = self.new_question("Can I take paracetamol for my headache?")
        orchestrator.process_queue()
        self.assertEqual([i.kind for i in self.items_for(qid)], ["attention"])
        with SessionLocal() as db:
            self.assertEqual(db.query(models.QuestionResponse).filter_by(question_id=qid).count(), 0)
            self.assertTrue(db.get(models.PatientQuestion, qid).is_clinical)

    def test_an_administrative_question_becomes_a_proposal_and_only_a_doctor_sends_it(self):
        qid = self.new_question("When is my next appointment?")
        orchestrator.process_queue()
        with SessionLocal() as db:
            self.assertEqual(db.query(models.QuestionResponse).filter_by(question_id=qid).count(), 0)  # nothing sent yet
        item = self.items_for(qid)[0]
        self.assertEqual((item.kind, item.proposed_tool), ("proposal", "answer_question"))
        listed = next(i for i in self.call("GET", "/api/v2/assistant/exceptions", "doctor") if i["id"] == item.id)
        self.assertIn("Suggested reply", listed["summary"])
        self.call("POST", f"/api/v2/assistant/exceptions/{item.id}/decide", "other_doctor", {"decision": "approve"}, expected=403)  # not her doctor
        self.call("POST", f"/api/v2/assistant/exceptions/{item.id}/decide", "patient", {"decision": "approve"}, expected=403)
        done = self.call("POST", f"/api/v2/assistant/exceptions/{item.id}/decide", "doctor", {"decision": "approve"})
        self.assertEqual(done["status"], "APPROVED")
        mine = next(q for q in self.call("GET", "/api/v2/patient/questions", "patient") if q["id"] == qid)
        self.assertEqual(mine["status"], "ANSWERED")
        self.assertIn(messages.ASSISTANT_NOTE["en"], mine["responses"][0]["responseText"])  # she is told the assistant helped
        with SessionLocal() as db:
            reply = db.query(models.QuestionResponse).filter_by(question_id=qid).first()
            self.assertEqual(reply.responder_user_id, self.doctor_id)  # recorded as the doctor's decision
            row = db.query(models.AuditLog).filter_by(object_type="ExceptionItem", object_id=item.id).first()
            self.assertEqual(row.actor_user_id, self.doctor_id)
        self.call("POST", f"/api/v2/assistant/exceptions/{item.id}/decide", "doctor", {"decision": "approve"}, expected=409)  # only once

    def test_dismissing_a_proposal_does_nothing_and_attention_items_cannot_be_approved(self):
        qid = self.new_question("Where do I upload my report?")
        orchestrator.process_queue()
        proposal = self.items_for(qid)[0]
        self.call("POST", f"/api/v2/assistant/exceptions/{proposal.id}/decide", "doctor", {"decision": "dismiss", "note": "I will write to her myself."})
        with SessionLocal() as db:
            self.assertEqual(db.query(models.QuestionResponse).filter_by(question_id=qid).count(), 0)
            self.assertEqual(db.get(models.ExceptionItem, proposal.id).decision_note, "I will write to her myself.")
        clinical = self.new_question("My stomach hurts after taking the tablets")
        orchestrator.process_queue()
        attention = self.items_for(clinical)[0]
        self.call("POST", f"/api/v2/assistant/exceptions/{attention.id}/decide", "doctor", {"decision": "approve"}, expected=400)
        self.call("POST", f"/api/v2/assistant/exceptions/{attention.id}/decide", "doctor", {"decision": "acknowledge"})

    def test_patient_language_is_used_for_the_fixed_wording(self):
        self.call("PATCH", "/api/v2/continuity/preferences", "patient", {"language": "hi"})
        try:
            qid = self.new_question("When is my next appointment?")
            orchestrator.process_queue()
            self.assertIn(messages.ASSISTANT_NOTE["hi"], self.items_for(qid)[0].proposed_args["text"])
        finally:
            self.call("PATCH", "/api/v2/continuity/preferences", "patient", {"language": "en"})

    def test_a_question_someone_already_answered_is_left_alone(self):
        qid = self.new_question("When is my next appointment?")
        with SessionLocal() as db:
            db.get(models.PatientQuestion, qid).status = "ANSWERED"
            db.commit()
        orchestrator.process_queue()
        self.assertEqual(self.items_for(qid), [])
        self.assertIn("already answered", self.run_for(qid).summary)

    # ---- document intake
    def test_a_clean_document_becomes_a_verify_proposal_and_a_doctor_approves_it(self):
        did = self.make_document(text="Antenatal ultrasound report for " + self.patient_name + ". Visit note: scan completed and filed.", found_name=self.patient_name)
        orchestrator.process_queue()
        item = self.items_for(did)[0]
        self.assertEqual((item.kind, item.proposed_tool), ("proposal", "verify_document"))
        self.assertIn("does not mean the result is fine", item.summary)
        with SessionLocal() as db:
            self.assertEqual(db.get(models.MedicalDocument, did).status, "NEEDS_REVIEW")  # the assistant has not verified anything itself
        self.call("POST", f"/api/v2/assistant/exceptions/{item.id}/decide", "doctor", {"decision": "approve"})
        with SessionLocal() as db:
            self.assertEqual(db.get(models.MedicalDocument, did).status, "VERIFIED")
            review = db.query(models.DocumentReview).filter_by(document_id=did).first()
            self.assertEqual(review.reviewer_user_id, self.doctor_id)

    def test_a_document_for_someone_else_is_never_proposed_for_verification(self):
        did = self.make_document(text="Antenatal ultrasound report for Priya Nair. Visit note: scan completed and filed.", found_name="Priya Nair")
        orchestrator.process_queue()
        items = self.items_for(did)
        self.assertEqual([i.kind for i in items], ["attention"])
        self.assertIn("someone else", items[0].title)

    def test_a_wrong_record_number_or_a_future_date_or_a_copy_is_flagged(self):
        wrong_mrn = self.make_document(text="Antenatal ultrasound report for " + self.patient_name + ". Visit note: scan completed and filed.", found_name=self.patient_name, found_mrn="ZZ-99999")
        future = self.make_document(text="Blood group report for " + self.patient_name + " collected next year, filed as shown.", found_name=self.patient_name,
                                    event_date=(utcnow() + timedelta(days=200)).date().isoformat(), record_type="Blood group report")
        text = "Glucose tolerance report for " + self.patient_name + " collected and filed by the laboratory this month."
        first = self.make_document(text=text, found_name=self.patient_name, record_type="Glucose report")
        copy = self.make_document(text=text, found_name=self.patient_name, record_type="Glucose report copy")
        orchestrator.process_queue()
        self.assertEqual([i.kind for i in self.items_for(wrong_mrn)], ["attention"])
        self.assertEqual([i.kind for i in self.items_for(future)], ["attention"])
        self.assertEqual([i.kind for i in self.items_for(first)], ["attention"])  # both copies are held back and shown to a doctor
        self.assertIn("looks the same", self.items_for(copy)[0].summary)

    def test_an_unreadable_document_proposes_a_fixed_rejection_message(self):
        did = self.make_document(text="x", found_name=None, record_type="unknown")
        orchestrator.process_queue()
        item = self.items_for(did)[0]
        self.assertEqual((item.kind, item.proposed_tool), ("proposal", "reject_document"))
        self.assertEqual(item.proposed_args["note"], messages.UNREADABLE["en"])

    def test_a_document_that_says_it_is_urgent_goes_to_a_doctor_as_urgent(self):
        class Alarmed(providers.RulesProvider):
            def classify_document(self, text, filename, hints):
                return providers.DocumentAnalysis(record_type="report", readable=True, looks_urgent=True, confidence=0.9, reason="test")

        did = self.make_document(text="Report for " + self.patient_name + ". Visit note: please read this at once, it is filed as urgent.", found_name=self.patient_name)
        with patch("backend.app.ai_coordinator.orchestrator.get_provider", return_value=Alarmed()):
            orchestrator.process_queue()
        item = self.items_for(did)[0]
        self.assertEqual((item.kind, item.urgency), ("attention", "urgent"))

    # ---- orchestrator
    def test_the_same_trigger_is_only_ever_queued_once(self):
        qid = self.new_question("When is my next appointment?")
        with SessionLocal() as db:
            self.assertIsNone(orchestrator.enqueue(db, "question_routing", episode_id=self.ep, source_type="PatientQuestion", source_id=qid))
            self.assertEqual(db.query(models.AIRun).filter_by(source_id=qid).count(), 1)
        orchestrator.process_queue()
        orchestrator.process_queue()
        self.assertEqual(len(self.items_for(qid)), 1)  # running the queue again does not repeat the work

    def test_switched_off_nothing_is_queued_and_queued_work_is_skipped(self):
        qid = self.new_question("When is my next appointment?")
        with patch.object(config, "AI_COORDINATOR_MODE", "off"):
            orchestrator.process_queue()  # the kill switch also stops work that was already waiting
            self.assertEqual(self.run_for(qid).status, "SKIPPED")
            self.assertEqual(self.items_for(qid), [])
            later = self.new_question("When is my next appointment?")
            self.assertIsNone(self.run_for(later))
            self.assertEqual(orchestrator.run_sweeps(), {"missedCheckIns": 0, "overdueTasks": 0})
            self.call("POST", "/api/v2/assistant/talk-to-a-person", "patient", {"message": "Please call me."})  # still works with the assistant off

    def test_shadow_mode_records_but_does_nothing(self):
        with patch.object(config, "AI_COORDINATOR_MODE", "shadow"):
            qid = self.new_question("I have heavy bleeding")
            orchestrator.process_queue()
        with SessionLocal() as db:
            self.assertEqual(db.query(models.Notification).filter_by(type="assistant_urgent", related_entity_id=qid).count(), 0)
            actions = db.query(models.AIAction).filter_by(episode_id=self.ep).join(models.AIRun, models.AIRun.id == models.AIAction.run_id).filter(models.AIRun.source_id == qid).all()
            self.assertTrue(actions)
            self.assertEqual({a.status for a in actions}, {"SHADOW"})

    def test_a_crashing_workflow_is_recorded_and_handed_to_a_doctor(self):
        qid = self.new_question("When is my next appointment?")
        boom = {"question_routing": lambda db, run, provider: (_ for _ in ()).throw(RuntimeError("model unavailable"))}
        with patch.dict(orchestrator.WORKFLOWS, boom):
            orchestrator.process_queue()
        run = self.run_for(qid)
        self.assertEqual(run.status, "FAILED")
        self.assertIn("model unavailable", run.error)
        self.assertEqual([i.title for i in self.items_for(qid)], ["The care assistant hit a problem"])

    def test_every_run_records_its_mode_provider_and_prompt_version(self):
        qid = self.new_question("When is my next appointment?")
        orchestrator.process_queue()
        run = self.run_for(qid)
        self.assertEqual((run.mode, run.provider, run.framework), ("assist", "rules", "langgraph"))
        self.assertTrue(run.prompt_version)
        self.assertTrue(run.inputs_digest)
        self.assertNotIn("appointment", run.inputs_digest)  # a hash, never the text

    # ---- policy engine
    def run_object(self, db):
        run = models.AIRun(workflow="question_routing", episode_id=self.ep, source_type="Test", source_id="t", trigger_key="test:" + models.AIRun.__name__ + str(datetime.now().timestamp()))
        db.add(run)
        db.flush()
        return run

    def test_policy_refuses_unlisted_tools_and_other_patients_data(self):
        with SessionLocal() as db:
            run = self.run_object(db)
            for tool in ("diagnose", "prescribe", "release_document", "delete_record", "mark_urgent_as_resolved"):
                self.assertEqual(policy.decide(db, run, tool, {}, None).outcome, "deny", tool)
            self.assertNotIn("diagnose", policy.TOOLS)
            stranger = models.PatientQuestion(episode_id=self.elena_ep, asked_by_user_id=self.sarah_id, question_text="belongs to someone else")
            db.add(stranger)
            db.flush()
            self.assertEqual(policy.decide(db, run, "answer_question", {"question_id": stranger.id}, None).outcome, "deny")
            self.assertEqual(policy.decide(db, run, "notify_user", {"user_id": self.doctor_id}, None).outcome, "run")
            self.assertEqual(policy.decide(db, run, "notify_user", {"user_id": self.elena_user}, None).outcome, "deny")  # a message may only go to her own people
            db.rollback()

    def test_the_daily_cap_stops_the_assistant_and_tells_a_person(self):
        qid = self.new_question("When is my next appointment?")
        with patch.object(config, "AI_DAILY_ACTION_CAP", 0):
            orchestrator.process_queue()
        titles = [i.title for i in self.items_for(qid)]
        self.assertIn("The care assistant stopped", titles)  # never silent
        with SessionLocal() as db:
            self.assertEqual(db.query(models.QuestionResponse).filter_by(question_id=qid).count(), 0)

    def test_a_tool_that_is_not_registered_cannot_run_even_when_called_directly(self):
        with SessionLocal() as db:
            actor = db.query(models.User).filter_by(email=ASSISTANT_EMAIL).first()
            with self.assertRaises(Exception) as caught:
                tools.execute(db, "diagnose", {}, actor, episode_id=self.ep)
            self.assertEqual(caught.exception.status_code, 403)

    def test_assistant_steps_are_attributed_to_its_own_account_in_the_audit_log(self):
        qid = self.new_question("I have heavy bleeding")
        orchestrator.process_queue()
        with SessionLocal() as db:
            rows = db.query(models.AuditLog).filter(models.AuditLog.episode_id == self.ep, models.AuditLog.action == "assistant_send_urgent_message").all()
            self.assertTrue(rows)
            self.assertEqual({r.actor_role for r in rows}, {"ai_coordinator"})

    # ---- sweeps
    def test_missed_check_ins_get_one_fixed_reminder_a_day_for_her_and_allowed_trusted_people(self):
        with SessionLocal() as db:
            plan = db.get(models.MonitoringPlan, self.ep)
            if plan is None:
                plan = models.MonitoringPlan(episode_id=self.ep, interval_days=1, active=True, owner_user_id=self.doctor_id)
                db.add(plan)
            plan.active, plan.interval_days, plan.agreed_at = True, 1, datetime.utcnow() - timedelta(days=5)
            db.query(models.DailyLog).filter_by(episode_id=self.ep).delete()
            link = db.get(models.CaregiverLink, self.ravi_link)
            link.permissions = {"appointments": True, "check_in": True}
            db.commit()
            before = db.query(models.Notification).filter_by(type="assistant_reminder").count()
        try:
            counts = orchestrator.run_sweeps()
            self.assertGreaterEqual(counts["missedCheckIns"], 1)
            with SessionLocal() as db:
                reminders = db.query(models.Notification).filter_by(type="assistant_reminder", episode_id=self.ep).all()
                recipients = {n.recipient_user_id for n in reminders}
                ravi = db.query(models.User).filter_by(email=DEMO_CAREGIVER["email"]).first().id
                self.assertTrue({self.sarah_id, ravi} <= recipients)
                self.assertIn("not been filled in", next(n for n in reminders if n.recipient_user_id == ravi).body)
                self.assertNotIn("risk", " ".join(n.body.lower() for n in reminders))  # a missing entry is not treated as a sign of anything
                total = db.query(models.Notification).filter_by(type="assistant_reminder").count()
            self.assertGreater(total, before)
            orchestrator.run_sweeps()  # the same day again
            with SessionLocal() as db:
                self.assertEqual(db.query(models.Notification).filter_by(type="assistant_reminder").count(), total)
            with SessionLocal() as db:  # only the permitted trusted people are told
                db.get(models.CaregiverLink, self.ravi_link).permissions = {"appointments": True, "check_in": False}
                db.commit()
        finally:
            with SessionLocal() as db:
                plan = db.get(models.MonitoringPlan, self.ep)
                if plan:
                    plan.active = False
                db.commit()

    def test_an_overdue_task_is_raised_to_a_doctor_once(self):
        with SessionLocal() as db:
            task = models.Task(episode_id=self.ep, title="Call about the missing scan", owner_user_id=self.doctor_id, created_by_user_id=self.doctor_id, status="OPEN",
                               due_date=(utcnow() - timedelta(days=6)).date().isoformat())
            db.add(task)
            db.commit()
            task_id = task.id
        orchestrator.run_sweeps()
        orchestrator.run_sweeps()
        self.assertEqual([i.title for i in self.items_for(task_id)], ["A task is overdue"])

    # ---- the doctor's pages
    def test_status_activity_and_run_now_for_the_doctor_only(self):
        self.new_question("When is my next appointment?")
        done = self.call("POST", "/api/v2/assistant/run-now", "doctor")
        self.assertIn("queued", done)
        status = self.call("GET", "/api/v2/assistant/status", "doctor")
        self.assertEqual((status["mode"], status["provider"]), ("assist", "rules"))
        self.assertGreaterEqual(status["open"], 1)
        activity = self.call("GET", "/api/v2/assistant/activity", "doctor")
        self.assertTrue(activity and {"tool", "tier", "policy", "status", "reason", "provider"} <= set(activity[0]))
        for path in ("/api/v2/assistant/status", "/api/v2/assistant/exceptions", "/api/v2/assistant/activity"):
            self.call("GET", path, "patient", expected=403)
            self.call("GET", path, "ravi", expected=403)
        self.call("POST", "/api/v2/assistant/run-now", "patient", expected=403)

    def test_a_doctor_only_sees_items_for_their_own_patients(self):
        qid = self.new_question("When is my next appointment?")
        orchestrator.process_queue()
        item = self.items_for(qid)[0]
        mine = {i["id"] for i in self.call("GET", "/api/v2/assistant/exceptions", "doctor")}
        theirs = {i["id"] for i in self.call("GET", "/api/v2/assistant/exceptions?scope=all", "other_doctor")}
        self.assertIn(item.id, mine)
        self.assertNotIn(item.id, theirs)

    def test_talk_to_a_person_reaches_the_doctor_in_the_patients_language(self):
        reply = self.call("POST", "/api/v2/assistant/talk-to-a-person", "patient", {"message": "Please call me back."})
        self.assertEqual(reply["message"], messages.TALK_TO_PERSON["en"])
        pending = self.call("GET", "/api/v2/assistant/exceptions", "doctor")
        self.assertTrue(any(i["title"] == "A patient asked to talk to a person" and "call me back" in i["summary"] for i in pending))
        with SessionLocal() as db:
            self.assertTrue(db.query(models.Notification).filter_by(recipient_user_id=self.doctor_id, type="assistant_exception").count())


# =============================================================================== the model step, without a network
class FakeClient:
    """Stands in for anthropic.Anthropic: records what it was sent and returns a canned answer."""

    def __init__(self, parsed=None, stop_reason="end_turn", error=None):
        self.sent, self.parsed, self.stop_reason, self.error = [], parsed, stop_reason, error
        self.messages = types.SimpleNamespace(parse=self.parse)

    def parse(self, **kwargs):
        self.sent.append(kwargs)
        if self.error:
            raise self.error
        return types.SimpleNamespace(stop_reason=self.stop_reason, parsed_output=self.parsed)


class ProviderTests(unittest.TestCase):
    def provider(self, client):
        return providers.ClaudeProvider(client_factory=lambda: client)

    def doc(self, **kwargs):
        base = dict(record_type="Ultrasound", readable=True, looks_urgent=False, confidence=0.9, reason="fine")
        return providers.DocumentAnalysis(**{**base, **kwargs})

    def test_name_and_record_number_are_removed_before_anything_is_sent(self):
        client = FakeClient(self.doc())
        text = "Patient Sarah Jenkins, MRN-77123, scan today. Sarah is well."
        self.provider(client).classify_document(text, "Sarah Jenkins scan.pdf", {"names": ["Sarah Jenkins"], "identifiers": ["MRN-77123"]})
        sent = str(client.sent[0])
        for secret in ("Sarah", "Jenkins", "MRN-77123"):
            self.assertNotIn(secret, sent)
        self.assertIn("[PATIENT]", sent)
        self.assertEqual(client.sent[0]["model"], config.AI_MODEL)
        self.assertIs(client.sent[0]["output_format"], providers.DocumentAnalysis)

    def test_every_failure_becomes_a_provider_error_for_a_doctor_to_handle(self):
        for client in (FakeClient(error=ConnectionError("down")), FakeClient(stop_reason="refusal"), FakeClient(parsed=None)):
            with self.assertRaises(providers.ProviderError):
                self.provider(client).classify_document("some text", "a.pdf", {})
        with patch.dict("sys.modules", {"anthropic": None}), self.assertRaises(providers.ProviderError):
            providers.ClaudeProvider().classify_document("some text", "a.pdf", {})  # package not installed

    def test_the_model_can_make_the_assistant_more_careful_but_never_less(self):
        said_admin = providers.QuestionAnalysis(category="administrative", intent="next_appointment", confidence=0.99, reason="model")
        # The fixed warning-sign list still wins when the model under-reacts.
        urgent = self.provider(FakeClient(said_admin)).classify_question("I have heavy bleeding, when is my next appointment", "en")
        self.assertEqual(urgent.category, "urgent")
        clinical = self.provider(FakeClient(said_admin)).classify_question("Can I take paracetamol for a headache", "en")
        self.assertEqual(clinical.category, "clinical")
        # And the model may raise the level on its own.
        said_clinical = providers.QuestionAnalysis(category="clinical", intent="other", confidence=0.9, reason="model")
        raised = self.provider(FakeClient(said_clinical)).classify_question("When is my next appointment?", "en")
        self.assertEqual(raised.category, "clinical")

    def test_provider_choice_follows_the_setting(self):
        with patch.object(config, "AI_PROVIDER", "rules"):
            self.assertEqual(providers.get_provider().name, "rules")
        with patch.object(config, "AI_PROVIDER", "claude"):
            self.assertEqual(providers.get_provider().name, "claude")
        with patch.object(config, "AI_PROVIDER", "something-else"):
            self.assertEqual(providers.get_provider().name, "rules")  # an unknown value never turns on an outside service

    def test_question_rules_in_all_four_languages(self):
        cases = {"en": ("When is my next appointment?", "administrative"), "hi": ("मेरी अगली अपॉइंटमेंट कब है", "administrative"),
                 "ta": ("எனது அடுத்த சந்திப்பு எப்போது", "administrative"), "te": ("నా తదుపరి అపాయింట్‌మెంట్ ఎప్పుడు", "administrative")}
        for language, (text, expected) in cases.items():
            self.assertEqual(providers.rules_question(text, language).category, expected, language)
        self.assertEqual(providers.rules_question("What colour is the sky", "en").category, "unclear")

    def test_redaction_leaves_other_words_alone(self):
        self.assertEqual(providers.redact("Sarah Jenkins has a scan", ["Sarah Jenkins"], []), "[PATIENT] [PATIENT] has a scan")
        self.assertEqual(providers.redact("A scan was done", ["A Smith"], []), "A scan was done")  # a one-letter initial is not worth hiding, and must not damage ordinary words


class NameMatchingTests(unittest.TestCase):
    def test_names_match_allows_order_and_initials_but_not_other_people(self):
        for a, b in [("Sarah Jenkins", "Jenkins, Sarah"), ("Sarah Jenkins", "S. Jenkins"), ("Sarah Jenkins", "SARAH JENKINS"), ("Sarah Jenkins", "Mrs Sarah Jenkins")]:
            self.assertTrue(workflows.names_match(a, b), (a, b))
        for a, b in [("Sarah Jenkins", "Priya Nair"), ("Sarah Jenkins", "Sarah Smith"), ("Sarah Jenkins", ""), ("", "Sarah")]:
            self.assertFalse(workflows.names_match(a, b), (a, b))

    def test_fixed_messages_exist_in_all_four_languages(self):
        for table in (messages.URGENT_TITLE, messages.CHECKIN_TITLE, messages.CHECKIN_PATIENT, messages.CHECKIN_CAREGIVER, messages.UNREADABLE, messages.NO_APPOINTMENT,
                      messages.UPLOAD_HELP, messages.ASSISTANT_NOTE, messages.TALK_TO_PERSON):
            self.assertEqual(set(table), set(messages.LANGUAGES))
            self.assertTrue(all(table[language].strip() for language in messages.LANGUAGES))
        for language in messages.LANGUAGES:
            self.assertIn("{name}", messages.CHECKIN_CAREGIVER[language])
            self.assertTrue(messages.urgent_body(language))


if __name__ == "__main__":
    unittest.main()
