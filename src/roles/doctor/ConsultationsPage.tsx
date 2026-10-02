import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Mic, Square, Keyboard, Sparkles, Edit3, CheckCircle2, XCircle, RotateCcw, Loader2, AlertTriangle } from 'lucide-react';
import {
  fetchPatients, fetchTodaysBrief, startConsultation, transcribeConsultation, updateTranscript,
  generateDraft, updateDraft, rejectDraft, approveDraft,
} from '../../api/doctorPortal';
import type { DoctorPatientRow, TodaysBrief, Consultation, ConsultationDraft, ConsultationDraftContent } from '../../api/doctorPortal';
import { ApiError } from '../../api/client';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { StatusBadge } from '../../components/StatusBadge';
import { friendlyDraftStatus, DRAFT_STATUS_TONE } from './format';

type Stage = 'select' | 'context' | 'documenting' | 'draft';

export function ConsultationsPage() {
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

  const recorder = useVoiceRecorder();
  const mediaRecorderBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    fetchPatients().then(setPatients).catch(() => {});
  }, []);

  useEffect(() => {
    if (episodeId && stage === 'context') {
      fetchTodaysBrief(episodeId).then(setBrief).catch(() => setError("We couldn't load this patient's context."));
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
      const c = await startConsultation(episodeId, inputMode);
      setConsultation(c);
      setWriteMode(inputMode);
      setStage('documenting');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start the consultation.');
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
          const updated = await transcribeConsultation(consultation.id, blob);
          setConsultation(updated);
        } catch (err) {
          setError(err instanceof ApiError ? err.message : 'Transcription could not be completed.');
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
      setError(err instanceof ApiError ? err.message : 'Could not save the note.');
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
      setError('Could not save your transcript edit.');
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
      setError(err instanceof ApiError ? err.message : 'Could not generate a draft.');
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
      setError(err instanceof ApiError ? err.message : 'Could not save your edits.');
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
      setError(err instanceof ApiError ? err.message : 'Could not regenerate the draft.');
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
      setError('Could not reject this draft.');
    }
  };

  const handleApprove = async () => {
    if (!draft) return;
    setIsLoading(true);
    setError(null);
    try {
      await approveDraft(draft.id);
      setDraft({ ...draft, status: 'APPROVED' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not approve this documentation.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main style={{ padding: '24px', flex: 1, maxWidth: '760px', margin: '0 auto', width: '100%' }}>
      <h1 className="page-title" style={{ fontSize: '1.4rem', margin: '0 0 18px 0' }}>Consultations</h1>

      {error && <div className="glass-panel" style={{ padding: '12px 18px', marginBottom: '16px', color: 'var(--rose-urgent)', fontSize: '0.84rem' }}>{error}</div>}

      {stage === 'select' && (
        <div className="glass-panel" style={{ padding: '32px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '16px' }}>Select a patient to begin a consultation.</p>
          <select
            onChange={(e) => handleSelectPatient(e.target.value)}
            defaultValue=""
            style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.88rem', cursor: 'pointer', minWidth: '240px' }}
          >
            <option value="" disabled>Select a patient…</option>
            {patients.map((p) => <option key={p.episodeId} value={p.episodeId}>{p.patientName}</option>)}
          </select>
        </div>
      )}

      {stage === 'context' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <select
            value={episodeId}
            onChange={(e) => handleSelectPatient(e.target.value)}
            style={{ padding: '9px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.86rem', fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' }}
          >
            {patients.map((p) => <option key={p.episodeId} value={p.episodeId}>{p.patientName}</option>)}
          </select>

          {brief ? (
            <div className="glass-panel" style={{ padding: '20px 24px' }}>
              <div className="page-title" style={{ fontSize: '1.1rem', marginBottom: '10px' }}>Patient Context: {brief.patientName}</div>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                GA {brief.gestationalAgeWeeks}w{brief.gestationalAgeDays}d · Risk: {brief.riskCategory.replace('_', ' ')}
              </div>
              <ContextRow label="Recent Journey" value={brief.recentEvents.length ? brief.recentEvents.slice(0, 3).map((e) => e.title).join('; ') : 'Not available in current records.'} />
              <ContextRow label="Relevant Documents" value={brief.relevantDocuments.length ? brief.relevantDocuments.map((d) => d.filename).join(', ') : 'Not available in current records.'} />
              <ContextRow label="Patient Questions" value={brief.patientQuestions.length ? `${brief.patientQuestions.length} unanswered` : 'None'} />
              <ContextRow label="Pending Follow-ups" value={brief.pendingItems.length ? `${brief.pendingItems.length} open` : 'None'} isLast />
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading context…</div>
          )}

          <div className="glass-panel" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>Documentation</div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={() => handleStartConsultation('text')} disabled={isLoading} className="btn-secondary"><Keyboard size={14} /> Write Note</button>
              <button onClick={() => handleStartConsultation('voice')} disabled={isLoading} className="btn-primary"><Mic size={14} /> Start Voice Note</button>
            </div>
          </div>
        </div>
      )}

      {stage === 'documenting' && consultation && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {writeMode === 'voice' && (
            <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '14px' }}>Voice Note</div>
              {recorder.status === 'idle' && (
                <button onClick={() => recorder.start()} className="btn-primary"><Mic size={16} /> Start Recording</button>
              )}
              {recorder.status === 'recording' && (
                <>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--rose-urgent)', marginBottom: '14px' }}>● {recorder.durationSeconds}s</div>
                  <button onClick={handleStopRecording} className="btn-secondary"><Square size={14} /> Stop Recording</button>
                </>
              )}
              {recorder.status === 'error' && (
                <div style={{ color: 'var(--rose-urgent)', fontSize: '0.85rem' }}>{recorder.errorMessage}</div>
              )}
              {isTranscribing && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '14px', color: 'var(--text-secondary)' }}>
                  <Loader2 size={16} className="spin-slow" /> Transcribing…
                </div>
              )}
            </div>
          )}

          {writeMode === 'text' && !consultation.rawTranscript && (
            <div className="glass-panel" style={{ padding: '20px 24px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>Write Note</div>
              <textarea
                value={textNote}
                onChange={(e) => setTextNote(e.target.value)}
                rows={6}
                placeholder="Document the consultation…"
                style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '0.86rem', fontFamily: 'inherit', resize: 'vertical', marginBottom: '12px' }}
              />
              <button onClick={handleSaveTextNote} disabled={isLoading || !textNote.trim()} className="btn-primary">Save Note</button>
            </div>
          )}

          {consultation.rawTranscript !== null && consultation.rawTranscript !== undefined && consultation.rawTranscript !== '' && (
            <div className="glass-panel" style={{ padding: '20px 24px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>
                {writeMode === 'voice' ? 'Voice Transcription' : 'Consultation Note'}
              </div>
              <textarea
                value={consultation.rawTranscript}
                onChange={(e) => handleEditTranscript(e.target.value)}
                onBlur={handleSaveTranscriptEdit}
                rows={5}
                style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '0.86rem', fontFamily: 'inherit', resize: 'vertical', marginBottom: '12px' }}
              />
              <button onClick={handleGenerateDraft} disabled={isGenerating} className="btn-primary">
                {isGenerating ? 'Generating…' : <><Sparkles size={14} /> Generate Documentation Draft</>}
              </button>
            </div>
          )}

          {consultation.rawTranscript === '' && writeMode === 'voice' && recorder.status === 'stopped' && !isTranscribing && (
            <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={18} style={{ color: 'var(--rose-urgent)' }} />
              <div>
                <div style={{ fontSize: '0.86rem', color: 'var(--text-primary)' }}>Transcription could not be completed.</div>
                <button onClick={() => recorder.reset()} className="btn-secondary" style={{ fontSize: '0.78rem', marginTop: '8px' }}><RotateCcw size={13} /> Retry</button>
              </div>
            </div>
          )}
        </div>
      )}

      {stage === 'draft' && draft && edits && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="glass-panel" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <div className="page-title" style={{ fontSize: '1.1rem' }}>Consultation Documentation</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--purple-ai)', fontWeight: 700, textTransform: 'uppercase', marginTop: '2px' }}>AI-Generated · Draft</div>
              </div>
              <StatusBadge label={friendlyDraftStatus(draft.status)} tone={DRAFT_STATUS_TONE[draft.status]} />
            </div>

            <DraftField label="Visit Context" value={edits.visitContext} onChange={(v) => setEdits({ ...edits, visitContext: v })} disabled={draft.status !== 'DRAFT'} />
            <DraftField label="Documented Discussion" value={edits.documentedDiscussion} onChange={(v) => setEdits({ ...edits, documentedDiscussion: v })} disabled={draft.status !== 'DRAFT'} rows={4} />
            <DraftField label="Relevant Information" value={edits.relevantInformation} onChange={(v) => setEdits({ ...edits, relevantInformation: v })} disabled={draft.status !== 'DRAFT'} />
            <DraftField label="Follow-up / Next Steps" value={edits.followUpNextSteps} onChange={(v) => setEdits({ ...edits, followUpNextSteps: v })} disabled={draft.status !== 'DRAFT'} />

            {draft.status === 'DRAFT' && (
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '16px' }}>
                <button onClick={handleSaveEdits} disabled={isLoading} className="btn-secondary"><Edit3 size={14} /> Save Draft</button>
                <button onClick={handleRegenerate} disabled={isGenerating} className="btn-secondary"><RotateCcw size={14} /> Regenerate</button>
                <button onClick={handleReject} disabled={isLoading} className="btn-secondary" style={{ color: 'var(--rose-urgent)' }}><XCircle size={14} /> Reject</button>
                <button onClick={handleApprove} disabled={isLoading} className="btn-primary"><CheckCircle2 size={15} /> Approve</button>
              </div>
            )}
            {draft.status === 'APPROVED' && (
              <div style={{ marginTop: '14px', fontSize: '0.84rem', color: 'var(--emerald-raw)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={15} /> Approved and added to the patient's journey.
              </div>
            )}
          </div>
        </div>
      )}
    </main>
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
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '5px' }}>{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={rows}
        style={{ width: '100%', background: disabled ? 'var(--bg-secondary)' : 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '9px 11px', color: 'var(--text-primary)', fontSize: '0.84rem', fontFamily: 'inherit', resize: 'vertical' }}
      />
    </div>
  );
}
