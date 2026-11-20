import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Tutorial, hasSeenTutorial, markTutorialSeen, shouldShowTutorialForNewGame } from './Tutorial'
import type { GeographicIntelligence } from '../../api/singleplayer'
vi.mock('./googleMaps', () => ({ browserMapsKey: () => '', loadGoogleMaps: vi.fn(), onMapsAuthFailure: () => () => {} }))

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
})
afterEach(() => { localStorage.clear(); vi.unstubAllGlobals() })
const go = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const section = (number: number) => go(`Step ${number}: ${['Weather', 'Location', 'Confirmation', 'Distance', 'Points'][number - 1]}`)

describe('R14 tutorial lifecycle', () => {
  it('tracks seen status while temporary testing mode always opens new games', () => {
    expect(hasSeenTutorial()).toBe(false)
    expect(shouldShowTutorialForNewGame()).toBe(true)
    markTutorialSeen()
    expect(hasSeenTutorial()).toBe(true)
    expect(shouldShowTutorialForNewGame()).toBe(true)
  })
  it('walks through the five required subjects, goes back, and finishes', async () => {
    const close = vi.fn()
    render(<Tutorial onClose={close} />)
    expect(screen.getByText('STEP 1 OF 5 · MEDIUM')).toBeVisible()
    await screen.findByText('Tutorial example · weather, not your current round')
    go('Next')
    expect(screen.getByRole('heading', { name: 'Find your place' })).toHaveFocus()
    go('Previous')
    expect(screen.getByRole('heading', { name: 'Read the world around you' })).toHaveFocus()
    for (let step = 2; step <= 5; step++) {
      go('Next')
      expect(screen.getByText(`STEP ${step} OF 5 · MEDIUM`)).toBeVisible()
    }
    expect(close).not.toHaveBeenCalled()
    go('Finish tutorial')
    expect(close).toHaveBeenCalledOnce()
  })
  it.each([1, 2, 3, 4, 5])('can exit, Escape, and restart from step %i', async step => {
    const close = vi.fn()
    render(<Tutorial onClose={close} />)
    await screen.findByText('Tutorial example · weather, not your current round')
    section(step)
    go('Restart tutorial')
    expect(screen.getByText('STEP 1 OF 5 · MEDIUM')).toBeVisible()
    section(step)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(close).toHaveBeenCalledOnce()
    go('Skip')
    expect(close).toHaveBeenCalledTimes(2)
  })
  it('clears practice state on restart and restores focus on teardown', async () => {
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()
    const { unmount } = render(<Tutorial difficulty="easy" onClose={vi.fn()} />)
    await screen.findByText('Tutorial example · weather, not your current round')
    section(2)
    go(/Paris/)
    section(3)
    go('Confirm practice guess')
    expect(screen.getByRole('status')).toHaveTextContent('answer is locked')
    go('Restart tutorial')
    section(3)
    expect(screen.getByRole('button', { name: 'Confirm practice guess' })).toBeDisabled()
    unmount()
    expect(trigger).toHaveFocus()
    trigger.remove()
  })
})

describe('R14 interactive content', () => {
  it('explains and highlights all four weather indicators with correctly converted wind speed', async () => {
    render(<Tutorial onClose={vi.fn()} />)
    const panel = await screen.findByRole('complementary', { name: 'Geographic intelligence practice' })
    await screen.findByText('Partly cloudy')
    expect(within(panel).getByText('m/s')).toBeVisible()
    expect(within(panel).getByText('5')).toBeVisible() // 18 km/h / 3.6
    for (const label of ['Temperature (°C)', 'Precipitation (mm)', 'Humidity (%)', 'Wind speed (m/s)']) {
      go(label)
      expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true')
    }
    expect(screen.getByText(/Clues, not proof/)).toBeVisible()
  })
  it('uses safe round weather when available and aborts pending loads on exit', async () => {
    const load = vi.fn(async (_id: string, _signal?: AbortSignal): Promise<GeographicIntelligence> => ({
      fetchedAt: '', cached: true, climate: null,
      weather: { temperatureC: 0, precipitationMm: 0, humidityPct: 0, windSpeedKmh: 0, modelTime: null, condition: 'Snow', windDirectionDeg: null, pressureHpa: null, precipitationIntervalMinutes: 15 },
      environment: { elevationM: null, reliefM: null, terrain: null, biome: null, vegetation: null },
    }))
    const { unmount } = render(<Tutorial onClose={vi.fn()} round={{ id: 'safe', number: 1, panoId: 'hidden' }} loadIntelligence={load} />)
    await screen.findByText('Current round · model weather clues')
    expect(screen.getByText('Snow')).toBeVisible()
    const signal = load.mock.calls[0]![1]!
    unmount()
    expect(signal.aborted).toBe(true)
  })
  it('falls back to clearly labeled examples if real weather fails', async () => {
    render(<Tutorial onClose={vi.fn()} round={{ id: 'safe', number: 1, panoId: 'hidden' }} loadIntelligence={async () => { throw new Error('SECRET actual location') }} />)
    await screen.findByText('Tutorial example · weather, not your current round')
    expect(screen.queryByText(/SECRET/)).not.toBeInTheDocument()
  })
  it('demonstrates changing the Easy list selection and safely locks confirmation', async () => {
    render(<Tutorial difficulty="easy" onClose={vi.fn()} />)
    await screen.findByText('Partly cloudy')
    section(3)
    const confirm = screen.getByRole('button', { name: 'Confirm practice guess' })
    expect(confirm).toBeDisabled()
    const options = screen.getAllByTestId('candidate-option')
    expect(options).toHaveLength(4)
    fireEvent.click(options[0]!)
    fireEvent.click(options[1]!)
    expect(options[0]).toHaveAttribute('aria-pressed', 'false')
    expect(options[1]).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Selection changed. Still not submitted.')
    go('Confirm practice guess')
    expect(confirm).toBeDisabled()
    expect(options[0]).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('answer is locked')
    go('Try again')
    expect(options[0]).toBeEnabled()
    expect(confirm).toBeDisabled()
  })
  it.each(['medium', 'hard'] as const)('supports %s map practice and keyboard placement without Maps', async difficulty => {
    render(<Tutorial difficulty={difficulty} onClose={vi.fn()} />)
    await screen.findByText('Partly cloudy')
    section(2)
    expect(screen.getByText(difficulty === 'hard' ? /no country borders/ : /includes country borders/)).toBeVisible()
    fireEvent.change(screen.getByLabelText('Practice latitude'), { target: { value: '42' } })
    fireEvent.change(screen.getByLabelText('Practice longitude'), { target: { value: '12' } })
    expect(screen.getByRole('status')).toHaveTextContent('42.000°, 12.000°')
    section(3)
    go('Confirm practice guess')
    expect(screen.getByLabelText('Practice latitude')).toBeDisabled()
  })
  it('shows latitude/longitude, a connected example, Haversine and one decimal km', async () => {
    render(<Tutorial onClose={vi.fn()} />)
    await screen.findByText('Partly cloudy')
    section(4)
    expect(screen.getByText('343.6')).toBeVisible()
    expect(screen.getByText(/latitude and longitude/)).toBeVisible()
    go('Step 4: Distance')
    fireEvent.click(screen.getByText('Explore the Haversine formula'))
    expect(screen.getByText(/6371.0088/)).toBeVisible()
    expect(screen.getByRole('img', { name: /markers connected by a line/ })).toBeVisible()
  })
  it('uses the real score curve including perfect, decay and distant guesses', async () => {
    render(<Tutorial onClose={vi.fn()} />)
    await screen.findByText('Partly cloudy')
    section(5)
    const slider = screen.getByRole('slider')
    for (const [distance, points] of [[0, '5,000'], [2000, '1,839'], [20000, '0']]) {
      fireEvent.change(slider, { target: { value: distance } })
      await waitFor(() => expect(screen.getByLabelText('Example score')).toHaveTextContent(String(points)))
    }
    expect(screen.getByText(/TerraGuessr is endless/)).toBeVisible()
    expect(screen.queryByText(/five rounds/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/25,000/)).not.toBeInTheDocument()
  })
})
