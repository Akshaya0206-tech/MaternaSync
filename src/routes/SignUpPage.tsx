import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { SignUp } from '../components/auth/SignUp';
import { useAuth } from '../auth/AuthContext';
import { homePathForRole } from '../auth/roleHome';
import { LoadingScreen } from '../components/shared/LoadingScreen';

export function SignUpPage() {
  const { user, isLoading, login } = useAuth();
  const navigate = useNavigate();
  // Signing in re-renders this page with a user, which redirects; it has to know where to if that is not the home page.
  const [landOn, setLandOn] = useState<string | null>(null);

  if (isLoading) return <LoadingScreen />;
  if (user) return <Navigate to={landOn ?? homePathForRole(user.role)} replace />;

  return (
    <SignUp
      onAuthenticated={(token, authenticatedUser, options) => {
        const destination = options?.landOn ?? homePathForRole(authenticatedUser.role);
        setLandOn(destination);
        login(token, authenticatedUser);
        navigate(destination, { replace: true });
      }}
      onSwitchToSignIn={() => navigate('/signin')}
    />
  );
}
