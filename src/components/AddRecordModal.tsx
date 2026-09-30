import { useState } from 'react';
import type { PatientRecord, RecordCategory } from '../types/patient';
import { 
  X, 
  PlusCircle, 
  AlertTriangle, 
  Copy, 
  RefreshCw, 
  ShieldCheck, 
  FileText
} from 'lucide-react';

interface AddRecordModalProps {
  patientId: string;
  gestationalAgeWeeks: number;
  gestationalAgeDays: number;
  existingRecords: PatientRecord[];
  onClose: () => void;
  onAddRecord: (newRecord: PatientRecord) => void;
  onReplaceRecord: (oldRecordId: string, newRecord: PatientRecord) => void;
}

export const AddRecordModal: React.FC<AddRecordModalProps> = ({
  patientId,
  gestationalAgeWeeks,
  gestationalAgeDays,
  existingRecords,
  onClose,
  onAddRecord,
  onReplaceRecord
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<RecordCategory>('consultation_note');
  const [recordDate, setRecordDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [recordTime, setRecordTime] = useState('10:00');
  const [author, setAuthor] = useState('Dr. Eleanor Vance, MD');
  const [authorRole, setAuthorRole] = useState('Attending Obstetrician');
  const [facility, setFacility] = useState('St. Jude Women\'s Health Clinic');
  const [modality, setModality] = useState('EHR Clinical Note');
  const [sourceType, setSourceType] = useState('EHR Outpatient Note (FHIR Encounter)');
  const [sourceId, setSourceId] = useState(() => `EHR-IMP-${Math.floor(1000 + Math.random() * 9000)}`);
  const [summaryText, setSummaryText] = useState('');
  const [fullContent, setFullContent] = useState('');
  const [tagInput, setTagInput] = useState('Progress Visit, Routine');

  // Duplicate detection state
  const [detectedDuplicate, setDetectedDuplicate] = useState<PatientRecord | null>(null);
  const [pendingRecordToSave, setPendingRecordToSave] = useState<PatientRecord | null>(null);

  const constructRecord = (): PatientRecord => {
    const timestamp = new Date(`${recordDate}T${recordTime}:00`).toISOString();
    return {
      id: `REC-${Date.now()}`,
      patientId,
      title: title.trim(),
      category,
      timestamp,
      gestationalAgeWeeks,
      gestationalAgeDays,
      trimester: gestationalAgeWeeks <= 12 ? 1 : gestationalAgeWeeks <= 27 ? 2 : 3,
      author: author.trim(),
      authorRole: authorRole.trim(),
      facility: facility.trim(),
      modality: modality.trim(),
      sourceType: sourceType.trim(),
      summaryText: summaryText.trim(),
      fullContent: fullContent.trim() || summaryText.trim(),
      sourceId: sourceId.trim(),
      tags: tagInput.split(',').map(t => t.trim()).filter(Boolean),
      isAiStructuredOnly: false,
      verificationStatus: 'raw'
    };
  };

  const checkForDuplicate = (recordToTest: PatientRecord): PatientRecord | null => {
    const testTitle = recordToTest.title.toLowerCase().trim();
    const testDate = new Date(recordToTest.timestamp).toDateString();
    const testAuthor = recordToTest.author.toLowerCase().trim();
    const testFacility = recordToTest.facility.toLowerCase().trim();
    const testSourceId = recordToTest.sourceId.toLowerCase().trim();

    for (const rec of existingRecords) {
      const recTitle = rec.title.toLowerCase().trim();
      const recDate = new Date(rec.timestamp).toDateString();
      const recAuthor = rec.author.toLowerCase().trim();
      const recFacility = rec.facility.toLowerCase().trim();
      const recSourceId = rec.sourceId.toLowerCase().trim();

      // Check ID match
      if (testSourceId && recSourceId === testSourceId) {
        return rec;
      }

      // Check Title + (Date or Author or Facility)
      const titleMatch = recTitle === testTitle || 
        (recTitle.length > 6 && testTitle.length > 6 && (recTitle.includes(testTitle) || testTitle.includes(recTitle)));
      
      const dateMatch = recDate === testDate;
      const authorMatch = recAuthor === testAuthor;
      const facilityMatch = recFacility === testFacility;

      if (titleMatch && (dateMatch || authorMatch || facilityMatch)) {
        return rec;
      }
    }

    return null;
  };

  const handleInitialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !summaryText.trim()) return;

    const newRec = constructRecord();
    const duplicate = checkForDuplicate(newRec);

    if (duplicate) {
      setDetectedDuplicate(duplicate);
      setPendingRecordToSave(newRec);
    } else {
      onAddRecord(newRec);
      onClose();
    }
  };

  const handleKeepBoth = () => {
    if (pendingRecordToSave) {
      onAddRecord({
        ...pendingRecordToSave,
        id: `REC-${Date.now()}-KB`
      });
      onClose();
    }
  };

  const handleReplace = () => {
    if (detectedDuplicate && pendingRecordToSave) {
      onReplaceRecord(detectedDuplicate.id, {
        ...pendingRecordToSave,
        id: detectedDuplicate.id // keep consistent reference ID
      });
      onClose();
    }
  };

  const handleCancelDuplicate = () => {
    setDetectedDuplicate(null);
    setPendingRecordToSave(null);
  };

  // Helper to prefill simulated duplicate for testing
  const handleLoadSampleDuplicate = () => {
    if (existingRecords.length > 0) {
      const sample = existingRecords[0];
      setTitle(sample.title);
      setCategory(sample.category);
      setAuthor(sample.author);
      setFacility(sample.facility);
      setModality(sample.modality);
      setSourceId(sample.sourceId);
      setSummaryText(sample.summaryText);
      setFullContent(sample.fullContent);
      setRecordDate(new Date(sample.timestamp).toISOString().substring(0, 10));
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(6px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div 
        className="glass-panel animate-fade-in"
        style={{
          width: '100%',
          maxWidth: detectedDuplicate ? '760px' : '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-highlight)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div 
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-tertiary)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <PlusCircle size={20} style={{ color: 'var(--accent-cyan)' }} />
            <div>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>
                {detectedDuplicate ? 'Duplicate Record Detection' : 'Collect & Import New Patient Record'}
              </h3>
              <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                Phase 1 Non-Interpretive Raw Entry Ingestion
              </span>
            </div>
          </div>
          <button 
            onClick={onClose} 
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--text-muted)', 
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* View 1: Duplicate Detected Screen */}
        {detectedDuplicate && pendingRecordToSave ? (
          <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div 
              style={{
                background: 'var(--amber-pending-bg)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}
            >
              <AlertTriangle size={24} style={{ color: 'var(--amber-pending)', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <h4 style={{ fontSize: '1rem', color: 'var(--amber-pending)', margin: '0 0 4px 0', fontWeight: 700 }}>
                  Possible duplicate record
                </h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: 0 }}>
                  Review before adding. A record with matching title, date, author, or source ID already exists in this patient episode.
                </p>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
                  MaternaSync does not automatically delete or modify existing records without your confirmation.
                </span>
              </div>
            </div>

            {/* Comparison Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {/* Existing Record */}
              <div 
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                    EXISTING RECORD IN EPISODE
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--accent-cyan)' }}>
                    {detectedDuplicate.id}
                  </span>
                </div>

                <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  {detectedDuplicate.title}
                </strong>

                <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span>Date: <strong>{new Date(detectedDuplicate.timestamp).toLocaleString()}</strong></span>
                  <span>Author: <strong>{detectedDuplicate.author}</strong></span>
                  <span>Facility: <strong>{detectedDuplicate.facility}</strong></span>
                  <span>Source ID: <strong>{detectedDuplicate.sourceId}</strong></span>
                  <span>Category: <strong>{detectedDuplicate.category}</strong></span>
                </div>

                <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '4px', background: 'var(--bg-primary)', padding: '8px', borderRadius: '4px' }}>
                  {detectedDuplicate.summaryText}
                </p>
              </div>

              {/* New Incoming Record */}
              <div 
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-highlight)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.725rem', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                    NEW RECORD BEING IMPORTED
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--emerald-raw)' }}>
                    NEW
                  </span>
                </div>

                <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  {pendingRecordToSave.title}
                </strong>

                <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span>Date: <strong>{new Date(pendingRecordToSave.timestamp).toLocaleString()}</strong></span>
                  <span>Author: <strong>{pendingRecordToSave.author}</strong></span>
                  <span>Facility: <strong>{pendingRecordToSave.facility}</strong></span>
                  <span>Source ID: <strong>{pendingRecordToSave.sourceId}</strong></span>
                  <span>Category: <strong>{pendingRecordToSave.category}</strong></span>
                </div>

                <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '4px', background: 'var(--bg-primary)', padding: '8px', borderRadius: '4px' }}>
                  {pendingRecordToSave.summaryText}
                </p>
              </div>
            </div>

            {/* Decision Controls */}
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '12px',
                borderTop: '1px solid var(--border-color)',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <button 
                type="button" 
                onClick={handleCancelDuplicate} 
                className="btn-secondary"
                style={{ fontSize: '0.825rem' }}
              >
                Cancel / Return to Editing
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  type="button" 
                  onClick={handleReplace} 
                  className="btn-secondary"
                  style={{ 
                    fontSize: '0.825rem',
                    border: '1px solid var(--amber-pending)',
                    color: 'var(--amber-pending)'
                  }}
                >
                  <RefreshCw size={14} /> Replace Existing Record
                </button>

                <button 
                  type="button" 
                  onClick={handleKeepBoth} 
                  className="btn-primary"
                  style={{ fontSize: '0.825rem' }}
                >
                  <Copy size={14} /> Keep Both Records
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* View 2: Normal Record Form */
          <form onSubmit={handleInitialSubmit} style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Quick Demo Fill Helper */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleLoadSampleDuplicate}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.725rem',
                  textDecoration: 'underline',
                  cursor: 'pointer'
                }}
              >
                (Demo helper: Fill with existing record to test duplicate detection)
              </button>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                RECORD TITLE *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 32-Week Growth Ultrasound Scan Report"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  RECORD CATEGORY
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as RecordCategory)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem'
                  }}
                >
                  <option value="consultation_note">Consultation Note</option>
                  <option value="care_document">Care Document / Lab</option>
                  <option value="patient_message">Patient Message</option>
                  <option value="referral">Referral Order</option>
                  <option value="follow_up">Follow-up Record</option>
                  <option value="workflow_event">Workflow Event</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  RECORD DATE & TIME
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="date"
                    value={recordDate}
                    onChange={(e) => setRecordDate(e.target.value)}
                    style={{
                      flex: 1,
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      padding: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '0.825rem'
                    }}
                  />
                  <input
                    type="time"
                    value={recordTime}
                    onChange={(e) => setRecordTime(e.target.value)}
                    style={{
                      width: '95px',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      padding: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '0.825rem'
                    }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  AUTHOR / PROVIDER
                </label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  AUTHOR ROLE
                </label>
                <input
                  type="text"
                  value={authorRole}
                  onChange={(e) => setAuthorRole(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  FACILITY / CLINIC
                </label>
                <input
                  type="text"
                  value={facility}
                  onChange={(e) => setFacility(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  SOURCE ID
                </label>
                <input
                  type="text"
                  value={sourceId}
                  onChange={(e) => setSourceId(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    fontFamily: 'var(--font-mono)'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  SOURCE TYPE
                </label>
                <input
                  type="text"
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  INTEGRATION MODALITY
                </label>
                <input
                  type="text"
                  value={modality}
                  onChange={(e) => setModality(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                RECORD SUMMARY (NON-INTERPRETIVE) *
              </label>
              <textarea
                required
                rows={2}
                placeholder="Factual, non-interpretive extraction of the record content..."
                value={summaryText}
                onChange={(e) => setSummaryText(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none',
                  resize: 'vertical'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                FULL ORIGINAL CLINICAL TEXT (OPTIONAL)
              </label>
              <textarea
                rows={4}
                placeholder="Paste original note, lab output or report text here..."
                value={fullContent}
                onChange={(e) => setFullContent(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none',
                  resize: 'vertical'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                METADATA TAGS (COMMA SEPARATED)
              </label>
              <input
                type="text"
                placeholder="e.g. Ultrasound, Term Prep, Routine"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem'
                }}
              />
            </div>

            {/* Non-Diagnostic Safety Callout */}
            <div 
              style={{
                background: 'var(--emerald-raw-bg)',
                border: '1px solid var(--emerald-raw-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
                fontSize: '0.75rem',
                color: 'var(--emerald-raw)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <ShieldCheck size={16} />
              <span>All imported records are preserved as raw non-interpretive clinical entries. Initial status will be set to <strong>RAW</strong> for human care team verification.</span>
            </div>

            {/* Form Actions */}
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '12px',
                paddingTop: '12px',
                borderTop: '1px solid var(--border-color)'
              }}
            >
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                <FileText size={16} /> Import & Add Record
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
