from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String

from ..database import Base
from ._shared import new_id, now


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=new_id)
    recipient_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    episode_id = Column(String, ForeignKey("pregnancy_episodes.id"), nullable=True)

    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    body = Column(String, default="")
    related_entity_type = Column(String, nullable=True)
    related_entity_id = Column(String, nullable=True)
    is_read = Column(Boolean, default=False)

    created_at = Column(DateTime, default=now)
