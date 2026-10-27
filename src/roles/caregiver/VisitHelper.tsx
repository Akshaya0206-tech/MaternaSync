import { CalendarPlus, MapPin } from 'lucide-react';
import { clearVisitHelp, setVisitHelp } from '../../api/caregiver';
import type { CaregiverAppointment, VisitAnswer } from '../../api/caregiver';
import { Feedback, useAction } from '../../components/continuity/shared';
import { useLanguage } from '../../i18n';
import { directionsUrl, downloadCalendarFile, googleCalendarUrl, mapUrl } from '../../calendar/calendarFile';

/** Where a visit is: the address the clinic wrote, with a map and directions. Opening either only sends the address to the map, never anything about her. */
export function VisitPlace({ location, saySoWhenMissing = false }: { location: string | null; saySoWhenMissing?: boolean }) {
  const { t } = useLanguage();
  if (!location) {
    return saySoWhenMissing ? <p className="visit-helper-place"><span className="continuity-muted">{t('The clinic has not written where this visit is. Ask the clinic before you travel.')}</span></p> : null;
  }
  return (
    <p className="visit-helper-place">
      <MapPin size={14} aria-hidden="true" /> {location} ·{' '}
      <a href={mapUrl(location)} target="_blank" rel="noopener noreferrer" aria-label={`${t('Show on map')} (${t('opens in a new tab')})`}>{t('Show on map')}</a> ·{' '}
      <a href={directionsUrl(location)} target="_blank" rel="noopener noreferrer" aria-label={`${t('Directions')} (${t('opens in a new tab')})`}>{t('Directions')}</a>
    </p>
  );
}

/** For one upcoming visit: where it is (with a map and directions), a calendar entry for their phone (Google Calendar, or a file with alerts), and "I'll take her" or "I can't come".
 *  Their answer is shown to her on her Appointments page and she is told in her Updates. It says who can come, nothing about the visit. */
export function VisitHelper({ visit, womanName, linkId, onChanged }: { visit: CaregiverAppointment; womanName: string; linkId: string; onChanged: () => void }) {
  const { t } = useLanguage();
  const action = useAction();
  if (visit.status !== 'scheduled' || new Date(visit.scheduledAt).getTime() <= Date.now()) return null;
  const answer = visit.help?.status ?? null;

  const answerWith = (status: VisitAnswer) =>
    action.run(async () => {
      await setVisitHelp(linkId, visit.id, status);
      onChanged();
    }, t('Saved. She can see this.'));
  const clear = () =>
    action.run(async () => {
      await clearVisitHelp(linkId, visit.id);
      onChanged();
    }, t('Saved.'));

  // Only the visit's own details go in: no health information. The file also sets alerts a day before and two hours before.
  const event = {
    id: visit.id,
    title: t('Visit with {name}: {type}', { name: womanName.split(' ')[0], type: t(visit.type) }),
    start: visit.scheduledAt,
    minutes: 30,
    location: visit.location,
    description: t('Added from MaternaSync. Please check the time with the clinic before you travel.'),
    alerts: [24 * 60, 120],
  };

  return (
    <div className="visit-helper">
      <VisitPlace location={visit.location} saySoWhenMissing />
      <div className="continuity-actions">
        <button type="button" className="btn-secondary" onClick={() => downloadCalendarFile(event)}>
          <CalendarPlus size={15} aria-hidden="true" /> {t('Add to my calendar')}
        </button>
        <a className="btn-secondary" href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer" aria-label={`${t('Google Calendar')} (${t('opens in a new tab')})`}>
          <CalendarPlus size={15} aria-hidden="true" /> {t('Google Calendar')}
        </a>
      </div>
      <fieldset className="visit-helper-answer">
        <legend>{t('Can you take her to this visit?')}</legend>
        <Feedback error={action.error} />
        <div className="continuity-actions">
          <button type="button" className={answer === 'WILL_TAKE' ? 'btn-primary' : 'btn-secondary'} aria-pressed={answer === 'WILL_TAKE'} disabled={action.busy} onClick={() => void answerWith('WILL_TAKE')}>
            {t("I'll take her")}
          </button>
          <button type="button" className={answer === 'CANNOT' ? 'btn-primary' : 'btn-secondary'} aria-pressed={answer === 'CANNOT'} disabled={action.busy} onClick={() => void answerWith('CANNOT')}>
            {t("I can't come")}
          </button>
          {answer && (
            <button type="button" className="btn-secondary" disabled={action.busy} onClick={() => void clear()}>{t('Not sure yet')}</button>
          )}
        </div>
        <p className="continuity-muted" role="status">
          {answer === 'WILL_TAKE' ? t('You said you will take her. She can see this.') : answer === 'CANNOT' ? t('You said you cannot come. She can see this.') : t('You have not answered yet. She will see your answer.')}
        </p>
      </fieldset>
    </div>
  );
}
