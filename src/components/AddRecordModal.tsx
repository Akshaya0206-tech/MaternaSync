import { useState } from 'react';
import type { RecordCategory } from '../types/patient';
import { createManualRecord } from '../api/patients';
import { X, FilePlus, AlertCircle } from 'lucide-react';
import { Field, inputStyle } from './auth/AuthField';

interface AddRecordModalProps {
  patientId: string;
  onClose: () => void;
  onCreated: () => void;
}

const CATEGORY_OPTIONS: { value: RecordCategory; label: string }[] = [
  { value: 'consultation_note', label: 'Consultation' },
  { value: 'care_document', label: 'Lab / Investigation / Scan' },
  { value: 'referral', label: 'Referral' },
  { value: 'patient_message', label: 'Patient Message' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'workflow_event', label: 'Workflow Event' },
];

export const AddRecordModal: React.FC<AddRecordModalProps> = ({ patientId, onClose, onCreated }) => {
  const [category, setCategory] = useState<RecordCategory>('consultation_note');
  const [date, setDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [facility, setFacility] = useState('');
  const [doctor, setDoctor] = useState('');
  const [sourceReference, setSourceReference] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await createManualRecord(patientId, {
        category,
        timestamp: date,
        facility: facility.trim() || 'Not documented',
        author: doctor.trim() || 'Not documented',
        summaryText: notes.trim(),
        sourceReference: sourceReference.trim(),
      });
      onCreated();
    } catch {
      setError('Could not save this record. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '460px', background: 'var(--bg-card)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>Enter Record Manually</strong>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
            Use this only when an existing document isn't available to upload. Prefer "Upload Medical Record" whenever possible.
          </p>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--rose-urgent-bg)', color: 'var(--rose-urgent)', borderRadius: 'var(--radius-md)', padding: '9px 12px', fontSize: '0.8rem' }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} /> {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Record Type">
              <select value={category} onChange={(e) => setCategory(e.target.value as RecordCategory)} style={{ ...inputStyle, cursor: 'pointer' }}>
                {CATEGORY_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </Field>
            <Field label="Date">
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
            </Field>
          </div>

          <Field label="Facility">
            <input type="text" value={facility} onChange={(e) => setFacility(e.target.value)} placeholder="e.g. St. Jude Women's Health Clinic" style={inputStyle} />
          </Field>

          <Field label="Responsible Doctor">
            <input type="text" value={doctor} onChange={(e) => setDoctor(e.target.value)} placeholder="e.g. Dr. Eleanor Vance" style={inputStyle} />
          </Field>

          <Field label="Source / Reference">
            <input type="text" value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} placeholder="e.g. verbal handoff, phone call" style={inputStyle} />
          </Field>

          <Field label="Notes">
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
          </Field>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <button type="button" onClick={onClose} className="btn-secondary" style={{ fontSize: '0.85rem' }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary" style={{ fontSize: '0.85rem' }}>
              <FilePlus size={15} /> {isSubmitting ? 'Saving…' : 'Add Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
