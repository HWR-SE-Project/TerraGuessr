import { useState } from 'react'
import { useSession } from '../state/SessionContext'
import { mapApiError } from '../api/errorMessages'
import { ApiError } from '../api/client'
import * as authApi from '../api/auth'

export type AuthFormMode = 'login' | 'register'

const ERROR_MESSAGES: Partial<Record<string, string>> = {
  VALIDATION_ERROR: 'Check your email, password, and name — password must be at least 12 characters.',
  CONFLICT: 'An account with this email already exists.',
  UNAUTHORIZED: 'Incorrect email or password.',
  EMAIL_NOT_VERIFIED: 'Verify your email address before signing in.',
  LOGIN_LOCKED: 'Too many sign-in attempts. Please wait a few minutes and try again.',
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
  const [notice, setNotice] = useState<string | null>(null)
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null)
  const [canResend, setCanResend] = useState(false)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  function toggleMode() {
    setMode((previous) => (previous === 'login' ? 'register' : 'login'))
    setError(null)
    setNotice(null)
    setCanResend(false)
    setResent(false)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (mode === 'login') {
        await login({ email, password })
      } else {
        const result = await register({ email, password, displayName })
        if (result.verificationRequired) {
          setVerificationEmail(email)
          setNotice(`We sent a verification link to ${email}. Open it to activate your account, then sign in.`)
          setPassword('')
          return
        }
      }
      onSuccess()
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === 'EMAIL_NOT_VERIFIED') {
        setCanResend(true)
        setVerificationEmail(email)
      }
      setError(mapApiError(cause, ERROR_MESSAGES))
    } finally {
      setSubmitting(false)
    }
  }

  async function resend() {
    const target = verificationEmail ?? email
    if (!target) return
    setResending(true)
    setError(null)
    setResent(false)
    try {
      await authApi.resendVerification(target)
      setResent(true)
    } catch (cause) {
      setError(mapApiError(cause, ERROR_MESSAGES))
    } finally {
      setResending(false)
    }
  }

  return {
    mode,
    toggleMode,
    email,
    setEmail,
    password,
    setPassword,
    displayName,
    setDisplayName,
    submitting,
    error,
    notice,
    canResend,
    resending,
    resent,
    resend,
    submit,
  }
}
