import { useEffect, useId, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { fetchDocumentation, fetchDraft, fetchApprovedVersion } from '../../api/doctorPortal';
import type { DocumentationItem, ConsultationDraft, ApprovedConsultation, ConsultationDraftContent } from '../../api/doctorPortal';
import { StatusBadge } from '../../components/StatusBadge';
import { tx, useLanguage } from '../../i18n';
import { friendlyDraftStatus, DRAFT_STATUS_TONE, formatFriendlyDateTime } from './format';

// The server names the kind of record "Consultation" (backend/app/routers/doctor_portal.py).
const RECORD_TYPE_LABELS: Record<string, string> = { Consultation: tx('Consultation') };

// The "Documentation history" tab of the Consultations page (ConsultationsPage.tsx).
export function DocumentationHistoryView() {
  const { t } = useLanguage();
  const [items, setItems] = useState<DocumentationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [content, setContent] = useState<ConsultationDraftContent | null>(null);
  const filterId = useId();
  const [patientFilter, setPatientFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    fetchDocumentation()
      .then(setItems)
      .catch(() => setError(tx("We couldn't load your documentation history.")))
      .finally(() => setIsLoading(false));
  }, []);

  const toggle = async (item: DocumentationItem) => {
    if (expandedId === item.consultationId) {
      setExpandedId(null);
      setContent(null);
      return;
    }
    setExpandedId(item.consultationId);
    setContent(null);
    try {
      if (item.approvedId) {
        const approved: ApprovedConsultation = await fetchApprovedVersion(item.consultationId);
        setContent(approved.finalContent);
      } else if (item.latestDraftId) {
        const draft: ConsultationDraft = await fetchDraft(item.latestDraftId);
        setContent(draft.structuredContent);
      }
    } catch {
      setContent(null);
    }
  };

  // The day an item was written, on the doctor's own calendar, as YYYY-MM-DD so it can be compared with the From and To boxes.
  const dayOf = (value: string) => {
    const d = new Date(value);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const patients = [...new Map(items.map((item) => [item.episodeId, item.patientName] as const)).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const shown = items.filter((item) => (!patientFilter || item.episodeId === patientFilter) && (!from || dayOf(item.date) >= from) && (!to || dayOf(item.date) <= to));
  const filtered = Boolean(patientFilter || from || to);
  const clearFilters = () => { setPatientFilter(''); setFrom(''); setTo(''); };

  return (
    <div>

      {isLoading && <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>{t('Loading…')}</div>}
      {error && !isLoading && <div className="glass-panel" style={{ padding: '24px', color: 'var(--rose-urgent)', textAlign: 'center' }}>{t(error)}</div>}
      {!isLoading && !error && items.length === 0 && (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>{t('No consultation documentation yet.')}</div>
      )}

      {!isLoading && !error && items.length > 0 && (
        <div className="doc-filters" role="group" aria-label={t('Filter the documentation')}>
          {patients.length > 1 && (
            <div className="doc-filter">
              <label htmlFor={`${filterId}-patient`}>{t('Patient')}</label>
              <select id={`${filterId}-patient`} value={patientFilter} onChange={(e) => setPatientFilter(e.target.value)}>
                <option value="">{t('All patients')}</option>
                {patients.map(([episodeId, patientName]) => <option key={episodeId} value={episodeId}>{patientName}</option>)}
              </select>
            </div>
          )}
          <div className="doc-filter">
            <label htmlFor={`${filterId}-from`}>{t('From')}</label>
            <input id={`${filterId}-from`} type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="doc-filter">
            <label htmlFor={`${filterId}-to`}>{t('To')}</label>
            <input id={`${filterId}-to`} type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </div>
          <button type="button" className="btn-secondary" disabled={!filtered} onClick={clearFilters}>{t('Clear filters')}</button>
          {filtered && <span className="continuity-muted" role="status">{t('Showing {shown} of {total}', { shown: shown.length, total: items.length })}</span>}
        </div>
      )}
      {!isLoading && !error && items.length > 0 && shown.length === 0 && (
        <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          {t('No documentation matches these filters.')}
        </div>
      )}

      {!isLoading && !error && shown.length > 0 && (
        <div className="glass-panel" style={{ padding: '4px 0' }}>
          {shown.map((item, i) => {
            const isOpen = expandedId === item.consultationId;
            return (
              <div key={item.consultationId} style={{ borderBottom: i === shown.length - 1 ? 'none' : '1px solid var(--border-color)' }}>
                <button
                  onClick={() => toggle(item)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.patientName}</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>{t(RECORD_TYPE_LABELS[item.type] ?? item.type)} · {formatFriendlyDateTime(item.date)} · {item.authorName}</div>
                  </div>
                  <StatusBadge label={item.status === 'No draft yet' ? t('No draft yet') : friendlyDraftStatus(item.status)} tone={DRAFT_STATUS_TONE[item.status] ?? 'neutral'} />
                  {isOpen ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
                </button>

                {isOpen && (
                  <div style={{ padding: '0 20px 18px 20px' }}>
                    {content ? (
                      <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <Field label={t('Visit Context')} value={content.visitContext} />
                        <Field label={t('Documented Discussion')} value={content.documentedDiscussion} />
                        <Field label={t('Relevant Information')} value={content.relevantInformation} />
                        <Field label={t('Follow-up / Next Steps')} value={content.followUpNextSteps} />
                        {Object.entries(content.layoutSections ?? {}).filter(([, text]) => text.trim()).map(([heading, text]) => <Field key={heading} label={heading} value={text} />)}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{t('No draft content available.')}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '0.84rem', color: 'var(--text-primary)', marginTop: '2px' }}>{value}</div>
    </div>
  );
}
