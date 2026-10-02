import type { WorkflowStatus } from '../types/patient';

export type BadgeTone = 'green' | 'amber' | 'red' | 'blue' | 'purple' | 'neutral';

const TONE_STYLES: Record<BadgeTone, { bg: string; color: string; border: string }> = {
  green: { bg: 'var(--emerald-raw-bg)', color: 'var(--emerald-raw)', border: 'var(--emerald-raw-border)' },
  amber: { bg: 'var(--amber-pending-bg)', color: 'var(--amber-pending)', border: 'rgba(154, 91, 46, 0.25)' },
  red: { bg: 'var(--rose-urgent-bg)', color: 'var(--rose-urgent)', border: 'rgba(156, 58, 34, 0.3)' },
  blue: { bg: 'rgba(23, 50, 77, 0.08)', color: 'var(--navy-deep)', border: 'rgba(23, 50, 77, 0.22)' },
  purple: { bg: 'var(--purple-ai-bg)', color: 'var(--purple-ai)', border: 'var(--purple-ai-border)' },
  neutral: { bg: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: 'var(--border-color)' }
};

export const WORKFLOW_STATUS_META: Record<WorkflowStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: 'Pending', tone: 'amber' },
  in_progress: { label: 'In Progress', tone: 'blue' },
  scheduled: { label: 'Scheduled', tone: 'blue' },
  verified: { label: 'Verified', tone: 'green' },
  completed: { label: 'Completed', tone: 'green' }
};

interface StatusBadgeProps {
  label: string;
  tone: BadgeTone;
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ label, tone, icon, size = 'sm' }) => {
  // An unrecognised tone must degrade to neutral, never crash the page.
  const style = TONE_STYLES[tone] ?? TONE_STYLES.neutral;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: size === 'sm' ? '2px 9px' : '4px 12px',
        borderRadius: 'var(--radius-full)',
        fontSize: size === 'sm' ? '0.7rem' : '0.78rem',
        fontWeight: 700,
        letterSpacing: '0.01em',
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
        whiteSpace: 'nowrap'
      }}
    >
      {icon}
      {label}
    </span>
  );
};

export const WorkflowStatusBadge: React.FC<{ status: WorkflowStatus; size?: 'sm' | 'md' }> = ({ status, size }) => {
  const meta = WORKFLOW_STATUS_META[status] ?? { label: status, tone: 'neutral' as BadgeTone };
  return <StatusBadge label={meta.label} tone={meta.tone} size={size} />;
};
