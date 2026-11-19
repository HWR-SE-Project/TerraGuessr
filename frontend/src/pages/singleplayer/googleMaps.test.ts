import { afterEach, describe, expect, it, vi } from 'vitest'
afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
  document
    .querySelectorAll('script[src*="maps.googleapis.com"]')
    .forEach((s) => s.remove())
})
describe('Google Maps browser loader', () => {
  it('never loads an SDK with missing credentials', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '')
    const { loadGoogleMaps } = await import('./googleMaps')
    await expect(loadGoogleMaps()).rejects.toThrow('credentials are missing')
    expect(
      document.querySelector('script[src*="maps.googleapis.com"]'),
    ).toBeNull()
  })
  it('deduplicates concurrent script requests and allows retry on a network failure', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-only-key')
    const { loadGoogleMaps } = await import('./googleMaps')
    const first = loadGoogleMaps()
    expect(loadGoogleMaps()).toBe(first)
    expect(
      document.querySelectorAll('script[src*="maps.googleapis.com"]'),
    ).toHaveLength(1)
    const failure = expect(first).rejects.toThrow('Could not load')
    document.querySelector('script')!.dispatchEvent(new Event('error'))
    await failure
    const second = loadGoogleMaps()
    expect(second).not.toBe(first)
    const secondFailure = expect(second).rejects.toThrow('Could not load')
    document.querySelector('script')!.dispatchEvent(new Event('error'))
    await secondFailure
  })
  it('notifies mounted maps and rejects on an authentication failure', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-only-key')
    const { loadGoogleMaps, onMapsAuthFailure } = await import('./googleMaps')
    const listener = vi.fn()
    const unsubscribe = onMapsAuthFailure(listener)
    const failure =
      expect(loadGoogleMaps()).rejects.toThrow('access was denied')
    const target = window as typeof window & { gm_authFailure: () => void }
    target.gm_authFailure()
    await failure
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })
})
