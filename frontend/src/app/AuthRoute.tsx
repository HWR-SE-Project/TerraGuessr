import { useNavigate, useOutletContext } from 'react-router-dom';
import { AuthPage } from '../features/auth/AuthPage';
import type { RootOutletContext } from './RootLayout';

export function AuthRoute() {
  const navigate = useNavigate();
  const { authConfig, resetToken, setAuthUser } = useOutletContext<RootOutletContext>();

  return (
    <AuthPage
      googleAvailable={authConfig.googleAvailable}
      recoveryAvailable={authConfig.passwordRecoveryAvailable}
      resetToken={resetToken}
      onAuthenticated={(user) => {
        setAuthUser(user);
        navigate('/');
      }}
    />
  );
}

export default AuthRoute;
