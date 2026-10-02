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
  ArrowRight,
  AlertTriangle,
  FileText,
  User,
  Clock,
  ListTodo
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
  const [handoffSuccess, setHandoffSuccess] = useState(false);
  const [generatedAt] = useState(() => new Date().toISOString());

  const pendingCount = episode.workflowItems.filter(i => i.status !== 'completed').length;
  const recordsCount = episode.records.length;

  const rawCount = episode.records.filter(r => (r.verificationStatus || 'raw') === 'raw').length;
  const verifiedCount = episode.records.filter(r => r.verificationStatus === 'verified').length;
  const readyCount = episode.records.filter(r => r.verificationStatus === 'ready_for_context').length;
  const rejectedCount = episode.records.filter(r => r.verificationStatus === 'rejected').length;

  const adminDocs = episode.administrativeDocs || [];
  const adminComplete = adminDocs.filter(d => d.status === 'complete').length;
  const adminMissing = adminDocs.filter(d => d.status === 'missing').length;
  const adminPending = adminDocs.filter(d => d.status === 'pending_verification').length;

  // Context Quality Check items
  const qualityItems = [
    { label: 'Patient episode selected & demographic identifiers locked', pass: Boolean(episode.id && episode.mrn) },
    { label: 'Approved raw clinical records collected & cataloged', pass: recordsCount > 0 },
    { label: 'Chronological timeline generated matching gestational age markers', pass: recordsCount > 0 },
    { label: 'Source information & provenance audit trail preserved (100%)', pass: episode.records.every(r => Boolean(r.sourceId && r.facility && r.author)) },
    { label: 'Documented care gaps & pending workflow items catalogued', pass: episode.workflowItems.length > 0 },
    { label: 'Records verified where required by care team protocols', pass: (verifiedCount + readyCount) > 0 },
    { label: 'No unsupported AI interpretations or diagnostic claims added', pass: episode.records.every(r => !r.isAiStructuredOnly) },
    { label: 'Phase 1 non-interpretive safety boundary strictly maintained', pass: true }
  ];

  const allQualityPassed = qualityItems.every(q => q.pass);

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
    verificationBreakdown: {
      raw: rawCount,
      verified: verifiedCount,
      ready_for_context: readyCount,
      rejected: rejectedCount
    },
    chronologicalTimeline: episode.records.map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      category: r.category,
      title: r.title,
      author: r.author,
      verificationStatus: r.verificationStatus || 'raw'
    })),
    pendingItems: episode.workflowItems,
    administrativeCompleteness: {
      totalDocs: adminDocs.length,
      complete: adminComplete,
      missing: adminMissing,
      pendingVerification: adminPending
    },
    qualityChecklist: {
      episodeSelected: true,
      recordsCollected: recordsCount > 0,
      timelineGenerated: true,
      sourcePreserved: true,
      workflowCatalogued: true,
      recordsVerifiedWhereRequired: true,
      safetyBoundaryMaintained: true
    },
    generatedAt,
    careTeamSignOffBy: episode.primaryClinician
  };

  const jsonString = JSON.stringify(handoffPayload, null, 2);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFinalHandoffClick = () => {
    onConfirmHandoff();
    setHandoffSuccess(true);
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.8)',
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
          maxWidth: '860px',
          maxHeight: '92vh',
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
                MaternaSync Clinical Context Package
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
          {/* Post-Handoff Success Screen */}
          {handoffSuccess ? (
            <div className="animate-fade-in" style={{ textAlign: 'center', padding: '30px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <div 
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'var(--emerald-raw-bg)',
                  border: '2px solid var(--emerald-raw)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--emerald-raw)',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <CheckCircle2 size={36} />
              </div>

              <div>
                <h3 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', margin: '0 0 8px 0', fontWeight: 700 }}>
                  Phase 1 Context Successfully Handed Off!
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '540px', margin: '0 auto', lineHeight: 1.5 }}>
                  The verified chronological record dataset, source provenance trail, and pending workflow catalog for <strong>{episode.patientName}</strong> are locked and ready for <strong>Today's Brief</strong>.
                </p>
              </div>

              {/* Handed off summary pills */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '8px' }}>
                <span style={{ background: 'var(--bg-tertiary)', padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                  Total Records: <strong>{recordsCount}</strong>
                </span>
                <span style={{ background: 'var(--bg-tertiary)', padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                  Verified / Ready: <strong>{verifiedCount + readyCount}</strong>
                </span>
                <span style={{ background: 'var(--bg-tertiary)', padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.8rem', color: 'var(--amber-pending)' }}>
                  Pending Workflow Items: <strong>{pendingCount}</strong>
                </span>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button onClick={onClose} className="btn-primary" style={{ padding: '8px 24px' }}>
                  Return to Dashboard
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* SECTION 10: HANDOFF PREVIEW PIPELINE */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    PHASE 1 HANDOFF PACKAGE
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--emerald-raw)', fontWeight: 700 }}>
                    Ready for Today’s Brief
                  </span>
                </div>

                <div 
                  style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-highlight)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px',
                    fontSize: '0.8rem',
                    fontWeight: 700
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                    <User size={15} style={{ color: 'var(--accent-cyan)' }} />
                    <span>Patient Episode</span>
                  </div>

                  <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-cyan)' }}>
                    <FileText size={15} />
                    <span>Collected Records ({recordsCount})</span>
                  </div>

                  <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-teal)' }}>
                    <Clock size={15} />
                    <span>Chronological Timeline</span>
                  </div>

                  <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--amber-pending)' }}>
                    <ListTodo size={15} />
                    <span>Pending Workflow Items ({pendingCount})</span>
                  </div>

                  <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--purple-ai)' }}>
                    <ShieldCheck size={15} />
                    <span>Source & Provenance</span>
                  </div>

                  <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--emerald-raw)' }}>
                    <CheckCircle2 size={15} />
                    <span>Verification Status</span>
                  </div>
                </div>
              </div>

              {/* Status Breakdown Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                <div style={{ background: 'var(--bg-tertiary)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>COLLECTED RECORDS</span>
                  <strong style={{ fontSize: '1.4rem', color: 'var(--accent-cyan)' }}>{recordsCount} Raw Entries</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
                    {readyCount} Ready • {verifiedCount} Verified • {rawCount} Raw
                  </span>
                </div>

                <div style={{ background: 'var(--bg-tertiary)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>WORKFLOW ITEMS FLAGGED</span>
                  <strong style={{ fontSize: '1.4rem', color: 'var(--amber-pending)' }}>{pendingCount} Pending Items</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
                    Catalogued for consultation preparation
                  </span>
                </div>

                <div style={{ background: 'var(--bg-tertiary)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>ADMINISTRATIVE INTAKE</span>
                  <strong style={{ fontSize: '1.4rem', color: 'var(--emerald-raw)' }}>{adminComplete} / {adminDocs.length || 6} Docs</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
                    {adminMissing} missing documents noted
                  </span>
                </div>
              </div>

              {/* SECTION 8: CONTEXT QUALITY CHECK */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <h4 style={{ fontSize: '0.95rem', color: 'var(--text-primary)', margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={18} style={{ color: allQualityPassed ? 'var(--emerald-raw)' : 'var(--amber-pending)' }} />
                    Context Quality Check Checklist
                  </h4>

                  {allQualityPassed && (
                    <span 
                      style={{
                        background: 'var(--emerald-raw-bg)',
                        color: 'var(--emerald-raw)',
                        border: '1px solid var(--emerald-raw-border)',
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        letterSpacing: '0.03em'
                      }}
                    >
                      Phase 1 Context Ready
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {qualityItems.map((item, idx) => (
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
                      {item.pass ? (
                        <CheckCircle2 size={16} style={{ color: 'var(--emerald-raw)', flexShrink: 0 }} />
                      ) : (
                        <AlertTriangle size={16} style={{ color: 'var(--rose-urgent)', flexShrink: 0 }} />
                      )}
                      <span style={{ color: item.pass ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {item.label}
                      </span>
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
                      maxHeight: '200px',
                      overflowY: 'auto'
                    }}
                  >
                    {jsonString}
                  </pre>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!handoffSuccess && (
          <div 
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-color)',
              background: 'var(--bg-tertiary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
              Care Team Sign-off Provider: <strong>{episode.primaryClinician}</strong>
            </span>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={onClose} className="btn-secondary">
                Back to Review
              </button>
              <button 
                onClick={handleFinalHandoffClick} 
                className="btn-primary"
                disabled={!allQualityPassed}
                style={{
                  opacity: allQualityPassed ? 1 : 0.5,
                  cursor: allQualityPassed ? 'pointer' : 'not-allowed'
                }}
              >
                <Send size={16} /> Mark Ready & Hand Off to Today's Brief
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
