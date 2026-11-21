import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import './styles/index.css'
import { SiteLayout } from './components/layout/SiteLayout'
import { GameLayout } from './components/layout/GameLayout'
import { HomePage } from './pages/home/HomePage'
import { SingleplayerPage } from './pages/singleplayer/SingleplayerPage'
import { SingleplayerGamePage } from './pages/singleplayer/SingleplayerGamePage'
import { MultiplayerPage } from './pages/multiplayer/MultiplayerPage'
import { LobbyPage } from './pages/multiplayer/LobbyPage'
import { MultiplayerGamePage } from './pages/multiplayer/MultiplayerGamePage'
import { SettingsPage } from './pages/settings/SettingsPage'
import { AvatarPage } from './pages/avatar/AvatarPage'
import { HowToPlayPage } from './pages/how-to-play/HowToPlayPage'
import { AuthPage } from './pages/auth/AuthPage'
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage'
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage'
import { EmailChangePage } from './pages/auth/EmailChangePage'

const router = createBrowserRouter([
  {
    element: <SiteLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/singleplayer', element: <SingleplayerPage /> },
      { path: '/multiplayer', element: <MultiplayerPage /> },
      { path: '/lobby/:code', element: <LobbyPage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '/avatar', element: <AvatarPage /> },
      { path: '/how-to-play', element: <HowToPlayPage /> },
      { path: '/auth', element: <AuthPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      { path: '/verify-email', element: <VerifyEmailPage /> },
      { path: '/confirm-email-change', element: <EmailChangePage /> },
    ],
  },
  {
    element: <GameLayout />,
    children: [
      { path: '/singleplayer/play', element: <SingleplayerGamePage /> },
      { path: '/lobby/:code/play', element: <MultiplayerGamePage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <RouterProvider router={router} />
    </MotionConfig>
  </StrictMode>,
)
