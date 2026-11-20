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
const DuelsPage = lazy(() =>
  import('./pages/duels/DuelsPage').then((m) => ({ default: m.DuelsPage })),
)
const SettingsPage = lazy(() =>
  import('./pages/settings/SettingsPage').then((m) => ({
    default: m.SettingsPage,
  })),
)
const PlayPage = lazy(() =>
  import('./pages/play/PlayPage').then((m) => ({ default: m.PlayPage })),
)
const DailyPage = lazy(() =>
  import('./pages/daily/DailyPage').then((m) => ({ default: m.DailyPage })),
)
const ChallengePage = lazy(() =>
  import('./pages/challenge/ChallengePage').then((m) => ({
    default: m.ChallengePage,
  })),
)
const SingleplayerGamePage = lazy(() =>
  import('./pages/singleplayer/SingleplayerGamePage').then((m) => ({
    default: m.SingleplayerGamePage,
  })),
)

function App() {
  const { pathname } = useLocation()
  useEffect(() => {
    const titles: Record<string, string> = {
      '/': 'Explore the World',
      '/auth': 'Your next adventure',
      '/duels': 'Duels',
      '/game/singleplayer': 'World Explorer',
      '/play': 'Weather expedition',
      '/daily': 'Daily challenge',
      '/settings': 'Settings',
      '/reset-password': 'Reset password',
    }
    document.title = `${titles[pathname] ?? 'Challenge a friend'} · TerraGuessr`
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
          <Route path="/duels" element={<DuelsPage />} />
          <Route path="/game/singleplayer" element={<SingleplayerGamePage />} />
          <Route path="/play" element={<PlayPage />} />
          <Route path="/daily" element={<DailyPage />} />
          <Route path="/challenge/:challengeId" element={<ChallengePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </CosmicBackground>
  )
}
export default App
