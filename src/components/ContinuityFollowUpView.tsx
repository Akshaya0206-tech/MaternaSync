import { useMemo, useState } from 'react';
import type {
  PatientEpisode,
  PatientRecord,
  PendingWorkflowItem,
  WorkflowStatus,
  ActivityLogEntry
} from '../types/patient';
import {
  ArrowLeft,
  ArrowRight,
  ListChecks,
  CalendarClock,
  ClipboardCheck,
  Network,
  Eye,
  Check,
  Users,
  FileText,
  MessageSquare,
  Share2,
  CheckCircle2,
  X,
  PackageCheck,
  CalendarCheck,
  History,
  Stethoscope
} from 'lucide-react';

interface ContinuityFollowUpViewProps {
  episode: PatientEpisode;
  onReturnToTodaysBrief: () => void;
  onNavigateToPhase1: () => void;
  onNavigateToWorkflow: () => void;
  onSelectRecord: (record: PatientRecord) => void;
  onUpdateWorkflowStatus: (itemId: string, newStatus: WorkflowStatus) => void;
  onPrepareNextVisit: (summary: string, handoverNote: string) => void;
  onCreateTransitionPack: (summary: string) => void;
}

const STATUS_META: Record<WorkflowStatus, { label: string; bg: string; color: string; border: string }> = {
  pending: { label: 'Pending', bg: 'var(--amber-pending-bg)', color: 'var(--amber-pending)', border: 'rgba(154, 91, 46, 0.35)' },
  in_progress: { label: 'In Progress', bg: 'rgba(23, 50, 77, 0.12)', color: 'var(--navy-deep)', border: 'rgba(23, 50, 77, 0.3)' },
  scheduled: { label: 'Scheduled', bg: 'rgba(23, 50, 77, 0.12)', color: 'var(--navy-deep)', border: 'rgba(37, 99, 235, 0.3)' },
  verified: { label: 'Verified', bg: 'var(--emerald-raw-bg)', color: 'var(--emerald-raw)', border: 'var(--emerald-raw-border)' },
  completed: { label: 'Completed', bg: 'var(--emerald-raw-bg)', color: 'var(--emerald-raw)', border: 'var(--emerald-raw-border)' }
};

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const MILESTONE_ACTIONS = new Set([
  'phase1_handoff', 'consultation_approved', 'handover_updated',
  'workflow_reviewed', 'next_visit_prepared', 'transition_pack_created'
]);

export const ContinuityFollowUpView: React.FC<ContinuityFollowUpViewProps> = ({
  episode,
  onReturnToTodaysBrief,
  onNavigateToPhase1,
  onNavigateToWorkflow,
  onSelectRecord,
  onUpdateWorkflowStatus,
  onPrepareNextVisit,
  onCreateTransitionPack
}) => {
  const [nowTs] = useState(() => Date.now());
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState(false);
  const [isTransitionModalOpen, setIsTransitionModalOpen] = useState(false);
  const [transitionApproved, setTransitionApproved] = useState(false);
  const [nextVisitConfirmation, setNextVisitConfirmation] = useState<string | null>(null);

  const openItems = useMemo(
    () => episode.workflowItems.filter(i => i.status !== 'completed'),
    [episode.workflowItems]
  );
  const completedItems = useMemo(
    () => episode.workflowItems.filter(i => i.status === 'completed'),
    [episode.workflowItems]
  );
  const upcomingItems = useMemo(() => {
    return openItems
      .filter(i => i.dueDate && new Date(i.dueDate).getTime() >= nowTs)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
  }, [openItems, nowTs]);

  const newQuestions = openItems.filter(i => i.type === 'unanswered_question');

  const consultationRecords = useMemo(
    () => [...episode.records]
      .filter(r => r.category === 'consultation_note')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [episode.records]
  );
  const latestVisit = consultationRecords[0];
  const previousVisit = consultationRecords[1];

  const newRecordsSincePrevious = useMemo(() => {
    const cutoff = previousVisit ? new Date(previousVisit.timestamp).getTime() : new Date(episode.episodeStartDate).getTime();
    return episode.records
      .filter(r => new Date(r.timestamp).getTime() > cutoff && (r.verificationStatus === 'verified' || r.verificationStatus === 'ready_for_context'))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [episode.records, episode.episodeStartDate, previousVisit]);

  const ownerCounts = useMemo(() => {
    const map = new Map<string, number>();
    openItems.forEach(i => {
      const owner = i.assignee || 'Unassigned';
      map.set(owner, (map.get(owner) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [openItems]);

  const recentUpdatesCount = useMemo(() => {
    const sevenDaysAgo = nowTs - 7 * 24 * 60 * 60 * 1000;
    return (episode.activityLogs || []).filter(l => new Date(l.timestamp).getTime() >= sevenDaysAgo).length;
  }, [episode.activityLogs, nowTs]);

  // ---- Continuity Graph aggregate ----
  const referralCount = openItems.filter(i => i.type === 'pending_referral').length;
  const questionCount = openItems.filter(i => i.type === 'unanswered_question').length;
  const taskCount = openItems.filter(i => i.type === 'required_document' || i.type === 'follow_up_needed').length;
  const ownerCount = ownerCounts.length;

  // ---- Care Journey Timeline (merged milestones) ----
  const journeyMilestones = useMemo(() => {
    type Milestone = { id: string; timestamp: string; label: string; detail: string; icon: React.ReactNode };
    const fromRecords: Milestone[] = consultationRecords.slice(0, 4).map(r => ({
      id: `rec-${r.id}`,
      timestamp: r.timestamp,
      label: r.title,
      detail: r.summaryText,
      icon: <Stethoscope size={14} style={{ color: 'var(--accent-teal)' }} />
    }));
    const fromLogs: Milestone[] = (episode.activityLogs || [])
      .filter(l => MILESTONE_ACTIONS.has(l.action))
      .slice(0, 8)
      .map((l: ActivityLogEntry) => ({
        id: `log-${l.id}`,
        timestamp: l.timestamp,
        label: l.title,
        detail: l.details,
        icon: l.action === 'next_visit_prepared'
          ? <CalendarCheck size={14} style={{ color: 'var(--accent-teal)' }} />
          : l.action === 'transition_pack_created'
          ? <PackageCheck size={14} style={{ color: 'var(--accent-blue)' }} />
          : <History size={14} style={{ color: 'var(--accent-cyan)' }} />
      }));
    return [...fromRecords, ...fromLogs]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);
  }, [consultationRecords, episode.activityLogs]);

  const handleViewSource = (item: PendingWorkflowItem) => {
    const match = episode.records.find(r => r.id === item.recordId);
    if (match) onSelectRecord(match);
  };

  // ---- Next Visit Preparation ----
  const buildNextVisitSummary = () => {
    return `${newRecordsSincePrevious.length} new approved record(s) since the previous visit; ${completedItems.length} workflow item(s) completed; ${openItems.length} still open; ${newQuestions.length} documented patient question(s); ${upcomingItems.length} upcoming follow-up(s).`;
  };

  const handlePrepareNextVisit = () => {
    const summary = buildNextVisitSummary();
    const handoverNote = `Next-visit context ready: ${summary}${episode.handoffNotes ? ` Prior note: ${episode.handoffNotes}` : ''} (Prepared ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} by ${episode.primaryClinician})`;
    onPrepareNextVisit(summary, handoverNote);
    setNextVisitConfirmation(summary);
  };

  // ---- Transition Pack ----
  const handleApproveTransitionPack = () => {
    const summary = `Transition pack: ${newRecordsSincePrevious.length + consultationRecords.length} approved summary record(s), ${openItems.length} open workflow item(s) across ${ownerCount} owner(s), ${upcomingItems.length} documented follow-up(s). Handover context: ${episode.handoffNotes || 'none recorded'}.`;
    onCreateTransitionPack(summary);
    setTransitionApproved(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner */}
      <div className="glass-panel" style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', borderLeft: '4px solid var(--accent-teal)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ background: 'rgba(20, 184, 166, 0.12)', color: 'var(--accent-teal)', border: '1px solid rgba(20, 184, 166, 0.3)', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 800 }}>
              PHASE 5
            </span>
            <h2 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', margin: 0, fontWeight: 800 }}>Continuity & Follow-Up</h2>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {episode.patientName} — Current Maternal Care Episode ({episode.mrn})
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={onReturnToTodaysBrief} className="btn-secondary" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ArrowLeft size={14} /> Back to Today's Brief
          </button>
          <button onClick={onNavigateToWorkflow} className="btn-secondary" style={{ fontSize: '0.8rem' }}>
            Workflow Management
          </button>
          <button onClick={onNavigateToPhase1} className="btn-secondary" style={{ fontSize: '0.8rem' }}>
            View Phase 1 Context
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
        {[
          { label: 'Open Items', value: String(openItems.length), icon: <ListChecks size={18} style={{ color: 'var(--amber-pending)' }} /> },
          { label: 'Upcoming Follow-Ups', value: String(upcomingItems.length), icon: <CalendarClock size={18} style={{ color: 'var(--accent-teal)' }} /> },
          { label: 'Recent Updates (7d)', value: String(recentUpdatesCount), icon: <History size={18} style={{ color: 'var(--accent-cyan)' }} /> },
          { label: 'Next Visit', value: episode.nextVisitPreparedAt ? 'Brief Ready' : 'Pending Prep', icon: <CalendarCheck size={18} style={{ color: episode.nextVisitPreparedAt ? 'var(--emerald-raw)' : 'var(--text-muted)' }} /> }
        ].map((tile, idx) => (
          <div key={idx} className="glass-panel" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            {tile.icon}
            <div>
              <div style={{ fontSize: tile.value.length > 3 ? '1.05rem' : '1.4rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>{tile.value}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{tile.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Continuity Graph */}
      <div className="glass-panel" style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <Network size={16} style={{ color: 'var(--accent-teal)' }} />
          <strong style={{ fontSize: '0.825rem', color: 'var(--text-primary)' }}>Continuity Graph</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '0.775rem' }}>
          {[
            episode.patientName,
            `${consultationRecords.length} Visit${consultationRecords.length === 1 ? '' : 's'}`,
            `${referralCount} Referral${referralCount === 1 ? '' : 's'}`,
            `${questionCount} Question${questionCount === 1 ? '' : 's'}`,
            `${taskCount} Task${taskCount === 1 ? '' : 's'}`,
            `${ownerCount} Owner${ownerCount === 1 ? '' : 's'}`,
            `${upcomingItems.length} Follow-up${upcomingItems.length === 1 ? '' : 's'}`,
            episode.nextVisitPreparedAt ? 'Next Visit: Brief Ready' : 'Next Visit: Pending Prep'
          ].map((node, idx, arr) => (
            <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-full)', padding: '4px 12px', color: 'var(--text-primary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {node}
              </span>
              {idx < arr.length - 1 && <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>→</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Main 3-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', alignItems: 'start' }}>
        {/* LEFT: Care Journey Timeline */}
        <div className="glass-panel" style={{ padding: '18px' }}>
          <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <History size={17} style={{ color: 'var(--accent-cyan)' }} /> Care Journey Timeline
          </strong>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '14px' }}>Key documented milestones, most recent first.</span>

          <div style={{ position: 'relative', paddingLeft: '18px' }}>
            <div style={{ position: 'absolute', left: '5px', top: '6px', bottom: '6px', width: '2px', background: 'var(--border-color)' }} />
            {journeyMilestones.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No documented milestones yet.</div>
            ) : (
              journeyMilestones.map((m, idx) => (
                <div key={m.id} style={{ position: 'relative', marginBottom: idx < journeyMilestones.length - 1 ? '18px' : 0 }}>
                  <div style={{ position: 'absolute', left: '-18px', top: '2px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--bg-secondary)', border: '2px solid var(--accent-cyan)' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    {m.icon}
                    <strong style={{ fontSize: '0.825rem', color: 'var(--text-primary)' }}>{m.label}</strong>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '2px' }}>{formatDateTime(m.timestamp)}</div>
                  <p style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>{m.detail}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* CENTER: Open & Upcoming Follow-Ups */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="glass-panel" style={{ padding: '16px 18px' }}>
            <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ListChecks size={17} style={{ color: 'var(--amber-pending)' }} /> Open-Loop Follow-Up
            </strong>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Tracked until resolved. Only explicitly documented commitments.</span>
          </div>

          {openItems.length === 0 ? (
            <div className="glass-panel" style={{ padding: '18px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              No open workflow items remain.
            </div>
          ) : (
            openItems.map(item => {
              const status = STATUS_META[item.status];
              return (
                <div key={item.id} className="glass-panel" style={{ padding: '14px 16px', borderLeft: `3px solid ${status.color}` }}>
                  <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>{item.title}</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    <span>Owner: <strong style={{ color: 'var(--text-secondary)' }}>{item.assignee || 'Unassigned'}</strong></span>
                    <span>Due: {formatDate(item.dueDate)}</span>
                    <span>Last Update: {formatDate(item.lastUpdatedAt || item.dateCreated)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <select
                        value={item.status}
                        onChange={(e) => onUpdateWorkflowStatus(item.id, e.target.value as WorkflowStatus)}
                        style={{ background: status.bg, color: status.color, border: `1px solid ${status.border}`, borderRadius: 'var(--radius-sm)', padding: '4px 8px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="completed">Completed</option>
                      </select>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Source: {item.sourceContext}</span>
                    </div>
                    <button onClick={() => handleViewSource(item)} style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                      <Eye size={12} /> View Source
                    </button>
                  </div>
                </div>
              );
            })
          )}

          <div className="glass-panel" style={{ padding: '16px 18px', marginTop: '6px' }}>
            <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CalendarClock size={17} style={{ color: 'var(--accent-teal)' }} /> Upcoming Follow-Ups
            </strong>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Documented activities sorted by date.</span>
          </div>

          {upcomingItems.length === 0 ? (
            <div className="glass-panel" style={{ padding: '18px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              No upcoming documented follow-ups.
            </div>
          ) : (
            upcomingItems.map(item => {
              const status = STATUS_META[item.status];
              return (
                <div key={item.id} className="glass-panel" style={{ padding: '12px 16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', textAlign: 'center', minWidth: '58px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>{new Date(item.dueDate!).toLocaleDateString('en-US', { month: 'short' })}</div>
                    <div style={{ fontSize: '1rem', color: 'var(--accent-teal)', fontWeight: 800 }}>{new Date(item.dueDate!).getDate()}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'block' }}>{item.title}</strong>
                    <p style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', margin: '2px 0 6px 0', lineHeight: 1.4 }}>{item.description}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      <span>Owner: <strong style={{ color: 'var(--text-secondary)' }}>{item.assignee || 'Unassigned'}</strong></span>
                      <span style={{ color: status.color, fontWeight: 700 }}>{status.label}</span>
                      <span>Source: {item.sourceContext}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* RIGHT: Responsibility / Handover */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="glass-panel" style={{ padding: '16px 18px' }}>
            <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={17} style={{ color: 'var(--accent-blue)' }} /> Responsibility
            </strong>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Who currently owns open items.</span>
          </div>

          {ownerCounts.length === 0 ? (
            <div className="glass-panel" style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              No active assignments.
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {ownerCounts.map(([owner, count]) => (
                <div key={owner} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.825rem' }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{owner}</span>
                  <span style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '0.72rem' }}>{count} item{count === 1 ? '' : 's'}</span>
                </div>
              ))}
            </div>
          )}

          <div className="glass-panel" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ClipboardCheck size={17} style={{ color: 'var(--accent-teal)' }} /> Handover Continuity
            </strong>
            <HandoverField label="What Remains" value={`${openItems.length} open item(s)`} />
            <HandoverField label="What's Next" value={upcomingItems.length > 0 ? `${upcomingItems.length} upcoming follow-up(s)` : 'None scheduled'} />
            <button onClick={() => setIsHandoverModalOpen(true)} className="btn-primary" style={{ fontSize: '0.8rem', width: '100%', justifyContent: 'center' }}>
              Open Full Handover View
            </button>
          </div>
        </div>
      </div>

      {/* BOTTOM: Next Visit Preparation */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <strong style={{ fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <CalendarCheck size={18} style={{ color: 'var(--accent-teal)' }} /> Next Visit Preparation
        </strong>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '14px' }}>
          Organized from approved information only — no clinical interpretation.
        </span>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
          <NextVisitBlock title="New Approved Records" count={newRecordsSincePrevious.length} items={newRecordsSincePrevious.map(r => r.title)} />
          <NextVisitBlock title="Completed Workflow Items" count={completedItems.length} items={completedItems.map(i => i.title)} />
          <NextVisitBlock title="Still-Open Workflow Items" count={openItems.length} items={openItems.map(i => i.title)} />
          <NextVisitBlock title="New Documented Questions" count={newQuestions.length} items={newQuestions.map(i => i.title)} />
          <NextVisitBlock title="Upcoming Follow-Ups" count={upcomingItems.length} items={upcomingItems.map(i => `${i.title} (${formatDate(i.dueDate)})`)} />
          <NextVisitBlock title="Recent Handover Info" count={episode.handoffNotes ? 1 : 0} items={episode.handoffNotes ? [episode.handoffNotes] : []} />
        </div>

        {nextVisitConfirmation && (
          <div style={{ marginTop: '14px', background: 'var(--emerald-raw-bg)', border: '1px solid var(--emerald-raw-border)', borderRadius: 'var(--radius-md)', padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <CheckCircle2 size={18} style={{ color: 'var(--emerald-raw)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'block' }}>Next-visit context prepared — ready for the next care cycle.</strong>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{nextVisitConfirmation}</span>
              <div style={{ marginTop: '8px' }}>
                <button onClick={onReturnToTodaysBrief} className="btn-primary" style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  Go to Today's Brief <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="glass-panel" style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', background: 'var(--bg-secondary)' }}>
        <button onClick={() => setIsTransitionModalOpen(true)} className="btn-secondary" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <PackageCheck size={15} /> Create Transition Pack
        </button>
        <button
          onClick={handlePrepareNextVisit}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: 'var(--btn-primary-bg)', color: '#ffffff', fontWeight: 800, fontSize: '0.9rem', padding: '11px 26px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer' }}
        >
          <CalendarCheck size={17} /> Prepare Next Visit Brief
        </button>
      </div>

      {/* Handover Continuity Modal */}
      {isHandoverModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.78)', backdropFilter: 'blur(6px)', zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setIsHandoverModalOpen(false)}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '720px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-secondary)', border: '1px solid var(--border-highlight)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-tertiary)' }}>
              <div>
                <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>Handover Continuity — One-Screen View</strong>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{episode.patientName} ({episode.mrn})</div>
              </div>
              <button onClick={() => setIsHandoverModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <HandoverSection icon={<FileText size={16} style={{ color: 'var(--accent-blue)' }} />} title="Context">
                GA {episode.gestationalAgeWeeks}w {episode.gestationalAgeDays}d · Risk category: {episode.riskCategory === 'high_risk' ? 'High Risk' : episode.riskCategory === 'moderate' ? 'Moderate' : 'Routine'} · Attending: {episode.primaryClinician} · {episode.facility}.
              </HandoverSection>
              <HandoverSection icon={<Stethoscope size={16} style={{ color: 'var(--accent-teal)' }} />} title="What Happened">
                {latestVisit ? `${latestVisit.title} (${formatDate(latestVisit.timestamp)}): ${latestVisit.summaryText}` : 'No consultation documentation recorded yet.'}
              </HandoverSection>
              <HandoverSection icon={<ListChecks size={16} style={{ color: 'var(--amber-pending)' }} />} title="What Remains">
                {openItems.length === 0 ? 'No open workflow items.' : (
                  <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {openItems.map(i => <li key={i.id}>{i.title} — <span style={{ color: STATUS_META[i.status].color, fontWeight: 700 }}>{STATUS_META[i.status].label}</span></li>)}
                  </ul>
                )}
              </HandoverSection>
              <HandoverSection icon={<Users size={16} style={{ color: 'var(--accent-blue)' }} />} title="Who Owns It">
                {ownerCounts.length === 0 ? 'No active responsibility assignments.' : ownerCounts.map(([o, c]) => `${o} — ${c} item(s)`).join(' · ')}
              </HandoverSection>
              <HandoverSection icon={<CalendarClock size={16} style={{ color: 'var(--accent-teal)' }} />} title="What's Next">
                {upcomingItems.length === 0 ? 'No upcoming documented follow-ups.' : (
                  <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {upcomingItems.map(i => <li key={i.id}>{i.title} — Due {formatDate(i.dueDate)}</li>)}
                  </ul>
                )}
              </HandoverSection>
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', background: 'var(--bg-tertiary)' }}>
              <button onClick={() => setIsHandoverModalOpen(false)} className="btn-secondary" style={{ fontSize: '0.8rem' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Transition Pack Modal */}
      {isTransitionModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.78)', backdropFilter: 'blur(6px)', zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setIsTransitionModalOpen(false)}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '720px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-secondary)', border: '1px solid var(--border-highlight)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-tertiary)' }}>
              <div>
                <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>Transition Pack</strong>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{episode.patientName} ({episode.mrn})</div>
              </div>
              <button onClick={() => setIsTransitionModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ background: transitionApproved ? 'var(--emerald-raw-bg)' : 'var(--amber-pending-bg)', color: transitionApproved ? 'var(--emerald-raw)' : 'var(--amber-pending)', border: `1px solid ${transitionApproved ? 'var(--emerald-raw-border)' : 'rgba(154, 91, 46, 0.4)'}`, fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px' }}>
                  {transitionApproved ? 'APPROVED FOR CARE TEAM USE' : 'DRAFT / NEEDS CARE TEAM REVIEW'}
                </span>
              </div>

              <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Use when an appropriate documented care milestone occurs (e.g., postpartum discharge or transfer of care). MaternaSync does not determine clinical appropriateness — that judgment remains with the care team.
              </div>

              <HandoverSection icon={<FileText size={16} style={{ color: 'var(--accent-blue)' }} />} title="Approved Summaries">
                {consultationRecords.length === 0 ? 'No approved consultation summaries yet.' : (
                  <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {consultationRecords.slice(0, 5).map(r => <li key={r.id}>{r.title} ({formatDate(r.timestamp)})</li>)}
                  </ul>
                )}
              </HandoverSection>
              <HandoverSection icon={<ListChecks size={16} style={{ color: 'var(--amber-pending)' }} />} title="Open Workflow Items">
                {openItems.length === 0 ? 'None.' : openItems.map(i => i.title).join('; ')}
              </HandoverSection>
              <HandoverSection icon={<Users size={16} style={{ color: 'var(--accent-blue)' }} />} title="Assigned Owners">
                {ownerCounts.length === 0 ? 'None.' : ownerCounts.map(([o, c]) => `${o} (${c})`).join(', ')}
              </HandoverSection>
              <HandoverSection icon={<CalendarClock size={16} style={{ color: 'var(--accent-teal)' }} />} title="Documented Follow-up Items">
                {upcomingItems.length === 0 ? 'None documented.' : upcomingItems.map(i => `${i.title} (Due ${formatDate(i.dueDate)})`).join('; ')}
              </HandoverSection>
              <HandoverSection icon={<Share2 size={16} style={{ color: 'var(--amber-pending)' }} />} title="Relevant Handover Context">
                {episode.handoffNotes || 'No handover note on file.'}
              </HandoverSection>
              <HandoverSection icon={<MessageSquare size={16} style={{ color: 'var(--purple-ai)' }} />} title="Source References">
                {episode.records.slice(0, 6).map(r => r.sourceId).join(', ') || 'None.'}
              </HandoverSection>
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: 'var(--bg-tertiary)' }}>
              <button onClick={() => setIsTransitionModalOpen(false)} className="btn-secondary" style={{ fontSize: '0.8rem' }}>Close</button>
              {!transitionApproved ? (
                <button onClick={handleApproveTransitionPack} className="btn-primary" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={14} /> Approve Transition Pack
                </button>
              ) : (
                <span style={{ fontSize: '0.8rem', color: 'var(--emerald-raw)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                  <CheckCircle2 size={15} /> Reviewed & Ready
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface HandoverFieldProps { label: string; value: string }
const HandoverField: React.FC<HandoverFieldProps> = ({ label, value }) => (
  <div>
    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'block' }}>{label}</span>
    <span style={{ fontSize: '0.825rem', color: 'var(--text-primary)' }}>{value}</span>
  </div>
);

interface HandoverSectionProps { icon: React.ReactNode; title: string; children: React.ReactNode }
const HandoverSection: React.FC<HandoverSectionProps> = ({ icon, title, children }) => (
  <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px 16px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
      {icon}
      <strong style={{ fontSize: '0.825rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{title}</strong>
    </div>
    <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{children}</div>
  </div>
);

interface NextVisitBlockProps { title: string; count: number; items: string[] }
const NextVisitBlock: React.FC<NextVisitBlockProps> = ({ title, count, items }) => (
  <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
      <strong style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{title}</strong>
      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--bg-primary)', padding: '1px 8px', borderRadius: 'var(--radius-full)' }}>{count}</span>
    </div>
    {items.length === 0 ? (
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>None.</span>
    ) : (
      <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {items.slice(0, 3).map((it, idx) => (
          <li key={idx} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{it}</li>
        ))}
        {items.length > 3 && <li style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>+{items.length - 3} more</li>}
      </ul>
    )}
  </div>
);
