import { Input } from '../ui/Input'
import { useState } from 'react'
import * as authApi from '../../api/auth'
import { mapApiError } from '../../api/errorMessages'
import { Button } from '../ui/Button'
import './EmailAuthForm.css'

export function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await authApi.requestPasswordReset(email)
      setSent(true)
    } catch (cause) {
      setError(mapApiError(cause, { RATE_LIMITED: 'Too many requests. Try again in an hour.' }))
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <div className="tg-email-form">
        <h2 className="tg-email-form-title">Check your email</h2>
        <p className="tg-email-hint" style={{ textAlign: 'center' }}>
          If an account exists for {email}, a reset link is on its way.
        </p>
        <button type="button" className="tg-email-link" onClick={onBack}>
          Back to sign in
        </button>
      </div>
    )
  }

  return (
    <form className="tg-email-form" onSubmit={submit}>
      <h2 className="tg-email-form-title">Reset your password</h2>
      <label className="tg-email-field">
        <span>Email</span>
        <Input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      {error && <p className="tg-email-error" role="alert">{error}</p>}
      <Button type="submit" className="tg-email-submit" disabled={submitting}>
        {submitting ? 'Sending…' : 'Send reset link'}
      </Button>
      <div className="tg-email-footer">
        <button type="button" className="tg-email-link" onClick={onBack}>
          Back to sign in
        </button>
      </div>
    </form>
  )
}
