import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { fetchDocumentation, fetchDraft, fetchApprovedVersion } from '../../api/doctorPortal';
import type { DocumentationItem, ConsultationDraft, ApprovedConsultation, ConsultationDraftContent } from '../../api/doctorPortal';
import { StatusBadge } from '../../components/StatusBadge';
import { friendlyDraftStatus, DRAFT_STATUS_TONE, formatFriendlyDateTime } from './format';

export function DocumentationHistoryPage() {
  const [items, setItems] = useState<DocumentationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [content, setContent] = useState<ConsultationDraftContent | null>(null);

  useEffect(() => {
    fetchDocumentation()
      .then(setItems)
      .catch(() => setError("We couldn't load your documentation history."))
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

  return (
    <main style={{ padding: '24px', flex: 1, maxWidth: '900px', margin: '0 auto', width: '100%' }}>
      <h1 className="page-title" style={{ fontSize: '1.4rem', margin: '0 0 18px 0' }}>Documentation</h1>

      {isLoading && <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>}
      {error && !isLoading && <div className="glass-panel" style={{ padding: '24px', color: 'var(--rose-urgent)', textAlign: 'center' }}>{error}</div>}
      {!isLoading && !error && items.length === 0 && (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>No consultation documentation yet.</div>
      )}

      {!isLoading && !error && items.length > 0 && (
        <div className="glass-panel" style={{ padding: '4px 0' }}>
          {items.map((item, i) => {
            const isOpen = expandedId === item.consultationId;
            return (
              <div key={item.consultationId} style={{ borderBottom: i === items.length - 1 ? 'none' : '1px solid var(--border-color)' }}>
                <button
                  onClick={() => toggle(item)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.patientName}</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>{item.type} · {formatFriendlyDateTime(item.date)} · {item.authorName}</div>
                  </div>
                  <StatusBadge label={item.status === 'No draft yet' ? item.status : friendlyDraftStatus(item.status)} tone={DRAFT_STATUS_TONE[item.status] ?? 'neutral'} />
                  {isOpen ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
                </button>

                {isOpen && (
                  <div style={{ padding: '0 20px 18px 20px' }}>
                    {content ? (
                      <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <Field label="Visit Context" value={content.visitContext} />
                        <Field label="Documented Discussion" value={content.documentedDiscussion} />
                        <Field label="Relevant Information" value={content.relevantInformation} />
                        <Field label="Follow-up / Next Steps" value={content.followUpNextSteps} />
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No draft content available.</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
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
