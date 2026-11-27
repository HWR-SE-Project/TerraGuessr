import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Form'
import { LogoMark } from '../../components/ui/Logo'
import { api, ApiError } from '../../services'
import { signIn, signUp, useSession } from '../../state/session'
import { scaleIn } from '../../lib/motion'
import { EmailSentView } from './EmailSentView'
import { formatCooldown, RESEND_COOLDOWN_SECONDS, useResendCooldown } from './useResendCooldown'
import { PrivacyDialog } from '../privacy/PrivacyContent'
import googleLogo from '../../assets/brand/google-logo.svg'

type Mode = 'signin' | 'register'

const GOOGLE_AUTH_ERROR_MESSAGES: Record<string, string> = {
  google_cancelled: 'Google sign-in was cancelled.',
  google_email_exists:
    'An account with this email already exists. Please sign in with your email and password.',
  google_unavailable: 'Google sign-in is temporarily unavailable. Please try again in a moment.',
  google_failed: 'Google sign-in could not be verified. Please try again.',
}

export function AuthPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(() => {
    const code = searchParams.get('authError')
    return code ? (GOOGLE_AUTH_ERROR_MESSAGES[code] ?? null) : null
  })
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null)
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null)
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const [resendError, setResendError] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const resendCooldown = useResendCooldown()
  const [loading, setLoading] = useState(false)
  const [googleAvailable, setGoogleAvailable] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)

  const session = useSession()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  useEffect(() => {
    if (session.status === 'authed') {
      navigate('/', { replace: true })
    }
  }, [navigate, session.status])

  useEffect(() => {
    if (!searchParams.has('authError')) return
    const next = new URLSearchParams(searchParams)
    next.delete('authError')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    let active = true
    api.auth
      .getConfig()
      .then((config) => {
        if (active) setGoogleAvailable(config.googleAvailable)
      })
      .catch(() => {
        if (active) setGoogleAvailable(false)
      })
    return () => {
      active = false
    }
  }, [])

  function handleGoogleSignIn() {
    if (!googleAvailable || googleLoading) return
    setError(null)
    setGoogleLoading(true)
    window.location.assign(api.auth.getGoogleAuthUrl())
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setUnverifiedEmail(null)
    setResendMessage(null)
    setResendError(null)
    setLoading(true)
    try {
      if (mode === 'signin') {
        await signIn(email, password)
        navigate(from, { replace: true })
      } else {
        const result = await signUp({ email, password, displayName })
        if (result.verificationRequired) {
          setPendingVerificationEmail(result.user.email)
          setPassword('')
          resendCooldown.start(RESEND_COOLDOWN_SECONDS)
        } else {
          navigate(from, { replace: true })
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Something went wrong.')
      if (cause instanceof ApiError && cause.code === 'EMAIL_NOT_VERIFIED') {
        setUnverifiedEmail(email.trim())
      }
    } finally {
      setLoading(false)
    }
  }

  async function resendVerification(targetEmail: string) {
    setResending(true)
    setResendMessage(null)
    setResendError(null)
    try {
      const { message } = await api.auth.resendVerification(targetEmail)
      setResendMessage(message)
      resendCooldown.start(RESEND_COOLDOWN_SECONDS)
    } catch (cause) {
      if (cause instanceof ApiError && cause.retryAfterSeconds !== undefined) {
        resendCooldown.start(cause.retryAfterSeconds)
      }
      setResendError(cause instanceof Error ? cause.message : 'Could not resend verification email.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-10">
      <motion.div variants={scaleIn} initial="initial" animate="animate" className="surface w-full max-w-md p-8">
        {pendingVerificationEmail ? (
          <EmailSentView
            description={
              <>
                We sent a verification link to <span className="font-semibold text-cream">{pendingVerificationEmail}</span>. Verify your address before signing in.
              </>
            }
            resendLabel="Resend verification email"
            resending={resending}
            cooldownSeconds={resendCooldown.remaining}
            resendStatus={resendMessage}
            resendError={resendError}
            onResend={() => void resendVerification(pendingVerificationEmail)}
            onBack={() => {
              setEmail(pendingVerificationEmail)
              setPendingVerificationEmail(null)
              setResendMessage(null)
              setResendError(null)
              resendCooldown.reset()
              setError(null)
              setMode('signin')
            }}
          />
        ) : (
          <>
            <div className="flex flex-col items-center text-center">
              <LogoMark size={44} />
              <h1 className="mt-4 font-display text-2xl font-semibold text-cream">
                {mode === 'signin' ? 'Welcome back, explorer' : 'Join the adventure'}
              </h1>
              <p className="mt-1 text-sm text-muted">
                {mode === 'signin' ? 'Pick up where you left off.' : 'Create an account to save your progress.'}
              </p>
            </div>

        <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
          {mode === 'register' && (
              <Field label="Display name" htmlFor="displayName">
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Wandering Nix"
                  minLength={2}
                  maxLength={40}
                  required
                  icon="person"
                  autoComplete="name"
                />
              </Field>
            )}
            <Field label="Email" htmlFor="email">
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                icon="mail"
                autoComplete="email"
              />
            </Field>
            <Field
              label="Password"
              htmlFor="password"
              hint={mode === 'register' ? 'At least 12 characters.' : undefined}
            >
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                minLength={mode === 'register' ? 12 : undefined}
                icon="lock"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              />
            </Field>

            {error && (
              <div role="alert" className="flex flex-col gap-2 rounded-xl bg-rose-400/12 px-3 py-2 text-sm font-semibold text-rose-300">
                <p>{error}</p>
                {unverifiedEmail && (
                  <button
                    type="button"
                    disabled={resending || resendCooldown.remaining > 0}
                    onClick={() => void resendVerification(unverifiedEmail)}
                    className="self-start text-xs font-bold tabular-nums text-lime-300 underline hover:text-lime-200 disabled:opacity-50"
                  >
                    {resending
                      ? 'Sending…'
                      : resendCooldown.remaining > 0
                        ? `Resend verification email (${formatCooldown(resendCooldown.remaining)})`
                        : 'Resend verification email'}
                  </button>
                )}
              </div>
            )}
            {resendMessage && (
              <p role="status" className="rounded-xl bg-lime-400/12 px-3 py-2 text-sm font-semibold text-lime-300">
                {resendMessage}
              </p>
            )}
            {resendError && (
              <p role="alert" className="rounded-xl bg-rose-400/12 px-3 py-2 text-sm font-semibold text-rose-300">
                {resendError}
              </p>
            )}

            <Button type="submit" fullWidth size="lg" loading={loading} icon={mode === 'signin' ? 'play' : 'sparkle'}>
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

        <div className="my-4 flex items-center gap-3">
          <span className="h-px flex-1 bg-white/10" />
          <span className="text-xs font-bold uppercase tracking-wider text-subtle">or</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <Button
          type="button"
          variant="secondary"
          fullWidth
          disabled={!googleAvailable}
          loading={googleLoading}
          onClick={handleGoogleSignIn}
          title={googleAvailable ? undefined : 'Google sign-in is not configured'}
        >
          <img src={googleLogo} alt="" className="size-4" />
          Continue with Google
        </Button>

        <div className="mt-6 flex flex-col items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signin' ? 'register' : 'signin')
              setError(null)
            }}
            className="font-bold text-lime-300 hover:underline"
          >
            {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
          {mode === 'signin' && (
            <button type="button" onClick={() => navigate('/reset-password')} className="font-semibold text-subtle hover:text-cream">
              Forgot your password?
            </button>
          )}
        </div>

        <p className="mt-5 border-t border-white/8 pt-4 text-center text-xs text-subtle">
          No ads or tracking.{' '}
          <button
            type="button"
            onClick={() => setPrivacyOpen(true)}
            className="font-semibold text-muted underline decoration-white/20 underline-offset-4 transition-colors hover:text-cream"
          >
            How your data is used
          </button>
        </p>
          </>
        )}
      </motion.div>
      <PrivacyDialog open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </div>
  )
}
