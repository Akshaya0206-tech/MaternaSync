import { useRef, useState } from 'react';
import { X, UploadCloud, FileUp, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { uploadMyDocument } from '../../api/patientPortal';
import { ApiError } from '../../api/client';
import { inputStyle } from '../../components/auth/AuthField';

type Stage = 'pick' | 'uploading' | 'done' | 'error';

interface UploadDocumentModalProps {
  onClose: () => void;
  onUploaded: () => void;
}

export function UploadDocumentModal({ onClose, onUploaded }: UploadDocumentModalProps) {
  const [stage, setStage] = useState<Stage>('pick');
  const [isDragOver, setIsDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [documentDate, setDocumentDate] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChosen = (chosen: File | null) => {
    if (!chosen) return;
    setFile(chosen);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileChosen(e.dataTransfer.files?.[0] || null);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setStage('uploading');
    try {
      const result = await uploadMyDocument(file, description, documentDate);
      setSuccessMessage(result.message);
      setStage('done');
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "We couldn't upload this document. Please try again.");
      setStage('error');
    }
  };

  const handleDone = () => {
    onUploaded();
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={stage === 'uploading' ? undefined : onClose}
    >
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '480px', background: 'var(--bg-card)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <strong style={{ fontSize: '1.02rem', color: 'var(--text-primary)' }}>Upload Medical Record</strong>
          {stage !== 'uploading' && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
          )}
        </div>

        <div style={{ padding: '22px' }}>
          {stage === 'pick' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${isDragOver ? 'var(--teal-primary)' : 'var(--border-color)'}`,
                  borderRadius: 'var(--radius-lg)',
                  padding: '32px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: isDragOver ? 'var(--mint-soft)' : 'var(--bg-tertiary)',
                }}
              >
                <UploadCloud size={28} style={{ color: 'var(--teal-primary)', marginBottom: '8px' }} />
                {file ? (
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>{file.name}</div>
                ) : (
                  <>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>Drag & drop your file here</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0' }}>or</div>
                    <span className="btn-secondary" style={{ display: 'inline-flex', fontSize: '0.8rem' }}>
                      <FileUp size={14} /> Browse Files
                    </span>
                  </>
                )}
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '10px' }}>Supported: PDF, JPG, PNG</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileChosen(e.target.files?.[0] || null)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  What is this document? (optional)
                </label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Ultrasound report from last visit"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Document date (optional)
                </label>
                <input type="date" value={documentDate} onChange={(e) => setDocumentDate(e.target.value)} style={inputStyle} />
              </div>

              <button onClick={handleSubmit} disabled={!file} className="btn-primary" style={{ width: '100%', padding: '11px' }}>
                Upload
              </button>
            </div>
          )}

          {stage === 'uploading' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', padding: '24px 0' }}>
              <Loader2 size={28} className="spin-slow" style={{ color: 'var(--teal-primary)' }} />
              <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>Uploading your document…</strong>
              {file && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{file.name}</span>}
            </div>
          )}

          {stage === 'done' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', padding: '20px 0', textAlign: 'center' }}>
              <CheckCircle2 size={30} style={{ color: 'var(--emerald-raw)' }} />
              <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>{successMessage}</strong>
              <button onClick={handleDone} className="btn-primary">Done</button>
            </div>
          )}

          {stage === 'error' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', padding: '20px 0', textAlign: 'center' }}>
              <AlertTriangle size={26} style={{ color: 'var(--rose-urgent)' }} />
              <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{errorMessage}</strong>
              <button onClick={() => setStage('pick')} className="btn-secondary">Try Again</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
