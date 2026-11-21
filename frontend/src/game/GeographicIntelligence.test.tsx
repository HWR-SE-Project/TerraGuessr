import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GeographicIntelligence } from './GeographicIntelligence'
import { singleplayerApi } from '../api/singleplayer'
import { testRound } from '../pages/singleplayer/testRound'
import type { GeographicIntelligence as Data } from '../api/singleplayer'
vi.mock('../api/singleplayer', () => ({
  singleplayerApi: { intelligence: vi.fn() },
}))
const load = (roundId: string, signal?: AbortSignal) =>
  singleplayerApi.intelligence(
    { id: 'game', playerToken: 'private-token' },
    roundId,
    signal,
  )
const round = testRound({ id: 'round', number: 1, panoId: 'pano' })
const data: Data = {
  fetchedAt: '2026-11-19T12:00Z',
  cached: true,
  weather: {
    modelTime: '2026-11-19T12:00Z',
    temperatureC: 0,
    condition: 'Clear sky',
    windSpeedKmh: 0,
    windDirectionDeg: 0,
    humidityPct: 0,
    pressureHpa: 1000,
    precipitationMm: 0,
    precipitationIntervalMinutes: 15,
  },
  environment: {
    elevationM: 0,
    reliefM: 0,
    terrain: 'Low relief',
    biome: null,
    vegetation: null,
  },
  climate: null,
}
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
  vi.mocked(singleplayerApi.intelligence).mockReset()
})
afterEach(() => vi.unstubAllGlobals())
describe('environmental clues lifecycle', () => {
  it('shows skeletons and valid zero metrics, identifies cached model data, and makes collapsed content inert', async () => {
    vi.mocked(singleplayerApi.intelligence).mockResolvedValue(data)
    render(<GeographicIntelligence load={load} round={round} />)
    expect(
      screen.getByRole('status', { name: 'Loading geographic intelligence' }),
    ).toBeVisible()
    const panel = screen.getByRole('complementary', {
      name: 'Geographic intelligence',
    })
    await waitFor(() =>
      expect(
        within(panel).getByText('Cached model · 19 Nov, 12:00 UTC'),
      ).toBeVisible(),
    )
    expect(within(panel).getByRole('meter')).toHaveAttribute(
      'aria-valuenow',
      '0',
    )
    expect(within(panel).getByText('Clear sky')).toBeVisible()
    expect(within(panel).getByText('Low relief')).toBeVisible()
    // R06/R15: all four mandatory weather metrics are shown with their units.
    expect(within(panel).getByText('°C')).toBeVisible()
    expect(within(panel).getByText('mm')).toBeVisible()
    expect(within(panel).getByText('%')).toBeVisible()
    expect(within(panel).getByText('m/s')).toBeVisible()
    // R15: labels are present and ordered consistently.
    const weather = within(panel).getByRole('region', { name: 'Weather conditions' })
    const labels = ['Temperature', 'Wind speed', 'Humidity', 'Precipitation']
    const positions = labels.map(label => (weather.textContent ?? '').indexOf(label))
    expect(positions.every(position => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    fireEvent.click(
      within(panel).getByRole('button', { name: /GEOGRAPHIC INTELLIGENCE/ }),
    )
    expect(document.getElementById('gi-desktop-content')).toHaveAttribute(
      'inert',
    )
    expect(singleplayerApi.intelligence).toHaveBeenCalledTimes(1)
  })
  it('shows the same weather labels and units in the compact mobile summary', async () => {
    vi.mocked(singleplayerApi.intelligence).mockResolvedValue(data)
    render(<GeographicIntelligence load={load} round={round} />)
    const trigger = screen.getByRole('button', {
      name: 'Open geographic intelligence',
    })
    await waitFor(() =>
      expect(within(trigger).getByText('Temperature')).toBeVisible(),
    )
    for (const label of ['Temperature', 'Wind speed', 'Humidity', 'Precipitation']) {
      expect(within(trigger).getByText(label)).toBeVisible()
    }
    expect(within(trigger).getByText('0 °C')).toBeVisible()
    expect(within(trigger).getByText('0 m/s')).toBeVisible()
    expect(within(trigger).getByText('0 %')).toBeVisible()
    expect(within(trigger).getByText('0 mm')).toBeVisible()
  })
  it('handles failure without provider text, retries, and aborts requests on round teardown', async () => {
    vi.mocked(singleplayerApi.intelligence)
      .mockRejectedValueOnce(new Error('SECRET city 50,10'))
      .mockResolvedValueOnce(data)
    const { unmount } = render(
      <GeographicIntelligence load={load} round={round} />,
    )
    await screen.findByText('Signal unavailable')
    expect(screen.queryByText(/SECRET/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Retry connection/ }))
    await screen.findByText('Clear sky')
    const signal = vi.mocked(singleplayerApi.intelligence).mock.calls[1][2]!
    unmount()
    expect(signal.aborted).toBe(true)
  })
  it('does not publish late responses after the current round is replaced', async () => {
    let resolve!: (data: Data) => void
    vi.mocked(singleplayerApi.intelligence)
      .mockReturnValueOnce(
        new Promise((done) => {
          resolve = done
        }),
      )
      .mockResolvedValueOnce({
        ...data,
        weather: { ...data.weather!, condition: 'Rain' },
      })
    const { rerender } = render(
      <GeographicIntelligence key="old" load={load} round={round} />,
    )
    rerender(
      <GeographicIntelligence
        key="new"
        load={load}
        round={{ ...round, id: 'new-round' }}
      />,
    )
    await screen.findByText('Rain')
    await act(async () => resolve(data))
    expect(screen.getByText('Rain')).toBeVisible()
    expect(screen.queryByText('Clear sky')).not.toBeInTheDocument()
  })
  it('supports an optional collapsed state while exposing the mandatory fields on demand', async () => {
    vi.mocked(singleplayerApi.intelligence).mockResolvedValue(data)
    render(
      <GeographicIntelligence load={load} round={round} defaultExpanded={false} />,
    )
    const toggle = screen.getByRole('button', {
      name: /GEOGRAPHIC INTELLIGENCE/,
    })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await waitFor(() => expect(screen.getByText('Clear sky')).toBeVisible())
  })
  it('defaults to expanded when no defaultExpanded is given', () => {
    vi.mocked(singleplayerApi.intelligence).mockResolvedValue(data)
    render(<GeographicIntelligence load={load} round={round} />)
    expect(
      screen.getByRole('button', { name: /GEOGRAPHIC INTELLIGENCE/ }),
    ).toHaveAttribute('aria-expanded', 'true')
  })
})
