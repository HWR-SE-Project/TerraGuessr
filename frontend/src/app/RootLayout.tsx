import { useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/client';
import type { AuthUser } from '../features/auth/AuthPage';
import { TutorialDialog } from '../features/tutorial';

export interface RootOutletContext {
  authUser: AuthUser | null;
  setAuthUser: (user: AuthUser | null) => void;
  language: 'en' | 'de';
  setLanguage: (language: 'en' | 'de') => void;
  authConfig: { googleAvailable: boolean; passwordRecoveryAvailable: boolean };
  resetToken: string | null;
  setChrome: (mode: 'normal' | 'compact') => void;
  openTutorial: () => void;
}

const NAV_COPY = {
  en: { help: 'Help', duels: 'Duels', settings: 'Settings', profile: 'Profile', statistics: 'Statistics', leaderboard: 'Leaderboard', signIn: 'Sign in', signOut: 'Sign out' },
  de: { help: 'Hilfe', duels: 'Duelle', settings: 'Einstellungen', profile: 'Profil', statistics: 'Statistik', leaderboard: 'Bestenliste', signIn: 'Anmelden', signOut: 'Abmelden' },
};

/**
 * Shared shell: top navigation, session/tutorial bootstrap, and the outlet
 * every real page (Home/Duels/Auth/Profile/...) renders into. Pages that need
 * nav-aware state (auth user, language, chrome density) read it via
 * `useOutletContext<RootOutletContext>()` instead of prop-drilling.
 */
export function RootLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [language, setLanguage] = useState<'en' | 'de'>('en');
  const [authConfig, setAuthConfig] = useState({ googleAvailable: false, passwordRecoveryAvailable: false });
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [chrome, setChrome] = useState<'normal' | 'compact'>('normal');
  const [resetToken] = useState(() => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('token')));

  useEffect(() => {
    void apiFetch<{ user: AuthUser | null; preferences?: { language?: 'en' | 'de' } | null }>('/auth/session')
      .then((result) => { setAuthUser(result.user); if (result.preferences?.language) setLanguage(result.preferences.language); })
      .catch(() => undefined);
    void apiFetch<typeof authConfig>('/auth/config').then(setAuthConfig).catch(() => undefined);
  }, []);
  useEffect(() => { document.documentElement.lang = language; }, [language]);

  const copy = NAV_COPY[language];

  function handlePlayAgain(event: React.MouseEvent) {
    if (location.pathname !== '/') {
      event.preventDefault();
      navigate('/');
    }
  }

  async function handleSignOut(): Promise<void> {
    await apiFetch('/auth/logout', { method: 'POST' }).catch(() => undefined);
    setAuthUser(null);
    setLanguage('en');
    navigate('/');
  }

  if (resetToken && location.pathname !== '/auth') {
    return <Navigate to={`/auth${location.search}`} replace />;
  }

  const context: RootOutletContext = { authUser, setAuthUser, language, setLanguage, authConfig, resetToken, setChrome, openTutorial: () => setTutorialOpen(true) };

  return (
    <div className="tg-shell">
      <header className={chrome === 'compact' ? 'tg-topbar tg-topbar-compact' : 'tg-topbar'}>
        <Link className="tg-brand" to="/" onClick={handlePlayAgain}>
          <span className="tg-brand-mark" aria-hidden="true">⌖</span>
          <span className="tg-brand-name">Terra<span>Guessr</span></span>
        </Link>
        <nav className="tg-nav" aria-label="Main navigation">
          <Link to="/duels"><span aria-hidden="true">⚔</span><span className="tg-nav-label">{copy.duels}</span></Link>
          <button type="button" onClick={() => setTutorialOpen(true)} data-testid="how-to-play"><span aria-hidden="true">ⓘ</span><span className="tg-nav-label">{copy.help}</span></button>
          {authUser ? (
            <>
              <Link to="/statistics" aria-label={copy.statistics}>{copy.statistics}</Link>
              <Link to="/leaderboard" aria-label={copy.leaderboard}>{copy.leaderboard}</Link>
              <Link to="/settings" aria-label={copy.settings}>{copy.settings}</Link>
              <Link to="/profile" aria-label={copy.profile}>{copy.profile}</Link>
              <button type="button" aria-label={copy.signOut} onClick={() => void handleSignOut()}>{copy.signOut}</button>
            </>
          ) : (
            <Link to="/auth" aria-label={copy.signIn}>{copy.signIn}</Link>
          )}
        </nav>
      </header>
      <Outlet context={context} />
      <TutorialDialog open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
    </div>
  );
}

export default RootLayout;
