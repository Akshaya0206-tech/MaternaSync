import { CalendarPlus } from 'lucide-react';
import { caregiverReminders } from '../../api/caregiver';
import type { CaregiverReminder, CaregiverReminders } from '../../api/caregiver';
import { remindHerAboutReminder } from '../../api/caregiverVisits';
import { ApiError } from '../../api/client';
import { formatTime } from '../../api/continuity';
import { downloadCalendarFile, googleCalendarUrl } from '../../calendar/calendarFile';
import type { CalendarVisit } from '../../calendar/calendarFile';
import { tx, useLanguage } from '../../i18n';
import { Badge, Empty, Feedback, Page, Panel, useAction } from '../../components/continuity/shared';
import { useCaregiver } from './CaregiverContext';
import { Needs } from './CaregiverGuards';
import { useForWoman } from './useForWoman';

// ---------------------------------------------------------------- Reminders
const REMINDER_KIND: Record<CaregiverReminder['kind'], string> = {
  appointment: tx('Visit reminder'),
  follow_up: tx('Follow-up reminder'),
  medicine: tx('Medicine reminder'),
  vaccine: tx('Vaccine reminder'),
};
export function CaregiverRemindersPage() {
  const { t } = useLanguage();
  return (
    <Needs permission="reminders" title={t('Reminders')}>
      {() => <Reminders />}
    </Needs>
  );
}
function Reminders() {
  const { t } = useLanguage();
  const { current } = useCaregiver();
  const list = useForWoman<CaregiverReminders>(caregiverReminders);
  const action = useAction();
  const first = current?.womanName.split(' ')[0] ?? '';
  const now = Date.now();
  const isAhead = (r: CaregiverReminder) => !r.answered && new Date(r.scheduledAt).getTime() > now;
  const upcoming = list.data?.items.filter(isAhead) ?? [];
  const left = list.data?.nudgesLeft ?? 0;
  const limit = list.data?.nudgeLimit ?? 0;

  // What goes in their calendar: the time and the kind of reminder. A medicine or vaccine name, or any instructions, are in it only when the server sent them,
  // which it does only if she also allows the summaries and instructions.
  const eventOf = (r: CaregiverReminder): CalendarVisit => ({
    id: r.id,
    title: t('{name}’s reminder: {title}', { name: first, title: r.title ?? t(REMINDER_KIND[r.kind]) }),
    start: r.scheduledAt,
    minutes: 15,
    description: [r.instructions, t('From her reminders in MaternaSync.')].filter(Boolean).join('\n\n'),
    alerts: [0],
  });

  const remind = (reminder: CaregiverReminder) =>
    action.run(async () => {
      if (!current) return;
      try {
        await remindHerAboutReminder(current.linkId, reminder.id);
      } catch (err) {
        if (err instanceof ApiError && err.status === 429) throw new Error(t('You have already sent her {limit} reminders in a day. Please wait before sending another.', { limit }));
        throw err;
      }
      await list.reload();
    }, t('Done. She will see a short note in her Updates.'));

  return (
    <Page title={t('Reminders')} subtitle={t('When her reminders are due. You can remind her, but only she can answer them.')}>
      <Feedback error={list.error || action.error} message={action.message} />
      {list.data && !list.data.detailsAllowed && (
        <p className="continuity-note">{t('Medicine and vaccine names are hidden. {name} can show them by also allowing the summaries and instructions.', { name: first })}</p>
      )}
      <Panel title={t('Her reminders')}>
        {list.loading && <p role="status" className="continuity-muted">{t('Loading…')}</p>}
        {list.data && !list.data.items.length && <Empty>{t('No reminders are due soon.')}</Empty>}
        {list.data && list.data.items.length > 0 && (
          <>
            <ul className="continuity-list caregiver-legend">
              <li><Badge>{t('Due now')}</Badge> {t('The time has come and she has not answered yet.')}</li>
              <li><Badge>{t('She has answered')}</Badge> {t('She has answered it herself. How she answered stays private.')}</li>
            </ul>
            <p className="continuity-muted">
              {t('Remind her sends her one short note in her Updates. It never says what the reminder is about.')}{' '}
              <span role="status">
                {left > 0 ? t('You can send her {left} more of {limit} reminders in a day.', { left, limit }) : t('You have already sent her {limit} reminders in a day. Please wait before sending another.', { limit })}
              </span>
            </p>
            {upcoming.length > 0 && (
              <div className="continuity-actions">
                <button type="button" className="btn-secondary" onClick={() => downloadCalendarFile(upcoming.map(eventOf), 'her-reminders.ics')}>
                  <CalendarPlus size={15} aria-hidden="true" /> {t('Add her upcoming reminders to my calendar')}
                </button>
              </div>
            )}
          </>
        )}
        {list.data?.items.map((r) => {
          const due = !r.answered && new Date(r.scheduledAt).getTime() <= now;
          return (
            <article key={r.id} className="continuity-item">
              <h3>
                {r.title ?? t(REMINDER_KIND[r.kind])} {due && <Badge>{t('Due now')}</Badge>} {r.answered && <Badge>{t('She has answered')}</Badge>}
              </h3>
              <p>{formatTime(r.scheduledAt)}{r.title !== null && ` · ${t(REMINDER_KIND[r.kind])}`}</p>
              {r.instructions && <div className="continuity-copy">{r.instructions}</div>}
              {!r.answered && (
                <div className="continuity-actions">
                  <button type="button" className="btn-secondary" disabled={action.busy || left <= 0} onClick={() => void remind(r)}>
                    {t('Remind her')}
                  </button>
                  {isAhead(r) && (
                    <a className="btn-secondary" href={googleCalendarUrl(eventOf(r))} target="_blank" rel="noopener noreferrer" aria-label={`${t('Google Calendar')}: ${r.title ?? t(REMINDER_KIND[r.kind])} (${t('opens in a new tab')})`}>
                      <CalendarPlus size={15} aria-hidden="true" /> {t('Google Calendar')}
                    </a>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </Panel>
    </Page>
  );
}
