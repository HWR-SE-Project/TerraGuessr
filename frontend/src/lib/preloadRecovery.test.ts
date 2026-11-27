import { afterEach, describe, expect, it, vi } from 'vitest'
import { installPreloadErrorRecovery } from './preloadRecovery'

afterEach(() => {
  window.sessionStorage.clear()
  vi.restoreAllMocks()
})

describe('installPreloadErrorRecovery', () => {
  it('prevents default and reloads once on vite:preloadError, then throttles repeat reloads', () => {
    const reload = vi.fn()
    let clock = 100_000
    const dispose = installPreloadErrorRecovery(window, reload, () => clock)

    try {
      const first = new Event('vite:preloadError', { cancelable: true })
      window.dispatchEvent(first)

      expect(first.defaultPrevented).toBe(true)
      expect(reload).toHaveBeenCalledTimes(1)

      // Immediate retry within the cooldown window must not loop.
      clock += 2_000
      const second = new Event('vite:preloadError', { cancelable: true })
      window.dispatchEvent(second)

      expect(second.defaultPrevented).toBe(false)
      expect(reload).toHaveBeenCalledTimes(1)

      // After the cooldown expires, a future deploy can recover again.
      clock += 20_000
      const third = new Event('vite:preloadError', { cancelable: true })
      window.dispatchEvent(third)

      expect(third.defaultPrevented).toBe(true)
      expect(reload).toHaveBeenCalledTimes(2)
    } finally {
      dispose()
    }
  })
})
