import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircleQuestion } from 'lucide-react';
import { fetchMyJourney } from '../../api/patientPortal';
import type { JourneyEvent } from '../../api/patientPortal';
import { formatFriendlyDate } from './format';
import { tx, useLanguage } from '../../i18n';

export function JourneyPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [events, setEvents] = useState<JourneyEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMyJourney()
      .then(setEvents)
      .catch(() => setError(tx("We couldn't load your journey. Please try again.")))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <main className="patient-home" style={{ padding: '24px', flex: 1, maxWidth: '680px', margin: '0 auto', width: '100%' }}>
      <button
        onClick={() => navigate('/patient/dashboard')}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#11695f', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, padding: 0, marginBottom: '14px' }}
      >
        <ArrowLeft size={15} /> {t('Back to My Care')}
      </button>

      <h1 className="page-title" style={{ fontSize: '1.4rem', margin: '0 0 20px 0' }}>{t('My Journey')}</h1>

      {isLoading && (
        <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>{t('Loading your journey…')}</div>
      )}

      {error && !isLoading && (
        <div className="glass-panel" style={{ padding: '24px', color: 'var(--rose-urgent)', textAlign: 'center' }}>{t(error)}</div>
      )}

      {!isLoading && !error && events.length === 0 && (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          {t('Your journey will appear here as your care team reviews your records and visits.')}
        </div>
      )}

      {!isLoading && !error && events.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {events.map((event, index) => {
            const when = formatFriendlyDate(event.eventDate);
            // The text that opens her question to the doctor: which entry it is about, and then she writes the rest.
            const draft = t('About “{title}” ({date}): ', { title: t(event.title), date: when });
            return (
              <div key={event.id} style={{ display: 'flex', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: '12px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--teal-primary)', marginTop: '6px' }} />
                  {index < events.length - 1 && <span style={{ flex: 1, width: '2px', background: 'var(--border-color)', marginTop: '2px' }} />}
                </div>
                <div style={{ paddingBottom: '22px', flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '3px' }}>{when}</div>
                  <div className="glass-panel" style={{ padding: '14px 18px' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{t(event.title)}</div>
                    {event.summary && <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px', whiteSpace: 'pre-wrap' }}>{t(event.summary)}</div>}
                    {event.words.length > 0 && (
                      <details className="journey-words">
                        <summary>{t('What these words mean')}</summary>
                        <dl>
                          {event.words.map((word) => (
                            <div key={word.term}>
                              <dt><strong>{word.term}</strong></dt>
                              <dd>{word.meaning}</dd>
                            </div>
                          ))}
                        </dl>
                        <p className="continuity-muted">{t('These explain the words only. They do not say what anything means for you. Ask your doctor about that.')}</p>
                      </details>
                    )}
                    <div className="journey-ask">
                      <Link className="btn-secondary" to={`/patient/questions?draft=${encodeURIComponent(draft)}`}>
                        <MessageCircleQuestion size={15} aria-hidden="true" /> {t('Ask my doctor about this')}
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
