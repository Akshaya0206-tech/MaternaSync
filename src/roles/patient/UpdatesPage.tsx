import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { fetchMyUpdates, markMyUpdateRead } from '../../api/patientPortal';
import type { PatientNotification } from '../../api/patientPortal';
import { markUpdatesRead } from '../../api/updates';
import { formatFriendlyDate } from './format';
import { announceUnreadChange } from './useUnreadUpdates';
import { tx, useLanguage } from '../../i18n';

// The button on an update says which page it leads to.
const OPEN_LABEL: Record<string, string> = {
  '/patient/questions': tx('Open My Questions'),
  '/patient/care-plan': tx('Open My Care Plan'),
  '/patient/appointments': tx('Open Appointments'),
  '/patient/records': tx('Open My Records'),
  '/patient/journey': tx('Open My Journey'),
  '/patient/profile': tx('Open Profile'),
  '/patient/daily-log': tx('Open Daily Check-in'),
  '/patient/consent': tx('Open Sharing & Consent'),
};

export function UpdatesPage() {
  const { t } = useLanguage();
  const [updates, setUpdates] = useState<PatientNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    fetchMyUpdates()
      .then(setUpdates)
      .catch(() => setError(tx("We couldn't load your updates. Please try again.")))
      .finally(() => setIsLoading(false));
  }, []);

  const unread = updates.filter((update) => !update.isRead).length;

  const markRead = (update: PatientNotification) => {
    if (update.isRead) return;
    markMyUpdateRead(update.id)
      .then(() => {
        setUpdates((prev) => prev.map((u) => (u.id === update.id ? { ...u, isRead: true } : u)));
        announceUnreadChange();
      })
      .catch(() => { /* non-critical; leave as unread */ });
  };

  const markAllRead = () => {
    markUpdatesRead('all')
      .then(() => {
        setUpdates((prev) => prev.map((u) => ({ ...u, isRead: true })));
        setNotice(t('All your updates are marked as read.'));
        announceUnreadChange();
      })
      .catch(() => setNotice(t('Could not mark the updates as read. Please try again.')));
  };

  return (
    <main className="updates-page patient-home" style={{ padding: '24px', flex: 1, maxWidth: '760px', margin: '0 auto', width: '100%' }}>
      <div className="updates-heading">
        <h1 className="page-title" style={{ fontSize: '1.4rem', margin: 0 }}>{t('Updates')}</h1>
        {!isLoading && !error && unread > 0 && (
          <button type="button" className="btn-secondary" onClick={markAllRead}>
            <CheckCheck size={15} aria-hidden="true" /> {t('Mark all read')}
          </button>
        )}
      </div>
      <p role="status" className="continuity-muted updates-notice">{notice}</p>

      {isLoading && (
        <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>{t('Loading your updates…')}</div>
      )}

      {error && !isLoading && (
        <div className="glass-panel" style={{ padding: '24px', color: 'var(--rose-urgent)', textAlign: 'center' }}>{t(error)}</div>
      )}

      {!isLoading && !error && updates.length === 0 && (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          {t('No updates yet.')}
        </div>
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
                <div className="update-date">{formatFriendlyDate(update.createdAt)}</div>
                {(update.link || !update.isRead) && (
                  <div className="update-actions">
                    {update.link && (
                      <Link className="btn-secondary" to={update.link} onClick={() => markRead(update)}>
                        {t(OPEN_LABEL[update.link] ?? tx('Open it'))}
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
