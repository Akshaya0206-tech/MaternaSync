import { useState, useEffect } from 'react';
import { mockPatients } from './data/mockPatients';
import type { PatientEpisode, PatientRecord, PendingWorkflowItem, WorkflowStatus } from './types/patient';
import { Header } from './components/Header';
import { SafetyBanner } from './components/SafetyBanner';
import { PatientHeader } from './components/PatientHeader';
import { TimelineView } from './components/TimelineView';
import { RecordsGridView } from './components/RecordsGridView';
import { WorkflowItemsPanel } from './components/WorkflowItemsPanel';
import { RecordDetailModal } from './components/RecordDetailModal';
import { AddRecordModal } from './components/AddRecordModal';
import { AddWorkflowItemModal } from './components/AddWorkflowItemModal';
import { Phase1HandoffModal } from './components/Phase1HandoffModal';
import { SafetyDisclaimerModal } from './components/SafetyDisclaimerModal';
import { CheckCircle2 } from 'lucide-react';

export function App() {
  const [episodes, setEpisodes] = useState<PatientEpisode[]>(mockPatients);
  const [activeEpisodeId, setActiveEpisodeId] = useState<string>('EP-2026-8891');
  const [activeTab, setActiveTab] = useState<'timeline' | 'grid' | 'workflow'>('timeline');
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

  const handleUpdateWorkflowStatus = (itemId: string, newStatus: WorkflowStatus) => {
    setEpisodes(prev => prev.map(ep => {
      if (ep.id !== activeEpisode.id) return ep;
      return {
        ...ep,
        workflowItems: ep.workflowItems.map(item => {
          if (item.id === itemId) {
            return { ...item, status: newStatus };
          }
          return item;
        })
      };
    }));
    showToast(`Workflow item status updated to ${newStatus}.`);
  };

  const handleAddRecord = (newRecord: PatientRecord) => {
    setEpisodes(prev => prev.map(ep => {
      if (ep.id !== activeEpisode.id) return ep;
      return {
        ...ep,
        records: [newRecord, ...ep.records]
      };
    }));
    showToast(`Record "${newRecord.title}" successfully added to patient timeline.`);
  };

  const handleAddWorkflowItem = (newItem: PendingWorkflowItem) => {
    setEpisodes(prev => prev.map(ep => {
      if (ep.id !== activeEpisode.id) return ep;
      return {
        ...ep,
        workflowItems: [newItem, ...ep.workflowItems]
      };
    }));
    showToast(`Documented workflow item "${newItem.title}" added to active queue.`);
  };

  const handleConfirmHandoff = () => {
    setEpisodes(prev => prev.map(ep => {
      if (ep.id !== activeEpisode.id) return ep;
      return {
        ...ep,
        isReadyForTodayBrief: true,
        handoffTimestamp: new Date().toISOString()
      };
    }));
    showToast(`Phase 1 Dataset Locked & Ready for "Today's Brief"!`);
  };

  return (
    <div className="app-container">
      {/* Top Header Navbar */}
      <Header
        episodes={episodes}
        activeEpisode={activeEpisode}
        onSelectEpisode={(id) => setActiveEpisodeId(id)}
        onOpenHandoffModal={() => setIsHandoffModalOpen(true)}
        onOpenAddRecordModal={() => setIsAddRecordModalOpen(true)}
        onOpenSafetyModal={() => setIsSafetyModalOpen(true)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Mandatory Safety & Boundary Rules Banner */}
      <SafetyBanner onOpenRulesModal={() => setIsSafetyModalOpen(true)} />

      {/* Patient Episode Demographic & Quick Nav Header */}
      <PatientHeader
        episode={activeEpisode}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
      />

      {/* Main Workspace Body */}
      <main style={{ padding: '24px', flex: 1, maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
        {activeTab === 'timeline' && (
          <TimelineView
            records={activeEpisode.records}
            onSelectRecord={(rec) => setSelectedRecord(rec)}
          />
        )}

        {activeTab === 'grid' && (
          <RecordsGridView
            records={activeEpisode.records}
            onSelectRecord={(rec) => setSelectedRecord(rec)}
          />
        )}

        {activeTab === 'workflow' && (
          <WorkflowItemsPanel
            workflowItems={activeEpisode.workflowItems}
            onUpdateStatus={handleUpdateWorkflowStatus}
            onAddNewItem={() => setIsAddWorkflowModalOpen(true)}
          />
        )}
      </main>

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
      />

      {isAddRecordModalOpen && (
        <AddRecordModal
          patientId={activeEpisode.id}
          gestationalAgeWeeks={activeEpisode.gestationalAgeWeeks}
          gestationalAgeDays={activeEpisode.gestationalAgeDays}
          onClose={() => setIsAddRecordModalOpen(false)}
          onAddRecord={handleAddRecord}
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
