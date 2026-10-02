import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeartPulse, CalendarClock, MessageCircleQuestion, Clock3, AlertCircle } from 'lucide-react';
import { fetchMyDashboard } from '../../api/patientPortal';
import type { PatientDashboard } from '../../api/patientPortal';
import { useAuth } from '../../auth/AuthContext';
import { formatFriendlyDate, formatFriendlyTime, timeOfDayGreeting } from './format';

export function MyCarePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<PatientDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMyDashboard()
      .then((data) => { if (!cancelled) setDashboard(data); })
      .catch(() => { if (!cancelled) setError("We couldn't load your care summary. Please try again."); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const firstName = user?.fullName?.split(' ')[0] ?? '';

  return (
    <main style={{ padding: '24px', flex: 1, maxWidth: '760px', margin: '0 auto', width: '100%' }}>
      <h1 className="page-title" style={{ fontSize: '1.6rem', margin: '8px 0 24px 0' }}>
        {timeOfDayGreeting()}{firstName ? `, ${firstName}` : ''}
      </h1>

      {isLoading && (
        <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading your care summary…
        </div>
      )}

      {error && !isLoading && (
        <div className="glass-panel" style={{ padding: '24px', color: 'var(--rose-urgent)', textAlign: 'center' }}>
          {error}
        </div>
      )}

      {dashboard && !isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {dashboard.actionNeeded && (
            <div
              className="glass-panel"
              style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: '12px', background: 'var(--peach-muted)', border: '1px solid rgba(154, 91, 46, 0.25)' }}
            >
              <AlertCircle size={18} style={{ color: 'var(--amber-pending)', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--amber-pending)', textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: '2px' }}>
                  Action Needed
                </div>
                <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>{dashboard.actionNeeded}</div>
              </div>
            </div>
          )}

          <div className="glass-panel" style={{ padding: '4px 0' }}>
            <SummaryRow
              icon={<HeartPulse size={18} />}
              label="My Pregnancy"
              value={
                dashboard.gestationalAgeWeeks != null
                  ? `${dashboard.gestationalAgeWeeks} weeks${dashboard.gestationalAgeDays ? ` ${dashboard.gestationalAgeDays} days` : ''}`
                  : 'Not yet recorded'
              }
            />
            <SummaryRow
              icon={<CalendarClock size={18} />}
              label="Estimated Due Date"
              value={dashboard.edd ? formatFriendlyDate(dashboard.edd) : 'Not yet recorded'}
            />
            <SummaryRow
              icon={<Clock3 size={18} />}
              label="Next Appointment"
              value={
                dashboard.nextAppointment
                  ? `${formatFriendlyDate(dashboard.nextAppointment.scheduledAt)} · ${formatFriendlyTime(dashboard.nextAppointment.scheduledAt)}${dashboard.nextAppointment.doctorName ? ` · ${dashboard.nextAppointment.doctorName}` : ''}`
                  : 'No upcoming appointment has been recorded.'
              }
            />
            <SummaryRow
              icon={<MessageCircleQuestion size={18} />}
              label="Questions"
              value={dashboard.openQuestionsCount > 0 ? `${dashboard.openQuestionsCount} waiting for response` : 'No open questions'}
            />
            <SummaryRow
              icon={<HeartPulse size={18} />}
              label="Recent Care"
              value={dashboard.recentCareTitle ? `${dashboard.recentCareTitle} (${formatFriendlyDate(dashboard.recentCareDate)})` : 'Nothing recorded yet'}
              isLast
            />
          </div>

          <div>
            <button onClick={() => navigate('/patient/journey')} className="btn-primary">
              View My Journey
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function SummaryRow({ icon, label, value, isLast }: { icon: React.ReactNode; label: string; value: string; isLast?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '14px',
        padding: '16px 22px',
        borderBottom: isLast ? 'none' : '1px solid var(--border-color)',
      }}
    >
      <span style={{ color: 'var(--teal-primary)', flexShrink: 0, marginTop: '1px' }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: '2px' }}>
          {label}
        </div>
        <div style={{ fontSize: '0.92rem', color: 'var(--text-primary)', fontWeight: 600 }}>{value}</div>
      </div>
    </div>
  );
}
