import { useCallback, useEffect, useState } from 'react';
import { fetchUnreadSummary, markUpdatesRead } from '../../api/updates';
import type { ReadScope, UnreadSummary } from '../../api/updates';

/** Pages that say something changed in the numbers (an update was marked read, for example) tell the menu to look again. */
export const UNREAD_CHANGED = 'maternasync:unread-changed';
export const announceUnreadChange = () => window.dispatchEvent(new Event(UNREAD_CHANGED));

const NONE: UnreadSummary = { total: 0, questions: 0, carePlan: 0 };

/** Which menu items get a dot. Opening My Questions or My Care Plan counts as seeing what is new there, so its dot goes. It looks again on every
 *  page change, when the window is brought back, and every minute. A phone with no signal just keeps the dots it had: nothing is shown as an error. */
export function useUnreadUpdates(userId: string, enabled: boolean, pathname: string): UnreadSummary {
  const [summary, setSummary] = useState<UnreadSummary>(NONE);

  const look = useCallback(async (scope: ReadScope | null) => {
    try {
      setSummary(scope ? await markUpdatesRead(scope) : await fetchUnreadSummary());
    } catch {
      // No signal, or the server is waking up: leave the dots as they are.
    }
  }, []);

  useEffect(() => {
    if (!userId || !enabled) return;
    void look(pathname === '/patient/questions' ? 'questions' : pathname === '/patient/care-plan' ? 'care_plan' : null);
  }, [userId, enabled, pathname, look]);

  useEffect(() => {
    if (!userId || !enabled) return;
    const again = () => void look(null);
    window.addEventListener('focus', again);
    window.addEventListener(UNREAD_CHANGED, again);
    const timer = window.setInterval(again, 60_000);
    return () => {
      window.removeEventListener('focus', again);
      window.removeEventListener(UNREAD_CHANGED, again);
      window.clearInterval(timer);
    };
  }, [userId, enabled, look]);

  return summary;
}
