import { useEffect, useState } from 'react';
import { SignIn } from './SignIn';
import { SignUp } from './SignUp';
import { getToken, setToken } from '../../api/client';
import { fetchCurrentUser } from '../../api/auth';
import type { CurrentUser } from '../../api/auth';
import { HeartPulse } from 'lucide-react';

interface AuthGateProps {
  children: (user: CurrentUser, logout: () => void) => React.ReactNode;
}

export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    fetchCurrentUser()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setIsLoading(false));
  }, []);

  const handleAuthenticated = (token: string, authenticatedUser: CurrentUser) => {
    setToken(token);
    setUser(authenticatedUser);
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setMode('signin');
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream-warm)', gap: '10px', color: 'var(--text-secondary)' }}>
        <HeartPulse size={20} style={{ color: 'var(--teal-primary)' }} />
        <span style={{ fontSize: '0.9rem' }}>Loading MaternaSync…</span>
      </div>
    );
  }

  if (!user) {
    return mode === 'signin'
      ? <SignIn onAuthenticated={handleAuthenticated} onSwitchToSignUp={() => setMode('signup')} />
      : <SignUp onAuthenticated={handleAuthenticated} onSwitchToSignIn={() => setMode('signin')} />;
  }

  return <>{children(user, handleLogout)}</>;
};
