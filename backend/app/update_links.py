"""Where each of the patient's Updates leads, and which sidebar tab it lights up.

An update is worded from a message key (server_text.CATALOG); older and seeded ones carry only English text, which server_text recognises as
one of the fixed messages. The page it is about is decided here from that key (falling back to the notification's type), so the page
can offer "Open <page>" and the menu can show a dot on My Questions or My Care Plan while something there has not been seen.
"""
from . import models

QUESTIONS = "/patient/questions"
CARE_PLAN = "/patient/care-plan"
APPOINTMENTS = "/patient/appointments"
RECORDS = "/patient/records"
JOURNEY = "/patient/journey"
PROFILE = "/patient/profile"
DAILY = "/patient/daily-log"

# message key -> page
BY_KEY = {
    "question_answered": QUESTIONS, "question_answered_doctor": QUESTIONS, "question_handled_offline": QUESTIONS, "caregiver_acted_question": QUESTIONS, "caregiver_acted_talk": QUESTIONS,
    "reminders_added": CARE_PLAN, "reminder_due": CARE_PLAN, "approved_document": CARE_PLAN,
    "appointment_scheduled": APPOINTMENTS, "appointment_cancelled": APPOINTMENTS, "appointment_completed": APPOINTMENTS, "appointment_no_show": APPOINTMENTS,
    "appointment_requested": APPOINTMENTS, "visit_reminder": APPOINTMENTS, "visit_confirmed": APPOINTMENTS, "new_times_offered": APPOINTMENTS,
    "visit_missed": APPOINTMENTS, "visit_prep_added": APPOINTMENTS, "visit_change_sent": APPOINTMENTS, "visit_change_withdrawn": APPOINTMENTS, "caregiver_visit_yes": APPOINTMENTS, "caregiver_visit_no": APPOINTMENTS,
    "document_verified_patient": JOURNEY, "document_reviewed_named": JOURNEY, "document_rejected_patient": RECORDS, "document_rejected_default": RECORDS,
    "referral_sent_patient": JOURNEY, "referral_appointment_patient": JOURNEY, "referral_response_patient": JOURNEY,
    "caregiver_acted_checkin": DAILY,
    "caregiver_joined": PROFILE, "caregiver_removed": PROFILE, "caregiver_whatsapp_on": PROFILE, "caregiver_whatsapp_off": PROFILE,
    "access_ending": PROFILE, "access_ended": PROFILE, "helper_asked_her": PROFILE, "caregiver_helper_yes": PROFILE, "caregiver_helper_no": PROFILE,
}
# notification type -> page, for rows that have no usable key
BY_TYPE = {
    "question_answered": QUESTIONS, "reminder_due": CARE_PLAN, "document_verified": JOURNEY, "document_rejected": RECORDS,
    "REFERRAL_SENT": JOURNEY, "APPOINTMENT_SCHEDULED": APPOINTMENTS, "REFERRAL_RESPONSE_RECEIVED": JOURNEY,
    "caregiver_joined": PROFILE, "caregiver_removed": PROFILE, "caregiver_action": PROFILE,
}
# The two tabs that get a dot of their own: a reply to a question, and something new in the care plan.
TAB_OF_PAGE = {QUESTIONS: "questions", CARE_PLAN: "care_plan"}
# Only these keys light a tab: an answer to her question, and reminders or a document her doctor released. A helper telling her they asked a
# question for her still shows in Updates but does not say "there is something to read" on My Questions.
TAB_KEYS = {"question_answered", "question_answered_doctor", "question_handled_offline", "reminders_added", "reminder_due", "approved_document"}
TAB_TYPES = {"question_answered", "reminder_due"}


def _key(note: models.Notification) -> str | None:
    from . import server_text
    if note.message_key in server_text.CATALOG:
        return note.message_key
    return server_text._LEGACY.get((note.title, note.body or ""))


def link_for(note: models.Notification) -> str | None:
    key = _key(note)
    if key in BY_KEY:
        return BY_KEY[key]
    return BY_TYPE.get(note.type)


def tab_for(note: models.Notification) -> str | None:
    """'questions', 'care_plan' or None: which menu item this update belongs to, for the unread dot."""
    key = _key(note)
    if key is not None:
        return TAB_OF_PAGE.get(BY_KEY.get(key)) if key in TAB_KEYS else None
    return TAB_OF_PAGE.get(BY_TYPE.get(note.type)) if note.type in TAB_TYPES else None
