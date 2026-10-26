import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Paperclip, Send } from 'lucide-react';
import { fetchQuestions, draftQuestionResponse, approveQuestionResponse } from '../../api/doctorPortal';
import type { CareTeamQuestion } from '../../api/doctorPortal';
import { ApiError, fetchBlobWithAuth } from '../../api/client';
import { StatusBadge } from '../../components/StatusBadge';
import { tx, useLanguage } from '../../i18n';
import { QUESTION_STATUS_TONE, friendlyQuestionStatus, formatFriendlyDate } from './format';

export function QuestionsPage() {
  const { t } = useLanguage();
  const [questions, setQuestions] = useState<CareTeamQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  // A file the patient attached to the question opens like any document of her record (the doctor must be assigned to her).
  const openFile = async (documentId: string) => {
    setFileError(null);
    try {
      const blob = await fetchBlobWithAuth(`/api/v2/doctor/documents/${documentId}/file`);
      window.open(URL.createObjectURL(blob), '_blank');
    } catch {
      setFileError(tx('The file could not be opened.'));
    }
  };

  const load = () => {
    setIsLoading(true);
    fetchQuestions()
      .then(setQuestions)
      .catch(() => setError(tx("We couldn't load your questions. Please try again.")))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggle = (q: CareTeamQuestion) => {
    setExpandedId((prev) => (prev === q.id ? null : q.id));
    setDraftText('');
    setActionError(null);
  };

  const handleSaveDraft = async (id: string) => {
    if (!draftText.trim()) return;
    setIsSaving(true);
    setActionError(null);
    try {
      const updated = await draftQuestionResponse(id, draftText.trim());
      setQuestions((prev) => prev.map((q) => (q.id === id ? updated : q)));
      setDraftText('');
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : tx('Could not save the draft response.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleApproveAndSend = async (id: string) => {
    setIsSaving(true);
    setActionError(null);
    try {
      const updated = await approveQuestionResponse(id);
      setQuestions((prev) => prev.map((q) => (q.id === id ? updated : q)));
      setExpandedId(null);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : tx('Could not approve and send this response.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main style={{ padding: '24px', flex: 1, maxWidth: '900px', margin: '0 auto', width: '100%' }}>
      <h1 className="page-title" style={{ fontSize: '1.4rem', margin: '0 0 18px 0' }}>{t('Patient Questions')}</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', margin: '0 0 18px 0' }}>{t('Questions your patients and their caregivers have sent to you.')}</p>

      {isLoading && <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>{t('Loading…')}</div>}
      {error && !isLoading && <div className="glass-panel" style={{ padding: '24px', color: 'var(--rose-urgent)', textAlign: 'center' }}>{t(error)}</div>}
      {!isLoading && !error && questions.length === 0 && (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>{t('No clinical questions assigned to you right now.')}</div>
      )}

      {!isLoading && !error && questions.length > 0 && (
        <div className="glass-panel" style={{ padding: '4px 0' }}>
          {questions.map((q, i) => {
            const isOpen = expandedId === q.id;
            const isAnswered = q.status === 'ANSWERED' || q.status === 'CLOSED';
            return (
              <div key={q.id} style={{ borderBottom: i === questions.length - 1 ? 'none' : '1px solid var(--border-color)' }}>
                <button
                  onClick={() => toggle(q)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                      {q.patientName} · {formatFriendlyDate(q.createdAt)}
                      {q.followUpOfText && <> · {t('Follow-up')}</>}
                      {(q.attachments ?? []).length > 0 && <> · {t('Files attached: {count}', { count: (q.attachments ?? []).length })}</>}
                    </div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{q.questionText}</div>
                  </div>
                  <StatusBadge label={friendlyQuestionStatus(q.status)} tone={QUESTION_STATUS_TONE[q.status]} />
                  {isOpen ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
                </button>

                {isOpen && (
                  <div style={{ padding: '0 20px 20px 20px' }}>
                    {q.followUpOfText && (
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 10px 0' }}>
                        <strong>{t('Follow-up to an earlier question:')}</strong> “{q.followUpOfText}”
                      </p>
                    )}
                    {(q.attachments ?? []).length > 0 && (
                      <div style={{ margin: '0 0 12px 0', fontSize: '0.82rem' }}>
                        <strong>{t('Files the patient attached:')}</strong>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                          {(q.attachments ?? []).map((file) => (
                            <button key={file.id} type="button" className="btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => void openFile(file.id)}>
                              <Paperclip size={13} aria-hidden="true" /> {file.filename}
                            </button>
                          ))}
                        </div>
                        {fileError && <div role="alert" style={{ color: 'var(--rose-urgent)', marginTop: '6px' }}>{t(fileError)}</div>}
                      </div>
                    )}
                    {isAnswered && q.responses.length > 0 && (
                      <div style={{ marginBottom: '12px', fontSize: '0.85rem', color: 'var(--text-primary)', background: 'var(--mint-soft)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
                        {q.responses[0].responseText}
                      </div>
                    )}
                    {!isAnswered && (
                      <>
                        {actionError && <div style={{ fontSize: '0.8rem', color: 'var(--rose-urgent)', marginBottom: '10px' }}>{t(actionError)}</div>}
                        <textarea
                          value={draftText}
                          onChange={(e) => setDraftText(e.target.value)}
                          placeholder={t('Draft your clinical response…')}
                          rows={3}
                          style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '0.85rem', fontFamily: 'inherit', resize: 'vertical', marginBottom: '10px' }}
                        />
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button onClick={() => handleSaveDraft(q.id)} disabled={isSaving || !draftText.trim()} className="btn-secondary" style={{ fontSize: '0.8rem' }}>{t('Draft Response')}</button>
                          <button onClick={() => handleApproveAndSend(q.id)} disabled={isSaving} className="btn-primary" style={{ fontSize: '0.8rem' }}><Send size={13} /> {t('Approve & Send')}</button>
                        </div>
                        <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                          {t('Draft, then approve — the patient only sees the response after you approve it.')}
                        </p>
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
