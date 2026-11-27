import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MotionConfig } from 'framer-motion'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HowToPlayPage } from './HowToPlayPage'
import { UltimateGuidePage } from './UltimateGuidePage'
import { TutorialPage } from './TutorialPage'
import {
  buildTutorialIntelligence,
  buildTutorialScenarios,
  classifyTutorialLighting,
  evaluateTutorialRound,
} from './tutorialScenarios'
import { hasSeenTutorial } from '../../components/tutorial/Tutorial'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('tutorialScenarios', () => {
  it('classifies day, dusk, and night lighting consistently with backend solar hour bands', () => {
    // At lon 0, UTC hour === solar hour.
    expect(classifyTutorialLighting(0, new Date('2026-11-27T12:00:00Z'))).toBe('day')
    expect(classifyTutorialLighting(0, new Date('2026-11-27T06:00:00Z'))).toBe('dusk')
    expect(classifyTutorialLighting(0, new Date('2026-11-27T18:30:00Z'))).toBe('dusk')
    expect(classifyTutorialLighting(0, new Date('2026-11-27T23:00:00Z'))).toBe('night')
  })

  it('produces contrasting live skies between Round 1 (Quito) and Round 2 (Singapore)', () => {
    // 18:00 UTC -> Quito (~12:46 solar) = day, Singapore (~00:55 solar) = night
    const [r1, r2] = buildTutorialScenarios(new Date('2026-11-27T18:00:00Z'))
    expect(r1.scene.lighting).toBe('day')
    expect(r2.scene.lighting).toBe('night')
    expect(r1.difficulty).toBe('easy')
    expect(r1.candidates).toHaveLength(6)
    expect(r2.difficulty).toBe('medium')
    expect(r2.candidates).toBeUndefined()
  })

  it('hides Station Dossier metrics when locked and reveals them when unlocked', () => {
    const [, r2] = buildTutorialScenarios(new Date('2026-11-27T18:00:00Z'))
    const locked = buildTutorialIntelligence(r2, false)
    expect(locked.environment.elevationM).toBeNull()
    expect(locked.weather?.tempMin24hC).toBeUndefined()
    expect(locked.weather?.uvIndexMax24h).toBeUndefined()

    const unlocked = buildTutorialIntelligence(r2, true)
    expect(unlocked.environment.elevationM).toBe(15)
    expect(unlocked.weather?.tempMin24hC).toBeTypeOf('number')
    expect(unlocked.weather?.uvIndexMax24h).toBeTypeOf('number')
  })

  it('evaluates Best-of-N attempts and deducts extra-data unlock points', () => {
    const [, r2] = buildTutorialScenarios(new Date('2026-11-27T18:00:00Z'))
    const farGuess = { lat: 48.8566, lon: 2.3522 }
    const exactGuess = { lat: r2.actual.lat, lon: r2.actual.lon }

    const result = evaluateTutorialRound(r2, [farGuess, exactGuess], 100)
    expect(result.attempts).toHaveLength(2)
    expect(result.attempts?.[0]?.isBest).toBe(false)
    expect(result.attempts?.[1]?.isBest).toBe(true)
    expect(result.distanceKm).toBeCloseTo(0, 3)
    expect(result.score).toBe(4900)
    expect(result.extraDataPointsSpent).toBe(100)
  })
})

describe('HowToPlayPage', () => {
  it('links to both the interactive tutorial and Ultimate Guide and updates the score preview', async () => {
    const user = userEvent.setup()

    render(
      <MotionConfig reducedMotion="always">
        <MemoryRouter initialEntries={['/how-to-play']}>
          <HowToPlayPage />
        </MemoryRouter>
      </MotionConfig>,
    )

    expect(screen.getByRole('heading', { name: 'Learn to read the planet' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start interactive tutorial' })).toHaveAttribute(
      'href',
      '/how-to-play/tutorial',
    )
    expect(screen.getByRole('link', { name: 'Read Ultimate Guide' })).toHaveAttribute(
      'href',
      '/how-to-play/guide',
    )

    expect(screen.getByText('Sky lighting')).toBeInTheDocument()
    expect(screen.getByText('Elevation (Dossier)')).toBeInTheDocument()

    const scoreOutput = screen.getByLabelText('Preview score')
    await user.click(screen.getByRole('button', { name: /Bullseye/i }))
    expect(scoreOutput).toHaveTextContent('5,000')

    await user.click(screen.getByRole('button', { name: /Halfway round Earth/i }))
    expect(scoreOutput).not.toHaveTextContent('5,000 /')
  })
})

describe('UltimateGuidePage', () => {
  it('documents all core and Station Dossier metrics and climate archetypes', () => {
    render(
      <MotionConfig reducedMotion="always">
        <MemoryRouter initialEntries={['/how-to-play/guide']}>
          <UltimateGuidePage />
        </MemoryRouter>
      </MotionConfig>,
    )

    expect(screen.getByRole('heading', { name: 'Every clue, decoded' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Elevation & Relief' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '24h Temperature Range (Δ°)' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Peak UV (24h)' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Dew Point' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sea-Level Pressure' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Equatorial Highland' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to How to play' })).toHaveAttribute('href', '/how-to-play')
  })
})

describe('TutorialPage', () => {
  it('walks through Round 1 tips, skips to Round 2, unlocks Station Dossier, shows wrap-up, and restarts', async () => {
    const user = userEvent.setup()

    render(
      <MotionConfig reducedMotion="always">
        <MemoryRouter initialEntries={['/how-to-play/tutorial']}>
          <Routes>
            <Route path="/how-to-play" element={<div>How to play hub</div>} />
            <Route path="/how-to-play/tutorial" element={<TutorialPage />} />
          </Routes>
        </MemoryRouter>
      </MotionConfig>,
    )

    expect(hasSeenTutorial()).toBe(true)
    expect(screen.getByText('Easy · 6 cities')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Start with the 3D scene' })).toBeInTheDocument()

    // Step through Round 1 coach tips
    await user.click(screen.getByRole('button', { name: 'Next tip' }))
    expect(screen.getByRole('heading', { name: 'Cool air + Extreme UV = High altitude' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next tip' }))
    expect(screen.getByRole('heading', { name: 'Select a city & try Best-of-3' })).toBeInTheDocument()

    // Skip directly to Round 2 (Medium)
    await user.click(screen.getByRole('button', { name: 'Skip to Round 2' }))
    expect(screen.getByText('Medium · World map')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Medium mode: open world map' })).toBeInTheDocument()

    // Unlock Station Dossier in Round 2 (expand Geographic intelligence if collapsed under jsdom)
    const intelToggle = screen.getByRole('button', { name: /Geographic intelligence/i })
    if (intelToggle.getAttribute('aria-expanded') === 'false') {
      await user.click(intelToggle)
    }
    const unlockBtn = await screen.findByRole('button', { name: /Unlock · −100 pts/i })
    await user.click(unlockBtn)

    // Unlocking auto-advances coach to the final pin-drop tip and reveals Station Dossier
    expect(screen.getByRole('heading', { name: 'Tiny Δ5° swing + 15 m coast = Equatorial Asia' })).toBeInTheDocument()
    expect(await screen.findByText('Station dossier')).toBeInTheDocument()

    // Open wrap-up covering Hard & Multiplayer
    await user.click(screen.getByRole('button', { name: 'See wrap-up' }))
    expect(screen.getByRole('heading', { name: 'Ready to read the planet' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'One shot, clock pressure' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Same mystery, shared reveal' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to main menu' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Back to How to play' })).toHaveAttribute('href', '/how-to-play')

    // Restart returns to Round 1
    await user.click(screen.getByRole('button', { name: 'Restart tutorial' }))
    expect(screen.getByText('Easy · 6 cities')).toBeInTheDocument()

    // Skip returns to /how-to-play
    await user.click(screen.getByRole('button', { name: 'Skip' }))
    expect(screen.getByText('How to play hub')).toBeInTheDocument()
  })
})
