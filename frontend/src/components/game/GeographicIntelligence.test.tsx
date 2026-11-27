import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GeographicIntelligence as Intelligence } from '../../lib/contracts'
import { GeographicIntelligence } from './GeographicIntelligence'

function observation(modelTime: string | null, temperatureC = 12): Intelligence {
  return {
    fetchedAt: new Date().toISOString(),
    cached: false,
    weather: {
      modelTime,
      temperatureC,
      condition: 'Clear sky',
      windSpeedKmh: 7.2,
      windDirectionDeg: null,
      humidityPct: 66,
      pressureHpa: null,
      precipitationMm: 0,
      precipitationIntervalMinutes: null,
    },
    environment: { elevationM: null, reliefM: null, terrain: null, biome: null, vegetation: null },
    climate: null,
  }
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('core weather measurements', () => {
  it.each([0, 1.5])('displays precipitation of %s mm and keeps all core measurements with clues locked', async (precipitationMm) => {
    const data = observation(new Date().toISOString())
    const load = vi.fn().mockResolvedValue({ ...data, weather: { ...data.weather, precipitationMm } })
    render(
      <GeographicIntelligence
        roundId="round"
        roundKey="round-pano"
        load={load}
        access={{ mode: 'points', cost: 100, availableAt: null, unlocked: false, pointsSpent: 0 }}
        onUnlock={() => {}}
      />,
    )

    const panel = within(screen.getByRole('complementary', { name: 'Geographic intelligence' }))
    expect(await panel.findByText('Temperature', { exact: true })).toBeVisible()
    expect(panel.getByText('12°C')).toBeVisible()
    expect(panel.getByText('12°C · Clear sky')).toBeVisible()
    expect(panel.getAllByRole('term').map((label) => label.textContent)).toEqual(['Precipitation', 'Humidity', 'Wind speed'])
    expect(panel.getAllByRole('definition').map((value) => value.textContent)).toEqual([`${precipitationMm} mm`, '66%', '2 m/s'])
    expect(panel.getByRole('button', { name: /Unlock.*100 pts/ })).toBeEnabled()
  })

  it('refetches intelligence when additional data is unlocked so server-gated MET Norway clues appear', async () => {
    const lockedData = observation(new Date().toISOString())
    lockedData.weather!.pressureHpa = null
    lockedData.weather!.dewPointC = null
    lockedData.weather!.uvIndexMax24h = null
    lockedData.weather!.tempMin24hC = null
    lockedData.weather!.tempMax24hC = null
    const unlockedData = observation(new Date().toISOString())
    unlockedData.weather!.pressureHpa = 1015
    unlockedData.weather!.dewPointC = 6.4
    unlockedData.weather!.cloudCoverPct = 42
    unlockedData.weather!.uvIndexMax24h = 8.4
    unlockedData.weather!.tempMin24hC = 4
    unlockedData.weather!.tempMax24hC = 21
    unlockedData.weather!.precipitation24hMm = 3.2
    unlockedData.weather!.windGustKmh = 28.8
    unlockedData.environment = { elevationM: 420, reliefM: null, terrain: null, biome: null, vegetation: null }

    const load = vi.fn()
      .mockResolvedValueOnce(lockedData)
      .mockResolvedValueOnce(unlockedData)

    const { rerender } = render(
      <GeographicIntelligence
        roundId="round"
        roundKey="round-pano"
        load={load}
        access={{ mode: 'points', cost: 100, availableAt: null, unlocked: false, pointsSpent: 0 }}
        onUnlock={() => {}}
      />,
    )

    const panel = within(screen.getByRole('complementary', { name: 'Geographic intelligence' }))
    expect(await panel.findByText('Additional clues locked')).toBeVisible()
    expect(panel.getByText('Clear sky')).toBeVisible()
    expect(panel.queryByText('1,015 hPa')).not.toBeInTheDocument()
    expect(panel.queryByText('420 m')).not.toBeInTheDocument()
    expect(panel.queryByText('8.4 · Very high')).not.toBeInTheDocument()

    rerender(
      <GeographicIntelligence
        roundId="round"
        roundKey="round-pano"
        load={load}
        access={{ mode: 'points', cost: 100, availableAt: null, unlocked: true, pointsSpent: 100 }}
        onUnlock={() => {}}
      />,
    )

    expect(await panel.findByText('Station dossier')).toBeVisible()
    expect(panel.getByText('1,015 hPa')).toBeVisible()
    expect(panel.getByText('420 m')).toBeVisible()
    expect(panel.getByText('4° – 21°C (Δ17°)')).toBeVisible()
    expect(panel.getByText('8.4 · Very high')).toBeVisible()
    expect(panel.getByText('6.4°C')).toBeVisible()
    expect(panel.getByText('42%')).toBeVisible()
    expect(panel.getByText('3.2 mm')).toBeVisible()
    expect(panel.getByText('8 m/s')).toBeVisible()
    expect(load).toHaveBeenCalledTimes(2)
  })
})

describe('round weather freshness', () => {
  it.each(['2026-11-20T11:59:59Z', null])('does not display weather with an old or missing timestamp (%s)', async (modelTime) => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-20T14:00:00Z'))
    const load = vi.fn().mockResolvedValue(observation(modelTime))
    render(<GeographicIntelligence roundId="round" roundKey="round-pano" load={load} />)

    expect(await screen.findByRole('status')).toHaveTextContent('Current weather unavailable')
    expect(screen.queryAllByText('12°C')).toHaveLength(0)
  })

  it('hides the observation after 120 minutes and automatically displays fresh weather when it arrives', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    vi.setSystemTime(new Date('2026-11-20T14:00:00Z'))
    let deliverRefresh!: (data: Intelligence) => void
    const load = vi.fn()
      .mockResolvedValueOnce(observation('2026-11-20T12:00:00Z'))
      .mockImplementationOnce(() => new Promise<Intelligence>((resolve) => { deliverRefresh = resolve }))
    await act(async () => {
      render(<GeographicIntelligence roundId="round" roundKey="round-pano" load={load} />)
    })
    expect(screen.getAllByText('12°C').length).toBeGreaterThan(0)

    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(screen.queryAllByText('12°C')).toHaveLength(0)
    expect(screen.getByText('Connecting to the weather station…')).toBeVisible()
    expect(load).toHaveBeenCalledTimes(2)

    await act(async () => { deliverRefresh(observation('2026-11-20T14:00:00Z', 15)) })
    expect(screen.getAllByText('15°C').length).toBeGreaterThan(0)
  })

  it('starts collapsed on mobile viewports and expands when toggled', async () => {
    const originalMatchMedia = window.matchMedia
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia
    try {
      const load = vi.fn().mockResolvedValue(observation(new Date().toISOString(), 18))
      await act(async () => {
        render(<GeographicIntelligence roundId="round" roundKey="round-mobile" load={load} />)
      })

      const toggle = screen.getByRole('button', { name: /Geographic intelligence/i })
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByText('Precipitation')).not.toBeInTheDocument()

      await act(async () => {
        toggle.click()
      })
      expect(toggle).toHaveAttribute('aria-expanded', 'true')
      await waitFor(() => expect(screen.getByText('Precipitation')).toBeVisible())
    } finally {
      window.matchMedia = originalMatchMedia
    }
  })
})
