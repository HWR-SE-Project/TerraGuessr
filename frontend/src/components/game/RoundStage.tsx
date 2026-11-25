import { lazy, Suspense, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { GeographicIntelligence as Intelligence, GuessInput, StreetRound } from '../../lib/contracts'
import { DioramaLoading } from '../../scene/diorama/DioramaFallback'
import { GeographicIntelligence } from './GeographicIntelligence'
import { GuessPanel } from './GuessPanel'
import { Timer } from './Timer'
import { TopHud } from './TopHud'

const BiomeDiorama = lazy(() =>
  import('../../scene/diorama/BiomeDiorama').then((module) => ({ default: module.BiomeDiorama })),
)

type RoundView = Omit<StreetRound, 'startedAt'>

interface RoundHud {
  score: number
  roundsTotal?: number
  pauseExpiry?: boolean
  onExpired: () => void
  onLeave: () => void
  leaveLabel?: string
}

interface RoundControls {
  disabled?: boolean
  loadIntelligence: (roundId: string, signal?: AbortSignal) => Promise<Intelligence>
  select: (choice: GuessInput) => Promise<void>
  submit: (choice: GuessInput, final: boolean) => Promise<void>
  unlock: () => Promise<void>
}

type Action = 'guess' | 'unlock'

export function RoundStage({ round, hud, controls, error, children }: {
  round: RoundView | null
  hud?: RoundHud
  controls?: RoundControls
  error?: string | null
  children?: ReactNode
}) {
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-space-900">
      {round && (
        <RoundSurface key={`${round.id}-${round.scene.seed}`} round={round} hud={hud} controls={controls} error={error} />
      )}
      {children}
      {!round && <RoundAlert message={error} />}
    </div>
  )
}

function RoundSurface({ round, hud, controls, error }: {
  round: RoundView
  hud?: RoundHud
  controls?: RoundControls
  error?: string | null
}) {
  const activeAction = useRef<Action | null>(null)
  const [pending, setPending] = useState<Action | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function run(action: Action, request: () => Promise<void>) {
    if (activeAction.current || controls?.disabled) return
    activeAction.current = action
    setPending(action)
    setActionError(null)
    try {
      await request()
    } catch (cause) {
      const fallback = action === 'guess' ? 'Could not submit the guess.' : 'Could not unlock additional data.'
      setActionError(cause instanceof Error ? cause.message : fallback)
    } finally {
      activeAction.current = null
      setPending(null)
    }
  }

  return (
    <>
      <div className="absolute inset-0">
        <Suspense fallback={<DioramaLoading scene={round.scene} />}>
          <BiomeDiorama scene={round.scene} />
        </Suspense>
      </div>
      <div className="pointer-events-none absolute inset-0 z-[21] flex flex-col">
        {hud && (
          <TopHud
            round={round.number}
            roundsTotal={hud.roundsTotal}
            score={hud.score}
            attemptsUsed={round.attemptsUsed}
            attemptsTotal={round.attemptsTotal}
            timer={<Timer endsAt={round.endsAt} paused={pending !== null || hud.pauseExpiry} onExpired={hud.onExpired} />}
            onLeave={hud.onLeave}
            leaveLabel={hud.leaveLabel}
          />
        )}
        {controls && (
          <section
            aria-label="Round controls"
            tabIndex={0}
            className="pointer-events-none flex min-h-0 flex-1 flex-col justify-between gap-3 overflow-y-auto overscroll-y-contain px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-0.5 sm:px-4 sm:pb-[max(1rem,env(safe-area-inset-bottom))] lg:mt-0.5 lg:flex-row lg:items-start lg:justify-between lg:overflow-visible lg:px-4 lg:pb-4 lg:pt-0 [&>*]:shrink-0"
          >
            <div className="pointer-events-auto lg:w-[370px]">
              <GeographicIntelligence
                roundId={round.id}
                roundKey={`${round.id}-${round.scene.seed}`}
                load={controls.loadIntelligence}
                access={round.extraData}
                onUnlock={() => void run('unlock', controls.unlock)}
                unlocking={pending === 'unlock'}
                unlockDisabled={controls.disabled || pending === 'guess'}
              />
            </div>
            <div className="pointer-events-auto mt-auto lg:w-[390px]">
              <GuessPanel
                rules={round.rules}
                candidates={round.candidates}
                initialSelection={round.selection}
                initialCandidateId={round.selectedCandidateId}
                submittedGuesses={round.submittedGuesses}
                submittedCandidateIds={round.submittedCandidateIds}
                endsAt={round.endsAt}
                attemptsUsed={round.attemptsUsed}
                attemptsTotal={round.attemptsTotal}
                submitting={pending === 'guess'}
                disabled={controls.disabled || pending === 'unlock'}
                onSelect={controls.select}
                onSubmit={(choice, final) => void run('guess', () => controls.submit(choice, final))}
              />
            </div>
          </section>
        )}
      </div>
      <RoundAlert message={actionError ?? error} />
    </>
  )
}

function RoundAlert({ message }: { message?: string | null }) {
  return message && (
    <div role="alert" className="absolute bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full bg-rose-400/90 px-4 py-2 text-sm font-bold text-space-950">
      {message}
    </div>
  )
}
