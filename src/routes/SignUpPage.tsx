import { Navigate, useNavigate } from 'react-router-dom';
import { SignUp } from '../components/auth/SignUp';
import { useAuth } from '../auth/AuthContext';
import { homePathForRole } from '../auth/roleHome';
import { LoadingScreen } from '../components/shared/LoadingScreen';

export function SignUpPage() {
  const { user, isLoading, login } = useAuth();
  const navigate = useNavigate();

  if (isLoading) return <LoadingScreen />;
  if (user) return <Navigate to={homePathForRole(user.role)} replace />;

  return (
    <SignUp
      onAuthenticated={(token, authenticatedUser) => {
        login(token, authenticatedUser);
        navigate(homePathForRole(authenticatedUser.role), { replace: true });
      }}
      onSwitchToSignIn={() => navigate('/signin')}
    />
  );
}
