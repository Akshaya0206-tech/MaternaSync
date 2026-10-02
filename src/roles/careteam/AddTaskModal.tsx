import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { createTask, fetchPatients } from '../../api/careTeamPortal';
import type { CareTeamPatientRow } from '../../api/careTeamPortal';
import { ApiError } from '../../api/client';
import { inputStyle, Field } from '../../components/auth/AuthField';

interface Props {
  episodeId?: string;
  onClose: () => void;
  onCreated: () => void;
}

export function AddTaskModal({ episodeId, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('routine');
  const [selectedEpisodeId, setSelectedEpisodeId] = useState(episodeId ?? '');
  const [patients, setPatients] = useState<CareTeamPatientRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!episodeId) fetchPatients().then(setPatients).catch(() => {});
  }, [episodeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !selectedEpisodeId) return;
    setIsSaving(true);
    setError(null);
    try {
      await createTask({ episodeId: selectedEpisodeId, title: title.trim(), description, dueDate, priority });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create this task.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '440px', background: 'var(--bg-card)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <strong style={{ fontSize: '1.02rem', color: 'var(--text-primary)' }}>Add Task</strong>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {!episodeId && (
            <Field label="Patient">
              <select value={selectedEpisodeId} onChange={(e) => setSelectedEpisodeId(e.target.value)} required style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="" disabled>Select a patient…</option>
                {patients.map((p) => <option key={p.episodeId} value={p.episodeId}>{p.patientName}</option>)}
              </select>
            </Field>
          )}
          <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} required style={inputStyle} /></Field>
          <Field label="Description"><input value={description} onChange={(e) => setDescription(e.target.value)} style={inputStyle} /></Field>
          <Field label="Due Date"><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} /></Field>
          <Field label="Priority">
            <select value={priority} onChange={(e) => setPriority(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="routine">Routine</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </Field>
          {error && <div style={{ fontSize: '0.8rem', color: 'var(--rose-urgent)' }}>{error}</div>}
          <button type="submit" disabled={isSaving || !title.trim() || !selectedEpisodeId} className="btn-primary" style={{ width: '100%', padding: '11px' }}>
            {isSaving ? 'Creating…' : 'Create Task'}
          </button>
        </form>
      </div>
    </div>
  );
}
