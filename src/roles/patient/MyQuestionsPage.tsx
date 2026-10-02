import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { askMyQuestion, fetchMyQuestions } from '../../api/patientPortal';
import type { PatientQuestion } from '../../api/patientPortal';
import { ApiError } from '../../api/client';
import { StatusBadge } from '../../components/StatusBadge';
import type { BadgeTone } from '../../components/StatusBadge';
import { formatFriendlyDate, friendlyQuestionStatus } from './format';

const STATUS_TONE: Record<PatientQuestion['status'], BadgeTone> = {
  NEW: 'blue',
  ASSIGNED: 'blue',
  WAITING_FOR_RESPONSE: 'amber',
  ANSWERED: 'green',
  CLOSED: 'neutral',
};

export function MyQuestionsPage() {
  const [questions, setQuestions] = useState<PatientQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadQuestions = () => {
    setIsLoading(true);
    fetchMyQuestions()
      .then(setQuestions)
      .catch(() => setError("We couldn't load your questions. Please try again."))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { loadQuestions(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await askMyQuestion(text);
      setDraft('');
      loadQuestions();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Could not submit your question. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main style={{ padding: '24px', flex: 1, maxWidth: '760px', margin: '0 auto', width: '100%' }}>
      <h1 className="page-title" style={{ fontSize: '1.4rem', margin: '0 0 20px 0' }}>My Questions</h1>

      <div className="glass-panel" style={{ padding: '20px 22px', marginBottom: '20px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Question</label>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write your question…"
            rows={3}
            style={{
              background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)',
              padding: '10px 12px', color: 'var(--text-primary)', fontSize: '0.875rem', fontFamily: 'inherit', resize: 'vertical',
            }}
          />
          {submitError && <div style={{ fontSize: '0.8rem', color: 'var(--rose-urgent)' }}>{submitError}</div>}
          <div>
            <button type="submit" disabled={isSubmitting || !draft.trim()} className="btn-primary">
              {isSubmitting ? 'Submitting…' : 'Submit Question'}
            </button>
          </div>
        </form>
      </div>

      {isLoading && (
        <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading your questions…</div>
      )}

      {error && !isLoading && (
        <div className="glass-panel" style={{ padding: '24px', color: 'var(--rose-urgent)', textAlign: 'center' }}>{error}</div>
      )}

      {!isLoading && !error && questions.length === 0 && (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          You haven't asked any questions yet.
        </div>
      )}

      {!isLoading && !error && questions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {questions.map((q) => (
            <div key={q.id} className="glass-panel" style={{ padding: '18px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1, minWidth: 0 }}>
                  <MessageCircle size={18} style={{ color: 'var(--teal-primary)', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{q.questionText}</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>{formatFriendlyDate(q.createdAt)}</div>
                  </div>
                </div>
                <StatusBadge label={friendlyQuestionStatus(q.status)} tone={STATUS_TONE[q.status]} />
              </div>

              {q.responses.length > 0 && (
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {q.responses.map((r) => (
                    <div key={r.id} style={{ fontSize: '0.86rem', color: 'var(--text-primary)', background: 'var(--mint-soft)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
                      {r.responseText}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
