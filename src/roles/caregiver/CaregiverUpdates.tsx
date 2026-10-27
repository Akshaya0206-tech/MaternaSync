import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { caregiverUpdates, markAllCaregiverUpdatesRead, markCaregiverUpdateRead } from '../../api/caregiverHome';
import type { CaregiverUpdate } from '../../api/caregiverHome';
import { tx, useLanguage } from '../../i18n';
import { Empty, Feedback, Page, Panel } from '../../components/continuity/shared';
import { formatFriendlyDate, formatFriendlyTime } from '../patient/format';
import { announceUnreadChange } from '../patient/useUnreadUpdates';
import { useCaregiver } from './CaregiverContext';

// The button on an update says which page it leads to.
const OPEN_LABEL: Record<string, string> = {
  '/caregiver/home': tx('Open Home'),
  '/caregiver/appointments': tx('Open Appointments'),
  '/caregiver/check-in': tx('Open Daily Check-in'),
  '/caregiver/reminders': tx('Open Reminders'),
  '/caregiver/questions': tx('Open Questions'),
};

const dayOf = (value: string | null) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` : '';
};

/** Updates, newest first, grouped by day. */
function groupByDay(items: CaregiverUpdate[]): { day: string; first: string | null; items: CaregiverUpdate[] }[] {
  const groups: { day: string; first: string | null; items: CaregiverUpdate[] }[] = [];
  for (const item of items) {
    const day = dayOf(item.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(item);
    else groups.push({ day, first: item.createdAt, items: [item] });
  }
  return groups;
}

export function CaregiverUpdatesPage() {
  const { t } = useLanguage();
  const { women, select } = useCaregiver();
  const [items, setItems] = useState<CaregiverUpdate[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    caregiverUpdates().then((n) => { if (active) setItems(n); }).catch((err) => { if (active) setError(err instanceof Error ? err.message : ''); });
    return () => { active = false; };
  }, []);

  const unread = items?.filter((n) => !n.isRead).length ?? 0;
  const showWoman = (women?.length ?? 0) > 1;
  const today = dayOf(new Date().toISOString());
  const yesterday = dayOf(new Date(Date.now() - 86_400_000).toISOString());

  const markRead = (update: CaregiverUpdate) => {
    if (update.isRead) return;
    markCaregiverUpdateRead(update.id)
      .then(() => {
        setItems((previous) => previous?.map((n) => (n.id === update.id ? { ...n, isRead: true } : n)) ?? previous);
        announceUnreadChange();
      })
      .catch(() => { /* not important: it simply stays unread */ });
  };

  const markAll = () => {
    markAllCaregiverUpdatesRead()
      .then(() => {
        setItems((previous) => previous?.map((n) => ({ ...n, isRead: true })) ?? previous);
        setNotice(t('All your updates are marked as read.'));
        announceUnreadChange();
      })
      .catch(() => setNotice(t('Could not mark the updates as read. Please try again.')));
  };

  return (
    <Page title={t('Updates')} subtitle={t('Reminders and replies for you.')}>
      <Feedback error={error} />
      <p role="status" className="continuity-muted updates-notice">{notice}</p>
      <Panel
        title={t('Latest')}
        aside={unread > 0 ? <button type="button" className="btn-secondary" onClick={markAll}><CheckCheck size={15} aria-hidden="true" /> {t('Mark all read')}</button> : undefined}
      >
        {items === null && !error && <p role="status" className="continuity-muted">{t('Loading…')}</p>}
        {items && !items.length && <Empty>{t('Nothing new.')}</Empty>}
        {items && groupByDay(items).map((group) => (
          <div key={group.day || 'unknown'} className="updates-day">
            <h3>{group.day === today ? t('Today') : group.day === yesterday ? t('Yesterday') : formatFriendlyDate(group.first)}</h3>
            <ul className="updates-list">
              {group.items.map((n) => (
                <li key={n.id} className={`update-item${n.isRead ? '' : ' update-unread'}`}>
                  <span className="update-icon" aria-hidden="true">
                    <Bell size={18} />
                    {!n.isRead && <span className="update-dot" />}
                  </span>
                  <div className="update-body">
                    <div className="update-title">
                      {n.title}
                      {!n.isRead && <span className="update-new">{t('New')}</span>}
                    </div>
                    {n.body && <div className="update-text">{n.body}</div>}
                    <div className="update-date">
                      {formatFriendlyTime(n.createdAt)}
                      {showWoman && n.womanName && <span className="update-woman"> · {t('For {name}', { name: n.womanName })}</span>}
                    </div>
                    {(n.link || !n.isRead) && (
                      <div className="update-actions">
                        {n.link && (
                          <Link className="btn-secondary" to={n.link} onClick={() => { if (n.linkId) select(n.linkId); markRead(n); }}>
                            {t(OPEN_LABEL[n.link] ?? tx('Open it'))}
                          </Link>
                        )}
                        {!n.isRead && <button type="button" className="btn-secondary" onClick={() => markRead(n)}>{t('Mark as read')}</button>}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Panel>
    </Page>
  );
}
