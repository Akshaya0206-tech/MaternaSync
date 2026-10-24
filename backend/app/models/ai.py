from sqlalchemy import Column, DateTime, ForeignKey, JSON, String, Text

from ..database import Base
from ._shared import new_id, now


class AIRun(Base):
    """One job of the care assistant: what triggered it, which mode, provider and prompt version ran, and how it ended.
    `trigger_key` makes a retried or repeated trigger do the work only once."""

    __tablename__ = "ai_runs"

    id = Column(String, primary_key=True, default=new_id)
    workflow = Column(String, nullable=False, index=True)  # document_intake | question_routing | missed_checkin | overdue_task
    episode_id = Column(String, ForeignKey("pregnancy_episodes.id"), nullable=True, index=True)
    source_type = Column(String, nullable=True)
    source_id = Column(String, nullable=True)
    trigger_key = Column(String, nullable=False, unique=True)

    status = Column(String, default="QUEUED", index=True)  # QUEUED | RUNNING | DONE | FAILED
    mode = Column(String, default="assist")  # shadow | assist
    provider = Column(String, nullable=True)  # rules | claude
    model = Column(String, nullable=True)
    prompt_version = Column(String, nullable=True)
    framework = Column(String, nullable=True)
    inputs_digest = Column(String, nullable=True)  # a hash of what the assistant looked at, never the text itself
    summary = Column(Text, default="")
    error = Column(Text, nullable=True)

    created_at = Column(DateTime, default=now)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)


class AIAction(Base):
    """Every step the assistant asked to take, the policy engine's decision about it, and the result."""

    __tablename__ = "ai_actions"

    id = Column(String, primary_key=True, default=new_id)
    run_id = Column(String, ForeignKey("ai_runs.id"), nullable=False, index=True)
    episode_id = Column(String, ForeignKey("pregnancy_episodes.id"), nullable=True, index=True)
    tool = Column(String, nullable=False)
    tier = Column(String, nullable=False)  # T0 | T1
    args = Column(JSON, default=dict)
    policy = Column(String, nullable=False)  # run | propose | shadow | deny
    reason = Column(String, default="")
    status = Column(String, nullable=False)  # DONE | PROPOSED | SHADOW | DENIED | FAILED
    result = Column(Text, default="")
    idempotency_key = Column(String, nullable=True, unique=True)
    exception_id = Column(String, ForeignKey("exception_items.id"), nullable=True)
    created_at = Column(DateTime, default=now)

    # Who actually ran the step (the assistant's account, or the doctor who approved a proposal), and what a doctor needs to
    # reverse it. `undo` holds the ids and earlier values the step changed; a step with no `undo` cannot be reversed.
    executed_by_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    undo = Column(JSON, nullable=True)
    undone_at = Column(DateTime, nullable=True)
    undone_by_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    undo_note = Column(String, nullable=True)


class AssistantSetting(Base):
    """Switches a doctor can flip on the Care Assistant page without restarting anything: `paused` (everything waits),
    `review_all` (every step except the fixed emergency message waits for a doctor) and `paused_episodes` (one patient's
    work waits). The environment kill switch (MATERNASYNC_AI_COORDINATOR_MODE) is separate and always wins."""

    __tablename__ = "assistant_settings"

    key = Column(String, primary_key=True)
    value = Column(JSON, nullable=True)
    updated_by_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, default=now)


class ExceptionItem(Base):
    """What the assistant hands to a doctor: a proposal to approve with one click, or something that needs a person.
    Approving executes the proposed tool under the doctor's own identity, so the record says a doctor decided."""

    __tablename__ = "exception_items"

    id = Column(String, primary_key=True, default=new_id)
    episode_id = Column(String, ForeignKey("pregnancy_episodes.id"), nullable=False, index=True)
    run_id = Column(String, ForeignKey("ai_runs.id"), nullable=True)
    kind = Column(String, nullable=False)  # proposal | attention
    urgency = Column(String, default="normal")  # urgent | normal
    title = Column(String, nullable=False)
    summary = Column(Text, default="")
    recommended_action = Column(String, default="")
    proposed_tool = Column(String, nullable=True)
    proposed_args = Column(JSON, default=dict)
    source_type = Column(String, nullable=True)
    source_id = Column(String, nullable=True)

    status = Column(String, default="OPEN", index=True)  # OPEN | APPROVED | DISMISSED | ACKNOWLEDGED
    decided_by_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    decided_at = Column(DateTime, nullable=True)
    decision_note = Column(String, default="")
    created_at = Column(DateTime, default=now)
