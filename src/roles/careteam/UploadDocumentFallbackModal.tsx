import { useRef, useState } from 'react';
import { X, UploadCloud, FileUp, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { uploadDocumentFallback } from '../../api/careTeamPortal';
import { ApiError } from '../../api/client';
import { inputStyle } from '../../components/auth/AuthField';

type Stage = 'pick' | 'uploading' | 'done' | 'error';

interface Props {
  episodeId: string;
  onClose: () => void;
  onUploaded: () => void;
}

export function UploadDocumentFallbackModal({ episodeId, onClose, onUploaded }: Props) {
  const [stage, setStage] = useState<Stage>('pick');
  const [isDragOver, setIsDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChosen = (chosen: File | null) => { if (chosen) setFile(chosen); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); handleFileChosen(e.dataTransfer.files?.[0] || null); };

  const handleSubmit = async () => {
    if (!file) return;
    setStage('uploading');
    try {
      await uploadDocumentFallback(episodeId, file, description);
      setStage('done');
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "We couldn't upload this document. Please try again.");
      setStage('error');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={stage === 'uploading' ? undefined : onClose}>
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '480px', background: 'var(--bg-card)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <strong style={{ fontSize: '1.02rem', color: 'var(--text-primary)' }}>Upload Document (Fallback)</strong>
          {stage !== 'uploading' && <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>}
        </div>
        <div style={{ padding: '22px' }}>
          {stage === 'pick' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                The patient is the primary uploader. Use this only for documents received outside the patient portal (fax, phone, in person).
              </p>
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{ border: `2px dashed ${isDragOver ? 'var(--teal-primary)' : 'var(--border-color)'}`, borderRadius: 'var(--radius-lg)', padding: '28px 20px', textAlign: 'center', cursor: 'pointer', background: isDragOver ? 'var(--mint-soft)' : 'var(--bg-tertiary)' }}
              >
                <UploadCloud size={26} style={{ color: 'var(--teal-primary)', marginBottom: '8px' }} />
                {file ? (
                  <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>{file.name}</div>
                ) : (
                  <>
                    <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>Drag & drop or</div>
                    <span className="btn-secondary" style={{ display: 'inline-flex', fontSize: '0.78rem', marginTop: '6px' }}><FileUp size={13} /> Browse Files</span>
                  </>
                )}
                <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={(e) => handleFileChosen(e.target.files?.[0] || null)} />
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Description</label>
                <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Fax received from outside clinic" style={inputStyle} />
              </div>
              <button onClick={handleSubmit} disabled={!file} className="btn-primary" style={{ width: '100%', padding: '11px' }}>Upload</button>
            </div>
          )}
          {stage === 'uploading' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', padding: '24px 0' }}>
              <Loader2 size={28} className="spin-slow" style={{ color: 'var(--teal-primary)' }} />
              <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>Uploading…</strong>
            </div>
          )}
          {stage === 'done' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', padding: '20px 0', textAlign: 'center' }}>
              <CheckCircle2 size={30} style={{ color: 'var(--emerald-raw)' }} />
              <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>Document uploaded and added to the review queue.</strong>
              <button onClick={onUploaded} className="btn-primary">Done</button>
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
