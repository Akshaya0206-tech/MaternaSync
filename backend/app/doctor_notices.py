"""Notes to a patient's own doctor(s): who they go to, and keeping the "Today's Brief" notes from piling up.

A note goes only to the doctors assigned to that patient. What a note says is fixed wording from server_text.py: it tells the doctor that
something happened, never what the patient wrote.
"""
from sqlalchemy import or_
from sqlalchemy.orm import Session

from . import models, server_text


def assigned_doctor_ids(db: Session, episode_id: str) -> list[str]:
    """The doctors assigned to this patient, the primary one first, each once."""
    rows = (db.query(models.PatientDoctorAssignment).filter(models.PatientDoctorAssignment.episode_id == episode_id)
            .order_by(models.PatientDoctorAssignment.is_primary.desc(), models.PatientDoctorAssignment.assigned_at).all())
    return list(dict.fromkeys(row.doctor_user_id for row in rows))


def tell_doctors(db: Session, episode: models.PregnancyEpisode, key: str, *, related_type: str, related_id: str, once_while_unread: bool = False) -> int:
    """Add the note `key` for each doctor assigned to the patient. With `once_while_unread`, a doctor who already has the same note about the same
    thing and has not read it is not told again (several files attached to one question make one note). Returns how many doctors were told."""
    told = 0
    for doctor_id in assigned_doctor_ids(db, episode.id):
        if once_while_unread and (
            db.query(models.Notification)
            .filter(models.Notification.recipient_user_id == doctor_id, models.Notification.message_key == key,
                    models.Notification.related_entity_id == related_id, or_(models.Notification.is_read.is_(False), models.Notification.is_read.is_(None)))
            .first()
        ):
            continue
        server_text.notify_key(db, doctor_id, key, episode_id=episode.id, params={"name": episode.patient_name},
                               related_entity_type=related_type, related_entity_id=related_id)
        told += 1
    return told


def mark_brief_notes_read(db: Session, doctor_id: str, episode_id: str) -> int:
    """She has opened this patient's brief, so the "Today's Brief ready" notes about her are read."""
    notes = (db.query(models.Notification)
             .filter(models.Notification.recipient_user_id == doctor_id, models.Notification.episode_id == episode_id, models.Notification.type == "brief_ready",
                     or_(models.Notification.is_read.is_(False), models.Notification.is_read.is_(None)))
             .all())
    for note in notes:
        note.is_read = True
    return len(notes)
