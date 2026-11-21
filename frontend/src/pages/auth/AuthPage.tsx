import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Form'
import { LogoMark } from '../../components/ui/Logo'
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
  const [loading, setLoading] = useState(false)

  const session = useSession()
  if (session.status === 'authed') {
    navigate('/', { replace: true })
  }

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'signin') {
        await signIn(email, password)
        navigate(from, { replace: true })
      } else {
        const result = await signUp({ email, password, displayName })
        // The mock auto-verifies, but keep the state for a real backend.
        if (result) {
          navigate(from, { replace: true })
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
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
              <p role="alert" className="rounded-xl bg-rose-400/12 px-3 py-2 text-sm font-semibold text-rose-300">
                {error}
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
