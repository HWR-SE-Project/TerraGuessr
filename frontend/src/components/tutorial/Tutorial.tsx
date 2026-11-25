import { useEffect, useState } from 'react'
import type { IconName } from '../ui/Icon'
import { Icon } from '../ui/Icon'
import { Dialog } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { formatDistance, formatScore } from '../../lib/format'
import { useGameRules } from '../../state/gameRules'

// R14: an interactive tutorial covering the four required beats — reading
// weather data, selecting a location, submitting a guess, and distance/score
// calculation — reachable, exitable, skippable and restartable at any time.

const STORAGE_KEY = 'terraguessr.tutorialSeen.v1'

export function hasSeenTutorial(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function markTutorialSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    /* storage is optional */
  }
}

interface Step {
  icon: IconName
  title: string
  body: string
}

const STEPS: Step[] = [
  {
    icon: 'cloud',
    title: 'Read the weather',
    body: 'Every round shows the temperature, precipitation, humidity and wind speed at your mystery location. Use them together — a hot, dry, windless reading points somewhere very different from a cold, wet, gusty one.',
  },
  {
    icon: 'pin',
    title: 'Pick a location',
    body: 'Easy mode shows 6 possible cities directly on the map — just click one to pick it. Medium and hard drop a pin anywhere on the interactive world map. You can change your pick as often as you like before you submit — changing it never costs you an attempt.',
  },
  {
    icon: 'check',
    title: 'Submit your guess',
    body: 'When you are happy with your pick, submit it. On Easy and Medium you can place multiple guesses in a round — your closest submitted guess is the one that scores, even if time runs out. Use Final submit to lock in early and reveal the answer.',
  },
  {
    icon: 'scan',
    title: 'Measuring distance',
    body: 'Once you submit, the game measures the great-circle distance between your guess and the real location in kilometres.',
  },
  {
    icon: 'trophy',
    title: 'Score by distance',
    body: 'The closer your guess, the higher your score. Try a few distances to see how the points change.',
  },
]

export function Tutorial({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0)
  const [exampleDistance, setExampleDistance] = useState(2000)
  const scoring = useGameRules()?.scoring
  const maxExampleDistance = scoring ? (scoring.exampleScores.length - 1) * scoring.exampleDistanceStepKm : 0
  const distance = Math.min(exampleDistance, maxExampleDistance)
  const exampleScore = scoring?.exampleScores[Math.round(distance / scoring.exampleDistanceStepKm)]

  // Reopening always restarts from the first step.
  useEffect(() => {
    if (open) setStep(0)
  }, [open])

  useEffect(() => {
    if (open) markTutorialSeen()
  }, [open])

  const current = STEPS[step]!
  const isLast = step === STEPS.length - 1

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="How to play"
      maxWidth="max-w-lg"
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Skip tutorial
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
              Previous
            </Button>
            <Button
              size="sm"
              icon={isLast ? 'check' : undefined}
              trailingIcon={isLast ? undefined : 'chevronRight'}
              onClick={() => (isLast ? onClose() : setStep((s) => s + 1))}
            >
              {isLast ? 'Finish' : 'Next'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-lime-400/15 text-lime-300">
            <Icon name={current.icon} size={20} />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-subtle">
            Step {step + 1} / {STEPS.length}
          </span>
        </div>

        <div>
          <h3 className="font-display text-lg font-semibold text-cream">{current.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">{current.body}</p>
        </div>

        {step === 3 && scoring && (
          <div className="surface-flat flex flex-col gap-2 p-4" aria-label="Example: London to Paris">
            <span className="text-xs font-bold uppercase tracking-wider text-subtle">Example</span>
            <div className="flex items-center justify-between gap-3 text-sm font-semibold text-cream">
              <span>London</span>
              <span className="font-display text-lime-300">{formatDistance(scoring.londonParisKm)}</span>
              <span>Paris</span>
            </div>
          </div>
        )}

        {step >= 3 && !scoring && <p className="text-sm text-muted">The example is unavailable.</p>}

        {step === 4 && scoring && exampleScore != null && (
          <div className="surface-flat flex flex-col gap-3 p-4">
            <span className="text-xs font-bold uppercase tracking-wider text-subtle">Try it</span>
            <div className="flex items-center justify-between">
              <output aria-live="polite" aria-label="Example score" className="font-display text-2xl font-semibold text-lime-300">
                {formatScore(exampleScore)}{' '}
                <span className="text-sm font-normal text-subtle">/ {formatScore(scoring.maxScore)} pts</span>
              </output>
              <span className="text-sm text-muted">{formatDistance(distance)} away</span>
            </div>
            <input
              aria-label="Example distance in kilometers"
              type="range"
              min={0}
              max={maxExampleDistance}
              step={scoring.exampleDistanceStepKm}
              value={distance}
              onChange={(e) => setExampleDistance(Number(e.target.value))}
              className="w-full accent-lime-400"
            />
          </div>
        )}
      </div>
    </Dialog>
  )
}
