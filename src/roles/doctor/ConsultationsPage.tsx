import { useEffect, useId, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Mic, Square, Keyboard, Sparkles, Edit3, CheckCircle2, XCircle, RotateCcw, Loader2, AlertTriangle } from 'lucide-react';
import {
  fetchPatients, fetchTodaysBrief, startConsultation, transcribeConsultation, updateTranscript,
  generateDraft, updateDraft, rejectDraft, approveDraft, confirmFollowUp,
} from '../../api/doctorPortal';
import type { DoctorPatientRow, TodaysBrief, Consultation, ConsultationDraft, ConsultationDraftContent } from '../../api/doctorPortal';
import { ApiError } from '../../api/client';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { StatusBadge } from '../../components/StatusBadge';
import { friendlyDraftStatus, DRAFT_STATUS_TONE, formatFriendlyDate } from './format';
import { documentTitle } from './documentTitle';
import { fetchLastApprovedVisit, fetchNoteLayouts } from '../../api/doctorConsultQ';
import type { LastApprovedVisit, NoteLayout } from '../../api/doctorConsultQ';
import { tx, useLanguage } from '../../i18n';
import { DocumentationHistoryView } from './DocumentationHistoryPage';

type Stage = 'select' | 'context' | 'documenting' | 'draft';

// The note layout she chose is kept for this visit to the site (this browser tab), so it is there for the next patient too.
const LAYOUT_KEY = 'maternasync.doctor.noteLayout';

// One menu item, two tabs. The consultation in progress stays mounted (only hidden) while the history is open, so a recording or a half-written
// note is not lost; the history is read afresh each time it is opened, so a note approved a moment ago is in it.
export function ConsultationsPage() {
  const { t } = useLanguage();
  const [params, setParams] = useSearchParams();
  const view = params.get('tab') === 'history' ? 'history' : 'new';
  const show = (next: 'new' | 'history') => setParams((previous) => {
    const updated = new URLSearchParams(previous);
    if (next === 'history') updated.set('tab', 'history'); else updated.delete('tab');
    return updated;
  }, { replace: true });

  return (
    <main style={{ padding: '24px', flex: 1, maxWidth: '900px', margin: '0 auto', width: '100%' }}>
      <h1 className="page-title" style={{ fontSize: '1.4rem', margin: '0 0 6px 0' }}>{t('Consultations')}</h1>
      <div className="continuity-tabs" style={{ margin: '12px 0 18px 0' }}>
        <button aria-pressed={view === 'new'} onClick={() => show('new')}>{t('New consultation')}</button>
        <button aria-pressed={view === 'history'} onClick={() => show('history')}>{t('Documentation history')}</button>
      </div>
      <div hidden={view !== 'new'} style={{ maxWidth: '760px', margin: '0 auto' }}><NewConsultationView /></div>
      {view === 'history' && <DocumentationHistoryView />}
    </main>
  );
}

function NewConsultationView() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const initialEpisodeId = searchParams.get('episodeId') ?? '';

  const [patients, setPatients] = useState<DoctorPatientRow[]>([]);
  const [episodeId, setEpisodeId] = useState(initialEpisodeId);
  const [brief, setBrief] = useState<TodaysBrief | null>(null);
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [draft, setDraft] = useState<ConsultationDraft | null>(null);
  const [stage, setStage] = useState<Stage>(initialEpisodeId ? 'context' : 'select');
  const [writeMode, setWriteMode] = useState<'choose' | 'voice' | 'text'>('choose');
  const [textNote, setTextNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<ConsultationDraftContent | null>(null);
  const [language, setLanguage] = useState('auto');
  const [suggestedFollowUp, setSuggestedFollowUp] = useState<string | null>(null);
  const [followUpStatus, setFollowUpStatus] = useState<'pending' | 'confirmed' | 'skipped'>('pending');
  const [isConfirmingFollowUp, setIsConfirmingFollowUp] = useState(false);
  const layoutSelectId = useId();
  const [layouts, setLayouts] = useState<NoteLayout[]>([]);
  const [layoutId, setLayoutId] = useState(() => { try { return sessionStorage.getItem(LAYOUT_KEY) ?? ''; } catch { return ''; } });
  const [lastVisit, setLastVisit] = useState<LastApprovedVisit | null | undefined>(undefined);

  const recorder = useVoiceRecorder();
  const mediaRecorderBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    fetchPatients().then(setPatients).catch(() => {});
  }, []);

  // Only layouts the clinic has approved are offered; a layout remembered from earlier that is no longer approved is dropped.
  useEffect(() => {
    fetchNoteLayouts()
      .then((rows) => { setLayouts(rows); setLayoutId((current) => (rows.some((row) => row.id === current) ? current : '')); })
      .catch(() => setLayouts([]));
  }, []);

  const chooseLayout = (id: string) => {
    setLayoutId(id);
    try { sessionStorage.setItem(LAYOUT_KEY, id); } catch { /* the choice just is not remembered */ }
  };

  useEffect(() => {
    if (episodeId && stage === 'context') {
      fetchTodaysBrief(episodeId).then(setBrief).catch(() => setError(tx("We couldn't load this patient's context.")));
      setLastVisit(undefined);
      fetchLastApprovedVisit(episodeId).then(setLastVisit).catch(() => setLastVisit(null));
    }
  }, [episodeId, stage]);

  const handleSelectPatient = (id: string) => {
    setEpisodeId(id);
    setBrief(null);
    setConsultation(null);
    setDraft(null);
    setStage('context');
    setError(null);
  };

  const handleStartConsultation = async (inputMode: 'voice' | 'text') => {
    setIsLoading(true);
    setError(null);
    try {
      const c = await startConsultation(episodeId, inputMode, layoutId || null);
      setConsultation(c);
      setWriteMode(inputMode);
      setStage('documenting');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tx('Could not start the consultation.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopRecording = async () => {
    recorder.stop();
  };

  useEffect(() => {
    if (recorder.status === 'stopped' && recorder.audioUrl && consultation) {
      (async () => {
        setIsTranscribing(true);
        setError(null);
        try {
          const blob = await fetch(recorder.audioUrl!).then((r) => r.blob());
          mediaRecorderBlobRef.current = blob;
          const updated = await transcribeConsultation(consultation.id, blob, language);
          setConsultation(updated);
        } catch (err) {
          setError(err instanceof ApiError ? err.message : tx('Transcription could not be completed.'));
        } finally {
          setIsTranscribing(false);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.status]);

  const handleSaveTextNote = async () => {
    if (!consultation || !textNote.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const updated = await updateTranscript(consultation.id, textNote.trim());
      setConsultation(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tx('Could not save the note.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditTranscript = async (value: string) => {
    if (!consultation) return;
    setConsultation({ ...consultation, rawTranscript: value });
  };

  const handleSaveTranscriptEdit = async () => {
    if (!consultation) return;
    try {
      await updateTranscript(consultation.id, consultation.rawTranscript ?? '');
    } catch {
      setError(tx('Could not save your transcript edit.'));
    }
  };

  const handleGenerateDraft = async () => {
    if (!consultation) return;
    setIsGenerating(true);
    setError(null);
    try {
      const d = await generateDraft(consultation.id);
      setDraft(d);
      setEdits(d.structuredContent);
      setStage('draft');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tx('Could not generate a draft.'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveEdits = async () => {
    if (!draft || !edits) return;
    setIsLoading(true);
    setError(null);
    try {
      const updated = await updateDraft(draft.id, edits);
      setDraft(updated);
      setEdits(updated.structuredContent);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tx('Could not save your edits.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!consultation) return;
    setIsGenerating(true);
    setError(null);
    try {
      const d = await generateDraft(consultation.id);
      setDraft(d);
      setEdits(d.structuredContent);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tx('Could not regenerate the draft.'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReject = async () => {
    if (!draft) return;
    try {
      const updated = await rejectDraft(draft.id);
      setDraft(updated);
    } catch {
      setError(tx('Could not reject this draft.'));
    }
  };

  const handleApprove = async () => {
    if (!draft) return;
    setIsLoading(true);
    setError(null);
    try {
      const approved = await approveDraft(draft.id);
      setDraft({ ...draft, status: 'APPROVED' });
      setSuggestedFollowUp(approved.suggestedFollowUp);
      setFollowUpStatus('pending');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tx('Could not approve this documentation.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmFollowUp = async () => {
    if (!consultation || !suggestedFollowUp) return;
    setIsConfirmingFollowUp(true);
    setError(null);
    try {
      await confirmFollowUp(consultation.id, suggestedFollowUp);
      setFollowUpStatus('confirmed');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tx('Could not create the follow-up task.'));
    } finally {
      setIsConfirmingFollowUp(false);
    }
  };

  const handleSkipFollowUp = () => {
    setFollowUpStatus('skipped');
  };

  return (
    <div>

      {error && <div className="glass-panel" style={{ padding: '12px 18px', marginBottom: '16px', color: 'var(--rose-urgent)', fontSize: '0.84rem' }}>{t(error)}</div>}

      {stage === 'select' && (
        <div className="glass-panel" style={{ padding: '32px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '16px' }}>{t('Select a patient to begin a consultation.')}</p>
          <select
            aria-label={t('Choose a patient')}
            onChange={(e) => handleSelectPatient(e.target.value)}
            defaultValue=""
            style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.88rem', cursor: 'pointer', minWidth: '240px' }}
          >
            <option value="" disabled>{t('Select a patient…')}</option>
            {patients.map((p) => <option key={p.episodeId} value={p.episodeId}>{p.patientName}</option>)}
          </select>
        </div>
      )}

      {stage === 'context' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <select
            aria-label={t('Choose a patient')}
            value={episodeId}
            onChange={(e) => handleSelectPatient(e.target.value)}
            style={{ padding: '9px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.86rem', fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' }}
          >
            {patients.map((p) => <option key={p.episodeId} value={p.episodeId}>{p.patientName}</option>)}
          </select>

          {brief ? (
            <div className="glass-panel" style={{ padding: '20px 24px' }}>
              <div className="page-title" style={{ fontSize: '1.1rem', marginBottom: '10px' }}>{t('Patient Context: {name}', { name: brief.patientName })}</div>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                GA {brief.gestationalAgeWeeks}w{brief.gestationalAgeDays}d
              </div>
              <ContextRow label={t('Recent Journey')} value={brief.recentEvents.length ? brief.recentEvents.slice(0, 3).map((e) => t(e.title)).join('; ') : t('Not available in current records.')} />
              <ContextRow label={t('Relevant Documents')} value={brief.relevantDocuments.length ? brief.relevantDocuments.map((d) => documentTitle(d, t)).join(', ') : t('Not available in current records.')} />
              <ContextRow label={t('Patient Questions')} value={brief.patientQuestions.length ? t('{count} unanswered', { count: brief.patientQuestions.length }) : t('None')} />
              <ContextRow label={t('Pending Follow-ups')} value={brief.pendingItems.length ? t('{count} open', { count: brief.pendingItems.length }) : t('None')} isLast />
              <LastVisit visit={lastVisit} />
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>{t('Loading context…')}</div>
          )}

          <div className="glass-panel" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>{t('Documentation')}</div>
            <div className="note-layout-choice">
              <label htmlFor={layoutSelectId}>{t('Note layout')}</label>
              <select id={layoutSelectId} value={layoutId} onChange={(e) => chooseLayout(e.target.value)}>
                <option value="">{t('Standard layout')}</option>
                {layouts.map((layout) => <option key={layout.id} value={layout.id}>{layout.title} · v{layout.version}</option>)}
              </select>
            </div>
            <p className="continuity-muted note-layout-help">
              {layouts.length > 0
                ? t('Only layouts your clinic has approved are listed. The layout’s headings are added to the draft as empty boxes for you to fill in.')
                : t('No note layout is approved yet, so only the standard layout is available. Approve one under Clinical Settings → Note templates.')}
            </p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={() => handleStartConsultation('text')} disabled={isLoading} className="btn-secondary"><Keyboard size={14} /> {t('Write Note')}</button>
              <button onClick={() => handleStartConsultation('voice')} disabled={isLoading} className="btn-primary"><Mic size={14} /> {t('Start Voice Note')}</button>
            </div>
          </div>
        </div>
      )}

      {stage === 'documenting' && consultation && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {writeMode === 'voice' && (
            <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '14px' }}>{t('Voice Note')}</div>
              <label style={{ display: 'block', marginBottom: 16, fontSize: '.85rem' }}>{t('Spoken language')}{' '}
                <select value={language} onChange={e => setLanguage(e.target.value)} disabled={recorder.status === 'recording' || isTranscribing}>
                  <option value="auto">{t('Auto-detect / mixed languages')}</option><option value="en">{t('English')}</option><option value="hi">{t('Hindi / Hinglish')}</option><option value="ta">{t('Tamil')}</option><option value="te">{t('Telugu')}</option>
                </select>
              </label>
              <p style={{ fontSize: '.78rem', color: 'var(--text-secondary)' }}>{t('Review names, medicines and mixed-language terminology in the transcript before generating a draft.')}</p>
              {recorder.status === 'idle' && (
                <button onClick={() => recorder.start()} className="btn-primary"><Mic size={16} /> {t('Start Recording')}</button>
              )}
              {recorder.status === 'recording' && (
                <>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--rose-urgent)', marginBottom: '14px' }}>● {recorder.durationSeconds}s</div>
                  <button onClick={handleStopRecording} className="btn-secondary"><Square size={14} /> {t('Stop Recording')}</button>
                </>
              )}
              {recorder.status === 'error' && (
                <div style={{ color: 'var(--rose-urgent)', fontSize: '0.85rem' }}>{recorder.errorMessage && t(recorder.errorMessage)}</div>
              )}
              {isTranscribing && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '14px', color: 'var(--text-secondary)' }}>
                  <Loader2 size={16} className="spin-slow" /> {t('Transcribing…')}
                </div>
              )}
            </div>
          )}

          {writeMode === 'text' && !consultation.rawTranscript && (
            <div className="glass-panel" style={{ padding: '20px 24px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>{t('Write Note')}</div>
              <textarea
                value={textNote}
                onChange={(e) => setTextNote(e.target.value)}
                rows={6}
                placeholder={t('Document the consultation…')}
                style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '0.86rem', fontFamily: 'inherit', resize: 'vertical', marginBottom: '12px' }}
              />
              <button onClick={handleSaveTextNote} disabled={isLoading || !textNote.trim()} className="btn-primary">{t('Save Note')}</button>
            </div>
          )}

          {consultation.rawTranscript !== null && consultation.rawTranscript !== undefined && consultation.rawTranscript !== '' && (
            <div className="glass-panel" style={{ padding: '20px 24px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>
                {writeMode === 'voice' ? t('Voice Transcription') : t('Consultation Note')}
              </div>
              <textarea
                value={consultation.rawTranscript}
                onChange={(e) => handleEditTranscript(e.target.value)}
                onBlur={handleSaveTranscriptEdit}
                rows={5}
                style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '0.86rem', fontFamily: 'inherit', resize: 'vertical', marginBottom: '12px' }}
              />
              <button onClick={handleGenerateDraft} disabled={isGenerating} className="btn-primary">
                {isGenerating ? t('Generating…') : <><Sparkles size={14} /> {t('Generate Documentation Draft')}</>}
              </button>
            </div>
          )}

          {consultation.rawTranscript === '' && writeMode === 'voice' && recorder.status === 'stopped' && !isTranscribing && (
            <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={18} style={{ color: 'var(--rose-urgent)' }} />
              <div>
                <div style={{ fontSize: '0.86rem', color: 'var(--text-primary)' }}>{t('Transcription could not be completed.')}</div>
                <button onClick={() => recorder.reset()} className="btn-secondary" style={{ fontSize: '0.78rem', marginTop: '8px' }}><RotateCcw size={13} /> {t('Retry')}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {stage === 'draft' && draft && edits && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="glass-panel" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              <div>
                <div className="page-title" style={{ fontSize: '1.1rem' }}>{t('Consultation Documentation')}</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--purple-ai)', fontWeight: 700, textTransform: 'uppercase', marginTop: '2px' }}>{t('AI-Generated · Draft')}</div>
              </div>
              <StatusBadge label={friendlyDraftStatus(draft.status)} tone={DRAFT_STATUS_TONE[draft.status]} />
            </div>

            <DraftField label={t('Visit Context')} value={edits.visitContext} onChange={(v) => setEdits({ ...edits, visitContext: v })} disabled={draft.status !== 'DRAFT'} />
            <DraftField label={t('Documented Discussion')} value={edits.documentedDiscussion} onChange={(v) => setEdits({ ...edits, documentedDiscussion: v })} disabled={draft.status !== 'DRAFT'} rows={4} />
            <DraftField label={t('Relevant Information')} value={edits.relevantInformation} onChange={(v) => setEdits({ ...edits, relevantInformation: v })} disabled={draft.status !== 'DRAFT'} />
            <DraftField label={t('Follow-up / Next Steps')} value={edits.followUpNextSteps} onChange={(v) => setEdits({ ...edits, followUpNextSteps: v })} disabled={draft.status !== 'DRAFT'} />
            {edits.layoutSections && Object.keys(edits.layoutSections).length > 0 && (
              <div className="layout-sections">
                <div className="continuity-muted">{t('Note layout: {title}', { title: edits.layout?.title ?? '' })}</div>
                {Object.entries(edits.layoutSections).map(([heading, value]) => (
                  <DraftField
                    key={heading}
                    label={heading}
                    value={value}
                    onChange={(v) => setEdits({ ...edits, layoutSections: { ...(edits.layoutSections ?? {}), [heading]: v } })}
                    disabled={draft.status !== 'DRAFT'}
                    rows={3}
                  />
                ))}
              </div>
            )}

            {draft.status === 'DRAFT' && (
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '16px' }}>
                <button onClick={handleSaveEdits} disabled={isLoading} className="btn-secondary"><Edit3 size={14} /> {t('Save Draft')}</button>
                <button onClick={handleRegenerate} disabled={isGenerating} className="btn-secondary"><RotateCcw size={14} /> {t('Regenerate')}</button>
                <button onClick={handleReject} disabled={isLoading} className="btn-secondary" style={{ color: 'var(--rose-urgent)' }}><XCircle size={14} /> {t('Reject')}</button>
                <button onClick={handleApprove} disabled={isLoading} className="btn-primary"><CheckCircle2 size={15} /> {t('Approve')}</button>
              </div>
            )}
            {draft.status === 'APPROVED' && (
              <div style={{ marginTop: '14px', fontSize: '0.84rem', color: 'var(--emerald-raw)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={15} /> {t("Approved and added to the patient's journey.")}
              </div>
            )}
          </div>

          {draft.status === 'APPROVED' && suggestedFollowUp && followUpStatus === 'pending' && (
            <div className="glass-panel" style={{ padding: '18px 22px' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>{t('Suggested Follow-up')}</div>
              <div style={{ fontSize: '0.86rem', color: 'var(--text-primary)', marginBottom: '14px' }}>&ldquo;{suggestedFollowUp}&rdquo;</div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={handleConfirmFollowUp} disabled={isConfirmingFollowUp} className="btn-primary"><CheckCircle2 size={14} /> {t('Create Task')}</button>
                <button onClick={handleSkipFollowUp} disabled={isConfirmingFollowUp} className="btn-secondary">{t('Skip')}</button>
              </div>
            </div>
          )}
          {draft.status === 'APPROVED' && followUpStatus === 'confirmed' && (
            <div className="glass-panel" style={{ padding: '14px 22px', fontSize: '0.84rem', color: 'var(--emerald-raw)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={15} /> {t('Follow-up task created.')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// The names of the standard sections of a note, in the order they are read.
const SECTION_LABELS: Record<string, string> = {
  visitContext: tx('Visit Context'),
  documentedDiscussion: tx('Documented Discussion'),
  relevantInformation: tx('Relevant Information'),
  followUpNextSteps: tx('Follow-up / Next Steps'),
};

/** The note the doctor approved most recently for this patient, exactly as she approved it: the first lines, then the whole note. Read-only. */
function LastVisit({ visit }: { visit: LastApprovedVisit | null | undefined }) {
  const { t } = useLanguage();
  if (visit === undefined) return <div className="last-visit continuity-muted">{t('Loading…')}</div>;
  if (visit === null) {
    return (
      <div className="last-visit">
        <div className="last-visit-heading">{t('Last approved visit')}</div>
        <p className="continuity-muted">{t('No visit note has been approved for this patient yet.')}</p>
      </div>
    );
  }
  const written = visit.sections.filter((section) => section.text.trim() && section.text.trim() !== 'Not documented.');
  const lead = written.find((section) => section.key === 'documentedDiscussion') ?? written[0];
  const preview = lead ? lead.text.trim().split('\n').slice(0, 3).join('\n').slice(0, 320) : '';
  return (
    <div className="last-visit">
      <div className="last-visit-heading">{t('Last approved visit: {date}', { date: formatFriendlyDate(visit.approvedAt) })}</div>
      <div className="continuity-muted">
        {t('Approved by {name}', { name: visit.approvedByName })}{visit.layoutTitle ? ` · ${visit.layoutTitle}` : ''}
      </div>
      {preview ? <p className="last-visit-preview">{preview}</p> : <p className="continuity-muted">{t('Nothing was written in this note.')}</p>}
      {visit.sections.length > 0 && (
        <details>
          <summary>{t('Read it all')}</summary>
          {visit.sections.map((section) => (
            <div key={`${section.key}-${section.heading ?? ''}`} className="last-visit-section">
              <strong>{section.heading ?? t(SECTION_LABELS[section.key] ?? section.key)}</strong>
              <p>{section.text}</p>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}

function ContextRow({ label, value, isLast }: { label: string; value: string; isLast?: boolean }) {
  return (
    <div style={{ padding: '8px 0', borderBottom: isLast ? 'none' : '1px solid var(--border-color)' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '0.84rem', color: 'var(--text-primary)', marginTop: '2px' }}>{value}</div>
    </div>
  );
}

function DraftField({ label, value, onChange, disabled, rows = 2 }: { label: string; value: string; onChange: (v: string) => void; disabled: boolean; rows?: number }) {
  const id = useId();
  return (
    <div style={{ marginBottom: '14px' }}>
      <label htmlFor={id} style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '5px' }}>{label}</label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={rows}
        style={{ width: '100%', background: disabled ? 'var(--bg-secondary)' : 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '9px 11px', color: 'var(--text-primary)', fontSize: '0.84rem', fontFamily: 'inherit', resize: 'vertical' }}
      />
    </div>
  );
}
