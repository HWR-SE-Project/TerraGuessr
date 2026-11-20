import { useState } from 'react'
import { GameDialog } from './GameDialog'

const STORAGE_KEY = 'terraguessr.tutorialSeen.v1'

// Temporary development/testing flag: forces the tutorial to open for every
// new Singleplayer game (any difficulty), ignoring completion/skip tracking.
// Flip to false to restore the normal first-time-only behavior.
const ALWAYS_SHOW_SINGLEPLAYER_TUTORIAL = true

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
    /* Re-shown next visit if storage is unavailable; not a gameplay blocker. */
  }
}

// Decides whether the tutorial should open for a brand-new game. Call this
// only from the actual new-game initialization action (starting fresh,
// restarting, or playing again) — never from component mount/render, resume,
// or next-round transitions, which must never re-trigger it.
export function shouldShowTutorialForNewGame(): boolean {
  return ALWAYS_SHOW_SINGLEPLAYER_TUTORIAL || !hasSeenTutorial()
}

interface Step {
  title: string
  body: string
}

const STEPS: Step[] = [
  {
    title: 'A world, five rounds',
    body: 'Each round drops you into a real Google Street View location, chosen at random. No two rounds repeat the same place.',
  },
  {
    title: 'Explore before you guess',
    body: 'Drag to look around, click the street to move. The Geographic Intelligence panel shows real weather for the mystery location — temperature, precipitation, humidity, and wind speed.',
  },
  {
    title: 'Place your guess',
    body: 'On Easy, pick from a shortlist of named cities. On Medium and Hard, click anywhere on the world map to drop a pin. You can move it as many times as you like.',
  },
  {
    title: 'Lock it in',
    body: 'Press Guess (or hit Enter) to submit. Once submitted, your guess is final and the actual location is revealed — with the distance between the two, in kilometers.',
  },
  {
    title: 'Scoring',
    body: 'Closer guesses score more points: up to 5,000 per round, 25,000 across all five. The next round is often ready instantly once you continue.',
  },
]

export function Tutorial({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0)
  const last = step === STEPS.length - 1
  const current = STEPS[step]!
  return (
    <GameDialog title="How to play" onClose={onClose} className="sp-tutorial">
      <p className="sp-eyebrow">
        STEP {step + 1} OF {STEPS.length}
      </p>
      <h3>{current.title}</h3>
      <p className="sp-muted">{current.body}</p>
      <div className="sp-tutorial-dots" aria-hidden="true">
        {STEPS.map((s, index) => (
          <span key={s.title} className={index === step ? 'sp-tutorial-dot-active' : ''} />
        ))}
      </div>
      <div className="sp-dialog-actions">
        <button className="sp-secondary tg-control" onClick={onClose}>
          Skip
        </button>
        {step > 0 && (
          <button
            className="sp-secondary tg-control"
            onClick={() => setStep((value) => value - 1)}
          >
            Back
          </button>
        )}
        <button
          className="sp-primary tg-control tg-control--primary"
          onClick={() => (last ? onClose() : setStep((value) => value + 1))}
        >
          {last ? 'Got it' : 'Next'} <span aria-hidden="true">→</span>
        </button>
      </div>
    </GameDialog>
  )
}
