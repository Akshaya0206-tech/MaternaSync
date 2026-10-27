"""Where each of a doctor's updates leads: the page the "Open ..." button goes to.

The patient's side does the same in update_links.py. A note is matched by its message key first (the fixed messages in server_text.py), then by
its type (older notes and the seeded ones carry only a type). Anything about one patient opens that patient's page; the rest open a list.
"""
from . import models, update_links

QUESTIONS = "/doctor/questions"
ASSISTANT = "/doctor/assistant"
HANDOVER = "/doctor/handover"

# message key -> where, written as a pattern with {ep} for the patient's record
BY_KEY = {
    "question_needs_you": QUESTIONS, "question_warning_wording": QUESTIONS, "question_attachment": QUESTIONS, "question_followup": QUESTIONS,
    "document_for_review": "/doctor/patients/{ep}?tab=documents", "document_verified_doctor": "/doctor/patients/{ep}?tab=documents",
    "appointment_requested": "/doctor/care-workspace?episodeId={ep}&tab=operations", "visit_change_requested": "/doctor/care-workspace?episodeId={ep}&tab=operations",
    "visit_change_withdrawn": "/doctor/care-workspace?episodeId={ep}&tab=operations", "help_requested": "/doctor/care-workspace?episodeId={ep}&tab=operations",
    "follow_up_assigned": "/doctor/care-workspace?episodeId={ep}&tab=operations", "pathway_assigned": "/doctor/care-workspace?episodeId={ep}&tab=operations",
    "task_overdue": "/doctor/care-workspace?episodeId={ep}&tab=operations", "task_due_soon": "/doctor/care-workspace?episodeId={ep}&tab=operations",
    "referral_sent_doctor": "/doctor/patients/{ep}?tab=referrals", "referral_review_doctor": "/doctor/patients/{ep}?tab=referrals",
    "draft_ready": "/doctor/care-workspace?episodeId={ep}&tab=drafts",
    "handover_ready": HANDOVER,
    "assistant_item": ASSISTANT, "assistant_item_urgent": ASSISTANT, "weekly_summary": ASSISTANT,
    "account_closed": "/doctor/patients/{ep}",
}
# notification type -> where, for notes with no usable key
BY_TYPE = {
    "brief_ready": "/doctor/patients/{ep}",
    "DOCUMENT_UPLOADED": "/doctor/patients/{ep}?tab=documents", "document_verified": "/doctor/patients/{ep}?tab=documents",
    "PATIENT_QUESTION_CREATED": QUESTIONS,
    "REFERRAL_SENT": "/doctor/patients/{ep}?tab=referrals", "DOCTOR_REVIEW_REQUESTED": "/doctor/patients/{ep}?tab=referrals",
    "assistant": ASSISTANT, "assistant_urgent": ASSISTANT, "assistant_summary": ASSISTANT,
    "account_closed": "/doctor/patients/{ep}",
}


def link_for(note: models.Notification) -> str | None:
    pattern = BY_KEY.get(update_links._key(note)) or BY_TYPE.get(note.type)
    if pattern is None:
        return None
    if pattern == QUESTIONS and note.related_entity_type == "PatientQuestion" and note.related_entity_id:
        return f"{QUESTIONS}?question={note.related_entity_id}"  # that question, opened and scrolled to (the page reads ?question=)
    if "{ep}" not in pattern:
        return pattern
    # A note about one patient needs her record; without it the list of patients is the best place.
    return pattern.format(ep=note.episode_id) if note.episode_id else "/doctor/patients"
