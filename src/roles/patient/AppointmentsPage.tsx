import { useEffect, useRef, useState } from 'react';
import { Calendar, MapPin, Stethoscope } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { ROOT, localDateTime } from '../../api/continuity';
import { fetchMyAppointments } from '../../api/patientPortal';
import { askToChangeVisit, withdrawVisitChange } from '../../api/questions';
import { useAuth } from '../../auth/AuthContext';
import { mapUrl } from '../../calendar/calendarFile';
import { tickMyVisitPrep, visitHelpForMe, visitPrepForMe } from '../../api/caregiver';
import type { PrepByVisit, VisitHelpAnswer } from '../../api/caregiver';
import type { PatientAppointment } from '../../api/patientPortal';
import { StatusBadge } from '../../components/StatusBadge';
import type { BadgeTone } from '../../components/StatusBadge';
import { formatFriendlyDate, formatFriendlyTime } from './format';
import { Feedback, Field, Panel, useAction, useWorkspace } from '../../components/continuity/shared';
import { VisitChecklist } from '../../components/continuity/VisitChecklist';
import { SummaryList } from './SupportPages';
import { AddToCalendar } from './AddToCalendar';
import { appointmentEvent } from './calendarEvents';
import { tx, useLanguage } from '../../i18n';

// What her doctor may ask at a first antenatal visit, so she can think about it beforehand. It is a list of questions to expect, not advice.
const BEFORE_FIRST_VISIT = [
  tx('The first day of your last period, if you remember it, and whether your periods come regularly.'),
  tx('How and when you found out you were pregnant, and any scan reports you already have.'),
  tx('Any earlier pregnancies, and what happened in each one.'),
  tx('Illnesses you have or have had, and any operations.'),
  tx('Medicines, tablets, vitamins or home remedies you take or have taken, and any allergies.'),
  tx('Illnesses that run in your family, such as diabetes, high blood pressure or twins.'),
  tx('Your vaccination card, especially your tetanus vaccine record.'),
  tx('Your Mother and Child Protection (MCP) card, if you have one, and any earlier reports or blood tests.'),
  tx('Any questions you want to ask your doctor.'),
];

// The words a visit's status is shown in on her page: a visit she asked for is waiting, then confirmed or not going ahead.
const VISIT_STATUS: Record<string, string> = {
  requested: tx('Waiting for confirmation'),
  scheduled: tx('Confirmed'),
  completed: tx('Completed'),
  cancelled: tx('Not going ahead'),
  no_show: tx('Missed appointment'),
};
const STATUS_TONE: Record<string, BadgeTone> = {
  requested: 'amber',
  scheduled: 'blue',
  completed: 'green',
  cancelled: 'neutral',
  no_show: 'neutral',
};
const CLOSED_VISITS_SHOWN_FOR_DAYS = 30;
const DAY = 86_400_000;

export function AppointmentsPage() {
  const { t } = useLanguage();
  const workspace = useWorkspace();
  const action = useAction();
  const [appointments, setAppointments] = useState<PatientAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Which trusted person said they will take her, or cannot come, to each visit (by visit id).
  const [help, setHelp] = useState<Record<string, VisitHelpAnswer[]>>({});
  // The checklist her doctor wrote for each upcoming visit (by visit id), for her to tick.
  const [prep, setPrep] = useState<PrepByVisit>({});
  // The visit she is asking for.
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('Consultation'); // stored as typed; staff read it as-is
  const [notes, setNotes] = useState('');
  const requestPanel = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  // The items she has ticked on "Before your first visit": kept on this phone only, for her.
  const ticksKey = `maternasync.first-visit-ticks.${user?.id ?? ''}`;
  const [ticked, setTicked] = useState<number[]>(() => {
    try {
      const kept = JSON.parse(localStorage.getItem(ticksKey) ?? '[]');
      return Array.isArray(kept) ? kept.filter((n) => Number.isInteger(n)) : [];
    } catch {
      return [];
    }
  });
  const tick = (index: number, on: boolean) => {
    const next = on ? [...new Set([...ticked, index])] : ticked.filter((n) => n !== index);
    setTicked(next);
    try {
      localStorage.setItem(ticksKey, JSON.stringify(next));
    } catch {
      // The ticks stay on screen for this visit only.
    }
  };

  // Asking to cancel or move a confirmed visit. Only a request: the visit stays as it is until a doctor acts.
  const [changing, setChanging] = useState<{ id: string; kind: 'cancel' | 'reschedule' } | null>(null);
  const [changeTime, setChangeTime] = useState('');
  const [changeNote, setChangeNote] = useState('');
  const sendChange = (appt: PatientAppointment) =>
    action.run(async () => {
      if (!changing) return;
      await askToChangeVisit(appt.id, changing.kind === 'reschedule'
        ? { kind: 'reschedule', preferredAt: new Date(changeTime).toISOString(), note: changeNote.trim() }
        : { kind: 'cancel', note: changeNote.trim() });
      setChanging(null);
      setChangeTime('');
      setChangeNote('');
      setAppointments(await fetchMyAppointments());
    }, t('Your request was sent. Your visit has not changed: your doctor’s clinic will answer.'));
  const withdraw = (appt: PatientAppointment) =>
    action.run(async () => {
      await withdrawVisitChange(appt.id);
      setAppointments(await fetchMyAppointments());
    }, t('Your request was withdrawn. Your visit stays as it is.'));

  useEffect(() => {
    visitHelpForMe().then(setHelp).catch(() => setHelp({}));
    visitPrepForMe().then(setPrep).catch(() => setPrep({}));
  }, []);

  useEffect(() => {
    fetchMyAppointments()
      .then(setAppointments)
      .catch(() => setError(tx("We couldn't load your appointments. Please try again.")))
      .finally(() => setIsLoading(false));
  }, []);

  const now = Date.now();
  const isAhead = (appt: PatientAppointment) => new Date(appt.scheduledAt).getTime() > now;
  const upcoming = appointments.filter((a) => a.status === 'scheduled' && isAhead(a));
  const waiting = appointments.filter((a) => a.status === 'requested' && isAhead(a));
  const notGoingAhead = appointments.filter((a) => a.status === 'cancelled' && new Date(a.scheduledAt).getTime() > now - CLOSED_VISITS_SHOWN_FOR_DAYS * DAY);
  const shownAbove = new Set([...upcoming, ...waiting, ...notGoingAhead].map((a) => a.id));
  const past = appointments.filter((a) => !shownAbove.has(a.id)).sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());

  const askForAnother = () => {
    requestPanel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    requestPanel.current?.querySelector<HTMLElement>('input')?.focus();
  };

  const statusOf = (appt: PatientAppointment) =>
    appt.status === 'scheduled' && !isAhead(appt)
      ? { label: t('The time has passed'), tone: 'neutral' as BadgeTone }
      : appt.status === 'requested' && !isAhead(appt)
        ? { label: t('The time you asked for has passed'), tone: 'neutral' as BadgeTone }
        : { label: t(VISIT_STATUS[appt.status] ?? appt.status), tone: STATUS_TONE[appt.status] ?? 'neutral' };

  const row = (appt: PatientAppointment, extra?: React.ReactNode) => {
    const status = statusOf(appt);
    return (
      <div key={appt.id} className="visit-row">
        <Calendar size={20} className="visit-row-icon" aria-hidden="true" />
        <div className="visit-row-body">
          <div className="visit-row-when">
            {formatFriendlyDate(appt.scheduledAt)} · {formatFriendlyTime(appt.scheduledAt)}
          </div>
          <div className="visit-row-meta">
            <span>{appt.appointmentType}</span>
            {appt.doctorName && (
              <span><Stethoscope size={13} aria-hidden="true" /> {appt.doctorName}</span>
            )}
            {appt.location && (
              <span><MapPin size={13} aria-hidden="true" /> {appt.location}</span>
            )}
            {appt.location && (appt.status === 'scheduled' || appt.status === 'requested') && isAhead(appt) && (
              <a href={mapUrl(appt.location)} target="_blank" rel="noopener noreferrer" aria-label={`${t('Directions to the clinic')} (${t('opens in a new tab')})`}>{t('Directions to the clinic')}</a>
            )}
          </div>
          {extra}
        </div>
        <StatusBadge label={status.label} tone={status.tone} />
      </div>
    );
  };

  return (
    <main className="continuity-page appointments-page">
      <h1 className="page-title" style={{ fontSize: '1.4rem', margin: '0 0 20px 0' }}>{t('Appointments')}</h1>
      <Link to="/patient/care-plan" className="btn-secondary" style={{ marginBottom: 16 }}>{t('See my reminders')}</Link>
      <Feedback error={action.error} message={action.message} />

      {isLoading && (
        <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>{t('Loading your appointments…')}</div>
      )}

      {error && !isLoading && (
        <div className="glass-panel" style={{ padding: '24px', color: 'var(--rose-urgent)', textAlign: 'center' }}>{t(error)}</div>
      )}

      {!isLoading && !error && (
        <Panel title={t('Upcoming visits')}>
          {upcoming.length === 0 && <p className="continuity-empty">{t('No upcoming appointment has been recorded.')}</p>}
          {upcoming.map((appt) =>
            row(
              appt,
              <>
                {(help[appt.id] ?? []).map((answer) => (
                  <div key={answer.name} className="visit-help-chip" role="status">
                    <StatusBadge label={answer.status === 'WILL_TAKE' ? t('{name} will take you', { name: answer.name }) : t('{name} cannot come', { name: answer.name })} tone={answer.status === 'WILL_TAKE' ? 'green' : 'neutral'} />
                  </div>
                ))}
                {prep[appt.id] && (
                  <VisitChecklist items={prep[appt.id]} perspective="woman" onTick={async (item, done) => { await tickMyVisitPrep(item.id, done); setPrep(await visitPrepForMe()); }} />
                )}
                <AddToCalendar event={appointmentEvent(appt, t)} />
                {appt.changeRequest ? (
                  <div className="visit-change" role="status">
                    <p>
                      {appt.changeRequest.kind === 'cancel'
                        ? t('You asked to cancel this visit. Waiting for your clinic.')
                        : t('You asked to move this visit to {when}. Waiting for your clinic.', { when: `${formatFriendlyDate(appt.changeRequest.preferredAt)} · ${formatFriendlyTime(appt.changeRequest.preferredAt)}` })}
                    </p>
                    <p className="continuity-muted">{t('Your visit stays as it is until your doctor’s clinic answers.')}</p>
                    <button type="button" className="btn-secondary" disabled={action.busy} onClick={() => void withdraw(appt)}>{t('Withdraw my request')}</button>
                  </div>
                ) : changing?.id === appt.id ? (
                  <form className="visit-change" onSubmit={(e) => { e.preventDefault(); void sendChange(appt); }}>
                    <p className="continuity-muted">
                      {changing.kind === 'cancel'
                        ? t('This only asks your clinic to cancel. Your visit stays booked until they answer.')
                        : t('This only asks your clinic to move the visit. Your visit stays as it is until they answer.')}
                    </p>
                    {changing.kind === 'reschedule' && (
                      <Field label={t('The time you would like instead')}>
                        <input required type="datetime-local" min={localDateTime()} value={changeTime} onChange={(e) => setChangeTime(e.target.value)} />
                      </Field>
                    )}
                    <Field label={t('Note for your doctor (optional)')}>
                      <textarea rows={2} maxLength={500} value={changeNote} onChange={(e) => setChangeNote(e.target.value)} />
                    </Field>
                    <div className="continuity-actions">
                      <button className="btn-primary" disabled={action.busy}>{t('Send my request')}</button>
                      <button type="button" className="btn-secondary" onClick={() => setChanging(null)}>{t('Cancel')}</button>
                    </div>
                  </form>
                ) : (
                  <div className="continuity-actions">
                    <button type="button" className="btn-secondary" onClick={() => { setChanging({ id: appt.id, kind: 'reschedule' }); setChangeTime(''); setChangeNote(''); }}>{t('Ask to change the time')}</button>
                    <button type="button" className="btn-secondary" onClick={() => { setChanging({ id: appt.id, kind: 'cancel' }); setChangeNote(''); }}>{t('Ask to cancel')}</button>
                  </div>
                )}
              </>,
            ),
          )}
          {upcoming.length > 0 && (
            <p className="continuity-muted">
              {t('Google Calendar opens with the visit filled in: tap Save there. The phone calendar file also sets alerts a day before and two hours before.')}
            </p>
          )}
        </Panel>
      )}

      <div ref={requestPanel}>
        <Panel title={t('Request an appointment')}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action.run(async () => {
                await api.post(`${ROOT}/episodes/${workspace.episodeId}/appointments`, {
                  scheduledAt: new Date(time).toISOString(),
                  appointmentType: reason,
                  notes,
                });
                setNotes('');
                setAppointments(await fetchMyAppointments());
                await workspace.reload();
              }, t('Request sent. Your doctor’s clinic will confirm the time. You can see where it stands below.'));
            }}
          >
            <div className="continuity-fields">
              <Field label={t('Preferred date and time')}>
                <input required type="datetime-local" min={localDateTime()} value={time} onChange={(e) => setTime(e.target.value)} />
              </Field>
              <Field label={t('Visit type')}>
                <input required value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
            </div>
            <Field label={t('Notes for your doctor')}>
              <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <button className="btn-primary" disabled={action.busy || !workspace.episodeId}>{t('Request visit')}</button>
          </form>
        </Panel>
      </div>

      {!isLoading && !error && (waiting.length > 0 || notGoingAhead.length > 0) && (
        <Panel title={t('Your visit requests')}>
          {waiting.map((appt) => row(appt, <p className="continuity-muted">{t('Your clinic has not confirmed this time yet. It will appear under Upcoming visits once it is confirmed.')}</p>))}
          {notGoingAhead.map((appt) =>
            row(
              appt,
              <div>
                <p className="continuity-muted">
                  {t('This visit is not going ahead. If your clinic offered other times, you will find them under Updates.')}
                </p>
                <div className="continuity-actions">
                  <Link className="btn-secondary" to="/patient/updates">{t('Open Updates')}</Link>
                  <button type="button" className="btn-secondary" onClick={askForAnother}>{t('Ask for another time')}</button>
                </div>
              </div>,
            ),
          )}
        </Panel>
      )}

      {!isLoading && !error && past.length > 0 && <Panel title={t('Past visits')}>{past.map((appt) => row(appt))}</Panel>}

      {/* Shown until her first visit is done: a visit marked completed means it has happened. */}
      {!isLoading && !appointments.some((a) => a.status === 'completed') && (
        <Panel title={t('Before your first visit')}>
          <p>{t('At your first antenatal visit your doctor will ask about your health and any earlier pregnancies. It helps to think about the points below before you go. You do not need to know everything: say what you remember, and your doctor will ask the rest.')}</p>
          <ul className="first-visit-list">
            {BEFORE_FIRST_VISIT.map((line, index) => (
              <li key={line}>
                <label className="continuity-check">
                  <input type="checkbox" checked={ticked.includes(index)} onChange={(e) => tick(index, e.target.checked)} /> {t(line)}
                </label>
              </li>
            ))}
          </ul>
          <p className="continuity-muted" aria-live="polite">
            {t('{done} of {total} ticked. Your ticks are kept on this phone only.', { done: ticked.filter((n) => n < BEFORE_FIRST_VISIT.length).length, total: BEFORE_FIRST_VISIT.length })}
          </p>
          <p className="continuity-muted">{t('This list is only what your doctor may ask. It is not medical advice.')}</p>
        </Panel>
      )}
      {workspace.data && (
        <Panel title={t('Approved visit summaries')}>
          <SummaryList
            data={{ ...workspace.data, outputs: workspace.data.outputs.filter((o) => !!o.appointmentId) }}
            emptyText={t('No summary of a visit has been released yet.')}
          />
        </Panel>
      )}
    </main>
  );
}
