import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button, Spinner } from '../../components/ui/Button'
import { LogoMark } from '../../components/ui/Logo'
import { scaleIn } from '../../lib/motion'

type Outcome = { phase: 'success' | 'error'; message: string }

export function TokenConfirmation({ title, loadingLabel, missingTokenMessage, confirm, success, failure }: {
  title: string
  loadingLabel: string
  missingTokenMessage: string
  confirm: (token: string) => Promise<string>
  success: { to: string; label: string }
  failure: { to: string; label: string }
}) {
  const [params] = useSearchParams()
  const token = params.get('token')
  const requests = useRef(new Map<string, Promise<string>>())
  const [response, setResponse] = useState<{ token: string; outcome: Outcome } | null>(null)

  useEffect(() => {
    if (!token) return
    let request = requests.current.get(token)
    if (!request) {
      // Reuse the same request when Strict Mode re-runs the effect.
      request = confirm(token)
      requests.current.set(token, request)
    }
    let active = true
    void request.then(
      (message) => { if (active) setResponse({ token, outcome: { phase: 'success', message } }) },
      (cause: unknown) => {
        if (!active) return
        const message = cause instanceof Error ? cause.message : 'Could not confirm this link.'
        setResponse({ token, outcome: { phase: 'error', message } })
      },
    )
    return () => { active = false }
  }, [confirm, token])

  const outcome: Outcome | null = token
    ? response?.token === token ? response.outcome : null
    : { phase: 'error', message: missingTokenMessage }

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-10">
      <motion.div variants={scaleIn} initial="initial" animate="animate" className="surface w-full max-w-md p-8 text-center">
        <LogoMark size={44} />
        <h1 className="mt-4 font-display text-2xl font-semibold text-cream">{title}</h1>
        <div className="mt-6">
          {!outcome && (
            <div role="status" className="flex items-center justify-center gap-2 text-muted">
              <Spinner className="size-5" /> {loadingLabel}
            </div>
          )}
          {outcome?.phase === 'success' && (
            <div className="flex flex-col items-center gap-4">
              <p role="status" className="rounded-2xl bg-lime-400/12 px-4 py-3 text-sm font-semibold text-lime-300">{outcome.message}</p>
              <Button to={success.to}>{success.label}</Button>
            </div>
          )}
          {outcome?.phase === 'error' && (
            <div className="flex flex-col items-center gap-4">
              <p role="alert" className="rounded-2xl bg-rose-400/12 px-4 py-3 text-sm font-semibold text-rose-300">{outcome.message}</p>
              <Link to={failure.to} className="font-bold text-lime-300 hover:underline">{failure.label}</Link>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
