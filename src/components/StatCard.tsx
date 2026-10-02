export type StatTone = 'neutral' | 'green' | 'amber' | 'red' | 'blue' | 'purple';

const TONE_ICON_COLOR: Record<StatTone, string> = {
  neutral: 'var(--text-secondary)',
  green: 'var(--emerald-raw)',
  amber: 'var(--amber-pending)',
  red: 'var(--rose-urgent)',
  blue: 'var(--navy-deep)',
  purple: 'var(--purple-ai)'
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone?: StatTone;
}

export const StatCard: React.FC<StatCardProps> = ({ icon, label, value, tone = 'neutral' }) => {
  const valueStr = String(value);
  return (
    <div className="glass-panel" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div
        style={{
          width: '38px',
          height: '38px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-tertiary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: TONE_ICON_COLOR[tone],
          flexShrink: 0
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: valueStr.length > 5 ? '1rem' : '1.35rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.15 }}>
          {value}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          {label}
        </div>
      </div>
    </div>
  );
};
