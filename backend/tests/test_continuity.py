"""Integration tests with an isolated synthetic database and upload directory."""
import json
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

    def resource(self, kind="template", config=None, expected=200, **kwargs):
        data = dict(kind=kind, title="Integration test resource", issuer="Test governance owner", topic="Test", content="Reviewed synthetic material.", sourceUrl="https://www.who.int/publications/i/item/9789241549912", section="Test section", rightsNote="Synthetic test content", reviewDue=(datetime.now(timezone.utc).date() + timedelta(days=30)).isoformat(), configuration=config if config is not None else {"fields": ["Plan"], "required": ["Plan"]})
        data.update(kwargs)
        return self.request("POST", "/api/v2/library", payload=data, expected=expected)

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

    # ---- plain-language visit summary, lab explanation and care companion ----

    def approved_consultation(self, discussion, follow_up=None):
        consult = self.request("POST", "/api/v2/doctor/consultations", payload={"episodeId": self.ep, "inputMode": "text"})
        self.request("PATCH", f"/api/v2/doctor/consultations/{consult['id']}", payload={"rawTranscript": discussion})
        draft = self.request("POST", f"/api/v2/doctor/consultations/{consult['id']}/drafts")
        if follow_up:
            self.request("PATCH", f"/api/v2/doctor/drafts/{draft['id']}", payload={"followUpNextSteps": follow_up})
        return self.request("POST", f"/api/v2/doctor/drafts/{draft['id']}/approve")

    def approve_output(self, output, **kwargs):
        return self.request("POST", f"{ROOT}/outputs/{output['id']}/approve", payload={"confirmed": True, "visibleToPatient": True, **kwargs})

    def patient_output(self, output):
        return next(o for o in self.workspace("patient")["outputs"] if o["id"] == output["id"])

    def test_visit_summary_is_prefilled_and_blocked_until_reviewed(self):
        approved = self.approved_consultation("BP 118/74 today. Discussed GDM screening and diet.")
        output = self.create_output("visit_summary", sourceType="consultation", sourceId=approved["id"], language="hi")
        sections = output["structuredData"]
        self.assertEqual(output["title"], "सरल भाषा में मुलाक़ात का सारांश")
        happened = sections["आपकी मुलाक़ात में क्या हुआ"]
        self.assertIn("BP (रक्तचाप)", happened)
        self.assertIn("GDM (", happened)
        self.assertIn("BP: रक्तचाप", sections["शब्दों की व्याख्या"])
        next_key = "आपके पुष्ट अगले कदम"
        self.assertNotIn("आपके रिकॉर्ड से", sections)  # the system-generated "most recent record" line is never passed on
        self.assertIn("[Clinician to confirm the next steps", sections[next_key])
        self.assertTrue(any(note["level"] == "blocker" for note in output["reviewNotes"]))
        self.assertTrue(any("written in English" in note["text"] for note in output["reviewNotes"]))
        saved = self.edit_output(output, content=output["content"], structuredData=sections)
        self.request("POST", f"{ROOT}/outputs/{output['id']}/approve", payload={"confirmed": True}, expected=400)
        self.request("POST", f"{ROOT}/outputs/{output['id']}/approve", "staff", {"confirmed": True}, expected=403)
        sections = {**sections, next_key: "• अगले दो सप्ताह में ग्लूकोज़ जाँच दोहराएँ।"}
        saved = self.edit_output(saved, content=saved["content"], structuredData=sections)
        self.assertFalse(any(note["level"] == "blocker" for note in saved["reviewNotes"]))
        self.approve_output(saved)
        released = self.patient_output(output)
        self.assertEqual(released["structuredData"][next_key], sections[next_key])
        self.assertNotIn("sourceSnapshot", released)
        self.assertNotIn("reviewNotes", released)
        with SessionLocal() as db:
            event = db.query(models.JourneyEvent).filter_by(episode_id=self.ep, title=output["title"]).first()
            self.assertIn(next_key, event.summary)

    def test_visit_summary_appointment_link_and_general_information(self):
        education = self.approve_resource(self.resource("education", {}, language="en", stage="all", topic="Nutrition", title="Preparing to discuss nutrition", content="Ask your team about nutrition at your next visit."))
        approved = self.approved_consultation("Routine antenatal visit discussed.", follow_up="Return in four weeks.")
        output = self.create_output("visit_summary", sourceType="consultation", sourceId=approved["id"], language="en")
        general = output["structuredData"]["General information (not specific to you)"]
        self.assertIn("Preparing to discuss nutrition", general)
        self.assertIn(f"v{education['version']}", general)
        self.assertEqual(output["structuredData"]["Your confirmed next steps"].splitlines()[0], "Return in four weeks.")
        appointment = self.workspace()["appointments"][0]["id"]
        linked = self.edit_output(output, content=output["content"], structuredData=output["structuredData"], appointmentId=appointment)
        self.assertEqual(linked["appointmentId"], appointment)
        unlinked = self.edit_output(linked, content=linked["content"], structuredData=linked["structuredData"], appointmentId="")
        self.assertIsNone(unlinked["appointmentId"])
        self.request("PATCH", f"{ROOT}/outputs/{output['id']}", payload={"content": "x", "structuredData": {}, "revision": unlinked["revision"], "appointmentId": "not-an-appointment"}, expected=400)
        telugu = self.create_output("visit_summary", sourceType="consultation", sourceId=approved["id"], language="te")  # no approved Telugu education exists
        self.assertTrue(any("No approved education" in note["text"] for note in telugu["reviewNotes"]))
        self.assertNotIn("సాధారణ సమాచారం (మీకు ప్రత్యేకమైనది కాదు)", telugu["structuredData"])

    def test_lab_explanation_reads_report_and_requires_clinician_review(self):
        import fitz
        lines = "Synthetic Lab Report\nPatient: Sarah Jenkins\nHaemoglobin 10.8 g/dL 11.0 - 14.0\nFasting Blood Sugar 92 mg/dL 70 - 100\nHBsAg Non-reactive\nPage 1 of 1"
        with fitz.open() as pdf:
            pdf.new_page().insert_text((72, 72), lines)
            content = pdf.tobytes()
        response = self.client.post("/api/v2/patient/documents", headers=self.users["patient"]["headers"], files={"file": ("lab.pdf", content, "application/pdf")})
        self.assertEqual(response.status_code, 200, response.text)
        doc = response.json()["document"]
        self.request("POST", f"{ROOT}/episodes/{self.ep}/outputs", "doctor", {"kind": "lab_explanation", "sourceType": "document", "sourceId": doc["id"]}, expected=400)  # not yet verified
        self.request("POST", f"/api/v2/care-team/documents/{doc['id']}/verify", "staff")
        self.request("POST", f"{ROOT}/episodes/{self.ep}/outputs", "staff", {"kind": "lab_explanation", "sourceType": "document", "sourceId": doc["id"]}, expected=403)
        output = self.create_output("lab_explanation", sourceType="document", sourceId=doc["id"], language="ta")
        parsed = {row["name"]: row for row in output["sourceSnapshot"]["parsedResults"]}
        self.assertEqual(set(parsed), {"Haemoglobin", "Fasting Blood Sugar", "HBsAg"})
        self.assertEqual(parsed["Haemoglobin"]["position"], "below")
        self.assertEqual(parsed["Fasting Blood Sugar"]["position"], "within")
        self.assertIn("Haemoglobin 10.8 g/dL 11.0 - 14.0", parsed["Haemoglobin"]["originalLine"])
        results = output["structuredData"]["உங்கள் அறிக்கையில் உள்ள முடிவுகள்"]
        self.assertIn("Haemoglobin: 10.8 g/dL (அச்சிடப்பட்ட வரம்பு 11.0–14.0) — அச்சிடப்பட்ட வரம்பை விடக் குறைவு", results)
        self.assertIn("HBsAg: Non-reactive", results)
        self.assertTrue(any("infection screening" in note["text"] for note in output["reviewNotes"]))
        means_key, next_key = "இது உங்களுக்கு என்ன பொருள்", "உறுதி செய்யப்பட்ட உங்கள் அடுத்த படிகள்"
        self.assertIn("[Clinician to", output["structuredData"][means_key])
        saved = self.edit_output(output, content=output["content"], structuredData=output["structuredData"])
        self.request("POST", f"{ROOT}/outputs/{output['id']}/approve", payload={"confirmed": True}, expected=400)
        sections = {**saved["structuredData"], means_key: "உங்கள் ஹீமோகுளோபின் குறைவாக உள்ளது; மருத்துவர் விளக்குவார்.", next_key: "அடுத்த சந்திப்பில் மீண்டும் பரிசோதிக்கவும்."}
        saved = self.edit_output(saved, content=saved["content"], structuredData=sections)
        self.approve_output(saved)
        released = self.patient_output(output)
        self.assertEqual(released["structuredData"][means_key], sections[means_key])
        self.assertNotIn("sourceSnapshot", released)

    def ask(self, question, language="en", role="patient", expected=200):
        return self.request("POST", f"{ROOT}/companion/ask", role, {"question": question, "language": language}, expected)

    def test_companion_routes_safely_and_uses_only_approved_education(self):
        urgent = self.ask("I have heavy bleeding")
        self.assertEqual(urgent["safety"], "urgent")
        self.assertIn({"type": "send_to_care_team"}, urgent["actions"])
        self.assertEqual(self.ask("रक्तस्राव हो रहा है", "hi")["safety"], "urgent")
        self.assertEqual(self.ask("Can I take paracetamol for my headache?")["safety"], "clinical")
        records = self.ask("Where can I upload my report?")
        self.assertEqual((records["intent"], records["actions"][0]["route"]), ("navigate:records", "/patient/records"))
        self.assertEqual(self.ask("என் சந்திப்பு எப்போது", "ta")["intent"], "navigate:appointments")
        self.assertEqual(self.ask("hi")["intent"], "greeting")
        self.assertEqual(self.ask("high")["intent"], "no_match")  # "hi" must not match inside "high"
        self.assertEqual(self.ask("zzzzzz qqqqq")["actions"], [{"type": "send_to_care_team"}])
        draft = self.resource("education", {}, language="hi", stage="all", topic="Nutrition", title="पोषण पर चर्चा की तैयारी", content="अपनी अगली मुलाक़ात में पोषण पर बात करें।")
        reply = self.ask("पोषण", "hi")
        self.assertNotIn(draft["id"], [m["id"] for m in reply["education"]])
        tamil = self.approve_resource(self.resource("education", {}, language="ta", stage="all", topic="Nutrition", title="ஊட்டச்சத்து பற்றி உரையாடத் தயாராகுதல்", content="உங்கள் அடுத்த சந்திப்பில் ஊட்டச்சத்து பற்றிப் பேசுங்கள்."))
        reply = self.ask("ஊட்டச்சத்து", "ta")
        self.assertEqual(reply["intent"], "education")
        self.assertIn(tamil["id"], [m["id"] for m in reply["education"]])
        self.assertTrue(reply["education"][0]["approvedByName"])
        english =self.approve_resource(self.resource("education", {}, language="en", stage="all", topic="Nutrition", title="Preparing to discuss nutrition", content="Ask your team about nutrition at your next visit."))
        fallback = self.ask("what food should I plan", "hi")
        self.assertIn(english["id"], [m["id"] for m in fallback["education"]])
        self.assertIn("अंग्रेज़ी", fallback["message"])
        self.ask("hello", role="doctor", expected=403)
        with SessionLocal() as db:
            entries = db.query(models.AuditLog).filter_by(action="companion_query", actor_user_id=self.users["patient"]["id"]).all()
            self.assertTrue(entries)
            self.assertFalse(any("bleeding" in (e.details or "") for e in entries))

    def test_bulk_approval_is_doctor_only_and_reports_each_failure(self):
        first, second = self.resource("education", {}, topic="Bulk one"), self.resource("education", {}, topic="Bulk two")
        body = {"ids": [first["id"], second["id"], "missing-id", first["id"]], "confirmed": True}
        self.request("POST", "/api/v2/library/approve-batch", "patient", body, expected=403)
        self.request("POST", "/api/v2/library/approve-batch", "staff", body, expected=403)
        self.request("POST", "/api/v2/library/approve-batch", payload={"ids": [first["id"]]}, expected=422)
        result = self.request("POST", "/api/v2/library/approve-batch", payload=body)
        self.assertEqual(result["approved"], [first["id"], second["id"]])
        self.assertEqual([f["id"] for f in result["failed"]], ["missing-id"])
        again = self.request("POST", "/api/v2/library/approve-batch", payload={"ids": [first["id"]], "confirmed": True})
        self.assertEqual(again["approved"], [])
        self.assertIn("Only a draft", again["failed"][0]["reason"])

    def test_multilingual_education_starters_are_seeded_as_drafts(self):
        starters = [r for r in self.request("GET", "/api/v2/library?kind=education") if r["familyId"].startswith("starter-education-")]
        self.assertEqual({r["language"] for r in starters}, {"en", "hi", "ta", "te"})
        self.assertEqual(len(starters), 24)
        self.assertTrue(all(r["status"] == "DRAFT" and not r["usable"] for r in starters))


    # ---- risk review and next action, WhatsApp delivery, explanations, prescription safety, ICD-10, reference library ----
    def test_risk_review_needs_a_doctor_decision_and_never_acts_alone(self):
        rule = self.approve_resource(self.resource("rule", {"metric": "systolic", "operator": "gt", "threshold": 159, "tier": "urgent", "nextAction": "Review this reading today."}, title="Severe-range systolic (test)"))
        reading = {"recordedAt": (datetime.now(timezone.utc) - timedelta(minutes=3)).isoformat(), "systolic": 168, "diastolic": 104, "symptoms": "Synthetic reading"}
        log = self.request("POST", f"{ROOT}/episodes/{self.ep}/logs", "patient", reading)
        trends = self.request("GET", f"{ROOT}/episodes/{self.ep}/trends")
        flag = next(f for f in trends["flags"] if f["ruleId"] == rule["id"] and f["sourceId"] == log["id"])
        self.assertEqual((flag["tier"], flag["nextAction"], flag["confirmed"]), ("urgent", "Review this reading today.", None))
        self.assertEqual(trends["reviewPriority"], "urgent")
        self.assertEqual(trends["flags"][0]["tier"], "urgent")  # most urgent first
        body = {"flagId": flag["id"], "decision": "create_task", "ownerUserId": self.users["staff"]["id"], "note": "Please call today.", "confirmed": True}
        self.assertEqual([t for t in self.request("GET", f"{ROOT}/episodes/{self.ep}/tasks") if t["sourceId"] == flag["id"]], [])  # a flag alone creates no task
        self.request("POST", f"{ROOT}/episodes/{self.ep}/risk-flags/confirm", "staff", body, expected=403)
        self.request("POST", f"{ROOT}/episodes/{self.ep}/risk-flags/confirm", payload={**body, "ownerUserId": None}, expected=422)
        self.request("POST", f"{ROOT}/episodes/{self.ep}/risk-flags/confirm", payload={**body, "decision": "no_action_needed", "note": ""}, expected=422)
        self.request("POST", f"{ROOT}/episodes/{self.ep}/risk-flags/confirm", payload={**body, "ownerUserId": self.users["other"]["id"]}, expected=400)
        self.request("POST", f"{ROOT}/episodes/{self.ep}/risk-flags/confirm", payload={**body, "flagId": "nope:nope"}, expected=404)
        result = self.request("POST", f"{ROOT}/episodes/{self.ep}/risk-flags/confirm", payload=body)
        self.assertEqual(result["task"]["priority"], "urgent")
        self.assertEqual(result["task"]["ownerUserId"], self.users["staff"]["id"])
        self.assertTrue(result["task"]["title"].startswith("Urgent review: Severe-range systolic"))
        self.assertEqual(result["task"]["dueDate"], datetime.now(timezone.utc).date().isoformat())
        self.request("POST", f"{ROOT}/episodes/{self.ep}/risk-flags/confirm", payload=body, expected=409)
        after = next(f for f in self.request("GET", f"{ROOT}/episodes/{self.ep}/trends")["flags"] if f["id"] == flag["id"])
        self.assertEqual((after["confirmed"]["decision"], after["confirmed"]["taskId"]), ("create_task", result["task"]["id"]))
        self.assertTrue(any(t["id"] == result["task"]["id"] for t in self.request("GET", f"{ROOT}/episodes/{self.ep}/tasks")))
        clinic = self.request("GET", ROOT + "/clinic", "staff")
        self.assertIn(next(p for p in clinic["patients"] if p["episodeId"] == self.ep)["reviewPriority"], ("urgent", "soon", "routine", "none"))

    def test_review_rule_validation_and_no_action_decision(self):
        self.resource("rule", {"metric": "diastolic", "operator": "gt", "threshold": 109, "tier": "critical"}, expected=422)
        rule = self.approve_resource(self.resource("rule", {"metric": "diastolic", "operator": "gt", "threshold": 109, "tier": "soon"}, title="Diastolic (test)"))
        self.request("POST", f"{ROOT}/episodes/{self.ep}/logs", "patient", {"recordedAt": (datetime.now(timezone.utc) - timedelta(minutes=2)).isoformat(), "systolic": 150, "diastolic": 112})
        flag = next(f for f in self.request("GET", f"{ROOT}/episodes/{self.ep}/trends")["flags"] if f["ruleId"] == rule["id"])
        self.assertEqual(flag["tier"], "soon")
        done = self.request("POST", f"{ROOT}/episodes/{self.ep}/risk-flags/confirm", payload={"flagId": flag["id"], "decision": "no_action_needed", "note": "Repeat reading was normal.", "confirmed": True})
        self.assertIsNone(done["task"])
        after = next(f for f in self.request("GET", f"{ROOT}/episodes/{self.ep}/trends")["flags"] if f["id"] == flag["id"])
        self.assertEqual(after["confirmed"]["note"], "Repeat reading was normal.")

    # ---- WhatsApp sending, delivery tracking and opt-out ----
    def outreach(self, phone):
        appt = next(a for a in self.workspace()["appointments"] if a["status"] == "scheduled")
        reminder = self.request("POST", f"{ROOT}/episodes/{self.ep}/reminders", "staff", {"kind": "appointment", "title": "Visit reminder", "sourceId": appt["id"], "scheduledAt": datetime.now(timezone.utc).isoformat()})[0]
        consent = self.request("POST", f"{ROOT}/episodes/{self.ep}/consents", "patient", {"recipient": phone, "purpose": "reminders", "expiresAt": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()})
        item = self.request("POST", f"{ROOT}/episodes/{self.ep}/outreach", "staff", {"consentId": consent["id"], "sourceType": "reminder", "sourceId": reminder["id"], "recipient": phone, "confirmed": True})
        return item, consent

    def outreach_state(self, item_id):
        return next(o for o in self.request("GET", f"{ROOT}/episodes/{self.ep}", "staff")["outreach"] if o["id"] == item_id)

    def test_whatsapp_simulator_is_labelled_and_progresses_to_delivered(self):
        item, _ = self.outreach("+917777700001")
        workspace = self.request("GET", f"{ROOT}/episodes/{self.ep}", "staff")
        self.assertEqual(workspace["whatsapp"], {"mode": "simulator", "automatic": True})
        self.request("POST", f"{ROOT}/outreach/{item['id']}/send", "patient", expected=403)
        sent = self.request("POST", f"{ROOT}/outreach/{item['id']}/send", "staff")
        self.assertEqual((sent["status"], sent["provider"]), ("SENT", "simulator"))
        self.assertTrue(sent["providerReference"].startswith("sim-"))
        self.request("POST", f"{ROOT}/outreach/{item['id']}/send", "staff", expected=409)  # no double send
        with SessionLocal() as db:
            db.get(models.Outreach, item["id"]).sent_at = datetime.now(timezone.utc) - timedelta(seconds=30)
            db.commit()
        delivered = self.outreach_state(item["id"])
        self.assertEqual(delivered["status"], "DELIVERED")
        self.assertIsNotNone(delivered["deliveredAt"])
        self.assertNotIn("Sarah", delivered["message"])

    def test_whatsapp_manual_mode_records_staff_send_without_claiming_delivery(self):
        with patch.dict(os.environ, {"MATERNASYNC_WHATSAPP_PROVIDER": "manual"}):
            item, _ = self.outreach("+917777700002")
            self.assertEqual(self.request("GET", f"{ROOT}/episodes/{self.ep}", "staff")["whatsapp"], {"mode": "manual", "automatic": False})
            self.request("POST", f"{ROOT}/outreach/{item['id']}/send", "staff", expected=409)
            self.request("POST", f"{ROOT}/outreach/{item['id']}/open", "staff")
            marked = self.request("POST", f"{ROOT}/outreach/{item['id']}/mark-sent", "staff")
            self.assertEqual((marked["status"], marked["provider"]), ("MANUALLY_SENT", "manual"))
            self.request("POST", f"{ROOT}/outreach/{item['id']}/mark-sent", "staff", expected=409)

    def test_whatsapp_cloud_api_sends_minimal_text_and_records_failures(self):
        env = {"MATERNASYNC_WHATSAPP_PROVIDER": "cloud_api", "MATERNASYNC_WHATSAPP_TOKEN": "test-token", "MATERNASYNC_WHATSAPP_PHONE_ID": "12345"}
        from backend.app import whatsapp
        with patch.dict(os.environ, env):
            item, _ = self.outreach("+917777700003")
            with patch.object(whatsapp, "_post", side_effect=whatsapp.WhatsAppError("The WhatsApp provider rejected the message (HTTP 400).")) as post:
                self.request("POST", f"{ROOT}/outreach/{item['id']}/send", "staff", expected=502)
            self.assertEqual(self.outreach_state(item["id"])["status"], "FAILED")
            self.assertIn("rejected", self.outreach_state(item["id"])["failedReason"])
            with patch.object(whatsapp, "_post", return_value={"messages": [{"id": "wamid.TEST1"}]}) as post:
                sent = self.request("POST", f"{ROOT}/outreach/{item['id']}/send", "staff")
            url, headers, payload = post.call_args.args
            self.assertTrue(url.endswith("/12345/messages"))
            self.assertEqual(headers["Authorization"], "Bearer test-token")
            self.assertEqual((payload["to"], payload["type"]), ("917777700003", "text"))
            self.assertEqual(payload["text"]["body"], "MaternaSync: you have a care reminder. Please sign in to view it.")
            self.assertEqual((sent["status"], sent["providerReference"], sent["failedReason"]), ("SENT", "wamid.TEST1", None))
            second, _ = self.outreach("+917777700004")
            with patch.dict(os.environ, {"MATERNASYNC_WHATSAPP_TEMPLATE": "care_reminder", "MATERNASYNC_WHATSAPP_TEMPLATE_LANGUAGE": "hi"}), patch.object(whatsapp, "_post", return_value={"messages": [{"id": "wamid.TEST2"}]}) as post:
                self.request("POST", f"{ROOT}/outreach/{second['id']}/send", "staff")
            self.assertEqual(post.call_args.args[2]["template"], {"name": "care_reminder", "language": {"code": "hi"}})

    def post_webhook(self, payload, secret="whsec", signature=None):
        import hashlib
        import hmac
        raw = json.dumps(payload).encode()
        signature = signature or "sha256=" + hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
        return self.client.post("/api/v2/webhooks/whatsapp", content=raw, headers={"X-Hub-Signature-256": signature, "Content-Type": "application/json"})

    def test_whatsapp_webhook_tracks_delivery_and_honours_opt_out(self):
        env = {"MATERNASYNC_WHATSAPP_PROVIDER": "cloud_api", "MATERNASYNC_WHATSAPP_TOKEN": "t", "MATERNASYNC_WHATSAPP_PHONE_ID": "1", "MATERNASYNC_WHATSAPP_APP_SECRET": "whsec", "MATERNASYNC_WHATSAPP_VERIFY_TOKEN": "verify-me"}
        from backend.app import whatsapp
        statuses = lambda ref, status, **extra: {"entry": [{"changes": [{"value": {"statuses": [{"id": ref, "status": status, **extra}]}}]}]}
        with patch.dict(os.environ, env):
            self.assertEqual(self.client.get("/api/v2/webhooks/whatsapp", params={"hub.mode": "subscribe", "hub.verify_token": "verify-me", "hub.challenge": "abc123"}).text, "abc123")
            self.assertEqual(self.client.get("/api/v2/webhooks/whatsapp", params={"hub.mode": "subscribe", "hub.verify_token": "wrong", "hub.challenge": "x"}).status_code, 403)
            item, consent = self.outreach("+917777700005")
            with patch.object(whatsapp, "_post", return_value={"messages": [{"id": "wamid.HOOK"}]}):
                self.request("POST", f"{ROOT}/outreach/{item['id']}/send", "staff")
            self.assertEqual(self.post_webhook(statuses("wamid.HOOK", "delivered"), signature="sha256=bad").status_code, 403)
            self.assertEqual(self.outreach_state(item["id"])["status"], "SENT")
            self.assertEqual(self.post_webhook(statuses("wamid.HOOK", "delivered")).json()["statusUpdates"], 1)
            self.assertEqual(self.outreach_state(item["id"])["status"], "DELIVERED")
            self.assertEqual(self.post_webhook(statuses("wamid.HOOK", "sent")).json()["statusUpdates"], 0)  # never moves backwards
            self.assertEqual(self.post_webhook(statuses("wamid.HOOK", "failed", errors=[{"title": "late"}])).json()["statusUpdates"], 0)  # cannot undo a confirmed delivery
            self.assertEqual(self.post_webhook(statuses("wamid.HOOK", "read")).json()["statusUpdates"], 1)
            self.assertEqual(self.outreach_state(item["id"])["status"], "READ")
            other, _ = self.outreach("+917777700005")  # same recipient: a second prepared message
            stop = {"entry": [{"changes": [{"value": {"messages": [{"from": "917777700005", "type": "text", "text": {"body": " stop "}}]}}]}]}
            self.assertEqual(self.post_webhook(stop).json()["optOuts"], 2)
            self.assertEqual(self.outreach_state(other["id"])["status"], "CANCELLED")
            self.assertTrue(next(c for c in self.workspace()["consents"] if c["id"] == consent["id"])["revokedAt"])
        with patch.dict(os.environ, {**env, "MATERNASYNC_WHATSAPP_PROVIDER": "simulator"}):
            self.assertEqual(self.post_webhook(statuses("wamid.HOOK", "read")).status_code, 403)  # webhook is off outside cloud_api mode

    # ---- patient explanation generator ----
    def test_explanation_uses_only_approved_condition_text(self):
        self.approve_resource(self.resource("education", {}, language="en", stage="all", topic="Gestational diabetes", title="About gestational diabetes (test)", content="Gestational diabetes means higher blood sugar first found in pregnancy."))
        approved = self.approved_consultation("GDM screening discussed. Anaemia reviewed. USG planned.", follow_up="Repeat OGTT in 2 weeks.")
        output = self.create_output("explanation", sourceType="consultation", sourceId=approved["id"], language="en")
        sections = output["structuredData"]
        self.assertIn("higher blood sugar first found in pregnancy", sections["About gestational diabetes (test)"])
        self.assertEqual(output["sectionKinds"]["About gestational diabetes (test)"], "about")
        notes = " ".join(n["text"] for n in output["reviewNotes"])
        self.assertIn("Anaemia in pregnancy", notes)
        self.assertIn("Ultrasound scans in pregnancy", notes)
        self.assertNotIn("Gestational diabetes”", notes)
        self.assertNotIn("Anaemia in pregnancy", " ".join(sections))
        self.assertIn("Repeat OGTT", sections["Your confirmed next steps"])
        saved = self.edit_output(output, content=output["content"], structuredData=sections)
        self.approve_output(saved)
        released = self.patient_output(output)
        self.assertEqual(released["title"], "Plain-language explanation")
        self.assertIn("About gestational diabetes (test)", released["structuredData"])
        self.assertNotIn("reviewNotes", released)
        undocumented = self.approved_consultation("Routine antenatal visit.")
        empty = self.create_output("explanation", sourceType="consultation", sourceId=undocumented["id"], language="en")
        self.assertTrue(any("No known condition topic" in n["text"] for n in empty["reviewNotes"]))

    # ---- prescription safety check ----
    def prescription(self, medicine, consultation=None):
        approved = consultation or self.approved_consultation("Synthetic prescribing visit for the safety check.")
        output = self.create_output("prescription", sourceType="consultation", sourceId=approved["id"])
        fields = {"Medicine": medicine, "Dose": "Test entry", "Route": "Test route", "Frequency": "Test frequency", "Duration": "Test duration", "Instructions": ""}
        return self.edit_output(output, content="Reviewed prescription.", structuredData=fields)

    def test_prescription_safety_check_requires_acknowledgement_of_every_alert(self):
        plain = self.prescription("Paracetamol 500 mg")
        before = self.request("GET", f"{ROOT}/outputs/{plain['id']}/safety-check")
        self.assertEqual(before["status"], "unchecked")
        self.assertIn("not a complete drug-interaction database", before["limitation"])
        self.request("GET", f"{ROOT}/outputs/{plain['id']}/safety-check", "staff", expected=403)
        safety = self.approve_resource(self.resource("interaction", {
            "pairs": [{"a": {"name": "levothyroxine", "aliases": ["thyroxine"]}, "b": {"name": "calcium carbonate", "aliases": ["calcium"]}, "severity": "moderate",
                       "effect": "Calcium can reduce how much levothyroxine is absorbed.", "management": "Separate the doses.", "sourceUrl": "https://dailymed.nlm.nih.gov/", "quote": "Test quote."}],
            "cautions": [{"name": "lisinopril", "aliases": ["enalapril"], "severity": "major", "statement": "The label warns of fetal harm.", "sourceUrl": "https://dailymed.nlm.nih.gov/"}]}, title="Drug safety list (test)"))
        self.assertEqual(self.request("GET", f"{ROOT}/outputs/{plain['id']}/safety-check")["alerts"], [])
        checked = self.request("GET", f"{ROOT}/outputs/{plain['id']}/safety-check")
        self.assertEqual((checked["status"], checked["checkedAgainst"][0]["pairs"], checked["checkedAgainst"][0]["cautions"]), ("checked", 1, 1))
        # An interaction inside one prescription
        both = self.prescription("Levothyroxine 50 mcg, Tab. Calcium carbonate 500 mg")
        alerts = self.request("GET", f"{ROOT}/outputs/{both['id']}/safety-check")["alerts"]
        self.assertEqual([(a["kind"], a["severity"]) for a in alerts], [("interaction", "moderate")])
        self.assertEqual(alerts[0]["sourceUrl"], "https://dailymed.nlm.nih.gov/")
        self.request("POST", f"{ROOT}/outputs/{both['id']}/approve", payload={"confirmed": True}, expected=409)
        self.request("POST", f"{ROOT}/outputs/{both['id']}/approve", payload={"confirmed": True, "acknowledgedAlerts": ["not-the-key"]}, expected=409)
        self.request("POST", f"{ROOT}/outputs/{both['id']}/approve", payload={"confirmed": True, "acknowledgedAlerts": [a["key"] for a in alerts]})
        with SessionLocal() as db:
            entry = db.query(models.AuditLog).filter_by(action="prescription_safety_check_recorded", object_id=both["id"]).one()
            self.assertIn("Drug safety list (test)", entry.details)
        # Pregnancy caution, and an interaction with an earlier approved prescription
        caution = self.prescription("Enalapril 5 mg")
        self.assertEqual([a["kind"] for a in self.request("GET", f"{ROOT}/outputs/{caution['id']}/safety-check")["alerts"]], ["pregnancy"])
        earlier = self.prescription("Calcium carbonate 500 mg")
        with_earlier = self.request("GET", f"{ROOT}/outputs/{earlier['id']}/safety-check")["alerts"]
        self.assertTrue(with_earlier and with_earlier[0]["withEarlier"])
        # Recorded allergy
        with SessionLocal() as db:
            episode = db.get(models.PregnancyEpisode, self.ep)
            original = list(episode.allergies or [])
            episode.allergies = ["Penicillin (Hives)", "Latex (Mild)", "Penicillin (Hives)"]  # the format seeded patients use; a repeated entry alerts once
            db.commit()
        try:
            for medicine, expected in (("Penicillin V 250 mg", ["A recorded allergy matches this medicine: Penicillin (Hives)."]), ("Paracetamol 500 mg", [])):
                alerts = self.request("GET", f"{ROOT}/outputs/{self.prescription(medicine)['id']}/safety-check")["alerts"]
                self.assertEqual([a["message"] for a in alerts if a["kind"] == "allergy"], expected)
            from backend.app import drug_safety
            self.assertEqual([a["kind"] for a in drug_safety.check("Tab. Penicillin V", [], ["Penicillins"], [])["alerts"]], ["allergy"])  # plural
        finally:
            with SessionLocal() as db:
                db.get(models.PregnancyEpisode, self.ep).allergies = original
                db.commit()
        self.assertTrue(safety["id"])

    def test_seeded_drug_safety_list_is_valid_and_matches_real_prescriptions(self):
        seeded = next(r for r in self.request("GET", "/api/v2/library?kind=interaction") if r["familyId"] == "starter-drug-safety-labels")
        self.assertEqual((seeded["status"], seeded["usable"]), ("DRAFT", False))
        pairs, cautions = seeded["configuration"]["pairs"], seeded["configuration"]["cautions"]
        self.assertGreaterEqual(len(pairs), 15)
        self.assertGreaterEqual(len(cautions), 25)
        self.assertTrue(all(x["sourceUrl"].startswith("https://dailymed.nlm.nih.gov/") and x["quote"] for x in pairs + cautions))
        self.approve_resource(seeded)
        def kinds(medicine):
            # Other tests leave their own safety sets and approved prescriptions in this shared episode, so look at the seeded set
            # and at this prescription alone (the check against earlier prescriptions is covered by the test above).
            alerts = self.request("GET", f"{ROOT}/outputs/{self.prescription(medicine)['id']}/safety-check")["alerts"]
            return [(a["kind"], a["severity"]) for a in alerts if a["setTitle"] == seeded["title"] and not a.get("withEarlier")]
        self.assertEqual(kinds("Paracetamol 500 mg"), [])
        self.assertIn(("pregnancy", "major"), kinds("Tab. Misoprostol 200 mcg"))
        self.assertEqual(kinds("Lisinopril 5 mg"), [("pregnancy", "major")])
        self.assertEqual(kinds("Labetalol 100 mg, Nifedipine 10 mg"), [("interaction", "minor")])
        self.assertEqual(kinds("Levothyroxine 50 mcg + Ferrous sulphate 200 mg"), [("interaction", "moderate")])
        self.assertEqual(kinds("Methyldopa 250 mg, Ferrous gluconate"), [("interaction", "moderate")])
        self.assertEqual(kinds("Aspirin 75 mg"), [])  # doctor-directed low-dose aspirin is not flagged on its own

    # ---- ICD-10 candidates ----
    def test_icd10_sets_are_seeded_valid_and_prefer_the_most_specific_phrase(self):
        sets = [r for r in self.request("GET", "/api/v2/library?kind=coding") if r["familyId"].startswith("starter-icd10-who-obstetric")]
        self.assertEqual(len(sets), 2)
        codes = {e["code"] for s in sets for e in s["configuration"]["entries"]}
        self.assertEqual(len(codes), 80)
        self.assertTrue(all(len(s["configuration"]["entries"]) <= 200 and s["status"] == "DRAFT" for s in sets))
        self.request("POST", "/api/v2/library/approve-batch", payload={"ids": [s["id"] for s in sets], "confirmed": True})
        approved = self.approved_consultation("Gestational diabetes diagnosed at booking. Delivered by LSCS. Secondary postpartum haemorrhage on day 6.")
        output = self.create_output("note", sourceType="consultation", sourceId=approved["id"])
        found = {c["code"]: c for c in self.request("GET", f"{ROOT}/outputs/{output['id']}/codes")}
        self.assertIn("O24.4", found)
        self.assertIn("O72.2", found)
        self.assertNotIn("O72.1", found)  # "postpartum haemorrhage" is inside the more specific phrase
        self.assertEqual(found["O24.4"]["label"], "Diabetes mellitus arising in pregnancy")

    # ---- reference library: real documents only ----
    def test_reference_library_holds_real_documents_and_no_synthetic_ones(self):
        from backend.app.reference_library import load_manifest, sync_reference_library
        manifest = load_manifest()
        self.assertGreaterEqual(len(manifest), 70)
        self.assertEqual(len({e["id"] for e in manifest}), len(manifest))
        for entry in manifest:
            self.assertTrue(entry["source_url"].startswith("https://"), entry["id"])
            self.assertTrue(entry["summary"] and entry["rights"] and entry["version_note"], entry["id"])
            self.assertTrue(entry.get("document_url") or not entry.get("passage_search"), entry["id"])
            self.assertNotIn("fictional", (entry["issuer"] + entry["title"]).lower())
        library = {r["familyId"]: r for r in self.request("GET", "/api/v2/library?kind=guideline")}
        self.assertEqual(sum(f.startswith("ref-") for f in library), len(manifest))
        self.assertTrue(all(r["status"] == "DRAFT" and not r["usable"] for f, r in library.items() if f.startswith("ref-")))
        for retired in ("starter-fogsi", "starter-icmr", "starter-who", "starter-nice"):
            self.assertNotIn(retired, library)
        issuers = {r["issuer"] for r in library.values()}
        for expected in ("WHO", "NICE", "RCOG", "ACOG", "SMFM", "RANZCOG", "FIGO", "FOGSI-ICOG"):
            self.assertTrue(any(i.startswith(expected) for i in issuers), expected)
        self.assertTrue(any("ICMR" in i for i in issuers) and any("Ministry of Health" in i for i in issuers))
        # Synthetic demonstration documents are removed when found
        with SessionLocal() as db:
            doctor = db.query(models.User).filter_by(role="doctor").first()
            db.add(models.GuidelineSource(title="Leftover demo", issuing_organization="Fictional Perinatal Alliance", category="GENERAL", document_type="Other",
                                          filename="demo.pdf", file_path="demo.pdf", uploaded_by_user_id=doctor.id, uploaded_by_role="doctor", is_demo_content=True, status="APPROVED"))
            db.commit()
            sync_reference_library(db)
            self.assertEqual(db.query(models.GuidelineSource).filter(models.GuidelineSource.is_demo_content.is_(True)).count(), 0)

    def test_guideline_sources_can_be_approved_in_a_batch_by_doctors_only(self):
        with SessionLocal() as db:
            doctor = db.query(models.User).filter_by(role="doctor").first()
            ids = []
            for n in range(2):
                source = models.GuidelineSource(title=f"Batch test {n}", issuing_organization="Test publisher", category="GENERAL", document_type="Other", filename="t.pdf",
                                                file_path="t.pdf", uploaded_by_user_id=doctor.id, uploaded_by_role="doctor", status="AWAITING_REVIEW")
                db.add(source)
                db.flush()
                ids.append(source.id)
            db.commit()
        url = "/api/v2/guidelines/sources/approve-batch"
        self.request("POST", url, "staff", {"ids": ids, "confirmed": True}, expected=403)
        self.request("POST", url, payload={"ids": ids, "confirmed": False}, expected=422)
        result = self.request("POST", url, payload={"ids": ids + ["missing"], "confirmed": True})
        self.assertEqual(result["approved"], ids)
        self.assertEqual([f["id"] for f in result["failed"]], ["missing"])


class PlainLanguageUnitTests(unittest.TestCase):
    REPORT = "CITY LAB\nPatient: Sarah   Age: 28 Years\nHaemoglobin 10.8 g/dL 11.0 - 14.0 Low\nTSH 2.1 uIU/mL 0.4 - 4.0\nTotal Leucocyte Count 14,800 /cumm 4000-11000\nHbA1c 5.4 % <5.7\nBlood Group: B Positive\nBilirubin Total 0.8 mg/dL 0.2 - 1.2\nPage 1 of 2"

    def parse(self, text):
        from backend.app.plain_language import parse_lab_results
        return {r["name"]: r for r in parse_lab_results(text)}

    def test_single_line_rows(self):
        rows = self.parse(self.REPORT)
        self.assertEqual(rows["Haemoglobin"]["position"], "below")
        self.assertEqual(rows["Haemoglobin"]["printedFlag"], "low")
        self.assertEqual(rows["TSH"]["position"], "within")
        self.assertEqual(rows["Total Leucocyte Count"]["position"], "above")
        self.assertEqual(rows["HbA1c"]["rangeText"], "< 5.7")
        self.assertEqual(rows["Blood Group"]["valueText"], "B Positive")
        self.assertIsNone(rows["Bilirubin Total"]["testId"])
        self.assertFalse(any(name.startswith(("Page", "Patient")) for name in rows))

    def test_cell_per_line_layout_and_no_invented_values(self):
        rows = self.parse("Haemoglobin\n10.8\ng/dL\n11.0 - 14.0\nLow\nFasting Blood Sugar\n92\nmg/dL\n70 - 100\nTSH\n")
        self.assertEqual(rows["Haemoglobin"]["unit"], "g/dL")
        self.assertEqual(rows["Fasting Blood Sugar"]["position"], "within")
        self.assertNotIn("TSH", rows)  # a name with no value is never filled in
        self.assertEqual(self.parse("Haemoglobin was discussed at the visit. Page 2"), {})

    def test_abbreviations_are_explained_once_and_translation_is_flagged(self):
        from types import SimpleNamespace
        from backend.app.plain_language import build_visit_summary, explain_terms, review_notes
        text, used = explain_terms("BP was high. BP rechecked. Hb 10.", "en")
        self.assertEqual(text.count("blood pressure"), 1)
        self.assertEqual([abbr for abbr, _ in used], ["BP", "Hb"])
        episode = SimpleNamespace(gestational_age_weeks=30, gestational_age_days=0)
        draft = build_visit_summary(kind="visit_summary", language="te", episode=episode, consult_date="01-01-2026",
            approved_content={"documentedDiscussion": "Reviewed growth scan and discussed the plan for delivery with the patient today.", "followUpNextSteps": "Return in two weeks."})
        output = SimpleNamespace(kind="visit_summary", language="te", content=draft["content"], structured_data=draft["structured"], source_snapshot={})
        self.assertTrue(any("written in English" in n["text"] for n in review_notes(output)))
        self.assertFalse(any(n["level"] == "blocker" for n in review_notes(output)))


class CompanionUnitTests(unittest.TestCase):
    """Every suggestion chip the patient sees must route correctly in every language."""
    CHIPS = {
        "en": [("Open my daily check-in", "navigate:daily_log"), ("What should I eat in pregnancy?", "education"), ("Tell me about exercise in pregnancy", "education"),
               ("Where can I upload my report?", "navigate:records"), ("When is my next appointment?", "navigate:appointments"), ("Tell me about breastfeeding", "education")],
        "hi": [("मेरी दैनिक जानकारी खोलें", "navigate:daily_log"), ("गर्भावस्था में क्या खाना चाहिए?", "education"), ("गर्भावस्था में व्यायाम के बारे में बताइए", "education"),
               ("मैं अपनी रिपोर्ट कहाँ अपलोड करूँ?", "navigate:records"), ("मेरी अगली अपॉइंटमेंट कब है?", "navigate:appointments"), ("स्तनपान के बारे में बताइए", "education")],
        "ta": [("என் தினசரிப் பதிவைத் திறக்கவும்", "navigate:daily_log"), ("கர்ப்பகாலத்தில் என்ன உணவு சாப்பிட வேண்டும்?", "education"), ("கர்ப்பகாலத்தில் உடற்பயிற்சி பற்றிச் சொல்லுங்கள்", "education"),
               ("என் அறிக்கையை எங்கே பதிவேற்றுவது?", "navigate:records"), ("என் அடுத்த சந்திப்பு எப்போது?", "navigate:appointments"), ("தாய்ப்பால் பற்றிச் சொல்லுங்கள்", "education")],
        "te": [("నా రోజువారీ నమోదును తెరవండి", "navigate:daily_log"), ("గర్భధారణలో ఏ ఆహారం తీసుకోవాలి?", "education"), ("గర్భధారణలో వ్యాయామం గురించి చెప్పండి", "education"),
               ("నా నివేదికను ఎక్కడ అప్‌లోడ్ చేయాలి?", "navigate:records"), ("నా తదుపరి అపాయింట్‌మెంట్ ఎప్పుడు?", "navigate:appointments"), ("తల్లిపాలు ఇవ్వడం గురించి చెప్పండి", "education")],
    }
    TOPICS = [("Nutrition", "first"), ("Safe movement", "second"), ("Lactation", "postpartum")]

    def modules(self):
        return [{"id": topic, "title": f"{topic} guide", "topic": topic, "stage": stage, "content": "Reviewed discussion guide."} for topic, stage in self.TOPICS]

    def test_every_suggestion_routes_correctly_in_every_language(self):
        from backend.app.companion import respond
        for language, chips in self.CHIPS.items():
            for question, expected in chips:
                with self.subTest(language=language, question=question):
                    # A patient in the third trimester must still find first-trimester topics.
                    reply = respond(question, language, self.modules(), stage="third")
                    self.assertEqual(reply["intent"], expected)

    def test_urgent_and_medical_wording_never_reaches_education(self):
        from backend.app.companion import respond
        for question, safety in [("I have heavy bleeding and want to know about nutrition", "urgent"), ("मेरे पेट में तेज़ दर्द है", "urgent"),
                                 ("எனக்கு கடுமையான தலைவலி", "urgent"), ("బిడ్డ కదలడం లేదు", "urgent"),
                                 ("Is it safe to eat papaya?", "clinical"), ("क्या मैं यह दवा ले सकती हूँ", "clinical")]:
            with self.subTest(question=question):
                reply = respond(question, "en", self.modules())
                self.assertEqual(reply["safety"], safety)
                self.assertEqual(reply["education"], [])


if __name__ == "__main__":
    unittest.main()
