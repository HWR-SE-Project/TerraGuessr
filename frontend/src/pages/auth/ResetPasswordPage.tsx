import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Form'
import { LogoMark } from '../../components/ui/Logo'
import { api } from '../../services'
import { scaleIn } from '../../lib/motion'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function requestReset(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { message } = await api.auth.requestPasswordReset(email)
      setMessage(message)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  async function completeReset(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api.auth.completePasswordReset(token!, password)
      setMessage('Password updated. You can now sign in.')
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
            {token ? 'Choose a new password' : 'Reset your password'}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {token
              ? 'Pick something strong and memorable.'
              : 'Enter your email and we’ll send recovery instructions.'}
          </p>
        </div>

        {message ? (
          <div className="mt-6 flex flex-col items-center gap-4 text-center">
            <p className="rounded-2xl bg-lime-400/12 px-4 py-3 text-sm font-semibold text-lime-300">{message}</p>
            <Button onClick={() => navigate('/auth')}>Back to sign in</Button>
          </div>
        ) : (
          <form onSubmit={token ? completeReset : requestReset} className="mt-6 flex flex-col gap-4">
            {token ? (
              <Field label="New password" htmlFor="password" hint="At least 12 characters.">
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                  onChange={(e) => setEmail(e.target.value)}
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
        )}
      </motion.div>
    </div>
  )
}
