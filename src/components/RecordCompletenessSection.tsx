import { useState } from 'react';
import type { PatientEpisode, RecordCategory } from '../types/patient';
import { 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  FileText, 
  Share2, 
  MessageSquare, 
  FileCheck, 
  Calendar, 
  Activity, 
  ShieldCheck, 
  Plus,
  HelpCircle
} from 'lucide-react';

interface RecordCompletenessSectionProps {
  episode: PatientEpisode;
  onUpdateAdminDocStatus?: (docId: string, newStatus: 'complete' | 'missing' | 'pending_verification') => void;
  onAddAdminDoc?: (title: string, category: 'intake' | 'consent' | 'identification' | 'preferences' | 'postpartum_plan') => void;
}

export const RecordCompletenessSection: React.FC<RecordCompletenessSectionProps> = ({
  episode,
  onUpdateAdminDocStatus,
  onAddAdminDoc
}) => {
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocCategory, setNewDocCategory] = useState<'intake' | 'consent' | 'identification' | 'preferences' | 'postpartum_plan'>('intake');
  const [showAddForm, setShowAddForm] = useState(false);
  const [syncTimestamp] = useState(() => ({
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }));

  // Category counts
  const categoryCounts: Record<RecordCategory, number> = {
    consultation_note: episode.records.filter(r => r.category === 'consultation_note').length,
    care_document: episode.records.filter(r => r.category === 'care_document').length,
    referral: episode.records.filter(r => r.category === 'referral').length,
    patient_message: episode.records.filter(r => r.category === 'patient_message').length,
    follow_up: episode.records.filter(r => r.category === 'follow_up').length,
    workflow_event: episode.records.filter(r => r.category === 'workflow_event').length
  };

  // Find latest record date
  const sortedRecords = [...episode.records].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const latestRecord = sortedRecords[0];
  const latestRecordDateStr = latestRecord 
    ? new Date(latestRecord.timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'No records collected';

  // Administrative documents
  const adminDocs = episode.administrativeDocs || [];
  const completeDocsCount = adminDocs.filter(d => d.status === 'complete').length;
  const missingDocsCount = adminDocs.filter(d => d.status === 'missing').length;
  const pendingDocsCount = adminDocs.filter(d => d.status === 'pending_verification').length;

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocTitle.trim() || !onAddAdminDoc) return;
    onAddAdminDoc(newDocTitle.trim(), newDocCategory);
    setNewDocTitle('');
    setShowAddForm(false);
  };

  const getStatusBadge = (status: 'complete' | 'missing' | 'pending_verification') => {
    switch (status) {
      case 'complete':
        return (
          <span 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: 'var(--emerald-raw-bg)',
              color: 'var(--emerald-raw)',
              border: '1px solid var(--emerald-raw-border)',
              padding: '3px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.725rem',
              fontWeight: 700
            }}
          >
            <CheckCircle2 size={13} /> Complete
          </span>
        );
      case 'missing':
        return (
          <span 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: 'var(--rose-urgent-bg)',
              color: 'var(--rose-urgent)',
              border: '1px solid rgba(156, 58, 34, 0.3)',
              padding: '3px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.725rem',
              fontWeight: 700
            }}
          >
            <AlertCircle size={13} /> Missing
          </span>
        );
      case 'pending_verification':
        return (
          <span 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: 'var(--amber-pending-bg)',
              color: 'var(--amber-pending)',
              border: '1px solid rgba(154, 91, 46, 0.3)',
              padding: '3px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.725rem',
              fontWeight: 700
            }}
          >
            <Clock size={13} /> Pending Verification
          </span>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner Notice */}
      <div 
        className="glass-panel"
        style={{
          padding: '16px 20px',
          borderLeft: '4px solid var(--accent-cyan)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={20} style={{ color: 'var(--accent-cyan)' }} />
            <h3 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>
              Smart Record Completeness Check
            </h3>
          </div>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Tracks administrative intake requirements and inventory of collected records for <strong>{episode.patientName}</strong> ({episode.mrn}).
          </p>
        </div>

        <div 
          style={{
            background: 'var(--bg-tertiary)',
            padding: '6px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            fontSize: '0.75rem',
            color: 'var(--text-muted)'
          }}
        >
          <span>Strictly non-diagnostic: Administrative & intake documentation tracking only.</span>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {/* Total Records */}
        <div className="glass-panel" style={{ padding: '16px 20px' }}>
          <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
            TOTAL RECORDS COLLECTED
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
              {episode.records.length}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Approved Raw Entries</span>
          </div>
          <span style={{ fontSize: '0.725rem', color: 'var(--emerald-raw)', display: 'block', marginTop: '4px' }}>
            ✓ Timeline indexing complete
          </span>
        </div>

        {/* Latest Record Date */}
        <div className="glass-panel" style={{ padding: '16px 20px' }}>
          <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
            LATEST RECORD DATE
          </span>
          <div style={{ marginTop: '6px' }}>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>
              {latestRecordDateStr}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
              {latestRecord ? `${latestRecord.title.substring(0, 32)}...` : 'None'}
            </span>
          </div>
        </div>

        {/* Administrative Docs Summary */}
        <div className="glass-panel" style={{ padding: '16px 20px' }}>
          <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
            ADMINISTRATIVE DOCUMENTS
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--emerald-raw)' }}>
              {completeDocsCount} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Complete</span>
            </span>
            <span>•</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--amber-pending)' }}>
              {pendingDocsCount} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Pending</span>
            </span>
            <span>•</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--rose-urgent)' }}>
              {missingDocsCount} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Missing</span>
            </span>
          </div>
          <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
            {adminDocs.length} total administrative requirements
          </span>
        </div>

        {/* Last Updated Timestamp */}
        <div className="glass-panel" style={{ padding: '16px 20px' }}>
          <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
            SYSTEM AUDIT TIMESTAMP
          </span>
          <div style={{ marginTop: '6px' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>
              {syncTimestamp.date}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
              Last synchronized: {syncTimestamp.time}
            </span>
          </div>
        </div>
      </div>

      {/* Records by Category Section */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <h4 style={{ fontSize: '0.95rem', color: 'var(--text-primary)', margin: '0 0 14px 0', fontWeight: 700 }}>
          Collected Records by Clinical & Administrative Category
        </h4>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          {[
            { label: 'Consultation Notes', count: categoryCounts.consultation_note, icon: <FileText size={16} />, color: 'var(--teal-primary)', desc: 'Progress & Intake notes' },
            { label: 'Care Docs & Labs', count: categoryCounts.care_document, icon: <FileCheck size={16} />, color: 'var(--navy-deep)', desc: 'Labs, Imaging, Surveys' },
            { label: 'Referral Orders', count: categoryCounts.referral, icon: <Share2 size={16} />, color: 'var(--purple-ai)', desc: 'Specialty consultations' },
            { label: 'Patient Messages', count: categoryCounts.patient_message, icon: <MessageSquare size={16} />, color: 'var(--purple-ai)', desc: 'Portal inquiries & alerts' },
            { label: 'Follow-up Records', count: categoryCounts.follow_up, icon: <Calendar size={16} />, color: 'var(--amber-pending)', desc: 'Logs, monitoring sheets' },
            { label: 'Workflow Events', count: categoryCounts.workflow_event, icon: <Activity size={16} />, color: 'var(--teal-primary)', desc: 'NST tracings, flowsheets' }
          ].map((cat, idx) => (
            <div 
              key={idx}
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
                <span style={{ color: cat.color, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {cat.icon}
                </span>
                <span 
                  style={{
                    background: cat.count > 0 ? 'rgba(22, 124, 114, 0.15)' : 'var(--bg-primary)',
                    color: cat.count > 0 ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  {cat.count}
                </span>
              </div>
              <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {cat.label}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {cat.desc}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Missing / Expected Administrative Documents Table */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h4 style={{ fontSize: '0.95rem', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>
              Administrative Document Checklist
            </h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Non-clinical intake documents, identification, communication consents, and hospital admission forms.
            </span>
          </div>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn-secondary"
            style={{ fontSize: '0.775rem', padding: '5px 12px' }}
          >
            <Plus size={14} /> Add Checklist Item
          </button>
        </div>

        {/* Optional Add Form */}
        {showAddForm && (
          <form 
            onSubmit={handleAddSubmit}
            style={{
              background: 'var(--bg-tertiary)',
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-highlight)',
              marginBottom: '16px',
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              alignItems: 'flex-end'
            }}
          >
            <div style={{ flex: '1', minWidth: '220px' }}>
              <label style={{ fontSize: '0.725rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                DOCUMENT TITLE
              </label>
              <input
                type="text"
                placeholder="e.g. Cord Blood Banking Registration Form"
                value={newDocTitle}
                onChange={(e) => setNewDocTitle(e.target.value)}
                required
                style={{
                  width: '100%',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 10px',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem'
                }}
              />
            </div>

            <div style={{ minWidth: '160px' }}>
              <label style={{ fontSize: '0.725rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                CATEGORY
              </label>
              <select
                value={newDocCategory}
                onChange={(e) => setNewDocCategory(e.target.value as any)}
                style={{
                  width: '100%',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 10px',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem'
                }}
              >
                <option value="intake">Intake / Registration</option>
                <option value="consent">Consent & Agreements</option>
                <option value="identification">Identification & Insurance</option>
                <option value="preferences">Birth Preferences / Directives</option>
                <option value="postpartum_plan">Postpartum / Pediatrician</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" className="btn-primary" style={{ fontSize: '0.775rem', padding: '6px 14px' }}>
                Save Item
              </button>
              <button 
                type="button" 
                onClick={() => setShowAddForm(false)} 
                className="btn-secondary" 
                style={{ fontSize: '0.775rem', padding: '6px 10px' }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Documents Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>DOCUMENT TITLE</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>REQUIRED STAGE</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>STATUS</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>NOTES / REASON</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {adminDocs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No administrative documents listed for this patient episode.
                  </td>
                </tr>
              ) : (
                adminDocs.map((doc) => (
                  <tr key={doc.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px', color: 'var(--text-primary)', fontWeight: 600 }}>
                      {doc.title}
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                      {doc.requiredByStage}
                    </td>
                    <td style={{ padding: '12px' }}>
                      {getStatusBadge(doc.status)}
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '0.775rem', maxWidth: '300px' }}>
                      {doc.notes || '—'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      {onUpdateAdminDocStatus && (
                        <select
                          value={doc.status}
                          onChange={(e) => onUpdateAdminDocStatus(doc.id, e.target.value as any)}
                          style={{
                            background: 'var(--bg-tertiary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '3px 8px',
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="complete">Mark Complete</option>
                          <option value="pending_verification">Mark Pending</option>
                          <option value="missing">Mark Missing</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Non-diagnostic Disclaimer Footer */}
        <div 
          style={{
            marginTop: '16px',
            padding: '10px 14px',
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.75rem',
            color: 'var(--text-muted)'
          }}
        >
          <HelpCircle size={15} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
          <span>
            <strong>Administrative Scope Notice:</strong> Completeness indicators reflect documented administrative forms and collected records only. MaternaSync strictly refrains from determining whether any medical test, ultrasound, or clinical therapy is indicated.
          </span>
        </div>
      </div>
    </div>
  );
};
