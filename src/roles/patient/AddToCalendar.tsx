import { CalendarPlus } from 'lucide-react';
import { downloadCalendarFile, googleCalendarUrl } from '../../calendar/calendarFile';
import type { CalendarVisit } from '../../calendar/calendarFile';
import { useLanguage } from '../../i18n';

/** Two ways to put one entry in a calendar: Google Calendar (opens with the details filled in; she taps Save there) or a calendar file
 *  that the phone's own calendar opens and that sets the alerts. Nothing here is sent to MaternaSync. */
export function AddToCalendar({ event }: { event: CalendarVisit }) {
  const { t } = useLanguage();
  return (
    <div className="add-to-calendar" role="group" aria-label={t('Add to calendar')}>
      <a className="btn-secondary" href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer" aria-label={`${t('Google Calendar')} (${t('opens in a new tab')})`}>
        <CalendarPlus size={15} aria-hidden="true" /> {t('Google Calendar')}
      </a>
      <button type="button" className="btn-secondary" onClick={() => downloadCalendarFile(event, 'maternasync.ics')}>
        <CalendarPlus size={15} aria-hidden="true" /> {t('Phone calendar with alerts')}
      </button>
    </div>
  );
}
