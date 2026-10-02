import { useState } from 'react';
import { X } from 'lucide-react';
import { createReferral } from '../../api/doctorPortal';
import { ApiError } from '../../api/client';
import { inputStyle, Field } from '../../components/auth/AuthField';

interface Props {
  episodeId: string;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateReferralModal({ episodeId, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [referredTo, setReferredTo] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      await createReferral(episodeId, { title: title.trim(), description, destination, referredTo });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create this referral.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '440px', background: 'var(--bg-card)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <strong style={{ fontSize: '1.02rem', color: 'var(--text-primary)' }}>Create Referral</strong>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Field label="Referral Type / Reason"><input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Maternal-Fetal Medicine Consultation" style={inputStyle} /></Field>
          <Field label="Destination"><input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="e.g. ABC Specialist Hospital" style={inputStyle} /></Field>
          <Field label="Referred To (department/provider)"><input value={referredTo} onChange={(e) => setReferredTo(e.target.value)} placeholder="e.g. MFM" style={inputStyle} /></Field>
          <Field label="Clinical Reason / Context">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Documented reason for this referral…" style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
          </Field>
          {error && <div style={{ fontSize: '0.8rem', color: 'var(--rose-urgent)' }}>{error}</div>}
          <button type="submit" disabled={isSaving || !title.trim()} className="btn-primary" style={{ width: '100%', padding: '11px' }}>
            {isSaving ? 'Creating…' : 'Create Referral'}
          </button>
        </form>
      </div>
    </div>
  );
}
