import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Form'
import { LogoMark } from '../../components/ui/Logo'
import { api, ApiError } from '../../services'
import { signIn, signUp, useSession } from '../../state/session'
import { scaleIn } from '../../lib/motion'
import googleLogo from '../../assets/brand/google-logo.svg'

type Mode = 'signin' | 'register'

export function AuthPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null)
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null)
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const [loading, setLoading] = useState(false)

  const session = useSession()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  useEffect(() => {
    if (session.status === 'authed') {
      navigate('/', { replace: true })
    }
  }, [navigate, session.status])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setUnverifiedEmail(null)
    setResendMessage(null)
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
    try {
      const { message } = await api.auth.resendVerification(targetEmail)
      setResendMessage(message)
    } catch (cause) {
      setResendMessage(cause instanceof Error ? cause.message : 'Could not resend verification email.')
    } finally {
      setResending(false)
    }
  }

  if (pendingVerificationEmail) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-10">
        <motion.div variants={scaleIn} initial="initial" animate="animate" className="surface w-full max-w-md p-8 text-center">
          <div className="flex flex-col items-center">
            <LogoMark size={44} />
            <h1 className="mt-4 font-display text-2xl font-semibold text-cream">Check your email</h1>
            <p className="mt-2 text-sm text-muted">
              We sent a verification link to <span className="font-semibold text-cream">{pendingVerificationEmail}</span>. Verify your address before signing in.
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            {resendMessage && (
              <p role="status" className="rounded-xl bg-lime-400/12 px-3 py-2 text-sm font-semibold text-lime-300">
                {resendMessage}
              </p>
            )}
            <Button
              type="button"
              variant="secondary"
              fullWidth
              loading={resending}
              onClick={() => void resendVerification(pendingVerificationEmail)}
            >
              Resend verification email
            </Button>
            <Button
              type="button"
              fullWidth
              onClick={() => {
                setEmail(pendingVerificationEmail)
                setPendingVerificationEmail(null)
                setResendMessage(null)
                setError(null)
                setMode('signin')
              }}
            >
              Back to sign in
            </Button>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-10">
      <motion.div variants={scaleIn} initial="initial" animate="animate" className="surface w-full max-w-md p-8">
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
                    disabled={resending}
                    onClick={() => void resendVerification(unverifiedEmail)}
                    className="self-start text-xs font-bold text-lime-300 underline hover:text-lime-200 disabled:opacity-50"
                  >
                    {resending ? 'Sending…' : 'Resend verification email'}
                  </button>
                )}
              </div>
            )}
            {resendMessage && (
              <p role="status" className="rounded-xl bg-lime-400/12 px-3 py-2 text-sm font-semibold text-lime-300">
                {resendMessage}
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

        <Button variant="secondary" fullWidth disabled icon="globe" title="Google sign-in is not configured in the mock">
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
      </motion.div>
    </div>
  )
}
