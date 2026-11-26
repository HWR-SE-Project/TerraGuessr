import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Form'
import { LogoMark } from '../../components/ui/Logo'
import { api, ApiError } from '../../services'
import { scaleIn } from '../../lib/motion'
import { EmailSentView } from './EmailSentView'
import { RESEND_COOLDOWN_SECONDS, useResendCooldown } from './useResendCooldown'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sentEmail, setSentEmail] = useState<string | null>(null)
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const [resendError, setResendError] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const resendCooldown = useResendCooldown()
  const [passwordUpdated, setPasswordUpdated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function requestReset(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setResendMessage(null)
    setResendError(null)
    const targetEmail = email.trim()
    try {
      await api.auth.requestPasswordReset(targetEmail)
      setSentEmail(targetEmail)
      resendCooldown.start(RESEND_COOLDOWN_SECONDS)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  async function resendReset(targetEmail: string) {
    setResending(true)
    setResendMessage(null)
    setResendError(null)
    try {
      const { message } = await api.auth.requestPasswordReset(targetEmail)
      setResendMessage(message)
      resendCooldown.start(RESEND_COOLDOWN_SECONDS)
    } catch (cause) {
      if (cause instanceof ApiError && cause.retryAfterSeconds !== undefined) {
        resendCooldown.start(cause.retryAfterSeconds)
      }
      setResendError(cause instanceof Error ? cause.message : 'Could not resend recovery email.')
    } finally {
      setResending(false)
    }
  }

  async function completeReset(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api.auth.completePasswordReset(token!, password)
      setPasswordUpdated(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-10">
      <motion.div variants={scaleIn} initial="initial" animate="animate" className="surface w-full max-w-md p-8">
        {!token && sentEmail ? (
          <EmailSentView
            description={
              <>
                If an account exists for <span className="font-semibold text-cream">{sentEmail}</span>, we sent recovery instructions.
              </>
            }
            resendLabel="Resend recovery email"
            resending={resending}
            cooldownSeconds={resendCooldown.remaining}
            resendStatus={resendMessage}
            resendError={resendError}
            onResend={() => void resendReset(sentEmail)}
            onBack={() => navigate('/auth')}
            secondaryAction={{
              label: 'Use a different email',
              onClick: () => {
                setEmail(sentEmail)
                setSentEmail(null)
                setResendMessage(null)
                setResendError(null)
                setError(null)
                resendCooldown.reset()
              },
            }}
          />
        ) : token && passwordUpdated ? (
          <div className="text-center">
            <div className="flex flex-col items-center">
              <LogoMark size={44} />
              <h1 className="mt-4 font-display text-2xl font-semibold text-cream">Password updated</h1>
              <p className="mt-2 text-sm text-muted">You can now sign in with your new password.</p>
            </div>
            <div className="mt-6">
              <Button type="button" fullWidth onClick={() => navigate('/auth')}>
                Back to sign in
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center text-center">
              <LogoMark size={44} />
              <h1 className="mt-4 font-display text-2xl font-semibold text-cream">
                {token ? 'Choose a new password' : 'Reset your password'}
              </h1>
              <p className="mt-1 text-sm text-muted">
                {token
                  ? 'Pick something strong and memorable.'
                  : 'Enter your email and we’ll send recovery instructions.'}
              </p>
            </div>

            <form onSubmit={token ? completeReset : requestReset} className="mt-6 flex flex-col gap-4">
              {token ? (
                <Field label="New password" htmlFor="password" hint="At least 12 characters.">
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (error) setError(null)
                    }}
                    required
                    minLength={12}
                    icon="lock"
                    autoComplete="new-password"
                  />
                </Field>
              ) : (
                <Field label="Email" htmlFor="email">
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (error) setError(null)
                    }}
                    required
                    icon="mail"
                    autoComplete="email"
                  />
                </Field>
              )}
              {error && (
                <p role="alert" className="rounded-xl bg-rose-400/12 px-3 py-2 text-sm font-semibold text-rose-300">
                  {error}
                </p>
              )}
              <Button type="submit" fullWidth size="lg" loading={loading}>
                {token ? 'Update password' : 'Send instructions'}
              </Button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  )
}
