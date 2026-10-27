"""Which topics on the patient References page the clinic has read.

The text on that page ships with the app (it is written from official sources and is the same for every patient). A doctor can record
that the clinic has reviewed a topic; patients then see who reviewed it and when. Nothing here changes the text, and a topic nobody has
reviewed simply says so. Marking and clearing are doctor-only and go to the audit log.

Each review can carry a fingerprint of the text that was read (`contentHash`, SHA-256 made in the browser). The screens compare it with the
fingerprint of the text they ship: if the text has changed since, the doctor sees "Changed since reviewed" and the patient is told the topic
was updated. The server only stores and returns it; it never sees the topic text.
"""
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field
from sqlalchemy.orm import Session

from .. import models
from ..continuity_schemas import Input
from ..continuity_service import audit, name, now, utc
from ..database import get_db
from ..deps import get_current_user, require_role

router = APIRouter(tags=["patient-reference-reviews"])
doctor = require_role("doctor")

_TOPIC = re.compile(r"^[a-z0-9][a-z0-9-]{1,63}$")
MOST_TOPICS = 200


HASH = r"^[0-9a-f]{64}$"
MOST_AT_ONCE = 100


class ReviewIn(Input):
    note: str = Field("", max_length=500)
    content_hash: str | None = Field(None, pattern=HASH)


class BulkItem(Input):
    topic_id: str = Field(min_length=2, max_length=64)
    content_hash: str | None = Field(None, pattern=HASH)


class BulkIn(Input):
    topics: list[BulkItem] = Field(min_length=1, max_length=MOST_AT_ONCE)


def _topic_id(topic_id: str) -> str:
    if not _TOPIC.match(topic_id):
        raise HTTPException(400, "That is not a topic name.")
    return topic_id


def _out(db: Session, review: models.PatientTopicReview, with_note: bool = False) -> dict:
    result = {"reviewedAt": utc(review.reviewed_at).isoformat(), "reviewerName": name(db, review.reviewed_by_user_id), "contentHash": review.content_hash}
    if with_note:
        result["note"] = review.note or ""
    return result


@router.get("/api/v2/patient/reference-reviews")
def reviews_for_patients(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Every topic the clinic has reviewed, keyed by topic id. Patients, trusted people and doctors may read it; it holds no patient data."""
    return {r.topic_id: _out(db, r) for r in db.query(models.PatientTopicReview).all()}


@router.get("/api/v2/doctor/reference-reviews")
def reviews_for_doctors(user: models.User = Depends(doctor), db: Session = Depends(get_db)):
    return {r.topic_id: _out(db, r, with_note=True) for r in db.query(models.PatientTopicReview).all()}


@router.put("/api/v2/doctor/reference-reviews/{topic_id}")
def mark_reviewed(topic_id: str, payload: ReviewIn, user: models.User = Depends(doctor), db: Session = Depends(get_db)):
    """Record that this doctor has read the topic now. Marking it again replaces the earlier review (the audit log keeps both)."""
    topic_id = _topic_id(topic_id)
    review = db.get(models.PatientTopicReview, topic_id)
    if review is None:
        if db.query(models.PatientTopicReview).count() >= MOST_TOPICS:
            raise HTTPException(400, "Too many topics are marked as reviewed.")
        review = models.PatientTopicReview(topic_id=topic_id)
        db.add(review)
    before = _out(db, review, with_note=True) if review.reviewed_by_user_id else None
    review.reviewed_by_user_id, review.reviewed_at, review.note, review.content_hash = user.id, now(), payload.note, payload.content_hash
    db.flush()
    audit(db, user, "patient_topic_reviewed", review, before=before, after=_out(db, review, with_note=True), details=f"Topic: {topic_id}")
    db.commit()
    return _out(db, review, with_note=True)


@router.post("/api/v2/doctor/reference-reviews")
def mark_many_reviewed(payload: BulkIn, user: models.User = Depends(doctor), db: Session = Depends(get_db)):
    """Record that this doctor has read several topics now. Each one is marked and audit-logged on its own, exactly as if it had been
    marked by itself. A review that already exists keeps its private note; a new one starts with none. All or none: a bad topic name
    refuses the whole request."""
    wanted: dict[str, str | None] = {}
    for item in payload.topics:
        wanted.setdefault(_topic_id(item.topic_id), item.content_hash)
    existing = {r.topic_id: r for r in db.query(models.PatientTopicReview).filter(models.PatientTopicReview.topic_id.in_(list(wanted))).all()}
    if db.query(models.PatientTopicReview).count() + len(wanted) - len(existing) > MOST_TOPICS:
        raise HTTPException(400, "Too many topics are marked as reviewed.")
    marked: dict[str, dict] = {}
    for topic_id, content_hash in wanted.items():
        review = existing.get(topic_id)
        if review is None:
            review = models.PatientTopicReview(topic_id=topic_id, note="")
            db.add(review)
        before = _out(db, review, with_note=True) if review.reviewed_by_user_id else None
        review.reviewed_by_user_id, review.reviewed_at, review.content_hash = user.id, now(), content_hash
        db.flush()
        after = _out(db, review, with_note=True)
        audit(db, user, "patient_topic_reviewed", review, before=before, after=after, details=f"Topic: {topic_id}")
        marked[topic_id] = after
    db.commit()
    return {"reviewed": list(marked), "reviews": marked}


@router.delete("/api/v2/doctor/reference-reviews/{topic_id}")
def clear_review(topic_id: str, user: models.User = Depends(doctor), db: Session = Depends(get_db)):
    topic_id = _topic_id(topic_id)
    review = db.get(models.PatientTopicReview, topic_id)
    if review is None:
        raise HTTPException(404, "That topic is not marked as reviewed.")
    before = _out(db, review, with_note=True)
    # The audit row points at the topic by name: the row it describes is about to go.
    audit(db, user, "patient_topic_review_cleared", None, before=before, details=f"Topic: {topic_id}")
    db.delete(review)
    db.commit()
    return {"topicId": topic_id, "cleared": True}
