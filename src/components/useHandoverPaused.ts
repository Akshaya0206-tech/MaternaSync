import { useEffect, useState } from 'react';
import { api } from '../api/client';

/** Handover is on hold while its rules and the way it works are refined. The server enforces this too;
 * the page uses the answer to disable buttons. Until the answer arrives (or if it cannot be fetched) the
 * page stays read-only, which is the safe state. */
export function useHandoverPaused(): boolean {
  const [paused, setPaused] = useState(true);
  useEffect(() => {
    let active = true;
    api
      .get<{ paused: boolean }>('/api/v2/continuity/handover-status')
      .then((result) => { if (active) setPaused(result.paused); })
      .catch(() => { /* stay paused */ });
    return () => { active = false; };
  }, []);
  return paused;
}
