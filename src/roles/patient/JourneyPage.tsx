import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { fetchMyJourney } from '../../api/patientPortal';
import type { JourneyEvent } from '../../api/patientPortal';
import { formatFriendlyDate } from './format';

export function JourneyPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<JourneyEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMyJourney()
      .then(setEvents)
      .catch(() => setError("We couldn't load your journey. Please try again."))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <main style={{ padding: '24px', flex: 1, maxWidth: '680px', margin: '0 auto', width: '100%' }}>
      <button
        onClick={() => navigate('/patient/dashboard')}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--teal-primary)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, padding: 0, marginBottom: '14px' }}
      >
        <ArrowLeft size={15} /> Back to My Care
      </button>

      <h1 className="page-title" style={{ fontSize: '1.4rem', margin: '0 0 20px 0' }}>My Journey</h1>

      {isLoading && (
        <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading your journey…</div>
      )}

      {error && !isLoading && (
        <div className="glass-panel" style={{ padding: '24px', color: 'var(--rose-urgent)', textAlign: 'center' }}>{error}</div>
      )}

      {!isLoading && !error && events.length === 0 && (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Your journey will appear here as your care team reviews your records and visits.
        </div>
      )}

      {!isLoading && !error && events.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {events.map((event, index) => (
            <div key={event.id} style={{ display: 'flex', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: '12px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--teal-primary)', marginTop: '6px' }} />
                {index < events.length - 1 && <span style={{ flex: 1, width: '2px', background: 'var(--border-color)', marginTop: '2px' }} />}
              </div>
              <div style={{ paddingBottom: '22px', flex: 1 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '3px' }}>
                  {formatFriendlyDate(event.eventDate)}
                </div>
                <div className="glass-panel" style={{ padding: '14px 18px' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{event.title}</div>
                  {event.summary && <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{event.summary}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
