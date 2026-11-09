import { apiUrl } from './client';
import { isUnreachable } from '../offline/pendingCheckIns';

/**
 * The demonstration API runs on a free host that goes to sleep after about a quarter of an hour without visitors (Render's free plan).
 * The next request wakes it, and it then needs a minute or two to start again (it rebuilds the demonstration data every time). Until it
 * has started, requests hang or fail, which the sign-in page used to report as "can't reach the server" although nothing was wrong.
 *
 * waitForServer() asks /api/health until the API answers, and every caller shares the same wait. The pages before sign-in start it as soon
 * as someone opens the site, say that the server is starting (see ServerWakeNotice), and hold a sign-in until it can succeed.
 */
const ATTEMPT_TIMEOUT_MS = 25_000; // one health check: the host may hold a request while the API starts
const PAUSE_MS = 2_500; // between health checks that failed quickly
const GIVE_UP_MS = 4 * 60_000; // a wake normally takes about 90 seconds

/** unknown: not asked yet. waiting: asking /api/health. ready: it answered. down: it did not answer for GIVE_UP_MS. */
export type ServerStatus = 'unknown' | 'waiting' | 'ready' | 'down';

let status: ServerStatus = 'unknown';
let waiting: Promise<boolean> | null = null;
let startedAt = 0;
const listeners = new Set<() => void>();

function setStatus(next: ServerStatus) {
  if (status === next) return;
  status = next;
  listeners.forEach((listener) => listener());
}

/** For useSyncExternalStore. */
export const serverStatus = (): ServerStatus => status;
export function subscribeServerStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** When the wait in progress started, in milliseconds since 1970, or 0 when nothing is waiting. */
export const serverWaitStartedAt = () => (waiting ? startedAt : 0);

async function answers(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
  try {
    const res = await fetch(apiUrl('/api/health'), { cache: 'no-store', signal: controller.signal });
    if (!res.ok) return false;
    const body = await res.json().catch(() => null);
    return body?.status === 'ok'; // not a host's own "starting" page
  } catch {
    return false; // no answer yet (a sleeping host's reply carries no CORS header, so the browser reports it as a network error)
  } finally {
    clearTimeout(timer);
  }
}

/** Resolves true once the API answers, or false if it still has not after a few minutes (the next call starts a new wait). */
export function waitForServer(): Promise<boolean> {
  if (status === 'ready') return Promise.resolve(true);
  if (!waiting) {
    startedAt = Date.now();
    setStatus('waiting');
    waiting = (async () => {
      while (Date.now() - startedAt < GIVE_UP_MS) {
        const attemptAt = Date.now();
        if (await answers()) return true;
        const pause = PAUSE_MS - (Date.now() - attemptAt);
        if (pause > 0) await new Promise((resolve) => setTimeout(resolve, pause));
      }
      return false;
    })().then((ok) => {
      waiting = null;
      setStatus(ok ? 'ready' : 'down');
      return ok;
    });
  }
  return waiting;
}

/**
 * Sends a request once the API is up. If it still meets no API (no answer, or 502/503/504 from the host), it waits for the API again and
 * sends it one more time. Only for requests that are safe to send twice, such as reading something or signing in.
 */
export async function whenServerReady<T>(send: () => Promise<T>): Promise<T> {
  const up = await waitForServer(); // if this gives up, the request below still goes, so the person sees the real error
  try {
    return await send();
  } catch (err) {
    if (!up || !isUnreachable(err)) throw err;
    if (status === 'ready') setStatus('unknown'); // it answered a moment ago, so it has probably just gone to sleep again
    if (!(await waitForServer())) throw err;
    return send();
  }
}
