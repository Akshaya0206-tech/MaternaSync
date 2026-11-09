import { useEffect, useState, useSyncExternalStore } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { serverStatus, serverWaitStartedAt, subscribeServerStatus, waitForServer } from '../../api/serverWake';
import { useLanguage } from '../../i18n';

/** An API that is awake answers well within this, so a quick check shows nothing. */
const SHOW_AFTER_MS = 1500;

export type ServerWake = { state: 'ready' | 'checking' | 'starting' | 'down'; seconds: number };

/** Starts waking the API when the page opens (see api/serverWake). 'starting' only once the wait has gone on long enough to mention. */
export function useServerWake(): ServerWake {
  const status = useSyncExternalStore(subscribeServerStatus, serverStatus);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    void waitForServer();
  }, []);
  useEffect(() => {
    if (status !== 'waiting') return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [status]);
  if (status === 'ready' || status === 'down') return { state: status, seconds: 0 };
  const waited = status === 'waiting' ? now - serverWaitStartedAt() : 0;
  return waited >= SHOW_AFTER_MS ? { state: 'starting', seconds: Math.round(waited / 1000) } : { state: 'checking', seconds: 0 };
}

/** Says that the server is starting (or not answering), so a slow first sign-in is not mistaken for a broken one. */
export function ServerWakeNotice({ wake, hint }: { wake: ServerWake; hint?: string }) {
  const { t } = useLanguage();
  if (wake.state === 'starting') {
    return (
      <div role="status" aria-live="polite" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
        <Loader2 size={16} className="spin-slow" style={{ flexShrink: 0, marginTop: 2, color: 'var(--teal-primary)' }} aria-hidden="true" />
        <div>
          <strong style={{ color: 'var(--text-primary)' }}>{t('Starting the server… ({seconds} s)', { seconds: wake.seconds })}</strong>
          <div style={{ marginTop: 2 }}>
            {t('When no one has used the site for a while, the server needs about a minute to start. You can fill in the form now: it goes through by itself once the server is ready.')}
            {hint ? ` ${hint}` : ''}
          </div>
        </div>
      </div>
    );
  }
  if (wake.state === 'down') {
    return (
      <div role="alert" style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--rose-urgent-bg)', color: 'var(--rose-urgent)', border: '1px solid rgba(156, 58, 34, 0.3)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '0.8rem', marginBottom: 16 }}>
        <AlertCircle size={16} style={{ flexShrink: 0 }} aria-hidden="true" />
        <span style={{ flex: 1 }}>{t('The server is not answering. Please try again in a few minutes.')}</span>
        <button type="button" className="btn-secondary" style={{ flexShrink: 0, fontSize: '0.75rem', padding: '5px 10px' }} onClick={() => void waitForServer()}>
          {t('Try again')}
        </button>
      </div>
    );
  }
  return null;
}
