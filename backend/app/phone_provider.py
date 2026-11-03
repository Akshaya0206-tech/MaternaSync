"""Twilio Verify adapter. No OTP codes, credentials or response bodies are logged."""
import base64
import json
import re
import urllib.error
import urllib.parse
import urllib.request

from . import config


class ProviderUnavailable(Exception):
    pass


def configured() -> bool:
    return bool(config.PHONE_OTP_ENABLED
                and re.fullmatch(r"AC[0-9a-fA-F]{32}", config.TWILIO_ACCOUNT_SID)
                and re.fullmatch(r"VA[0-9a-fA-F]{32}", config.TWILIO_VERIFY_SERVICE_SID)
                and config.TWILIO_AUTH_TOKEN
                and not config.JWT_SECRET_IS_DEFAULT
                and len(config.JWT_SECRET) >= 32
                and not config.JWT_SECRET.startswith("REPLACE_"))


def _post(resource: str, data: dict) -> dict:
    credentials = base64.b64encode(f"{config.TWILIO_ACCOUNT_SID}:{config.TWILIO_AUTH_TOKEN}".encode()).decode()
    request = urllib.request.Request(
        f"https://verify.twilio.com/v2/Services/{config.TWILIO_VERIFY_SERVICE_SID}/{resource}",
        data=urllib.parse.urlencode(data).encode(), method="POST",
        headers={"Authorization": "Basic " + credentials, "Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            result = json.load(response)
            if not isinstance(result, dict):
                raise ProviderUnavailable()
            return result
    except urllib.error.HTTPError as error:
        # An expired/used or rejected check must never authenticate.
        if resource == "VerificationCheck" and error.code in (400, 404, 429):
            return {"status": "failed"}
        raise ProviderUnavailable() from None
    except (OSError, ValueError, TimeoutError):
        raise ProviderUnavailable() from None


class TwilioVerify:
    def send(self, phone: str) -> str:
        result = _post("Verifications", {"To": phone, "Channel": "sms"})
        sid = result.get("sid", "")
        if result.get("status") != "pending" or not re.fullmatch(r"VE[0-9a-fA-F]{32}", sid):
            raise ProviderUnavailable()
        return sid

    def check(self, sid: str, phone: str, code: str) -> bool:
        result = _post("VerificationCheck", {"VerificationSid": sid, "Code": code})
        return (result.get("status") == "approved" and result.get("sid") == sid
                and result.get("to") == phone and result.get("service_sid") == config.TWILIO_VERIFY_SERVICE_SID)


def get_provider() -> TwilioVerify:
    # Tests inject a stand-in through FastAPI dependency overrides. No test/master code can be enabled by configuration.
    return TwilioVerify()
