import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { homePathForRole } from '../auth/roleHome';
import { LoadingScreen } from '../components/shared/LoadingScreen';
import type { UserRole } from '../api/auth';

interface RequireRoleProps {
  role: UserRole;
  children: ReactNode;
}

/** Frontend gate for UX only — it decides which shell to *render*, never
 * which data loads inside it. Every data request underneath is still
 * independently authorized server-side (require_role / require_episode_access),
 * so changing routes/IDs/localStorage here cannot grant real access. */
export function RequireRole({ role, children }: RequireRoleProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/signin" replace />;
  if (user.role !== role) return <Navigate to={homePathForRole(user.role)} replace />;

  return <>{children}</>;
}
