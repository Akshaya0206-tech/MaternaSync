"""Integration tests with an isolated synthetic database and upload directory."""
import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

_temp = tempfile.TemporaryDirectory(prefix="maternasync-test-")
os.environ["MATERNASYNC_DATABASE_URL"] = "sqlite:///" + _temp.name.replace("\\", "/") + "/test.db"
os.environ["MATERNASYNC_UPLOAD_DIR"] = _temp.name + "/uploads"
os.environ["MATERNASYNC_DEMO_ENABLED"] = "true"

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import SessionLocal, engine
from backend.app import models
from backend.app.seed_role_data import PASSWORDS

ROOT = "/api/v2/continuity"


class ContinuityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client_context = TestClient(app)
        cls.client = cls.client_context.__enter__()
        cls.users = {}
        for key, email in [("patient", "sarah.jenkins@maternasync.app"), ("doctor", "demo@maternasync.app"), ("staff", "brenda.miller@maternasync.app"), ("other", "dr.chen@maternasync.app"), ("other_patient", "elena.rostova@maternasync.app")]:
            response = cls.client.post("/api/auth/login", json={"email": email, "password": PASSWORDS[email]})
            assert response.status_code == 200, response.text
            data = response.json()
            cls.users[key] = {"headers": {"Authorization": "Bearer " + data["accessToken"]}, "id": data["user"]["id"]}
        cls.ep = cls.client.get(ROOT + "/context", headers=cls.users["patient"]["headers"]).json()["episodes"][0]["id"]
        cls.other_ep = cls.client.get(ROOT + "/context", headers=cls.users["other_patient"]["headers"]).json()["episodes"][0]["id"]

    @classmethod
    def tearDownClass(cls):
        cls.client_context.__exit__(None, None, None)
        engine.dispose()
        _temp.cleanup()

    def request(self, method, path, role="doctor", payload=None, expected=200):
        if path.startswith(ROOT + "/outputs/") and path.endswith("/approve") and payload is not None and "revision" not in payload:
            with SessionLocal() as db:
                payload = {**payload, "revision": db.get(models.ClinicalOutput, path.split('/')[-2]).revision}
        result = self.client.request(method, path, headers=self.users[role]["headers"], json=payload)
        self.assertEqual(result.status_code, expected, f"{method} {path}: {result.text}")
        return result.json() if result.content else None

    def workspace(self, role="doctor"):
        return self.request("GET", f"{ROOT}/episodes/{self.ep}", role)

    def resource(self, kind="template", config=None, **kwargs):
        data = dict(kind=kind, title="Integration test resource", issuer="Test governance owner", topic="Test", content="Reviewed synthetic material.", sourceUrl="https://www.who.int/publications/i/item/9789241549912", section="Test section", rightsNote="Synthetic test content", reviewDue=(datetime.now(timezone.utc).date() + timedelta(days=30)).isoformat(), configuration=config if config is not None else {"fields": ["Plan"], "required": ["Plan"]})
        data.update(kwargs)
        return self.request("POST", "/api/v2/library", payload=data)

    def approve_resource(self, resource):
        return self.request("POST", f"/api/v2/library/{resource['id']}/approve", payload={"confirmed": True})

    def source(self, kind="document"):
        return next(s for s in self.workspace()["sources"] if s["type"] == kind)["id"]

    def create_output(self, kind="certificate", **kwargs):
        return self.request("POST", f"{ROOT}/episodes/{self.ep}/outputs", payload={"kind": kind, "sourceType": "document", "sourceId": self.source(), **kwargs})

    def edit_output(self, output, **kwargs):
        return self.request("PATCH", f"{ROOT}/outputs/{output['id']}", payload={"content": "Reviewed synthetic instructions. Follow the plan recorded at your visit.", "structuredData": {}, "selectedCodes": [], "revision": output["revision"], **kwargs})

    def test_demo_accounts(self):
        accounts = self.client.get("/api/auth/demo-accounts").json()
        self.assertEqual({a["role"] for a in accounts}, {"patient", "doctor", "care_team"})
        for account in accounts:
            self.assertEqual(self.client.post("/api/auth/login", json={"email": account["email"], "password": account["password"]}).status_code, 200)
        with patch("backend.app.config.DEMO_ENABLED", False):
            self.assertEqual(self.client.get("/api/auth/demo-accounts").json(), [])

    def test_access_isolation(self):
        for role in ("other", "other_patient"):
            self.request("GET", f"{ROOT}/episodes/{self.ep}", role, expected=403)
        self.request("GET", f"{ROOT}/episodes/{self.other_ep}", "patient", expected=403)
        self.request("GET", ROOT + "/clinic", "patient", expected=403)
        self.request("GET", "/api/v2/library", "patient", expected=403)
        self.request("GET", f"/api/v2/doctor/episodes/{self.ep}/todays-brief", "patient", expected=403)
        self.request("GET", f"/api/v2/care-team/handover/{self.ep}", "patient", expected=403)
        self.assertEqual(self.client.get(ROOT + "/context").status_code, 401)

    def test_logs_corrections_and_trends(self):
        data = {"recordedAt": (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat(), "systolic": 111, "diastolic": 72, "weightKg": 63.5, "symptoms": "Synthetic update", "movementCount": 3, "movementMinutes": 15}
        log = self.request("POST", f"{ROOT}/episodes/{self.ep}/logs", "patient", data)
        self.request("POST", f"{ROOT}/episodes/{self.ep}/logs", "doctor", data, expected=403)
        self.request("PATCH", f"{ROOT}/logs/{log['id']}", "patient", {**data, "weightKg": 64}, expected=400)
        corrected = self.request("PATCH", f"{ROOT}/logs/{log['id']}", "patient", {**data, "weightKg": 64, "correctionReason": "Typing correction"})
        self.assertEqual(corrected["revision"], 2)
        history = self.request("GET", f"{ROOT}/logs/{log['id']}/history", "patient")
        self.assertEqual(history[-1]["previousState"]["weightKg"], 63.5)
        trends = self.request("GET", f"{ROOT}/episodes/{self.ep}/trends")
        self.assertEqual(next(l for l in trends["logs"] if l["id"] == log["id"])["weightKg"], 64)
        self.request("POST", f"{ROOT}/episodes/{self.ep}/logs", "patient", {**data, "systolic": None}, expected=422)

    def test_governed_rules_and_reference_versions(self):
        resource = self.resource("rule", {"metric": "systolic", "operator": "gt", "threshold": 1})
        self.assertFalse(resource["usable"])
        self.approve_resource(resource)
        trends = self.request("GET", f"{ROOT}/episodes/{self.ep}/trends")
        self.assertTrue(any(f["ruleId"] == resource["id"] for f in trends["flags"]))
        guideline = self.approve_resource(self.resource("guideline", {}))
        output = self.create_output()
        body = {"resourceId": guideline["id"], "targetType": "note", "targetId": output["id"]}
        attached = self.request("POST", f"{ROOT}/episodes/{self.ep}/references", payload=body)
        self.assertEqual(attached["id"], self.request("POST", f"{ROOT}/episodes/{self.ep}/references", payload=body)["id"])
        version = self.resource("guideline", {}, previousVersionId=guideline["id"])
        self.assertEqual(version["version"], 2)
        self.approve_resource(version)
        self.assertEqual(next(r for r in self.request("GET", "/api/v2/library") if r["id"] == guideline["id"])["status"], "SUPERSEDED")
        self.request("POST", f"{ROOT}/episodes/{self.ep}/references", payload=body, expected=400)

    def test_output_approval_boundary(self):
        output = self.create_output()
        self.assertNotIn(output["id"], [o["id"] for o in self.workspace("patient")["outputs"]])
        self.request("POST", f"{ROOT}/outputs/{output['id']}/approve", payload={"confirmed": True}, expected=400)
        self.request("POST", f"{ROOT}/outputs/{output['id']}/approve", "staff", {"confirmed": True}, expected=403)
        edited = self.edit_output(output)
        self.request("PATCH", f"{ROOT}/outputs/{output['id']}", payload={"content": "Stale edit", "revision": 1}, expected=409)
        approved = self.request("POST", f"{ROOT}/outputs/{output['id']}/approve", payload={"confirmed": True, "visibleToPatient": True})
        self.assertEqual(approved["status"], "APPROVED")
        patient_output = next(o for o in self.workspace("patient")["outputs"] if o["id"] == output["id"])
        self.assertNotIn("sourceSnapshot", patient_output)
        self.assertEqual(patient_output["content"], edited["content"])
        self.request("PATCH", f"{ROOT}/outputs/{output['id']}", payload={"content": "Cannot change signed text", "revision": edited["revision"]}, expected=409)

    def test_template_required_fields_and_education(self):
        template = self.approve_resource(self.resource())
        output = self.edit_output(self.create_output(templateId=template["id"]))
        self.request("POST", f"{ROOT}/outputs/{output['id']}/approve", payload={"confirmed": True}, expected=400)
        self.edit_output(output, structuredData={"Plan": "Reviewed plan"})
        self.request("POST", f"{ROOT}/outputs/{output['id']}/approve", payload={"confirmed": True})
        education = self.resource("education", {}, language="ta", stage="third", content="உங்கள் பராமரிப்புக் குழுவிடம் கேளுங்கள்.")
        self.assertNotIn(education["id"], [r["id"] for r in self.request("GET", "/api/v2/library/education?language=ta", "patient")])
        self.approve_resource(education)
        self.assertIn(education["id"], [r["id"] for r in self.request("GET", "/api/v2/library/education?language=ta&stage=third", "patient")])
        self.request("PATCH", ROOT + "/preferences", "patient", {"language": "te"})
        self.assertEqual(self.request("GET", ROOT + "/context", "patient")["language"], "te")

    def test_pathway_and_task_assignment(self):
        resource = self.resource("pathway", {"steps": [{"title": "Arrange documented follow-up", "days": 2}]})
        body = {"resourceId": resource["id"], "ownerUserId": self.users["staff"]["id"], "startDate": datetime.now(timezone.utc).date().isoformat(), "confirmed": True}
        self.request("POST", f"{ROOT}/episodes/{self.ep}/pathways", payload=body, expected=400)
        self.approve_resource(resource)
        enrollment = self.request("POST", f"{ROOT}/episodes/{self.ep}/pathways", payload=body)
        self.request("POST", f"{ROOT}/episodes/{self.ep}/pathways", payload=body, expected=409)
        task = next(t for t in self.request("GET", f"{ROOT}/episodes/{self.ep}/tasks", "staff") if t["sourceId"] == enrollment["id"])
        self.request("PATCH", f"{ROOT}/tasks/{task['id']}/assignment", "staff", {"ownerUserId": self.users["other"]["id"]}, expected=400)
        self.request("PATCH", f"{ROOT}/tasks/{task['id']}/assignment", "staff", {"ownerUserId": self.users["doctor"]["id"], "dueDate": body["startDate"]})
        task = next(t for t in self.request("GET", f"{ROOT}/episodes/{self.ep}/tasks") if t["id"] == task["id"])
        self.assertEqual(len(task["history"]), 2)

    def test_reminders_help_and_revoked_outreach(self):
        appt = next(a for a in self.workspace()["appointments"] if a["status"] == "scheduled")
        reminder = self.request("POST", f"{ROOT}/episodes/{self.ep}/reminders", "staff", {"kind": "appointment", "title": "Visit reminder", "sourceId": appt["id"], "scheduledAt": datetime.now(timezone.utc).isoformat()})[0]
        self.request("POST", f"{ROOT}/reminders/{reminder['id']}/respond", "patient", {"status": "needs_help"})
        self.request("POST", f"{ROOT}/reminders/{reminder['id']}/respond", "patient", {"status": "done"}, expected=409)
        self.assertTrue(any(t["sourceId"] == reminder["id"] for t in self.request("GET", f"{ROOT}/episodes/{self.ep}/tasks")))
        consent = self.request("POST", f"{ROOT}/episodes/{self.ep}/consents", "patient", {"recipient": "+919999999999", "purpose": "reminders", "expiresAt": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()})
        payload = {"consentId": consent["id"], "sourceType": "reminder", "sourceId": reminder["id"], "recipient": "+919999999999", "confirmed": True}
        self.request("POST", f"{ROOT}/episodes/{self.ep}/outreach", "staff", {**payload, "recipient": "+918888888888"}, expected=400)
        outreach = self.request("POST", f"{ROOT}/episodes/{self.ep}/outreach", "staff", payload)
        result = self.request("POST", f"{ROOT}/outreach/{outreach['id']}/open", "staff")
        self.assertEqual(result["status"], "COMPOSER_LINK_READY")
        self.assertNotIn("Sarah", result["url"])
        self.request("POST", f"{ROOT}/consents/{consent['id']}/revoke", "patient")
        self.request("POST", f"{ROOT}/outreach/{outreach['id']}/open", "staff", expected=409)
        self.request("POST", f"{ROOT}/episodes/{self.ep}/outreach", "staff", payload, expected=400)

    def test_appointments_monitoring_and_outcomes(self):
        appt = self.request("POST", f"{ROOT}/episodes/{self.ep}/appointments", "patient", {"scheduledAt": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(), "appointmentType": "Follow-up"})
        self.assertEqual(appt["status"], "requested")
        self.request("PATCH", f"{ROOT}/appointments/{appt['id']}", "staff", {"status": "scheduled"})
        self.request("PATCH", f"{ROOT}/appointments/{appt['id']}", "staff", {"status": "no_show"}, expected=400)
        self.request("POST", f"{ROOT}/episodes/{self.ep}/monitoring", "staff", {"intervalDays": 2, "ownerUserId": self.users["staff"]["id"], "patientAgreed": True})
        with SessionLocal() as db:
            db.get(models.MonitoringPlan, self.ep).agreed_at = datetime.now(timezone.utc) - timedelta(days=10)
            for log in db.query(models.DailyLog).filter_by(episode_id=self.ep).all():
                log.recorded_at = datetime.now(timezone.utc) - timedelta(days=5)
            db.commit()
        clinic = self.request("GET", ROOT + "/clinic", "staff")
        self.assertTrue(next(p for p in clinic["patients"] if p["episodeId"] == self.ep)["missingCheckIn"])
        self.assertNotIn(self.other_ep, [p["episodeId"] for p in clinic["patients"]])
        self.request("POST", f"{ROOT}/episodes/{self.ep}/outcomes", "staff", {"kind": "scan", "value": "on_time", "eventDate": datetime.now(timezone.utc).date().isoformat(), "sourceDocumentId": self.source()})
        after = self.request("GET", ROOT + "/clinic", "staff")
        self.assertEqual(after["metrics"]["recordedScans"], clinic["metrics"]["recordedScans"] + 1)

    def test_existing_consultation_questions_and_handover(self):
        consult = self.request("POST", "/api/v2/doctor/consultations", payload={"episodeId": self.ep, "inputMode": "text"})
        self.request("PATCH", f"/api/v2/doctor/consultations/{consult['id']}", payload={"rawTranscript": "Synthetic visit. Discussed recorded questions."})
        draft = self.request("POST", f"/api/v2/doctor/consultations/{consult['id']}/drafts")
        approved = self.request("POST", f"/api/v2/doctor/drafts/{draft['id']}/approve")
        output = self.create_output("visit_summary", sourceType="consultation", sourceId=approved["id"])
        self.assertEqual(output["status"], "DRAFT")
        question = self.request("POST", "/api/v2/patient/questions", "patient", {"questionText": "எனது அடுத்த சந்திப்பு எப்போது?"})
        self.request("POST", f"/api/v2/care-team/questions/{question['id']}/assign-doctor", "staff")
        self.request("POST", f"/api/v2/care-team/questions/{question['id']}/respond", "staff", {"responseText": "Unauthorized clinical reply"}, expected=403)
        self.request("POST", f"/api/v2/doctor/questions/{question['id']}/draft", payload={"responseText": "Reviewed synthetic reply"})
        self.assertEqual(next(q for q in self.request("GET", "/api/v2/patient/questions", "patient") if q["id"] == question["id"])["responses"], [])
        self.request("POST", f"/api/v2/doctor/questions/{question['id']}/approve-response")
        self.assertEqual(next(q for q in self.request("GET", "/api/v2/patient/questions", "patient") if q["id"] == question["id"])["status"], "ANSWERED")
        handover = self.request("POST", f"/api/v2/care-team/handover/{self.ep}/generate", "staff")
        self.assertIn("document / explanation draft(s) awaiting review", handover["whatRemains"])
        self.request("POST", f"/api/v2/care-team/handover/{handover['id']}/share", "staff")
        doctor_handover = self.request("POST", f"/api/v2/doctor/handover/{self.ep}/generate")
        self.assertEqual(doctor_handover["version"], handover["version"] + 1)
        self.assertIn("document / explanation draft(s) awaiting review", doctor_handover["whatRemains"])
        history = self.request("GET", f"/api/v2/doctor/handover/{self.ep}/history")
        self.assertEqual(next(h for h in history if h["id"] == handover["id"])["status"], "FINAL")
        self.request("PATCH", f"/api/v2/doctor/handover/{handover['id']}", payload={"context": "Cannot edit final"}, expected=409)
        self.request("GET", f"/api/v2/doctor/episodes/{self.ep}/todays-brief")

    def test_voice_language_and_original_transcript(self):
        consult = self.request("POST", "/api/v2/doctor/consultations", payload={"episodeId": self.ep, "inputMode": "voice"})
        with patch("backend.app.transcription.transcribe_audio", return_value="மருத்துவர் reviewed the note") as transcribe:
            response = self.client.post(f"/api/v2/doctor/consultations/{consult['id']}/transcribe", headers=self.users["doctor"]["headers"], files={"file": ("test.webm", b"synthetic audio", "audio/webm")}, data={"language": "ta"})
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(transcribe.call_args.kwargs["language"], "ta")
            self.assertEqual(response.json()["rawTranscript"], "மருத்துவர் reviewed the note")

    def test_prescription_requires_entered_fields_and_reviewed_codes(self):
        consult = self.request("POST", "/api/v2/doctor/consultations", payload={"episodeId": self.ep, "inputMode": "text"})
        self.request("PATCH", f"/api/v2/doctor/consultations/{consult['id']}", payload={"rawTranscript": "Synthetic coded visit for testing."})
        draft = self.request("POST", f"/api/v2/doctor/consultations/{consult['id']}/drafts")
        approved = self.request("POST", f"/api/v2/doctor/drafts/{draft['id']}/approve")
        code_set = self.resource("coding", {"entries": [{"code": "TEST.1", "label": "Synthetic test only", "match": "Synthetic coded visit"}]})
        self.approve_resource(code_set)
        output = self.create_output("prescription", sourceType="consultation", sourceId=approved["id"])
        candidates = self.request("GET", f"{ROOT}/outputs/{output['id']}/codes")
        self.assertEqual(candidates[0]["code"], "TEST.1")
        output = self.edit_output(output, selectedCodes=["TEST.1"])
        self.request("POST", f"{ROOT}/outputs/{output['id']}/approve", payload={"confirmed": True}, expected=400)
        output = self.edit_output(output, structuredData={"Medicine": "Synthetic medicine", "Dose": "Test entry", "Route": "Test route", "Frequency": "Test frequency", "Duration": "Test duration"}, selectedCodes=["TEST.1"])
        self.request("POST", f"{ROOT}/outputs/{output['id']}/approve", payload={"confirmed": True, "revision": output["revision"] - 1}, expected=409)
        self.request("POST", f"{ROOT}/outputs/{output['id']}/approve", payload={"confirmed": True})
        patient_output = next(o for o in self.workspace("patient")["outputs"] if o["id"] == output["id"])
        self.assertEqual(patient_output["structuredData"]["Medicine"], "Synthetic medicine")

    def test_pdf_extraction_verification_and_library_upload(self):
        import fitz
        with fitz.open() as pdf:
            pdf.new_page().insert_text((72, 72), "Synthetic test report\nPatient: Sarah Jenkins\nRoutine record for review.")
            content = pdf.tobytes()
        response = self.client.post("/api/v2/patient/documents", headers=self.users["patient"]["headers"], files={"file": ("test.pdf", content, "application/pdf")})
        self.assertEqual(response.status_code, 200, response.text)
        doc = response.json()["document"]
        self.assertEqual(doc["status"], "NEEDS_REVIEW")
        self.request("POST", f"/api/v2/care-team/documents/{doc['id']}/verify", "staff")
        resource = self.resource("guideline", {})
        uploaded = self.client.post(f"/api/v2/library/{resource['id']}/file", headers=self.users["doctor"]["headers"], files={"file": ("reference.pdf", content, "application/pdf")})
        self.assertEqual(uploaded.status_code, 200, uploaded.text)
        self.assertIn("Page 1", uploaded.json()["content"])
        self.assertTrue(uploaded.json()["hasFile"])


if __name__ == "__main__":
    unittest.main()
