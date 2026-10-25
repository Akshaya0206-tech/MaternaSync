"""The clinic's scheduling rules and the arithmetic of them, in plain code.

A doctor sets the rules on the Care Assistant page (days, opening hours, visit length, notice). The assistant only checks a
visit request against those rules and against other booked visits; it never looks at anything about the patient's health,
so nobody is moved up or down a list. A request inside the rules becomes a one-click proposal to confirm; one outside them
becomes a proposal to offer the next free times. A doctor approves either.

Times are stored in UTC. The clinic's own clock is `offset_minutes` ahead of UTC (330 = India Standard Time).
"""
from datetime import datetime, time, timedelta, timezone

from .. import models
from . import controls

DEFAULTS = {"days": [0, 1, 2, 3, 4, 5], "start": "09:00", "end": "17:00", "minutes": 30, "notice_hours": 2, "offset_minutes": 330, "grace_hours": 2}
WEEKDAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")


def utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def rules(db) -> dict:
    return {**DEFAULTS, **controls.load_scheduling(db)}


def _minutes(clock: str) -> int:
    hours, minutes = clock.split(":")
    return int(hours) * 60 + int(minutes)


def local(moment: datetime, r: dict) -> datetime:
    return utc(moment) + timedelta(minutes=r["offset_minutes"])


def local_text(moment: datetime, r: dict) -> str:
    """For example "Tue 03-11-2026 10:30": the clinic's clock, so a doctor and the woman read the same time."""
    return local(moment, r).strftime("%a %d-%m-%Y %H:%M")


def doctor_episode_ids(db, episode_id: str) -> list[str]:
    """Every patient who shares a doctor with this one: two of them cannot be booked at the same time with that doctor."""
    doctors = [a.doctor_user_id for a in db.query(models.PatientDoctorAssignment).filter_by(episode_id=episode_id).all()]
    if not doctors:
        return [episode_id]
    rows = db.query(models.PatientDoctorAssignment.episode_id).filter(models.PatientDoctorAssignment.doctor_user_id.in_(doctors)).all()
    return list({episode_id, *[r[0] for r in rows]})


def taken(db, r: dict, episode_id: str, start: datetime, ignore_id: str | None = None) -> bool:
    window = timedelta(minutes=r["minutes"])
    naive = utc(start).replace(tzinfo=None)
    query = db.query(models.Appointment).filter(models.Appointment.episode_id.in_(doctor_episode_ids(db, episode_id)), models.Appointment.status == "scheduled",
                                                models.Appointment.scheduled_at > naive - window, models.Appointment.scheduled_at < naive + window)
    return any(a.id != ignore_id for a in query.all())


def problems(db, r: dict, appt: models.Appointment) -> list[str]:
    """Why a requested time is outside the rules. Empty means it is inside them and free."""
    start, now = utc(appt.scheduled_at), datetime.now(timezone.utc)
    if start <= now:
        return ["past"]
    found = []
    if start < now + timedelta(hours=r["notice_hours"]):
        found.append("notice")
    at = local(start, r)
    if at.weekday() not in r["days"]:
        found.append("day")
    clock = at.hour * 60 + at.minute
    if clock < _minutes(r["start"]) or clock + r["minutes"] > _minutes(r["end"]):
        found.append("hours")
    if taken(db, r, appt.episode_id, start, ignore_id=appt.id):
        found.append("taken")
    return found


def explain(codes: list[str], r: dict) -> str:
    text = {"past": "that time has already passed", "notice": f"it is less than {r['notice_hours']} hours away",
            "day": "the clinic does not see patients on that day", "hours": f"it is outside clinic hours ({r['start']}-{r['end']})",
            "taken": "another visit is already booked at that time"}
    return "; ".join(text[c] for c in codes)


def free_slots(db, r: dict, episode_id: str, around: datetime, count: int = 3) -> list[datetime]:
    """The next `count` free times inside the rules, on or after the time she asked for (UTC)."""
    earliest = max(utc(around), datetime.now(timezone.utc) + timedelta(hours=r["notice_hours"]))
    first_day = local(earliest, r).date()
    found = []
    for offset in range(21):
        day = first_day + timedelta(days=offset)
        if day.weekday() not in r["days"]:
            continue
        for clock in range(_minutes(r["start"]), _minutes(r["end"]) - r["minutes"] + 1, r["minutes"]):
            slot = (datetime.combine(day, time.min) + timedelta(minutes=clock - r["offset_minutes"])).replace(tzinfo=timezone.utc)
            if slot > earliest and not taken(db, r, episode_id, slot):
                found.append(slot)
                if len(found) == count:
                    return found
    return found
