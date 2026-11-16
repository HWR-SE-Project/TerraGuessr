import { Navigate, useNavigate, useOutletContext } from 'react-router-dom';
import { AccountPages } from '../features/auth/AccountPages';
import type { RootOutletContext } from './RootLayout';

export function AccountRoute({ page }: { page: 'profile' | 'settings' }) {
  const navigate = useNavigate();
  const { authUser, setAuthUser, setLanguage } = useOutletContext<RootOutletContext>();

  if (!authUser) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <main className="tg-main">
      <AccountPages
        page={page}
        user={authUser}
        onBack={() => navigate('/')}
        onDeleted={() => { setAuthUser(null); navigate('/'); }}
        onProfileUpdated={(displayName) => setAuthUser({ ...authUser, displayName })}
        onLanguageChange={setLanguage}
      />
    </main>
  );
}

export default AccountRoute;
