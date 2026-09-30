import { useState, useEffect } from 'react';
import { mockPatients } from './data/mockPatients';
import type { 
  PatientEpisode, 
  PatientRecord, 
  PendingWorkflowItem, 
  WorkflowStatus, 
  VerificationStatus,
  ActivityLogEntry,
  PhaseStage
} from './types/patient';
import { Header } from './components/Header';
import { SafetyBanner } from './components/SafetyBanner';
import { PatientHeader, type ActiveTabType } from './components/PatientHeader';
import { TimelineView } from './components/TimelineView';
import { RecordsGridView } from './components/RecordsGridView';
import { RecordCompletenessSection } from './components/RecordCompletenessSection';
import { WorkflowItemsPanel } from './components/WorkflowItemsPanel';
import { ActivityLogPanel } from './components/ActivityLogPanel';
import { TodaysBriefView } from './components/TodaysBriefView';
import { ConsultationActiveView } from './components/ConsultationActiveView';
import { RecordDetailModal } from './components/RecordDetailModal';
import { AddRecordModal } from './components/AddRecordModal';
import { AddWorkflowItemModal } from './components/AddWorkflowItemModal';
import { Phase1HandoffModal } from './components/Phase1HandoffModal';
import { SafetyDisclaimerModal } from './components/SafetyDisclaimerModal';
import { CheckCircle2 } from 'lucide-react';

export function App() {
  const [episodes, setEpisodes] = useState<PatientEpisode[]>(mockPatients);
  const [activeEpisodeId, setActiveEpisodeId] = useState<string>('EP-2026-8891');
  const [currentPhase, setCurrentPhase] = useState<PhaseStage>('phase2');
  const [activeTab, setActiveTab] = useState<ActiveTabType>('timeline');
  const [selectedRecord, setSelectedRecord] = useState<PatientRecord | null>(null);
  
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState(false);
  const [isAddRecordModalOpen, setIsAddRecordModalOpen] = useState(false);
  const [isAddWorkflowModalOpen, setIsAddWorkflowModalOpen] = useState(false);
  const [isHandoffModalOpen, setIsHandoffModalOpen] = useState(false);
  
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const activeEpisode = episodes.find(e => e.id === activeEpisodeId) || episodes[0];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleToggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Helper to add activity log entry
  const appendActivityLog = (episodeId: string, log: Omit<ActivityLogEntry, 'id' | 'episodeId' | 'timestamp'>) => {
    const newLog: ActivityLogEntry = {
      ...log,
      id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      episodeId,
      timestamp: new Date().toISOString()
    };

    setEpisodes(prev => prev.map(ep => {
      if (ep.id !== episodeId) return ep;
      return {
        ...ep,
        activityLogs: [newLog, ...(ep.activityLogs || [])]
      };
    }));
  };

  // 1. Add Record
  const handleAddRecord = (newRecord: PatientRecord) => {
    setEpisodes(prev => prev.map(ep => {
      if (ep.id !== activeEpisode.id) return ep;
      return {
        ...ep,
        records: [newRecord, ...ep.records]
      };
    }));

    appendActivityLog(activeEpisode.id, {
      action: 'record_added',
      title: `Record "${newRecord.title}" imported`,
      details: `Source: ${newRecord.facility} (${newRecord.sourceId}). Initial status: RAW.`,
      user: newRecord.author,
      role: newRecord.authorRole,
      recordId: newRecord.id
    });

    showToast(`Record "${newRecord.title}" added to patient timeline.`);
  };

  // 2. Replace Record (Duplicate Resolution)
  const handleReplaceRecord = (oldRecordId: string, newRecord: PatientRecord) => {
    setEpisodes(prev => prev.map(ep => {
      if (ep.id !== activeEpisode.id) return ep;
      return {
        ...ep,
        records: ep.records.map(r => r.id === oldRecordId ? newRecord : r)
      };
    }));

    appendActivityLog(activeEpisode.id, {
      action: 'record_replaced',
      title: `Record ${oldRecordId} replaced with updated version`,
      details: `Replaced by care team user after duplicate review: "${newRecord.title}".`,
      user: 'Dr. Eleanor Vance, MD',
      role: 'Attending Obstetrician',
      recordId: newRecord.id
    });

    showToast(`Existing record replaced with updated version "${newRecord.title}".`);
  };

  // 3. Verification Workflow
  const handleUpdateRecordVerification = (recordId: string, newStatus: VerificationStatus, verifier: string) => {
    setEpisodes(prev => prev.map(ep => {
      if (ep.id !== activeEpisode.id) return ep;
      return {
        ...ep,
        records: ep.records.map(r => {
          if (r.id === recordId) {
            return {
              ...r,
              verificationStatus: newStatus,
              verifiedBy: verifier,
              verifiedAt: new Date().toISOString()
            };
          }
          return r;
        })
      };
    }));

    // Also update selectedRecord if modal is currently open
    setSelectedRecord(prev => {
      if (prev && prev.id === recordId) {
        return {
          ...prev,
          verificationStatus: newStatus,
          verifiedBy: verifier,
          verifiedAt: new Date().toISOString()
        };
      }
      return prev;
    });

    appendActivityLog(activeEpisode.id, {
      action: 'record_verified',
      title: `Record verification status changed to ${newStatus.toUpperCase()}`,
      details: `Verified by human care team reviewer: ${verifier}.`,
      user: verifier.split('(')[0].trim(),
      role: verifier.includes('(') ? verifier.split('(')[1].replace(')', '').trim() : 'Clinician Reviewer',
      recordId
    });

    const statusLabel = newStatus === 'ready_for_context' ? 'Ready for Context' : newStatus === 'verified' ? 'Verified' : 'Raw';
    showToast(`Record status updated to "${statusLabel}".`);
  };

  // 4. Workflow Item Status Update
  const handleUpdateWorkflowStatus = (itemId: string, newStatus: WorkflowStatus) => {
    const item = activeEpisode.workflowItems.find(i => i.id === itemId);
    setEpisodes(prev => prev.map(ep => {
      if (ep.id !== activeEpisode.id) return ep;
      return {
        ...ep,
        workflowItems: ep.workflowItems.map(w => {
          if (w.id === itemId) {
            return { ...w, status: newStatus };
          }
          return w;
        })
      };
    }));

    appendActivityLog(activeEpisode.id, {
      action: 'workflow_updated',
      title: `Workflow item "${item?.title || itemId}" marked ${newStatus.toUpperCase()}`,
      details: `Status transitioned to ${newStatus}. Priority remains strictly as clinically documented.`,
      user: 'Dr. Eleanor Vance, MD',
      role: 'Attending Obstetrician'
    });

    showToast(`Workflow item status updated to "${newStatus}".`);
  };

  // 5. Add Workflow Item
  const handleAddWorkflowItem = (newItem: PendingWorkflowItem) => {
    setEpisodes(prev => prev.map(ep => {
      if (ep.id !== activeEpisode.id) return ep;
      return {
        ...ep,
        workflowItems: [newItem, ...ep.workflowItems]
      };
    }));

    appendActivityLog(activeEpisode.id, {
      action: 'workflow_created',
      title: `Workflow item "${newItem.title}" catalogued`,
      details: `Type: ${newItem.type}. Assigned role: ${newItem.assignee || 'Unassigned'}.`,
      user: 'Nurse Brenda Miller, RN',
      role: 'Obstetric Triage Nurse'
    });

    showToast(`Workflow item "${newItem.title}" added to active queue.`);
  };

  // 6. Admin Document Completeness updates
  const handleUpdateAdminDocStatus = (docId: string, newStatus: 'complete' | 'missing' | 'pending_verification') => {
    setEpisodes(prev => prev.map(ep => {
      if (ep.id !== activeEpisode.id) return ep;
      return {
        ...ep,
        administrativeDocs: (ep.administrativeDocs || []).map(doc => {
          if (doc.id === docId) {
            return {
              ...doc,
              status: newStatus,
              lastUpdated: new Date().toISOString()
            };
          }
          return doc;
        })
      };
    }));
    showToast(`Administrative checklist status updated.`);
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

    setEpisodes(prev => prev.map(ep => {
      if (ep.id !== activeEpisode.id) return ep;
      return {
        ...ep,
        administrativeDocs: [...(ep.administrativeDocs || []), newDoc]
      };
    }));
    showToast(`Checklist requirement "${title}" added.`);
  };

  // 7. Phase 1 Handoff Confirmation
  const handleConfirmHandoff = () => {
    setEpisodes(prev => prev.map(ep => {
      if (ep.id !== activeEpisode.id) return ep;
      return {
        ...ep,
        isReadyForTodayBrief: true,
        handoffTimestamp: new Date().toISOString()
      };
    }));

    appendActivityLog(activeEpisode.id, {
      action: 'phase1_handoff',
      title: `Phase 1 Context Package Locked & Handed Off`,
      details: `All quality gates passed. Context prepared for "Today's Brief" under supervision of ${activeEpisode.primaryClinician}.`,
      user: activeEpisode.primaryClinician,
      role: 'Attending Obstetrician'
    });

    setIsHandoffModalOpen(false);
    setCurrentPhase('phase2');
    showToast(`Phase 1 Dataset Locked & "Today's Brief" (Phase 2) Active!`);
  };

  return (
    <div className="app-container">
      {/* Top Header Navbar */}
      <Header
        episodes={episodes}
        activeEpisode={activeEpisode}
        currentPhase={currentPhase}
        onSelectPhase={(phase) => setCurrentPhase(phase)}
        onSelectEpisode={(id) => setActiveEpisodeId(id)}
        onOpenHandoffModal={() => setIsHandoffModalOpen(true)}
        onOpenAddRecordModal={() => setIsAddRecordModalOpen(true)}
        onOpenSafetyModal={() => setIsSafetyModalOpen(true)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Mandatory Safety & Boundary Rules Banner */}
      <SafetyBanner onOpenRulesModal={() => setIsSafetyModalOpen(true)} />

      {/* Conditional Phase Stage Rendering */}
      {currentPhase === 'phase2' ? (
        <main style={{ padding: '24px', flex: 1, maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
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
        <main style={{ padding: '24px', flex: 1, maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
          <ConsultationActiveView
            episode={activeEpisode}
            onReturnToTodaysBrief={() => setCurrentPhase('phase2')}
            onNavigateToPhase1={() => setCurrentPhase('phase1')}
          />
        </main>
      ) : (
        <>
          {/* Patient Episode Demographic & Nav Header */}
          <PatientHeader
            episode={activeEpisode}
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab)}
          />

          {/* Main Workspace Body for Phase 1 */}
          <main style={{ padding: '24px', flex: 1, maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
            {activeTab === 'timeline' && (
              <TimelineView
                records={activeEpisode.records}
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
        </>
      )}

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

      {isAddRecordModalOpen && (
        <AddRecordModal
          patientId={activeEpisode.id}
          gestationalAgeWeeks={activeEpisode.gestationalAgeWeeks}
          gestationalAgeDays={activeEpisode.gestationalAgeDays}
          existingRecords={activeEpisode.records}
          onClose={() => setIsAddRecordModalOpen(false)}
          onAddRecord={handleAddRecord}
          onReplaceRecord={handleReplaceRecord}
        />
      )}

      {isAddWorkflowModalOpen && (
        <AddWorkflowItemModal
          onClose={() => setIsAddWorkflowModalOpen(false)}
          onAddWorkflowItem={handleAddWorkflowItem}
        />
      )}

      {isHandoffModalOpen && (
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
