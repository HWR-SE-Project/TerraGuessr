import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { mapApiError } from '../../api/errorMessages'
import { ApiError } from '../../api/client'
import * as authApi from '../../api/auth'
import { Input } from '../ui/Input'
import { useSession } from '../../state/SessionContext'
import { Button } from '../ui/Button'
import { collapseVariants, noticeVariants } from '../../lib/motion'
import './EmailAuthForm.css'

const ERROR_MESSAGES: Partial<Record<string, string>> = {
  VALIDATION_ERROR: 'Check your email, password, and name — password must be at least 12 characters.',
  CONFLICT: 'An account with this email already exists.',
  UNAUTHORIZED: 'Incorrect email or password.',
  EMAIL_NOT_VERIFIED: 'Verify your email address before signing in.',
  LOGIN_LOCKED: 'Too many sign-in attempts. Please wait a few minutes and try again.',
  RATE_LIMITED: 'Too many attempts. Try again in a minute.',
  NETWORK_ERROR: 'Could not reach the server. Check your connection and try again.',
}

export interface EmailAuthFormProps {
  onSuccess: () => void
  onForgotPassword?: () => void
  initialMode?: 'login' | 'register'
}

/** Account form state and submission stay local; SessionProvider owns authentication. */
export function EmailAuthForm({ onSuccess, onForgotPassword, initialMode = 'login' }: EmailAuthFormProps) {
  const { authConfig, login, register } = useSession()
  const [mode, setMode] = useState<'login' | 'register'>(initialMode)
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

  return (
    <AnimatePresence mode="wait" initial={false}>
      {notice ? (
        <motion.div
          key="notice"
          className="tg-email-form"
          variants={collapseVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <h2 className="tg-email-form-title">Check your email</h2>
          <p className="tg-email-hint" style={{ textAlign: 'center' }}>
            {notice}
          </p>
          {resent && (
            <p className="tg-email-hint" style={{ textAlign: 'center' }}>
              Verification email sent again.
            </p>
          )}
          <AnimatePresence>
            {error && (
              <motion.p
                key="notice-error"
                className="tg-email-error"
                role="alert"
                variants={noticeVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
          <button
            type="button"
            className="tg-email-link"
            onClick={resend}
            disabled={resending}
          >
            {resending ? 'Sending…' : 'Resend verification email'}
          </button>
          <Button className="tg-email-submit" onClick={toggleMode}>
            Back to sign in
          </Button>
        </motion.div>
      ) : (
        <motion.form
          key="form"
          className="tg-email-form"
          onSubmit={submit}
          variants={collapseVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <h2 className="tg-email-form-title">{mode === 'login' ? 'Log in to play' : 'Sign up to play'}</h2>

          {mode === 'register' && (
            <motion.label
              className="tg-email-field"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <span>Display name</span>
              <Input
                type="text"
                autoComplete="nickname"
                minLength={2}
                maxLength={40}
                required
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </motion.label>
          )}

          <label className="tg-email-field">
            <span>Email</span>
            <Input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="tg-email-field">
            <span>Password</span>
            <Input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={12}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {mode === 'register' && <small className="tg-email-hint">At least 12 characters.</small>}
          </label>

          <AnimatePresence>
            {error && (
              <motion.p
                key="form-error"
                className="tg-email-error"
                role="alert"
                variants={noticeVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {canResend && email && (
            <button
              type="button"
              className="tg-email-link"
              onClick={resend}
              disabled={resending}
            >
              {resending ? 'Sending…' : resent ? 'Verification email sent' : 'Resend verification email'}
            </button>
          )}

          <Button type="submit" className="tg-email-submit" disabled={submitting}>
            {submitting ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </Button>

          <div className="tg-email-footer">
            {mode === 'login' && authConfig?.passwordRecoveryAvailable && onForgotPassword && (
              <button type="button" className="tg-email-link" onClick={onForgotPassword}>
                Forgot password?
              </button>
            )}
            <button type="button" className="tg-email-link" onClick={toggleMode}>
              {mode === 'login' ? 'Create an account' : 'Back to sign in'}
            </button>
          </div>
        </motion.form>
      )}
    </AnimatePresence>
  )
}
