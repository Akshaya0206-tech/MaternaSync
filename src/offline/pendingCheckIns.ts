import { useSyncExternalStore } from 'react';
import { ApiError, api } from '../api/client';
import { ROOT } from '../api/continuity';

// A check-in that could not be sent because the phone had no signal is kept on this phone and sent when it can be. It is kept only
// for the person who filled it in, and only until it has been sent or she removes it. Each one carries a reference made on the phone,
// so if the first send did arrive but the reply was lost, sending it again never saves it twice (the server answers with the saved entry).
const QUEUE_KEY = 'maternasync.pending-checkins';
const EPISODE_KEY = 'maternasync.episode.';
const CHANGED = 'maternasync:pending-checkins';

export interface PendingCheckIn {
  clientRef: string;
  userId: string;
  episodeId: string;
  body: Record<string, unknown>;
  savedAt: string;
  /** Why the server refused it, when it did. A refused check-in is not sent again until she removes it. */
  refused?: string;
}

function read(): PendingCheckIn[] {
  try {
    const list = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// useSyncExternalStore needs the same array back until something changes, so the parsed list is kept between changes.
let snapshot: PendingCheckIn[] = read();

function write(list: PendingCheckIn[]) {
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

export function usePendingCheckIns(userId: string): PendingCheckIn[] {
  const all = useSyncExternalStore(subscribe, () => snapshot);
  return all.filter((item) => item.userId === userId);
}

/** No signal, a server that is still waking up, or a gateway error: trying again later can work. A refusal (400/403/404/409/422) cannot. */
export const isUnreachable = (error: unknown): boolean => !(error instanceof ApiError) || [502, 503, 504].includes(error.status);

const makeRef = () => (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`);

/** Sends a new check-in. Without a signal it is kept on the phone instead and 'queued' is returned; anything else the server says is thrown. */
export async function sendOrKeepCheckIn(userId: string, episodeId: string, body: Record<string, unknown>): Promise<'sent' | 'queued'> {
  const clientRef = makeRef();
  try {
    await api.post(`${ROOT}/episodes/${episodeId}/logs`, { ...body, clientRef });
    return 'sent';
  } catch (error) {
    if (!isUnreachable(error)) throw error;
    write([...snapshot, { clientRef, userId, episodeId, body, savedAt: new Date().toISOString() }]);
    return 'queued';
  }
}

let sending = false;

/** Tries to send what is waiting for this person, oldest first. It stops at the first one it cannot reach. Returns how many went. */
export async function sendWaitingCheckIns(userId: string): Promise<number> {
  if (sending) return 0;
  sending = true;
  let sent = 0;
  try {
    for (const item of snapshot.filter((entry) => entry.userId === userId && !entry.refused)) {
      try {
        await api.post(`${ROOT}/episodes/${item.episodeId}/logs`, { ...item.body, clientRef: item.clientRef });
        write(snapshot.filter((entry) => entry.clientRef !== item.clientRef));
        sent += 1;
      } catch (error) {
        if (isUnreachable(error)) break;
        const reason = error instanceof Error ? error.message : '';
        write(snapshot.map((entry) => (entry.clientRef === item.clientRef ? { ...entry, refused: reason || 'refused' } : entry)));
      }
    }
  } finally {
    sending = false;
  }
  return sent;
}

export function removeWaitingCheckIn(clientRef: string) {
  write(snapshot.filter((entry) => entry.clientRef !== clientRef));
}

/** The record number of her pregnancy, kept so the check-in can still be filled in when the phone cannot reach the server to ask for it. */
export function rememberEpisode(userId: string, episodeId: string) {
  try { localStorage.setItem(EPISODE_KEY + userId, episodeId); } catch { /* not kept */ }
}

export function rememberedEpisode(userId: string): string {
  try { return localStorage.getItem(EPISODE_KEY + userId) ?? ''; } catch { return ''; }
}
