import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { Difficulty, GeographicIntelligence as Intelligence, StreetRound } from '../../api/singleplayer'
import type { LatLon } from '../../api/types'
import { CandidateList } from '../../components/CandidateList'
import { GeographicIntelligence } from './GeographicIntelligence'
import { GuessMap } from './GuessMap'
import { GuessButton } from './GuessButton'
// These pure domain functions also score real rounds on the server. No duplicate curve.
import { haversineKm } from '../../../../backend/src/domain/distance'
import { MAX_SCORE, scoreForDistance } from '../../../../backend/src/domain/scoring'
import './Tutorial.css'

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

const SUBJECTS = ['Weather', 'Location', 'Confirmation', 'Distance', 'Points']
const TITLES = ['Read the world around you', 'Find your place', 'Select first. Then commit.', 'How close did you get?', 'Every kilometer counts']
const WEATHER = [
  { name: 'Temperature (°C)', clue: 'Temperature can suggest a warm or cold climate. Consider the season, elevation and what you see in the street.' },
  { name: 'Precipitation (mm)', clue: 'Precipitation describes recent rain or snow, over the interval shown. Wet conditions can be a useful clue.' },
  { name: 'Humidity (%)', clue: 'Humidity measures moisture in the air. It can help characterize a dry or humid environment.' },
  { name: 'Wind speed (m/s)', clue: 'Wind speed describes local atmospheric conditions. Compare it with other clues rather than identifying a place from wind alone.' },
]
const EXAMPLE_ROUND: StreetRound = { id: 'tutorial-example', number: 1, panoId: '' }
const EXAMPLE_WEATHER: Intelligence = {
  fetchedAt: '', cached: false, climate: null,
  weather: { modelTime: null, temperatureC: 22, condition: 'Partly cloudy', windSpeedKmh: 18,
    windDirectionDeg: 225, humidityPct: 64, pressureHpa: 1013, precipitationMm: 0.8, precipitationIntervalMinutes: 60 },
  environment: { elevationM: null, reliefM: null, terrain: null, biome: null, vegetation: null },
}
const EXAMPLE_CITIES = [
  { id: 'paris', name: 'Paris', region: 'EUROPE', lat: 48.8566, lon: 2.3522 },
  { id: 'tokyo', name: 'Tokyo', region: 'ASIA', lat: 35.6762, lon: 139.6503 },
  { id: 'cape-town', name: 'Cape Town', region: 'AFRICA', lat: -33.9249, lon: 18.4241 },
  { id: 'lima', name: 'Lima', region: 'SOUTH_AMERICA', lat: -12.0464, lon: -77.0428 },
]
const EXAMPLE_GUESS = { lat: 51.5074, lon: -0.1278 }
const EXAMPLE_ACTUAL = { lat: 48.8566, lon: 2.3522 }
const EXAMPLE_DISTANCE = haversineKm(EXAMPLE_GUESS, EXAMPLE_ACTUAL)
const EXAMPLE_RESULT = {
  roundId: 'tutorial-example', number: 1, guess: EXAMPLE_GUESS, actual: EXAMPLE_ACTUAL,
  distanceKm: EXAMPLE_DISTANCE, score: scoreForDistance(EXAMPLE_DISTANCE),
}

/** Offline practice is explicitly a coordinate grid, never presented as loaded Google imagery. */
function CoordinateGrid({ guess, onChange, result = false }: {
  guess: LatLon | null
  onChange?: (point: LatLon) => void
  result?: boolean
}) {
  const project = (point: LatLon) => result
    ? { x: (point.lon + 5) / 13 * 720, y: (54 - point.lat) / 7 * 360 }
    : { x: (point.lon + 180) * 2, y: (90 - point.lat) * 2 }
  const pin = guess && project(guess)
  const actual = project(EXAMPLE_ACTUAL)
  return (
    <div className="tt-grid">
      <svg viewBox="0 0 720 360" preserveAspectRatio="none" role="img" aria-label={result ? 'Example result: guessed and correct markers connected by a line' : 'Offline coordinate practice grid'}
        onClick={onChange ? (event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          onChange({ lat: 90 - (event.clientY - rect.top) / rect.height * 180, lon: (event.clientX - rect.left) / rect.width * 360 - 180 })
        } : undefined}>
        <rect width="720" height="360" fill="#122d40" />
        <g stroke="#a2c4d329" strokeWidth="1">
          {[60, 120, 180, 240, 300].map(y => <path key={y} d={`M0 ${y}H720`} />)}
          {[120, 240, 360, 480, 600].map(x => <path key={x} d={`M${x} 0V360`} />)}
        </g>
        <text x="16" y="28" fill="#bdccd8" fontSize="13">{result ? '54°N · NW Europe' : '90°N'}</text>
        <text x="16" y="176" fill="#bdccd8" fontSize="13">{result ? '50.5°N' : '0° · Equator'}</text>
        <text x={result ? 200 : 340} y="342" fill="#bdccd8" fontSize="13">0° longitude</text>
        {result && pin && <line x1={pin.x} y1={pin.y} x2={actual.x} y2={actual.y} stroke="#cedbbd" strokeWidth="3" strokeDasharray="5 4" />}
        {pin && <circle cx={pin.x} cy={pin.y} r="7" fill="#b29aff" stroke="white" strokeWidth="2" />}
        {result && <circle cx={actual.x} cy={actual.y} r="5" fill="#b2ed67" stroke="white" strokeWidth="2" />}
      </svg>
      <span>Offline tutorial example · coordinate grid</span>
    </div>
  )
}

export function Tutorial({ onClose, difficulty = 'medium', round, loadIntelligence }: {
  onClose: () => void
  difficulty?: Difficulty
  round?: StreetRound | null
  loadIntelligence?: (roundId: string, signal?: AbortSignal) => Promise<Intelligence>
}) {
  const [step, setStep] = useState(0)
  const [metric, setMetric] = useState(0)
  const [guess, setGuess] = useState<LatLon | null>(null)
  const [selectionCount, setSelectionCount] = useState(0)
  const [confirmed, setConfirmed] = useState(false)
  const [distance, setDistance] = useState(500)
  const [weatherSource, setWeatherSource] = useState('Loading weather clues…')
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const scroll = useRef<HTMLDivElement>(null)
  const selectedCity = EXAMPLE_CITIES.find(c => c.lat === guess?.lat && c.lon === guess.lon)?.id ?? null
  const loadWeather = useCallback(async (id: string, signal?: AbortSignal) => {
    setWeatherSource('Loading weather clues…')
    if (round && loadIntelligence) {
      try {
        const data = await loadIntelligence(id, signal)
        const w = data.weather
        if (w && [w.temperatureC, w.precipitationMm, w.humidityPct, w.windSpeedKmh].every(v => typeof v === 'number' && Number.isFinite(v))) {
          if (!signal?.aborted) setWeatherSource('Current round · model weather clues')
          return data
        }
      } catch { /* Safe labeled examples also work offline and before a game. */ }
    }
    if (!signal?.aborted) setWeatherSource('Tutorial example · weather, not your current round')
    return EXAMPLE_WEATHER
  }, [round, loadIntelligence])
  useEffect(() => {
    const element = dialog.current!
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    element.showModal()
    return () => {
      element.close()
      // Menu entry buttons unmount when opening the tutorial; return to its persistent trigger.
      const target = previous?.isConnected ? previous : document.querySelector<HTMLElement>('[data-tutorial-trigger]')
      target?.focus({ preventScroll: true })
    }
  }, [])
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    scroll.current?.scrollTo?.({ top: 0 })
  }, [step])
  function select(point: LatLon) {
    if (confirmed) return
    setGuess(point)
    setSelectionCount(count => count + 1)
  }
  function restart() {
    setStep(0)
    setMetric(0)
    setGuess(null)
    setSelectionCount(0)
    setConfirmed(false)
    setDistance(500)
    heading.current?.focus()
    scroll.current?.scrollTo?.({ top: 0 })
  }
  const trapFocus = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
    }
    if (event.key !== 'Tab') return
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href], summary, [tabindex="0"]'))
      .filter(el => el.getClientRects().length > 0 && !el.closest('[hidden]'))
    const first = items[0], last = items.at(-1)
    const index = items.indexOf(document.activeElement as HTMLElement)
    if (event.shiftKey && (index <= 0)) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && (index < 0 || document.activeElement === last)) { event.preventDefault(); first?.focus() }
  }
  const selection = (
    <>
      {difficulty === 'easy' ? (
        <fieldset disabled={confirmed} className="tt-cities">
          <legend>Four tutorial example locations</legend>
          <CandidateList candidates={EXAMPLE_CITIES} selectedId={selectedCity} onChange={select} />
          <small>Your round’s shortlist may contain more locations.</small>
        </fieldset>
      ) : (
        <>
          <div className="tt-map">
            <GuessMap guess={guess} onChange={select} interactive={!confirmed} countryBorders={difficulty !== 'hard'}
              fallback={<CoordinateGrid guess={guess} onChange={confirmed ? undefined : select} />} />
          </div>
          <fieldset className="tt-coordinates" disabled={confirmed}>
            <legend>Keyboard alternative · place or move your practice pin</legend>
            <label>Latitude<input aria-label="Practice latitude" type="number" min="-90" max="90" step="any" value={guess ? Number(guess.lat.toFixed(4)) : ''}
              onChange={event => { if (event.target.value && event.target.validity.valid) select({ lat: Number(event.target.value), lon: guess?.lon ?? 0 }) }} /></label>
            <label>Longitude<input aria-label="Practice longitude" type="number" min="-180" max="180" step="any" value={guess ? Number(guess.lon.toFixed(4)) : ''}
              onChange={event => { if (event.target.value && event.target.validity.valid) select({ lat: guess?.lat ?? 0, lon: Number(event.target.value) }) }} /></label>
          </fieldset>
        </>
      )}
      <p className="tt-selection-status" role="status">{confirmed ? 'Practice guess confirmed. This answer is locked.' : guess
        ? `${guess.lat.toFixed(3)}°, ${guess.lon.toFixed(3)}° · ${selectionCount > 1 ? 'Selection changed. Still not submitted.' : 'Selected. Not submitted.'}`
        : 'Try selecting a location, then change your mind.'}</p>
      {step === 2 && <div className="tt-confirm">
        <GuessButton practice disabled={!guess || confirmed} onClick={() => setConfirmed(true)} />
        {confirmed && <button className="sp-secondary tg-control" onClick={() => { setConfirmed(false); setGuess(null); setSelectionCount(0) }}>Try again</button>}
      </div>}
    </>
  )
  return (
    <dialog ref={dialog} className={`tt-overlay tt-step-${step}`} aria-label="How to play / Tutorial" onKeyDownCapture={trapFocus}
      onCancel={event => { event.preventDefault(); onClose() }}>
      <div className="tt-scroll" ref={scroll}>
        <header className="tt-topbar">
          <span className="tt-brand">◎ <strong>TERRAGUESSR</strong><span>EXPLORER’S FIELD GUIDE</span></span>
          <div><button className="tt-text-button tg-control" onClick={restart}>Restart tutorial</button>
            <button className="tt-exit tg-control" title="Exit tutorial and return to your game" onClick={onClose}>Skip <span aria-hidden="true">×</span></button></div>
        </header>
        <div className={`tt-layout ${step === 0 ? 'tt-weather-layout' : ''}`}>
          <section className="tt-coach sp-glass">
            <p className="sp-eyebrow">STEP {step + 1} OF 5 · {difficulty.toUpperCase()}</p>
            <nav className="tt-progress" aria-label="Tutorial sections">{SUBJECTS.map((subject, index) => (
              <button key={subject} aria-label={`Step ${index + 1}: ${subject}`} aria-current={step === index ? 'step' : undefined} onClick={() => setStep(index)}><span>{index < step ? '✓' : index + 1}</span><small>{subject}</small></button>
            ))}</nav>
            <div className="tt-copy" key={step}>
              <h2 ref={heading} tabIndex={-1}>{TITLES[step]}</h2>
              {step === 0 && <>
                <p>The Geographic Intelligence panel turns weather into clues. Tap an indicator to explore it.</p>
                <div className="tt-weather-tabs" role="group" aria-label="Weather indicators">{WEATHER.map((item, index) => <button key={item.name} className="tg-control" aria-pressed={metric === index} onClick={() => setMetric(index)}>{item.name}</button>)}</div>
                <p className="tt-clue" aria-live="polite">{WEATHER[metric]!.clue}</p>
                <p className="tt-note">Clues, not proof. Current weather does not establish long-term climate. Street View imagery may be older.</p>
              </>}
              {step === 1 && <>
                <p>{difficulty === 'easy' ? 'On Easy, choose one of the proposed locations in the list. Try one, then select another. The highlighted option is your current selection.'
                  : difficulty === 'hard' ? 'On Hard, the world map has no country borders. Use coastlines, terrain and your geographic knowledge to place a marker.'
                    : 'On Medium, the interactive world map includes country borders. Use them to find your bearings and place a marker.'}</p>
                {difficulty !== 'easy' && <><p>Drag to pan, use + / − or scroll to zoom, and click or tap to place your pin. Drag the marker or click another point to move it.</p><p className="tt-note">If Google Maps is unavailable, practice on the labeled coordinate grid or use the coordinate fields. Zooming and panning require the live map.</p></>}
                <p className="tt-clue">Your turn: select a location, then change it. Practice is optional; you can continue whenever you’re ready.</p>
              </>}
              {step === 2 && <>
                <p><strong>Selecting is not submitting.</strong> You must select a location first. Change your guess any number of times before confirmation.</p>
                <p>The <strong>Guess</strong> button finalizes your answer. After submission, the answer can no longer be modified.</p>
                <p className="tt-clue">Try the highlighted Guess button. This practice confirmation stays here and never submits a real guess.</p>
              </>}
              {step === 3 && <>
                <p>Each point has a <strong>latitude and longitude</strong>. The Haversine formula calculates the shortest distance over Earth’s surface between your guess and the correct location.</p>
                <p>Results are measured in <strong>kilometers (km)</strong>, displayed to <strong>one decimal place</strong>.</p>
                <details className="tt-formula"><summary>Explore the Haversine formula</summary><p>Convert latitude φ and longitude λ to radians.</p><code>a = sin²(Δφ/2) + cos(φ₁) cos(φ₂) sin²(Δλ/2)<br />d = 2R × asin(√a)<br />R = 6371.0088 km</code></details>
                <p className="tt-note">London → Paris is a tutorial example. Your current round’s correct location stays hidden.</p>
              </>}
              {step === 4 && <>
                <p>A more accurate guess earns more points; a less accurate guess earns fewer. Each round awards up to <strong>5,000 points</strong>.</p>
                <p>TerraGuessr is endless: there is no fixed number of rounds. Your score keeps accumulating round after round, for as long as you keep playing, with no total cap.</p>
                <p className="tt-clue">Move the distance slider to explore the same scoring curve used by the game.</p>
                <p className="tt-note">Ready to explore? You can exit or restart this guide at any time from the game menu. When you decide to stop, use End Game to finish your session and see your summary.</p>
              </>}
            </div>
            <footer className="tt-navigation">
              <button className="sp-secondary tg-control" disabled={step === 0} onClick={() => setStep(value => value - 1)}>Previous</button>
              <button className="sp-primary tg-control tg-control--primary" onClick={() => step === 4 ? onClose() : setStep(value => value + 1)}>{step === 4 ? 'Finish tutorial' : 'Next'} <span aria-hidden="true">→</span></button>
            </footer>
            <p className="tt-safety">Safe practice · your game, score and pin stay as you left them.</p>
          </section>
          <section className={`tt-spotlight sp-glass tt-metric-${metric}`} aria-label={`${SUBJECTS[step]} practice`}>
            <header><span className="tt-live-dot" />{step === 0 ? weatherSource : step === 3 ? 'Tutorial example · London → Paris' : step === 4 ? 'Tutorial example · points calculator' : `Safe practice · ${difficulty} ${difficulty === 'easy' ? 'location list' : 'world map'}`}</header>
            {step === 0 && <GeographicIntelligence embedded round={round ?? EXAMPLE_ROUND} load={loadWeather} />}
            {(step === 1 || step === 2) && selection}
            {step === 3 && <>
              <div className="tt-map tt-result-map"><GuessMap results={[EXAMPLE_RESULT]} interactive={false} fallback={<CoordinateGrid guess={EXAMPLE_GUESS} result />} /></div>
              <div className="tt-legend"><span>● Guessed: London</span><span>● Correct: Paris</span></div>
              <div className="tt-distance"><strong>{EXAMPLE_DISTANCE.toFixed(1)} <small>km</small></strong><span>Great-circle distance · Haversine</span></div>
              <dl className="tt-result-coordinates"><div><dt>Guessed latitude / longitude</dt><dd>51.5074°, −0.1278°</dd></div><div><dt>Correct latitude / longitude</dt><dd>48.8566°, 2.3522°</dd></div></dl>
            </>}
            {step === 4 && <div className="tt-score">
              <span className="sp-eyebrow">YOUR EXAMPLE ROUND</span>
              <output aria-live="polite" aria-label="Example score"><strong>{scoreForDistance(distance).toLocaleString('en-US')}</strong><span> / {MAX_SCORE.toLocaleString('en-US')} points</span></output>
              <div className="sp-score-track"><span style={{ width: `${scoreForDistance(distance) / MAX_SCORE * 100}%` }} /></div>
              <label htmlFor="tutorial-distance">Distance from the correct location <b>{distance.toFixed(1)} km</b></label>
              <input id="tutorial-distance" type="range" min="0" max="20000" step="50" value={distance} onChange={event => setDistance(Number(event.target.value))} />
              <div className="tt-range-labels"><span>Perfect guess</span><span>Far away</span></div>
              <p className="tt-formula">points = round(5000 × e<sup>−distance / 2000</sup>)<small>Clamped to 0–5,000 · distance in km</small></p>
              <p className="tt-note">Example only. Your expedition total is unchanged.</p>
            </div>}
          </section>
        </div>
      </div>
    </dialog>
  )
}
