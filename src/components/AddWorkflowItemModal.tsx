import { useState } from 'react';
import type { WorkflowItemType, WorkflowPriority } from '../types/patient';
import { createWorkflowItem } from '../api/patients';
import { X, PlusCircle, AlertCircle } from 'lucide-react';

interface AddWorkflowItemModalProps {
  patientId: string;
  onClose: () => void;
  onCreated: () => void;
}

export const AddWorkflowItemModal: React.FC<AddWorkflowItemModalProps> = ({
  patientId,
  onClose,
  onCreated
}) => {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<WorkflowItemType>('pending_referral');
  const [priority, setPriority] = useState<WorkflowPriority>('important');
  const [description, setDescription] = useState('');
  const [sourceContext, setSourceContext] = useState('Clinician Observation during Context Review');
  const [assignee, setAssignee] = useState('Duty Nurse / Referral Coordinator');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setError(null);
    setIsSubmitting(true);
    try {
      await createWorkflowItem(patientId, {
        type,
        title: title.trim(),
        description: description.trim(),
        priority,
        assignee: assignee.trim() || 'Unassigned',
        sourceContext,
        dueDate: dueDate || undefined,
      });
      onCreated();
    } catch {
      setError('Could not save this workflow item. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
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
          maxWidth: '620px',
          background: 'var(--bg-card)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <PlusCircle size={20} style={{ color: 'var(--amber-pending)' }} />
            <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>
              Flag Documented Workflow Item
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--rose-urgent-bg)', color: 'var(--rose-urgent)', borderRadius: 'var(--radius-md)', padding: '9px 12px', fontSize: '0.8rem' }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} /> {error}
            </div>
          )}

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              WORKFLOW ITEM TITLE *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Schedule High-Risk MFM Ultrasound Consult"
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
                ITEM CATEGORY
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as WorkflowItemType)}
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
                <option value="pending_referral">Pending Referral</option>
                <option value="required_document">Required / Missing Document</option>
                <option value="follow_up_needed">Follow-up Needed</option>
                <option value="unanswered_question">Unanswered Patient Question</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                PRIORITY LEVEL
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as WorkflowPriority)}
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
                <option value="urgent">Urgent</option>
                <option value="important">Important</option>
                <option value="routine">Routine</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              DESCRIPTION & CLINICAL WORKFLOW DETAILS *
            </label>
            <textarea
              required
              rows={3}
              placeholder="Describe the workflow requirement, missing lab result, or question..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
              SOURCE CONTEXT CITATION
            </label>
            <input
              type="text"
              value={sourceContext}
              onChange={(e) => setSourceContext(e.target.value)}
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
                ASSIGN OWNER
              </label>
              <input
                type="text"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="e.g. Referral Coordinator"
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
                DUE DATE (OPTIONAL)
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
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

          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', display: 'flex', justifyContent: 'flex-end', gap: '12px', margin: '10px -24px -24px -24px' }}>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'Saving…' : 'Add Workflow Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
