import { useCallback, useEffect, useState } from 'react';
import { useCaregiver } from './CaregiverContext';

/** Loads something for the woman being looked after, again whenever the choice changes. */
export function useForWoman<T>(load: (linkId: string) => Promise<T>, allowed = true) {
  const { current } = useCaregiver();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const linkId = current?.linkId;
  const reload = useCallback(async () => {
    if (!linkId || !allowed) return;
    try {
      setData(await load(linkId));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not load this page. Please try again.');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkId, allowed]);
  useEffect(() => {
    setData(null);
    setLoading(true);
    void reload();
  }, [reload]);
  return { data, error, loading, reload };
}
