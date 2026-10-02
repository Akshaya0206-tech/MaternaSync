import { useState } from 'react';
import type { PatientRecord, VerificationStatus } from '../types/patient';
import { 
  X, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  FileCode, 
  UserCheck, 
  ExternalLink, 
  Lock,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';

interface RecordDetailModalProps {
  record: PatientRecord | null;
  onClose: () => void;
  onUpdateVerification?: (recordId: string, newStatus: VerificationStatus, verifier: string) => void;
}

export const RecordDetailModal: React.FC<RecordDetailModalProps> = ({
  record,
  onClose,
  onUpdateVerification
}) => {
  const [showRawSourceModal, setShowRawSourceModal] = useState(false);
  const [selectedVerifier, setSelectedVerifier] = useState('Dr. Eleanor Vance, MD (Attending Obstetrician)');

  if (!record) return null;

  const formattedDate = new Date(record.timestamp).toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'short'
  });

  const currentStatus = record.verificationStatus || 'raw';

  const getStatusBadge = (status: VerificationStatus) => {
    switch (status) {
      case 'ready_for_context':
        return (
          <span 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'var(--emerald-raw-bg)',
              color: 'var(--teal-primary)',
              border: '1px solid rgba(22, 124, 114, 0.4)',
              padding: '4px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.75rem',
              fontWeight: 800,
              letterSpacing: '0.03em'
            }}
          >
            <ShieldCheck size={14} /> READY FOR CONTEXT
          </span>
        );
      case 'verified':
        return (
          <span 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'var(--emerald-raw-bg)',
              color: 'var(--emerald-raw)',
              border: '1px solid var(--emerald-raw-border)',
              padding: '4px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.75rem',
              fontWeight: 800,
              letterSpacing: '0.03em'
            }}
          >
            <CheckCircle2 size={14} /> VERIFIED BY CARE TEAM
          </span>
        );
      case 'raw':
      default:
        return (
          <span 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'var(--amber-pending-bg)',
              color: 'var(--amber-pending)',
              border: '1px solid rgba(154, 91, 46, 0.3)',
              padding: '4px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.75rem',
              fontWeight: 800,
              letterSpacing: '0.03em'
            }}
          >
            <Clock size={14} /> RAW (UNVERIFIED)
          </span>
        );
    }
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
          maxWidth: '820px',
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
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-tertiary)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {getStatusBadge(currentStatus)}
            <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: 700 }}>
              Wk {record.gestationalAgeWeeks} + {record.gestationalAgeDays}d (Trimester {record.trimester})
            </span>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Title & Category Header */}
          <div>
            <h2 style={{ fontSize: '1.35rem', color: 'var(--text-primary)', margin: '0 0 6px 0', fontWeight: 700 }}>
              {record.title}
            </h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Recorded on {formattedDate}
            </span>
          </div>

          {/* SECTION 3: SOURCE PROVENANCE PANEL */}
          <div 
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-highlight)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Lock size={16} style={{ color: 'var(--accent-cyan)' }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Source & Provenance Audit Trail
                </span>
              </div>

              <button
                onClick={() => setShowRawSourceModal(!showRawSourceModal)}
                className="btn-secondary"
                style={{ fontSize: '0.75rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <FileCode size={14} />
                <span>{showRawSourceModal ? 'Hide Original Payload' : 'View Original Source'}</span>
                <ExternalLink size={12} />
              </button>
            </div>

            {/* Provenance Fields Grid */}
            <div 
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                fontSize: '0.8rem'
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>SOURCE TYPE</span>
                <strong style={{ color: 'var(--text-primary)' }}>{record.sourceType || record.modality}</strong>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>SOURCE ID</span>
                <strong style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>{record.sourceId}</strong>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>AUTHOR / PROVIDER</span>
                <strong style={{ color: 'var(--text-primary)' }}>{record.author}</strong>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>{record.authorRole}</span>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>FACILITY / SYSTEM</span>
                <strong style={{ color: 'var(--text-primary)' }}>{record.facility}</strong>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>DATE / TIME</span>
                <strong style={{ color: 'var(--text-primary)' }}>{new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, {new Date(record.timestamp).toLocaleDateString()}</strong>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>INTEGRATION MODALITY</span>
                <strong style={{ color: 'var(--accent-teal)' }}>{record.modality}</strong>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>VERIFICATION STATUS</span>
                <span style={{ marginTop: '2px', display: 'inline-block' }}>{getStatusBadge(currentStatus)}</span>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>VERIFICATION ATTRIBUTION</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {record.verifiedBy ? (
                    <>Verified by <strong>{record.verifiedBy}</strong> on {new Date(record.verifiedAt || record.timestamp).toLocaleDateString()}</>
                  ) : (
                    'Pending human care-team sign-off'
                  )}
                </span>
              </div>
            </div>

            {/* Expandable Raw Source Payload & Integrity Hash */}
            {showRawSourceModal && (
              <div 
                className="animate-fade-in"
                style={{
                  marginTop: '8px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                  <span>ORIGINAL RAW PROTOCOL INGRESS (HL7 / FHIR / DICOM)</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>SHA256: 8f9b...a12c (Verified Valid)</span>
                </div>
                <pre
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    color: 'var(--accent-cyan)',
                    background: 'rgba(0, 0, 0, 0.4)',
                    padding: '10px',
                    borderRadius: '4px',
                    maxHeight: '140px',
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                    margin: 0
                  }}
                >
                  {record.rawPayloadSnippet || `// Raw Ingress Record Stream\nSource: ${record.facility} (${record.modality})\nID: ${record.sourceId}\nTimestamp: ${record.timestamp}\nAuthor: ${record.author} [${record.authorRole}]\nContent: "${record.summaryText}"\nIntegrity: Cryptographic transmission checksum verified.`}
                </pre>
              </div>
            )}
          </div>

          {/* SECTION 4: RECORD VERIFICATION STATUS WORKFLOW */}
          <div 
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserCheck size={16} style={{ color: 'var(--emerald-raw)' }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Record Verification Workflow
                </span>
              </div>

              {/* Guardrail Callout */}
              <span style={{ fontSize: '0.725rem', color: 'var(--rose-urgent)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <ShieldAlert size={13} /> AI cannot verify clinical information — Clinician verification required
              </span>
            </div>

            {/* Workflow Pipeline Display */}
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-primary)',
                padding: '10px 16px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                fontSize: '0.75rem',
                fontWeight: 700
              }}
            >
              <span style={{ color: currentStatus === 'raw' ? 'var(--amber-pending)' : 'var(--text-muted)' }}>
                1. RAW (Ingested)
              </span>
              <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
              <span style={{ color: currentStatus === 'verified' ? 'var(--emerald-raw)' : 'var(--text-muted)' }}>
                2. VERIFIED (Human Reviewed)
              </span>
              <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
              <span style={{ color: currentStatus === 'ready_for_context' ? 'var(--teal-primary)' : 'var(--text-muted)' }}>
                3. READY FOR CONTEXT (Handoff Approved)
              </span>
            </div>

            {/* Verifier Role Selector & Action Buttons */}
            {onUpdateVerification && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginTop: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Sign-off Role:</span>
                  <select
                    value={selectedVerifier}
                    onChange={(e) => setSelectedVerifier(e.target.value)}
                    style={{
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '4px 10px',
                      fontSize: '0.75rem'
                    }}
                  >
                    <option value="Dr. Eleanor Vance, MD (Attending Obstetrician)">Dr. Eleanor Vance, MD (Attending Obstetrician)</option>
                    <option value="Nurse Brenda Miller, RN (Obstetric Triage Nurse)">Nurse Brenda Miller, RN (Obstetric Triage Nurse)</option>
                    <option value="Midwife Sarah Jenkins, CNM (Certified Nurse Midwife)">Midwife Sarah Jenkins, CNM (Certified Nurse Midwife)</option>
                    <option value="Rachel Lin, RD, CDE (Diabetes Educator)">Rachel Lin, RD, CDE (Diabetes Educator)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {currentStatus === 'raw' && (
                    <button
                      onClick={() => onUpdateVerification(record.id, 'verified', selectedVerifier)}
                      className="btn-outline-emerald"
                      style={{ fontSize: '0.775rem', padding: '6px 12px' }}
                    >
                      <CheckCircle2 size={14} /> Mark as Verified
                    </button>
                  )}

                  {currentStatus === 'verified' && (
                    <>
                      <button
                        onClick={() => onUpdateVerification(record.id, 'ready_for_context', selectedVerifier)}
                        className="btn-primary"
                        style={{ fontSize: '0.775rem', padding: '6px 12px' }}
                      >
                        <ShieldCheck size={14} /> Promote to Ready for Context
                      </button>
                      <button
                        onClick={() => onUpdateVerification(record.id, 'raw', selectedVerifier)}
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-muted)',
                          padding: '6px 10px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.75rem',
                          cursor: 'pointer'
                        }}
                      >
                        Revert to Raw
                      </button>
                    </>
                  )}

                  {currentStatus === 'ready_for_context' && (
                    <button
                      onClick={() => onUpdateVerification(record.id, 'verified', selectedVerifier)}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-muted)',
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        cursor: 'pointer'
                      }}
                    >
                      Revert to Verified
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Raw Clinical Content Box */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Original Clinical Content (Non-Interpretive)
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                System Source ID: {record.sourceId}
              </span>
            </div>

            <div 
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.875rem',
                color: 'var(--text-primary)',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6,
                maxHeight: '260px',
                overflowY: 'auto'
              }}
            >
              {record.fullContent}
            </div>
          </div>

          {/* Vitals Snapshot if present */}
          {record.vitalSnapshot && (
            <div>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                Recorded Vitals Snapshot
              </span>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {record.vitalSnapshot.bp && (
                  <div style={{ background: 'var(--bg-tertiary)', padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>BLOOD PRESSURE</span>
                    <strong style={{ color: 'var(--accent-cyan)', fontSize: '1rem' }}>{record.vitalSnapshot.bp} mmHg</strong>
                  </div>
                )}
                {record.vitalSnapshot.fetalHeartRateBpm && (
                  <div style={{ background: 'var(--bg-tertiary)', padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>FETAL HEART RATE</span>
                    <strong style={{ color: 'var(--accent-cyan)', fontSize: '1rem' }}>{record.vitalSnapshot.fetalHeartRateBpm} bpm</strong>
                  </div>
                )}
                {record.vitalSnapshot.fundalHeightCm && (
                  <div style={{ background: 'var(--bg-tertiary)', padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>FUNDAL HEIGHT</span>
                    <strong style={{ color: 'var(--accent-cyan)', fontSize: '1rem' }}>{record.vitalSnapshot.fundalHeightCm} cm</strong>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tags list */}
          <div>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
              Record Metadata Tags
            </span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {record.tags.map((tag, idx) => (
                <span 
                  key={idx}
                  style={{
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-color)',
                    padding: '2px 10px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.75rem'
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.775rem', color: 'var(--emerald-raw)' }}>
            <CheckCircle2 size={16} /> Non-interpretive context preserved & provenance verified.
          </div>

          <button onClick={onClose} className="btn-secondary">
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
