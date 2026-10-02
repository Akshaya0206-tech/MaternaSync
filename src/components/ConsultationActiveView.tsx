import { useState, useRef, useEffect } from 'react';
import type { PatientEpisode, PatientRecord, PendingWorkflowItem } from '../types/patient';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import {
  ArrowLeft,
  ShieldCheck,
  User,
  Calendar,
  MessageSquare,
  Mic,
  Pause,
  Square,
  RotateCcw,
  Type,
  FileText,
  Edit3,
  RefreshCw,
  X,
  Eye,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Plus,
  Trash2,
  Lock,
  Volume2,
  Share2,
  ListChecks,
  ClipboardCheck,
  Workflow,
  ArrowRight
} from 'lucide-react';

type Stage = 'workspace' | 'capture' | 'note' | 'structuring' | 'review' | 'saved';
type InputMode = 'voice' | 'text';

interface FollowUpCommitment {
  id: string;
  text: string;
  owner: string;
  convertToTask: boolean;
}

interface DraftSections {
  consultationNotes: string;
  documentedEvents: string;
  patientQuestions: string;
  followUpItems: FollowUpCommitment[];
  handoverNotes: string;
}

interface ApprovedConsultationPayload {
  record: PatientRecord;
  newWorkflowItems: PendingWorkflowItem[];
  handoverNote: string;
}

interface ConsultationActiveViewProps {
  episode: PatientEpisode;
  onReturnToTodaysBrief: () => void;
  onNavigateToPhase1: () => void;
  onApproveConsultation: (payload: ApprovedConsultationPayload) => void;
  onNavigateToWorkflow: () => void;
}

const STAGE_STEPS: { key: Stage; label: string }[] = [
  { key: 'capture', label: 'Voice / Text Note' },
  { key: 'note', label: 'Transcription' },
  { key: 'review', label: 'Structured Draft & Review' },
  { key: 'saved', label: 'Saved to Timeline' }
];

const TRANSCRIPTION_PLACEHOLDER = `[Local Whisper transcription placeholder]\nThis demo environment cannot transcribe real audio. Replace this text with what was actually said during the encounter before generating a structured draft.`;

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export const ConsultationActiveView: React.FC<ConsultationActiveViewProps> = ({
  episode,
  onReturnToTodaysBrief,
  onNavigateToPhase1,
  onApproveConsultation,
  onNavigateToWorkflow
}) => {
  const [stage, setStage] = useState<Stage>('workspace');
  const [inputMode, setInputMode] = useState<InputMode>('voice');
  const [textNoteDraft, setTextNoteDraft] = useState('');
  const [transcript, setTranscript] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isStructuring, setIsStructuring] = useState(false);
  const [draft, setDraft] = useState<DraftSections | null>(null);
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [capturedAt, setCapturedAt] = useState<string | null>(null);
  const [savedSummary, setSavedSummary] = useState<{ recordId: string; taskCount: number } | null>(null);

  const recorder = useVoiceRecorder();
  const timeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      timeouts.forEach(t => window.clearTimeout(t));
    };
  }, []);

  const approvedQuestions = episode.workflowItems.filter(w => w.type === 'unanswered_question');
  const approvedFollowUps = episode.workflowItems.filter(
    w => w.type === 'follow_up_needed' || w.type === 'pending_referral'
  );

  // ---- Step 1: Voice / Text capture ----

  const handleStartRecording = () => {
    setInputMode('voice');
    setStage('capture');
    recorder.start();
  };

  const handleStartTextNote = () => {
    setInputMode('text');
    setTextNoteDraft('');
    setStage('capture');
  };

  const handleStopRecording = () => {
    recorder.stop();
    setCapturedAt(new Date().toISOString());
    setStage('note');
    setIsTranscribing(true);
    const t = window.setTimeout(() => {
      setTranscript(TRANSCRIPTION_PLACEHOLDER);
      setIsTranscribing(false);
    }, 1500);
    timeoutsRef.current.push(t);
  };

  const handleUseTextNote = () => {
    if (!textNoteDraft.trim()) return;
    setCapturedAt(new Date().toISOString());
    setTranscript(textNoteDraft.trim());
    setStage('note');
  };

  const handleReRecord = () => {
    recorder.reset();
    setTranscript('');
    setDraft(null);
    setStage('workspace');
  };

  // ---- Step 2/3: Structured draft (simulated local Ollama organization) ----

  const buildDraft = (sourceText: string): DraftSections => {
    const documentedEvents = sourceText
      .split(/\n+/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => `• ${s}`)
      .join('\n');

    const patientQuestions = approvedQuestions.length > 0
      ? approvedQuestions.map(q => `• ${q.title} — ${q.description}`).join('\n')
      : 'No unanswered patient portal questions were flagged for this encounter.';

    const openCount = episode.workflowItems.filter(w => w.status !== 'completed').length;
    const riskLabel = episode.riskCategory === 'high_risk' ? 'High Risk' : episode.riskCategory === 'moderate' ? 'Moderate' : 'Routine';

    return {
      consultationNotes: sourceText.trim(),
      documentedEvents: documentedEvents || 'No discrete events extracted. Edit this section to list key events from the note.',
      patientQuestions,
      followUpItems: [],
      handoverNotes: `GA ${episode.gestationalAgeWeeks}w${episode.gestationalAgeDays}d · Risk category: ${riskLabel} · ${openCount} workflow item(s) remain open for the next visit. See consultation notes above for today's encounter summary.`
    };
  };

  const handleGenerateDraft = () => {
    setStage('structuring');
    setIsStructuring(true);
    const t = window.setTimeout(() => {
      setDraft(buildDraft(transcript));
      setIsStructuring(false);
      setStage('review');
    }, 1400);
    timeoutsRef.current.push(t);
  };

  const handleRegenerate = () => {
    setIsEditingDraft(false);
    setStage('structuring');
    setIsStructuring(true);
    const t = window.setTimeout(() => {
      setDraft(buildDraft(transcript));
      setIsStructuring(false);
      setStage('review');
    }, 1000);
    timeoutsRef.current.push(t);
  };

  const handleRejectDraft = () => {
    setDraft(null);
    setIsEditingDraft(false);
    setStage('note');
  };

  // ---- Follow-up item editing ----

  const addFollowUpItem = () => {
    if (!draft) return;
    setDraft({
      ...draft,
      followUpItems: [
        ...draft.followUpItems,
        { id: `FU-${Date.now()}`, text: '', owner: episode.primaryClinician, convertToTask: true }
      ]
    });
  };

  const updateFollowUpItem = (id: string, patch: Partial<FollowUpCommitment>) => {
    if (!draft) return;
    setDraft({
      ...draft,
      followUpItems: draft.followUpItems.map(f => f.id === id ? { ...f, ...patch } : f)
    });
  };

  const removeFollowUpItem = (id: string) => {
    if (!draft) return;
    setDraft({ ...draft, followUpItems: draft.followUpItems.filter(f => f.id !== id) });
  };

  // ---- Step 4: Approve & save ----

  const handleApprove = () => {
    if (!draft) return;
    const now = new Date();
    const approver = episode.primaryClinician;
    const newRecordId = `REC-${Date.now()}`;

    const followUpLines = draft.followUpItems.filter(f => f.text.trim());
    const combinedContent =
`CONSULTATION NOTES
${draft.consultationNotes}

DOCUMENTED EVENTS
${draft.documentedEvents}

PATIENT QUESTIONS DISCUSSED
${draft.patientQuestions}

FOLLOW-UP ITEMS
${followUpLines.length > 0 ? followUpLines.map(f => `- ${f.text} (Owner: ${f.owner})`).join('\n') : 'None documented.'}

HANDOVER NOTE
${draft.handoverNotes}`;

    const trimester: 1 | 2 | 3 = episode.gestationalAgeWeeks < 14 ? 1 : episode.gestationalAgeWeeks < 28 ? 2 : 3;

    const newRecord: PatientRecord = {
      id: newRecordId,
      patientId: episode.id,
      title: `Consultation Documentation — ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      category: 'consultation_note',
      timestamp: now.toISOString(),
      gestationalAgeWeeks: episode.gestationalAgeWeeks,
      gestationalAgeDays: episode.gestationalAgeDays,
      trimester,
      author: approver,
      authorRole: 'Attending Obstetrician',
      facility: episode.facility,
      modality: inputMode === 'voice' ? 'Clinician Voice Dictation (Local Whisper Transcription)' : 'Clinician Typed Consultation Note',
      sourceType: 'Clinician-Authored Encounter Documentation',
      summaryText: draft.consultationNotes.length > 220 ? `${draft.consultationNotes.slice(0, 220)}…` : draft.consultationNotes,
      fullContent: combinedContent,
      sourceId: `CNS-${newRecordId}`,
      tags: ['Consultation', 'Clinician Approved', 'Continuity Linked'],
      isAiStructuredOnly: false,
      verificationStatus: 'verified',
      verifiedBy: approver,
      verifiedAt: now.toISOString(),
      rawPayloadSnippet: transcript
    };

    const newWorkflowItems: PendingWorkflowItem[] = followUpLines
      .filter(f => f.convertToTask)
      .map((f, idx) => ({
        id: `WF-${Date.now()}-${idx}`,
        recordId: newRecordId,
        type: 'follow_up_needed',
        title: f.text.trim(),
        description: `Follow-up commitment documented during consultation on ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.`,
        priority: 'routine',
        status: 'pending',
        assignee: f.owner || 'Care Team',
        sourceContext: `Consultation Note ${newRecordId}`,
        dateCreated: now.toISOString(),
        lastUpdatedAt: now.toISOString(),
        verificationStatus: 'Verified by Clinician'
      }));

    const handoverNote = `${draft.handoverNotes} (Updated ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} by ${approver})`;

    onApproveConsultation({ record: newRecord, newWorkflowItems, handoverNote });
    setSavedSummary({ recordId: newRecordId, taskCount: newWorkflowItems.length });
    setStage('saved');
  };

  const handleStartAnother = () => {
    recorder.reset();
    setTranscript('');
    setDraft(null);
    setTextNoteDraft('');
    setSavedSummary(null);
    setIsEditingDraft(false);
    setStage('workspace');
  };

  const currentStepIndex = stage === 'workspace' ? -1 : STAGE_STEPS.findIndex(s => s.key === stage);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner */}
      <div
        className="glass-panel"
        style={{
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          borderLeft: '4px solid var(--accent-teal)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              background: 'rgba(20, 184, 166, 0.12)',
              color: 'var(--accent-teal)',
              border: '1px solid rgba(20, 184, 166, 0.3)',
              fontSize: '0.72rem',
              padding: '4px 10px',
              borderRadius: '4px',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <User size={14} /> PHASE 3 · ACTIVE CONSULTATION
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={onReturnToTodaysBrief} className="btn-secondary" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ArrowLeft size={14} /> Back to Today's Brief
          </button>
          <button onClick={onNavigateToPhase1} className="btn-secondary" style={{ fontSize: '0.8rem' }}>
            View Phase 1 Context
          </button>
        </div>
      </div>

      {/* Progress Stepper */}
      {stage !== 'workspace' && (
        <div className="glass-panel" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {STAGE_STEPS.map((step, idx) => {
            const isActive = idx === currentStepIndex;
            const isDone = idx < currentStepIndex;
            return (
              <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    background: isActive ? 'var(--accent-teal)' : isDone ? 'rgba(20, 184, 166, 0.12)' : 'var(--bg-tertiary)',
                    color: isActive ? '#ffffff' : isDone ? 'var(--accent-teal)' : 'var(--text-muted)',
                    border: isActive ? 'none' : '1px solid var(--border-color)'
                  }}
                >
                  {isDone ? <CheckCircle2 size={12} /> : <span>{idx + 1}</span>}
                  <span>{step.label}</span>
                </div>
                {idx < STAGE_STEPS.length - 1 && (
                  <div style={{ width: '16px', height: '1px', background: 'var(--border-color)' }} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* STAGE: WORKSPACE (idle) */}
      {stage === 'workspace' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
          <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>
              Document This Consultation
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, maxWidth: '380px', lineHeight: 1.5 }}>
              Dictate a free-form consultation note or type one directly. MaternaSync will transcribe and organize it into a structured draft for your review — nothing is saved until you approve it.
            </p>

            <button
              onClick={handleStartRecording}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                background: 'var(--btn-primary-bg)',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '1rem',
                padding: '16px 36px',
                borderRadius: 'var(--radius-full)',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(15, 118, 110, 0.35)',
                letterSpacing: '0.02em'
              }}
            >
              <Mic size={20} /> Start Recording
            </button>

            <button
              onClick={handleStartTextNote}
              style={{ background: 'none', border: 'none', color: 'var(--accent-teal)', fontSize: '0.825rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Type size={14} /> Type a Note Instead
            </button>

            {recorder.errorMessage && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--rose-urgent)', fontSize: '0.775rem', background: 'var(--rose-urgent-bg)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                <AlertTriangle size={14} /> {recorder.errorMessage}
              </div>
            )}
          </div>

          {/* Approved Today's Brief Context Recap */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {episode.handoffNotes && (
              <div className="glass-panel" style={{ padding: '16px', borderLeft: '4px solid var(--accent-teal)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <Share2 size={16} style={{ color: 'var(--accent-teal)' }} />
                  <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>Current Handover Note</strong>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                  {episode.handoffNotes}
                </p>
              </div>
            )}

            <div className="glass-panel" style={{ padding: '16px', borderLeft: '4px solid var(--purple-ai)', background: 'rgba(109, 79, 166, 0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <MessageSquare size={16} style={{ color: 'var(--purple-ai)' }} />
                <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>Approved Patient Questions ({approvedQuestions.length})</strong>
              </div>
              {approvedQuestions.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>None flagged for this encounter.</p>
              ) : (
                approvedQuestions.map(q => (
                  <p key={q.id} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 6px 0', fontStyle: 'italic' }}>
                    "{q.description}"
                  </p>
                ))
              )}
            </div>

            <div className="glass-panel" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <Calendar size={16} style={{ color: 'var(--amber-pending)' }} />
                <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>Open Care Commitments ({approvedFollowUps.length})</strong>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {approvedFollowUps.map(item => (
                  <div key={item.id} style={{ background: 'var(--bg-tertiary)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.775rem' }}>
                    <strong style={{ color: 'var(--text-primary)', display: 'block' }}>{item.title}</strong>
                    <span style={{ color: 'var(--text-secondary)' }}>{item.description}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <ShieldCheck size={18} style={{ color: 'var(--accent-teal)', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Assistive Documentation Only</strong>
                <span>MaternaSync organizes what you say or type. It does not diagnose, recommend treatment, or interpret clinical risk. You review and approve everything before it is saved.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STAGE: CAPTURE (voice recording or text note entry) */}
      {stage === 'capture' && inputMode === 'voice' && (
        <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <div
            style={{
              width: '96px',
              height: '96px',
              borderRadius: '50%',
              background: recorder.status === 'recording' ? 'rgba(156, 58, 34, 0.12)' : 'rgba(20, 184, 166, 0.12)',
              border: `2px solid ${recorder.status === 'recording' ? 'var(--rose-urgent)' : 'var(--accent-teal)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Mic size={38} style={{ color: recorder.status === 'recording' ? 'var(--rose-urgent)' : 'var(--accent-teal)' }} />
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
              {formatDuration(recorder.durationSeconds)}
            </div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: recorder.status === 'recording' ? 'var(--rose-urgent)' : recorder.status === 'paused' ? 'var(--amber-pending)' : 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'currentColor' }} />
              {recorder.status === 'recording' ? 'Recording' : recorder.status === 'paused' ? 'Paused' : 'Starting…'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {recorder.status === 'recording' && (
              <button onClick={recorder.pause} className="btn-secondary" style={{ fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Pause size={15} /> Pause
              </button>
            )}
            {recorder.status === 'paused' && (
              <button onClick={recorder.resume} className="btn-secondary" style={{ fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mic size={15} /> Resume
              </button>
            )}
            <button
              onClick={handleStopRecording}
              disabled={recorder.status !== 'recording' && recorder.status !== 'paused'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--rose-urgent)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.875rem',
                padding: '9px 20px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <Square size={15} /> Stop & Transcribe
            </button>
            <button onClick={handleReRecord} className="btn-secondary" style={{ fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <RotateCcw size={14} /> Cancel
            </button>
          </div>
        </div>
      )}

      {stage === 'capture' && inputMode === 'text' && (
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Type size={18} style={{ color: 'var(--accent-teal)' }} />
            <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>Type Consultation Note</h3>
          </div>
          <textarea
            value={textNoteDraft}
            onChange={(e) => setTextNoteDraft(e.target.value)}
            rows={12}
            autoFocus
            placeholder="Type your free-form consultation note here…"
            style={{
              width: '100%',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '14px',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.825rem',
              lineHeight: 1.5,
              resize: 'vertical'
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button onClick={handleReRecord} className="btn-secondary" style={{ fontSize: '0.825rem' }}>Cancel</button>
            <button onClick={handleUseTextNote} disabled={!textNoteDraft.trim()} className="btn-primary" style={{ fontSize: '0.825rem' }}>
              Use This Note
            </button>
          </div>
        </div>
      )}

      {/* STAGE: NOTE (transcription review) */}
      {stage === 'note' && (
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} style={{ color: 'var(--accent-teal)' }} />
              <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>
                {inputMode === 'voice' ? 'Whisper Transcription' : 'Clinician Note'}
              </h3>
            </div>
            <span
              style={{
                background: 'var(--amber-pending-bg)',
                color: 'var(--amber-pending)',
                border: '1px solid rgba(154, 91, 46, 0.4)',
                fontSize: '0.68rem',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 800
              }}
            >
              CLINICIAN-PROVIDED / TRANSCRIBED CONTENT
            </span>
          </div>

          {isTranscribing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '24px', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              <RefreshCw size={16} className="spin-slow" style={{ color: 'var(--accent-teal)' }} />
              Transcribing locally with Whisper…
            </div>
          ) : (
            <>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={12}
                style={{
                  width: '100%',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.825rem',
                  lineHeight: 1.5,
                  resize: 'vertical'
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Edit this text so it accurately reflects the encounter before generating a structured draft.
                </span>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={handleReRecord} className="btn-secondary" style={{ fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <RotateCcw size={14} /> Start Over
                  </button>
                  <button onClick={handleGenerateDraft} disabled={!transcript.trim()} className="btn-primary" style={{ fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} /> Generate Structured Draft
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* STAGE: STRUCTURING (loading) */}
      {stage === 'structuring' && (
        <div className="glass-panel" style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <RefreshCw size={28} className="spin-slow" style={{ color: 'var(--accent-teal)' }} />
          <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>Organizing note locally with Ollama…</strong>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Structuring into Consultation Notes, Documented Events, Patient Questions, Follow-up Items, and Handover Notes.</span>
        </div>
      )}

      {/* STAGE: REVIEW (structured draft, human review gate) */}
      {stage === 'review' && draft && !isStructuring && (
        <>
          {/* Human Review Gate Banner */}
          <div
            className="glass-panel"
            style={{
              borderLeft: '4px solid var(--amber-pending)',
              background: 'var(--amber-pending-bg)',
              padding: '12px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShieldCheck size={20} style={{ color: 'var(--amber-pending)' }} />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong style={{ fontSize: '0.9rem', color: 'var(--amber-pending)', letterSpacing: '0.04em' }}>
                    AI ORGANIZES. CLINICIAN REVIEWS.
                  </strong>
                  <span
                    style={{
                      background: 'rgba(154, 91, 46, 0.2)',
                      color: 'var(--amber-pending)',
                      border: '1px solid rgba(154, 91, 46, 0.4)',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '4px'
                    }}
                  >
                    DRAFT / NEEDS REVIEW
                  </span>
                </div>
                <p style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                  This draft only reorganizes your transcription and already-approved records. Nothing is saved until you approve it.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button onClick={() => setIsEditingDraft(!isEditingDraft)} className="btn-secondary" style={{ fontSize: '0.75rem', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Edit3 size={13} /> {isEditingDraft ? 'Finish Editing' : 'Edit Draft'}
              </button>
              <button onClick={handleRegenerate} className="btn-secondary" style={{ fontSize: '0.75rem', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <RefreshCw size={13} /> Regenerate
              </button>
              <button onClick={handleRejectDraft} className="btn-secondary" style={{ fontSize: '0.75rem', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--rose-urgent)' }}>
                <X size={13} /> Reject
              </button>
              <button onClick={() => setIsSourceModalOpen(true)} className="btn-secondary" style={{ fontSize: '0.75rem', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Eye size={13} /> View Source
              </button>
            </div>
          </div>

          {/* Draft Sections */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <DraftSectionCard
                icon={<FileText size={16} style={{ color: 'var(--accent-teal)' }} />}
                title="Consultation Notes"
                value={draft.consultationNotes}
                isEditing={isEditingDraft}
                onChange={(v) => setDraft({ ...draft, consultationNotes: v })}
              />
              <DraftSectionCard
                icon={<ListChecks size={16} style={{ color: 'var(--accent-cyan)' }} />}
                title="Documented Events"
                value={draft.documentedEvents}
                isEditing={isEditingDraft}
                onChange={(v) => setDraft({ ...draft, documentedEvents: v })}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <DraftSectionCard
                icon={<MessageSquare size={16} style={{ color: 'var(--purple-ai)' }} />}
                title="Patient Questions"
                value={draft.patientQuestions}
                isEditing={isEditingDraft}
                onChange={(v) => setDraft({ ...draft, patientQuestions: v })}
                accent="var(--purple-ai)"
              />
              <DraftSectionCard
                icon={<Share2 size={16} style={{ color: 'var(--amber-pending)' }} />}
                title="Handover Notes"
                value={draft.handoverNotes}
                isEditing={isEditingDraft}
                onChange={(v) => setDraft({ ...draft, handoverNotes: v })}
                accent="var(--amber-pending)"
              />
            </div>
          </div>

          {/* Follow-up Items (explicit, checkbox-gated task conversion) */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={18} style={{ color: 'var(--emerald-raw)' }} />
                <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>Follow-up Items</h3>
              </div>
              <button onClick={addFollowUpItem} className="btn-secondary" style={{ fontSize: '0.75rem', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Plus size={13} /> Add Follow-up Item
              </button>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 12px 0' }}>
              Only checked items become workflow tasks when you approve & save.
            </p>

            {draft.followUpItems.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                No follow-up commitments added yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {draft.followUpItems.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-tertiary)', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <input
                      type="checkbox"
                      checked={item.convertToTask}
                      onChange={(e) => updateFollowUpItem(item.id, { convertToTask: e.target.checked })}
                      title="Create as workflow task"
                      style={{ width: '16px', height: '16px', cursor: 'pointer', flexShrink: 0 }}
                    />
                    <input
                      type="text"
                      value={item.text}
                      onChange={(e) => updateFollowUpItem(item.id, { text: e.target.value })}
                      placeholder="Follow-up commitment…"
                      style={{ flex: 2, minWidth: '160px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '6px 10px', color: 'var(--text-primary)', fontSize: '0.825rem' }}
                    />
                    <input
                      type="text"
                      value={item.owner}
                      onChange={(e) => updateFollowUpItem(item.id, { owner: e.target.value })}
                      placeholder="Owner"
                      style={{ flex: 1, minWidth: '120px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '6px 10px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}
                    />
                    <button onClick={() => removeFollowUpItem(item.id)} style={{ background: 'none', border: 'none', color: 'var(--rose-urgent)', cursor: 'pointer', flexShrink: 0 }} title="Remove">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Safety Notice */}
          <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <ShieldCheck size={18} style={{ color: 'var(--emerald-raw)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Clinician Approval Required</strong>
              <span>All clinical decisions, diagnoses, and orders remain 100% under the direction of the attending care provider. Approving this draft saves it exactly as written below.</span>
            </div>
          </div>

          {/* Approve & Save */}
          <div className="glass-panel" style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', background: 'var(--bg-secondary)' }}>
            <button
              onClick={handleApprove}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                background: 'var(--btn-primary-bg)',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.95rem',
                padding: '12px 28px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                cursor: 'pointer',
                letterSpacing: '0.02em'
              }}
            >
              <ClipboardCheck size={18} />
              <span>Approve & Save to Timeline</span>
            </button>
          </div>
        </>
      )}

      {/* STAGE: SAVED (confirmation) */}
      {stage === 'saved' && savedSummary && (
        <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--emerald-raw-bg)', border: '1px solid var(--emerald-raw-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={32} style={{ color: 'var(--emerald-raw)' }} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', margin: '0 0 6px 0', fontWeight: 800 }}>
              Consultation Documentation Approved & Saved
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, maxWidth: '460px' }}>
              Record {savedSummary.recordId} has been added to {episode.patientName}'s chronological timeline under clinician approval.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', width: '100%', maxWidth: '640px' }}>
            {[
              { icon: <Clock size={16} style={{ color: 'var(--accent-cyan)' }} />, label: 'Patient Timeline Updated' },
              { icon: <Workflow size={16} style={{ color: 'var(--accent-teal)' }} />, label: 'Linked to Continuity Graph' },
              { icon: <ListChecks size={16} style={{ color: 'var(--emerald-raw)' }} />, label: `${savedSummary.taskCount} Workflow Task(s) Created` },
              { icon: <Share2 size={16} style={{ color: 'var(--amber-pending)' }} />, label: 'Handover Context Updated' }
            ].map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-tertiary)', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '0.775rem', color: 'var(--text-primary)' }}>
                {item.icon}
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={handleStartAnother} className="btn-secondary" style={{ fontSize: '0.825rem' }}>
              Document Another Note
            </button>
            <button onClick={onReturnToTodaysBrief} className="btn-secondary" style={{ fontSize: '0.825rem' }}>
              Back to Today's Brief
            </button>
            <button onClick={onNavigateToWorkflow} className="btn-primary" style={{ fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Go to Workflow Management <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Source Traceability Modal */}
      {isSourceModalOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(6px)', zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={() => setIsSourceModalOpen(false)}
        >
          <div
            className="glass-panel animate-fade-in"
            style={{ width: '100%', maxWidth: '680px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-secondary)', border: '1px solid var(--border-highlight)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-tertiary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Lock size={16} style={{ color: 'var(--accent-teal)' }} />
                <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>Source Traceability Inspector</strong>
              </div>
              <button onClick={() => setIsSourceModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', background: 'var(--bg-tertiary)', padding: '12px', borderRadius: 'var(--radius-md)', fontSize: '0.775rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>INPUT MODE</span>
                  <strong style={{ color: 'var(--accent-teal)' }}>{inputMode === 'voice' ? 'Voice Dictation' : 'Typed Note'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>CAPTURED AT</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{capturedAt ? new Date(capturedAt).toLocaleString() : '—'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>AUTHOR</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{episode.primaryClinician}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>APPROVAL STATUS</span>
                  <strong style={{ color: 'var(--amber-pending)' }}>DRAFT / NEEDS REVIEW</strong>
                </div>
              </div>

              {inputMode === 'voice' && recorder.audioUrl && (
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <Volume2 size={14} /> Original Recording
                  </span>
                  <audio controls src={recorder.audioUrl} style={{ width: '100%' }} />
                </div>
              )}

              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  Original Transcription / Note Text
                </span>
                <div style={{ background: 'var(--bg-primary)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5, maxHeight: '220px', overflowY: 'auto' }}>
                  {transcript}
                </div>
              </div>
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', background: 'var(--bg-tertiary)' }}>
              <button onClick={() => setIsSourceModalOpen(false)} className="btn-secondary" style={{ fontSize: '0.8rem' }}>
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface DraftSectionCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  isEditing: boolean;
  onChange: (value: string) => void;
  accent?: string;
}

const DraftSectionCard: React.FC<DraftSectionCardProps> = ({ icon, title, value, isEditing, onChange, accent }) => (
  <div className="glass-panel" style={{ padding: '18px', borderLeft: accent ? `4px solid ${accent}` : undefined }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
      {icon}
      <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{title}</strong>
    </div>
    {isEditing ? (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '8px', color: 'var(--text-primary)', fontSize: '0.825rem', lineHeight: 1.45 }}
      />
    ) : (
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
        {value}
      </p>
    )}
  </div>
);
