/** Calendar entries for a phone, built in the browser from what the page already shows: nothing is sent to MaternaSync's server.
 *  Two ways in: a Google Calendar link (the person taps Save there) and a calendar file (.ics) that any phone calendar can open.
 *  The wording comes from the caller, so it is in the person's language. */
export interface CalendarVisit {
  id: string;
  title: string;
  /** An ISO date and time. */
  start: string;
  minutes?: number;
  location?: string | null;
  description?: string;
  /** How many minutes before the start the phone should alert them. 0 alerts at the time itself. Several can be given. */
  alerts?: number[];
  /** One alert only; kept for the trusted person's visit helper. */
  remindMinutes?: number;
}

const stamp = (moment: Date) => moment.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const escape = (text: string) => text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// Lines longer than 75 characters are folded onto the next line, which starts with a space (RFC 5545).
const fold = (line: string): string => (line.length <= 73 ? line : line.slice(0, 73) + '\r\n' + fold(' ' + line.slice(73)));

const alertsOf = (visit: CalendarVisit): number[] => (visit.alerts?.length ? visit.alerts : [visit.remindMinutes ?? 120]);
const endOf = (visit: CalendarVisit) => new Date(new Date(visit.start).getTime() + (visit.minutes ?? 30) * 60000);

function eventLines(visit: CalendarVisit, now: Date): string[] {
  return [
    'BEGIN:VEVENT',
    `UID:${visit.id}@maternasync`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(new Date(visit.start))}`,
    `DTEND:${stamp(endOf(visit))}`,
    `SUMMARY:${escape(visit.title)}`,
    ...(visit.location ? [`LOCATION:${escape(visit.location)}`] : []),
    ...(visit.description ? [`DESCRIPTION:${escape(visit.description)}`] : []),
    ...alertsOf(visit).flatMap((minutes) => [
      'BEGIN:VALARM',
      `TRIGGER:${minutes > 0 ? `-PT${minutes}M` : 'PT0S'}`,
      'ACTION:DISPLAY',
      `DESCRIPTION:${escape(visit.title)}`,
      'END:VALARM',
    ]),
    'END:VEVENT',
  ];
}

/** One calendar file holding one or more entries. */
export function buildCalendarFile(visits: CalendarVisit | CalendarVisit[], now = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MaternaSync//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...(Array.isArray(visits) ? visits : [visits]).flatMap((visit) => eventLines(visit, now)),
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** Saves the file through the browser's normal download, so the phone offers to add it to its calendar. */
export function downloadCalendarFile(visits: CalendarVisit | CalendarVisit[], filename = 'visit.ics'): void {
  const url = URL.createObjectURL(new Blob([buildCalendarFile(visits)], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Opens Google Calendar with the entry already filled in (in the Google Calendar app on a phone that has it); the person taps Save there.
 *  Google's link cannot carry an alert: Google Calendar uses the person's own default alerts. The calendar file carries them. */
export function googleCalendarUrl(visit: CalendarVisit): string {
  const text = encodeURIComponent;
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE'
    + `&text=${text(visit.title)}`
    + `&dates=${stamp(new Date(visit.start))}/${stamp(endOf(visit))}`
    + (visit.description ? `&details=${text(visit.description)}` : '')
    + (visit.location ? `&location=${text(visit.location)}` : '');
}

/** A map search for the address the clinic wrote on the visit (OpenStreetMap: no account, and nothing is sent until they open it). */
export const mapUrl = (location: string) => `https://www.openstreetmap.org/search?query=${encodeURIComponent(location)}`;
