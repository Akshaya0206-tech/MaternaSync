import { useState } from 'react';
import { X } from 'lucide-react';
import { logQuestionOnBehalfOfPatient } from '../../api/careTeamPortal';
import { ApiError } from '../../api/client';

interface Props {
  episodeId: string;
  onClose: () => void;
  onCreated: () => void;
}

export function AddQuestionModal({ episodeId, onClose, onCreated }: Props) {
  const [text, setText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      await logQuestionOnBehalfOfPatient(episodeId, text.trim());
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not log this question.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '440px', background: 'var(--bg-card)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <strong style={{ fontSize: '1.02rem', color: 'var(--text-primary)' }}>Add Question</strong>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
            Log a question the patient asked outside the portal (phone call, in person).
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What did the patient ask?"
            rows={3}
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '0.875rem', fontFamily: 'inherit', resize: 'vertical' }}
          />
          {error && <div style={{ fontSize: '0.8rem', color: 'var(--rose-urgent)' }}>{error}</div>}
          <button type="submit" disabled={isSaving || !text.trim()} className="btn-primary" style={{ width: '100%', padding: '11px' }}>
            {isSaving ? 'Saving…' : 'Log Question'}
          </button>
        </form>
      </div>
    </div>
  );
}
