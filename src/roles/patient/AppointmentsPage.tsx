import { useEffect, useState } from 'react';
import { Calendar, MapPin, Stethoscope } from 'lucide-react';
import { fetchMyAppointments } from '../../api/patientPortal';
import { tickMyVisitPrep, visitHelpForMe, visitPrepForMe } from '../../api/caregiver';
import type { PrepByVisit, VisitHelpAnswer } from '../../api/caregiver';
import type { PatientAppointment } from '../../api/patientPortal';
import { StatusBadge } from '../../components/StatusBadge';
import type { BadgeTone } from '../../components/StatusBadge';
import { formatFriendlyDate, formatFriendlyTime, friendlyAppointmentStatus } from './format';
import { Link } from 'react-router-dom';
import { useWorkspace, Panel } from '../../components/continuity/shared';
import { VisitChecklist } from '../../components/continuity/VisitChecklist';
import { SummaryList } from './SupportPages';
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

const STATUS_TONE: Record<string, BadgeTone> = {
  scheduled: 'blue',
  completed: 'green',
  cancelled: 'neutral',
};

export function AppointmentsPage() {
  const { t } = useLanguage();
  const workspace = useWorkspace();
  const [appointments, setAppointments] = useState<PatientAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Which trusted person said they will take her, or cannot come, to each visit (by visit id).
  const [help, setHelp] = useState<Record<string, VisitHelpAnswer[]>>({});

  // The checklist her doctor wrote for each upcoming visit (by visit id), for her to tick.
  const [prep, setPrep] = useState<PrepByVisit>({});

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

  return (
    <main style={{ padding: '24px', flex: 1, maxWidth: '760px', margin: '0 auto', width: '100%' }}>
      <h1 className="page-title" style={{ fontSize: '1.4rem', margin: '0 0 20px 0' }}>{t('Appointments')}</h1>
      <Link to="/patient/care-plan" className="btn-secondary" style={{ marginBottom: 16 }}>{t('Request an appointment / view reminders')}</Link>

      {isLoading && (
        <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>{t('Loading your appointments…')}</div>
      )}

      {error && !isLoading && (
        <div className="glass-panel" style={{ padding: '24px', color: 'var(--rose-urgent)', textAlign: 'center' }}>{t(error)}</div>
      )}

      {!isLoading && !error && appointments.length === 0 && (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          {t('No upcoming appointment has been recorded.')}
        </div>
      )}

      {!isLoading && !error && appointments.length > 0 && (
        <div className="glass-panel" style={{ padding: '4px 0' }}>
          {appointments.map((appt, index) => (
            <div
              key={appt.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '14px', padding: '18px 22px',
                borderBottom: index === appointments.length - 1 ? 'none' : '1px solid var(--border-color)',
              }}
            >
              <Calendar size={20} style={{ color: 'var(--teal-primary)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {formatFriendlyDate(appt.scheduledAt)} · {formatFriendlyTime(appt.scheduledAt)}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginTop: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {appt.doctorName && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Stethoscope size={13} /> {appt.doctorName}</span>
                  )}
                  {appt.location && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><MapPin size={13} /> {appt.location}</span>
                  )}
                </div>
                {(help[appt.id] ?? []).map((answer) => (
                  <div key={answer.name} className="visit-help-chip" role="status">
                    <StatusBadge label={answer.status === 'WILL_TAKE' ? t('{name} will take you', { name: answer.name }) : t('{name} cannot come', { name: answer.name })} tone={answer.status === 'WILL_TAKE' ? 'green' : 'neutral'} />
                  </div>
                ))}
                {appt.status === 'scheduled' && prep[appt.id] && (
                  <VisitChecklist items={prep[appt.id]} perspective="woman" onTick={async (item, done) => { await tickMyVisitPrep(item.id, done); setPrep(await visitPrepForMe()); }} />
                )}
              </div>
              <StatusBadge label={friendlyAppointmentStatus(appt.status)} tone={STATUS_TONE[appt.status] ?? 'neutral'} />
            </div>
          ))}
        </div>
      )}
      <Panel title={t('Before your first visit')}>
        <p>{t('At your first antenatal visit your doctor will ask about your health and any earlier pregnancies. It helps to think about the points below before you go. You do not need to know everything: say what you remember, and your doctor will ask the rest.')}</p>
        <ul className="continuity-list">
          {BEFORE_FIRST_VISIT.map((line) => <li key={line}>{t(line)}</li>)}
        </ul>
        <p className="continuity-muted">{t('This list is only what your doctor may ask. It is not medical advice.')}</p>
      </Panel>
      {workspace.data && <Panel title={t('Approved visit summaries')}><SummaryList data={{ ...workspace.data, outputs: workspace.data.outputs.filter(o => !!o.appointmentId) }} /></Panel>}
    </main>
  );
}
