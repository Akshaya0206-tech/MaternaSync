from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text

from ..database import Base
from ._shared import new_id, now


class Handover(Base):
    __tablename__ = "handovers"

    id = Column(String, primary_key=True, default=new_id)
    episode_id = Column(String, ForeignKey("pregnancy_episodes.id"), nullable=False)

    context = Column(Text, default="")
    what_happened = Column(Text, default="")
    what_remains = Column(Text, default="")
    who_owns_it = Column(Text, default="")
    what_to_discuss = Column(Text, default="")

    status = Column(String, default="DRAFT")  # DRAFT | FINAL
    generated_by_ai = Column(Boolean, default=True)
    created_by_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    approved_by_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=now)
