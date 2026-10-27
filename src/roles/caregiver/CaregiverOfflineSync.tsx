import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useLanguage } from '../../i18n';
import {
  forgetCheckInWoman, rememberCheckInWoman, removeWaitingCaregiverCheckIn, sendWaitingCaregiverCheckIns, useWaitingCaregiverCheckIns,
} from '../../offline/pendingCaregiverCheckIns';
import { useCaregiver } from './CaregiverContext';

/**
 * Check-ins a trusted person filled in for her without a signal are kept on the phone (see offline/pendingCaregiverCheckIns). This is mounted
 * once in the shell, so on every caregiver page it
 *  - sends them by itself when the phone is back online, when the app comes back to the front, and every minute,
 *  - says they are waiting, and lets the helper send or remove them, and
 *  - remembers which woman the check-in page is for, so the form can still open with no signal.
 * A check-in the server refuses (her access ended, or she removed them) is not sent again and not dropped: it stays here, with the reason,
 * until the helper removes it.
 */
export function CaregiverOfflineSync() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { women, current, error } = useCaregiver();
  const userId = user?.id ?? '';
  const waiting = useWaitingCaregiverCheckIns(userId);
  const [busy, setBusy] = useState(false);

  // Only when the server has answered: with no signal the last woman remembered stays.
  useEffect(() => {
    if (!userId || women === null || error) return;
    if (current && !current.ended && current.permissions.check_in) rememberCheckInWoman(userId, { linkId: current.linkId, womanName: current.womanName });
    else forgetCheckInWoman(userId);
  }, [userId, women, current, error]);

  useEffect(() => {
    if (!userId) return;
    const run = () => void sendWaitingCaregiverCheckIns(userId);
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
            onClick={async () => { setBusy(true); await sendWaitingCaregiverCheckIns(userId); setBusy(false); }}
          >
            {t('Send now')}
          </button>
        </p>
      )}
      {refused.map((item) => (
        <p key={item.clientRef}>
          {item.refusedStatus === 403
            ? t('A check-in for {name} could not be sent because you no longer have access to her check-ins. She can give you access again.', { name: item.womanName })
            : t('A check-in for {name} could not be sent: {reason}', { name: item.womanName, reason: item.refused ?? '' })}{' '}
          <button
            type="button"
            className="btn-secondary"
            onClick={() => { if (window.confirm(t('Remove this check-in from this phone? It will not be sent.'))) removeWaitingCaregiverCheckIn(item.clientRef); }}
          >
            {t('Remove it')}
          </button>
        </p>
      ))}
    </div>
  );
}
