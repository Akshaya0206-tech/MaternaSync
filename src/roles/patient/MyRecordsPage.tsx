import { useEffect, useState } from 'react';
import { Plus, FileText, Eye } from 'lucide-react';
import { fetchMyDocuments, myDocumentFileUrl } from '../../api/patientPortal';
import type { PatientDocument } from '../../api/patientPortal';
import { fetchBlobWithAuth } from '../../api/client';
import { StatusBadge } from '../../components/StatusBadge';
import type { BadgeTone } from '../../components/StatusBadge';
import { formatFriendlyDate } from './format';
import { UploadDocumentModal } from './UploadDocumentModal';

const STATUS_TONE: Record<PatientDocument['status'], BadgeTone> = {
  PROCESSING: 'neutral',
  NEEDS_REVIEW: 'amber',
  VERIFIED: 'green',
  REJECTED: 'amber',
};

export function MyRecordsPage() {
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadDocuments = () => {
    setIsLoading(true);
    fetchMyDocuments()
      .then(setDocuments)
      .catch(() => setError("We couldn't load your records. Please try again."))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { loadDocuments(); }, []);

  const handleView = async (doc: PatientDocument) => {
    try {
      const blob = await fetchBlobWithAuth(myDocumentFileUrl(doc.id));
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch {
      setNotice('The original file for this record is not available to view.');
      window.setTimeout(() => setNotice(null), 4000);
    }
  };

  return (
    <main style={{ padding: '24px', flex: 1, maxWidth: '760px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h1 className="page-title" style={{ fontSize: '1.4rem', margin: 0 }}>My Records</h1>
        <button onClick={() => setIsUploadOpen(true)} className="btn-primary">
          <Plus size={16} /> Upload Medical Record
        </button>
      </div>

      {notice && (
        <div className="glass-panel" style={{ padding: '10px 16px', marginBottom: '16px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          {notice}
        </div>
      )}

      {isLoading && (
        <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading your records…</div>
      )}

      {error && !isLoading && (
        <div className="glass-panel" style={{ padding: '24px', color: 'var(--rose-urgent)', textAlign: 'center' }}>{error}</div>
      )}

      {!isLoading && !error && documents.length === 0 && (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          You haven't uploaded any medical records yet.
        </div>
      )}

      {!isLoading && !error && documents.length > 0 && (
        <div className="glass-panel" style={{ padding: '4px 0' }}>
          {documents.map((doc, index) => (
            <div
              key={doc.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 22px',
                borderBottom: index === documents.length - 1 ? 'none' : '1px solid var(--border-color)',
              }}
            >
              <FileText size={20} style={{ color: 'var(--teal-primary)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doc.description || doc.filename}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {doc.documentDate ? formatFriendlyDate(doc.documentDate) : `Uploaded ${formatFriendlyDate(doc.uploadedAt)}`}
                </div>
              </div>
              <StatusBadge label={doc.statusLabel} tone={STATUS_TONE[doc.status]} />
              <button
                onClick={() => handleView(doc)}
                title="View original document"
                style={{ background: 'none', border: 'none', color: 'var(--teal-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}
              >
                <Eye size={18} />
              </button>
            </div>
          ))}
        </div>
      )}

      {isUploadOpen && (
        <UploadDocumentModal
          onClose={() => setIsUploadOpen(false)}
          onUploaded={() => { setIsUploadOpen(false); loadDocuments(); }}
        />
      )}
    </main>
  );
}
