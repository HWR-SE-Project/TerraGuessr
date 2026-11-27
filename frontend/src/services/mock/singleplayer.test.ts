import { describe, expect, it } from 'vitest'
import { singleplayerMock } from './singleplayer'

describe('singleplayer mock flow', () => {
  it('creates a game and starts a round with the right attempts', async () => {
    const credentials = await singleplayerMock.create('medium')
    expect(credentials.id).toBeTruthy()
    expect(credentials.playerToken).toBeTruthy()

    const round = await singleplayerMock.next(credentials)
    expect(round.number).toBe(1)
    expect(round.attemptsTotal).toBe(2) // medium
    expect(round.candidates).toBeUndefined() // medium is map mode
    expect(round.endsAt).toBeTruthy()
  })

  it('easy mode returns six candidate cities with map coordinates', async () => {
    const credentials = await singleplayerMock.create('easy')
    const round = await singleplayerMock.next(credentials)
    expect(round.candidates).toHaveLength(6)
    for (const candidate of round.candidates!) {
      expect(typeof candidate.lat).toBe('number')
      expect(typeof candidate.lon).toBe('number')
    }
  })

  it('finalizes on the last attempt and returns a result', async () => {
    const credentials = await singleplayerMock.create('hard') // 1 attempt
    const round = await singleplayerMock.next(credentials)

    const response = await singleplayerMock.guess(credentials, round.id, { lat: 0, lon: 0 }, false)
    expect(response.finalized).toBe(true)
    expect(response.result).toBeTruthy()
    expect(response.result!.score).toBeGreaterThanOrEqual(0)
    expect(response.result!.actual).toBeTruthy()
  })

  it('rejects access to a finished round rather than throwing synchronously', async () => {
    const credentials = await singleplayerMock.create('medium')
    const round = await singleplayerMock.next(credentials)
    await singleplayerMock.guess(credentials, round.id, { lat: 0, lon: 0 }, true)

    // The round is no longer active — this must reject, not throw.
    await expect(singleplayerMock.intelligence(credentials, round.id)).rejects.toThrow()
  })

  it('enforces finite round limits and reports completion once all rounds are scored', async () => {
    await expect(singleplayerMock.create('medium', 2)).rejects.toThrow()
    await expect(singleplayerMock.create('medium', 11)).rejects.toThrow()

    const credentials = await singleplayerMock.create('hard', 3)
    for (let i = 1; i <= 3; i++) {
      const round = await singleplayerMock.next(credentials)
      expect(round.number).toBe(i)
      await singleplayerMock.guess(credentials, round.id, { lat: 0, lon: 0 }, true)
    }

    const session = await singleplayerMock.session(credentials)
    expect(session.roundsTotal).toBe(3)
    expect(session.completed).toBe(true)
    expect(session.results).toHaveLength(3)

    await expect(singleplayerMock.next(credentials)).rejects.toThrow(/completed/i)
  })

  it('finalizes a round from an already-submitted guess without requiring a second location', async () => {
    const credentials = await singleplayerMock.create('medium')
    const round = await singleplayerMock.next(credentials)

    await expect(singleplayerMock.finish(credentials, round.id)).rejects.toThrow(/at least one guess/i)

    const first = await singleplayerMock.guess(credentials, round.id, { lat: 48.8566, lon: 2.3522 }, false)
    expect(first.finalized).toBe(false)
    expect(first.attemptsRemaining).toBe(1)

    const finished = await singleplayerMock.finish(credentials, round.id)
    expect(finished.finalized).toBe(true)
    expect(finished.attemptsRemaining).toBe(0)
    expect(finished.result?.guess).toEqual({ lat: 48.8566, lon: 2.3522 })
  })
})
