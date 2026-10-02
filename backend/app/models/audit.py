from sqlalchemy import Column, DateTime, ForeignKey, JSON, String, Text

from ..database import Base
from ._shared import new_id, now


class AuditLog(Base):
    """Immutable action log for the new role-based system (distinct from
    the legacy ActivityLog table, which keeps serving the old clinician
    app). No update/delete endpoint is ever exposed for this table."""

    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=new_id)
    episode_id = Column(String, ForeignKey("pregnancy_episodes.id"), nullable=True)
    actor_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    actor_role = Column(String, nullable=True)
    actor_display_name = Column(String, nullable=True)  # denormalized for display without a join

    action = Column(String, nullable=False)
    title = Column(String, nullable=False)
    details = Column(Text, default="")

    object_type = Column(String, nullable=True)
    object_id = Column(String, nullable=True)
    previous_state = Column(JSON, nullable=True)
    new_state = Column(JSON, nullable=True)

    timestamp = Column(DateTime, default=now)
