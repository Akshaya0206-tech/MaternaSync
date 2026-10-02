import { useState } from 'react';
import { ShieldCheck, Info, X } from 'lucide-react';

interface SafetyBannerProps {
  onOpenRulesModal: () => void;
}

export const SafetyBanner: React.FC<SafetyBannerProps> = ({ onOpenRulesModal }) => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      className="animate-fade-in"
      style={{
        background: 'var(--mint-soft)',
        borderBottom: '1px solid var(--border-color)',
        padding: '7px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.78rem',
        color: 'var(--forest-dark)',
        flexWrap: 'wrap',
        gap: '10px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ShieldCheck size={14} style={{ color: 'var(--forest-deep)', flexShrink: 0 }} />
        <span style={{ fontWeight: 600 }}>
          AI assists with organization — the clinician reviews and approves.
        </span>
        <span style={{ color: 'var(--forest-deep)', opacity: 0.75 }}>
          No diagnosis, treatment recommendations, or autonomous clinical decisions.
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <button
          onClick={onOpenRulesModal}
          style={{ background: 'none', border: 'none', color: 'var(--forest-deep)', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.76rem', textDecoration: 'underline' }}
        >
          <Info size={13} /> Full Safety Policy
        </button>
        <button
          onClick={() => setDismissed(true)}
          style={{ background: 'none', border: 'none', color: 'var(--forest-deep)', opacity: 0.6, cursor: 'pointer', padding: '2px' }}
          title="Dismiss banner"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
