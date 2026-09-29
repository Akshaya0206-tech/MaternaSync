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
        background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.1) 0%, rgba(6, 182, 212, 0.1) 50%, rgba(139, 92, 246, 0.1) 100%)',
        borderBottom: '1px solid rgba(16, 185, 129, 0.25)',
        padding: '8px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.825rem',
        color: 'var(--text-primary)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '6px', 
          background: 'rgba(16, 185, 129, 0.15)', 
          color: '#10b981', 
          padding: '2px 8px', 
          borderRadius: '4px',
          fontWeight: 700,
          letterSpacing: '0.03em'
        }}>
          <ShieldAlert size={14} /> CLINICIAN SAFETY RULE & BOUNDARY
        </span>
        
        <span style={{ color: 'var(--text-secondary)' }}>
          MaternaSync is strictly a workflow & data aggregation assistant. It <strong>does not calculate clinical risk</strong>, diagnose, or make autonomous treatment recommendations. All records are raw approved clinical entries.
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
