import type { PatientRecord } from '../types/patient';
import { 
  X, 
  ShieldCheck, 
  CheckCircle2
} from 'lucide-react';

interface RecordDetailModalProps {
  record: PatientRecord | null;
  onClose: () => void;
}

export const RecordDetailModal: React.FC<RecordDetailModalProps> = ({
  record,
  onClose
}) => {
  if (!record) return null;

  const formattedDate = new Date(record.timestamp).toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'short'
  });

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
          maxWidth: '780px',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="badge-raw">
              <ShieldCheck size={14} /> APPROVED RAW MEDICAL RECORD
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: 700 }}>
              Wk {record.gestationalAgeWeeks} + {record.gestationalAgeDays}d
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
          {/* Title & Metadata Grid */}
          <div>
            <h2 style={{ fontSize: '1.35rem', color: 'var(--text-primary)', margin: '0 0 12px 0', fontWeight: 700 }}>
              {record.title}
            </h2>

            <div 
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '12px',
                background: 'var(--bg-tertiary)',
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                fontSize: '0.825rem'
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>FACILITY & SOURCE</span>
                <strong style={{ color: 'var(--text-primary)' }}>{record.facility}</strong>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>AUTHOR / PROVIDER</span>
                <strong style={{ color: 'var(--text-primary)' }}>{record.author}</strong> ({record.authorRole})
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>INTEGRATION MODALITY</span>
                <strong style={{ color: 'var(--accent-cyan)' }}>{record.modality}</strong>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>RECORD TIMESTAMP</span>
                <strong style={{ color: 'var(--text-primary)' }}>{formattedDate}</strong>
              </div>
            </div>
          </div>

          {/* Raw Record Content Box */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Full Original Record Text (Uninterpreted)
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
                maxHeight: '320px',
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
            <CheckCircle2 size={16} /> Non-interpretive context verified & audit ready.
          </div>

          <button onClick={onClose} className="btn-secondary">
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
