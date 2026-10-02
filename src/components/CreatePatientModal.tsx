import { useState } from 'react';
import { X, PlusCircle, AlertCircle } from 'lucide-react';
import { Field, inputStyle } from './auth/AuthField';

interface CreatePatientModalProps {
  onClose: () => void;
  onCreate: (payload: { patientName: string; age?: number; dob?: string; edd: string; mrn?: string }) => Promise<void>;
}

export const CreatePatientModal: React.FC<CreatePatientModalProps> = ({ onClose, onCreate }) => {
  const [patientName, setPatientName] = useState('');
  const [age, setAge] = useState('');
  const [dob, setDob] = useState('');
  const [edd, setEdd] = useState('');
  const [mrn, setMrn] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim()) { setError('Patient name is required.'); return; }
    if (!age.trim() && !dob.trim()) { setError('Enter either an age or a date of birth.'); return; }
    if (!edd.trim()) { setError('Estimated due date is required.'); return; }

    setError(null);
    setIsSubmitting(true);
    try {
      await onCreate({
        patientName: patientName.trim(),
        age: age.trim() ? Number(age) : undefined,
        dob: dob.trim() || undefined,
        edd: edd.trim(),
        mrn: mrn.trim() || undefined,
      });
    } catch {
      setError('Could not create the patient. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '440px', background: 'var(--bg-card)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>Create New Patient</strong>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--rose-urgent-bg)', color: 'var(--rose-urgent)', borderRadius: 'var(--radius-md)', padding: '9px 12px', fontSize: '0.8rem' }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} /> {error}
            </div>
          )}

          <Field label="Patient Name *">
            <input type="text" required value={patientName} onChange={(e) => setPatientName(e.target.value)} style={inputStyle} autoFocus />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Age">
              <input type="number" min={10} max={60} value={age} onChange={(e) => setAge(e.target.value)} style={inputStyle} placeholder="e.g. 28" />
            </Field>
            <Field label="Date of Birth">
              <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} style={inputStyle} />
            </Field>
          </div>

          <Field label="Estimated Due Date (EDD) *">
            <input type="date" required value={edd} onChange={(e) => setEdd(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="MRN / Patient ID (optional)">
            <input type="text" value={mrn} onChange={(e) => setMrn(e.target.value)} style={inputStyle} />
          </Field>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <button type="button" onClick={onClose} className="btn-secondary" style={{ fontSize: '0.85rem' }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary" style={{ fontSize: '0.85rem' }}>
              <PlusCircle size={15} /> {isSubmitting ? 'Creating…' : 'Create Patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
