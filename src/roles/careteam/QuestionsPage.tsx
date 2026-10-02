import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Stethoscope, XCircle } from 'lucide-react';
import { fetchQuestions, respondToQuestion, assignQuestionToDoctor, closeQuestion } from '../../api/careTeamPortal';
import type { CareTeamQuestion } from '../../api/careTeamPortal';
import { ApiError } from '../../api/client';
import { StatusBadge } from '../../components/StatusBadge';
import { QUESTION_STATUS_TONE, friendlyQuestionStatus, formatFriendlyDate } from './format';

export function QuestionsPage() {
  const [questions, setQuestions] = useState<CareTeamQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [isActing, setIsActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = () => {
    setIsLoading(true);
    fetchQuestions()
      .then(setQuestions)
      .catch(() => setError("We couldn't load patient questions. Please try again."))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
    setDraft('');
    setActionError(null);
  };

  const handleRespond = async (id: string) => {
    if (!draft.trim()) return;
    setIsActing(true);
    setActionError(null);
    try {
      await respondToQuestion(id, draft.trim());
      setDraft('');
      setExpandedId(null);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not send this response.');
    } finally {
      setIsActing(false);
    }
  };

  const handleAssign = async (id: string) => {
    setIsActing(true);
    setActionError(null);
    try {
      await assignQuestionToDoctor(id);
      setExpandedId(null);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not assign this question.');
    } finally {
      setIsActing(false);
    }
  };

  const handleClose = async (id: string) => {
    setIsActing(true);
    setActionError(null);
    try {
      await closeQuestion(id);
      setExpandedId(null);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not close this question.');
    } finally {
      setIsActing(false);
    }
  };

  return (
    <main style={{ padding: '24px', flex: 1, maxWidth: '900px', margin: '0 auto', width: '100%' }}>
      <h1 className="page-title" style={{ fontSize: '1.4rem', margin: '0 0 18px 0' }}>Patient Questions</h1>

      {isLoading && <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>}
      {error && !isLoading && <div className="glass-panel" style={{ padding: '24px', color: 'var(--rose-urgent)', textAlign: 'center' }}>{error}</div>}
      {!isLoading && !error && questions.length === 0 && (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>No patient questions right now.</div>
      )}

      {!isLoading && !error && questions.length > 0 && (
        <div className="glass-panel" style={{ padding: '4px 0' }}>
          {questions.map((q, i) => {
            const isOpen = expandedId === q.id;
            const isResolved = q.status === 'ANSWERED' || q.status === 'CLOSED';
            return (
              <div key={q.id} style={{ borderBottom: i === questions.length - 1 ? 'none' : '1px solid var(--border-color)' }}>
                <button
                  onClick={() => toggle(q.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>{q.patientName} · {formatFriendlyDate(q.createdAt)}</div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{q.questionText}</div>
                    {q.assignedToName && <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>Assigned to {q.assignedToName}</div>}
                  </div>
                  <StatusBadge label={friendlyQuestionStatus(q.status)} tone={QUESTION_STATUS_TONE[q.status]} />
                  {isOpen ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
                </button>

                {isOpen && (
                  <div style={{ padding: '0 20px 20px 20px' }}>
                    {q.responses.length > 0 && (
                      <div style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {q.responses.map((r) => (
                          <div key={r.id} style={{ fontSize: '0.85rem', color: 'var(--text-primary)', background: 'var(--mint-soft)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
                            {r.responseText}
                          </div>
                        ))}
                      </div>
                    )}
                    {actionError && <div style={{ fontSize: '0.8rem', color: 'var(--rose-urgent)', marginBottom: '10px' }}>{actionError}</div>}
                    {!isResolved && (
                      <>
                        <textarea
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          placeholder="Respond to this coordination question…"
                          rows={2}
                          style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '0.85rem', fontFamily: 'inherit', resize: 'vertical', marginBottom: '10px' }}
                        />
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button onClick={() => handleRespond(q.id)} disabled={isActing || !draft.trim()} className="btn-primary" style={{ fontSize: '0.8rem' }}>Respond</button>
                          <button onClick={() => handleAssign(q.id)} disabled={isActing} className="btn-secondary" style={{ fontSize: '0.8rem' }}><Stethoscope size={13} /> Assign to Doctor</button>
                          <button onClick={() => handleClose(q.id)} disabled={isActing} className="btn-secondary" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}><XCircle size={13} /> Close</button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
