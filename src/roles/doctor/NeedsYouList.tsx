import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchNeedsYou } from '../../api/doctorDashboard';
import type { NeedsYou, NeedsYouKind } from '../../api/doctorDashboard';
import { tx, useLanguage } from '../../i18n';
import { StatusBadge } from '../../components/StatusBadge';
import { waitingWords } from './format';

const SHOWN_FIRST = 8;

const KIND: Record<NeedsYouKind, string> = {
  question: tx('Question'),
  document: tx('Document to verify'),
  draft: tx('Consultation note to approve'),
  document_draft: tx('Document draft to approve'),
  proposal: tx('Care Assistant proposal'),
};

/** What is waiting for the doctor, oldest first. The order is how long each item has waited, and nothing else. */
export function NeedsYouList() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [data, setData] = useState<NeedsYou | null>(null);
  const [all, setAll] = useState(false);

  useEffect(() => {
    let active = true;
    fetchNeedsYou().then((d) => { if (active) setData(d); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  if (!data) return null;
  const rows = all ? data.items : data.items.slice(0, SHOWN_FIRST);

  return (
    <section className="needs-you" aria-labelledby="needs-you-heading">
      <h2 id="needs-you-heading" className="page-title" style={{ fontSize: '1.05rem', margin: '0 0 6px 0' }}>{t('Needs you')}</h2>
      <p className="continuity-muted">{t('Oldest first. The order is only how long each item has been waiting.')}</p>
      {data.items.length === 0 ? (
        <div className="glass-panel needs-you-empty">{t('Nothing is waiting for you.')}</div>
      ) : (
        <>
          <ul className="needs-you-list">
            {rows.map((item, index) => (
              <li key={`${item.kind}-${item.episodeId}-${item.waitingSince}-${index}`} className="glass-panel needs-you-row">
                <div className="needs-you-main">
                  <div className="needs-you-top">
                    <StatusBadge label={t(KIND[item.kind])} tone="neutral" />
                    <strong>{item.patientName}</strong>
                  </div>
                  <p className="needs-you-title">{item.kind === 'draft' ? t('Consultation note') : item.title}</p>
                  <span className="needs-you-wait">{waitingWords(t, item.waitingSince)}</span>
                </div>
                <button type="button" className="btn-secondary" onClick={() => navigate(item.to)}>
                  {t('Open')}
                  <span className="setup-sr"> — {item.patientName}: {t(KIND[item.kind])}</span>
                </button>
              </li>
            ))}
          </ul>
          {data.total > SHOWN_FIRST && (
            <div className="continuity-actions">
              <button type="button" className="btn-secondary" aria-expanded={all} onClick={() => setAll((open) => !open)}>
                {all ? t('Show fewer') : t('Show all ({count})', { count: data.total })}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
