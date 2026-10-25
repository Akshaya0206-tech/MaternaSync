import { CalendarPlus, MapPin } from 'lucide-react';
import { clearVisitHelp, setVisitHelp } from '../../api/caregiver';
import type { CaregiverAppointment, VisitAnswer } from '../../api/caregiver';
import { Feedback, useAction } from '../../components/continuity/shared';
import { useLanguage } from '../../i18n';
import { downloadCalendarFile, mapUrl } from './calendar';

/** For one upcoming visit: where it is (with a map link), a calendar file for their phone, and "I'll take her" or "I can't come".
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

  return (
    <div className="visit-helper">
      <p className="visit-helper-place">
        {visit.location ? (
          <>
            <MapPin size={14} aria-hidden="true" /> {visit.location} ·{' '}
            <a href={mapUrl(visit.location)} target="_blank" rel="noreferrer">{t('Show on map')}</a>
          </>
        ) : (
          <span className="continuity-muted">{t('The clinic has not written where this visit is. Ask the clinic before you travel.')}</span>
        )}
      </p>
      <div className="continuity-actions">
        <button
          type="button"
          className="btn-secondary"
          onClick={() =>
            downloadCalendarFile({
              id: visit.id,
              title: t('Visit with {name}: {type}', { name: womanName.split(' ')[0], type: t(visit.type) }),
              start: visit.scheduledAt,
              location: visit.location,
              description: t('Added from MaternaSync. Please check the time with the clinic before you travel.'),
            })
          }
        >
          <CalendarPlus size={15} aria-hidden="true" /> {t('Add to my calendar')}
        </button>
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
