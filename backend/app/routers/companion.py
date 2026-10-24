"""Patient care companion: navigation, reviewed education and safe routing (see app/companion.py)."""
from fastapi import APIRouter, Depends
from pydantic import Field
from sqlalchemy.orm import Session

from .. import companion, models
from ..continuity_schemas import Input, Language
from ..continuity_service import allowed_ids, audit, current_resource, resource_out
from ..database import get_db
from ..deps import require_role
from ..plain_language import LAB_NOTE_PREFIX, stage_for_weeks

router = APIRouter(prefix="/api/v2/continuity/companion", tags=["companion"])


class AskIn(Input):
    question: str = Field(min_length=1, max_length=1000)
    language: Language = "en"


@router.post("/ask")
def ask(payload: AskIn, user=Depends(require_role("patient")), db: Session = Depends(get_db)):
    ids = allowed_ids(db, user)
    episode = db.get(models.PregnancyEpisode, ids[0]) if ids else None
    stage = stage_for_weeks(episode.gestational_age_weeks or 0) if episode else None

    def reviewed(language):
        resources = db.query(models.ClinicalResource).filter_by(kind="education", status="APPROVED", language=language).all()
        # The general "About this test" notes belong to lab explanations a doctor signs, not to the open-ended companion.
        return [resource_out(db, r) for r in resources if current_resource(r) and not r.family_id.startswith(LAB_NOTE_PREFIX)]

    reply = companion.respond(payload.question, payload.language, reviewed(payload.language),
                              reviewed("en") if payload.language != "en" else [], stage)
    # The question text is not stored here; sending it to the care team is a separate, explicit patient action.
    audit(db, user, "companion_query", episode_id=episode.id if episode else None,
          details=f"intent={reply['intent']}; language={payload.language}; reviewed matches={len(reply['education'])}")
    db.commit()
    return reply
