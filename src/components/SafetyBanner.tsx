import { useState } from 'react';
import { ShieldAlert, Info, X } from 'lucide-react';

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
        background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.12) 0%, rgba(6, 182, 212, 0.12) 50%, rgba(16, 185, 129, 0.12) 100%)',
        borderBottom: '1px solid rgba(245, 158, 11, 0.3)',
        padding: '10px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.825rem',
        color: 'var(--text-primary)',
        flexWrap: 'wrap',
        gap: '12px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        {/* Exact Required Safety Banner Tagline */}
        <span 
          style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '6px', 
            background: 'rgba(245, 158, 11, 0.2)', 
            color: '#f59e0b', 
            padding: '3px 10px', 
            borderRadius: '4px',
            fontWeight: 800,
            letterSpacing: '0.04em',
            border: '1px solid rgba(245, 158, 11, 0.4)'
          }}
        >
          <ShieldAlert size={15} /> AI ASSISTS WITH ORGANIZATION — CLINICIAN/Care Team REVIEWS
        </span>
        
        <span style={{ color: 'var(--text-secondary)' }}>
          AI must NOT diagnose, recommend treatment, calculate clinical risk, interpret medical data, or make autonomous clinical decisions.
        </span>

        <span 
          style={{
            background: 'var(--bg-tertiary)',
            color: 'var(--text-muted)',
            fontSize: '0.72rem',
            padding: '2px 8px',
            borderRadius: '4px',
            border: '1px solid var(--border-color)',
            fontStyle: 'italic'
          }}
        >
          All AI-assisted drafts labeled DRAFT until human clinician review.
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={onOpenRulesModal}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent-cyan)',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.8rem',
            textDecoration: 'underline'
          }}
        >
          <Info size={14} /> Full Safety Policy
        </button>

        <button
          onClick={() => setDismissed(true)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '2px',
            borderRadius: '4px'
          }}
          title="Dismiss banner"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
