import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageCircle, Paperclip } from 'lucide-react';
import { askMyQuestion, fetchMyQuestions, myDocumentFileUrl } from '../../api/patientPortal';
import { MOST_ATTACHMENTS, MOST_ATTACHMENT_BYTES, attachToQuestion, fetchQuestionInfo } from '../../api/questions';
import { talkToAPerson } from '../../api/assistant';
import type { PatientQuestion } from '../../api/patientPortal';
import { ApiError, fetchBlobWithAuth } from '../../api/client';
import { StatusBadge } from '../../components/StatusBadge';
import type { BadgeTone } from '../../components/StatusBadge';
import { formatFriendlyDate, friendlyQuestionStatus } from './format';
import { useLanguage } from '../../i18n';

const STATUS_TONE: Record<PatientQuestion['status'], BadgeTone> = {
  NEW: 'blue',
  ASSIGNED: 'blue',
  WAITING_FOR_RESPONSE: 'amber',
  ANSWERED: 'green',
  CLOSED: 'neutral',
};

const textBox: React.CSSProperties = {
  background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)',
  padding: '10px 12px', color: 'var(--text-primary)', fontSize: '0.875rem', fontFamily: 'inherit', resize: 'vertical',
};
const labelStyle: React.CSSProperties = { fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' };
const linkButton: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--teal-primary)', textDecoration: 'underline', cursor: 'pointer',
};

export function MyQuestionsPage() {
  const { t } = useLanguage();
  const [params] = useSearchParams();
  const [questions, setQuestions] = useState<PatientQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Another page can send her here with the question already started (?draft=...): the words are the link's, not ours.
  const [draft, setDraft] = useState(() => params.get('draft') ?? '');
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [replyTime, setReplyTime] = useState('');
  const [followOpen, setFollowOpen] = useState<string | null>(null);
  const [followText, setFollowText] = useState('');
  const [followBusy, setFollowBusy] = useState(false);
  const [followError, setFollowError] = useState('');
  const [talkOpen, setTalkOpen] = useState(false);
  const [talkText, setTalkText] = useState('');
  const [talkBusy, setTalkBusy] = useState(false);
  const [talkError, setTalkError] = useState('');
  const [talkReply, setTalkReply] = useState('');
  const questionBox = useRef<HTMLTextAreaElement>(null);
  const fileBox = useRef<HTMLInputElement>(null);

  const handleTalk = async (e: React.FormEvent) => {
    e.preventDefault();
    setTalkBusy(true);
    setTalkError('');
    try {
      // The reply comes from the server in her saved language, in fixed wording.
      const sent = await talkToAPerson(talkText.trim());
      setTalkReply(sent.message);
      setTalkText('');
      setTalkOpen(false);
    } catch (err) {
      setTalkError(err instanceof ApiError ? err.message : t('Could not send your request. Please try again.'));
    } finally {
      setTalkBusy(false);
    }
  };

  const loadQuestions = () => {
    setIsLoading(true);
    fetchMyQuestions()
      .then(setQuestions)
      .catch(() => setError(t("We couldn't load your questions. Please try again.")))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { loadQuestions(); }, []);
  useEffect(() => { fetchQuestionInfo().then((info) => setReplyTime(info.replyTime)).catch(() => setReplyTime('')); }, []);
  useEffect(() => {
    // Sent here with a question already started: bring the box into view, with the cursor at the end.
    if (params.get('draft') && questionBox.current) {
      questionBox.current.scrollIntoView({ block: 'center' });
      questionBox.current.focus();
      questionBox.current.setSelectionRange(questionBox.current.value.length, questionBox.current.value.length);
    }
  }, []);

  const chooseFiles = (chosen: FileList | null) => {
    setFileError('');
    if (!chosen) return;
    const next = [...files];
    for (const file of Array.from(chosen)) {
      if (next.length >= MOST_ATTACHMENTS) { setFileError(t('You can attach up to {count} files.', { count: MOST_ATTACHMENTS })); break; }
      if (file.size > MOST_ATTACHMENT_BYTES) { setFileError(t('This file is larger than 10 MB: {name}', { name: file.name })); continue; }
      next.push(file);
    }
    setFiles(next);
    if (fileBox.current) fileBox.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setIsSubmitting(true);
    setSubmitError(null);
    setNotice('');
    try {
      const sent = await askMyQuestion(text);
      // The question is sent first; each file follows it, so a file that fails never loses the question.
      let failed = 0;
      for (const file of files) {
        try { await attachToQuestion(sent.id, file); } catch { failed += 1; }
      }
      setDraft('');
      setFiles([]);
      if (failed) setNotice(t('Your question was sent. Some of the files could not be attached.'));
      loadQuestions();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : t('Could not submit your question. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFollowUp = async (e: React.FormEvent, earlier: PatientQuestion) => {
    e.preventDefault();
    const text = followText.trim();
    if (!text) return;
    setFollowBusy(true);
    setFollowError('');
    try {
      await askMyQuestion(text, earlier.id);
      setFollowOpen(null);
      setFollowText('');
      setNotice(t('Your new question was sent to your doctor.'));
      loadQuestions();
    } catch (err) {
      setFollowError(err instanceof ApiError ? err.message : t('Could not submit your question. Please try again.'));
    } finally {
      setFollowBusy(false);
    }
  };

  const openAttachment = async (id: string) => {
    try {
      const blob = await fetchBlobWithAuth(myDocumentFileUrl(id));
      window.open(URL.createObjectURL(blob), '_blank');
    } catch {
      setNotice(t('The original file for this record is not available to view.'));
    }
  };

  return (
    <main style={{ padding: '24px', flex: 1, maxWidth: '760px', margin: '0 auto', width: '100%' }}>
      <h1 className="page-title" style={{ fontSize: '1.4rem', margin: '0 0 20px 0' }}>{t('My Questions')}</h1>

      <div className="glass-panel" style={{ padding: '20px 22px', marginBottom: '20px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label htmlFor="my-question" style={labelStyle}>{t('Question')}</label>
          <textarea
            id="my-question"
            ref={questionBox}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('Write your question…')}
            rows={3}
            style={textBox}
          />
          <label htmlFor="my-question-files" style={labelStyle}>{t('Attach a photo or report (optional)')}</label>
          <input
            id="my-question-files"
            ref={fileBox}
            type="file"
            multiple
            accept="image/*,.pdf,.jpg,.jpeg,.png"
            onChange={(e) => chooseFiles(e.target.files)}
            style={{ fontSize: '0.85rem' }}
          />
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
            {t('A photo or a PDF, up to {count} files and 10 MB each. Your doctor can open them.', { count: MOST_ATTACHMENTS })}
          </div>
          {files.length > 0 && (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`} style={{ fontSize: '0.84rem', display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <Paperclip size={14} aria-hidden="true" />
                  <span style={{ wordBreak: 'break-all' }}>{file.name}</span>
                  <button type="button" style={linkButton} aria-label={t('Remove {name}', { name: file.name })} onClick={() => setFiles(files.filter((_, i) => i !== index))}>{t('Remove')}</button>
                </li>
              ))}
            </ul>
          )}
          {fileError && <div role="alert" style={{ fontSize: '0.8rem', color: 'var(--rose-urgent)' }}>{fileError}</div>}
          {submitError && <div role="alert" style={{ fontSize: '0.8rem', color: 'var(--rose-urgent)' }}>{submitError}</div>}
          <div>
            <button type="submit" disabled={isSubmitting || !draft.trim()} className="btn-primary">
              {isSubmitting ? t('Submitting…') : t('Submit Question')}
            </button>
          </div>
          {replyTime && (
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
              {t('Your doctor’s clinic usually replies: {time}. If it is urgent, call 112 or your local emergency number.', { time: replyTime })}
            </p>
          )}
        </form>
      </div>

      {notice && <p role="status" className="continuity-success" style={{ marginBottom: '16px' }}>{notice}</p>}

      {/* Always works, and goes straight to a doctor: the care assistant is never in the way of reaching a person. */}
      <div className="glass-panel" style={{ padding: '20px 22px', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1rem', margin: '0 0 6px 0' }}>{t('Talk to a person')}</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 10px 0' }}>
          {t('Prefer to speak to someone? This asks your doctor’s clinic to get back to you. If it is urgent, call 112 or your local emergency number now.')}
        </p>
        {!talkOpen ? (
          <button type="button" className="btn-secondary" onClick={() => setTalkOpen(true)}>{t('Ask someone to get back to me')}</button>
        ) : (
          <form onSubmit={handleTalk} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label htmlFor="talk-message" style={labelStyle}>{t('Message (optional)')}</label>
            <textarea id="talk-message" value={talkText} onChange={(e) => setTalkText(e.target.value)} rows={2} maxLength={500} style={textBox} />
            {talkError && <div role="alert" style={{ fontSize: '0.8rem', color: 'var(--rose-urgent)' }}>{talkError}</div>}
            <div><button type="submit" disabled={talkBusy} className="btn-primary">{talkBusy ? t('Sending…') : t('Send')}</button></div>
          </form>
        )}
        {talkReply && <p role="status" className="continuity-success" style={{ marginTop: '10px' }}>{talkReply}</p>}
      </div>

      {isLoading && (
        <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>{t('Loading your questions…')}</div>
      )}

      {error && !isLoading && (
        <div className="glass-panel" style={{ padding: '24px', color: 'var(--rose-urgent)', textAlign: 'center' }}>{error}</div>
      )}

      {!isLoading && !error && questions.length === 0 && (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          {t("You haven't asked any questions yet.")}
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
                    {q.followUpOfText && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {t('About your earlier question: “{text}”', { text: q.followUpOfText })}
                      </div>
                    )}
                    {(q.attachments ?? []).length > 0 && (
                      <div style={{ fontSize: '0.8rem', marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
                        {(q.attachments ?? []).map((file) => (
                          <span key={file.id} style={{ display: 'inline-flex', gap: '5px', alignItems: 'center' }}>
                            <Paperclip size={13} aria-hidden="true" /> {t('Attached')}:{' '}
                            <button type="button" style={linkButton} onClick={() => void openAttachment(file.id)}>{file.filename}</button>
                          </span>
                        ))}
                      </div>
                    )}
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

              {q.status === 'ANSWERED' && (
                <div style={{ marginTop: '12px' }}>
                  {followOpen !== q.id ? (
                    <button type="button" className="btn-secondary" onClick={() => { setFollowOpen(q.id); setFollowText(''); setFollowError(''); }}>
                      {t('I still have a question')}
                    </button>
                  ) : (
                    <form onSubmit={(e) => void handleFollowUp(e, q)} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label htmlFor={`follow-${q.id}`} style={labelStyle}>{t('Your question about this answer')}</label>
                      <textarea id={`follow-${q.id}`} autoFocus value={followText} onChange={(e) => setFollowText(e.target.value)} rows={3} style={textBox} />
                      {followError && <div role="alert" style={{ fontSize: '0.8rem', color: 'var(--rose-urgent)' }}>{followError}</div>}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button type="submit" className="btn-primary" disabled={followBusy || !followText.trim()}>{followBusy ? t('Submitting…') : t('Send my question')}</button>
                        <button type="button" className="btn-secondary" onClick={() => setFollowOpen(null)}>{t('Cancel')}</button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
