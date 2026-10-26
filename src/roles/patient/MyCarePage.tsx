import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { HeartPulse, CalendarClock, MessageCircleQuestion, Clock3, AlertCircle, ClipboardCheck, BellRing, MessageSquareReply, Upload } from 'lucide-react';
import { fetchMyDashboard } from '../../api/patientPortal';
import type { PatientDashboard } from '../../api/patientPortal';
import { useAuth } from '../../auth/AuthContext';
import { formatFriendlyDate, formatFriendlyTime, timeOfDayGreeting } from './format';
import { tx, useLanguage } from '../../i18n';

/** Whole days from today to the estimated due date, counted on the calendar in her own time zone. Nothing once the date has passed. */
function daysToGo(edd: string | null): number | null {
  const parts = edd?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!parts) return null;
  const today = new Date();
  const days = Math.round((new Date(+parts[1], +parts[2] - 1, +parts[3]).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000);
  return days >= 0 ? days : null;
}

export function MyCarePage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<PatientDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMyDashboard()
      .then((data) => { if (!cancelled) setDashboard(data); })
      .catch(() => { if (!cancelled) setError(tx("We couldn't load your care summary. Please try again.")); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const firstName = user?.fullName?.split(' ')[0] ?? '';
  const left = dashboard ? daysToGo(dashboard.edd) : null;
  const dueDate = dashboard?.edd
    ? `${formatFriendlyDate(dashboard.edd)}${left === null ? '' : left === 0 ? ` · ${t('Your estimated due date is today')}` : left === 1 ? ` · ${t('1 day to go')}` : ` · ${t('{count} days to go', { count: left })}`}`
    : t('Not yet recorded');

  return (
    <main className="patient-home" style={{ padding: '24px', flex: 1, maxWidth: '760px', margin: '0 auto', width: '100%' }}>
      <h1 className="page-title" style={{ fontSize: '1.6rem', margin: '8px 0 24px 0' }}>
        {timeOfDayGreeting()}{firstName ? `, ${firstName}` : ''}
      </h1>

      {isLoading && (
        <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
          {t('Loading your care summary…')}
        </div>
      )}

      {error && !isLoading && (
        <div className="glass-panel" style={{ padding: '24px', color: 'var(--rose-urgent)', textAlign: 'center' }}>
          {t(error)}
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
                  {t('Action Needed')}
                </div>
                <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>{t(dashboard.actionNeeded)}</div>
              </div>
            </div>
          )}

          {/* An older server does not send these counts; without them the card would only be guessing, so it is left out. */}
          {'checkInToday' in dashboard && (
          <section className="glass-panel today-card" aria-labelledby="today-heading">
            <h2 id="today-heading">{t('Today')}</h2>
            <TodayRow
              icon={<ClipboardCheck size={18} />}
              text={
                dashboard.checkInToday === 'recorded'
                  ? t('Your check-in for today is saved.')
                  : dashboard.checkInToday === 'skipped'
                    ? t('You skipped today’s check-in. You can still fill it in.')
                    : t('You have not filled in today’s check-in yet.')
              }
              to={dashboard.checkInToday === 'recorded' ? undefined : '/patient/daily-log'}
              action={t('Daily check-in')}
            />
            <TodayRow
              icon={<BellRing size={18} />}
              text={
                dashboard.remindersDueCount > 0
                  ? `${t('Reminders waiting for your answer: {count}', { count: dashboard.remindersDueCount })} (${(dashboard.remindersDue ?? []).join(', ')}${dashboard.remindersDueCount > (dashboard.remindersDue ?? []).length ? '…' : ''})`
                  : t('No reminders are waiting for your answer.')
              }
              to={dashboard.remindersDueCount > 0 ? '/patient/care-plan' : undefined}
              action={t('My care plan')}
            />
            <TodayRow
              icon={<MessageSquareReply size={18} />}
              text={
                dashboard.answeredRecentlyCount > 0
                  ? t('Your doctor has answered {count} of your questions in the last 7 days.', { count: dashboard.answeredRecentlyCount })
                  : t('No new answers from your doctor in the last 7 days.')
              }
              to={dashboard.answeredRecentlyCount > 0 ? '/patient/questions' : undefined}
              action={t('Read the answers')}
              isLast
            />
          </section>
          )}

          <div className="quick-actions" role="group" aria-label={t('Quick actions')}>
            <Link className="btn-primary" to="/patient/daily-log"><HeartPulse size={16} aria-hidden="true" /> {t('Daily check-in')}</Link>
            <Link className="btn-secondary" to="/patient/questions"><MessageCircleQuestion size={16} aria-hidden="true" /> {t('Ask my doctor')}</Link>
            <Link className="btn-secondary" to="/patient/records?upload=1"><Upload size={16} aria-hidden="true" /> {t('Upload a report')}</Link>
          </div>

          <div className="glass-panel" style={{ padding: '4px 0' }}>
            <SummaryRow
              icon={<HeartPulse size={18} />}
              label={t('My Pregnancy')}
              value={
                dashboard.gestationalAgeWeeks != null
                  ? dashboard.gestationalAgeDays
                    ? t('{weeks} weeks {days} days', { weeks: dashboard.gestationalAgeWeeks, days: dashboard.gestationalAgeDays })
                    : t('{weeks} weeks', { weeks: dashboard.gestationalAgeWeeks })
                  : t('Not yet recorded')
              }
            />
            <SummaryRow
              icon={<CalendarClock size={18} />}
              label={t('Estimated Due Date')}
              value={dueDate}
            />
            <SummaryRow
              icon={<Clock3 size={18} />}
              label={t('Next Appointment')}
              value={
                dashboard.nextAppointment
                  ? `${formatFriendlyDate(dashboard.nextAppointment.scheduledAt)} · ${formatFriendlyTime(dashboard.nextAppointment.scheduledAt)}${dashboard.nextAppointment.doctorName ? ` · ${dashboard.nextAppointment.doctorName}` : ''}`
                  : dashboard.visitRequest
                    ? t('You asked for a visit on {when}. Waiting for confirmation.', { when: `${formatFriendlyDate(dashboard.visitRequest.scheduledAt)} · ${formatFriendlyTime(dashboard.visitRequest.scheduledAt)}` })
                    : t('No upcoming appointment has been recorded.')
              }
            />
            <SummaryRow
              icon={<MessageCircleQuestion size={18} />}
              label={t('Questions')}
              value={dashboard.openQuestionsCount > 0 ? t('{count} waiting for response', { count: dashboard.openQuestionsCount }) : t('No open questions')}
            />
            <SummaryRow
              icon={<HeartPulse size={18} />}
              label={t('Recent Care')}
              value={dashboard.recentCareTitle ? `${t(dashboard.recentCareTitle)} (${formatFriendlyDate(dashboard.recentCareDate)})` : t('Nothing recorded yet')}
              isLast
            />
          </div>

          <div>
            <button onClick={() => navigate('/patient/journey')} className="btn-primary">
              {t('View My Journey')}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function TodayRow({ icon, text, to, action, isLast }: { icon: React.ReactNode; text: string; to?: string; action: string; isLast?: boolean }) {
  return (
    <div className={`today-row${isLast ? ' today-row-last' : ''}`}>
      <span className="today-icon" aria-hidden="true">{icon}</span>
      <p>{text}</p>
      {to && <Link className="btn-secondary" to={to}>{action}</Link>}
    </div>
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
