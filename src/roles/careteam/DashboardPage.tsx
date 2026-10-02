import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, FileCheck2, MessageCircle, ListTodo, Route, ChevronRight } from 'lucide-react';
import { fetchDashboard } from '../../api/careTeamPortal';
import type { CareTeamDashboard, NeedsAttentionItem } from '../../api/careTeamPortal';
import { useAuth } from '../../auth/AuthContext';
import { formatFriendlyDateTime, timeOfDayGreeting } from './format';

const TYPE_ICON: Record<NeedsAttentionItem['type'], React.ReactNode> = {
  document: <FileCheck2 size={16} />,
  question: <MessageCircle size={16} />,
  referral: <Route size={16} />,
  task: <ListTodo size={16} />,
};

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<CareTeamDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard()
      .then(setDashboard)
      .catch(() => setError("We couldn't load your dashboard. Please try again."))
      .finally(() => setIsLoading(false));
  }, []);

  const firstName = user?.fullName?.split(' ')[0] ?? '';

  const stats = dashboard
    ? [
        { label: 'Active Patients', value: dashboard.activePatients, icon: <Users size={18} />, to: '/care-team/patients' },
        { label: 'Documents to Review', value: dashboard.documentsToReview, icon: <FileCheck2 size={18} />, to: '/care-team/documents' },
        { label: 'Patient Questions', value: dashboard.patientQuestions, icon: <MessageCircle size={18} />, to: '/care-team/questions' },
        { label: 'Open Tasks', value: dashboard.openTasks, icon: <ListTodo size={18} />, to: '/care-team/tasks' },
        { label: 'Pending Referrals', value: dashboard.pendingReferrals, icon: <Route size={18} />, to: '/care-team/referrals' },
      ]
    : [];

  return (
    <main style={{ padding: '24px', flex: 1, maxWidth: '980px', margin: '0 auto', width: '100%' }}>
      <h1 className="page-title" style={{ fontSize: '1.5rem', margin: '8px 0 6px 0' }}>
        {timeOfDayGreeting()}{firstName ? `, ${firstName}` : ''}
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '0 0 24px 0' }}>Today's overview</p>

      {isLoading && (
        <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
      )}
      {error && !isLoading && (
        <div className="glass-panel" style={{ padding: '24px', color: 'var(--rose-urgent)', textAlign: 'center' }}>{error}</div>
      )}

      {dashboard && !isLoading && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            {stats.map((s) => (
              <button
                key={s.label}
                onClick={() => navigate(s.to)}
                className="glass-panel"
                style={{ padding: '16px 18px', textAlign: 'left', cursor: 'pointer', font: 'inherit', display: 'flex', flexDirection: 'column', gap: '8px' }}
              >
                <span style={{ color: 'var(--teal-primary)', display: 'flex' }}>{s.icon}</span>
                <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>{s.value}</span>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</span>
              </button>
            ))}
          </div>

          <h2 className="page-title" style={{ fontSize: '1.05rem', margin: '0 0 12px 0' }}>Needs Attention</h2>
          {dashboard.needsAttention.length === 0 ? (
            <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Nothing needs your attention right now.
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '4px 0' }}>
              {dashboard.needsAttention.map((item, index) => (
                <button
                  key={`${item.type}-${index}`}
                  onClick={() => navigate(item.link)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '14px 20px',
                    background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', textAlign: 'left',
                    borderBottom: index === dashboard.needsAttention.length - 1 ? 'none' : '1px solid var(--border-color)',
                  }}
                >
                  <span style={{ color: 'var(--amber-pending)', flexShrink: 0 }}>{TYPE_ICON[item.type]}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</span>
                    <span style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {item.patientName} · {formatFriendlyDateTime(item.createdAt)}
                    </span>
                  </span>
                  <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
