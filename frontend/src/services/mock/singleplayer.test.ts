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

  it('easy mode returns six candidate cities', async () => {
    const credentials = await singleplayerMock.create('easy')
    const round = await singleplayerMock.next(credentials)
    expect(round.candidates).toHaveLength(6)
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
})
