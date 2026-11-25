import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../services'
import { GuessPanel } from './GuessPanel'

const candidates = [
  { id: 'c1', name: 'London', region: 'EUROPE', lat: 51.5074, lon: -0.1278 },
  { id: 'c2', name: 'Paris', region: 'EUROPE', lat: 48.8566, lon: 2.3522 },
  { id: 'c3', name: 'Berlin', region: 'EUROPE', lat: 52.52, lon: 13.405 },
]

const listRules = { selectionMode: 'list' as const, countryBorders: true }

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('GuessPanel selection sync', () => {
  it('coalesces rapid selection changes so only the latest choice is sent', async () => {
    vi.useFakeTimers()
    const onSelect = vi.fn(async () => {})
    render(
      <GuessPanel
        rules={listRules}
        candidates={candidates}
        endsAt={new Date(Date.now() + 60_000).toISOString()}
        attemptsUsed={0}
        attemptsTotal={3}
        submitting={false}
        onSelect={onSelect}
        onSubmit={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /London/ }))
    fireEvent.click(screen.getByRole('button', { name: /Paris/ }))
    fireEvent.click(screen.getByRole('button', { name: /Berlin/ }))

    expect(onSelect).not.toHaveBeenCalled()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith({ candidateId: 'c3' })
  })

  it('flushes immediately without debounce in the final 3 seconds before timeout', async () => {
    vi.useFakeTimers()
    const onSelect = vi.fn(async () => {})
    render(
      <GuessPanel
        rules={listRules}
        candidates={candidates}
        endsAt={new Date(Date.now() + 1_500).toISOString()}
        attemptsUsed={0}
        attemptsTotal={3}
        submitting={false}
        onSelect={onSelect}
        onSubmit={vi.fn()}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Paris/ }))
    })

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith({ candidateId: 'c2' })
  })

  it('retries transient save errors automatically and surfaces an actionable alert + Retry on persistent failure', async () => {
    vi.useFakeTimers()
    const onSelect = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('RATE_LIMITED', 'Too many requests', 429))
      .mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 'Offline', 0))
      .mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 'Offline', 0))
      .mockResolvedValueOnce(undefined)

    render(
      <GuessPanel
        rules={listRules}
        candidates={candidates}
        endsAt={new Date(Date.now() + 2_000).toISOString()}
        attemptsUsed={0}
        attemptsTotal={3}
        submitting={false}
        onSelect={onSelect}
        onSubmit={vi.fn()}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /London/ }))
      await vi.advanceTimersByTimeAsync(1_000)
    })

    // Initial attempt + 2 automatic retries = 3 attempts, then visible error alert.
    expect(onSelect).toHaveBeenCalledTimes(3)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/Selection not saved/i)
    expect(alert).toHaveTextContent(/Offline/i)

    // Manual Retry recovers and clears the alert.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    })
    expect(onSelect).toHaveBeenCalledTimes(4)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('cancels a pending selection write when the player submits their guess', async () => {
    vi.useFakeTimers()
    const onSelect = vi.fn(async () => {})
    const onSubmit = vi.fn()
    render(
      <GuessPanel
        rules={listRules}
        candidates={candidates}
        endsAt={new Date(Date.now() + 60_000).toISOString()}
        attemptsUsed={0}
        attemptsTotal={3}
        submitting={false}
        onSelect={onSelect}
        onSubmit={onSubmit}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /London/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Final submit' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(onSubmit).toHaveBeenCalledWith({ candidateId: 'c1' }, true)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('does not show a retryable alert when the server responds 409 (round already ended)', async () => {
    vi.useFakeTimers()
    const onSelect = vi.fn().mockRejectedValue(
      new ApiError('CONFLICT', 'This round has already ended.', 409),
    )
    render(
      <GuessPanel
        rules={listRules}
        candidates={candidates}
        endsAt={new Date(Date.now() + 1_000).toISOString()}
        attemptsUsed={0}
        attemptsTotal={3}
        submitting={false}
        onSelect={onSelect}
        onSubmit={vi.fn()}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /London/ }))
      await vi.advanceTimersByTimeAsync(1_000)
    })

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('GuessPanel easy-mode candidate map', () => {
  it('renders candidate locations directly on the map and lets players click them to select and submit', () => {
    const onSubmit = vi.fn()
    render(
      <GuessPanel
        rules={listRules}
        candidates={candidates}
        submittedCandidateIds={['c2']}
        attemptsUsed={1}
        attemptsTotal={3}
        submitting={false}
        onSelect={vi.fn(async () => {})}
        onSubmit={onSubmit}
      />,
    )

    expect(
      screen.getByLabelText(/World map with candidate locations/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/Click a location on the map/i)).toBeInTheDocument()

    const london = screen.getByRole('button', { name: 'London, Europe' })
    const paris = screen.getByRole('button', { name: 'Paris, Europe (submitted)' })
    expect(london).toHaveAttribute('aria-pressed', 'false')
    expect(paris).toBeDisabled()

    fireEvent.click(london)
    expect(london).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('· Europe')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Submit guess' }))
    expect(onSubmit).toHaveBeenCalledWith({ candidateId: 'c1' }, false)
  })

  it('falls back to the city list when candidates omit coordinates', () => {
    render(
      <GuessPanel
        rules={listRules}
        candidates={[
          { id: 'c1', name: 'London', region: 'EUROPE' },
          { id: 'c2', name: 'Paris', region: 'EUROPE' },
        ]}
        attemptsUsed={0}
        attemptsTotal={3}
        submitting={false}
        onSelect={vi.fn(async () => {})}
        onSubmit={vi.fn()}
      />,
    )

    expect(
      screen.queryByLabelText(/World map with candidate locations/i),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /London/ })).toBeInTheDocument()
  })

  it('starts collapsed on mobile viewports and opens the map when toggled', () => {
    const originalMatchMedia = window.matchMedia
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia
    try {
      render(
        <GuessPanel
          rules={listRules}
          candidates={candidates}
          attemptsUsed={0}
          attemptsTotal={3}
          submitting={false}
          onSelect={vi.fn(async () => {})}
          onSubmit={vi.fn()}
        />,
      )

      const toggle = screen.getByRole('button', { name: /Pick a city/i })
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByLabelText(/World map with candidate locations/i)).not.toBeInTheDocument()

      fireEvent.click(toggle)
      expect(toggle).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByLabelText(/World map with candidate locations/i)).toBeInTheDocument()
    } finally {
      window.matchMedia = originalMatchMedia
    }
  })
})
