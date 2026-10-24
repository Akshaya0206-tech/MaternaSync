"""The care assistant: an administrative AI coordinator that does the routine work a care-team member used to do.

It reacts to events (a document is uploaded, a question is asked, a check-in is missed, a task goes overdue), does
only low-risk administrative steps by itself, and hands everything else to a doctor as a proposal or an item that
needs a person. It never diagnoses, recommends treatment, interprets a result, or gives clinical advice.

Layout: policy.py (the rules, in plain code) -> tools.py (the only things it can do) -> providers.py (the model step,
rules or Claude) -> workflows.py (LangGraph graphs) -> orchestrator.py (queue and schedules).
The design and its limits are in `ai workflow.md`.
"""
