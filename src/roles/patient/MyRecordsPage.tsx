import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, FileText, Eye, Search } from 'lucide-react';
import { fetchMyDocuments, myDocumentFileUrl } from '../../api/patientPortal';
import type { PatientDocument } from '../../api/patientPortal';
import { fetchBlobWithAuth } from '../../api/client';
import { StatusBadge } from '../../components/StatusBadge';
import type { BadgeTone } from '../../components/StatusBadge';
import { formatFriendlyDate, friendlyDocumentStatus } from './format';
import { UploadDocumentModal } from './UploadDocumentModal';
import { DOCUMENT_TYPES, typeLabel } from './documentTypes';
import { tx, useLanguage } from '../../i18n';

const STATUS_TONE: Record<PatientDocument['status'], BadgeTone> = {
  PROCESSING: 'neutral',
  NEEDS_REVIEW: 'amber',
  VERIFIED: 'green',
  REJECTED: 'red',
};

// What each label means, in plain words. It only says where the file is in the clinic's checking, never anything about what is in it.
const STATUS_MEANING: Record<PatientDocument['status'], string> = {
  PROCESSING: tx('The file has arrived and is being read.'),
  NEEDS_REVIEW: tx('Your doctor’s clinic has not checked this file yet.'),
  VERIFIED: tx('Your doctor’s clinic has checked this file and added it to your record.'),
  REJECTED: tx('Your doctor’s clinic could not use this file. You can upload a clearer copy.'),
};
const STATUS_ORDER: PatientDocument['status'][] = ['PROCESSING', 'NEEDS_REVIEW', 'VERIFIED', 'REJECTED'];

const UNTYPED = 'untyped'; // the filter for records that have no type
const kindOf = (doc: PatientDocument) => doc.documentType ?? UNTYPED;

export function MyRecordsPage() {
  const { t } = useLanguage();
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [params] = useSearchParams();
  const [isUploadOpen, setIsUploadOpen] = useState(params.get('upload') === '1'); // the Upload a report button on My Care opens it at once
  const [notice, setNotice] = useState<string | null>(null);
  const [kind, setKind] = useState('all');
  const [query, setQuery] = useState('');

  const loadDocuments = () => {
    setIsLoading(true);
    fetchMyDocuments()
      .then(setDocuments)
      .catch(() => setError(t("We couldn't load your records. Please try again.")))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { loadDocuments(); }, []);

  const handleView = async (doc: PatientDocument) => {
    try {
      const blob = await fetchBlobWithAuth(myDocumentFileUrl(doc.id));
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch {
      setNotice(t('The original file for this record is not available to view.'));
      window.setTimeout(() => setNotice(null), 4000);
    }
  };

  // The date shown under a record: the date she gave it, else the day it was uploaded.
  const whenOf = (doc: PatientDocument) => (doc.documentDate ? formatFriendlyDate(doc.documentDate) : formatFriendlyDate(doc.uploadedAt));
  // The title: her own description, else the kind of document with its date, else the file's name.
  const titleOf = (doc: PatientDocument) => doc.description?.trim() || (doc.documentType ? `${t(typeLabel(doc.documentType))} · ${whenOf(doc)}` : doc.filename);

  // Only the kinds that are in her list get a filter button, in the same order as the upload form.
  const kinds = useMemo(() => {
    const present = new Set(documents.map(kindOf));
    return [
      ...DOCUMENT_TYPES.filter((type) => present.has(type.value)).map((type) => ({ value: type.value as string, label: type.label })),
      ...(present.has(UNTYPED) ? [{ value: UNTYPED, label: typeLabel(null) }] : []),
    ];
  }, [documents]);
  const activeKind = kind === 'all' || kinds.some((item) => item.value === kind) ? kind : 'all'; // a kind with nothing left falls back to All

  const needle = query.trim().toLowerCase();
  const shown = documents.filter((doc) => {
    if (activeKind !== 'all' && kindOf(doc) !== activeKind) return false;
    if (!needle) return true;
    return [titleOf(doc), doc.description, doc.filename, t(typeLabel(doc.documentType)), friendlyDocumentStatus(doc.status, doc.statusLabel)].some((text) => text?.toLowerCase().includes(needle));
  });
  const count = (value: string) => (value === 'all' ? documents.length : documents.filter((doc) => kindOf(doc) === value).length);

  return (
    <main className="continuity-page records-page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h1 className="page-title" style={{ fontSize: '1.4rem', margin: 0 }}>{t('My Records')}</h1>
        <button onClick={() => setIsUploadOpen(true)} className="btn-primary">
          <Plus size={16} /> {t('Upload Medical Record')}
        </button>
      </div>

      {notice && (
        <div className="glass-panel" role="status" style={{ padding: '10px 16px', marginBottom: '16px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          {notice}
        </div>
      )}

      {isLoading && (
        <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>{t('Loading your records…')}</div>
      )}

      {error && !isLoading && (
        <div className="glass-panel" style={{ padding: '24px', color: 'var(--rose-urgent)', textAlign: 'center' }}>{error}</div>
      )}

      {!isLoading && !error && documents.length === 0 && (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          {t("You haven't uploaded any medical records yet.")}
        </div>
      )}

      {!isLoading && !error && documents.length > 0 && (
        <>
          <details className="records-legend glass-panel">
            <summary>{t('What do these labels mean?')}</summary>
            <dl>
              {STATUS_ORDER.map((status) => (
                <div key={status}>
                  <dt><StatusBadge label={friendlyDocumentStatus(status, status)} tone={STATUS_TONE[status]} /></dt>
                  <dd>{t(STATUS_MEANING[status])}</dd>
                </div>
              ))}
            </dl>
          </details>

          <div className="records-toolbar">
            <label className="records-search">
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label={t('Search my records')}
                placeholder={t('Search by title, kind or file name')}
              />
            </label>
            {kinds.length > 1 && (
              <div className="records-chips" role="group" aria-label={t('Show only')}>
                {[{ value: 'all', label: tx('All') }, ...kinds].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className="records-chip"
                    aria-pressed={activeKind === item.value}
                    onClick={() => setKind(item.value)}
                  >
                    {t(item.label)} ({count(item.value)})
                  </button>
                ))}
              </div>
            )}
          </div>

          {shown.length === 0 ? (
            <div className="glass-panel" role="status" style={{ padding: '28px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <p style={{ margin: '0 0 12px' }}>{t('No records match what you chose.')}</p>
              <button type="button" className="btn-secondary" onClick={() => { setQuery(''); setKind('all'); }}>{t('Show all my records')}</button>
            </div>
          ) : (
            <ul className="glass-panel records-list">
              {shown.map((doc) => {
                const title = titleOf(doc);
                return (
                  <li key={doc.id} className="records-row">
                    <FileText size={20} className="records-icon" aria-hidden="true" />
                    <div className="records-body">
                      <div className="records-title">{title}</div>
                      <div className="records-meta">
                        <span className="records-type">{t(typeLabel(doc.documentType))}</span>
                        <span>{doc.documentDate ? formatFriendlyDate(doc.documentDate) : t('Uploaded {date}', { date: formatFriendlyDate(doc.uploadedAt) })}</span>
                        {doc.filename !== title && <span className="records-file">{t('File')}: {doc.filename}</span>}
                      </div>
                      {doc.status !== 'VERIFIED' && <div className="records-status-line">{t(STATUS_MEANING[doc.status])}</div>}
                    </div>
                    <StatusBadge label={friendlyDocumentStatus(doc.status, doc.statusLabel)} tone={STATUS_TONE[doc.status]} />
                    <button
                      type="button"
                      onClick={() => handleView(doc)}
                      className="btn-secondary records-view"
                      aria-label={`${t('View')}: ${title}`}
                      title={t('View original document')}
                    >
                      <Eye size={16} aria-hidden="true" /> {t('View')}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
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
