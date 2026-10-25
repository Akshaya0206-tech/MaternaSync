/** A calendar file (.ics) for one visit, so a trusted person can put it in their own phone's calendar. Built in the browser from what the
 *  Appointments page already shows: nothing is sent anywhere. The wording comes from the caller, so it is in the person's language. */
export interface CalendarVisit {
  id: string;
  title: string;
  /** An ISO date and time. */
  start: string;
  minutes?: number;
  location?: string | null;
  description?: string;
  /** How long before the visit the phone should remind them. */
  remindMinutes?: number;
}

const stamp = (moment: Date) => moment.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const escape = (text: string) => text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// Lines longer than 75 characters are folded onto the next line, which starts with a space (RFC 5545).
const fold = (line: string): string => (line.length <= 73 ? line : line.slice(0, 73) + '\r\n' + fold(' ' + line.slice(73)));

export function buildCalendarFile(visit: CalendarVisit, now = new Date()): string {
  const start = new Date(visit.start);
  const end = new Date(start.getTime() + (visit.minutes ?? 30) * 60000);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MaternaSync//Visit helper//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${visit.id}@maternasync`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(visit.title)}`,
    ...(visit.location ? [`LOCATION:${escape(visit.location)}`] : []),
    ...(visit.description ? [`DESCRIPTION:${escape(visit.description)}`] : []),
    'BEGIN:VALARM',
    `TRIGGER:-PT${visit.remindMinutes ?? 120}M`,
    'ACTION:DISPLAY',
    `DESCRIPTION:${escape(visit.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** Saves the file through the browser's normal download, so the phone offers to add it to its calendar. */
export function downloadCalendarFile(visit: CalendarVisit): void {
  const url = URL.createObjectURL(new Blob([buildCalendarFile(visit)], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'visit.ics';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A map search for the address the clinic wrote on the visit (OpenStreetMap: no account, and nothing is sent until they open it). */
export const mapUrl = (location: string) => `https://www.openstreetmap.org/search?query=${encodeURIComponent(location)}`;
