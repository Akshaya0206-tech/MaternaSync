"""Lightweight, synchronous, in-process event automation layer.

Deliberately NOT a message queue / Celery / background worker: every
event in this prototype is dispatched synchronously, inline, within the
same request and the same DB session as the action that triggered it.
That keeps the architecture simple (per the explicit instruction to avoid
unnecessary infrastructure) while still giving a single, traceable place
where "when X happens, do Y" rules live.

Traceability reuses the existing AuditLog table rather than introducing a
parallel AutomationEvent model — AuditLog already records actor, action,
object, timestamp and previous/new state for every action in the system;
giving automation its own duplicate table would violate the explicit
"don't create duplicate models" instruction for no functional gain.

Safety: `dispatch_event` runs handlers inside a SAVEPOINT (nested
transaction). If a handler raises, only the automation's own partial
writes roll back — the primary action that triggered the event (already
added to the session before dispatch_event was called) is untouched, and
a failure AuditLog row records what went wrong. Automation can never
corrupt or block the workflow record it's reacting to.
"""

from .dispatcher import dispatch_event
from . import events

__all__ = ["dispatch_event", "events"]
