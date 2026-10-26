"""The patient's Updates: what is unread (for the dot on the menu), marking updates read, and a preview of the WhatsApp text she is about to allow.

These routes are for the signed-in patient only and read nothing but her own notifications.
"""
import os
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .. import models, server_text, update_links, whatsapp
from ..database import get_db
from ..deps import require_role
from ..schemas import CamelModel

router = APIRouter(prefix="/api/v2/patient", tags=["patient-updates"])


class UnreadSummaryOut(CamelModel):
    total: int
    questions: int
    care_plan: int


class MarkReadIn(CamelModel):
    scope: Literal["all", "questions", "care_plan"]


class ConsentPreviewOut(CamelModel):
    purpose: str
    language: str
    text: str
    # True when real messages go out as a template approved with WhatsApp, whose wording is set up there.
    via_template: bool


def _unread(db: Session, user: models.User) -> list[models.Notification]:
    return (
        db.query(models.Notification)
        .filter(models.Notification.recipient_user_id == user.id, or_(models.Notification.is_read.is_(False), models.Notification.is_read.is_(None)))
        .all()
    )


def _summary(unread: list[models.Notification]) -> UnreadSummaryOut:
    tabs = [update_links.tab_for(n) for n in unread]
    return UnreadSummaryOut(total=len(unread), questions=tabs.count("questions"), care_plan=tabs.count("care_plan"))


@router.get("/updates/unread-summary", response_model=UnreadSummaryOut)
def unread_summary(current_user: models.User = Depends(require_role("patient")), db: Session = Depends(get_db)):
    return _summary(_unread(db, current_user))


@router.post("/updates/mark-read", response_model=UnreadSummaryOut)
def mark_read(payload: MarkReadIn, current_user: models.User = Depends(require_role("patient")), db: Session = Depends(get_db)):
    """She has now seen these: everything, or what belongs on My Questions, or what belongs on My Care Plan."""
    unread = _unread(db, current_user)
    wanted = {"questions": "questions", "care_plan": "care_plan"}.get(payload.scope)
    for note in unread:
        if payload.scope == "all" or update_links.tab_for(note) == wanted:
            note.is_read = True
    db.commit()
    return _summary(_unread(db, current_user))


# What each purpose she can allow sends, by the kind of message the server writes for it.
PURPOSE_KIND = {"reminders": "reminder", "approved_documents": "output"}


@router.get("/consent-preview", response_model=ConsentPreviewOut)
def consent_preview(purpose: str, current_user: models.User = Depends(require_role("patient")), db: Session = Depends(get_db)):
    """The text a recipient would receive for this purpose, in her language, worded by the very function that words the real messages."""
    kind = PURPOSE_KIND.get(purpose)
    if kind is None:
        raise HTTPException(400, "Choose a purpose from the list.")
    language = server_text.language_of(db, current_user.id)
    templated = whatsapp.mode() == "cloud_api" and bool(os.environ.get("MATERNASYNC_WHATSAPP_TEMPLATE", "").strip())
    return ConsentPreviewOut(purpose=purpose, language=language, text=server_text.outreach_text(kind, language), via_template=templated)
