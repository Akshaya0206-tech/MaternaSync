import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { listWomen } from '../../api/caregiver';
import type { Permission, Woman } from '../../api/caregiver';

const STORAGE_KEY = 'maternasync.caregiver.woman';

interface CaregiverValue {
  /** null while loading */
  women: Woman[] | null;
  current: Woman | null;
  error: string;
  select: (linkId: string) => void;
  reload: () => Promise<void>;
  can: (permission: Permission) => boolean;
}

const CaregiverContext = createContext<CaregiverValue | null>(null);

function remembered(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

/** Which woman the trusted person is looking after, and what each has allowed them. The server checks every request again; this only decides what to show. */
export function CaregiverProvider({ children }: { children: ReactNode }) {
  const [women, setWomen] = useState<Woman[] | null>(null);
  const [chosen, setChosen] = useState(remembered);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      setWomen(await listWomen());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not load this page. Please try again.');
      setWomen((previous) => previous ?? []);
    }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  const current = useMemo(() => women?.find((w) => w.linkId === chosen) ?? women?.[0] ?? null, [women, chosen]);
  const select = useCallback((linkId: string) => {
    setChosen(linkId);
    try {
      window.localStorage.setItem(STORAGE_KEY, linkId);
    } catch {
      /* private mode: the choice only lasts until the page is closed */
    }
  }, []);
  const can = useCallback((permission: Permission) => Boolean(current?.permissions?.[permission]), [current]);

  const value = useMemo(() => ({ women, current, error, select, reload, can }), [women, current, error, select, reload, can]);
  return <CaregiverContext.Provider value={value}>{children}</CaregiverContext.Provider>;
}

export function useCaregiver(): CaregiverValue {
  const value = useContext(CaregiverContext);
  if (!value) throw new Error('useCaregiver must be used inside CaregiverProvider');
  return value;
}
