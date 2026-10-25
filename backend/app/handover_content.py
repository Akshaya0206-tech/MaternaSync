"""The fixed wording of a doctor's handover draft, in the doctor's language, built from structured counts only.

It says what was last recorded, how many tasks and questions are open, and who owns the patient's care. It does not
summarise, interpret or rank anything clinical. Used by the Handover page's "Generate" button and by the care assistant
when it prepares a draft (the doctor still reads, edits and shares it). Handover itself stays paused until
MATERNASYNC_HANDOVER_PAUSED=false.
"""
from . import models, server_text

OPEN_TASK_STATUSES = ("OPEN", "IN_PROGRESS", "WAITING")
OPEN_QUESTION_STATUSES = ("NEW", "ASSIGNED", "WAITING_FOR_RESPONSE")


def _m(en, hi, ta, te):
    return {"en": en, "hi": hi, "ta": ta, "te": te}


PHRASES = {
    "no_activity": _m("No recent recorded activity.", "हाल की कोई दर्ज गतिविधि नहीं।", "சமீபத்திய பதிவு செய்யப்பட்ட செயல்பாடு இல்லை.", "ఇటీవల నమోదైన కార్యకలాపం లేదు."),
    "open_tasks": _m("{count} open task(s).", "{count} खुले कार्य।", "{count} திறந்த பணி(கள்).", "{count} తెరిచిన పని(లు)."),
    "nothing_outstanding": _m("Nothing outstanding.", "कुछ भी लंबित नहीं।", "நிலுவையில் எதுவும் இல்லை.", "ఏదీ పెండింగ్‌లో లేదు."),
    "questions_pending": _m("{count} patient question(s) pending response.", "{count} रोगी प्रश्न उत्तर की प्रतीक्षा में हैं।",
                            "{count} நோயாளி கேள்வி(கள்) பதிலுக்காகக் காத்திருக்கின்றன.", "{count} రోగి ప్రశ్న(లు) సమాధానం కోసం వేచి ఉన్నాయి."),
    "no_questions": _m("No pending patient questions.", "कोई रोगी प्रश्न लंबित नहीं है।", "நிலுவையில் நோயாளி கேள்விகள் இல்லை.", "పెండింగ్‌లో రోగి ప్రశ్నలు లేవు."),
    "context": _m("GA {weeks}w{days}d.", "गर्भावस्था: {weeks} सप्ताह {days} दिन।", "கர்ப்ப காலம்: {weeks} வாரம் {days} நாள்.", "గర్భధారణ: {weeks} వారాలు {days} రోజులు."),
    "owner": _m("{name} (clinical).", "{name} (चिकित्सक)।", "{name} (மருத்துவர்).", "{name} (డాక్టర్)."),
    "task_line": _m("{title} — owner: {owner}; due: {due}; source: {source}", "{title} — ज़िम्मेदार: {owner}; देय: {due}; स्रोत: {source}",
                    "{title} — பொறுப்பாளர்: {owner}; கெடு: {due}; மூலம்: {source}", "{title} — బాధ్యులు: {owner}; గడువు: {due}; మూలం: {source}"),
    "unassigned": _m("Unassigned", "किसी को नहीं सौंपा", "யாருக்கும் ஒதுக்கப்படவில்லை", "ఎవరికీ కేటాయించలేదు"),
    "not_set": _m("not set", "तय नहीं", "அமைக்கப்படவில்லை", "సెట్ చేయలేదు"),
    "manual": _m("manual", "मैनुअल", "கைமுறை", "మాన్యువల్"),
    "requests": _m("{count} appointment request(s) awaiting confirmation.", "{count} अपॉइंटमेंट अनुरोध पुष्टि की प्रतीक्षा में हैं।",
                   "{count} சந்திப்புக் கோரிக்கை(கள்) உறுதிப்படுத்தலுக்காகக் காத்திருக்கின்றன.", "{count} అపాయింట్‌మెంట్ అభ్యర్థన(లు) నిర్ధారణ కోసం వేచి ఉన్నాయి."),
    "drafts": _m("{count} document / explanation draft(s) awaiting review.", "{count} दस्तावेज़ / स्पष्टीकरण के मसौदे समीक्षा की प्रतीक्षा में हैं।",
                 "{count} ஆவண / விளக்க வரைவு(கள்) பார்வைக்காகக் காத்திருக்கின்றன.", "{count} పత్రం / వివరణ ముసాయిదా(లు) సమీక్ష కోసం వేచి ఉన్నాయి."),
}


def phrase(key: str, language: str, **values) -> str:
    return server_text.pick(PHRASES[key], language).format_map(server_text._Fill(values))


def continuity_lines(db, episode_id: str, language: str = "en") -> str:
    """Unresolved new work carried into a handover draft."""
    def owner_name(user_id):
        user = db.get(models.User, user_id) if user_id else None
        return user.full_name if user else phrase("unassigned", language)

    tasks = db.query(models.Task).filter(models.Task.episode_id == episode_id, models.Task.status.in_(OPEN_TASK_STATUSES)).all()
    lines = [phrase("task_line", language, title=t.title, owner=owner_name(t.owner_user_id), due=t.due_date or phrase("not_set", language),
                    source=t.source_type or phrase("manual", language)) for t in tasks]
    requests = db.query(models.Appointment).filter_by(episode_id=episode_id, status="requested").count()
    drafts = db.query(models.ClinicalOutput).filter_by(episode_id=episode_id, status="DRAFT").count()
    if requests:
        lines.append(phrase("requests", language, count=requests))
    if drafts:
        lines.append(phrase("drafts", language, count=drafts))
    return "\n".join(lines)


def build_doctor_handover_content(db, episode: models.PregnancyEpisode, doctor: models.User) -> dict:
    language = server_text.language_of(db, doctor.id)
    recent = db.query(models.JourneyEvent).filter(models.JourneyEvent.episode_id == episode.id).order_by(models.JourneyEvent.event_date.desc()).first()
    what_happened = f"{recent.title} ({recent.event_date})." if recent else phrase("no_activity", language)
    open_tasks = db.query(models.Task).filter(models.Task.episode_id == episode.id, models.Task.status.in_(OPEN_TASK_STATUSES)).count()
    open_questions = db.query(models.PatientQuestion).filter(models.PatientQuestion.episode_id == episode.id, models.PatientQuestion.status.in_(OPEN_QUESTION_STATUSES)).count()
    what_remains = phrase("open_tasks", language, count=open_tasks) if open_tasks else phrase("nothing_outstanding", language)
    carried = continuity_lines(db, episode.id, language)
    if carried:
        what_remains += "\n" + carried
    return {"context": phrase("context", language, weeks=episode.gestational_age_weeks, days=episode.gestational_age_days),
            "what_happened": what_happened, "what_remains": what_remains, "who_owns_it": phrase("owner", language, name=doctor.full_name),
            "what_to_discuss": phrase("questions_pending", language, count=open_questions) if open_questions else phrase("no_questions", language)}
