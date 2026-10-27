import { useSyncExternalStore } from 'react';
import { ApiError } from '../api/client';
import { postCaregiverCheckIn } from '../api/caregiverCheckIns';
import { isUnreachable, makeRef } from './pendingCheckIns';

// The trusted person's version of pendingCheckIns.ts. A check-in filled in for her without a signal is kept on this phone and sent when it
// can be, so it is never lost. It is kept for the signed-in helper and for the one woman it was filled in for (several women can share a
// phone), and only until it has been sent or they remove it. Each carries a reference made on the phone, so if the first send did arrive but
// the reply was lost, sending it again never saves it twice: the server answers with the entry it already has.
// If her access was removed or ended in the meantime the server refuses (403). A refused check-in is never sent again by itself and is never
// dropped quietly: it stays on the phone with the reason until the helper removes it.
const QUEUE_KEY = 'maternasync.pending-caregiver-checkins';
const WOMAN_KEY = 'maternasync.caregiver.check-in-woman.';
const CHANGED = 'maternasync:pending-caregiver-checkins';

export interface PendingCaregiverCheckIn {
  clientRef: string;
  userId: string;
  linkId: string;
  womanName: string;
  body: Record<string, unknown>;
  savedAt: string;
  /** Why the server refused it, when it did, and with which status (403 means her access has ended or was removed). */
  refused?: string;
  refusedStatus?: number;
}

function read(): PendingCaregiverCheckIn[] {
  try {
    const list = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// useSyncExternalStore needs the same array back until something changes, so the parsed list is kept between changes.
let snapshot: PendingCaregiverCheckIn[] = read();

function write(list: PendingCaregiverCheckIn[]) {
  snapshot = list;
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(list));
  } catch {
    // The phone's storage is full or blocked: the entries stay in memory for this visit.
  }
  window.dispatchEvent(new Event(CHANGED));
}

const subscribe = (listener: () => void) => {
  const onStorage = (event: StorageEvent) => {
    if (event.key === QUEUE_KEY) { snapshot = read(); listener(); }
  };
  window.addEventListener(CHANGED, listener);
  window.addEventListener('storage', onStorage);
  return () => { window.removeEventListener(CHANGED, listener); window.removeEventListener('storage', onStorage); };
};

export function useWaitingCaregiverCheckIns(userId: string): PendingCaregiverCheckIn[] {
  const all = useSyncExternalStore(subscribe, () => snapshot);
  return all.filter((item) => item.userId === userId);
}

/** Sends a new check-in for her. Without a signal it is kept on the phone instead and 'queued' is returned; anything else the server says is thrown. */
export async function sendOrKeepCaregiverCheckIn(userId: string, linkId: string, womanName: string, body: Record<string, unknown>): Promise<'sent' | 'queued'> {
  const clientRef = makeRef();
  try {
    await postCaregiverCheckIn(linkId, body, clientRef);
    return 'sent';
  } catch (error) {
    if (!isUnreachable(error)) throw error;
    write([...snapshot, { clientRef, userId, linkId, womanName, body, savedAt: new Date().toISOString() }]);
    return 'queued';
  }
}

let sending = false;

/** Tries to send what is waiting for this person, oldest first. It stops at the first one it cannot reach (or when the sign-in has run out).
 *  Returns how many went. */
export async function sendWaitingCaregiverCheckIns(userId: string): Promise<number> {
  if (sending) return 0;
  sending = true;
  let sent = 0;
  try {
    for (const item of snapshot.filter((entry) => entry.userId === userId && !entry.refused)) {
      try {
        await postCaregiverCheckIn(item.linkId, item.body, item.clientRef);
        write(snapshot.filter((entry) => entry.clientRef !== item.clientRef));
        sent += 1;
      } catch (error) {
        if (isUnreachable(error)) break;
        if (error instanceof ApiError && error.status === 401) break; // signed out: keep it, and send it after they sign in again
        const status = error instanceof ApiError ? error.status : 0;
        const reason = error instanceof Error ? error.message : '';
        write(snapshot.map((entry) => (entry.clientRef === item.clientRef ? { ...entry, refused: reason || 'refused', refusedStatus: status } : entry)));
      }
    }
  } finally {
    sending = false;
  }
  return sent;
}

export function removeWaitingCaregiverCheckIn(clientRef: string) {
  write(snapshot.filter((entry) => entry.clientRef !== clientRef));
}

/** The woman the check-in page was last opened for, kept so the form can still be filled in when the phone cannot reach the server to ask who
 *  the helper is looking after. It holds only her name and the link's number, and only while she allows check-ins. */
export function rememberCheckInWoman(userId: string, woman: { linkId: string; womanName: string }) {
  try { localStorage.setItem(WOMAN_KEY + userId, JSON.stringify(woman)); } catch { /* not kept */ }
}

export function forgetCheckInWoman(userId: string) {
  try { localStorage.removeItem(WOMAN_KEY + userId); } catch { /* not kept */ }
}

/** On logout: a shared phone must not keep the name of the woman the last helper looked after. (Check-ins still waiting to be sent stay, as the patient's do.) */
export function forgetCheckInWomen() {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(WOMAN_KEY)) localStorage.removeItem(key);
  } catch { /* not kept */ }
}

export function rememberedCheckInWoman(userId: string): { linkId: string; womanName: string } | null {
  try {
    const kept = JSON.parse(localStorage.getItem(WOMAN_KEY + userId) ?? 'null');
    return kept && typeof kept.linkId === 'string' && typeof kept.womanName === 'string' ? kept : null;
  } catch {
    return null;
  }
}
