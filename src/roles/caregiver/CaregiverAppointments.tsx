import { caregiverAppointments, caregiverVisitPrep, tickCaregiverVisitPrep } from '../../api/caregiver';
import type { CaregiverAppointment, PrepByVisit } from '../../api/caregiver';
import { formatTime } from '../../api/continuity';
import { useLanguage } from '../../i18n';
import { Empty, Feedback, Page, Panel } from '../../components/continuity/shared';
import { VisitChecklist } from '../../components/continuity/VisitChecklist';
import { StatusBadge } from '../../components/StatusBadge';
import { formatFriendlyDate } from '../patient/format';
import { visitStatusOf } from '../patient/visit-format';
import { useCaregiver } from './CaregiverContext';
import { Needs } from './CaregiverGuards';
import { useForWoman } from './useForWoman';
import { VisitHelper, VisitPlace } from './VisitHelper';

const CLOSED_VISITS_SHOWN_FOR_DAYS = 30;
const DAY = 86_400_000;

// ---------------------------------------------------------------- Appointments
export function CaregiverAppointmentsPage() {
  const { t } = useLanguage();
  return (
    <Needs permission="appointments" title={t('Appointments')}>
      {() => <Appointments />}
    </Needs>
  );
}

function Appointments() {
  const { t } = useLanguage();
  const { current } = useCaregiver();
  const list = useForWoman<CaregiverAppointment[]>(caregiverAppointments);
  const prep = useForWoman<PrepByVisit>(caregiverVisitPrep);

  // The same groups, and the same words, as on her own Appointments page.
  const now = Date.now();
  const when = (a: CaregiverAppointment) => new Date(a.scheduledAt).getTime();
  const isAhead = (a: CaregiverAppointment) => when(a) > now;
  const all = list.data ?? [];
  const upcoming = all.filter((a) => a.status === 'scheduled' && isAhead(a)).sort((a, b) => when(a) - when(b));
  const waiting = all.filter((a) => a.status === 'requested' && isAhead(a)).sort((a, b) => when(a) - when(b));
  const notGoingAhead = all.filter((a) => a.status === 'cancelled' && when(a) > now - CLOSED_VISITS_SHOWN_FOR_DAYS * DAY).sort((a, b) => when(a) - when(b));
  const shownAbove = new Set([...upcoming, ...waiting, ...notGoingAhead].map((a) => a.id));
  const past = all.filter((a) => !shownAbove.has(a.id)).sort((a, b) => when(b) - when(a));

  const badge = (a: CaregiverAppointment) => {
    const status = a.status === 'requested' && !isAhead(a)
      ? { label: t('The time she asked for has passed'), tone: 'neutral' as const }
      : visitStatusOf(a.status, isAhead(a), t);
    return <StatusBadge label={status.label} tone={status.tone} />;
  };

  return (
    <Page title={t('Appointments')} subtitle={t('Her visits to the clinic.')}>
      <Feedback error={list.error} />
      <Panel title={t('Upcoming visits')}>
        {list.loading && <p role="status" className="continuity-muted">{t('Loading…')}</p>}
        {list.data && !upcoming.length && <Empty>{t('No upcoming appointment is recorded.')}</Empty>}
        {upcoming.map((a) => (
          <article key={a.id} className="continuity-item">
            <h3>{formatTime(a.scheduledAt)} {badge(a)}</h3>
            <p>{a.type}</p>
            {a.changeRequest && (
              <div className="caregiver-visit-change" role="status">
                <p><strong>{a.changeRequest.kind === 'cancel' ? t('She asked to cancel this visit. Waiting for the clinic.') : t('She asked to move this visit. Waiting for the clinic.')}</strong></p>
                <p className="continuity-muted">
                  {a.changeRequest.requestedAt ? t('She asked on {date}. The visit stays as it is until the clinic answers.', { date: formatFriendlyDate(a.changeRequest.requestedAt) }) : t('The visit stays as it is until the clinic answers.')}
                </p>
              </div>
            )}
            {current && <VisitHelper visit={a} womanName={current.womanName} linkId={current.linkId} onChanged={() => void list.reload()} />}
            {current && prep.data?.[a.id] && (
              <VisitChecklist items={prep.data[a.id]} perspective="helper" onTick={async (item, done) => { await tickCaregiverVisitPrep(current.linkId, item.id, done); await prep.reload(); }} />
            )}
          </article>
        ))}
        {upcoming.length > 0 && (
          <p className="continuity-muted">{t('Google Calendar opens with the visit filled in: tap Save there. The phone calendar file also sets alerts a day before and two hours before.')}</p>
        )}
      </Panel>

      {(waiting.length > 0 || notGoingAhead.length > 0) && (
        <Panel title={t('Visit requests')}>
          {waiting.map((a) => (
            <article key={a.id} className="continuity-item">
              <h3>{formatTime(a.scheduledAt)} {badge(a)}</h3>
              <p>{a.type}</p>
              <VisitPlace location={a.location} />
              <p className="continuity-muted">{t('The clinic has not confirmed this time yet. It will appear under Upcoming visits once it is confirmed.')}</p>
            </article>
          ))}
          {notGoingAhead.map((a) => (
            <article key={a.id} className="continuity-item">
              <h3>{formatTime(a.scheduledAt)} {badge(a)}</h3>
              <p>{a.type}</p>
              <p className="continuity-muted">{t('This visit is not going ahead.')}</p>
            </article>
          ))}
        </Panel>
      )}

      {past.length > 0 && (
        <Panel title={t('Past visits')}>
          {past.map((a) => (
            <article key={a.id} className="continuity-item">
              <h3>{formatTime(a.scheduledAt)} {badge(a)}</h3>
              <p>{a.type}{a.location ? ` · ${a.location}` : ''}</p>
            </article>
          ))}
        </Panel>
      )}
    </Page>
  );
}
