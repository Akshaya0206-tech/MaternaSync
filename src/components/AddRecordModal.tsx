import { useState } from 'react';
import type { PatientRecord, RecordCategory } from '../types/patient';
import { X, PlusCircle } from 'lucide-react';

interface AddRecordModalProps {
  patientId: string;
  gestationalAgeWeeks: number;
  gestationalAgeDays: number;
  onClose: () => void;
  onAddRecord: (newRecord: PatientRecord) => void;
}

export const AddRecordModal: React.FC<AddRecordModalProps> = ({
  patientId,
  gestationalAgeWeeks,
  gestationalAgeDays,
  onClose,
  onAddRecord
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<RecordCategory>('consultation_note');
  const [author, setAuthor] = useState('Dr. Eleanor Vance, MD');
  const authorRole = 'Attending Obstetrician';
  const [facility, setFacility] = useState('St. Jude Women\'s Health Pavilion');
  const [modality, setModality] = useState('EHR Progress Note');
  const [summaryText, setSummaryText] = useState('');
  const [fullContent, setFullContent] = useState('');
  const [tagInput, setTagInput] = useState('Progress Visit, Routine');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !summaryText.trim()) return;

    const newRec: PatientRecord = {
      id: `REC-${Date.now()}`,
      patientId,
      title,
      category,
      timestamp: new Date().toISOString(),
      gestationalAgeWeeks,
      gestationalAgeDays,
      trimester: gestationalAgeWeeks <= 12 ? 1 : gestationalAgeWeeks <= 27 ? 2 : 3,
      author,
      authorRole,
      facility,
      modality,
      summaryText,
      fullContent: fullContent || summaryText,
      sourceId: `EHR-IMP-${Math.floor(1000 + Math.random() * 9000)}`,
      tags: tagInput.split(',').map(t => t.trim()).filter(Boolean),
      isAiStructuredOnly: false
    };

    onAddRecord(newRec);
    onClose();
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
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'var(--bg-secondary)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <PlusCircle size={20} style={{ color: 'var(--accent-cyan)' }} />
            <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>
              Collect & Import New Patient Record
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              RECORD TITLE *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 32-Week Growth Ultrasound Scan Report"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 12px',
                color: 'var(--text-primary)',
                fontSize: '0.85rem'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                RECORD CATEGORY
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as RecordCategory)}
                style={{
                  width: '100%',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem'
                }}
              >
                <option value="consultation_note">Consultation Note</option>
                <option value="care_document">Care Document / Lab Report</option>
                <option value="referral">Referral Order</option>
                <option value="patient_message">Patient Message</option>
                <option value="follow_up">Follow-up Log</option>
                <option value="workflow_event">Workflow Event</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                AUTHOR / CLINICIAN
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                FACILITY LOCATION
              </label>
              <input
                type="text"
                value={facility}
                onChange={(e) => setFacility(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                INTEGRATION MODALITY
              </label>
              <input
                type="text"
                value={modality}
                onChange={(e) => setModality(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              RAW SUMMARY TEXT *
            </label>
            <textarea
              required
              rows={3}
              placeholder="Factual uninterpreted summary of record..."
              value={summaryText}
              onChange={(e) => setSummaryText(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 12px',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                resize: 'vertical'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              FULL RECORD TEXT (OPTIONAL)
            </label>
            <textarea
              rows={4}
              placeholder="Full raw text of clinical note or lab PDF content..."
              value={fullContent}
              onChange={(e) => setFullContent(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 12px',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                resize: 'vertical'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              TAGS (COMMA SEPARATED)
            </label>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 12px',
                color: 'var(--text-primary)',
                fontSize: '0.85rem'
              }}
            />
          </div>

          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', display: 'flex', justifyContent: 'flex-end', gap: '12px', margin: '10px -24px -24px -24px' }}>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Add to Episode Timeline</button>
          </div>
        </form>
      </div>
    </div>
  );
};
