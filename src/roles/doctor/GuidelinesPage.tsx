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

const EXAMPLE_QUERIES = [
  'Gestational diabetes screening window',
  'Blood pressure monitoring in pregnancy',
  'Postpartum follow-up visit timing',
];

function prettyLabel(value: string): string {
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

const SOURCE_STATUS_TONE: Record<string, 'green' | 'amber' | 'red' | 'blue' | 'purple' | 'neutral'> = {
  PROCESSING: 'neutral',
  AWAITING_REVIEW: 'amber',
  APPROVED: 'green',
  REJECTED: 'red',
  EXCLUDED: 'neutral',
};

export function GuidelinesPage() {
  const [tab, setTab] = useState<'search' | 'manage'>('search');

  return (
    <main style={{ padding: '24px', flex: 1, maxWidth: '860px', margin: '0 auto', width: '100%' }}>
      <h1 className="page-title" style={{ fontSize: '1.4rem', margin: '0 0 6px 0' }}>Clinical Guidelines</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', margin: '0 0 18px 0' }}>
        A reference assistant over approved guideline sources. It retrieves and shows real excerpts — it does
        not diagnose, prescribe, or generate clinical recommendations beyond what's in the approved library.
      </p>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
        <button onClick={() => setTab('search')} className={tab === 'search' ? 'btn-primary' : 'btn-secondary'} style={{ fontSize: '0.82rem' }}>
          <Search size={14} /> Search
        </button>
        <button onClick={() => setTab('manage')} className={tab === 'manage' ? 'btn-primary' : 'btn-secondary'} style={{ fontSize: '0.82rem' }}>
          <Upload size={14} /> Manage Sources
        </button>
      </div>

      {tab === 'search' ? <SearchView /> : <ManageSourcesView />}
    </main>
  );
}

function SearchView() {
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
      setError(err instanceof ApiError ? err.message : 'Could not complete this search.');
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
            placeholder="Ask a question or search a guideline topic…"
            style={{ flex: 1, padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.88rem' }}
          />
          <button onClick={() => void runSearch(query)} disabled={isLoading || !query.trim()} className="btn-primary">
            <Search size={14} /> Search
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={selectStyle}>
            <option value="">All categories</option>
            {(filters?.categories ?? GUIDELINE_CATEGORIES).map((c) => <option key={c} value={c}>{prettyLabel(c)}</option>)}
          </select>
          <select value={organization} onChange={(e) => setOrganization(e.target.value)} style={selectStyle}>
            <option value="">All organizations</option>
            {(filters?.organizations ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} style={selectStyle}>
            <option value="">All document types</option>
            {(filters?.documentTypes ?? GUIDELINE_DOCUMENT_TYPES).map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {!result && !isLoading && !error && (
        <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
          <BookOpen size={28} style={{ color: 'var(--text-muted)', marginBottom: '10px' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', marginBottom: '12px' }}>
            Try a question like:
          </p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {EXAMPLE_QUERIES.map((q) => (
              <button key={q} onClick={() => void runSearch(q)} className="btn-secondary" style={{ fontSize: '0.78rem' }}>{q}</button>
            ))}
          </div>
        </div>
      )}

      {isLoading && <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Searching approved sources…</div>}
      {error && !isLoading && <div className="glass-panel" style={{ padding: '18px', color: 'var(--rose-urgent)', textAlign: 'center' }}>{error}</div>}

      {result && !isLoading && !result.hasSufficientEvidence && (
        <div className="glass-panel" style={{ padding: '20px', textAlign: 'center' }}>
          <AlertTriangle size={20} style={{ color: 'var(--amber-pending)', marginBottom: '8px' }} />
          <p style={{ color: 'var(--text-primary)', fontSize: '0.86rem' }}>{result.answerText}</p>
        </div>
      )}

      {result && !isLoading && result.hasSufficientEvidence && (
        <div>
          {result.disagreementPossible && (
            <div className="glass-panel" style={{ padding: '12px 16px', marginBottom: '12px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              These results come from more than one source — reviewed separately below.
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
                      {e.isDemoContent && <StatusBadge label="Synthetic Demo Source" tone="purple" />}
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>similarity {e.similarityScore}</span>
                    </div>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: '0 0 6px 0', lineHeight: 1.5 }}>
                    {isOpen || e.excerptText.length < 220 ? e.excerptText : `${e.excerptText.slice(0, 220)}…`}
                  </p>
                  {e.excerptText.length >= 220 && (
                    <button onClick={() => toggleExpand(e.chunkId)} style={{ background: 'none', border: 'none', color: 'var(--teal-primary)', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                      {isOpen ? 'Show less' : 'Show more'}
                    </button>
                  )}
                  {e.sourceUrl && (
                    <div style={{ marginTop: '8px' }}>
                      <a href={e.sourceUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.78rem', color: 'var(--teal-primary)', fontWeight: 600 }}>Original source ↗</a>
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
    fetchSources().then(setSources).catch(() => setError("We couldn't load guideline sources.")).finally(() => setIsLoading(false));
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
      setError(err instanceof ApiError ? err.message : 'Could not upload this source.');
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
      setError(err instanceof ApiError ? err.message : `Could not ${action} this source.`);
    }
  };

  const approveAll = async () => {
    setError(null);
    try {
      const result = await approveSourcesBatch(awaiting.map((s) => s.id));
      setBatchConfirmed(false);
      load();
      if (result.failed.length) setError(`${result.approved.length} approved. ${result.failed.length} could not be approved: ${result.failed.map((f) => f.reason).join('; ')}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not approve these sources.');
    }
  };

  const awaiting = sources.filter((s) => s.status === 'AWAITING_REVIEW');
  const approved = sources.filter((s) => s.status === 'APPROVED');
  const other = sources.filter((s) => s.status !== 'AWAITING_REVIEW' && s.status !== 'APPROVED');

  return (
    <div>
      <form onSubmit={handleUpload} className="glass-panel" style={{ padding: '18px', marginBottom: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>Upload a Guideline Source (PDF)</div>
        <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ fontSize: '0.82rem' }} />
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} style={textInputStyle} />
          <input placeholder="Issuing organization" value={org} onChange={(e) => setOrg(e.target.value)} style={textInputStyle} />
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={selectStyle}>
            {GUIDELINE_CATEGORIES.map((c) => <option key={c} value={c}>{prettyLabel(c)}</option>)}
          </select>
          <select value={docType} onChange={(e) => setDocType(e.target.value)} style={selectStyle}>
            {GUIDELINE_DOCUMENT_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <input placeholder="Version (optional)" value={version} onChange={(e) => setVersion(e.target.value)} style={{ ...textInputStyle, maxWidth: '140px' }} />
          <input placeholder="Publication date (optional)" value={pubDate} onChange={(e) => setPubDate(e.target.value)} style={{ ...textInputStyle, maxWidth: '180px' }} />
        </div>
        <input placeholder="Source URL (optional)" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} style={textInputStyle} />
        <button type="submit" disabled={isUploading || !file || !title.trim() || !org.trim()} className="btn-primary" style={{ alignSelf: 'flex-start' }}>
          <Upload size={14} /> {isUploading ? 'Uploading…' : 'Upload for Review'}
        </button>
      </form>

      {error && <div className="glass-panel" style={{ padding: '14px', color: 'var(--rose-urgent)', textAlign: 'center', marginBottom: '14px' }}>{error}</div>}
      {isLoading && <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>}

      {!isLoading && (
        <>
          <SectionLabel>Awaiting Review ({awaiting.length})</SectionLabel>
          {awaiting.length === 0 && <EmptyRow text="Nothing awaiting review." />}
          {awaiting.length > 1 && (
            <div className="glass-panel" style={{ padding: '14px 16px', marginBottom: '10px' }}>
              <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '0.8rem', marginBottom: '10px' }}>
                <input type="checkbox" checked={batchConfirmed} onChange={(e) => setBatchConfirmed(e.target.checked)} />
                I reviewed each of these {awaiting.length} documents, their publisher, version and licence, and approve them for passage search with my professional signature.
              </label>
              <button className="btn-primary" disabled={!batchConfirmed} onClick={() => void approveAll()} style={{ fontSize: '0.78rem' }}>
                <CheckCircle2 size={13} /> Approve all {awaiting.length}
              </button>
            </div>
          )}
          {awaiting.map((s) => (
            <SourceRow key={s.id} source={s}>
              <input
                placeholder="Review notes (optional)"
                value={notesById[s.id] ?? ''}
                onChange={(e) => setNotesById((prev) => ({ ...prev, [s.id]: e.target.value }))}
                style={{ ...textInputStyle, fontSize: '0.76rem', marginBottom: '8px' }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => void act('approve', s.id)} className="btn-primary" style={{ fontSize: '0.76rem' }}><CheckCircle2 size={13} /> Approve</button>
                <button onClick={() => void act('reject', s.id)} className="btn-secondary" style={{ fontSize: '0.76rem', color: 'var(--rose-urgent)' }}><XCircle size={13} /> Reject</button>
              </div>
            </SourceRow>
          ))}

          <SectionLabel>Approved ({approved.length})</SectionLabel>
          {approved.length === 0 && <EmptyRow text="No approved sources yet." />}
          {approved.map((s) => (
            <SourceRow key={s.id} source={s}>
              <button onClick={() => void act('exclude', s.id)} className="btn-secondary" style={{ fontSize: '0.76rem' }}><Ban size={13} /> Exclude</button>
            </SourceRow>
          ))}

          {other.length > 0 && (
            <>
              <SectionLabel>Other ({other.length})</SectionLabel>
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
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="glass-panel" style={{ padding: '14px 16px', marginBottom: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>{source.title}</span>
            {source.isDemoContent && <StatusBadge label="Demo" tone="purple" />}
          </div>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {source.issuingOrganization} · {prettyLabel(source.category)} · {source.documentType} · {source.chunkCount} passage(s)
            {source.lastReviewedAt && ` · Reviewed ${formatFriendlyDateTime(source.lastReviewedAt)}`}
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
