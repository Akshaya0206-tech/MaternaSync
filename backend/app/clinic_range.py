"""The date range of the Clinic Overview (and of its printed and downloaded summary).

A range is two calendar days, both included, counted in UTC like every other date on the clinic pages. No range means "all recorded dates".
Anything that is not two real dates in the right order is refused, so a typo never silently becomes a different report."""
import re
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone

from fastapi import HTTPException

MAX_DAYS = 3660  # about ten years: more than any clinic keeps on these pages
_DAY = re.compile(r"^\d{4}-\d{2}-\d{2}$")


@dataclass(frozen=True)
class Window:
    first: date
    last: date

    @property
    def start(self) -> datetime:
        return datetime.combine(self.first, time.min, tzinfo=timezone.utc)

    @property
    def end(self) -> datetime:
        """The first moment AFTER the last day."""
        return datetime.combine(self.last + timedelta(days=1), time.min, tzinfo=timezone.utc)

    def has(self, moment: datetime | None) -> bool:
        if moment is None:
            return False
        if moment.tzinfo is None:
            moment = moment.replace(tzinfo=timezone.utc)
        return self.start <= moment < self.end

    def has_day(self, text: str | None) -> bool:
        """For a date kept as text, such as an outcome's event date."""
        return bool(text) and _DAY.match(str(text)[:10]) is not None and self.first.isoformat() <= str(text)[:10] <= self.last.isoformat()

    def text(self) -> dict:
        return {"from": self.first.isoformat(), "to": self.last.isoformat()}


def parse_range(date_from: str | None, date_to: str | None) -> Window | None:
    if not date_from and not date_to:
        return None
    if not (date_from and date_to):
        raise HTTPException(400, "Choose both dates of the range, or neither.")
    if not (_DAY.match(date_from) and _DAY.match(date_to)):
        raise HTTPException(400, "Write the dates as YYYY-MM-DD.")
    try:
        first, last = date.fromisoformat(date_from), date.fromisoformat(date_to)
    except ValueError:
        raise HTTPException(400, "That is not a real date.")
    if first > last:
        raise HTTPException(400, "The first date must not be after the last date.")
    if (last - first).days > MAX_DAYS:
        raise HTTPException(400, "The range is too long. Choose ten years or less.")
    return Window(first, last)
