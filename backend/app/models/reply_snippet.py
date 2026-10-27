from sqlalchemy import Column, DateTime, ForeignKey, String, Text

from ..database import Base
from ._shared import new_id, now


class ReplySnippet(Base):
    """A reply a doctor wrote herself and saved to use again on Patient Questions. It belongs to that doctor alone: no other doctor sees it, and
    nothing here is written by a model or sent by itself. She picks one, edits it in the reply box, and approves the reply as always."""

    __tablename__ = "reply_snippets"

    id = Column(String, primary_key=True, default=new_id)
    doctor_user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=now)
    updated_at = Column(DateTime, default=now)
