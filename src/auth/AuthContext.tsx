import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError, getToken, setToken } from '../api/client';
import { fetchCurrentUser } from '../api/auth';
import type { CurrentUser } from '../api/auth';

interface AuthContextValue {
  user: CurrentUser | null;
  isLoading: boolean;
  login: (token: string, user: CurrentUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

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
      .then(setUser)
      .catch((err) => {
        // Only a 401 means the token is invalid. A 5xx or dropped connection is
        // transient — keep the token so a reload recovers instead of logging out.
        if (err instanceof ApiError && err.status === 401) setToken(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = (token: string, authenticatedUser: CurrentUser) => {
    setToken(token);
    setUser(authenticatedUser);
  };

  const logout = () => {
    setToken(null);
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
