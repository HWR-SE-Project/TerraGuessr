import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../services'
import { GuessPanel } from './GuessPanel'

const candidates = [
  { id: 'c1', name: 'London', region: 'EUROPE' },
  { id: 'c2', name: 'Paris', region: 'EUROPE' },
  { id: 'c3', name: 'Berlin', region: 'EUROPE' },
]

const listRules = { selectionMode: 'list' as const, countryBorders: true }

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('GuessPanel selection sync (R08)', () => {
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
