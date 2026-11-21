import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { StreetResult, StreetRound } from '../../api/singleplayer'
import { haversineKm } from '../../../../backend/src/domain/distance'
import { MAX_SCORE, scoreForDistance } from '../../../../backend/src/domain/scoring'
import './Tutorial.css'

const STORAGE_KEY = 'terraguessr.tutorialSeen.v1'
// Preserve the existing development preference: every new expedition opens the guide.
const ALWAYS_SHOW_SINGLEPLAYER_TUTORIAL = true
export function hasSeenTutorial(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === '1' } catch { return false }
}
export function markTutorialSeen(): void {
  try { localStorage.setItem(STORAGE_KEY, '1') } catch { /* Storage is optional. */ }
}
export function shouldShowTutorialForNewGame(): boolean {
  return ALWAYS_SHOW_SINGLEPLAYER_TUTORIAL || !hasSeenTutorial()
}
const SUBJECTS = ['Weather', 'Location', 'Confirmation', 'Distance', 'Points']
const TITLES = ['Read the weather', 'Pick your location', 'Lock in your guess', 'Measuring distance', 'Score by distance']
const COPY = [
  'Use temperature, rainfall, humidity and wind to narrow down where you might be.',
  'Choose where you think you are. You can change your answer before submitting.',
  'Confirm your location to lock in your guess.',
  'Your guess is compared with the actual location using geographic distance.',
  'The closer your guess, the more points you earn.',
]
const LONDON = { lat: 51.5074, lon: -0.1278 }
const PARIS = { lat: 48.8566, lon: 2.3522 }
const EXAMPLE_DISTANCE = haversineKm(LONDON, PARIS)

/** Self-contained practice options; they never touch the live round. */
const PRACTICE_LOCATIONS = [
  { id: 'london', label: 'London', detail: 'Europe' },
  { id: 'paris', label: 'Paris', detail: 'Europe' },
  { id: 'tokyo', label: 'Tokyo', detail: 'Asia' },
] as const
type PracticeLocationId = (typeof PRACTICE_LOCATIONS)[number]['id']
type Rect = { x: number; y: number; width: number; height: number }

/** Measure the actual interface, including resize, panel animation and page scroll.
 * The modal's transparent backdrop keeps the real UI mounted and unfiltered underneath.
 * The cutout is purely visual; the guide never submits or changes a live guess. */
function useSpotlight(selector: string | null, card: React.RefObject<HTMLElement | null>, step: number) {
  const [layout, setLayout] = useState<{ target: Rect | null; x: number; y: number }>({ target: null, x: 16, y: 16 })
  useLayoutEffect(() => {
    let frame = 0
    const measure = () => {
      const width = window.innerWidth, height = window.innerHeight
      const bounds = selector ? document.querySelector(selector)?.getBoundingClientRect() : null
      const target = bounds && bounds.width > 0 && bounds.height > 0 && bounds.bottom > 0 && bounds.top < height && bounds.right > 0 && bounds.left < width
        ? { x: Math.max(8, bounds.left - 6), y: Math.max(8, bounds.top - 6),
          width: Math.min(width - 8, bounds.right + 6) - Math.max(8, bounds.left - 6),
          height: Math.min(height - 8, bounds.bottom + 6) - Math.max(8, bounds.top - 6) } : null
      const w = card.current?.offsetWidth ?? Math.min(320, width - 32)
      const h = card.current?.offsetHeight ?? 180
      const clampX = (x: number) => Math.max(16, Math.min(x, width - w - 16))
      const clampY = (y: number) => Math.max(16, Math.min(y, height - h - 16))
      let x = (width - w) / 2, y = (height - h) / 2
      if (target) {
        const gap = 22
        const candidates = [
          { x: target.x + target.width + gap, y: clampY(target.y) },
          { x: target.x - w - gap, y: clampY(target.y) },
          { x: clampX(target.x), y: target.y + target.height + gap },
          { x: clampX(target.x + target.width - w), y: target.y - h - gap },
        ]
        const fits = candidates.find(p => p.x >= 16 && p.x + w <= width - 16 && p.y >= 16 && p.y + h <= height - 16)
        if (fits) { x = fits.x; y = fits.y }
        else { x = clampX(target.x); y = clampY(target.y + target.height + gap) }
      }
      const next = { target, x: clampX(x), y: clampY(y) }
      setLayout(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next)
    }
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) }
    const observer = new ResizeObserver(schedule)
    if (card.current) observer.observe(card.current)
    const target = selector && document.querySelector(selector)
    if (target) observer.observe(target)
    // A new round can arrive after the automatic tutorial has already opened.
    const mutations = new MutationObserver(schedule)
    const page = document.querySelector('.sp-page')
    if (page) mutations.observe(page, { childList: true, subtree: true })
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)
    window.visualViewport?.addEventListener('resize', schedule)
    measure()
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); mutations.disconnect()
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
      window.visualViewport?.removeEventListener('resize', schedule)
    }
  }, [selector, card, step])
  return layout
}

export function Tutorial({ onClose, round, result, onStepChange }: {
  onClose: () => void
  round?: StreetRound | null
  result?: StreetResult | null
  onStepChange?: (step: number) => void
}) {
  const [step, setStep] = useState(0)
  const [distance, setDistance] = useState(500)
  const [practiceSelection, setPracticeSelection] = useState<PracticeLocationId | null>(null)
  const [practiceLocked, setPracticeLocked] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const card = useRef<HTMLElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const mask = useId()
  const live = !!round
  const selector = live && step < 3
    ? ['.sp-stage > .gi-panel', '.sp-guess-panel', '.sp-map-footer .sp-guess-button'][step]!
    : result && step === 3 ? '[data-tutorial-distance]'
      : result && step === 4 ? '[data-tutorial-points]'
        : live && step === 4 ? '.sp-hud' : null
  const layout = useSpotlight(selector, card, step)
  useEffect(() => { onStepChange?.(step) }, [step, onStepChange])
  useEffect(() => {
    const element = dialog.current!
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    element.showModal()
    document.body.classList.add('tt-active')
    return () => {
      element.close()
      document.body.classList.remove('tt-active')
      const target = previous?.isConnected ? previous
        : Array.from(document.querySelectorAll<HTMLElement>('[data-tutorial-trigger]')).find(element => element.getClientRects().length > 0)
      target?.focus({ preventScroll: true })
    }
  }, [])
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    card.current?.scrollTo?.({ top: 0 })
  }, [step])
  function restart() {
    setStep(0); setDistance(500)
    setPracticeSelection(null); setPracticeLocked(false)
    heading.current?.focus({ preventScroll: true })
    card.current?.scrollTo?.({ top: 0 })
  }
  const trapFocus = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() }
    if (event.key !== 'Tab') return
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex="0"]'))
      .filter(el => el.getClientRects().length > 0 && !el.closest('[hidden]'))
    const first = items[0], last = items.at(-1)
    const index = items.indexOf(document.activeElement as HTMLElement)
    if (event.shiftKey && index <= 0) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && (index < 0 || document.activeElement === last)) { event.preventDefault(); first?.focus() }
  }
  return (
    <dialog ref={dialog} className={`tt-overlay tt-step-${step}`} aria-label="How to play / Tutorial" aria-describedby="tt-description"
      onKeyDownCapture={trapFocus} onCancel={event => { event.preventDefault(); onClose() }}>
      <svg className="tt-shade" aria-hidden="true" width="100%" height="100%">
        <defs><mask id={mask}><rect width="100%" height="100%" fill="white" />
          {layout.target && <rect {...layout.target} rx="16" fill="black" />}</mask></defs>
        <rect width="100%" height="100%" fill="#07111f" fillOpacity="0.46" mask={`url(#${mask})`} />
        {layout.target && <rect className="tt-target-ring" {...layout.target} rx="16" />}
      </svg>
      <section ref={card} className="tt-coach" style={{ left: layout.x, top: layout.y }} data-target={layout.target ? SUBJECTS[step] : 'example'}>
        <header className="tt-bar">
          <span className="tt-step-count">{step + 1} / 5</span>
          <div className="tt-bar-actions">
            <button className="tt-icon-btn" aria-label="Restart tutorial" title="Restart tutorial" onClick={restart}>
              <span aria-hidden="true">↺</span>
            </button>
            <button className="tt-icon-btn tt-close" aria-label="Exit tutorial" title="Exit tutorial (Esc)" onClick={onClose}>
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </header>
        <div className="tt-copy" key={step}>
          <h2 ref={heading} tabIndex={-1}>{TITLES[step]}</h2>
          <p id="tt-description">{COPY[step]}</p>
          {(step === 1 || step === 2) && (
            <div className="tt-practice" aria-label="Tutorial location practice">
              <span className="tt-demo-label">Try it</span>
              <div className="tt-practice-list" role="group" aria-label="Practice location list">
                {PRACTICE_LOCATIONS.map(location => {
                  const selected = practiceSelection === location.id
                  return (
                    <button
                      key={location.id}
                      type="button"
                      aria-pressed={selected}
                      className={`tt-practice-option${selected ? ' tt-practice-option--selected' : ''}`}
                      onClick={() => { setPracticeSelection(location.id); setPracticeLocked(false) }}
                    >
                      <strong>{location.label}</strong>
                      <small>{location.detail}</small>
                    </button>
                  )
                })}
              </div>
              {step === 2 && (
                <div className="tt-practice-submit">
                  <button
                    type="button"
                    className="tt-practice-confirm"
                    disabled={!practiceSelection || practiceLocked}
                    onClick={() => setPracticeLocked(true)}
                  >
                    {practiceLocked ? 'Guess submitted' : 'Submit try-out guess'}
                  </button>
                  {practiceLocked && (
                    <p className="tt-practice-status" role="status">
                      Locked in. In a real round you can still change it before submitting.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          {step === 3 && !result && (
            <div className="tt-demo" aria-label="Tutorial example: London to Paris">
              <span className="tt-demo-label">Example</span>
              <div className="tt-distance-line"><span>London</span><i /><strong>{EXAMPLE_DISTANCE.toFixed(1)} <small>km</small></strong><i /><span>Paris</span></div>
            </div>
          )}
          {step === 4 && !result && (
            <div className="tt-demo">
              <span className="tt-demo-label">Example</span>
              <div className="tt-score-row">
                <output aria-live="polite" aria-label="Example score">{scoreForDistance(distance).toLocaleString('en-US')}<small> / {MAX_SCORE.toLocaleString('en-US')} pts</small></output>
                <span>{distance.toLocaleString('en-US')} km</span>
              </div>
              <input aria-label="Example distance in kilometers" type="range" min="0" max="20000" step="50" value={distance} onChange={e => setDistance(Number(e.target.value))} />
            </div>
          )}
        </div>
        <footer className="tt-navigation">
          <button className="tt-previous" disabled={step === 0} onClick={() => setStep(value => value - 1)}>Previous</button>
          <button className="tt-next" onClick={() => step === 4 ? onClose() : setStep(value => value + 1)}>{step === 4 ? 'Finish tutorial' : 'Next'} <span aria-hidden="true">→</span></button>
        </footer>
      </section>
    </dialog>
  )
}
