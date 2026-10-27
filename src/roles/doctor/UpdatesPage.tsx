import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { fetchUpdates, markUpdateRead } from '../../api/doctorPortal';
import type { CareTeamNotification } from '../../api/doctorPortal';
import { markDoctorUpdatesRead } from '../../api/doctorUpdates';
import { announceDoctorUnreadChange } from './useDoctorUnread';
import { tx, useLanguage } from '../../i18n';
import { formatFriendlyDateTime } from './format';

// The button on an update says which page it leads to (the server decides where: backend/app/doctor_update_links.py).
function openLabel(link: string): string {
  const [path, query = ''] = link.split('?');
  if (path === '/doctor/questions') return tx('Open Patient Questions');
  if (path === '/doctor/assistant') return tx('Open Care Assistant');
  if (path === '/doctor/handover') return tx('Open Handover');
  if (path === '/doctor/care-workspace') return query.includes('tab=drafts') ? tx('Open Document studio') : tx('Open Tasks, visits & outcomes');
  if (path.startsWith('/doctor/patients/')) {
    if (query.includes('tab=documents')) return tx('Open the patient’s documents');
    if (query.includes('tab=referrals')) return tx('Open the patient’s referrals');
    return tx('Open the patient’s workspace');
  }
  return tx('Open it');
}

export function UpdatesPage() {
  const { t } = useLanguage();
  const [updates, setUpdates] = useState<CareTeamNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    fetchUpdates()
      .then(setUpdates)
      .catch(() => setError(tx("We couldn't load your updates. Please try again.")))
      .finally(() => setIsLoading(false));
  }, []);

  // Coming back to the window shows what arrived meanwhile; with no signal the list stays as it was.
  useEffect(() => {
    const again = () => { fetchUpdates().then(setUpdates).catch(() => { /* keep the list as it is */ }); };
    window.addEventListener('focus', again);
    return () => window.removeEventListener('focus', again);
  }, []);

  const unread = updates.filter((update) => !update.isRead).length;

  const markRead = (update: CareTeamNotification) => {
    if (update.isRead) return;
    markUpdateRead(update.id)
      .then(() => {
        setUpdates((prev) => prev.map((u) => (u.id === update.id ? { ...u, isRead: true } : u)));
        announceDoctorUnreadChange();
      })
      .catch(() => { /* not important: it stays unread */ });
  };

  const markAllRead = () => {
    markDoctorUpdatesRead({ scope: 'all' })
      .then(() => {
        setUpdates((prev) => prev.map((u) => ({ ...u, isRead: true })));
        setNotice(t('All your updates are marked as read.'));
        announceDoctorUnreadChange();
      })
      .catch(() => setNotice(t('Could not mark the updates as read. Please try again.')));
  };

  return (
    <main className="updates-page doctor-updates" style={{ padding: '24px', flex: 1, maxWidth: '760px', margin: '0 auto', width: '100%' }}>
      <div className="updates-heading">
        <h1 className="page-title" style={{ fontSize: '1.4rem', margin: 0 }}>{t('Updates')}</h1>
        {!isLoading && !error && unread > 0 && (
          <button type="button" className="btn-secondary" onClick={markAllRead}>
            <CheckCheck size={15} aria-hidden="true" /> {t('Mark all read')}
          </button>
        )}
      </div>
      <p role="status" className="continuity-muted updates-notice">{notice}</p>

      {isLoading && <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>{t('Loading…')}</div>}
      {error && !isLoading && <div className="glass-panel" style={{ padding: '24px', color: 'var(--rose-urgent)', textAlign: 'center' }}>{t(error)}</div>}
      {!isLoading && !error && updates.length === 0 && (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>{t('No updates yet.')}</div>
      )}

      {!isLoading && !error && updates.length > 0 && (
        <ul className="glass-panel updates-list">
          {updates.map((update) => (
            <li key={update.id} className={`update-item${update.isRead ? '' : ' update-unread'}`}>
              <span className="update-icon" aria-hidden="true">
                <Bell size={18} />
                {!update.isRead && <span className="update-dot" />}
              </span>
              <div className="update-body">
                <div className="update-title">
                  {update.title}
                  {!update.isRead && <span className="update-new">{t('New')}</span>}
                </div>
                {update.body && <div className="update-text">{update.body}</div>}
                <div className="update-date">{formatFriendlyDateTime(update.createdAt)}</div>
                {(update.link || !update.isRead) && (
                  <div className="update-actions">
                    {update.link && (
                      <Link className="btn-secondary" to={update.link} onClick={() => markRead(update)}>
                        {t(openLabel(update.link))}
                      </Link>
                    )}
                    {!update.isRead && (
                      <button type="button" className="btn-secondary" onClick={() => markRead(update)}>{t('Mark as read')}</button>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
