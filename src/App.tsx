import { useState, useEffect, useCallback } from 'react';
import type {
  PatientEpisode,
  PatientRecord,
  PendingWorkflowItem,
  WorkflowStatus,
  VerificationStatus,
  ActivityLogEntry,
  PhaseStage
} from './types/patient';
import type { CurrentUser } from './api/auth';
import {
  fetchPatientList,
  fetchFullEpisode,
  createPatient,
  updateRecord,
  updateWorkflowItem,
  markReadyForTodaysBrief
} from './api/patients';
import type { PatientSummary } from './api/patients';
import { Sidebar } from './components/Sidebar';
import { TopPhaseNav } from './components/TopPhaseNav';
import { TopUtilityBar } from './components/TopUtilityBar';
import { SafetyBanner } from './components/SafetyBanner';
import { PatientHeader } from './components/PatientHeader';
import { Phase1TabBar, type ActiveTabType } from './components/Phase1TabBar';
import { PatientListView } from './components/PatientListView';
import { CreatePatientModal } from './components/CreatePatientModal';
import { UploadRecordModal } from './components/UploadRecordModal';
import { TimelineView } from './components/TimelineView';
import { RecordsGridView } from './components/RecordsGridView';
import { RecordCompletenessSection } from './components/RecordCompletenessSection';
import { WorkflowItemsPanel } from './components/WorkflowItemsPanel';
import { ActivityLogPanel } from './components/ActivityLogPanel';
import { TodaysBriefView } from './components/TodaysBriefView';
import { ConsultationActiveView } from './components/ConsultationActiveView';
import { WorkflowManagementView } from './components/WorkflowManagementView';
import { ContinuityFollowUpView } from './components/ContinuityFollowUpView';
import { RecordDetailModal } from './components/RecordDetailModal';
import { AddRecordModal } from './components/AddRecordModal';
import { AddWorkflowItemModal } from './components/AddWorkflowItemModal';
import { Phase1HandoffModal } from './components/Phase1HandoffModal';
import { SafetyDisclaimerModal } from './components/SafetyDisclaimerModal';
import { CheckCircle2 } from 'lucide-react';

interface AppProps {
  currentUser: CurrentUser;
  onLogout: () => void;
}

export function App({ currentUser, onLogout }: AppProps) {
  // ---- Patient list (cross-patient) ----
  const [patientSummaries, setPatientSummaries] = useState<PatientSummary[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);

  // ---- Active patient (single, fetched in full) ----
  const [activeEpisodeId, setActiveEpisodeId] = useState<string | null>(null);
  const [activeEpisode, setActiveEpisode] = useState<PatientEpisode | null>(null);
  const [isLoadingEpisode, setIsLoadingEpisode] = useState(false);

  const [currentPhase, setCurrentPhase] = useState<PhaseStage>('phase1');
  const [activeTab, setActiveTab] = useState<ActiveTabType>('timeline');
  const [selectedRecord, setSelectedRecord] = useState<PatientRecord | null>(null);

  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState(false);
  const [isAddRecordModalOpen, setIsAddRecordModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isAddWorkflowModalOpen, setIsAddWorkflowModalOpen] = useState(false);
  const [isHandoffModalOpen, setIsHandoffModalOpen] = useState(false);
  const [isCreatePatientModalOpen, setIsCreatePatientModalOpen] = useState(false);

  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleToggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // ---- Data loading ----
  const refreshPatientList = useCallback(async () => {
    try {
      const list = await fetchPatientList();
      setPatientSummaries(list);
    } catch {
      showToast('Could not load the patient list.');
    }
  }, []);

  useEffect(() => {
    setIsLoadingList(true);
    refreshPatientList().finally(() => setIsLoadingList(false));
  }, [refreshPatientList]);

  const refreshActiveEpisode = useCallback(async () => {
    if (!activeEpisodeId) return;
    try {
      const episode = await fetchFullEpisode(activeEpisodeId);
      setActiveEpisode(episode);
    } catch {
      showToast('Could not load this patient.');
    }
  }, [activeEpisodeId]);

  useEffect(() => {
    if (!activeEpisodeId) {
      setActiveEpisode(null);
      return;
    }
    setIsLoadingEpisode(true);
    fetchFullEpisode(activeEpisodeId)
      .then(setActiveEpisode)
      .catch(() => showToast('Could not load this patient.'))
      .finally(() => setIsLoadingEpisode(false));
  }, [activeEpisodeId]);

  // ---- Navigation ----
  const handleOpenPatient = (id: string) => {
    setActiveEpisodeId(id);
    setCurrentPhase('phase1');
    setActiveTab('timeline');
  };

  const handleBackToPatients = () => {
    setActiveEpisodeId(null);
    setSelectedRecord(null);
    void refreshPatientList();
  };

  const handleCreatePatient = async (payload: { patientName: string; age?: number; dob?: string; edd: string; mrn?: string }) => {
    const created = await createPatient(payload);
    await refreshPatientList();
    setIsCreatePatientModalOpen(false);
    showToast(`Patient "${payload.patientName}" created.`);
    handleOpenPatient(created.id);
  };

  // ---- Phase 1: backend-wired handlers (reuse the same real endpoints the
  // upload/manual/workflow modals already call) ----

  const handleUpdateRecordVerification = async (recordId: string, newStatus: VerificationStatus, verifier: string) => {
    if (!activeEpisode) return;
    setSelectedRecord(prev => (prev && prev.id === recordId) ? { ...prev, verificationStatus: newStatus, verifiedBy: verifier, verifiedAt: new Date().toISOString() } : prev);
    try {
      await updateRecord(activeEpisode.id, recordId, { verificationStatus: newStatus, verifiedBy: verifier });
      await refreshActiveEpisode();
      const statusLabel = newStatus === 'ready_for_context' ? 'Ready for Context' : newStatus === 'verified' ? 'Verified' : newStatus === 'rejected' ? 'Rejected' : 'Raw';
      showToast(`Record status updated to "${statusLabel}".`);
    } catch {
      showToast('Could not update record status.');
    }
  };

  const handleUpdateWorkflowStatus = async (itemId: string, newStatus: WorkflowStatus) => {
    if (!activeEpisode) return;
    try {
      await updateWorkflowItem(activeEpisode.id, itemId, { status: newStatus });
      await refreshActiveEpisode();
      showToast(`Workflow item status updated to "${newStatus}".`);
    } catch {
      showToast('Could not update workflow item.');
    }
  };

  const handleUpdateWorkflowDetails = async (
    itemId: string,
    patch: Partial<Pick<PendingWorkflowItem, 'dueDate' | 'assignee' | 'assignedRole' | 'description'>>
  ) => {
    if (!activeEpisode) return;
    try {
      await updateWorkflowItem(activeEpisode.id, itemId, {
        assignee: patch.assignee,
        dueDate: patch.dueDate,
        description: patch.description,
      });
      await refreshActiveEpisode();
    } catch {
      showToast('Could not update workflow item.');
    }
  };

  const handleUpdateAdminDocStatus = (docId: string, newStatus: 'complete' | 'missing' | 'pending_verification') => {
    setActiveEpisode(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        administrativeDocs: (prev.administrativeDocs || []).map(doc =>
          doc.id === docId ? { ...doc, status: newStatus, lastUpdated: new Date().toISOString() } : doc
        )
      };
    });
    showToast('Administrative checklist status updated.');
  };

  const handleAddAdminDoc = (title: string, category: 'intake' | 'consent' | 'identification' | 'preferences' | 'postpartum_plan') => {
    const newDoc = {
      id: `ADM-${Date.now()}`,
      title,
      category,
      status: 'pending_verification' as const,
      requiredByStage: 'Episode Management',
      lastUpdated: new Date().toISOString()
    };
    setActiveEpisode(prev => prev ? { ...prev, administrativeDocs: [...(prev.administrativeDocs || []), newDoc] } : prev);
    showToast(`Checklist requirement "${title}" added.`);
  };

  const handleConfirmHandoff = async () => {
    if (!activeEpisode) return;
    try {
      await markReadyForTodaysBrief(activeEpisode.id);
      await refreshActiveEpisode();
      await refreshPatientList();
      setIsHandoffModalOpen(false);
      setCurrentPhase('phase2');
      showToast(`Phase 1 Dataset Locked & "Today's Brief" (Phase 2) Active!`);
    } catch {
      showToast('Could not complete handoff.');
    }
  };

  // ---- Phase 2-5: unchanged, session-local behavior (these phases are not
  // being redesigned; they continue to operate on the currently loaded
  // episode in memory, same as before) ----

  const appendLocalActivityLog = (log: Omit<ActivityLogEntry, 'id' | 'episodeId' | 'timestamp'>) => {
    if (!activeEpisode) return;
    const newLog: ActivityLogEntry = {
      ...log,
      id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      episodeId: activeEpisode.id,
      timestamp: new Date().toISOString()
    };
    setActiveEpisode(prev => prev ? { ...prev, activityLogs: [newLog, ...(prev.activityLogs || [])] } : prev);
  };

  const handleApproveConsultation = (payload: {
    record: PatientRecord;
    newWorkflowItems: PendingWorkflowItem[];
    handoverNote: string;
  }) => {
    if (!activeEpisode) return;
    setActiveEpisode(prev => prev ? {
      ...prev,
      records: [payload.record, ...prev.records],
      workflowItems: [...payload.newWorkflowItems, ...prev.workflowItems],
      handoffNotes: payload.handoverNote
    } : prev);

    appendLocalActivityLog({
      action: 'consultation_approved',
      title: `Consultation documentation approved & saved to timeline`,
      details: `Structured draft reviewed and approved by ${activeEpisode.primaryClinician}. ${payload.newWorkflowItems.length} follow-up task(s) created.`,
      user: activeEpisode.primaryClinician,
      role: 'Attending Obstetrician',
      recordId: payload.record.id
    });
    appendLocalActivityLog({
      action: 'handover_updated',
      title: `Handover context updated for next visit`,
      details: payload.handoverNote,
      user: activeEpisode.primaryClinician,
      role: 'Attending Obstetrician'
    });

    showToast(`Consultation documentation saved to ${activeEpisode.patientName}'s timeline.`);
  };

  const handleSaveWorkflowCheckpoint = (summary: string) => {
    if (!activeEpisode) return;
    appendLocalActivityLog({
      action: 'workflow_reviewed',
      title: 'Workflow updates saved',
      details: summary,
      user: activeEpisode.primaryClinician,
      role: 'Attending Obstetrician'
    });
    showToast('Workflow updates saved.');
  };

  const handlePrepareHandover = (handoverNote: string) => {
    if (!activeEpisode) return;
    setActiveEpisode(prev => prev ? { ...prev, handoffNotes: handoverNote } : prev);
    appendLocalActivityLog({
      action: 'handover_updated',
      title: 'Handover context updated for next visit',
      details: handoverNote,
      user: activeEpisode.primaryClinician,
      role: 'Attending Obstetrician'
    });
    showToast('Handover prepared and shared with the care team.');
  };

  const handleApproveCommunicationDraft = (payload: { language: string; preview: string }) => {
    if (!activeEpisode) return;
    appendLocalActivityLog({
      action: 'communication_draft_approved',
      title: `Patient communication draft approved (${payload.language})`,
      details: `Reviewed and approved by ${activeEpisode.primaryClinician}. Not sent automatically — ready for manual send through the clinic's approved channel.`,
      user: activeEpisode.primaryClinician,
      role: 'Attending Obstetrician'
    });
    showToast('Communication draft approved. It has not been sent — send manually through your usual channel.');
  };

  const handlePrepareNextVisit = (summary: string, handoverNote: string) => {
    if (!activeEpisode) return;
    const preparedAt = new Date().toISOString();
    setActiveEpisode(prev => prev ? { ...prev, handoffNotes: handoverNote, nextVisitPreparedAt: preparedAt } : prev);
    appendLocalActivityLog({
      action: 'next_visit_prepared',
      title: 'Next-visit context prepared for Today\'s Brief',
      details: summary,
      user: activeEpisode.primaryClinician,
      role: 'Attending Obstetrician'
    });
    showToast('Next-visit context prepared. Ready for the next care cycle.');
  };

  const handleCreateTransitionPack = (summary: string) => {
    if (!activeEpisode) return;
    appendLocalActivityLog({
      action: 'transition_pack_created',
      title: 'Transition pack prepared for care team review',
      details: summary,
      user: activeEpisode.primaryClinician,
      role: 'Attending Obstetrician'
    });
    showToast('Transition pack prepared. It remains available for authorized care team review before use.');
  };

  const mainStyle: React.CSSProperties = { padding: '24px', flex: 1, maxWidth: '1440px', margin: '0 auto', width: '100%' };
  const isPatientListActive = activeEpisodeId === null;

  return (
    <div className="app-container">
      <Sidebar
        currentPhase={currentPhase}
        onSelectPhase={(phase) => setCurrentPhase(phase)}
        onSelectPatients={handleBackToPatients}
        isPatientListActive={isPatientListActive}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onOpenSafetyModal={() => setIsSafetyModalOpen(true)}
        userName={currentUser.fullName}
        userRole={currentUser.role}
        onLogout={onLogout}
      />

      <div className="app-main-column">
        {isPatientListActive ? (
          <PatientListView
            patients={patientSummaries}
            isLoading={isLoadingList}
            onOpenPatient={handleOpenPatient}
            onCreatePatient={() => setIsCreatePatientModalOpen(true)}
          />
        ) : isLoadingEpisode || !activeEpisode ? (
          <main style={mainStyle}>
            <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading patient workspace…
            </div>
          </main>
        ) : (
          <>
            <TopUtilityBar
              episodes={patientSummaries}
              activeEpisode={activeEpisode}
              onSelectEpisode={(id) => handleOpenPatient(id)}
              onOpenUploadModal={() => setIsUploadModalOpen(true)}
              onOpenHandoffModal={() => setIsHandoffModalOpen(true)}
            />

            <TopPhaseNav currentPhase={currentPhase} onSelectPhase={(phase) => setCurrentPhase(phase)} />

            <SafetyBanner onOpenRulesModal={() => setIsSafetyModalOpen(true)} />

            <PatientHeader episode={activeEpisode} />

            {currentPhase === 'phase1' && (
              <Phase1TabBar
                episode={activeEpisode}
                activeTab={activeTab}
                onTabChange={(tab) => setActiveTab(tab)}
              />
            )}

            {currentPhase === 'phase2' ? (
              <main style={mainStyle}>
                <TodaysBriefView
                  episode={activeEpisode}
                  onNavigateToPhase1={(targetTab) => {
                    setCurrentPhase('phase1');
                    if (targetTab) setActiveTab(targetTab);
                  }}
                  onStartConsultation={() => setCurrentPhase('consultation')}
                  onSelectRecord={(rec) => setSelectedRecord(rec)}
                  onUpdateWorkflowStatus={handleUpdateWorkflowStatus}
                />
              </main>
            ) : currentPhase === 'consultation' ? (
              <main style={mainStyle}>
                <ConsultationActiveView
                  episode={activeEpisode}
                  onReturnToTodaysBrief={() => setCurrentPhase('phase2')}
                  onNavigateToPhase1={() => setCurrentPhase('phase1')}
                  onApproveConsultation={handleApproveConsultation}
                  onNavigateToWorkflow={() => setCurrentPhase('workflow')}
                />
              </main>
            ) : currentPhase === 'workflow' ? (
              <main style={mainStyle}>
                <WorkflowManagementView
                  episode={activeEpisode}
                  onReturnToTodaysBrief={() => setCurrentPhase('phase2')}
                  onNavigateToPhase1={() => setCurrentPhase('phase1')}
                  onSelectRecord={(rec) => setSelectedRecord(rec)}
                  onUpdateWorkflowStatus={handleUpdateWorkflowStatus}
                  onUpdateWorkflowDetails={handleUpdateWorkflowDetails}
                  onOpenAddWorkflowModal={() => setIsAddWorkflowModalOpen(true)}
                  onSaveWorkflowCheckpoint={handleSaveWorkflowCheckpoint}
                  onPrepareHandover={handlePrepareHandover}
                  onApproveCommunicationDraft={handleApproveCommunicationDraft}
                  onNavigateToContinuity={() => setCurrentPhase('continuity')}
                />
              </main>
            ) : currentPhase === 'continuity' ? (
              <main style={mainStyle}>
                <ContinuityFollowUpView
                  episode={activeEpisode}
                  onReturnToTodaysBrief={() => setCurrentPhase('phase2')}
                  onNavigateToPhase1={() => setCurrentPhase('phase1')}
                  onNavigateToWorkflow={() => setCurrentPhase('workflow')}
                  onSelectRecord={(rec) => setSelectedRecord(rec)}
                  onUpdateWorkflowStatus={handleUpdateWorkflowStatus}
                  onPrepareNextVisit={handlePrepareNextVisit}
                  onCreateTransitionPack={handleCreateTransitionPack}
                />
              </main>
            ) : (
              <main style={mainStyle}>
                {activeTab === 'timeline' && (
                  <TimelineView
                    records={activeEpisode.records.filter(r => r.verificationStatus === 'verified' || r.verificationStatus === 'ready_for_context')}
                    onSelectRecord={(rec) => setSelectedRecord(rec)}
                    onUpdateVerification={handleUpdateRecordVerification}
                  />
                )}

                {activeTab === 'grid' && (
                  <RecordsGridView
                    records={activeEpisode.records}
                    onSelectRecord={(rec) => setSelectedRecord(rec)}
                  />
                )}

                {activeTab === 'completeness' && (
                  <RecordCompletenessSection
                    episode={activeEpisode}
                    onUpdateAdminDocStatus={handleUpdateAdminDocStatus}
                    onAddAdminDoc={handleAddAdminDoc}
                  />
                )}

                {activeTab === 'workflow' && (
                  <WorkflowItemsPanel
                    workflowItems={activeEpisode.workflowItems}
                    onUpdateStatus={handleUpdateWorkflowStatus}
                    onAddNewItem={() => setIsAddWorkflowModalOpen(true)}
                  />
                )}

                {activeTab === 'activity' && (
                  <ActivityLogPanel
                    activityLogs={activeEpisode.activityLogs || []}
                    patientName={activeEpisode.patientName}
                    mrn={activeEpisode.mrn}
                  />
                )}
              </main>
            )}
          </>
        )}
      </div>

      {/* Toast Notification Popup */}
      {toastMessage && (
        <div
          className="animate-fade-in"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--accent-cyan)',
            boxShadow: 'var(--shadow-lg)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            zIndex: 200,
            fontSize: '0.85rem',
            color: 'var(--text-primary)'
          }}
        >
          <CheckCircle2 size={18} style={{ color: 'var(--accent-cyan)' }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Modals */}
      <RecordDetailModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
        onUpdateVerification={handleUpdateRecordVerification}
      />

      {isCreatePatientModalOpen && (
        <CreatePatientModal
          onClose={() => setIsCreatePatientModalOpen(false)}
          onCreate={handleCreatePatient}
        />
      )}

      {activeEpisode && isUploadModalOpen && (
        <UploadRecordModal
          patientId={activeEpisode.id}
          onClose={() => setIsUploadModalOpen(false)}
          onApproved={() => {
            setIsUploadModalOpen(false);
            void refreshActiveEpisode();
            void refreshPatientList();
            showToast('Record processed and added to the patient journey.');
          }}
        />
      )}

      {activeEpisode && isAddRecordModalOpen && (
        <AddRecordModal
          patientId={activeEpisode.id}
          onClose={() => setIsAddRecordModalOpen(false)}
          onCreated={() => {
            setIsAddRecordModalOpen(false);
            void refreshActiveEpisode();
            void refreshPatientList();
            showToast('Record added to the patient journey.');
          }}
        />
      )}

      {activeEpisode && isAddWorkflowModalOpen && (
        <AddWorkflowItemModal
          patientId={activeEpisode.id}
          onClose={() => setIsAddWorkflowModalOpen(false)}
          onCreated={() => {
            setIsAddWorkflowModalOpen(false);
            void refreshActiveEpisode();
            showToast('Workflow item added to the active queue.');
          }}
        />
      )}

      {activeEpisode && isHandoffModalOpen && (
        <Phase1HandoffModal
          episode={activeEpisode}
          onClose={() => setIsHandoffModalOpen(false)}
          onConfirmHandoff={handleConfirmHandoff}
        />
      )}

      {isSafetyModalOpen && (
        <SafetyDisclaimerModal
          onClose={() => setIsSafetyModalOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
