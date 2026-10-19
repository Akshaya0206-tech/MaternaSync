"""Shared versioning/guard/diff logic for the Handover feature, used
identically by both the Care Team and Doctor routers (mirrors the
ReferralCommunicationService pattern in referral_communication.py).

Each role still builds its own handover *content* (what counts as "what
remains"/"who owns it" differs by role) — that stays in each router. This
service only owns what both roles must do identically: never destroy a
persisted draft, keep at most one current DRAFT per episode, and compute an
honest, non-LLM diff between consecutive versions.
"""

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from . import models

FIELDS = ("context", "what_happened", "what_remains", "who_owns_it", "what_to_discuss")


class HandoverService:
    def __init__(self, db: Session):
        self.db = db

    def get_latest(self, episode_id: str) -> models.Handover | None:
        return (
            self.db.query(models.Handover)
            .filter(models.Handover.episode_id == episode_id)
            .order_by(models.Handover.version.desc())
            .first()
        )

    def list_history(self, episode_id: str) -> list[models.Handover]:
        return (
            self.db.query(models.Handover)
            .filter(models.Handover.episode_id == episode_id)
            .order_by(models.Handover.version.desc())
            .all()
        )

    def generate_new_version(self, episode: models.PregnancyEpisode, current_user: models.User, content: dict) -> models.Handover:
        """Creates a new draft version. If a DRAFT already exists for this
        episode, it's marked SUPERSEDED and linked — never deleted, never
        overwritten. A FINAL (already-shared) handover is left untouched:
        regenerating after a share is allowed and simply starts a new
        version on top of it."""
        current_draft = (
            self.db.query(models.Handover)
            .filter(models.Handover.episode_id == episode.id, models.Handover.status == "DRAFT")
            .first()
        )
        next_version = self.db.query(models.Handover).filter(models.Handover.episode_id == episode.id).count() + 1

        new_handover = models.Handover(
            episode_id=episode.id, version=next_version, status="DRAFT",
            generated_by_ai=True, created_by_user_id=current_user.id, **content,
        )
        self.db.add(new_handover)
        self.db.flush()

        if current_draft is not None:
            current_draft.status = "SUPERSEDED"
            current_draft.superseded_by_id = new_handover.id
            current_draft.updated_at = datetime.now(timezone.utc)

        return new_handover

    def require_editable(self, handover: models.Handover) -> None:
        if handover.status != "DRAFT":
            raise HTTPException(
                status_code=409,
                detail="Only the current draft can be edited or shared. Final or superseded versions are immutable.",
            )

    def diff_against_previous(self, handover: models.Handover) -> dict | None:
        """Plain field-by-field text comparison against the immediately
        preceding version. Reports *that* text differs, never *why* — no
        model is asked to explain anything. Returns None for version 1 or
        when the previous version can't be found (legacy data gap)."""
        version = handover.version or 1
        if version <= 1:
            return None
        previous = (
            self.db.query(models.Handover)
            .filter(models.Handover.episode_id == handover.episode_id, models.Handover.version == version - 1)
            .first()
        )
        if previous is None:
            return None
        changed = {field: (getattr(handover, field) or "").strip() != (getattr(previous, field) or "").strip() for field in FIELDS}
        return {"changed_from_previous": changed, "source_data_changed": any(changed.values())}
