import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '../../components/ui/Button'
import { LogoMark } from '../../components/ui/Logo'
import { Spinner } from '../../components/ui/Button'
import { api } from '../../services'
import { scaleIn } from '../../lib/motion'

type State = { phase: 'loading' } | { phase: 'ok' } | { phase: 'error'; message: string }

export function VerifyEmailPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [state, setState] = useState<State>({ phase: 'loading' })

  useEffect(() => {
    if (!token) {
      setState({ phase: 'error', message: 'This verification link is missing a token.' })
      return
    }
    api.auth
      .verifyEmail(token)
      .then(() => setState({ phase: 'ok' }))
      .catch((cause: Error) => setState({ phase: 'error', message: cause.message }))
  }, [token])

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-10">
      <motion.div variants={scaleIn} initial="initial" animate="animate" className="surface w-full max-w-md p-8 text-center">
        <LogoMark size={44} />
        <h1 className="mt-4 font-display text-2xl font-semibold text-cream">Email verification</h1>
        <div className="mt-6">
          {state.phase === 'loading' && (
            <div className="flex items-center justify-center gap-2 text-muted">
              <Spinner className="size-5" /> Verifying…
            </div>
          )}
          {state.phase === 'ok' && (
            <div className="flex flex-col items-center gap-4">
              <p className="rounded-2xl bg-lime-400/12 px-4 py-3 text-sm font-semibold text-lime-300">
                Your email is verified. Welcome aboard!
              </p>
              <Button to="/">Continue exploring</Button>
            </div>
          )}
          {state.phase === 'error' && (
            <div className="flex flex-col items-center gap-4">
              <p className="rounded-2xl bg-rose-400/12 px-4 py-3 text-sm font-semibold text-rose-300">
                {state.message}
              </p>
              <Link to="/auth" className="font-bold text-lime-300 hover:underline">
                Back to sign in
              </Link>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
