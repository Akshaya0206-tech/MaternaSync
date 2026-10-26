import { useEffect, useRef, useState } from 'react';
import { X, UploadCloud, FileUp, CheckCircle2, AlertTriangle, Loader2, Camera, ArrowLeft, ArrowRight, Trash2, FileText } from 'lucide-react';
import { uploadMyDocument } from '../../api/patientPortal';
import { ApiError } from '../../api/client';
import { inputStyle } from '../../components/auth/AuthField';
import { useLanguage } from '../../i18n';
import { DOCUMENT_TYPES } from './documentTypes';
import { MOST_PHOTOS, photosToPdf } from './pdfFromPhotos';

type Stage = 'pick' | 'uploading' | 'done' | 'error';

interface UploadDocumentModalProps {
  onClose: () => void;
  onUploaded: () => void;
}

/** One thing she has chosen: a PDF, or a photo (which has a small picture to show). */
interface Item {
  id: number;
  file: File;
  url: string | null;
}

const isPdf = (file: File) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
const isPhoto = (file: File) => file.type.startsWith('image/') || /\.(jpe?g|png|heic|heif|webp)$/i.test(file.name);
// What the server takes as it is. Any other kind of photo is turned into a PDF first.
const takenAsItIs = (file: File) => /\.(pdf|jpe?g|png)$/i.test(file.name);

let nextId = 1;
const labelStyle = { fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' } as const;

export function UploadDocumentModal({ onClose, onUploaded }: UploadDocumentModalProps) {
  const { t } = useLanguage();
  const [stage, setStage] = useState<Stage>('pick');
  const [isDragOver, setIsDragOver] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [documentType, setDocumentType] = useState('');
  const [description, setDescription] = useState('');
  const [documentDate, setDocumentDate] = useState('');
  const [problem, setProblem] = useState('');
  const [busyText, setBusyText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const urls = useRef<string[]>([]);

  // The small pictures are made from the files and freed when the window closes.
  useEffect(() => () => urls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const forget = (item: Item) => {
    if (item.url) {
      URL.revokeObjectURL(item.url);
      urls.current = urls.current.filter((url) => url !== item.url);
    }
  };
  const make = (file: File): Item => {
    const url = isPhoto(file) && !isPdf(file) ? URL.createObjectURL(file) : null;
    if (url) urls.current.push(url);
    return { id: nextId++, file, url };
  };

  // One PDF on its own, or any number of photos (they become one document); not both together.
  const addFiles = (chosen: File[]) => {
    if (!chosen.length) return;
    const usable = chosen.filter((file) => isPdf(file) || isPhoto(file));
    if (usable.length < chosen.length) setProblem(t('Only PDF files and photos can be added.'));
    else setProblem('');
    if (!usable.length) return;
    const pdf = usable.find(isPdf);
    if (pdf) {
      if (usable.length > 1) {
        setProblem(t('Choose one PDF, or several photos, but not both.'));
        return;
      }
      items.forEach(forget);
      setItems([make(pdf)]);
      return;
    }
    const kept = items.filter((item) => item.url);
    items.filter((item) => !item.url).forEach(forget);
    const room = MOST_PHOTOS - kept.length;
    if (usable.length > room) setProblem(t('A document can have up to {count} photos.', { count: MOST_PHOTOS }));
    setItems([...kept, ...usable.slice(0, Math.max(0, room)).map(make)]);
  };

  const remove = (index: number) => {
    forget(items[index]);
    setItems(items.filter((_, at) => at !== index));
    setProblem('');
  };

  const move = (index: number, step: number) => {
    const to = index + step;
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    [next[index], next[to]] = [next[to], next[index]];
    setItems(next);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    addFiles(Array.from(e.dataTransfer.files ?? []));
  };

  const photos = items.filter((item) => item.url);
  const canUpload = items.length > 0 && documentType !== '';

  const handleSubmit = async () => {
    if (!canUpload) return;
    setStage('uploading');
    try {
      let file: File;
      if (items.length === 1 && takenAsItIs(items[0].file)) {
        file = items[0].file;
      } else {
        // Several photos (or one the server cannot take as it is) become one PDF here, in the order shown.
        setBusyText(t('Putting your photos together…'));
        file = await photosToPdf(items.map((item) => item.file));
      }
      setBusyText(t('Uploading your document…'));
      const result = await uploadMyDocument(file, description, documentDate, documentType);
      setSuccessMessage(result.message);
      setStage('done');
    } catch (err) {
      setErrorMessage(
        err instanceof ApiError
          ? err.message
          : err instanceof Error && err.message === 'unreadable photo'
            ? t('One of the photos could not be read. Please take it again.')
            : t("We couldn't upload this document. Please try again."),
      );
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
      onKeyDown={(e) => { if (e.key === 'Escape' && stage !== 'uploading') onClose(); }}
    >
      <div
        className="glass-panel animate-fade-in upload-window"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-window-title"
        style={{ width: '100%', maxWidth: '520px', maxHeight: '92vh', overflowY: 'auto', background: 'var(--bg-card)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <strong id="upload-window-title" style={{ fontSize: '1.02rem', color: 'var(--text-primary)' }}>{t('Upload Medical Record')}</strong>
          {stage !== 'uploading' && (
            <button onClick={onClose} aria-label={t('Close')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
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
                  padding: '26px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: isDragOver ? 'var(--mint-soft)' : 'var(--bg-tertiary)',
                }}
              >
                <UploadCloud size={28} style={{ color: 'var(--teal-primary)', marginBottom: '8px' }} />
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{t('Drag & drop your file here')}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0' }}>{t('or')}</div>
                <span className="btn-secondary" style={{ display: 'inline-flex', fontSize: '0.8rem' }}>
                  <FileUp size={14} /> {t('Browse Files')}
                </span>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '10px' }}>{t('Supported: PDF, JPG, PNG')}</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,image/*"
                  multiple
                  aria-label={t('Browse Files')}
                  style={{ display: 'none' }}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }}
                />
              </div>

              <div className="upload-camera">
                <button type="button" className="btn-secondary" onClick={() => cameraInputRef.current?.click()}>
                  <Camera size={16} aria-hidden="true" /> {t('Take photos')}
                </button>
                <span>{t('Photograph a paper report, one photo for each page. They are put together as one document.')}</span>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  aria-label={t('Take photos')}
                  style={{ display: 'none' }}
                  onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }}
                />
              </div>

              {problem && <div role="alert" className="upload-problem">{problem}</div>}

              {items.length > 0 && !photos.length && (
                <div className="upload-chosen">
                  <FileText size={18} aria-hidden="true" />
                  <span className="upload-chosen-name">{items[0].file.name}</span>
                  <button type="button" className="btn-secondary" onClick={() => remove(0)} aria-label={t('Remove this file')}>{t('Remove')}</button>
                </div>
              )}

              {photos.length > 0 && (
                <div>
                  <div style={labelStyle}>
                    {photos.length === 1 ? t('1 photo') : t('{count} photos will be put together as one document, in this order.', { count: photos.length })}
                  </div>
                  <ol className="upload-photos">
                    {photos.map((item, index) => (
                      <li key={item.id}>
                        <img src={item.url ?? undefined} alt={t('Photo {number}', { number: index + 1 })} />
                        <span className="upload-page">{t('Page {number}', { number: index + 1 })}</span>
                        <span className="upload-photo-buttons">
                          <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={t('Move photo {number} earlier', { number: index + 1 })} title={t('Move earlier')}><ArrowLeft size={14} aria-hidden="true" /></button>
                          <button type="button" onClick={() => move(index, 1)} disabled={index === photos.length - 1} aria-label={t('Move photo {number} later', { number: index + 1 })} title={t('Move later')}><ArrowRight size={14} aria-hidden="true" /></button>
                          <button type="button" onClick={() => remove(index)} aria-label={t('Remove photo {number}', { number: index + 1 })} title={t('Remove')}><Trash2 size={14} aria-hidden="true" /></button>
                        </span>
                      </li>
                    ))}
                  </ol>
                  {photos.length < MOST_PHOTOS && (
                    <button type="button" className="btn-secondary" style={{ marginTop: '10px' }} onClick={() => cameraInputRef.current?.click()}>
                      <Camera size={14} aria-hidden="true" /> {t('Add another photo')}
                    </button>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="upload-type" style={labelStyle}>{t('What kind of document is it?')}</label>
                <select id="upload-type" value={documentType} onChange={(e) => setDocumentType(e.target.value)} style={inputStyle} required>
                  <option value="" disabled>{t('Choose a kind')}</option>
                  {DOCUMENT_TYPES.map((type) => <option key={type.value} value={type.value}>{t(type.label)}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="upload-description" style={labelStyle}>{t('What is this document? (optional)')}</label>
                <input
                  id="upload-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('e.g. Ultrasound report from last visit')}
                  style={inputStyle}
                />
              </div>

              <div>
                <label htmlFor="upload-date" style={labelStyle}>{t('Document date (optional)')}</label>
                <input id="upload-date" type="date" value={documentDate} onChange={(e) => setDocumentDate(e.target.value)} style={inputStyle} />
              </div>

              <button onClick={handleSubmit} disabled={!canUpload} className="btn-primary" style={{ width: '100%', padding: '11px' }}>
                {t('Upload')}
              </button>
              {items.length > 0 && !documentType && <div className="upload-hint">{t('Choose the kind of document to upload it.')}</div>}
            </div>
          )}

          {stage === 'uploading' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', padding: '24px 0' }} role="status">
              <Loader2 size={28} className="spin-slow" style={{ color: 'var(--teal-primary)' }} />
              <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{busyText || t('Uploading your document…')}</strong>
              {items.length === 1 && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{items[0].file.name}</span>}
              {items.length > 1 && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t('{count} photos', { count: items.length })}</span>}
            </div>
          )}

          {stage === 'done' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', padding: '20px 0', textAlign: 'center' }}>
              <CheckCircle2 size={30} style={{ color: 'var(--emerald-raw)' }} />
              <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>{t(successMessage)}</strong>
              <button onClick={handleDone} className="btn-primary">{t('Done')}</button>
            </div>
          )}

          {stage === 'error' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', padding: '20px 0', textAlign: 'center' }}>
              <AlertTriangle size={26} style={{ color: 'var(--rose-urgent)' }} />
              <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{errorMessage}</strong>
              <button onClick={() => setStage('pick')} className="btn-secondary">{t('Try Again')}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
