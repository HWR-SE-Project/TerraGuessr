import { useState } from 'react'
import { useSession } from '../state/SessionContext'
import { mapApiError } from '../api/errorMessages'

export type AuthFormMode = 'login' | 'register'

const ERROR_MESSAGES: Partial<Record<string, string>> = {
  VALIDATION_ERROR: 'Check your email, password, and name — password must be at least 12 characters.',
  CONFLICT: 'An account with this email already exists.',
  UNAUTHORIZED: 'Incorrect email or password.',
  RATE_LIMITED: 'Too many attempts. Try again in a minute.',
  NETWORK_ERROR: 'Could not reach the server. Check your connection and try again.',
}

/** Shared controlled-form state for the email login/register flow, used by both the modal dialog and the embedded landing-page card. */
export function useAuthForm(onSuccess: () => void, initialMode: AuthFormMode = 'login') {
  const { login, register } = useSession()
  const [mode, setMode] = useState<AuthFormMode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleMode() {
    setMode((previous) => (previous === 'login' ? 'register' : 'login'))
    setError(null)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (mode === 'login') {
        await login({ email, password })
      } else {
        await register({ email, password, displayName })
      }
      onSuccess()
    } catch (cause) {
      setError(mapApiError(cause, ERROR_MESSAGES))
    } finally {
      setSubmitting(false)
    }
  }

  return { mode, toggleMode, email, setEmail, password, setPassword, displayName, setDisplayName, submitting, error, submit }
}
