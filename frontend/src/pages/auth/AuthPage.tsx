import { Navigate } from 'react-router-dom'
import { useSession } from '../../state/SessionContext'
import { AuthLandingPage } from './AuthLandingPage'

export function AuthPage() {
  const { status, user } = useSession()

  if (status === 'ready' && user) return <Navigate to="/" replace />

  return <AuthLandingPage />
}
