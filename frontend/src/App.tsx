import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { HomePage } from './pages/home/HomePage'
import { lazy, Suspense, useEffect } from 'react'
import { CosmicBackground } from './components/cosmic/CosmicBackground'

const AuthPage = lazy(() =>
  import('./pages/auth/AuthPage').then((m) => ({ default: m.AuthPage })),
)
const ResetPasswordPage = lazy(() =>
  import('./pages/auth/ResetPasswordPage').then((m) => ({
    default: m.ResetPasswordPage,
  })),
)
const VerifyEmailPage = lazy(() =>
  import('./pages/auth/VerifyEmailPage').then((m) => ({
    default: m.VerifyEmailPage,
  })),
)
const EmailChangePage = lazy(() =>
  import('./pages/auth/EmailChangePage').then((m) => ({
    default: m.EmailChangePage,
  })),
)
const SettingsPage = lazy(() =>
  import('./pages/settings/SettingsPage').then((m) => ({
    default: m.SettingsPage,
  })),
)
const SingleplayerGamePage = lazy(() =>
  import('./pages/singleplayer/SingleplayerGamePage').then((m) => ({
    default: m.SingleplayerGamePage,
  })),
)
const LobbyPage = lazy(() =>
  import('./pages/lobby/LobbyPage').then((m) => ({ default: m.LobbyPage })),
)
const MultiplayerGamePage = lazy(() =>
  import('./pages/lobby/MultiplayerGamePage').then((m) => ({
    default: m.MultiplayerGamePage,
  })),
)

function App() {
  const { pathname } = useLocation()
  useEffect(() => {
    const titles: Record<string, string> = {
      '/': 'Explore the World',
      '/auth': 'Your next adventure',
      '/multiplayer': 'Multiplayer',
      '/game/singleplayer': 'World Explorer',
      '/settings': 'Settings',
      '/reset-password': 'Reset password',
      '/verify-email': 'Verify email',
      '/confirm-email-change': 'Confirm email change',
    }
    const title =
      pathname.startsWith('/multiplayer') || pathname.startsWith('/lobby')
        ? 'Multiplayer'
        : (titles[pathname] ?? 'Explore the World')
    document.title = `${title} · TerraGuessr`
  }, [pathname])
  return (
    <CosmicBackground>
      <Suspense
        fallback={
          <div className="tg-route-loading" role="status">
            Finding your next discovery…
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/confirm-email-change" element={<EmailChangePage />} />
          <Route path="/multiplayer" element={<Navigate to="/multiplayer/create" replace />} />
          <Route path="/multiplayer/create" element={<LobbyPage />} />
          <Route path="/multiplayer/join" element={<LobbyPage mode="join" />} />
          <Route path="/lobby" element={<Navigate to="/multiplayer/create" replace />} />
          <Route path="/lobby/:code" element={<LobbyPage />} />
          <Route path="/lobby/:code/game" element={<MultiplayerGamePage />} />
          <Route path="/game/singleplayer" element={<SingleplayerGamePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </CosmicBackground>
  )
}
export default App
