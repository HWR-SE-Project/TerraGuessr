import { useAuthForm } from '../../hooks/useAuthForm'
import { useSession } from '../../state/SessionContext'
import './EmailAuthForm.css'

export interface EmailAuthFormProps {
  onSuccess: () => void
  onForgotPassword?: () => void
  initialMode?: 'login' | 'register'
}

/** Shared email login/register form — used inside the modal dialog and the embedded landing-page card. No Figma coverage exists for this step; styled to match the surrounding dark/pill design tokens. */
export function EmailAuthForm({ onSuccess, onForgotPassword, initialMode = 'login' }: EmailAuthFormProps) {
  const { authConfig } = useSession()
  const {
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
  } = useAuthForm(onSuccess, initialMode)

  if (notice) {
    return (
      <div className="tg-email-form">
        <h2 className="tg-email-form-title">Check your email</h2>
        <p className="tg-email-hint" style={{ textAlign: 'center' }}>
          {notice}
        </p>
        {resent && (
          <p className="tg-email-hint" style={{ textAlign: 'center' }}>
            Verification email sent again.
          </p>
        )}
        {error && (
          <p className="tg-email-error" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          className="tg-email-link"
          onClick={resend}
          disabled={resending}
        >
          {resending ? 'Sending…' : 'Resend verification email'}
        </button>
        <button type="button" className="tg-email-submit" onClick={toggleMode}>
          Back to sign in
        </button>
      </div>
    )
  }

  return (
    <form className="tg-email-form" onSubmit={submit}>
      <h2 className="tg-email-form-title">{mode === 'login' ? 'Log in to play' : 'Sign up to play'}</h2>

      {mode === 'register' && (
        <label className="tg-email-field">
          <span>Display name</span>
          <input
            type="text"
            autoComplete="nickname"
            minLength={2}
            maxLength={40}
            required
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>
      )}

      <label className="tg-email-field">
        <span>Email</span>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>

      <label className="tg-email-field">
        <span>Password</span>
        <input
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          minLength={12}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {mode === 'register' && <small className="tg-email-hint">At least 12 characters.</small>}
      </label>

      {error && (
        <p className="tg-email-error" role="alert">
          {error}
        </p>
      )}

<<<<<<< HEAD
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

      <button type="submit" className="tg-email-submit" disabled={submitting}>
=======
      <button type="submit" className="tg-email-submit tg-control tg-control--primary" disabled={submitting}>
>>>>>>> 13dbf98 (design update)
        {submitting ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
      </button>

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
    </form>
  )
}
