import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useLobbyPolling } from './useLobbyRoute'

const session = { code: 'ABC123', token: 'test-token', isHost: false }

afterEach(() => vi.useRealTimers())

describe('lobby polling', () => {
  it('keeps a single poll in flight and aborts it when leaving the page', async () => {
    vi.useFakeTimers()
    const read = vi.fn((_code: string, _token: string, _signal: AbortSignal) => new Promise<string>(() => {}))
    const { result, unmount } = renderHook(() => useLobbyPolling(session, read, 1000))
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(read).toHaveBeenCalledTimes(1)

    const [, , signal] = read.mock.calls[0]!
    unmount()
    expect(signal.aborted).toBe(true)
    await result.current.refresh()
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('prevents an earlier read from overwriting an acknowledged action', async () => {
    let resolvePoll!: (value: string) => void
    const read = vi.fn((_code: string, _token: string, _signal: AbortSignal) => new Promise<string>((resolve) => { resolvePoll = resolve }))
    const { result } = renderHook(() => useLobbyPolling(session, read, 1000))
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1))
    act(() => result.current.update(() => 'action result'))
    await act(async () => { resolvePoll('outdated read') })

    expect(read.mock.calls[0]![2].aborted).toBe(true)
    expect(result.current.data).toBe('action result')
  })
})
