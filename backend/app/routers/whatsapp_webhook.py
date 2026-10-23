"""WhatsApp Business Cloud API webhook: delivery statuses and opt-out keywords.

Calls are accepted only when the provider mode is cloud_api and the request carries a valid
X-Hub-Signature-256 for MATERNASYNC_WHATSAPP_APP_SECRET. Nothing here sends a message.
"""
import json
import os

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from .. import models, whatsapp
from ..continuity_service import now
from ..database import get_db

router = APIRouter(prefix="/api/v2/webhooks/whatsapp", tags=["whatsapp-webhook"])

STATUS_MAP = {"sent": "SENT", "delivered": "DELIVERED", "read": "READ", "failed": "FAILED"}


def _audit(db, episode_id, action, title, details, obj):
    db.add(models.AuditLog(episode_id=episode_id, actor_user_id=None, actor_role=None, actor_display_name="WhatsApp provider",
                           action=action, title=title, details=details, object_type="Outreach", object_id=getattr(obj, "id", None)))


@router.get("")
def verify(mode: str = Query("", alias="hub.mode"), token: str = Query("", alias="hub.verify_token"),
           challenge: str = Query("", alias="hub.challenge")):
    """Meta's one-time subscription check."""
    expected = os.environ.get("MATERNASYNC_WHATSAPP_VERIFY_TOKEN", "")
    if whatsapp.mode() == "cloud_api" and expected and mode == "subscribe" and token == expected:
        return PlainTextResponse(challenge)
    raise HTTPException(403, "Webhook verification failed.")


@router.post("")
async def receive(request: Request, db: Session = Depends(get_db)):
    raw = await request.body()
    if whatsapp.mode() != "cloud_api" or not whatsapp.verify_signature(raw, request.headers.get("X-Hub-Signature-256", "")):
        raise HTTPException(403, "Webhook is not enabled or the signature is invalid.")
    try:
        statuses, inbound = whatsapp.parse_webhook(json.loads(raw or b"{}"))
    except ValueError:
        raise HTTPException(400, "Unreadable webhook body.")
    updated = opted_out = 0
    for event in statuses:
        target = STATUS_MAP.get(event["status"] or "")
        item = db.query(models.Outreach).filter_by(provider_reference=event["id"]).first() if event["id"] else None
        if not item or not target:
            continue
        if target == "FAILED":
            if whatsapp.RANK.get(item.status, 0) >= whatsapp.RANK["DELIVERED"]:
                continue  # a late failure notice must not undo a confirmed delivery
            item.status, item.failed_reason = "FAILED", (event["error"] or "Delivery failed")[:300]
        elif whatsapp.RANK[target] > whatsapp.RANK.get(item.status, -1):
            item.status = target
            if target == "DELIVERED":
                item.delivered_at = now()
            elif target == "READ":
                item.read_at, item.delivered_at = now(), item.delivered_at or now()
        else:
            continue
        item.updated_at = now()
        updated += 1
        _audit(db, item.episode_id, "whatsapp_status", f"WhatsApp message {item.status.lower()}", f"Provider reported {event['status']}.", item)
    for message in inbound:
        if not whatsapp.is_opt_out(message["text"]):
            continue
        number = "+" + message["from"].lstrip("+")
        for consent in db.query(models.SharingConsent).filter_by(recipient=number).all():
            if consent.revoked_at:
                continue
            consent.revoked_at = now()
            for pending in db.query(models.Outreach).filter(models.Outreach.consent_id == consent.id, models.Outreach.status.in_(["PREPARED", "COMPOSER_LINK_READY"])).all():
                pending.status = "CANCELLED"
            opted_out += 1
            _audit(db, consent.episode_id, "sharing_consent_revoked", "Sharing consent revoked by the recipient", "The recipient replied with an opt-out keyword.", consent)
    db.commit()
    return {"ok": True, "statusUpdates": updated, "optOuts": opted_out}
