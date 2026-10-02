from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from ..database import Base
from ._shared import new_id, now


class Task(Base):
    __tablename__ = "tasks"

    id = Column(String, primary_key=True, default=new_id)
    episode_id = Column(String, ForeignKey("pregnancy_episodes.id"), nullable=False)

    title = Column(String, nullable=False)
    description = Column(Text, default="")
    owner_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    created_by_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    due_date = Column(String, nullable=True)
    priority = Column(String, default="routine")
    status = Column(String, default="OPEN")  # OPEN | IN_PROGRESS | WAITING | COMPLETED | CANCELLED

    source_type = Column(String, nullable=True)  # manual | question | referral | consultation
    source_id = Column(String, nullable=True)

    waiting_for = Column(String, nullable=True)  # human-readable reason, e.g. "External hospital acknowledgement"
    waiting_since = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=now)
    updated_at = Column(DateTime, default=now)

    assignments = relationship("TaskAssignment", back_populates="task", cascade="all, delete-orphan")


class TaskAssignment(Base):
    """Append-only reassignment history; Task.owner_user_id holds the
    current owner for fast reads."""

    __tablename__ = "task_assignments"

    id = Column(String, primary_key=True, default=new_id)
    task_id = Column(String, ForeignKey("tasks.id"), nullable=False)
    assigned_to_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    assigned_by_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    assigned_at = Column(DateTime, default=now)

    task = relationship("Task", back_populates="assignments")
