import type { CalendarVisit } from '../../calendar/calendarFile';
import type { Reminder } from '../../api/continuity';
import type { PatientAppointment } from '../../api/patientPortal';

type Say = (text: string, values?: Record<string, string | number>) => string;

/** A clinic visit as a calendar entry: a reminder a day before and two hours before. Only the visit's own details go in: no health information. */
export function appointmentEvent(appointment: PatientAppointment, t: Say): CalendarVisit {
  return {
    id: appointment.id,
    title: appointment.doctorName
      ? t('Clinic visit with {name}: {type}', { name: appointment.doctorName, type: appointment.appointmentType })
      : t('Clinic visit: {type}', { type: appointment.appointmentType }),
    start: appointment.scheduledAt,
    minutes: 30,
    location: appointment.location,
    description: t('Booked in MaternaSync. Please check the time with the clinic before you travel.'),
    alerts: [24 * 60, 120],
  };
}

/** A medicine, vaccine or visit reminder her doctor approved, with an alert at the time itself. */
export function reminderEvent(reminder: Reminder, t: Say): CalendarVisit {
  return {
    id: reminder.id,
    title: reminder.title,
    start: reminder.scheduledAt,
    minutes: 15,
    description: [reminder.instructions, t('From your care plan in MaternaSync.')].filter(Boolean).join('\n\n'),
    alerts: [0],
  };
}

/** Only what is still ahead can be added to a calendar. */
export const isAhead = (iso: string) => new Date(iso).getTime() > Date.now();
