import { Navigate, Route, Routes } from 'react-router-dom'
import { HomePage } from './pages/home/HomePage'
import { AuthPage } from './pages/auth/AuthPage'
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage'
import { DuelsPage } from './pages/duels/DuelsPage'
import { SettingsPage } from './pages/settings/SettingsPage'
import { PlayPage } from './pages/play/PlayPage'
import { DailyPage } from './pages/daily/DailyPage'
import { ChallengePage } from './pages/challenge/ChallengePage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/duels" element={<DuelsPage />} />
      <Route path="/play" element={<PlayPage />} />
      <Route path="/daily" element={<DailyPage />} />
      <Route path="/challenge/:challengeId" element={<ChallengePage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
