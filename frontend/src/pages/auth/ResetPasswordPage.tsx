import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useState } from 'react'
import { AppHeader } from '../../components/layout/AppHeader'
import { useNavigate, useSearchParams } from 'react-router-dom'
import * as authApi from '../../api/auth'
import { mapApiError } from '../../api/errorMessages'
import './AuthPage.css'
import '../../components/auth/EmailAuthForm.css'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await authApi.completePasswordReset(token, password)
      setDone(true)
    } catch (cause) {
      setError(
        mapApiError(cause, {
          VALIDATION_ERROR: 'That reset link is invalid or has expired.',
        }),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
    <AppHeader />
    <main className="tg-auth-root">
      <div className="tg-reset-card">
        {!token ? (
          <div className="tg-email-form">
            <h2 className="tg-email-form-title">Invalid link</h2>
            <p className="tg-email-hint" style={{ textAlign: 'center' }}>
              This password reset link is missing its token. Request a new one
              from the sign-in screen.
            </p>
            <Button
              type="button"
              className="tg-email-submit"
              onClick={() => navigate('/auth')}
            >
              Back to sign in
            </Button>
          </div>
        ) : done ? (
          <div className="tg-email-form">
            <h2 className="tg-email-form-title">Password updated</h2>
            <p className="tg-email-hint" style={{ textAlign: 'center' }}>
              You can now log in with your new password.
            </p>
            <Button
              type="button"
              className="tg-email-submit"
              onClick={() => navigate('/auth')}
            >
              Go to sign in
            </Button>
          </div>
        ) : (
          <form className="tg-email-form" onSubmit={submit}>
            <h2 className="tg-email-form-title">Choose a new password</h2>
            <label className="tg-email-field">
              <span>New password</span>
              <Input
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <small className="tg-email-hint">At least 12 characters.</small>
            </label>
            {error && (
              <p className="tg-email-error" role="alert">
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="tg-email-submit"
              disabled={submitting}
            >
              {submitting ? 'Updating…' : 'Update password'}
            </Button>
          </form>
        )}
      </div>
    </main>
    </>
  )
}
