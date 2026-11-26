import type { ReactNode } from 'react'
import { Button } from '../../components/ui/Button'
import { LogoMark } from '../../components/ui/Logo'
import { formatCooldown } from './useResendCooldown'

export function EmailSentView({
  title = 'Check your email',
  description,
  hint = 'Don’t see it? Check your spam or junk folder.',
  resendLabel,
  resending = false,
  cooldownSeconds = 0,
  resendStatus,
  resendError,
  onResend,
  backLabel = 'Back to sign in',
  onBack,
  secondaryAction,
}: {
  title?: string
  description: ReactNode
  hint?: string
  resendLabel: string
  resending?: boolean
  cooldownSeconds?: number
  resendStatus?: string | null
  resendError?: string | null
  onResend: () => void
  backLabel?: string
  onBack: () => void
  secondaryAction?: { label: string; onClick: () => void }
}) {
  const coolingDown = cooldownSeconds > 0
  return (
    <div className="text-center">
      <div className="flex flex-col items-center">
        <LogoMark size={44} />
        <h1 className="mt-4 font-display text-2xl font-semibold text-cream">{title}</h1>
        <p className="mt-2 text-sm text-muted">{description}</p>
        {hint && <p className="mt-2 text-xs text-subtle">{hint}</p>}
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {resendStatus && (
          <p role="status" className="rounded-xl bg-lime-400/12 px-3 py-2 text-sm font-semibold text-lime-300">
            {resendStatus}
          </p>
        )}
        {resendError && (
          <p role="alert" className="rounded-xl bg-rose-400/12 px-3 py-2 text-sm font-semibold text-rose-300">
            {resendError}
          </p>
        )}
        <Button
          type="button"
          variant="secondary"
          fullWidth
          loading={resending}
          disabled={coolingDown}
          className="tabular-nums"
          onClick={onResend}
        >
          {coolingDown ? `${resendLabel} (${formatCooldown(cooldownSeconds)})` : resendLabel}
        </Button>
        <Button type="button" fullWidth onClick={onBack}>
          {backLabel}
        </Button>
        {secondaryAction && (
          <button
            type="button"
            onClick={secondaryAction.onClick}
            className="mt-1 self-center text-xs font-semibold text-subtle transition-colors hover:text-cream"
          >
            {secondaryAction.label}
          </button>
        )}
      </div>
    </div>
  )
}
