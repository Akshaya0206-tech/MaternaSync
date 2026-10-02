import { useMemo, useState } from 'react';
import type {
  PatientEpisode,
  PatientRecord,
  PendingWorkflowItem,
  WorkflowItemType,
  WorkflowStatus
} from '../types/patient';
import {
  ArrowLeft,
  ArrowRight,
  PlusCircle,
  Share2,
  FileCheck,
  Calendar,
  HelpCircle,
  Clock,
  Eye,
  Edit3,
  X,
  Check,
  Users,
  ListChecks,
  ClipboardCheck,
  Network,
  MessageCircle,
  MessageSquare,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  FileText,
  Languages
} from 'lucide-react';

type CommLanguage = 'en' | 'es' | 'fr';

interface WorkflowManagementViewProps {
  episode: PatientEpisode;
  onReturnToTodaysBrief: () => void;
  onNavigateToPhase1: () => void;
  onSelectRecord: (record: PatientRecord) => void;
  onUpdateWorkflowStatus: (itemId: string, newStatus: WorkflowStatus) => void;
  onUpdateWorkflowDetails: (itemId: string, patch: Partial<Pick<PendingWorkflowItem, 'dueDate' | 'assignee' | 'assignedRole' | 'description'>>) => void;
  onOpenAddWorkflowModal: () => void;
  onSaveWorkflowCheckpoint: (summary: string) => void;
  onPrepareHandover: (handoverNote: string) => void;
  onApproveCommunicationDraft: (payload: { language: string; preview: string }) => void;
  onNavigateToContinuity: () => void;
}

const TYPE_META: Record<WorkflowItemType, { label: string; icon: React.ReactNode; color: string }> = {
  pending_referral: { label: 'Referral Sent — Response Pending', icon: <Share2 size={15} />, color: 'var(--purple-ai)' },
  required_document: { label: 'Document Required', icon: <FileCheck size={15} />, color: 'var(--navy-deep)' },
  follow_up_needed: { label: 'Follow-up Scheduled', icon: <Calendar size={15} />, color: 'var(--amber-pending)' },
  unanswered_question: { label: 'Patient Question to Discuss', icon: <HelpCircle size={15} />, color: 'var(--purple-ai)' }
};

const STATUS_META: Record<WorkflowStatus, { label: string; bg: string; color: string; border: string }> = {
  pending: { label: 'Pending', bg: 'var(--amber-pending-bg)', color: 'var(--amber-pending)', border: 'rgba(154, 91, 46, 0.35)' },
  in_progress: { label: 'In Progress', bg: 'rgba(23, 50, 77, 0.12)', color: 'var(--navy-deep)', border: 'rgba(23, 50, 77, 0.3)' },
  scheduled: { label: 'Scheduled', bg: 'rgba(23, 50, 77, 0.12)', color: 'var(--navy-deep)', border: 'rgba(37, 99, 235, 0.3)' },
  verified: { label: 'Verified', bg: 'var(--emerald-raw-bg)', color: 'var(--emerald-raw)', border: 'var(--emerald-raw-border)' },
  completed: { label: 'Completed', bg: 'var(--emerald-raw-bg)', color: 'var(--emerald-raw)', border: 'var(--emerald-raw-border)' }
};

const LANGUAGE_LABELS: Record<CommLanguage, string> = { en: 'English', es: 'Español (Spanish)', fr: 'Français (French)' };

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function toDateInputValue(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function buildCommunicationDraft(lang: CommLanguage, episode: PatientEpisode, items: PendingWorkflowItem[]): string {
  const firstName = episode.patientName.split(' ')[0];
  const clinician = episode.primaryClinician.split(',')[0];
  const itemLines = items.length > 0 ? items.map(i => `- ${i.title}`).join('\n') : null;

  if (lang === 'es') {
    return `Hola ${firstName},\n\nEste es un mensaje de su equipo de atención en ${episode.facility}.`
      + (itemLines ? `\n\nQueríamos darle seguimiento sobre lo siguiente:\n${itemLines}` : '')
      + `\n\nSi tiene alguna pregunta, por favor comuníquese con nuestra oficina.\n\n— Equipo de atención de ${clinician}`;
  }
  if (lang === 'fr') {
    return `Bonjour ${firstName},\n\nCeci est un message de votre équipe de soins à ${episode.facility}.`
      + (itemLines ? `\n\nNous souhaitions faire un suivi concernant les points suivants :\n${itemLines}` : '')
      + `\n\nN'hésitez pas à nous contacter si vous avez des questions.\n\n— Équipe de soins de ${clinician}`;
  }
  return `Hi ${firstName},\n\nThis is a message from your care team at ${episode.facility}.`
    + (itemLines ? `\n\nWe wanted to follow up on the following:\n${itemLines}` : '')
    + `\n\nPlease contact our office if you have any questions.\n\n— ${clinician}'s Care Team`;
}

export const WorkflowManagementView: React.FC<WorkflowManagementViewProps> = ({
  episode,
  onReturnToTodaysBrief,
  onNavigateToPhase1,
  onSelectRecord,
  onUpdateWorkflowStatus,
  onUpdateWorkflowDetails,
  onOpenAddWorkflowModal,
  onSaveWorkflowCheckpoint,
  onPrepareHandover,
  onApproveCommunicationDraft,
  onNavigateToContinuity
}) => {
  const [sessionChangeCount, setSessionChangeCount] = useState(0);
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState(false);
  const [handoverFreeText, setHandoverFreeText] = useState(episode.handoffNotes || '');

  const [commLanguage, setCommLanguage] = useState<CommLanguage>('en');
  const [commDraft, setCommDraft] = useState<string | null>(null);
  const [isEditingComm, setIsEditingComm] = useState(false);
  const [commApproved, setCommApproved] = useState(false);
  const [commApprovedAt, setCommApprovedAt] = useState<string | null>(null);
  const [nowTs] = useState(() => Date.now());

  const openItems = useMemo(
    () => episode.workflowItems.filter(i => i.status !== 'completed'),
    [episode.workflowItems]
  );

  const awaitingResponseCount = openItems.filter(i => i.type === 'pending_referral').length;
  const assignedToMeCount = openItems.filter(i => i.assignee === episode.primaryClinician).length;
  const upcomingCount = useMemo(() => {
    const now = nowTs;
    const horizon = now + 14 * 24 * 60 * 60 * 1000;
    return openItems.filter(i => {
      if (!i.dueDate) return false;
      const due = new Date(i.dueDate).getTime();
      return due >= now && due <= horizon;
    }).length;
  }, [openItems, nowTs]);

  // ---- Responsibility Ledger: group open items by owner (read-only view) ----
  const ledgerByOwner = useMemo(() => {
    const map = new Map<string, PendingWorkflowItem[]>();
    openItems.forEach(item => {
      const owner = item.assignee || 'Unassigned';
      if (!map.has(owner)) map.set(owner, []);
      map.get(owner)!.push(item);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [openItems]);

  // ---- Continuity Graph aggregate ----
  const consultationCount = episode.records.filter(r => r.category === 'consultation_note').length;
  const ownerCount = ledgerByOwner.length;
  const statusTally: Partial<Record<WorkflowStatus, number>> = {};
  openItems.forEach(i => { statusTally[i.status] = (statusTally[i.status] || 0) + 1; });

  // ---- Team Handover snapshot ----
  const latestConsultation = [...episode.records]
    .filter(r => r.category === 'consultation_note')
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

  const questionsToDiscuss = episode.workflowItems.filter(i => i.type === 'unanswered_question' && i.status !== 'completed');

  const handleViewSource = (item: PendingWorkflowItem) => {
    const match = episode.records.find(r => r.id === item.recordId || r.sourceId === item.sourceContext.split('#')[1]?.split(' ')[0])
      || episode.records.find(r => r.id === item.recordId);
    if (match) onSelectRecord(match);
  };

  const handleDetailsSave = (itemId: string, patch: Partial<Pick<PendingWorkflowItem, 'dueDate' | 'assignee' | 'assignedRole' | 'description'>>) => {
    onUpdateWorkflowDetails(itemId, patch);
    setSessionChangeCount(c => c + 1);
  };

  const handleStatusChange = (itemId: string, status: WorkflowStatus) => {
    onUpdateWorkflowStatus(itemId, status);
    setSessionChangeCount(c => c + 1);
  };

  const handleSaveCheckpoint = () => {
    const summary = `${openItems.length} open item(s) across ${ownerCount} owner(s). ${sessionChangeCount} update(s) made this session.`;
    onSaveWorkflowCheckpoint(summary);
    setSessionChangeCount(0);
  };

  const handleOpenHandoverMode = () => {
    setHandoverFreeText(episode.handoffNotes || '');
    setIsHandoverModalOpen(true);
  };

  const handleConfirmHandover = () => {
    const contextLine = `GA ${episode.gestationalAgeWeeks}w${episode.gestationalAgeDays}d · Risk: ${episode.riskCategory.replace('_', ' ')} · Attending: ${episode.primaryClinician}.`;
    const whatRemainsLine = openItems.length > 0
      ? `${openItems.length} open item(s): ${openItems.slice(0, 4).map(i => i.title).join('; ')}${openItems.length > 4 ? '…' : ''}.`
      : 'No open workflow items.';
    const combined = `${contextLine} ${whatRemainsLine}${handoverFreeText.trim() ? ` Note: ${handoverFreeText.trim()}` : ''} (Prepared ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} by ${episode.primaryClinician})`;
    onPrepareHandover(combined);
    setIsHandoverModalOpen(false);
  };

  // ---- Patient Communication Draft ----
  const communicationSourceItems = openItems.filter(i => i.type !== 'unanswered_question');

  const handleGenerateComm = () => {
    setCommDraft(buildCommunicationDraft(commLanguage, episode, communicationSourceItems));
    setCommApproved(false);
    setIsEditingComm(false);
  };

  const handleApproveComm = () => {
    if (!commDraft) return;
    onApproveCommunicationDraft({ language: LANGUAGE_LABELS[commLanguage], preview: commDraft });
    setCommApproved(true);
    setCommApprovedAt(new Date().toLocaleString([], { hour: '2-digit', minute: '2-digit' }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner */}
      <div
        className="glass-panel"
        style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', borderLeft: '4px solid var(--accent-blue)' }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ background: 'rgba(23, 50, 77, 0.12)', color: 'var(--accent-blue)', border: '1px solid rgba(23, 50, 77, 0.3)', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 800 }}>
              PHASE 4
            </span>
            <h2 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', margin: 0, fontWeight: 800 }}>Workflow Management</h2>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {episode.patientName} ({episode.mrn}) • Converting approved consultation information into tracked, owned workflow actions.
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

      {/* Summary Tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
        {[
          { label: 'Open Items', value: openItems.length, icon: <ListChecks size={18} style={{ color: 'var(--amber-pending)' }} /> },
          { label: 'Assigned to Me', value: assignedToMeCount, icon: <Users size={18} style={{ color: 'var(--accent-blue)' }} /> },
          { label: 'Awaiting Response', value: awaitingResponseCount, icon: <Clock size={18} style={{ color: 'var(--purple-ai)' }} /> },
          { label: 'Upcoming (14d)', value: upcomingCount, icon: <Calendar size={18} style={{ color: 'var(--accent-teal)' }} /> }
        ].map((tile, idx) => (
          <div key={idx} className="glass-panel" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            {tile.icon}
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{tile.value}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{tile.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Continuity Graph Strip */}
      <div className="glass-panel" style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <Network size={16} style={{ color: 'var(--accent-teal)' }} />
          <strong style={{ fontSize: '0.825rem', color: 'var(--text-primary)' }}>Continuity Graph</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '0.775rem' }}>
          {[
            `${episode.patientName}`,
            `${consultationCount} Consultation${consultationCount === 1 ? '' : 's'}`,
            `${openItems.length} Open Task${openItems.length === 1 ? '' : 's'}`,
            `${ownerCount} Owner${ownerCount === 1 ? '' : 's'}`,
            `${Object.entries(statusTally).map(([s, c]) => `${c} ${STATUS_META[s as WorkflowStatus].label}`).join(' / ') || 'No open statuses'}`,
            `Handover ${episode.handoffNotes ? 'Ready' : 'Pending'}`
          ].map((node, idx, arr) => (
            <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-full)', padding: '4px 12px', color: 'var(--text-primary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {node}
              </span>
              {idx < arr.length - 1 && <ArrowRightIcon />}
            </span>
          ))}
        </div>
      </div>

      {/* Main 3-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', alignItems: 'start' }}>
        {/* LEFT: Open-Loop Tracker */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="glass-panel" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ListChecks size={17} style={{ color: 'var(--amber-pending)' }} /> Open Workflow Items
              </strong>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Only explicitly documented commitments.</span>
            </div>
            <button onClick={onOpenAddWorkflowModal} className="btn-secondary" style={{ fontSize: '0.75rem', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <PlusCircle size={13} /> Create Task
            </button>
          </div>

          {openItems.length === 0 ? (
            <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.825rem' }}>
              No open workflow items. All tracked commitments are resolved.
            </div>
          ) : (
            openItems.map(item => (
              <OpenLoopItemCard
                key={item.id}
                item={item}
                onStatusChange={(s) => handleStatusChange(item.id, s)}
                onSaveDetails={(patch) => handleDetailsSave(item.id, patch)}
                onViewSource={() => handleViewSource(item)}
                onMarkCompleted={() => handleStatusChange(item.id, 'completed')}
              />
            ))
          )}
        </div>

        {/* CENTER: Responsibility Ledger (read-only) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="glass-panel" style={{ padding: '16px 18px' }}>
            <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={17} style={{ color: 'var(--accent-blue)' }} /> Responsibility Ledger
            </strong>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Who owns what, and by when.</span>
          </div>

          {ledgerByOwner.length === 0 ? (
            <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.825rem' }}>
              No active responsibility assignments.
            </div>
          ) : (
            ledgerByOwner.map(([owner, items]) => (
              <div key={owner} className="glass-panel" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{owner}</strong>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                    {items.length} task{items.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {items.map(item => (
                    <div key={item.id} style={{ borderLeft: `3px solid ${STATUS_META[item.status].color}`, paddingLeft: '10px' }}>
                      <div style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-primary)' }}>{item.title}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
                        <span style={{ color: STATUS_META[item.status].color, fontWeight: 700 }}>{STATUS_META[item.status].label}</span>
                        <span>• Due: {formatDate(item.dueDate)}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Context: {item.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* RIGHT: Team Handover (compact) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="glass-panel" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ClipboardCheck size={17} style={{ color: 'var(--accent-teal)' }} /> Team Handover
              </strong>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>One-screen summary for the next shift or visit.</span>
          </div>

          <div className="glass-panel" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <HandoverField label="What Remains" value={`${openItems.length} open item(s)`} />
            <HandoverField label="Who Owns It" value={ledgerByOwner.length > 0 ? ledgerByOwner.map(([o, items]) => `${o} (${items.length})`).join(', ') : 'No open assignments'} />
            <HandoverField label="What to Discuss" value={questionsToDiscuss.length > 0 ? `${questionsToDiscuss.length} patient question(s) pending` : 'None pending'} />
            <button onClick={handleOpenHandoverMode} className="btn-primary" style={{ fontSize: '0.8rem', width: '100%', justifyContent: 'center' }}>
              Open Full Handover View
            </button>
          </div>
        </div>
      </div>

      {/* BOTTOM: Patient Communication Draft */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
          <div>
            <strong style={{ fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageCircle size={18} style={{ color: 'var(--accent-blue)' }} /> Patient Communication Draft
            </strong>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Generated from approved, explicitly documented information only.</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Languages size={14} style={{ color: 'var(--text-muted)' }} />
            <select
              value={commLanguage}
              onChange={(e) => setCommLanguage(e.target.value as CommLanguage)}
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '5px 10px', fontSize: '0.8rem' }}
            >
              {(Object.keys(LANGUAGE_LABELS) as CommLanguage[]).map(l => (
                <option key={l} value={l}>{LANGUAGE_LABELS[l]}</option>
              ))}
            </select>
            <button onClick={handleGenerateComm} className="btn-secondary" style={{ fontSize: '0.775rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <RefreshCw size={13} /> {commDraft ? 'Regenerate' : 'Generate Draft'}
            </button>
          </div>
        </div>

        {commDraft && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ background: commApproved ? 'var(--emerald-raw-bg)' : 'var(--amber-pending-bg)', color: commApproved ? 'var(--emerald-raw)' : 'var(--amber-pending)', border: `1px solid ${commApproved ? 'var(--emerald-raw-border)' : 'rgba(154, 91, 46, 0.4)'}`, fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px' }}>
                {commApproved ? `APPROVED (${commApprovedAt})` : 'DRAFT — NOT SENT'}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                A care team member must manually send this through your clinic's approved patient communication channel.
              </span>
            </div>

            {isEditingComm ? (
              <textarea
                value={commDraft}
                onChange={(e) => { setCommDraft(e.target.value); setCommApproved(false); }}
                rows={7}
                style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '12px', color: 'var(--text-primary)', fontSize: '0.85rem', lineHeight: 1.5, resize: 'vertical' }}
              />
            ) : (
              <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px', fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {commDraft}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
              <button onClick={() => setIsEditingComm(!isEditingComm)} className="btn-secondary" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Edit3 size={14} /> {isEditingComm ? 'Finish Editing' : 'Edit Draft'}
              </button>
              <button onClick={handleApproveComm} disabled={commApproved} className="btn-primary" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', opacity: commApproved ? 0.6 : 1 }}>
                <Check size={14} /> Approve Draft
              </button>
            </div>
          </>
        )}

        <div style={{ marginTop: '14px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '12px 14px', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <ShieldCheck size={16} style={{ color: 'var(--accent-teal)', flexShrink: 0, marginTop: '1px' }} />
          <span>MaternaSync never sends patient communication automatically and never answers clinical questions in these drafts. Every message is reviewed, edited if needed, and approved by the care team before it is sent through your existing channel.</span>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="glass-panel" style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', background: 'var(--bg-secondary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={handleOpenHandoverMode} className="btn-secondary" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ClipboardCheck size={15} /> Prepare Handover
          </button>
          {sessionChangeCount > 0 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sessionChangeCount} update{sessionChangeCount === 1 ? '' : 's'} made this session</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={onNavigateToContinuity} className="btn-secondary" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Continuity & Follow-Up <ArrowRight size={14} />
          </button>
          <button
            onClick={handleSaveCheckpoint}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: 'var(--btn-primary-bg)', color: '#ffffff', fontWeight: 800, fontSize: '0.9rem', padding: '11px 26px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer' }}
          >
            <Check size={17} /> Save Workflow Updates
          </button>
        </div>
      </div>

      {/* Handover Mode Modal */}
      {isHandoverModalOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.78)', backdropFilter: 'blur(6px)', zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={() => setIsHandoverModalOpen(false)}
        >
          <div
            className="glass-panel animate-fade-in"
            style={{ width: '100%', maxWidth: '760px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-secondary)', border: '1px solid var(--border-highlight)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-tertiary)' }}>
              <div>
                <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>Team Handover — One-Screen View</strong>
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

              <HandoverSection icon={<ClipboardCheck size={16} style={{ color: 'var(--accent-teal)' }} />} title="What Happened">
                {latestConsultation
                  ? `${latestConsultation.title} (${formatDate(latestConsultation.timestamp)}): ${latestConsultation.summaryText}`
                  : 'No consultation documentation recorded yet in this episode.'}
              </HandoverSection>

              <HandoverSection icon={<ListChecks size={16} style={{ color: 'var(--amber-pending)' }} />} title="What Remains">
                {openItems.length === 0 ? 'No open workflow items.' : (
                  <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {openItems.map(i => (
                      <li key={i.id}>{i.title} — <span style={{ color: STATUS_META[i.status].color, fontWeight: 700 }}>{STATUS_META[i.status].label}</span> (Due {formatDate(i.dueDate)})</li>
                    ))}
                  </ul>
                )}
              </HandoverSection>

              <HandoverSection icon={<Users size={16} style={{ color: 'var(--accent-blue)' }} />} title="Who Owns It">
                {ledgerByOwner.length === 0 ? 'No active responsibility assignments.' : ledgerByOwner.map(([o, items]) => `${o} — ${items.length} item(s)`).join(' · ')}
              </HandoverSection>

              <HandoverSection icon={<MessageSquare size={16} style={{ color: 'var(--purple-ai)' }} />} title="What to Discuss">
                {questionsToDiscuss.length === 0 ? 'No documented patient questions pending discussion.' : (
                  <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {questionsToDiscuss.map(q => <li key={q.id}>{q.description}</li>)}
                  </ul>
                )}
              </HandoverSection>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  Additional Handover Note (Optional)
                </label>
                <textarea
                  value={handoverFreeText}
                  onChange={(e) => setHandoverFreeText(e.target.value)}
                  rows={3}
                  placeholder="Anything else the next clinician or shift should know…"
                  style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '10px', color: 'var(--text-primary)', fontSize: '0.825rem', resize: 'vertical' }}
                />
              </div>
            </div>

            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: 'var(--bg-tertiary)' }}>
              <button onClick={() => setIsHandoverModalOpen(false)} className="btn-secondary" style={{ fontSize: '0.8rem' }}>Close</button>
              <button onClick={handleConfirmHandover} className="btn-primary" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Check size={14} /> Confirm & Update Handover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ArrowRightIcon: React.FC = () => (
  <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>→</span>
);

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

interface OpenLoopItemCardProps {
  item: PendingWorkflowItem;
  onStatusChange: (status: WorkflowStatus) => void;
  onSaveDetails: (patch: Partial<Pick<PendingWorkflowItem, 'dueDate' | 'assignee' | 'assignedRole' | 'description'>>) => void;
  onViewSource: () => void;
  onMarkCompleted: () => void;
}

const OpenLoopItemCard: React.FC<OpenLoopItemCardProps> = ({ item, onStatusChange, onSaveDetails, onViewSource, onMarkCompleted }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [ownerDraft, setOwnerDraft] = useState(item.assignee || '');
  const [dueDateDraft, setDueDateDraft] = useState(toDateInputValue(item.dueDate));
  const [contextDraft, setContextDraft] = useState(item.description);

  const meta = TYPE_META[item.type];
  const status = STATUS_META[item.status];

  const handleSave = () => {
    onSaveDetails({
      assignee: ownerDraft.trim() || 'Unassigned',
      dueDate: dueDateDraft ? new Date(dueDateDraft).toISOString() : undefined,
      description: contextDraft
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setOwnerDraft(item.assignee || '');
    setDueDateDraft(toDateInputValue(item.dueDate));
    setContextDraft(item.description);
    setIsEditing(false);
  };

  return (
    <div className="glass-panel" style={{ padding: '16px 18px', borderLeft: `4px solid ${item.priority === 'urgent' ? 'var(--rose-urgent)' : meta.color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
        <span style={{ color: meta.color, display: 'flex', alignItems: 'center', gap: '4px' }}>{meta.icon}</span>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: meta.color }}>{meta.label}</span>
        {item.priority === 'urgent' && (
          <span className="badge-urgent" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <AlertTriangle size={11} /> URGENT
          </span>
        )}
      </div>

      <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>{item.title}</strong>

      {isEditing ? (
        <textarea
          value={contextDraft}
          onChange={(e) => setContextDraft(e.target.value)}
          rows={2}
          style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '6px 8px', color: 'var(--text-primary)', fontSize: '0.8rem', marginBottom: '8px' }}
        />
      ) : (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 8px 0', lineHeight: 1.45 }}>{item.description}</p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.72rem', color: 'var(--text-muted)', flexWrap: 'wrap', marginBottom: '10px' }}>
        <span>Source: <strong style={{ color: 'var(--text-secondary)' }}>{item.sourceContext}</strong></span>
        <span>• Created: {formatDate(item.dateCreated)}</span>
        <button onClick={onViewSource} style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
          <Eye size={12} /> View Source
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
        <div>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Owner</span>
          {isEditing ? (
            <input
              type="text"
              value={ownerDraft}
              onChange={(e) => setOwnerDraft(e.target.value)}
              style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '5px 8px', color: 'var(--text-primary)', fontSize: '0.8rem' }}
            />
          ) : (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 600 }}>{item.assignee || 'Unassigned'}</span>
          )}
        </div>
        <div>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Due Date</span>
          {isEditing ? (
            <input
              type="date"
              value={dueDateDraft}
              onChange={(e) => setDueDateDraft(e.target.value)}
              style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '5px 8px', color: 'var(--text-primary)', fontSize: '0.8rem' }}
            />
          ) : (
            <span style={{ fontSize: '0.8rem', color: item.priority === 'urgent' ? 'var(--rose-urgent)' : 'var(--text-primary)', fontWeight: 600 }}>{formatDate(item.dueDate)}</span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            value={item.status}
            onChange={(e) => onStatusChange(e.target.value as WorkflowStatus)}
            style={{ background: status.bg, color: status.color, border: `1px solid ${status.border}`, borderRadius: 'var(--radius-sm)', padding: '4px 8px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
          >
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
          </select>
          {item.status !== 'completed' && (
            <button onClick={onMarkCompleted} className="btn-outline-emerald" style={{ fontSize: '0.72rem', padding: '4px 10px' }}>
              <Check size={12} /> Mark Completed
            </button>
          )}
        </div>

        {isEditing ? (
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={handleCancel} className="btn-secondary" style={{ fontSize: '0.72rem', padding: '4px 10px' }}>Cancel</button>
            <button onClick={handleSave} className="btn-primary" style={{ fontSize: '0.72rem', padding: '4px 10px' }}>Save Changes</button>
          </div>
        ) : (
          <button onClick={() => setIsEditing(true)} className="btn-secondary" style={{ fontSize: '0.72rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Edit3 size={12} /> Edit Details
          </button>
        )}
      </div>
    </div>
  );
};
