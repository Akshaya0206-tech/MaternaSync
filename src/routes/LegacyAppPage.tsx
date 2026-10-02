import { App } from '../App';
import { useAuth } from '../auth/AuthContext';

/** Unmodified entry point into the original Phase 1-5 single-clinician
 * app, kept fully reachable (not deleted or rewritten) while the new
 * role-based workspaces are built out. */
export function LegacyAppPage() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return <App currentUser={user} onLogout={logout} />;
}
