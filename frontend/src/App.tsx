import { Route, Routes } from 'react-router-dom'
import { AuthPage } from './pages/auth/AuthPage'
import { AuthLandingPage } from './pages/auth/AuthLandingPage'
import { DuelsPage } from './pages/duels/DuelsPage'
import { SettingsPage } from './pages/settings/SettingsPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<SettingsPage />} />
      <Route path="/landing" element={<AuthLandingPage />} />
      <Route path="/duels" element={<DuelsPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  )
}

export default App
