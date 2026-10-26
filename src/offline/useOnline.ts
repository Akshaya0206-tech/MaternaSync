import { useSyncExternalStore } from 'react';

const subscribe = (listener: () => void) => {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => { window.removeEventListener('online', listener); window.removeEventListener('offline', listener); };
};

/** Whether the phone says it has a connection. A phone can say yes and still not reach the server, so sending never relies on this alone. */
export const useOnline = (): boolean => useSyncExternalStore(subscribe, () => navigator.onLine);
