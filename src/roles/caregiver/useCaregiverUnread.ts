import { useCallback, useEffect, useState } from 'react';
import { caregiverUnread } from '../../api/caregiverHome';
import type { CaregiverUnread } from '../../api/caregiverHome';
import { UNREAD_CHANGED } from '../patient/useUnreadUpdates';

const NONE: CaregiverUnread = { total: 0, byLink: {}, unassigned: 0 };

/** How many updates a trusted person has not seen, in all and for each woman, for the dot in the menu and the switcher. It looks again on every page
 *  change, when the window is brought back, when a page says something was read, and every minute. With no signal the numbers it had stay as they were. */
export function useCaregiverUnread(enabled: boolean, pathname: string): CaregiverUnread {
  const [unread, setUnread] = useState<CaregiverUnread>(NONE);

  const look = useCallback(async () => {
    try {
      setUnread(await caregiverUnread());
    } catch {
      // No signal, or the server is waking up: leave the dots as they are.
    }
  }, []);

  useEffect(() => {
    if (enabled) void look();
  }, [enabled, pathname, look]);

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('focus', look);
    window.addEventListener(UNREAD_CHANGED, look);
    const timer = window.setInterval(look, 60_000);
    return () => {
      window.removeEventListener('focus', look);
      window.removeEventListener(UNREAD_CHANGED, look);
      window.clearInterval(timer);
    };
  }, [enabled, look]);

  return unread;
}
