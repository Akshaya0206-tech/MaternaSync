import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { fetchUpdates, markUpdateRead } from '../../api/doctorPortal';
import type { CareTeamNotification } from '../../api/doctorPortal';
import { formatFriendlyDateTime } from './format';

export function UpdatesPage() {
  const [updates, setUpdates] = useState<CareTeamNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUpdates()
      .then(setUpdates)
      .catch(() => setError("We couldn't load your updates. Please try again."))
      .finally(() => setIsLoading(false));
  }, []);

  const handleOpen = (update: CareTeamNotification) => {
    if (update.isRead) return;
    markUpdateRead(update.id)
      .then(() => setUpdates((prev) => prev.map((u) => (u.id === update.id ? { ...u, isRead: true } : u))))
      .catch(() => {});
  };

  return (
    <main style={{ padding: '24px', flex: 1, maxWidth: '760px', margin: '0 auto', width: '100%' }}>
      <h1 className="page-title" style={{ fontSize: '1.4rem', margin: '0 0 20px 0' }}>Updates</h1>

      {isLoading && <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>}
      {error && !isLoading && <div className="glass-panel" style={{ padding: '24px', color: 'var(--rose-urgent)', textAlign: 'center' }}>{error}</div>}
      {!isLoading && !error && updates.length === 0 && (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>No updates yet.</div>
      )}

      {!isLoading && !error && updates.length > 0 && (
        <div className="glass-panel" style={{ padding: '4px 0' }}>
          {updates.map((update, index) => (
            <button
              key={update.id}
              onClick={() => handleOpen(update)}
              style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '16px 22px', width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: update.isRead ? 'default' : 'pointer', font: 'inherit', borderBottom: index === updates.length - 1 ? 'none' : '1px solid var(--border-color)' }}
            >
              <span style={{ flexShrink: 0, marginTop: '2px', position: 'relative' }}>
                <Bell size={18} style={{ color: update.isRead ? 'var(--text-muted)' : 'var(--teal-primary)' }} />
                {!update.isRead && <span style={{ position: 'absolute', top: '-2px', right: '-2px', width: '7px', height: '7px', borderRadius: '50%', background: 'var(--terracotta)' }} />}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: update.isRead ? 500 : 700, color: 'var(--text-primary)' }}>{update.title}</div>
                {update.body && <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '3px' }}>{update.body}</div>}
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>{formatFriendlyDateTime(update.createdAt)}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
