import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronUp, Paperclip, PhoneCall, Search, Send } from 'lucide-react';
import { fetchQuestions, draftQuestionResponse, approveQuestionResponse } from '../../api/doctorPortal';
import type { CareTeamQuestion } from '../../api/doctorPortal';
import { closeQuestionHandled, fetchReplySnippets } from '../../api/doctorConsultQ';
import type { ReplySnippet } from '../../api/doctorConsultQ';
import { ApiError, fetchBlobWithAuth } from '../../api/client';
import { StatusBadge } from '../../components/StatusBadge';
import { tx, useLanguage } from '../../i18n';
import { QUESTION_STATUS_TONE, friendlyQuestionStatus, formatFriendlyDate } from './format';
import { SavedReplies } from './SavedReplies';

type Filter = 'needs' | 'answered' | 'all';

// Not answered and not closed: it is waiting for the doctor.
const needsReply = (q: CareTeamQuestion) => q.status !== 'ANSWERED' && q.status !== 'CLOSED';
const asked = (q: CareTeamQuestion) => new Date(q.createdAt).getTime();
const oldestFirst = (a: CareTeamQuestion, b: CareTeamQuestion) => asked(a) - asked(b);
const newestFirst = (a: CareTeamQuestion, b: CareTeamQuestion) => asked(b) - asked(a);

/** How long a question has been waiting, from when it was asked. Time only: nothing about what it says. */
function waitingText(createdAt: string, now: number, t: (text: string, values?: Record<string, string | number>) => string): string {
  const hours = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 3_600_000));
  const days = Math.floor(hours / 24);
  if (days >= 1) return days === 1 ? t('waiting 1 day') : t('waiting {count} days', { count: days });
  if (hours >= 1) return hours === 1 ? t('waiting 1 hour') : t('waiting {count} hours', { count: hours });
  return t('waiting less than an hour');
}

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
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('needs');
  const [patientFilter, setPatientFilter] = useState('');
  const [search, setSearch] = useState('');
  const [snippets, setSnippets] = useState<ReplySnippet[]>([]);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closeNote, setCloseNote] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [searchParams] = useSearchParams();
  const wanted = searchParams.get('question');
  const replyBox = useRef<HTMLTextAreaElement>(null);
  const closeBox = useRef<HTMLTextAreaElement>(null);

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
      .then((rows) => { setQuestions(rows); setNow(Date.now()); })
      .catch(() => setError(tx("We couldn't load your questions. Please try again.")))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { load(); }, []);
  // Coming from the search box (?question=<id>): show every question, open that one and scroll to it.
  useEffect(() => {
    if (!wanted || isLoading) return;
    if (!questions.some((q) => q.id === wanted)) { setNotice(t('That question is not on your list.')); return; }
    setFilter('all');
    setPatientFilter('');
    setSearch('');
    setExpandedId(wanted);
    const timer = window.setTimeout(() => {
      const row = document.getElementById(`question-${wanted}`);
      row?.scrollIntoView({ block: 'center' });
      row?.querySelector('button')?.focus();
    }, 60);
    return () => window.clearTimeout(timer);
  }, [wanted, isLoading, questions.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { fetchReplySnippets().then(setSnippets).catch(() => setSnippets([])); }, []);
  useEffect(() => { if (closingId) closeBox.current?.focus(); }, [closingId]);

  const toggle = (q: CareTeamQuestion) => {
    setExpandedId((prev) => (prev === q.id ? null : q.id));
    setDraftText('');
    setActionError(null);
    setClosingId(null);
    setCloseNote('');
  };

  const replace = (updated: CareTeamQuestion) => setQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));

  const handleSaveDraft = async (id: string) => {
    if (!draftText.trim()) return;
    setIsSaving(true);
    setActionError(null);
    try {
      replace(await draftQuestionResponse(id, draftText.trim()));
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
      replace(await approveQuestionResponse(id));
      setExpandedId(null);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : tx('Could not approve and send this response.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseHandled = async (q: CareTeamQuestion) => {
    setIsSaving(true);
    setActionError(null);
    try {
      replace(await closeQuestionHandled(q.id, closeNote.trim()));
      setNotice(t('Question closed. {name} has been told that you handled it by phone or at the clinic.', { name: q.patientName }));
      setExpandedId(null);
      setClosingId(null);
      setCloseNote('');
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : tx('Could not close this question.'));
    } finally {
      setIsSaving(false);
    }
  };

  const insertSaved = (text: string) => {
    setDraftText((previous) => (previous.trim() ? `${previous.replace(/\s+$/, '')}\n\n${text}` : text));
    replyBox.current?.focus();
  };

  // The patient and search narrow the list first; the chips then say how many of those are waiting, answered, or all.
  const patients = useMemo(() => [...new Map(questions.map((q) => [q.episodeId, q.patientName] as const)).entries()].sort((a, b) => a[1].localeCompare(b[1])), [questions]);
  const needle = search.trim().toLowerCase();
  const narrowed = questions.filter((q) => (!patientFilter || q.episodeId === patientFilter) && (!needle || `${q.questionText} ${q.patientName}`.toLowerCase().includes(needle)));
  const waiting = narrowed.filter(needsReply).sort(oldestFirst);
  const done = narrowed.filter((q) => !needsReply(q)).sort(newestFirst);
  const shown = filter === 'needs' ? waiting : filter === 'answered' ? done : [...waiting, ...done];
  const filtered = Boolean(patientFilter || needle);
  const clearFilters = () => { setPatientFilter(''); setSearch(''); };

  return (
    <main style={{ padding: '24px', flex: 1, maxWidth: '900px', margin: '0 auto', width: '100%' }}>
      <h1 className="page-title" style={{ fontSize: '1.4rem', margin: '0 0 18px 0' }}>{t('Patient Questions')}</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', margin: '0 0 18px 0' }}>{t('Questions your patients and their caregivers have sent to you.')}</p>

      {notice && <div role="status" className="continuity-success" style={{ marginBottom: '14px' }}>{notice}</div>}
      {isLoading && <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>{t('Loading…')}</div>}
      {error && !isLoading && <div className="glass-panel" style={{ padding: '24px', color: 'var(--rose-urgent)', textAlign: 'center' }}>{t(error)}</div>}
      {!isLoading && !error && questions.length === 0 && (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>{t('No clinical questions assigned to you right now.')}</div>
      )}

      {!isLoading && !error && questions.length > 0 && (
        <>
          <div className="question-filters">
            <div className="question-search">
              <Search size={15} aria-hidden="true" />
              <input type="search" aria-label={t('Search the questions')} placeholder={t('Search the questions')} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {patients.length > 1 && (
              <select aria-label={t('Patient')} value={patientFilter} onChange={(e) => setPatientFilter(e.target.value)}>
                <option value="">{t('All patients')}</option>
                {patients.map(([episodeId, patientName]) => <option key={episodeId} value={episodeId}>{patientName}</option>)}
              </select>
            )}
          </div>
          <div className="continuity-tabs" role="group" aria-label={t('Show questions')} style={{ margin: '0 0 14px 0' }}>
            <button type="button" aria-pressed={filter === 'needs'} onClick={() => setFilter('needs')}>{t('Needs reply ({count})', { count: waiting.length })}</button>
            <button type="button" aria-pressed={filter === 'answered'} onClick={() => setFilter('answered')}>{t('Answered ({count})', { count: done.length })}</button>
            <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>{t('All ({count})', { count: narrowed.length })}</button>
            {filtered && <button type="button" onClick={clearFilters}>{t('Clear filters')}</button>}
          </div>

          {shown.length === 0 && (
            <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              {filtered ? t('No questions match these filters.') : filter === 'needs' ? t('Nothing needs your reply right now.') : t('No answered questions yet.')}
              {filter === 'needs' && !filtered && done.length > 0 && (
                <div style={{ marginTop: '12px' }}><button type="button" className="btn-secondary" onClick={() => setFilter('all')}>{t('Show all questions')}</button></div>
              )}
            </div>
          )}

          {shown.length > 0 && (
            <div className="glass-panel" style={{ padding: '4px 0' }}>
              {shown.map((q, i) => {
                const isOpen = expandedId === q.id;
                const isAnswered = !needsReply(q);
                const handled = q.closedHow === 'phone_or_clinic';
                return (
                  <div key={q.id} id={`question-${q.id}`} style={{ borderBottom: i === shown.length - 1 ? 'none' : '1px solid var(--border-color)' }}>
                    <button onClick={() => toggle(q)} aria-expanded={isOpen} className="question-row-head">
                      <div className="question-row-main">
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                          {q.patientName} · {formatFriendlyDate(q.createdAt)}
                          {!isAnswered && <> · {waitingText(q.createdAt, now, t)}</>}
                          {q.followUpOfText && <> · {t('Follow-up')}</>}
                          {(q.attachments ?? []).length > 0 && <> · {t('Files attached: {count}', { count: (q.attachments ?? []).length })}</>}
                        </div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{q.questionText}</div>
                      </div>
                      <div className="question-row-side">
                        <StatusBadge label={friendlyQuestionStatus(q.status, q.closedHow)} tone={QUESTION_STATUS_TONE[q.status]} />
                        {isOpen ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
                      </div>
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
                        {isAnswered && q.responses.length > 0 && !handled && (
                          <div style={{ marginBottom: '12px', fontSize: '0.85rem', color: 'var(--text-primary)', background: 'var(--mint-soft)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
                            {q.responses[0].responseText}
                          </div>
                        )}
                        {handled && (
                          <div className="handled-note">
                            <strong>{t('Handled by phone or in clinic')}</strong>
                            <p>{q.closedNote}</p>
                            <p className="continuity-muted">
                              {t('{name} · {date}. Only doctors see this note. The patient was told you handled it by phone or at the clinic.', { name: q.closedByName ?? '', date: formatFriendlyDate(q.closedAt) })}
                            </p>
                          </div>
                        )}
                        {!isAnswered && (
                          <>
                            {actionError && <div role="alert" style={{ fontSize: '0.8rem', color: 'var(--rose-urgent)', marginBottom: '10px' }}>{t(actionError)}</div>}
                            <SavedReplies snippets={snippets} onChanged={setSnippets} onInsert={insertSaved} />
                            <textarea
                              ref={replyBox}
                              aria-label={t('Your reply')}
                              value={draftText}
                              onChange={(e) => setDraftText(e.target.value)}
                              placeholder={t('Draft your clinical response…')}
                              rows={3}
                              style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '0.85rem', fontFamily: 'inherit', resize: 'vertical', marginBottom: '10px' }}
                            />
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <button onClick={() => handleSaveDraft(q.id)} disabled={isSaving || !draftText.trim()} className="btn-secondary" style={{ fontSize: '0.8rem' }}>{t('Draft Response')}</button>
                              <button onClick={() => handleApproveAndSend(q.id)} disabled={isSaving} className="btn-primary" style={{ fontSize: '0.8rem' }}><Send size={13} /> {t('Approve & Send')}</button>
                              {closingId !== q.id && (
                                <button type="button" onClick={() => { setClosingId(q.id); setCloseNote(''); setActionError(null); }} disabled={isSaving} className="btn-secondary" style={{ fontSize: '0.8rem' }}>
                                  <PhoneCall size={13} aria-hidden="true" /> {t('Handled by phone or in clinic')}
                                </button>
                              )}
                            </div>
                            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                              {t('Draft, then approve — the patient only sees the response after you approve it.')}
                            </p>
                            {closingId === q.id && (
                              <div className="close-handled" role="group" aria-label={t('Handled by phone or in clinic')}>
                                <label htmlFor={`close-note-${q.id}`}>{t('Your private note (only doctors see it)')}</label>
                                <textarea
                                  id={`close-note-${q.id}`}
                                  ref={closeBox}
                                  rows={2}
                                  maxLength={1000}
                                  value={closeNote}
                                  onChange={(e) => setCloseNote(e.target.value)}
                                  placeholder={t('For example: rang her on the phone and went through it')}
                                />
                                <p className="continuity-muted">{t('No reply is written. The patient is told: “Your doctor handled your question by phone or at the clinic.” Your note is not shown to her.')}</p>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                  <button type="button" className="btn-primary" style={{ fontSize: '0.8rem' }} disabled={isSaving || closeNote.trim().length < 3} onClick={() => void handleCloseHandled(q)}>{t('Close this question')}</button>
                                  <button type="button" className="btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => { setClosingId(null); setCloseNote(''); }}>{t('Cancel')}</button>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </main>
  );
}
