"""Real auth endpoints against an isolated DB; Twilio is replaced, never contacted."""
import concurrent.futures
import hashlib
import hmac
import time
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import testenv  # noqa: F401
from test_assistant_caregiver import Base
from backend.app import config, models, phone_provider
from backend.app.database import SessionLocal
from backend.app.main import app
from backend.app.routers.phone_auth import normalize_phone


class FakeVerify:
    def __init__(self):
        self.sent = []
        self.pending = {}
        self.failed = False
        self.delay = 0

    def send(self, phone):
        if self.failed:
            raise phone_provider.ProviderUnavailable()
        self.sent.append(phone)
        sid = "VE" + format(len(self.sent), "032x")
        self.pending[sid] = phone
        return sid

    def check(self, sid, phone, code):
        time.sleep(self.delay)
        if self.failed:
            raise phone_provider.ProviderUnavailable()
        if self.pending.get(sid) == phone and code == "246810":
            del self.pending[sid]
            return True
        return False


class PhoneAuthTests(Base):
    def setUp(self):
        self.provider = FakeVerify()
        app.dependency_overrides[phone_provider.get_provider] = lambda: self.provider
        self.config_patch = patch.object(phone_provider, "configured", return_value=True)
        self.config_patch.start()

    def tearDown(self):
        self.config_patch.stop()
        app.dependency_overrides.pop(phone_provider.get_provider, None)
        with SessionLocal() as db:
            db.query(models.PhoneChallenge).delete()
            db.query(models.LoginPhone).delete()
            db.query(models.PhoneAuthLimit).delete()
            for uid in (self.sarah_id, self.doctor_id):
                user = db.get(models.User, uid)
                user.closed_at = None
                user.token_version = 0
            db.commit()

    def cool(self):
        with SessionLocal() as db:
            db.query(models.PhoneAuthLimit).update({"expires_at": datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=1)})
            db.commit()

    def enroll(self, role="patient", phone="+919800000001", password="SarahDemo123!"):
        data = self.call("POST", "/api/auth/phone/enroll/start", role, {"phone": phone, "password": password})
        self.call("POST", "/api/auth/phone/enroll/verify", role, {"challengeId": data["challengeId"], "code": "246810"})
        self.cool()
        return data

    def start(self, phone="+919800000001"):
        result = self.client.post("/api/auth/otp/start", json={"phone": phone})
        self.assertEqual(result.status_code, 200, result.text)
        return result.json()

    def check(self, data, code="246810"):
        return self.client.post("/api/auth/otp/verify", json={"challengeId": data["challengeId"], "code": code})

    def test_patient_phone_login_is_one_time_and_keeps_episode_access(self):
        self.enroll()
        data = self.start("9800000001")
        response = self.check(data)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["user"]["id"], self.sarah_id)
        self.assertEqual(response.json()["user"]["role"], "patient")
        headers = {"Authorization": "Bearer " + response.json()["accessToken"]}
        self.assertEqual(self.client.get("/api/v2/patient/dashboard", headers=headers).status_code, 200)
        self.assertEqual(self.client.get("/api/v2/doctor/patients", headers=headers).status_code, 403)
        self.assertEqual(self.check(data).status_code, 401)

    def test_doctor_and_caregiver_roles_are_resolved_from_the_database(self):
        for role, phone, password, expected in [("doctor", "+919800000002", "MaternaDemo123!", "doctor"),
                                                 ("ravi", "+919800000003", "RaviDemo123!", "caregiver")]:
            self.enroll(role, phone, password)
            result = self.check(self.start(phone))
            self.assertEqual(result.status_code, 200, result.text)
            self.assertEqual(result.json()["user"]["role"], expected)

    def test_unknown_number_gets_generic_challenge_without_sms(self):
        data = self.start()
        self.assertEqual(self.provider.sent, [])
        self.assertNotIn("user", data)
        self.assertNotIn("providerSid", data)
        self.assertEqual(self.check(data).status_code, 401)

    def test_enrollment_requires_password_and_cannot_be_used_as_login(self):
        payload = {"phone": "+919800000001", "password": "wrong"}
        self.call("POST", "/api/auth/phone/enroll/start", "patient", payload, expected=401)
        self.assertEqual(self.provider.sent, [])
        self.cool()
        payload["password"] = "SarahDemo123!"
        data = self.call("POST", "/api/auth/phone/enroll/start", "patient", payload)
        self.assertEqual(self.check(data).status_code, 401)
        self.call("POST", "/api/auth/phone/enroll/verify", "doctor", {"challengeId": data["challengeId"], "code": "246810"}, expected=401)
        self.call("POST", "/api/auth/phone/enroll/verify", "patient", {"challengeId": data["challengeId"], "code": "246810"})

    def test_cannot_claim_another_accounts_verified_number(self):
        self.enroll()
        self.call("POST", "/api/auth/phone/enroll/start", "doctor", {"phone": "+919800000001", "password": "MaternaDemo123!"}, expected=409)

    def test_wrong_code_attempt_limit_and_expiry(self):
        self.enroll()
        data = self.start()
        for _ in range(5):
            self.assertEqual(self.check(data, "000000").status_code, 401)
        self.assertEqual(self.check(data).status_code, 401)
        self.cool()
        data = self.start()
        with SessionLocal() as db:
            db.get(models.PhoneChallenge, data["challengeId"]).expires_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=1)
            db.commit()
        self.assertEqual(self.check(data).status_code, 401)

    def test_resend_throttled_and_does_not_reset_expiry_or_attempts(self):
        self.enroll()
        data = self.start()
        body = {"challengeId": data["challengeId"]}
        self.assertEqual(self.client.post("/api/auth/otp/resend", json=body).status_code, 429)
        self.check(data, "000000")
        self.cool()
        resent = self.client.post("/api/auth/otp/resend", json=body)
        self.assertEqual(resent.status_code, 200, resent.text)
        self.assertEqual(resent.json()["expiresAt"], data["expiresAt"])
        with SessionLocal() as db:
            self.assertEqual(db.get(models.PhoneChallenge, data["challengeId"]).attempts, 1)

    def limit_key(self, scope, value):
        return hmac.new(config.JWT_SECRET.encode(), f"{scope}:{value}".encode(), hashlib.sha256).hexdigest()

    def limits_snapshot(self):
        with SessionLocal() as db:
            return {row.key: (row.count, row.expires_at) for row in db.query(models.PhoneAuthLimit).all()}

    def test_repeated_clicks_after_linking_do_not_exhaust_hourly_allowance(self):
        phone = "+919800000001"
        data = self.call("POST", "/api/auth/phone/enroll/start", "patient", {"phone": phone, "password": "SarahDemo123!"})
        self.call("POST", "/api/auth/phone/enroll/verify", "patient", {"challengeId": data["challengeId"], "code": "246810"})
        before = self.limits_snapshot()
        # Link the number, sign out, and click repeatedly before the minute has elapsed.
        for _ in range(7):
            response = self.client.post("/api/auth/otp/start", json={"phone": phone}, headers={"Origin": "https://maternasync-test.vercel.app"})
            self.assertEqual(response.status_code, 429)
            self.assertGreater(int(response.headers["Retry-After"]), 0)
            self.assertLessEqual(int(response.headers["Retry-After"]), 60)
            self.assertIn("retry-after", response.headers["access-control-expose-headers"].lower())
        self.assertEqual(self.limits_snapshot(), before)
        self.assertEqual(len(self.provider.sent), 1)
        # Expire only the minute cooldown: hourly and daily usage must remain unchanged.
        with SessionLocal() as db:
            db.get(models.PhoneAuthLimit, self.limit_key("send-phone-cooldown", phone)).expires_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=1)
            db.commit()
        self.assertEqual(self.check(self.start(phone)).status_code, 200)
        self.assertEqual(len(self.provider.sent), 2)

    def test_rejected_send_rolls_back_every_limit_and_reports_longest_remaining_wait(self):
        phone = "+919800000001"
        self.start(phone)
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        with SessionLocal() as db:
            hourly = db.get(models.PhoneAuthLimit, self.limit_key("send-phone-hour", phone))
            hourly.count = 5
            hourly.expires_at = now + timedelta(seconds=17)
            budget = db.get(models.PhoneAuthLimit, self.limit_key("send-budget", "global"))
            budget.count = config.PHONE_OTP_DAILY_SEND_LIMIT
            budget.expires_at = now + timedelta(seconds=125)
            db.commit()
        before = self.limits_snapshot()
        for number in (phone, "+919800000002"):
            response = self.client.post("/api/auth/otp/start", json={"phone": number})
            self.assertEqual(response.status_code, 429)
            self.assertGreater(int(response.headers["Retry-After"]), 115)
            self.assertLessEqual(int(response.headers["Retry-After"]), 125)
            self.assertEqual(self.limits_snapshot(), before)

    def test_concurrent_send_requests_reserve_only_one_allowance(self):
        self.enroll()
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            responses = list(pool.map(lambda _: self.client.post("/api/auth/otp/start", json={"phone": "+919800000001"}), range(4)))
        self.assertEqual([r.status_code for r in responses].count(200), 1)
        self.assertEqual([r.status_code for r in responses].count(429), 3)
        self.assertEqual(len(self.provider.sent), 2)  # enrollment plus one sign-in SMS
        for count, _ in self.limits_snapshot().values():
            self.assertEqual(count, 1)

    def test_replacement_challenge_and_removed_phone_invalidate_old_challenges(self):
        self.enroll()
        old = self.start()
        self.cool()
        new = self.start()
        self.assertEqual(self.check(old).status_code, 401)
        self.call("POST", "/api/auth/phone/remove", "patient", {"password": "SarahDemo123!"})
        self.assertEqual(self.check(new).status_code, 401)

    def test_closed_account_and_new_session_version_cannot_finish_pending_login(self):
        self.enroll()
        data = self.start()
        with SessionLocal() as db:
            db.get(models.User, self.sarah_id).token_version = 1
            db.commit()
        self.assertEqual(self.check(data).status_code, 401)
        self.cool()
        with SessionLocal() as db:
            db.get(models.User, self.sarah_id).closed_at = datetime.now(timezone.utc).replace(tzinfo=None)
            db.commit()
        before = len(self.provider.sent)
        self.assertEqual(self.check(self.start()).status_code, 401)
        self.assertEqual(len(self.provider.sent), before)

    def test_provider_errors_never_authenticate_or_expose_credentials(self):
        self.enroll()
        data = self.start()
        self.provider.failed = True
        self.assertEqual(self.check(data).status_code, 503)
        self.cool()
        failed = self.client.post("/api/auth/otp/start", json={"phone": "+919800000001"})
        self.assertEqual(failed.status_code, 503)
        self.assertEqual(failed.json()["detail"], "Phone sign-in is unavailable right now. Please use your password.")

    def test_concurrent_verification_issues_only_one_session(self):
        self.enroll()
        data = self.start()
        self.provider.delay = .1
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
            results = list(pool.map(lambda _: self.check(data).status_code, range(3)))
        self.assertEqual(results.count(200), 1, results)
        self.assertTrue(all(code in (200, 401, 429) for code in results), results)

    def test_phone_budget_and_disabled_configuration(self):
        self.assertEqual(normalize_phone("+91 98000-00001"), "+919800000001")
        self.assertEqual(self.client.post("/api/auth/otp/start", json={"phone": "+12025550123"}).status_code, 400)
        with patch.object(config, "PHONE_OTP_DAILY_SEND_LIMIT", 0):
            self.assertEqual(self.client.post("/api/auth/otp/start", json={"phone": "+919800000001"}).status_code, 429)
        with patch.object(phone_provider, "configured", return_value=False):
            self.assertFalse(self.client.get("/api/auth/options").json()["phoneOtpEnabled"])
            self.assertEqual(self.client.post("/api/auth/otp/start", json={"phone": "+919800000001"}).status_code, 503)

    def test_twilio_adapter_requires_approved_matching_verification(self):
        sid = "VE" + "1" * 32
        service = "VA" + "2" * 32
        result = {"status": "approved", "sid": sid, "to": "+919800000001", "service_sid": service}
        with patch.object(config, "TWILIO_VERIFY_SERVICE_SID", service), patch.object(phone_provider, "_post", return_value=result) as request:
            adapter = phone_provider.TwilioVerify()
            self.assertTrue(adapter.check(sid, "+919800000001", "246810"))
            self.assertEqual(request.call_args.args, ("VerificationCheck", {"VerificationSid": sid, "Code": "246810"}))
            for field, wrong in [("status", "pending"), ("sid", "VE" + "3" * 32), ("to", "+919800000002"), ("service_sid", "VA" + "3" * 32)]:
                request.return_value = {**result, field: wrong}
                self.assertFalse(adapter.check(sid, "+919800000001", "246810"))
