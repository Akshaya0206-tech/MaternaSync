import { Navigate, useNavigate } from 'react-router-dom';
import { SignIn } from '../components/auth/SignIn';
import { useAuth } from '../auth/AuthContext';
import { homePathForRole } from '../auth/roleHome';
import { LoadingScreen } from '../components/shared/LoadingScreen';

export function SignInPage() {
  const { user, isLoading, login } = useAuth();
  const navigate = useNavigate();

  if (isLoading) return <LoadingScreen />;
  if (user) return <Navigate to={homePathForRole(user.role)} replace />;

  return (
    <SignIn
      onAuthenticated={(token, authenticatedUser) => {
        login(token, authenticatedUser);
        navigate(homePathForRole(authenticatedUser.role), { replace: true });
      }}
      onSwitchToSignUp={() => navigate('/signup')}
    />
  );
}
