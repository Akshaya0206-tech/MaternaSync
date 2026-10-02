import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, CheckCircle2, XCircle, Send, Save } from 'lucide-react';
import {
  fetchDocument, documentFileUrl, editDocument, verifyDocument, rejectDocument, sendDocumentToDoctor,
} from '../../api/careTeamPortal';
import type { CareTeamDocument, Extraction } from '../../api/careTeamPortal';
import { fetchBlobWithAuth, ApiError } from '../../api/client';
import { StatusBadge } from '../../components/StatusBadge';
import { DOCUMENT_STATUS_TONE, formatFriendlyDateTime } from './format';
import { inputStyle } from '../../components/auth/AuthField';

const EXTRACTION_FIELDS: { key: keyof Omit<Extraction, 'fieldStatus'>; label: string }[] = [
  { key: 'recordType', label: 'Record Type' },
  { key: 'visitType', label: 'Visit Type' },
  { key: 'eventDate', label: 'Date' },
  { key: 'facility', label: 'Facility' },
  { key: 'provider', label: 'Provider' },
  { key: 'department', label: 'Department' },
  { key: 'patientNameFound', label: 'Patient Name (in document)' },
  { key: 'mrnFound', label: 'MRN' },
  { key: 'gestationalAge', label: 'Gestational Age' },
];

export function DocumentReviewPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<CareTeamDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [isActing, setIsActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = (id: string) => {
    setIsLoading(true);
    fetchDocument(id)
      .then((d) => {
        setDoc(d);
        if (d.extraction) {
          const next: Record<string, string> = {};
          EXTRACTION_FIELDS.forEach((f) => { next[f.key] = d.extraction![f.key] === 'Not found in source' ? '' : d.extraction![f.key]; });
          setDrafts(next);
        }
      })
      .catch(() => setError("We couldn't load this document. You may not be assigned to this patient."))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { if (documentId) load(documentId); }, [documentId]);

  if (!documentId) return null;

  const handleViewOriginal = async () => {
    try {
      const blob = await fetchBlobWithAuth(documentFileUrl(documentId));
      window.open(URL.createObjectURL(blob), '_blank');
    } catch {
      setActionError('The original file for this document is not available.');
    }
  };

  const handleSaveEdit = async () => {
    setIsActing(true);
    setActionError(null);
    try {
      await editDocument(documentId, {
        recordType: drafts.recordType, visitType: drafts.visitType, eventDate: drafts.eventDate,
        facility: drafts.facility, provider: drafts.provider, department: drafts.department,
        patientNameFound: drafts.patientNameFound, mrnFound: drafts.mrnFound, gestationalAge: drafts.gestationalAge,
      });
      setIsEditing(false);
      load(documentId);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not save your edits.');
    } finally {
      setIsActing(false);
    }
  };

  const handleAction = async (action: 'verify' | 'reject' | 'send') => {
    setIsActing(true);
    setActionError(null);
    try {
      if (action === 'verify') await verifyDocument(documentId, notes || undefined);
      else if (action === 'reject') await rejectDocument(documentId, notes || undefined);
      else await sendDocumentToDoctor(documentId, notes || undefined);
      setNotes('');
      load(documentId);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'That action could not be completed.');
    } finally {
      setIsActing(false);
    }
  };

  return (
    <main style={{ padding: '24px', flex: 1, maxWidth: '760px', margin: '0 auto', width: '100%' }}>
      <button onClick={() => navigate('/care-team/documents')} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--teal-primary)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, padding: 0, marginBottom: '14px' }}>
        <ArrowLeft size={15} /> Back to Documents
      </button>

      {isLoading && <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>}
      {error && !isLoading && <div className="glass-panel" style={{ padding: '24px', color: 'var(--rose-urgent)', textAlign: 'center' }}>{error}</div>}

      {doc && !isLoading && (
        <>
          <div className="glass-panel" style={{ padding: '18px 22px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div className="page-title" style={{ fontSize: '1.15rem' }}>{doc.filename}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {doc.patientName} · Uploaded by {doc.uploadedByName} ({doc.uploadedByRole}) on {formatFriendlyDateTime(doc.uploadedAt)}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <StatusBadge label={doc.statusLabel} tone={DOCUMENT_STATUS_TONE[doc.status]} />
              <button onClick={handleViewOriginal} className="btn-outline-emerald"><Eye size={14} /> View Original</button>
            </div>
          </div>

          {actionError && (
            <div className="glass-panel" style={{ padding: '10px 16px', marginBottom: '16px', color: 'var(--rose-urgent)', fontSize: '0.82rem' }}>{actionError}</div>
          )}

          <div className="glass-panel" style={{ padding: '18px 22px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Extracted Information</h2>
              {!isEditing ? (
                <button onClick={() => setIsEditing(true)} className="btn-secondary" style={{ fontSize: '0.78rem' }}>Edit</button>
              ) : (
                <button onClick={handleSaveEdit} disabled={isActing} className="btn-primary" style={{ fontSize: '0.78rem' }}><Save size={13} /> Save</button>
              )}
            </div>

            {doc.extraction ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' }}>
                {EXTRACTION_FIELDS.map((f) => {
                  const value = doc.extraction![f.key] as string;
                  const isMissing = value === 'Not found in source';
                  return (
                    <div key={f.key}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: '4px' }}>{f.label}</div>
                      {isEditing ? (
                        <input
                          value={drafts[f.key] ?? ''}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [f.key]: e.target.value }))}
                          placeholder="Needs verification"
                          style={{ ...inputStyle, padding: '7px 10px', fontSize: '0.82rem' }}
                        />
                      ) : (
                        <div style={{ fontSize: '0.86rem', fontWeight: 600, color: isMissing ? 'var(--text-muted)' : 'var(--text-primary)', fontStyle: isMissing ? 'italic' : 'normal' }}>
                          {value}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No extraction data is available for this document.</div>
            )}
          </div>

          {doc.reviews.length > 0 && (
            <div className="glass-panel" style={{ padding: '18px 22px', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px 0' }}>Review History</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {doc.reviews.map((r) => (
                  <div key={r.id} style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{r.action.replace(/_/g, ' ')}</strong> by {r.reviewerName} ({r.reviewerRole}) · {formatFriendlyDateTime(r.reviewedAt)}
                    {r.notes && <div style={{ marginTop: '2px', color: 'var(--text-muted)' }}>{r.notes}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {doc.status === 'NEEDS_REVIEW' && (
            <div className="glass-panel" style={{ padding: '18px 22px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '0.85rem', fontFamily: 'inherit', resize: 'vertical', marginBottom: '14px' }}
              />
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button onClick={() => handleAction('verify')} disabled={isActing} className="btn-primary"><CheckCircle2 size={15} /> Verify</button>
                <button onClick={() => handleAction('send')} disabled={isActing} className="btn-secondary"><Send size={14} /> Send to Doctor</button>
                <button onClick={() => handleAction('reject')} disabled={isActing} className="btn-secondary" style={{ color: 'var(--rose-urgent)' }}><XCircle size={14} /> Reject</button>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
