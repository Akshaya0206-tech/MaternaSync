import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { LoadingScreen } from '../components/shared/LoadingScreen';

/** Role-agnostic gate for the legacy single-clinician app, which predates
 * the role system and has no equivalent concept of per-role access. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/signin" replace />;

  return <>{children}</>;
}
