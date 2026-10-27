import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError, getToken, setToken } from '../api/client';
import { isUnreachable } from '../offline/pendingCheckIns';
import { forgetEmergency } from '../roles/patient/emergencyCache';
import { forgetCheckInWomen } from '../offline/pendingCaregiverCheckIns';
import { fetchCurrentUser } from '../api/auth';
import type { CurrentUser } from '../api/auth';

interface AuthContextValue {
  user: CurrentUser | null;
  isLoading: boolean;
  login: (token: string, user: CurrentUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// The last signed-in account is kept on the device so the app can open without a signal (the token is already kept here). It holds the same
// name, role and email the sign-in returned, and it is removed when the person logs out.
const USER_KEY = 'maternasync_user';
const keepUser = (user: CurrentUser | null) => {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {
    // Not kept: the app then asks for a signal at start-up, as before.
  }
};
const keptUser = (): CurrentUser | null => {
  try {
    const kept = JSON.parse(localStorage.getItem(USER_KEY) ?? 'null');
    return kept && typeof kept.id === 'string' && typeof kept.role === 'string' ? (kept as CurrentUser) : null;
  } catch {
    return null;
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    fetchCurrentUser()
      .then((current) => { keepUser(current); setUser(current); })
      .catch((err) => {
        // No signal: carry on as the person who was signed in, and let each page say what it cannot load. The server still decides what
        // they may see as soon as a request reaches it.
        if (isUnreachable(err)) {
          const kept = keptUser();
          if (kept) { setUser(kept); return; }
        }
        // A 401 means the token is invalid, and a 403 means the account may no longer sign in (the care-team login can be
        // switched off). A 5xx or dropped connection is transient — keep the token so a reload recovers instead of logging out.
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) setToken(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = (token: string, authenticatedUser: CurrentUser) => {
    setToken(token);
    keepUser(authenticatedUser);
    setUser(authenticatedUser);
  };

  const logout = () => {
    setToken(null);
    keepUser(null);
    forgetEmergency(); // the emergency page's copy kept for a phone with no signal: a shared phone must not keep it for the next person
    forgetCheckInWomen(); // the same for the name of the woman a trusted person last filled a check-in in for
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
