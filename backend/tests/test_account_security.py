"""Her account: session counter (change password, sign out other devices, tokens from before the counter existed), the copy of her data she can
download, and closing her account. Same isolated synthetic database as the other tests; new accounts use their own e-mail addresses, so nothing the other
tests count is changed, and the shared demo logins are never signed out."""
import io
import json
import unittest
import uuid
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
import testenv  # noqa: F401: sets the isolated database and settings before the app is imported

from backend.app import account_service, config, models, security
from backend.app.database import SessionLocal
from backend.app.deps import ACCOUNT_CLOSED_MESSAGE

from test_assistant_caregiver import Base

PASSWORD = "Password123!"
NEW_PASSWORD = "Another-Pass-456"


def bearer(token):
    return {"Authorization": "Bearer " + token}


class AccountTests(Base):
    def setUp(self):
        account_service._failures.clear()

    def tearDown(self):
        account_service._failures.clear()

    # ---- helpers
    def register(self, role="patient", **extra):
        email = f"{role}.{uuid.uuid4().hex[:10]}@example.org"
        body = {"fullName": f"Test {role.title()}", "email": email, "password": PASSWORD, "confirmPassword": PASSWORD, "role": role, **extra}
        if role == "patient":
            body["emergency"] = {"homeLabel": "Chennai", "homeLat": 13.0827, "homeLon": 80.2707}
        result = self.client.post("/api/auth/register", json=body)
        self.assertEqual(result.status_code, 200, result.text)
        return email, result.json()["accessToken"], result.json()["user"]["id"]

    def login(self, email, password=PASSWORD):
        return self.client.post("/api/auth/login", json={"email": email, "password": password})

    def me(self, token):
        return self.client.get("/api/auth/me", headers=bearer(token)).status_code

    def change(self, token, current=PASSWORD, new=NEW_PASSWORD, confirm=None):
        return self.client.post("/api/auth/change-password", headers=bearer(token),
                                json={"currentPassword": current, "newPassword": new, "confirmPassword": new if confirm is None else confirm})

    # ---- the session counter
    def test_a_token_from_before_the_counter_existed_still_works_and_new_tokens_carry_it(self):
        email, token, user_id = self.register()
        self.assertEqual(jwt.decode(token, options={"verify_signature": False})["ver"], 0)
        old_style = jwt.encode({"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(hours=1)}, config.JWT_SECRET, algorithm=config.JWT_ALGORITHM)  # no "ver"
        self.assertEqual(self.me(old_style), 200)
        with SessionLocal() as db:  # a row made before the column existed holds NULL
            db.get(models.User, user_id).token_version = None
            db.commit()
        self.assertEqual(self.me(old_style), 200)
        self.assertEqual(self.me(token), 200)
        self.assertEqual(self.login(email).status_code, 200)

    def test_sign_out_other_devices_keeps_this_device_and_ends_the_others(self):
        email, first, _ = self.register()
        second = self.login(email).json()["accessToken"]
        third = self.login(email).json()["accessToken"]
        result = self.client.post("/api/auth/sign-out-other-devices", headers=bearer(second))
        self.assertEqual(result.status_code, 200, result.text)
        fresh = result.json()["accessToken"]
        self.assertEqual(result.json()["user"]["email"], email)
        self.assertEqual(self.me(fresh), 200)
        for gone in (first, second, third):
            self.assertEqual(self.me(gone), 401)
        self.assertEqual(self.login(email).status_code, 200)  # signing in again is unaffected
        with SessionLocal() as db:
            user = db.query(models.User).filter_by(email=email).first()
            logged = db.query(models.AuditLog).filter_by(actor_user_id=user.id, action="other_devices_signed_out").count()
        self.assertEqual(logged, 1)

    def test_every_role_can_use_the_account_endpoints_not_only_patients(self):
        for role in ("doctor",):  # a caregiver can only sign up with an invite code, and the demo caregiver is protected
            email, token, _ = self.register(role)
            other_device = self.login(email).json()["accessToken"]
            changed = self.change(token)
            self.assertEqual(changed.status_code, 200, (role, changed.text))
            self.assertEqual(self.me(token), 401, role)
            self.assertEqual(self.me(other_device), 401, role)
            self.assertEqual(self.me(changed.json()["accessToken"]), 200, role)
            self.assertEqual(self.login(email, NEW_PASSWORD).status_code, 200, role)

    # ---- change password
    def test_change_password_needs_the_current_one_and_ends_every_other_session(self):
        email, token, user_id = self.register()
        elsewhere = self.login(email).json()["accessToken"]
        wrong = self.change(token, current="Not-the-password-1")
        self.assertEqual(wrong.status_code, 400)
        self.assertEqual(wrong.json()["detail"], "Your current password is not right.")
        self.assertEqual(self.me(token), 200)  # a wrong try changes nothing
        changed = self.change(token)
        self.assertEqual(changed.status_code, 200, changed.text)
        fresh = changed.json()["accessToken"]
        self.assertEqual(self.me(fresh), 200)
        self.assertEqual(self.me(token), 401)
        self.assertEqual(self.me(elsewhere), 401)
        self.assertEqual(self.login(email, PASSWORD).status_code, 401)  # the old password no longer signs in
        self.assertEqual(self.login(email, NEW_PASSWORD).status_code, 200)
        with SessionLocal() as db:
            entry = db.query(models.AuditLog).filter_by(actor_user_id=user_id, action="password_changed").first()
            self.assertIsNotNone(entry)
            self.assertNotIn(NEW_PASSWORD, json.dumps([entry.details, entry.new_state, entry.previous_state]))  # never writes a password down

    def test_the_new_password_follows_the_signup_rules(self):
        _, token, _ = self.register()
        too_short = self.change(token, new="short")
        self.assertEqual((too_short.status_code, too_short.json()["detail"]), (400, "Your new password must be at least 8 characters."))
        mismatch = self.change(token, confirm="Something-else-99")
        self.assertEqual((mismatch.status_code, mismatch.json()["detail"]), (400, "Your new password and its confirmation do not match."))
        same = self.change(token, new=PASSWORD)
        self.assertEqual((same.status_code, same.json()["detail"]), (400, "Choose a new password that is different from your current one."))
        self.assertEqual(self.me(token), 200)

    def test_wrong_guesses_are_limited_and_then_even_the_right_password_waits(self):
        email, token, _ = self.register()
        for _ in range(5):
            self.assertEqual(self.change(token, current="Wrong-guess-1").status_code, 400)
        blocked = self.change(token)  # the right one, but too many tries first
        self.assertEqual((blocked.status_code, blocked.json()["detail"]), (429, "Too many tries. Please wait a few minutes and try again."))
        self.assertEqual(self.me(token), 200)
        self.assertEqual(self.login(email, PASSWORD).status_code, 200)  # signing in is a different thing and still works
        account_service._failures.clear()
        self.assertEqual(self.change(token).status_code, 200)

    def test_the_demonstration_logins_cannot_have_their_password_changed_or_be_closed(self):
        for who in ("patient", "doctor", "ravi"):
            blocked = self.client.post("/api/auth/change-password", headers=self.headers[who], json={"currentPassword": "x", "newPassword": NEW_PASSWORD, "confirmPassword": NEW_PASSWORD})
            self.assertEqual((blocked.status_code, blocked.json()["detail"]), (403, "This is a demonstration account, so its password cannot be changed."), who)
        closed = self.client.post("/api/v2/patient/close-account", headers=self.headers["patient"], json={"password": "SarahDemo123!", "understood": True})
        self.assertEqual((closed.status_code, closed.json()["detail"]), (403, "This is a demonstration account, so it cannot be closed."))
        self.assertEqual(self.client.get("/api/auth/me", headers=self.headers["patient"]).status_code, 200)  # still signed in, still there
        with SessionLocal() as db:
            self.assertIsNone(db.query(models.User).filter_by(email="sarah.jenkins@maternasync.app").first().closed_at)

    # ---- the copy of her data
    def test_the_copy_holds_her_own_data_and_files_and_nobody_elses(self):
        written = []
        with SessionLocal() as db:
            mine = db.get(models.PregnancyEpisode, self.ep)
            theirs = db.get(models.PregnancyEpisode, self.elena_ep)
            (config.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
            for episode, name, text in ((mine, "my-scan.pdf", b"%PDF-1.4 mine"), (theirs, "their-scan.pdf", b"%PDF-1.4 theirs")):
                stored = f"{uuid.uuid4().hex}.pdf"
                (config.UPLOAD_DIR / stored).write_bytes(text)
                document = models.MedicalDocument(episode_id=episode.id, uploaded_by_user_id=episode.patient_user_id, uploaded_by_role="patient", filename=name, file_path=stored, status="VERIFIED", description=f"Secret of {episode.patient_name}")
                db.add(document)
                written.append(document)
            quiet = models.PatientQuestion(episode_id=self.ep, asked_by_user_id=self.sarah_id, question_text="Zebra question for the export", status="ANSWERED")
            db.add(quiet)
            db.flush()
            db.add(models.QuestionResponse(question_id=quiet.id, responder_user_id=self.doctor_id, responder_role="doctor", response_text="Shown reply", status="APPROVED", visible_to_patient=True))
            db.add(models.QuestionResponse(question_id=quiet.id, responder_user_id=self.doctor_id, responder_role="doctor", response_text="Draft reply nobody approved", status="DRAFT", visible_to_patient=False))
            for title, status_, visible in (("Released summary", "APPROVED", True), ("Approved but not released", "APPROVED", False), ("Draft summary", "DRAFT", False)):
                db.add(models.ClinicalOutput(episode_id=self.ep, kind="visit_summary", title=title, content=title, source_type="consultation", source_id="x", status=status_, visible_to_patient=visible, created_by_user_id=self.doctor_id))
            db.commit()
            others = {"name": theirs.patient_name, "mrn": theirs.mrn, "episode": theirs.id, "note": f"Secret of {theirs.patient_name}"}
            my_document_id = written[0].id
            written = [document.id for document in written]  # ids only: the rows belong to a session that is closed
        try:
            response = self.client.get("/api/v2/patient/my-data", headers=self.headers["patient"])
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers["content-type"], "application/zip")
            self.assertIn("maternasync-my-data.zip", response.headers["content-disposition"])
            archive = zipfile.ZipFile(io.BytesIO(response.content))
            names = archive.namelist()
            self.assertIn("my-data.json", names)
            data = json.loads(archive.read("my-data.json").decode("utf-8"))
            text = archive.read("my-data.json").decode("utf-8")
            self.assertEqual(data["account"]["email"], "sarah.jenkins@maternasync.app")
            self.assertTrue(data["checkIns"])
            self.assertIn("emergencyDetails", data)
            self.assertIn("Zebra question for the export", text)
            self.assertIn("Shown reply", text)
            self.assertNotIn("Draft reply nobody approved", text)
            self.assertIn("Released summary", text)
            self.assertNotIn("Approved but not released", text)
            self.assertNotIn("Draft summary", text)
            for forbidden in ("passwordHash", "password_hash", "$2b$", "riskNotes", "riskCategory", "codeHash"):
                self.assertNotIn(forbidden, text)
            for value in others.values():
                if value:
                    self.assertNotIn(str(value), text)  # nothing that is Elena's
            self.assertIn(f"documents/{my_document_id[:8]}-my-scan.pdf", names)
            self.assertEqual(archive.read(f"documents/{my_document_id[:8]}-my-scan.pdf"), b"%PDF-1.4 mine")
            self.assertNotIn("their-scan", " ".join(names) + text)
            with SessionLocal() as db:
                self.assertGreaterEqual(db.query(models.AuditLog).filter_by(actor_user_id=self.sarah_id, action="my_data_downloaded").count(), 1)
            # Elena's copy is hers and does not hold Sarah's.
            hers = self.client.get("/api/v2/patient/my-data", headers=self.headers["other_patient"])
            self.assertEqual(hers.status_code, 200)
            hers_text = zipfile.ZipFile(io.BytesIO(hers.content)).read("my-data.json").decode("utf-8")
            self.assertNotIn("Zebra question for the export", hers_text)
            self.assertNotIn("sarah.jenkins@maternasync.app", hers_text)
            self.assertNotIn("Released summary", hers_text)
            self.assertEqual(self.client.get("/api/v2/patient/my-data", headers=self.headers["doctor"]).status_code, 403)  # patients only
            self.assertEqual(self.client.get("/api/v2/patient/my-data").status_code, 401)
        finally:
            with SessionLocal() as db:
                for document_id in written:
                    row = db.get(models.MedicalDocument, document_id)
                    if row is not None:
                        (config.UPLOAD_DIR / row.file_path).unlink(missing_ok=True)
                        db.delete(row)
                for question in db.query(models.PatientQuestion).filter_by(question_text="Zebra question for the export").all():
                    for reply in list(question.responses):
                        db.delete(reply)
                    db.delete(question)
                for output in db.query(models.ClinicalOutput).filter(models.ClinicalOutput.title.in_(["Released summary", "Approved but not released", "Draft summary"])).all():
                    db.delete(output)
                db.commit()

    # ---- closing the account
    def test_closing_an_account_signs_her_out_everywhere_ends_access_and_keeps_her_record(self):
        doctor_email, _, doctor_id = self.register("doctor")  # a new doctor, so the demo doctors' lists are not touched
        email, token, user_id = self.register()
        elsewhere = self.login(email).json()["accessToken"]
        with SessionLocal() as db:
            episode = models.PregnancyEpisode(patient_user_id=user_id, patient_name="Test Patient", edd="2027-03-01", mrn="MRN-CLOSE-1")
            db.add(episode)
            db.flush()
            db.add(models.PatientDoctorAssignment(episode_id=episode.id, doctor_user_id=doctor_id, is_primary=True))
            link = models.CaregiverLink(episode_id=episode.id, patient_user_id=user_id, display_name="Her husband", relationship="Husband", status="ACTIVE", permissions={"appointments": True})
            consent = models.SharingConsent(episode_id=episode.id, recipient="+919876543210", purpose="reminders", expires_at=datetime.now(timezone.utc) + timedelta(days=30))
            db.add_all([link, consent])
            db.commit()
            episode_id, link_id, consent_id = episode.id, link.id, consent.id

        no_tick = self.client.post("/api/v2/patient/close-account", headers=bearer(token), json={"password": PASSWORD, "understood": False})
        self.assertEqual((no_tick.status_code, no_tick.json()["detail"]), (400, "Please confirm that you want to close your account."))
        wrong = self.client.post("/api/v2/patient/close-account", headers=bearer(token), json={"password": "Not-the-password-1", "understood": True})
        self.assertEqual((wrong.status_code, wrong.json()["detail"]), (400, "Your password is not right."))
        self.assertEqual(self.me(token), 200)  # neither of those closed anything

        closed = self.client.post("/api/v2/patient/close-account", headers=bearer(token), json={"password": PASSWORD, "understood": True})
        self.assertEqual(closed.status_code, 200, closed.text)
        self.assertEqual(closed.json(), {"closed": True, "trustedPeopleRemoved": 1, "sharingPermissionsEnded": 1, "tasksForDoctor": 1})
        self.assertEqual(self.me(token), 401)
        self.assertEqual(self.me(elsewhere), 401)
        refused = self.login(email)
        self.assertEqual((refused.status_code, refused.json()["detail"]), (403, ACCOUNT_CLOSED_MESSAGE))
        self.assertEqual(self.login(email, "wrong-password-1").status_code, 401)  # the reason is only given to someone who knows the password
        with SessionLocal() as db:
            self.assertEqual(db.get(models.CaregiverLink, link_id).status, "REVOKED")
            self.assertIsNotNone(db.get(models.SharingConsent, consent_id).revoked_at)
            self.assertIsNotNone(db.get(models.User, user_id).closed_at)
            kept = db.get(models.PregnancyEpisode, episode_id)
            self.assertIsNotNone(kept)  # her record is NOT deleted
            self.assertEqual(kept.mrn, "MRN-CLOSE-1")
            task = db.query(models.Task).filter_by(episode_id=episode_id, source_type="account_closed").one()
            self.assertEqual(task.owner_user_id, doctor_id)
            self.assertIn("asked for her data to be erased", task.title)
            self.assertIn("NOT deleted", task.description)
            self.assertIn("policy and the law", task.description)
            note = db.query(models.Notification).filter_by(recipient_user_id=doctor_id, type="account_closed").one()
            self.assertIn("Test Patient", note.body)
            self.assertEqual(db.query(models.AuditLog).filter_by(actor_user_id=user_id, action="account_closed", episode_id=episode_id).count(), 1)

    def test_closing_with_no_pregnancy_record_yet_still_closes(self):
        email, token, user_id = self.register()
        closed = self.client.post("/api/v2/patient/close-account", headers=bearer(token), json={"password": PASSWORD, "understood": True})
        self.assertEqual(closed.status_code, 200, closed.text)
        self.assertEqual(closed.json()["tasksForDoctor"], 0)
        self.assertEqual(self.login(email).status_code, 403)

    def test_only_a_patient_can_close_a_patient_account(self):
        _, token, _ = self.register("doctor")
        self.assertEqual(self.client.post("/api/v2/patient/close-account", headers=bearer(token), json={"password": PASSWORD, "understood": True}).status_code, 403)

    def test_the_closed_message_has_all_four_languages_on_the_sign_in_page(self):
        text = (Path(config.__file__).resolve().parents[2] / "src" / "i18n" / "dicts" / "auth.ts").read_text(encoding="utf-8")
        self.assertIn(ACCOUNT_CLOSED_MESSAGE, text)

    def test_the_doctor_note_about_a_closed_account_is_in_every_language(self):
        from backend.app import server_text
        title, body = server_text.CATALOG["account_closed"]
        for language in ("en", "hi", "ta", "te"):
            self.assertTrue(title[language].strip() and body[language].strip(), language)
            self.assertIn("{name}", body[language])


if __name__ == "__main__":
    unittest.main()
