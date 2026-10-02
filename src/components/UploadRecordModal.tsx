import { useRef, useState } from 'react';
import { X, UploadCloud, FileUp, CheckCircle2, AlertTriangle, MinusCircle, Loader2, ThumbsDown, ClipboardCheck } from 'lucide-react';
import { uploadRecord, updateRecord, approveRecord, rejectRecord, recordSourceUrl } from '../api/patients';
import type { ExtractedFields, ExtractedField } from '../api/patients';
import { fetchBlobWithAuth, ApiError } from '../api/client';
import { inputStyle } from './auth/AuthField';

type Stage = 'pick' | 'processing' | 'review' | 'error';

interface UploadRecordModalProps {
  patientId: string;
  onClose: () => void;
  onApproved: () => void;
}

const PROCESSING_STEPS = ['Uploading…', 'Reading document…', 'Extracting information…'];

const FIELD_LABELS: Record<keyof ExtractedFields, string> = {
  recordType: 'Record Type',
  visitType: 'Visit Type',
  date: 'Date',
  facility: 'Facility',
  responsibleDoctor: 'Responsible Doctor',
  gestationalAge: 'Gestational Age',
  patientName: 'Patient Name',
  mrn: 'MRN',
};

function FieldStatusIcon({ status }: { status: ExtractedField['status'] }) {
  if (status === 'extracted') return <CheckCircle2 size={14} style={{ color: 'var(--emerald-raw)' }} />;
  if (status === 'needs_review') return <AlertTriangle size={14} style={{ color: 'var(--amber-pending)' }} />;
  return <MinusCircle size={14} style={{ color: 'var(--text-muted)' }} />;
}

export const UploadRecordModal: React.FC<UploadRecordModalProps> = ({ patientId, onClose, onApproved }) => {
  const [stage, setStage] = useState<Stage>('pick');
  const [isDragOver, setIsDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [fields, setFields] = useState<ExtractedFields | null>(null);
  const [ocrUnavailable, setOcrUnavailable] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editable core fields (mapped onto real record columns)
  const [titleDraft, setTitleDraft] = useState('');
  const [dateDraft, setDateDraft] = useState('');
  const [facilityDraft, setFacilityDraft] = useState('');
  const [doctorDraft, setDoctorDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleFileChosen = (chosen: File | null) => {
    if (!chosen) return;
    setFile(chosen);
    void processFile(chosen);
  };

  const processFile = async (chosen: File) => {
    setStage('processing');
    setStepIndex(0);
    const timers = [
      window.setTimeout(() => setStepIndex(1), 600),
      window.setTimeout(() => setStepIndex(2), 1300),
    ];
    try {
      const result = await uploadRecord(patientId, chosen);
      timers.forEach(window.clearTimeout);
      setRecordId(result.record.id);
      setFields(result.extractedFields);
      setOcrUnavailable(result.ocrUnavailable);
      setTitleDraft(result.record.title);
      setDateDraft(result.record.timestamp);
      setFacilityDraft(result.record.facility === 'Not found in source' ? '' : result.record.facility);
      setDoctorDraft(result.record.author === 'Not found in source' ? '' : result.record.author);
      setStage('review');
    } catch (err) {
      timers.forEach(window.clearTimeout);
      setErrorMessage(err instanceof ApiError ? err.message : "We couldn't extract information from this document.");
      setStage('error');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileChosen(e.dataTransfer.files?.[0] || null);
  };

  const handleApprove = async () => {
    if (!recordId) return;
    setIsSaving(true);
    try {
      await updateRecord(patientId, recordId, {
        title: titleDraft,
        timestamp: dateDraft,
        facility: facilityDraft || 'Not found in source',
        author: doctorDraft || 'Not found in source',
      });
      await approveRecord(patientId, recordId);
      onApproved();
    } catch {
      setErrorMessage('Could not save this record. Please try again.');
      setStage('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReject = async () => {
    if (!recordId) return;
    setIsSaving(true);
    try {
      await rejectRecord(patientId, recordId);
      onApproved();
    } finally {
      setIsSaving(false);
    }
  };

  const handleViewOriginal = async () => {
    if (!recordId) return;
    try {
      const blob = await fetchBlobWithAuth(recordSourceUrl(patientId, recordId));
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch {
      setErrorMessage('Could not open the original source file.');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={stage === 'processing' ? undefined : onClose}>
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '560px', maxHeight: '88vh', overflowY: 'auto', background: 'var(--bg-card)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>
            {stage === 'review' ? 'Review Extracted Record' : 'Add Medical Record'}
          </strong>
          {stage !== 'processing' && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
          )}
        </div>

        <div style={{ padding: '22px' }}>
          {stage === 'pick' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                Upload an existing medical document and MaternaSync will organize the information for review.
              </p>
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${isDragOver ? 'var(--teal-primary)' : 'var(--border-color)'}`,
                  borderRadius: 'var(--radius-lg)',
                  padding: '40px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: isDragOver ? 'var(--mint-soft)' : 'var(--bg-tertiary)',
                  transition: 'background 0.15s ease, border-color 0.15s ease'
                }}
              >
                <UploadCloud size={30} style={{ color: 'var(--teal-primary)', marginBottom: '10px' }} />
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Drag & drop your file here</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0' }}>or</div>
                <span className="btn-secondary" style={{ display: 'inline-flex', fontSize: '0.825rem' }}>
                  <FileUp size={14} /> Browse Files
                </span>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '12px' }}>Supported: PDF, JPG, PNG</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.tiff,.bmp"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileChosen(e.target.files?.[0] || null)}
                />
              </div>
            </div>
          )}

          {stage === 'processing' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', padding: '20px 0' }}>
              <Loader2 size={28} className="spin-slow" style={{ color: 'var(--teal-primary)' }} />
              <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{PROCESSING_STEPS[stepIndex]}</strong>
              {file && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{file.name}</span>}
            </div>
          )}

          {stage === 'error' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', padding: '16px 0', textAlign: 'center' }}>
              <AlertTriangle size={26} style={{ color: 'var(--rose-urgent)' }} />
              <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{errorMessage}</strong>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setStage('pick')} className="btn-secondary" style={{ fontSize: '0.825rem' }}>Try Again</button>
              </div>
            </div>
          )}

          {stage === 'review' && fields && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {ocrUnavailable && (
                <div style={{ background: 'var(--amber-pending-bg)', color: 'var(--amber-pending)', borderRadius: 'var(--radius-md)', padding: '9px 12px', fontSize: '0.78rem' }}>
                  This looks like a scanned document, but OCR isn't available on this server. Fields below may be incomplete — please fill them in manually.
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <EditableReviewField label="Record Type" status={fields.recordType.status}>
                  <input value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} style={inputStyle} />
                </EditableReviewField>
                <EditableReviewField label="Date" status={fields.date.status}>
                  <input type="date" value={dateDraft} onChange={(e) => setDateDraft(e.target.value)} style={inputStyle} />
                </EditableReviewField>
                <EditableReviewField label="Facility" status={fields.facility.status}>
                  <input value={facilityDraft} onChange={(e) => setFacilityDraft(e.target.value)} placeholder="Not found in source" style={inputStyle} />
                </EditableReviewField>
                <EditableReviewField label="Responsible Doctor" status={fields.responsibleDoctor.status}>
                  <input value={doctorDraft} onChange={(e) => setDoctorDraft(e.target.value)} placeholder="Not found in source" style={inputStyle} />
                </EditableReviewField>
              </div>

              <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Also Detected</span>
                {(['visitType', 'gestationalAge', 'patientName', 'mrn'] as const).map(key => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                      <FieldStatusIcon status={fields[key].status} /> {FIELD_LABELS[key]}
                    </span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      {fields[key].value || 'Not found in source'}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <span>Source: {file?.name}</span>
                <button onClick={handleViewOriginal} style={{ background: 'none', border: 'none', color: 'var(--teal-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem' }}>
                  View Original
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: '4px' }}>
                <button onClick={handleReject} disabled={isSaving} className="btn-secondary" style={{ fontSize: '0.825rem', color: 'var(--rose-urgent)' }}>
                  <ThumbsDown size={14} /> Reject Record
                </button>
                <button onClick={handleApprove} disabled={isSaving} className="btn-primary" style={{ fontSize: '0.825rem' }}>
                  <ClipboardCheck size={15} /> {isSaving ? 'Saving…' : 'Approve & Add to Journey'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const EditableReviewField: React.FC<{ label: string; status: ExtractedField['status']; children: React.ReactNode }> = ({ label, status, children }) => (
  <div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
      <FieldStatusIcon status={status} />
      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{label}</span>
    </div>
    {children}
  </div>
);
