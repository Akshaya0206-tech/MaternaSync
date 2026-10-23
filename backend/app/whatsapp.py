"""WhatsApp delivery with honest status tracking.

Three modes, chosen by MATERNASYNC_WHATSAPP_PROVIDER:
  cloud_api  Real sending through the WhatsApp Business Cloud API (needs MATERNASYNC_WHATSAPP_TOKEN and
             MATERNASYNC_WHATSAPP_PHONE_ID). Delivery status arrives on the provider webhook.
  simulator  No message leaves this server. Statuses are marked SIMULATED in the screens. For demos.
  manual     Only the wa.me composer link; staff record "sent manually". Delivery stays unconfirmed.
Default: simulator while demo mode is on, otherwise manual.

Only the minimal sign-in notification is ever sent (see routers/continuity.prepare_outreach); never
clinical content. Opt-out is honoured from the patient's side (revoking permission) and by keyword.
"""
import hashlib
import hmac
import json
import os
import urllib.error
import urllib.request
import uuid
from datetime import timedelta

from . import config

OPT_OUT_WORDS = {"STOP", "UNSUBSCRIBE", "OPT OUT", "OPTOUT", "CANCEL"}
# Order matters: a status only ever moves forward (a late "sent" must not undo "delivered").
RANK = {"PREPARED": 0, "COMPOSER_LINK_READY": 1, "MANUALLY_SENT": 2, "SENT": 3, "DELIVERED": 4, "READ": 5}
SIMULATED_DELIVERY_SECONDS = 3


class WhatsAppError(Exception):
    pass


def mode():
    value = os.environ.get("MATERNASYNC_WHATSAPP_PROVIDER", "").strip().lower()
    if value in ("cloud_api", "simulator", "manual"):
        return value
    return "simulator" if config.DEMO_ENABLED else "manual"


def automatic():
    return mode() != "manual"


def _post(url, headers, payload):
    """One HTTP call to the provider. Separate so tests can replace it without a network."""
    request = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return json.loads(response.read().decode() or "{}")
    except urllib.error.HTTPError as error:
        try:
            detail = json.loads(error.read().decode()).get("error", {}).get("message", "")
        except Exception:
            detail = ""
        raise WhatsAppError(f"The WhatsApp provider rejected the message (HTTP {error.code}). {detail}".strip()[:300])
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        raise WhatsAppError(f"The WhatsApp provider could not be reached: {error}"[:300])


def send(recipient, text):
    """Send one message. Returns {"provider", "reference"} or raises WhatsAppError."""
    current = mode()
    if current == "manual":
        raise WhatsAppError("Automatic sending is not configured.")
    if current == "simulator":
        return {"provider": "simulator", "reference": "sim-" + uuid.uuid4().hex[:12]}
    token = os.environ.get("MATERNASYNC_WHATSAPP_TOKEN", "")
    phone_id = os.environ.get("MATERNASYNC_WHATSAPP_PHONE_ID", "")
    if not token or not phone_id:
        raise WhatsAppError("WhatsApp Cloud API credentials are not set (MATERNASYNC_WHATSAPP_TOKEN, MATERNASYNC_WHATSAPP_PHONE_ID).")
    template = os.environ.get("MATERNASYNC_WHATSAPP_TEMPLATE", "").strip()
    payload = {"messaging_product": "whatsapp", "to": recipient.lstrip("+")}
    if template:  # business-initiated messages outside the 24-hour window must use an approved template
        payload.update(type="template", template={"name": template, "language": {"code": os.environ.get("MATERNASYNC_WHATSAPP_TEMPLATE_LANGUAGE", "en")}})
    else:
        payload.update(type="text", text={"body": text, "preview_url": False})
    version = os.environ.get("MATERNASYNC_WHATSAPP_API_VERSION", "v20.0")
    result = _post(f"https://graph.facebook.com/{version}/{phone_id}/messages",
                   {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}, payload)
    messages = result.get("messages") or []
    if not messages or not messages[0].get("id"):
        raise WhatsAppError("The WhatsApp provider did not return a message id.")
    return {"provider": "cloud_api", "reference": messages[0]["id"]}


def verify_signature(raw_body, header):
    """Meta signs webhook calls with the app secret (X-Hub-Signature-256). No secret configured = reject."""
    secret = os.environ.get("MATERNASYNC_WHATSAPP_APP_SECRET", "")
    if not secret or not header or not header.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header.split("=", 1)[1])


def parse_webhook(payload):
    """Pull delivery statuses and inbound texts out of a Cloud API webhook body."""
    statuses, inbound = [], []
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            for item in value.get("statuses", []):
                errors = item.get("errors") or []
                statuses.append({"id": item.get("id"), "status": item.get("status"),
                                 "error": (errors[0].get("title") or errors[0].get("message") or "Delivery failed") if errors else None})
            for message in value.get("messages", []):
                if message.get("type") == "text":
                    inbound.append({"from": message.get("from", ""), "text": (message.get("text") or {}).get("body", "")})
    return statuses, inbound


def is_opt_out(text):
    return " ".join((text or "").upper().split()) in OPT_OUT_WORDS


def advance_simulated(db, items, now, utc):
    """Simulator only: a message marked SENT becomes DELIVERED a few seconds later, so the flow is visible in a demo."""
    changed = False
    for item in items:
        if item.provider == "simulator" and item.status == "SENT" and item.sent_at and utc(item.sent_at) + timedelta(seconds=SIMULATED_DELIVERY_SECONDS) <= now():
            item.status, item.delivered_at, item.updated_at = "DELIVERED", now(), now()
            changed = True
    if changed:
        db.commit()
