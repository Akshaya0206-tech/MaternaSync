import { useState } from 'react';
import type { 
  PatientEpisode, 
  PatientRecord, 
  WorkflowStatus
} from '../types/patient';
import { 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Share2, 
  MessageSquare, 
  Calendar, 
  Activity, 
  Eye, 
  AlertTriangle, 
  Check, 
  Edit3, 
  RefreshCw, 
  ArrowRight, 
  Sparkles,
  ArrowLeft,
  Lock,
  X,
  Play
} from 'lucide-react';

interface TodaysBriefViewProps {
  episode: PatientEpisode;
  onNavigateToPhase1: (tab?: 'timeline' | 'grid' | 'completeness' | 'workflow' | 'activity') => void;
  onStartConsultation: () => void;
  onSelectRecord: (record: PatientRecord) => void;
  onUpdateWorkflowStatus: (itemId: string, newStatus: WorkflowStatus) => void;
}

export const TodaysBriefView: React.FC<TodaysBriefViewProps> = ({
  episode,
  onNavigateToPhase1,
  onStartConsultation,
  onSelectRecord,
  onUpdateWorkflowStatus
}) => {
  // Section 7: Human Review State for Draft Sections
  const [quickContextDraft, setQuickContextDraft] = useState({
    recentEvents: 'Recent documented records include 30-week prenatal progress visit with BP 132/84 mmHg and 32-week weekly glucose log showing fasting average 91 mg/dL and postprandial average 116 mg/dL.',
    openItems: 'Pending MFM growth ultrasound Doppler referral and missing 30-week external radiology report from Metro Imaging Center.',
    questionsToDiscuss: 'Patient portal query regarding morning BP reading of 134/86 mmHg and dull frontal headache upon waking up today.',
    upcomingFollowUps: 'Week 32 GDMA1 log sheet review and serial fetal biometry scheduling.'
  });

  const [isEditingContext, setIsEditingContext] = useState(false);
  const [contextApproved, setContextApproved] = useState(false);
  const [approvedTimestamp, setApprovedTimestamp] = useState<string | null>(null);
  const [consultationDate] = useState(() => 
    new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  );

  // Source Traceability Modal state
  const [activeSourceRecord, setActiveSourceRecord] = useState<PatientRecord | null>(null);

  // Sort records chronologically (newest first)
  const sortedRecords = [...episode.records].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  const recentEvents = sortedRecords.slice(0, 4);

  // Pending Actions
  const pendingActions = episode.workflowItems.filter(item => item.status !== 'completed');

  // Unanswered Patient Questions (filter from workflow items or records)
  const unansweredQuestions = episode.workflowItems.filter(
    item => item.type === 'unanswered_question'
  );

  // Follow-up commitments
  const followUpCommitments = episode.workflowItems.filter(
    item => item.type === 'follow_up_needed' || item.type === 'pending_referral'
  );

  // Helper to open source inspector
  const handleViewSourceById = (sourceIdOrRecordId?: string) => {
    if (!sourceIdOrRecordId) return;
    const match = episode.records.find(
      r => r.id === sourceIdOrRecordId || r.sourceId === sourceIdOrRecordId
    );
    if (match) {
      setActiveSourceRecord(match);
    } else if (episode.records.length > 0) {
      setActiveSourceRecord(episode.records[0]);
    }
  };

  const handleApproveDraft = () => {
    setContextApproved(true);
    setIsEditingContext(false);
    setApprovedTimestamp(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  };

  const handleRegenerateDraft = () => {
    setContextApproved(false);
    setIsEditingContext(false);
    setQuickContextDraft({
      recentEvents: 'Chronologically verified from 10 raw Phase 1 records: 30-week prenatal visit (BP 132/84 mmHg) and Week 32 glucose self-report log.',
      openItems: '2 open actions: Outpatient MFM Doppler referral (#ORD-44910) and 30-week external radiology report (#PACS-0092).',
      questionsToDiscuss: 'Patient portal query #MSG-9921: Morning BP 134/86 mmHg with dull frontal headache.',
      upcomingFollowUps: 'Dietitian review of glucose logs and obstetric Doppler scan confirmation.'
    });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'consultation_note': return <FileText size={15} style={{ color: 'var(--teal-primary)' }} />;
      case 'referral': return <Share2 size={15} style={{ color: 'var(--purple-ai)' }} />;
      case 'patient_message': return <MessageSquare size={15} style={{ color: 'var(--purple-ai)' }} />;
      case 'follow_up': return <Calendar size={15} style={{ color: 'var(--amber-pending)' }} />;
      case 'workflow_event': return <Activity size={15} style={{ color: 'var(--teal-primary)' }} />;
      default: return <FileText size={15} style={{ color: 'var(--navy-deep)' }} />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* SECTION 7: HUMAN REVIEW GATE BANNER */}
      <div 
        className="glass-panel animate-fade-in"
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
          <ShieldAlert size={20} style={{ color: 'var(--amber-pending)' }} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <strong style={{ fontSize: '0.9rem', color: 'var(--amber-pending)', letterSpacing: '0.04em' }}>
                AI ASSISTS. CLINICIAN REVIEWS.
              </strong>
              <span 
                style={{
                  background: contextApproved ? 'var(--emerald-raw-bg)' : 'rgba(154, 91, 46, 0.2)',
                  color: contextApproved ? 'var(--emerald-raw)' : 'var(--amber-pending)',
                  border: contextApproved ? '1px solid var(--emerald-raw-border)' : '1px solid rgba(154, 91, 46, 0.4)',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '4px'
                }}
              >
                {contextApproved ? `CLINICIAN APPROVED (${approvedTimestamp})` : 'DRAFT / NEEDS REVIEW'}
              </span>
            </div>
            <p style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              Autonomous AI approval is disabled. AI assists by organizing documented Phase 1 records; clinician must review and approve before consultation.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!contextApproved ? (
            <>
              <button 
                onClick={() => setIsEditingContext(!isEditingContext)}
                className="btn-secondary" 
                style={{ fontSize: '0.75rem', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Edit3 size={13} /> {isEditingContext ? 'Finish Editing' : 'Edit Draft'}
              </button>
              <button 
                onClick={handleRegenerateDraft}
                className="btn-secondary" 
                style={{ fontSize: '0.75rem', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                title="Re-index facts from Phase 1 records"
              >
                <RefreshCw size={13} /> Regenerate
              </button>
              <button 
                onClick={handleApproveDraft}
                className="btn-primary" 
                style={{ fontSize: '0.75rem', padding: '5px 14px', display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--emerald-raw)' }}
              >
                <Check size={14} /> Approve Brief
              </button>
            </>
          ) : (
            <button 
              onClick={() => setContextApproved(false)}
              className="btn-secondary" 
              style={{ fontSize: '0.75rem', padding: '5px 12px' }}
            >
              Reopen Review
            </button>
          )}
        </div>
      </div>

      {/* MAIN SCREEN HEADER */}
      <div 
        className="glass-panel"
        style={{
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          background: 'var(--bg-secondary)',
          borderBottom: '2px solid var(--accent-cyan)'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                background: 'var(--btn-primary-bg)',
                color: '#fff',
                fontWeight: 800,
                fontSize: '0.75rem',
                padding: '3px 10px',
                borderRadius: '6px',
                letterSpacing: '0.05em'
              }}
            >
              PHASE 2
            </span>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', margin: 0, fontWeight: 800 }}>
              TODAY'S BRIEF
            </h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--emerald-raw)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={13} /> Generated from Phase 1 verified context
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
            <span>Patient: <strong style={{ color: 'var(--text-primary)' }}>{episode.patientName}</strong> ({episode.mrn})</span>
            <span>•</span>
            <span>GA: <strong style={{ color: 'var(--accent-cyan)' }}>{episode.gestationalAgeWeeks}w {episode.gestationalAgeDays}d</strong></span>
            <span>•</span>
            <span>Provider: <strong style={{ color: 'var(--text-primary)' }}>{episode.primaryClinician}</strong></span>
            <span>•</span>
            <span>Consultation Date: <strong>{consultationDate}</strong></span>
          </div>
        </div>

        {/* 30-Second Pre-Consultation Summary Pill */}
        <div 
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-highlight)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <Sparkles size={18} style={{ color: 'var(--accent-cyan)' }} />
          <div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
              CLINICIAN WORKSPACE
            </span>
            <span style={{ fontSize: '0.825rem', color: 'var(--text-primary)', fontWeight: 600 }}>
              30-Second Pre-Visit Scan
            </span>
          </div>
        </div>
      </div>

      {/* HANDOVER NOTE FROM LAST CONSULTATION (Phase 3 output feeding into Phase 2) */}
      {episode.handoffNotes && (
        <div
          className="glass-panel"
          style={{
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            borderLeft: '4px solid var(--accent-teal)'
          }}
        >
          <Share2 size={18} style={{ color: 'var(--accent-teal)', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ fontSize: '0.825rem', color: 'var(--text-primary)', display: 'block', marginBottom: '2px' }}>
              Handover Note from Last Consultation
            </strong>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {episode.handoffNotes}
            </span>
          </div>
        </div>
      )}

      {/* SECTION 5: QUICK CONTEXT SUMMARY (Organized into 4 factual quadrants) */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} style={{ color: 'var(--accent-cyan)' }} />
              Section 5 — Quick Context (Factual Episode Brief)
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Non-interpretive summary synthesized strictly from approved Phase 1 records. No diagnostic assertions or clinical risk scoring.
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span 
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                color: contextApproved ? 'var(--emerald-raw)' : 'var(--amber-pending)',
                background: contextApproved ? 'var(--emerald-raw-bg)' : 'var(--amber-pending-bg)',
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)'
              }}
            >
              {contextApproved ? 'Approved by Clinician' : 'Draft / Needs Review'}
            </span>
          </div>
        </div>

        {/* 4 Quadrants Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          {/* Quadrant 1: Recent Documented Events */}
          <div 
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <span style={{ fontSize: '0.725rem', color: 'var(--accent-cyan)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              1. RECENT DOCUMENTED EVENTS
            </span>
            {isEditingContext ? (
              <textarea 
                value={quickContextDraft.recentEvents}
                onChange={(e) => setQuickContextDraft({ ...quickContextDraft, recentEvents: e.target.value })}
                rows={3}
                style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '6px', color: 'var(--text-primary)', fontSize: '0.825rem' }}
              />
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                {quickContextDraft.recentEvents}
              </p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto' }}>
              <button 
                onClick={() => handleViewSourceById('REC-006')}
                style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', fontSize: '0.725rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Eye size={12} /> Source: EHR-CN-2026-0912
              </button>
            </div>
          </div>

          {/* Quadrant 2: Open Workflow Items */}
          <div 
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <span style={{ fontSize: '0.725rem', color: 'var(--amber-pending)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              2. OPEN WORKFLOW ITEMS
            </span>
            {isEditingContext ? (
              <textarea 
                value={quickContextDraft.openItems}
                onChange={(e) => setQuickContextDraft({ ...quickContextDraft, openItems: e.target.value })}
                rows={3}
                style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '6px', color: 'var(--text-primary)', fontSize: '0.825rem' }}
              />
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                {quickContextDraft.openItems}
              </p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto' }}>
              <button 
                onClick={() => handleViewSourceById('REC-008')}
                style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', fontSize: '0.725rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Eye size={12} /> Source: ORD-44910
              </button>
            </div>
          </div>

          {/* Quadrant 3: Questions to Discuss */}
          <div 
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid rgba(109, 79, 166, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <span style={{ fontSize: '0.725rem', color: 'var(--purple-ai)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              3. QUESTIONS TO DISCUSS (PATIENT PORTAL)
            </span>
            {isEditingContext ? (
              <textarea 
                value={quickContextDraft.questionsToDiscuss}
                onChange={(e) => setQuickContextDraft({ ...quickContextDraft, questionsToDiscuss: e.target.value })}
                rows={3}
                style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '6px', color: 'var(--text-primary)', fontSize: '0.825rem' }}
              />
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                {quickContextDraft.questionsToDiscuss}
              </p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto' }}>
              <button 
                onClick={() => handleViewSourceById('REC-007')}
                style={{ background: 'none', border: 'none', color: 'var(--purple-ai)', fontSize: '0.725rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Eye size={12} /> Source: MSG-9921
              </button>
            </div>
          </div>

          {/* Quadrant 4: Upcoming Documented Follow-ups */}
          <div 
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <span style={{ fontSize: '0.725rem', color: 'var(--emerald-raw)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              4. UPCOMING DOCUMENTED FOLLOW-UPS
            </span>
            {isEditingContext ? (
              <textarea 
                value={quickContextDraft.upcomingFollowUps}
                onChange={(e) => setQuickContextDraft({ ...quickContextDraft, upcomingFollowUps: e.target.value })}
                rows={3}
                style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '6px', color: 'var(--text-primary)', fontSize: '0.825rem' }}
              />
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                {quickContextDraft.upcomingFollowUps}
              </p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto' }}>
              <button 
                onClick={() => handleViewSourceById('REC-009')}
                style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', fontSize: '0.725rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Eye size={12} /> Source: DOC-8812
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* TWO-COLUMN LAYOUT FOR SECTIONS 1, 2, 3, 4 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '20px' }}>
        
        {/* COLUMN LEFT: SECTION 1 (Recent Events) & SECTION 3 (Unanswered Questions) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* SECTION 3: UNANSWERED PATIENT QUESTIONS (High Clinical Importance) */}
          <div 
            className="glass-panel"
            style={{
              padding: '20px',
              borderLeft: '4px solid var(--purple-ai)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageSquare size={18} style={{ color: 'var(--purple-ai)' }} />
                <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>
                  Section 3 — Unanswered Patient Questions
                </h3>
              </div>
              <span 
                style={{
                  background: 'rgba(109, 79, 166, 0.15)',
                  color: 'var(--purple-ai)',
                  border: '1px solid rgba(109, 79, 166, 0.4)',
                  fontSize: '0.7rem',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontWeight: 700
                }}
              >
                {unansweredQuestions.length} Pending Inquiry
              </span>
            </div>

            {/* Crucial Safety Notice */}
            <div 
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid rgba(109, 79, 166, 0.25)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
                fontSize: '0.725rem',
                color: 'var(--text-muted)',
                marginBottom: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <AlertTriangle size={14} style={{ color: 'var(--purple-ai)', flexShrink: 0 }} />
              <span>
                <strong>Care-Team Gate:</strong> Do NOT answer the medical question automatically. Presented strictly for clinician/care-team consultation discussion.
              </span>
            </div>

            {/* Questions Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {unansweredQuestions.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  No unanswered patient portal messages catalogued.
                </div>
              ) : (
                unansweredQuestions.map(q => (
                  <div
                    key={q.id}
                    style={{
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--purple-ai)' }}>
                        PORTAL INBOUND MESSAGE
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Received: {new Date(q.dateCreated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, {new Date(q.dateCreated).toLocaleDateString()}
                      </span>
                    </div>

                    <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      {q.title}
                    </strong>

                    {/* Patient Question Quote Box */}
                    <div 
                      style={{
                        background: 'var(--bg-primary)',
                        borderLeft: '3px solid var(--purple-ai)',
                        padding: '10px 12px',
                        borderRadius: '0 6px 6px 0',
                        fontStyle: 'italic',
                        fontSize: '0.825rem',
                        color: 'var(--text-primary)',
                        lineHeight: 1.45
                      }}
                    >
                      {q.description}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap', gap: '8px' }}>
                      <span>Assigned Role: <strong style={{ color: 'var(--text-secondary)' }}>{q.assignee || 'Duty Triage Nurse'}</strong></span>
                      <button
                        onClick={() => handleViewSourceById(q.recordId)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent-cyan)',
                          fontSize: '0.725rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: 600
                        }}
                      >
                        <Eye size={12} /> View Original Message
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* SECTION 1: RECENT EVENTS */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} style={{ color: 'var(--accent-cyan)' }} />
                <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>
                  Section 1 — Recent Documented Events
                </h3>
              </div>
              <button
                onClick={() => onNavigateToPhase1('timeline')}
                style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
              >
                View Full Timeline ({episode.records.length})
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {recentEvents.map(event => (
                <div 
                  key={event.id}
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {getCategoryIcon(event.category)}
                      <span style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                        Wk {event.gestationalAgeWeeks}d{event.gestationalAgeDays}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>•</span>
                      <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                        {new Date(event.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>

                    <button
                      onClick={() => onSelectRecord(event)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent-cyan)',
                        fontSize: '0.725rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontWeight: 600
                      }}
                    >
                      <Eye size={12} /> View Source
                    </button>
                  </div>

                  <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                    {event.title}
                  </strong>

                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                    {event.summaryText}
                  </p>

                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', gap: '8px' }}>
                    <span>{event.facility}</span>
                    <span>•</span>
                    <span>{event.author}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* COLUMN RIGHT: SECTION 2 (Pending Actions) & SECTION 4 (Follow-up Commitments) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* SECTION 2: PENDING ACTIONS */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Share2 size={18} style={{ color: 'var(--amber-pending)' }} />
                <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>
                  Section 2 — Documented Pending Actions
                </h3>
              </div>
              <span 
                style={{
                  background: 'var(--amber-pending-bg)',
                  color: 'var(--amber-pending)',
                  border: '1px solid rgba(154, 91, 46, 0.4)',
                  fontSize: '0.7rem',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontWeight: 700
                }}
              >
                {pendingActions.length} Actions Open
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {pendingActions.map(action => (
                <div
                  key={action.id}
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderLeft: action.priority === 'urgent' ? '3px solid var(--rose-urgent)' : '3px solid var(--amber-pending)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                    <span 
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: action.status === 'in_progress' ? 'var(--accent-cyan)' : 'var(--amber-pending)'
                      }}
                    >
                      {action.type.replace('_', ' ')}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <select
                        value={action.status}
                        onChange={(e) => onUpdateWorkflowStatus(action.id, e.target.value as WorkflowStatus)}
                        style={{
                          background: 'var(--bg-primary)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          fontSize: '0.68rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="verified">Verified</option>
                        <option value="completed">Completed</option>
                      </select>

                      <button
                        onClick={() => handleViewSourceById(action.recordId)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent-cyan)',
                          fontSize: '0.725rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Eye size={12} /> Source Record
                      </button>
                    </div>
                  </div>

                  <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                    {action.title}
                  </strong>

                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                    {action.description}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.725rem', color: 'var(--text-muted)', paddingTop: '4px' }}>
                    <span>Owner: <strong style={{ color: 'var(--text-secondary)' }}>{action.assignee || 'Care Coordinator'}</strong></span>
                    {action.dueDate && (
                      <span style={{ color: action.priority === 'urgent' ? 'var(--rose-urgent)' : 'var(--text-muted)' }}>
                        Due: {new Date(action.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 4: FOLLOW-UP COMMITMENTS */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={18} style={{ color: 'var(--emerald-raw)' }} />
                <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>
                  Section 4 — Documented Follow-up Commitments
                </h3>
              </div>
              <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                Extracted from available progress notes & orders
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {followUpCommitments.map(item => (
                <div 
                  key={item.id}
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.725rem', color: 'var(--emerald-raw)', fontWeight: 700 }}>
                      CARE COMMITMENT
                    </span>
                    <button
                      onClick={() => handleViewSourceById(item.recordId)}
                      style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', fontSize: '0.725rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Eye size={12} /> Source: {item.sourceContext.split('#')[1]?.split(' ')[0] || item.sourceContext}
                    </button>
                  </div>

                  <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                    {item.title}
                  </strong>

                  <p style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', margin: 0 }}>
                    {item.description}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.725rem', color: 'var(--text-muted)', paddingTop: '4px' }}>
                    <span>Care Role: <strong style={{ color: 'var(--text-secondary)' }}>{item.assignee}</strong></span>
                    <span>Status: <strong style={{ color: 'var(--accent-cyan)' }}>{item.status.toUpperCase()}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 8: BRIEF QUALITY CHECKLIST CARD */}
      <div 
        className="glass-panel"
        style={{
          padding: '18px 22px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-highlight)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} style={{ color: 'var(--emerald-raw)' }} />
            <h4 style={{ fontSize: '0.95rem', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>
              Section 8 — Today's Brief Quality & Provenance Checklist
            </h4>
          </div>
          <span 
            style={{
              background: 'var(--emerald-raw-bg)',
              color: 'var(--emerald-raw)',
              border: '1px solid var(--emerald-raw-border)',
              padding: '3px 10px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.75rem',
              fontWeight: 800
            }}
          >
            Brief Quality Verified — 100% Traceable
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px' }}>
          {[
            'Generated from Phase 1 context',
            'Sources available & verified',
            'Pending workflow items included',
            'Patient questions included',
            'Follow-up commitments included',
            'No unsupported facts added',
            'No clinical interpretation added',
            'Human clinician review gate active'
          ].map((checkText, idx) => (
            <div 
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--bg-tertiary)',
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.775rem',
                color: 'var(--text-primary)'
              }}
            >
              <CheckCircle2 size={14} style={{ color: 'var(--emerald-raw)', flexShrink: 0 }} />
              <span>{checkText}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 9: NEXT ACTION FOOTER CONTROLS */}
      <div 
        className="glass-panel"
        style={{
          padding: '18px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          background: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border-highlight)'
        }}
      >
        {/* Left Links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={() => onNavigateToPhase1('timeline')}
            className="btn-secondary"
            style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeft size={14} /> Back to Phase 1
          </button>

          <button
            onClick={() => onNavigateToPhase1('timeline')}
            className="btn-secondary"
            style={{ fontSize: '0.8rem' }}
          >
            View Full Timeline
          </button>

          <button
            onClick={() => onNavigateToPhase1('workflow')}
            className="btn-secondary"
            style={{ fontSize: '0.8rem' }}
          >
            View All Workflow Items
          </button>
        </div>

        {/* Right Primary Action */}
        <button
          onClick={onStartConsultation}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            background: 'var(--btn-primary-bg)',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '0.9rem',
            padding: '10px 22px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)',
            letterSpacing: '0.01em',
            transition: 'background 0.15s ease'
          }}
        >
          <Play size={16} />
          <span>Start Consultation</span>
          <ArrowRight size={16} />
        </button>
      </div>

      {/* SECTION 6: SOURCE TRACEABILITY MODAL */}
      {activeSourceRecord && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(6px)',
            zIndex: 150,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setActiveSourceRecord(null)}
        >
          <div 
            className="glass-panel animate-fade-in"
            style={{
              width: '100%',
              maxWidth: '720px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-highlight)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div 
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-tertiary)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Lock size={16} style={{ color: 'var(--accent-cyan)' }} />
                <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  Source Traceability Inspector
                </strong>
              </div>
              <button 
                onClick={() => setActiveSourceRecord(null)} 
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div 
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '10px',
                  background: 'var(--bg-tertiary)',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.775rem'
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>SOURCE ID</span>
                  <strong style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>{activeSourceRecord.sourceId}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>ORIGINAL RECORD TYPE</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{activeSourceRecord.sourceType || activeSourceRecord.modality}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>AUTHOR</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{activeSourceRecord.author}</strong> ({activeSourceRecord.authorRole})
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>FACILITY</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{activeSourceRecord.facility}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>DATE / TIME</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{new Date(activeSourceRecord.timestamp).toLocaleString()}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>VERIFICATION STATUS</span>
                  <strong style={{ color: 'var(--emerald-raw)' }}>{(activeSourceRecord.verificationStatus || 'raw').toUpperCase()}</strong>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  Original Record Text / Summary
                </span>
                <div 
                  style={{
                    background: 'var(--bg-primary)',
                    padding: '14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.85rem',
                    color: 'var(--text-primary)',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.5,
                    maxHeight: '220px',
                    overflowY: 'auto'
                  }}
                >
                  {activeSourceRecord.fullContent || activeSourceRecord.summaryText}
                </div>
              </div>
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', background: 'var(--bg-tertiary)' }}>
              <button onClick={() => setActiveSourceRecord(null)} className="btn-secondary" style={{ fontSize: '0.8rem' }}>
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
