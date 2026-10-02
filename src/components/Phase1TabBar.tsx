import type { PatientEpisode } from '../types/patient';
import {
  Clock,
  FileText,
  ListTodo,
  CheckCircle2,
  History,
  FileCheck2
} from 'lucide-react';

export type ActiveTabType = 'timeline' | 'grid' | 'completeness' | 'workflow' | 'activity';

interface Phase1TabBarProps {
  episode: PatientEpisode;
  activeTab: ActiveTabType;
  onTabChange: (tab: ActiveTabType) => void;
}

export const Phase1TabBar: React.FC<Phase1TabBarProps> = ({ episode, activeTab, onTabChange }) => {
  const pendingCount = episode.workflowItems.filter(i => i.status !== 'completed').length;
  const totalRecords = episode.records.length;

  const adminDocs = episode.administrativeDocs || [];
  const missingAdminCount = adminDocs.filter(d => d.status === 'missing').length;
  const pendingAdminCount = adminDocs.filter(d => d.status === 'pending_verification').length;

  const verifiedRecordsCount = episode.records.filter(r => r.verificationStatus === 'verified' || r.verificationStatus === 'ready_for_context').length;

  const tabStyle = (tab: ActiveTabType): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    padding: '8px 14px',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.8rem',
    fontWeight: 600,
    background: activeTab === tab ? 'var(--mint-soft)' : 'transparent',
    color: activeTab === tab ? 'var(--forest-dark)' : 'var(--text-secondary)',
    border: activeTab === tab ? '1px solid transparent' : '1px solid transparent',
    cursor: 'pointer',
    transition: 'background 0.15s ease'
  });

  const countPill = (bg: string, color: string, text: string | number) => (
    <span style={{ background: bg, color, fontSize: '0.68rem', padding: '1px 7px', borderRadius: '10px', fontWeight: 700 }}>
      {text}
    </span>
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 24px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        flexWrap: 'wrap',
        gap: '10px'
      }}
    >
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <button onClick={() => onTabChange('timeline')} style={tabStyle('timeline')}>
          <Clock size={14} />
          <span>Journey</span>
          {countPill('rgba(22,124,114,0.14)', 'var(--teal-primary)', totalRecords)}
        </button>

        <button onClick={() => onTabChange('grid')} style={tabStyle('grid')}>
          <FileText size={14} />
          <span>Records</span>
        </button>

        <button onClick={() => onTabChange('completeness')} style={tabStyle('completeness')}>
          <FileCheck2 size={14} />
          <span>Missing</span>
          {missingAdminCount > 0
            ? countPill('var(--rose-urgent-bg)', 'var(--rose-urgent)', missingAdminCount)
            : pendingAdminCount > 0
              ? countPill('var(--amber-pending-bg)', 'var(--amber-pending)', pendingAdminCount)
              : null}
        </button>

        <button onClick={() => onTabChange('workflow')} style={tabStyle('workflow')}>
          <ListTodo size={14} />
          <span>Workflow</span>
          {pendingCount > 0 && countPill('var(--amber-pending-bg)', 'var(--amber-pending)', pendingCount)}
        </button>

        <button onClick={() => onTabChange('activity')} style={tabStyle('activity')}>
          <History size={14} />
          <span>Activity</span>
        </button>
      </div>

      <span className="badge-raw">
        <CheckCircle2 size={12} /> Verified: {verifiedRecordsCount} / {totalRecords}
      </span>
    </div>
  );
};
