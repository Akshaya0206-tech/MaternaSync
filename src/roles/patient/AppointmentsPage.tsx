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
      {workspace.data && <Panel title={t('Approved visit summaries')}><SummaryList data={{ ...workspace.data, outputs: workspace.data.outputs.filter(o => !!o.appointmentId) }} /></Panel>}
    </main>
  );
}
