import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, FileCheck2, MessageCircle, ListTodo, ClipboardCheck, Stethoscope, Bot } from 'lucide-react';
import { fetchDashboard } from '../../api/doctorPortal';
import { assistantStatus } from '../../api/assistant';
import type { DoctorDashboard } from '../../api/doctorPortal';
import { useAuth } from '../../auth/AuthContext';
import { tx, useLanguage } from '../../i18n';
import type { LanguageValue } from '../../i18n';
import { formatFriendlyTime, timeOfDayGreeting } from './format';
import { StatusBadge } from '../../components/StatusBadge';

// The server sends these two words (backend/app/routers/doctor_portal.py).
const BRIEF_STATUS_LABELS: Record<string, string> = {
  Ready: tx('Ready'),
  'Not Ready': tx('Not Ready'),
};

// The server sends the pending items as "2 Questions · 1 Follow-up", or "No pending items" (backend/app/routers/doctor_portal.py).
// Each part is translated on its own; anything it does not recognise is shown as it came.
function translateSummary(summary: string, t: LanguageValue['t']): string {
  return summary
    .split(' · ')
    .map((part) => {
      if (part === 'No pending items') return t('No pending items');
      const match = /^(\d+) (Question|Questions|Follow-up|Follow-ups)$/.exec(part);
      if (!match) return part;
      const count = Number(match[1]);
      if (match[2] === 'Question') return t('{count} Question', { count });
      if (match[2] === 'Questions') return t('{count} Questions', { count });
      if (match[2] === 'Follow-up') return t('{count} Follow-up', { count });
      return t('{count} Follow-ups', { count });
    })
    .join(' · ');
}

export function DashboardPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DoctorDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assistantOpen, setAssistantOpen] = useState<number | null>(null);

  useEffect(() => {
    fetchDashboard()
      .then(setDashboard)
      .catch(() => setError(tx("We couldn't load your dashboard. Please try again.")))
      .finally(() => setIsLoading(false));
    assistantStatus().then((s) => setAssistantOpen(s.open)).catch(() => undefined);
  }, []);

  const stats = dashboard
    ? [
        { label: t("Today's Patients"), value: dashboard.todaysPatients, icon: <Users size={18} />, to: '/doctor/patients' },
        { label: t('Briefs Ready'), value: dashboard.briefsReady, icon: <ClipboardCheck size={18} />, to: '/doctor/todays-brief' },
        { label: t('Questions'), value: dashboard.questions, icon: <MessageCircle size={18} />, to: '/doctor/questions' },
        { label: t('Documents to Review'), value: dashboard.documentsToReview, icon: <FileCheck2 size={18} />, to: '/doctor/patients' },
        { label: t('Follow-ups'), value: dashboard.followUps, icon: <ListTodo size={18} />, to: '/doctor/follow-ups' },
        { label: t('Drafts to Approve'), value: dashboard.draftsToApprove, icon: <Stethoscope size={18} />, to: '/doctor/documentation' },
        ...(assistantOpen === null ? [] : [{ label: t('Care Assistant: needs you'), value: assistantOpen, icon: <Bot size={18} />, to: '/doctor/assistant' }]),
      ]
    : [];

  return (
    <main style={{ padding: '24px', flex: 1, maxWidth: '980px', margin: '0 auto', width: '100%' }}>
      <h1 className="page-title" style={{ fontSize: '1.5rem', margin: '8px 0 6px 0' }}>
        {timeOfDayGreeting()}{user?.fullName ? `, ${user.fullName}` : ''}
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '0 0 24px 0' }}>{t('Today')}</p>

      {isLoading && <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>{t('Loading…')}</div>}
      {error && !isLoading && <div className="glass-panel" style={{ padding: '24px', color: 'var(--rose-urgent)', textAlign: 'center' }}>{t(error)}</div>}

      {dashboard && !isLoading && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '28px' }}>
            {stats.map((s) => (
              <button
                key={s.label}
                onClick={() => navigate(s.to)}
                className="glass-panel"
                style={{ padding: '16px 18px', textAlign: 'left', cursor: 'pointer', font: 'inherit', display: 'flex', flexDirection: 'column', gap: '8px' }}
              >
                <span style={{ color: 'var(--teal-primary)', display: 'flex' }}>{s.icon}</span>
                <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>{s.value}</span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</span>
              </button>
            ))}
          </div>

          <h2 className="page-title" style={{ fontSize: '1.05rem', margin: '0 0 12px 0' }}>{t("Today's Patients")}</h2>
          {dashboard.todayPatientRows.length === 0 ? (
            <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              {t('No appointments scheduled for today.')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {dashboard.todayPatientRows.map((row) => (
                <div key={row.episodeId} className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{row.patientName}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {row.appointmentTime ? formatFriendlyTime(row.appointmentTime) : t('No time set')} · {translateSummary(row.pendingItemsSummary, t)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <StatusBadge label={t(BRIEF_STATUS_LABELS[row.briefStatus] ?? row.briefStatus)} tone={row.briefStatus === 'Ready' ? 'green' : 'neutral'} />
                    <button onClick={() => navigate(`/doctor/patients/${row.episodeId}`)} className="btn-primary" style={{ fontSize: '0.8rem' }}>{t('Open Brief')}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
