import { useEffect, useState } from 'react';
import { useLanguage } from '../../i18n';
import { removeWaitingCheckIn, sendWaitingCheckIns, usePendingCheckIns } from '../../offline/pendingCheckIns';

/** Check-ins that were filled in without a signal and are kept on this phone. They are sent by themselves when the phone is back online
 *  (and when the app is opened or comes back to the front); this notice says they are waiting and lets her send or remove them. */
export function PendingCheckInsNotice({ userId }: { userId: string }) {
  const { t } = useLanguage();
  const waiting = usePendingCheckIns(userId);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const run = () => void sendWaitingCheckIns(userId);
    const onVisible = () => { if (document.visibilityState === 'visible') run(); };
    run();
    window.addEventListener('online', run);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(run, 60_000);
    return () => {
      window.removeEventListener('online', run);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [userId]);

  if (!waiting.length) return null;
  const refused = waiting.filter((item) => item.refused);
  const notSent = waiting.length - refused.length;

  return (
    <div className="continuity-note away-banner pending-checkins" role="status">
      {notSent > 0 && (
        <p>
          {t('Check-ins kept on this phone, not sent yet: {count}', { count: notSent })}. {t('They will be sent when you are back online.')}{' '}
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={async () => { setBusy(true); await sendWaitingCheckIns(userId); setBusy(false); }}
          >
            {t('Send now')}
          </button>
        </p>
      )}
      {refused.map((item) => (
        <p key={item.clientRef}>
          {t('A check-in could not be sent: {reason}', { reason: item.refused ?? '' })}{' '}
          <button
            type="button"
            className="btn-secondary"
            onClick={() => { if (window.confirm(t('Remove this check-in from this phone? It will not be sent.'))) removeWaitingCheckIn(item.clientRef); }}
          >
            {t('Remove it')}
          </button>
        </p>
      ))}
    </div>
  );
}
