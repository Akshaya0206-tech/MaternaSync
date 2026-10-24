import { useEffect, useState } from 'react';
import { Search, Upload, CheckCircle2, XCircle, Ban, ChevronDown, ChevronUp, AlertTriangle, BookOpen } from 'lucide-react';
import {
  searchGuidelines, fetchFilterOptions, fetchSources, uploadSource, approveSource, approveSourcesBatch, rejectSource, excludeSource,
  GUIDELINE_CATEGORIES, GUIDELINE_DOCUMENT_TYPES,
} from '../../api/clinicalGuidelines';
import type { GuidelineSearchResult, GuidelineFilterOptions, GuidelineSource } from '../../api/clinicalGuidelines';
import { ApiError } from '../../api/client';
import { StatusBadge } from '../../components/StatusBadge';
import { formatFriendlyDateTime } from './format';
import { translate, tx, useLanguage } from '../../i18n';

// The button shows the wording in the chosen language, but the search itself always runs on the English text (the guidelines are in English).
const EXAMPLE_QUERIES = [
  tx('Gestational diabetes screening window'),
  tx('Blood pressure monitoring in pregnancy'),
  tx('Postpartum follow-up visit timing'),
];

// Category and status codes are shown as capitalised words; these are the known ones, so their wording can be translated.
const CODE_LABELS: Record<string, string> = {
  ANTENATAL_CARE: tx('Antenatal Care'),
  LABOR_DELIVERY: tx('Labor Delivery'),
  POSTPARTUM: tx('Postpartum'),
  HIGH_RISK: tx('High Risk'),
  SCREENING: tx('Screening'),
  NUTRITION: tx('Nutrition'),
  MEDICATION_SAFETY: tx('Medication Safety'),
  GENERAL: tx('General'),
  PROCESSING: tx('Processing'),
  AWAITING_REVIEW: tx('Awaiting Review'),
  APPROVED: tx('Approved'),
  REJECTED: tx('Rejected'),
  EXCLUDED: tx('Excluded'),
};

function prettyLabel(value: string): string {
  const english = value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return translate(CODE_LABELS[value] ?? english);
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  'Clinical Practice Guideline': tx('Clinical Practice Guideline'),
  Protocol: tx('Protocol'),
  'Position Statement': tx('Position Statement'),
  Factsheet: tx('Factsheet'),
  Other: tx('Other'),
};

function documentTypeLabel(value: string): string {
  return translate(DOCUMENT_TYPE_LABELS[value] ?? value);
}

const COULD_NOT_ACT: Record<'approve' | 'reject' | 'exclude', string> = {
  approve: tx('Could not approve this source.'),
  reject: tx('Could not reject this source.'),
  exclude: tx('Could not exclude this source.'),
};

const SOURCE_STATUS_TONE: Record<string, 'green' | 'amber' | 'red' | 'blue' | 'purple' | 'neutral'> = {
  PROCESSING: 'neutral',
  AWAITING_REVIEW: 'amber',
  APPROVED: 'green',
  REJECTED: 'red',
  EXCLUDED: 'neutral',
};

export function GuidelinesPage() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<'search' | 'manage'>('search');

  return (
    <main style={{ padding: '24px', flex: 1, maxWidth: '860px', margin: '0 auto', width: '100%' }}>
      <h1 className="page-title" style={{ fontSize: '1.4rem', margin: '0 0 6px 0' }}>{t('Clinical Guidelines')}</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', margin: '0 0 18px 0' }}>
        {t("A reference assistant over approved guideline sources. It retrieves and shows real excerpts — it does not diagnose, prescribe, or generate clinical recommendations beyond what's in the approved library.")}
      </p>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
        <button onClick={() => setTab('search')} className={tab === 'search' ? 'btn-primary' : 'btn-secondary'} style={{ fontSize: '0.82rem' }}>
          <Search size={14} /> {t('Search')}
        </button>
        <button onClick={() => setTab('manage')} className={tab === 'manage' ? 'btn-primary' : 'btn-secondary'} style={{ fontSize: '0.82rem' }}>
          <Upload size={14} /> {t('Manage Sources')}
        </button>
      </div>

      {tab === 'search' ? <SearchView /> : <ManageSourcesView />}
    </main>
  );
}

function SearchView() {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [organization, setOrganization] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [filters, setFilters] = useState<GuidelineFilterOptions | null>(null);
  const [result, setResult] = useState<GuidelineSearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchFilterOptions().then(setFilters).catch(() => setFilters(null));
  }, []);

  const runSearch = async (q: string) => {
    if (!q.trim()) return;
    setQuery(q);
    setIsLoading(true);
    setError(null);
    try {
      const res = await searchGuidelines({
        query: q.trim(),
        category: category || undefined,
        organization: organization || undefined,
        documentType: documentType || undefined,
      });
      setResult(res);
      setExpanded(new Set());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tx('Could not complete this search.'));
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = (chunkId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(chunkId)) next.delete(chunkId); else next.add(chunkId);
      return next;
    });
  };

  return (
    <div>
      <div className="glass-panel" style={{ padding: '18px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void runSearch(query); }}
            placeholder={t('Ask a question or search a guideline topic…')}
            style={{ flex: 1, padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.88rem' }}
          />
          <button onClick={() => void runSearch(query)} disabled={isLoading || !query.trim()} className="btn-primary">
            <Search size={14} /> {t('Search')}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={selectStyle}>
            <option value="">{t('All categories')}</option>
            {(filters?.categories ?? GUIDELINE_CATEGORIES).map((c) => <option key={c} value={c}>{prettyLabel(c)}</option>)}
          </select>
          <select value={organization} onChange={(e) => setOrganization(e.target.value)} style={selectStyle}>
            <option value="">{t('All organizations')}</option>
            {(filters?.organizations ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} style={selectStyle}>
            <option value="">{t('All document types')}</option>
            {(filters?.documentTypes ?? GUIDELINE_DOCUMENT_TYPES).map((d) => <option key={d} value={d}>{documentTypeLabel(d)}</option>)}
          </select>
        </div>
      </div>

      {!result && !isLoading && !error && (
        <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
          <BookOpen size={28} style={{ color: 'var(--text-muted)', marginBottom: '10px' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', marginBottom: '12px' }}>
            {t('Try a question like:')}
          </p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {EXAMPLE_QUERIES.map((q) => (
              <button key={q} onClick={() => void runSearch(q)} className="btn-secondary" style={{ fontSize: '0.78rem' }}>{t(q)}</button>
            ))}
          </div>
        </div>
      )}

      {isLoading && <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>{t('Searching approved sources…')}</div>}
      {error && !isLoading && <div className="glass-panel" style={{ padding: '18px', color: 'var(--rose-urgent)', textAlign: 'center' }}>{t(error)}</div>}

      {result && !isLoading && !result.hasSufficientEvidence && (
        <div className="glass-panel" style={{ padding: '20px', textAlign: 'center' }}>
          <AlertTriangle size={20} style={{ color: 'var(--amber-pending)', marginBottom: '8px' }} />
          <p style={{ color: 'var(--text-primary)', fontSize: '0.86rem' }}>{t(result.answerText)}</p>
        </div>
      )}

      {result && !isLoading && result.hasSufficientEvidence && (
        <div>
          {result.disagreementPossible && (
            <div className="glass-panel" style={{ padding: '12px 16px', marginBottom: '12px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              {t('These results come from more than one source — reviewed separately below.')}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {result.excerpts.map((e) => {
              const isOpen = expanded.has(e.chunkId);
              return (
                <div key={e.chunkId} className="glass-panel" style={{ padding: '16px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '6px' }}>
                    <div>
                      <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>{e.issuingOrganization}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {e.sourceTitle}{e.version && `, ${e.version}`}{e.publicationDate && ` (${e.publicationDate})`}{e.pageNumber && `, p.${e.pageNumber}`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      {e.isDemoContent && <StatusBadge label={t('Synthetic Demo Source')} tone="purple" />}
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t('similarity {score}', { score: e.similarityScore })}</span>
                    </div>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: '0 0 6px 0', lineHeight: 1.5 }}>
                    {isOpen || e.excerptText.length < 220 ? e.excerptText : `${e.excerptText.slice(0, 220)}…`}
                  </p>
                  {e.excerptText.length >= 220 && (
                    <button onClick={() => toggleExpand(e.chunkId)} style={{ background: 'none', border: 'none', color: 'var(--teal-primary)', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                      {isOpen ? t('Show less') : t('Show more')}
                    </button>
                  )}
                  {e.sourceUrl && (
                    <div style={{ marginTop: '8px' }}>
                      <a href={e.sourceUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.78rem', color: 'var(--teal-primary)', fontWeight: 600 }}>{t('Original source ↗')}</a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)',
  background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.8rem', cursor: 'pointer',
};

function ManageSourcesView() {
  const { t } = useLanguage();
  const [sources, setSources] = useState<GuidelineSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [org, setOrg] = useState('');
  const [category, setCategory] = useState<string>(GUIDELINE_CATEGORIES[0]);
  const [docType, setDocType] = useState<string>(GUIDELINE_DOCUMENT_TYPES[0]);
  const [version, setVersion] = useState('');
  const [pubDate, setPubDate] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [batchConfirmed, setBatchConfirmed] = useState(false);

  const load = () => {
    setIsLoading(true);
    fetchSources().then(setSources).catch(() => setError(tx("We couldn't load guideline sources."))).finally(() => setIsLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim() || !org.trim()) return;
    setIsUploading(true);
    setError(null);
    try {
      await uploadSource({
        file, title: title.trim(), issuingOrganization: org.trim(), category, documentType: docType,
        version: version.trim() || undefined, publicationDate: pubDate.trim() || undefined, sourceUrl: sourceUrl.trim() || undefined,
      });
      setFile(null); setTitle(''); setOrg(''); setVersion(''); setPubDate(''); setSourceUrl('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tx('Could not upload this source.'));
    } finally {
      setIsUploading(false);
    }
  };

  const act = async (action: 'approve' | 'reject' | 'exclude', sourceId: string) => {
    setError(null);
    const notes = notesById[sourceId];
    try {
      const fn = action === 'approve' ? approveSource : action === 'reject' ? rejectSource : excludeSource;
      await fn(sourceId, notes || undefined);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : COULD_NOT_ACT[action]);
    }
  };

  const approveAll = async () => {
    setError(null);
    try {
      const result = await approveSourcesBatch(awaiting.map((s) => s.id));
      setBatchConfirmed(false);
      load();
      if (result.failed.length) setError(t('{approved} approved. {failed} could not be approved: {reasons}', { approved: result.approved.length, failed: result.failed.length, reasons: result.failed.map((f) => t(f.reason)).join('; ') }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tx('Could not approve these sources.'));
    }
  };

  const awaiting = sources.filter((s) => s.status === 'AWAITING_REVIEW');
  const approved = sources.filter((s) => s.status === 'APPROVED');
  const other = sources.filter((s) => s.status !== 'AWAITING_REVIEW' && s.status !== 'APPROVED');

  return (
    <div>
      <form onSubmit={handleUpload} className="glass-panel" style={{ padding: '18px', marginBottom: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>{t('Upload a Guideline Source (PDF)')}</div>
        <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ fontSize: '0.82rem' }} />
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input placeholder={t('Title')} value={title} onChange={(e) => setTitle(e.target.value)} style={textInputStyle} />
          <input placeholder={t('Issuing organization')} value={org} onChange={(e) => setOrg(e.target.value)} style={textInputStyle} />
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={selectStyle}>
            {GUIDELINE_CATEGORIES.map((c) => <option key={c} value={c}>{prettyLabel(c)}</option>)}
          </select>
          <select value={docType} onChange={(e) => setDocType(e.target.value)} style={selectStyle}>
            {GUIDELINE_DOCUMENT_TYPES.map((d) => <option key={d} value={d}>{documentTypeLabel(d)}</option>)}
          </select>
          <input placeholder={t('Version (optional)')} value={version} onChange={(e) => setVersion(e.target.value)} style={{ ...textInputStyle, maxWidth: '140px' }} />
          <input placeholder={t('Publication date (optional)')} value={pubDate} onChange={(e) => setPubDate(e.target.value)} style={{ ...textInputStyle, maxWidth: '180px' }} />
        </div>
        <input placeholder={t('Source URL (optional)')} value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} style={textInputStyle} />
        <button type="submit" disabled={isUploading || !file || !title.trim() || !org.trim()} className="btn-primary" style={{ alignSelf: 'flex-start' }}>
          <Upload size={14} /> {isUploading ? t('Uploading…') : t('Upload for Review')}
        </button>
      </form>

      {error && <div className="glass-panel" style={{ padding: '14px', color: 'var(--rose-urgent)', textAlign: 'center', marginBottom: '14px' }}>{t(error)}</div>}
      {isLoading && <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>{t('Loading…')}</div>}

      {!isLoading && (
        <>
          <SectionLabel>{t('Awaiting Review ({count})', { count: awaiting.length })}</SectionLabel>
          {awaiting.length === 0 && <EmptyRow text={t('Nothing awaiting review.')} />}
          {awaiting.length > 1 && (
            <div className="glass-panel" style={{ padding: '14px 16px', marginBottom: '10px' }}>
              <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '0.8rem', marginBottom: '10px' }}>
                <input type="checkbox" checked={batchConfirmed} onChange={(e) => setBatchConfirmed(e.target.checked)} />
                {t('I reviewed each of these {count} documents, their publisher, version and licence, and approve them for passage search with my professional signature.', { count: awaiting.length })}
              </label>
              <button className="btn-primary" disabled={!batchConfirmed} onClick={() => void approveAll()} style={{ fontSize: '0.78rem' }}>
                <CheckCircle2 size={13} /> {t('Approve all {count}', { count: awaiting.length })}
              </button>
            </div>
          )}
          {awaiting.map((s) => (
            <SourceRow key={s.id} source={s}>
              <input
                placeholder={t('Review notes (optional)')}
                value={notesById[s.id] ?? ''}
                onChange={(e) => setNotesById((prev) => ({ ...prev, [s.id]: e.target.value }))}
                style={{ ...textInputStyle, fontSize: '0.76rem', marginBottom: '8px' }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => void act('approve', s.id)} className="btn-primary" style={{ fontSize: '0.76rem' }}><CheckCircle2 size={13} /> {t('Approve')}</button>
                <button onClick={() => void act('reject', s.id)} className="btn-secondary" style={{ fontSize: '0.76rem', color: 'var(--rose-urgent)' }}><XCircle size={13} /> {t('Reject')}</button>
              </div>
            </SourceRow>
          ))}

          <SectionLabel>{t('Approved ({count})', { count: approved.length })}</SectionLabel>
          {approved.length === 0 && <EmptyRow text={t('No approved sources yet.')} />}
          {approved.map((s) => (
            <SourceRow key={s.id} source={s}>
              <button onClick={() => void act('exclude', s.id)} className="btn-secondary" style={{ fontSize: '0.76rem' }}><Ban size={13} /> {t('Exclude')}</button>
            </SourceRow>
          ))}

          {other.length > 0 && (
            <>
              <SectionLabel>{t('Other ({count})', { count: other.length })}</SectionLabel>
              {other.map((s) => <SourceRow key={s.id} source={s} />)}
            </>
          )}
        </>
      )}
    </div>
  );
}

const textInputStyle: React.CSSProperties = {
  flex: 1, padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)',
  background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.82rem', minWidth: '160px',
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.02em', margin: '18px 0 8px 0' }}>{children}</div>;
}

function EmptyRow({ text }: { text: string }) {
  return <div className="glass-panel" style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>{text}</div>;
}

function SourceRow({ source, children }: { source: GuidelineSource; children?: React.ReactNode }) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="glass-panel" style={{ padding: '14px 16px', marginBottom: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>{source.title}</span>
            {source.isDemoContent && <StatusBadge label={t('Demo')} tone="purple" />}
          </div>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {source.issuingOrganization} · {prettyLabel(source.category)} · {documentTypeLabel(source.documentType)} · {t('{count} passage(s)', { count: source.chunkCount })}
            {source.lastReviewedAt && ` · ${t('Reviewed {date}', { date: formatFriendlyDateTime(source.lastReviewedAt) })}`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <StatusBadge label={prettyLabel(source.status)} tone={SOURCE_STATUS_TONE[source.status] ?? 'neutral'} />
          <button onClick={() => setExpanded((v) => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>
      {expanded && children && <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>{children}</div>}
    </div>
  );
}
