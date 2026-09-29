import { useState } from 'react';
import type { PatientEpisode, HandoffPayload } from '../types/patient';
import { 
  X, 
  Send, 
  CheckCircle2, 
  ShieldCheck, 
  Copy, 
  Check, 
  Code, 
  ArrowRight
} from 'lucide-react';

interface Phase1HandoffModalProps {
  episode: PatientEpisode;
  onClose: () => void;
  onConfirmHandoff: () => void;
}

export const Phase1HandoffModal: React.FC<Phase1HandoffModalProps> = ({
  episode,
  onClose,
  onConfirmHandoff
}) => {
  const [copied, setCopied] = useState(false);
  const [showJsonView, setShowJsonView] = useState(false);

  const pendingCount = episode.workflowItems.filter(i => i.status !== 'completed').length;
  const recordsCount = episode.records.length;

  // Prepare Phase 1 Handoff Payload JSON
  const handoffPayload: HandoffPayload = {
    episodeId: episode.id,
    patientName: episode.patientName,
    mrn: episode.mrn,
    gestationalAge: `${episode.gestationalAgeWeeks}w ${episode.gestationalAgeDays}d`,
    recordsCount: recordsCount,
    pendingWorkflowCount: pendingCount,
    recordsByCategory: {
      consultation_note: episode.records.filter(r => r.category === 'consultation_note').length,
      referral: episode.records.filter(r => r.category === 'referral').length,
      patient_message: episode.records.filter(r => r.category === 'patient_message').length,
      care_document: episode.records.filter(r => r.category === 'care_document').length,
      follow_up: episode.records.filter(r => r.category === 'follow_up').length,
      workflow_event: episode.records.filter(r => r.category === 'workflow_event').length
    },
    workflowItemsByType: {
      pending_referral: episode.workflowItems.filter(w => w.type === 'pending_referral').length,
      required_document: episode.workflowItems.filter(w => w.type === 'required_document').length,
      follow_up_needed: episode.workflowItems.filter(w => w.type === 'follow_up_needed').length,
      unanswered_question: episode.workflowItems.filter(w => w.type === 'unanswered_question').length
    },
    chronologicalTimeline: episode.records.map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      category: r.category,
      title: r.title,
      author: r.author
    })),
    pendingItems: episode.workflowItems,
    generatedAt: new Date().toISOString(),
    careTeamSignOffBy: episode.primaryClinician
  };

  const jsonString = JSON.stringify(handoffPayload, null, 2);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
          maxWidth: '840px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-highlight)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
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
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="badge-raw">
                <ShieldCheck size={14} /> PHASE 1 OUTPUT ENGINE
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                MaternaSync Workflow Hand-Off
              </span>
            </div>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', margin: '4px 0 0 0', fontWeight: 700 }}>
              Prepare Context Dataset for "Today's Brief"
            </h2>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Phase Pipeline Breadcrumb Diagram */}
          <div 
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
              fontSize: '0.775rem',
              fontWeight: 700
            }}
          >
            <span style={{ color: 'var(--accent-cyan)' }}>Patient Episode</span>
            <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
            <span style={{ color: 'var(--accent-cyan)' }}>Collected Records ({recordsCount})</span>
            <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
            <span style={{ color: 'var(--accent-cyan)' }}>Chronological Journey</span>
            <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
            <span style={{ color: 'var(--amber-pending)' }}>Pending Workflow Items ({pendingCount})</span>
            <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
            <span style={{ color: '#10b981', background: 'var(--emerald-raw-bg)', padding: '4px 8px', borderRadius: '4px' }}>
              Ready for Today’s Brief
            </span>
          </div>

          {/* Context Aggregation Statistics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            <div style={{ background: 'var(--bg-tertiary)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>COLLECTED RECORDS</span>
              <strong style={{ fontSize: '1.4rem', color: 'var(--accent-cyan)' }}>{recordsCount} Raw Entries</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
                Consults, Labs, Messages, Follow-ups
              </span>
            </div>

            <div style={{ background: 'var(--bg-tertiary)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>WORKFLOW ITEMS FLAGGED</span>
              <strong style={{ fontSize: '1.4rem', color: 'var(--amber-pending)' }}>{pendingCount} Pending Items</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
                Referrals, Docs, Questions & Logs
              </span>
            </div>

            <div style={{ background: 'var(--bg-tertiary)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>CLINICAL BOUNDARY</span>
              <strong style={{ fontSize: '1.1rem', color: 'var(--emerald-raw)' }}>100% Non-Interpretive</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
                Zero autonomous diagnosis/risk score
              </span>
            </div>
          </div>

          {/* Safety & Completeness Checklist */}
          <div>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-primary)', margin: '0 0 10px 0', fontWeight: 700 }}>
              Phase 1 Quality & Provenance Checklist
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                'All approved consultation notes, referrals, messages, and documents gathered for active episode.',
                'Chronological timeline established matching gestational age markers and timestamps.',
                'Original source IDs, authors, facilities, and modalities preserved for full audit trail.',
                'Raw patient data strictly separated from any downstream AI structuring layer.',
                'Documented workflow items (pending referrals, unanswered questions, missing docs) cataloged.'
              ].map((item, idx) => (
                <div 
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '0.825rem',
                    color: 'var(--text-primary)',
                    background: 'var(--bg-tertiary)',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  <CheckCircle2 size={16} style={{ color: 'var(--emerald-raw)', flexShrink: 0 }} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Toggle JSON Payload View */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <button
                onClick={() => setShowJsonView(!showJsonView)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-cyan)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Code size={15} />
                <span>{showJsonView ? 'Hide Handoff Payload JSON' : 'Inspect Structured Handoff Payload (JSON)'}</span>
              </button>

              {showJsonView && (
                <button
                  onClick={handleCopyJson}
                  className="btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                >
                  {copied ? <Check size={13} style={{ color: 'var(--emerald-raw)' }} /> : <Copy size={13} />}
                  <span>{copied ? 'Copied Payload!' : 'Copy JSON'}</span>
                </button>
              )}
            </div>

            {showJsonView && (
              <pre
                style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  maxHeight: '220px',
                  overflowY: 'auto'
                }}
              >
                {jsonString}
              </pre>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div 
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-color)',
            background: 'var(--bg-tertiary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
            Care Team Sign-off Provider: <strong>{episode.primaryClinician}</strong>
          </span>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={onClose} className="btn-secondary">
              Back to Context Review
            </button>
            <button 
              onClick={() => {
                onConfirmHandoff();
                onClose();
              }} 
              className="btn-primary"
            >
              <Send size={16} /> Mark Ready & Hand Off to Today's Brief
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
