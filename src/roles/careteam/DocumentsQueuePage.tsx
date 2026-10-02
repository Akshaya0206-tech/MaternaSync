import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchDocuments } from '../../api/careTeamPortal';
import type { CareTeamDocument } from '../../api/careTeamPortal';
import { StatusBadge } from '../../components/StatusBadge';
import { DOCUMENT_STATUS_TONE, formatFriendlyDate } from './format';

const STATUS_OPTIONS = ['', 'NEEDS_REVIEW', 'PROCESSING', 'VERIFIED', 'REJECTED'];

export function DocumentsQueuePage() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<CareTeamDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('NEEDS_REVIEW');

  useEffect(() => {
    setIsLoading(true);
    fetchDocuments({ status: statusFilter || undefined })
      .then(setDocuments)
      .catch(() => setError("We couldn't load the document queue. Please try again."))
      .finally(() => setIsLoading(false));
  }, [statusFilter]);

  return (
    <main style={{ padding: '24px', flex: 1, maxWidth: '980px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
        <h1 className="page-title" style={{ fontSize: '1.4rem', margin: 0 }}>Documents</h1>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.85rem', cursor: 'pointer' }}
        >
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s ? s.replace('_', ' ') : 'All statuses'}</option>)}
        </select>
      </div>

      {isLoading && <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>}
      {error && !isLoading && <div className="glass-panel" style={{ padding: '24px', color: 'var(--rose-urgent)', textAlign: 'center' }}>{error}</div>}
      {!isLoading && !error && documents.length === 0 && (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>No documents match this filter.</div>
      )}

      {!isLoading && !error && documents.length > 0 && (
        <div className="glass-panel" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                {['Patient', 'Document', 'Uploaded By', 'Date', 'Status', ''].map((h) => (
                  <th key={h} style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>{d.patientName}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>{d.filename}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                    {d.uploadedByRole === 'patient' ? 'Patient' : `Care Team (${d.uploadedByName})`}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{formatFriendlyDate(d.uploadedAt)}</td>
                  <td style={{ padding: '12px 16px' }}><StatusBadge label={d.statusLabel} tone={DOCUMENT_STATUS_TONE[d.status]} /></td>
                  <td style={{ padding: '12px 16px' }}>
                    <button onClick={() => navigate(`/care-team/documents/${d.id}`)} className="btn-outline-emerald">Review</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
