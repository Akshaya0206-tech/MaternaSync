import { X, ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';

interface SafetyDisclaimerModalProps {
  onClose: () => void;
}

export const SafetyDisclaimerModal: React.FC<SafetyDisclaimerModalProps> = ({ onClose }) => {
  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div 
        className="glass-panel animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '680px',
          background: 'var(--bg-secondary)',
          border: '1px solid rgba(16, 185, 129, 0.4)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-tertiary)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div 
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <ShieldAlert size={18} />
            </div>
            <h3 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>
              MaternaSync Clinical Safety Guardrails Policy
            </h3>
          </div>

          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          <div 
            style={{
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '14px',
              color: '#f43f5e',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start'
            }}
          >
            <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ color: '#ffffff', display: 'block' }}>IMPORTANT CLINICAL SAFETY MANDATE</strong>
              MaternaSync is strictly a clinician-first workflow and productivity assistant. It <strong>must never</strong> diagnose, recommend medical treatments, interpret raw lab/vital data, calculate autonomous clinical risk scores, or make clinical decisions.
            </div>
          </div>

          <p style={{ margin: 0 }}>
            Phase 1 is dedicated solely to <strong>Data & Context Collection</strong>. Its core objective is to bring together existing, approved patient-care records into a single chronological timeline for clinician review prior to consultation preparation.
          </p>

          <h4 style={{ color: 'var(--text-primary)', margin: '8px 0 0 0', fontWeight: 700 }}>
            Phase 1 Core Compliance Pillars:
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <CheckCircle2 size={16} style={{ color: 'var(--emerald-raw)', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>1. Non-Interpretive Data Organization:</strong> Records are presented in their raw, factual form without modifying clinical meaning.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <CheckCircle2 size={16} style={{ color: 'var(--emerald-raw)', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>2. Preservation of Original Source & Provenance:</strong> Every record retains its originating author, facility, timestamp, and integration modality ID.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <CheckCircle2 size={16} style={{ color: 'var(--emerald-raw)', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>3. Separation of Raw & AI Content:</strong> Approved clinical records carry an explicit green stenciled badge (`[APPROVED RAW MEDICAL RECORD]`), separating raw inputs from downstream AI formatting.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <CheckCircle2 size={16} style={{ color: 'var(--emerald-raw)', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>4. Workflow Gaps Extraction:</strong> Clinically documented tasks (pending referrals, missing documents, unanswered patient questions) are aggregated for administrative tracking.
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Note: The MaternaSync prototype utilizes synthetic, anonymized maternal care data for demonstration and safety testing purposes.
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn-primary">
            I Understand & Acknowledge
          </button>
        </div>
      </div>
    </div>
  );
};
