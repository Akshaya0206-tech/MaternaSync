import { useCallback, useEffect, useState } from 'react';
import { fetchDoctorUnread } from '../../api/doctorUpdates';

/** Pages that change what is unread (an update marked read, a brief opened) tell the menu to look again. */
export const DOCTOR_UNREAD_CHANGED = 'maternasync:doctor-unread-changed';
export const announceDoctorUnreadChange = () => window.dispatchEvent(new Event(DOCTOR_UNREAD_CHANGED));

/** How many updates the doctor has not read, for the dot beside "Updates". It looks again on every page change, when the window is brought back
 *  and every minute. With no signal, or while the server is waking up, the dot stays as it was: nothing is shown as an error. */
export function useDoctorUnread(userId: string, pathname: string): number {
  const [total, setTotal] = useState(0);

  const look = useCallback(async () => {
    try {
      setTotal((await fetchDoctorUnread()).total);
    } catch {
      // Leave the dot as it is.
    }
  }, []);

  useEffect(() => {
    if (userId) void look();
  }, [userId, pathname, look]);

  useEffect(() => {
    if (!userId) return;
    const again = () => void look();
    window.addEventListener('focus', again);
    window.addEventListener(DOCTOR_UNREAD_CHANGED, again);
    const timer = window.setInterval(again, 60_000);
    return () => {
      window.removeEventListener('focus', again);
      window.removeEventListener(DOCTOR_UNREAD_CHANGED, again);
      window.clearInterval(timer);
    };
  }, [userId, look]);

  return total;
}
