import { expect, test } from '@playwright/test'

const lobbyCode = 'ABC123'
const rules = {
  timeLimitSeconds: 240, attemptsPerRound: 2, selectionMode: 'map',
  countryBorders: true, extraData: { mode: 'points', cost: 100 },
}

test('create and join save membership, and both players enter the match when the host starts', async ({ browser, baseURL }) => {
  const host = await browser.newPage({ baseURL })
  const guest = await browser.newPage({ baseURL })
  let joined = false
  let playing = false

  function lobby(youAreHost: boolean) {
    const hostMember = { displayName: 'Test Host', isHost: true }
    const guestMember = { displayName: 'Test Guest', isHost: false }
    return {
      lobbyId: 'fixture-lobby', code: lobbyCode, difficulty: 'medium',
      status: playing ? 'playing' : 'waiting', roundsTotal: 5, rules, youAreHost,
      members: joined ? [hostMember, guestMember] : [hostMember],
    }
  }

  try {
    await host.route('**/api/lobbies', (route) => {
      expect(route.request().postDataJSON().displayName).toBe('Test Host')
      return route.fulfill({ status: 201, json: { lobby: lobby(true), lobbyToken: 'host-token' } })
    })
    await guest.route(`**/api/lobbies/${lobbyCode}/join`, (route) => {
      expect(route.request().postDataJSON().displayName).toBe('Test Guest')
      joined = true
      return route.fulfill({ status: 201, json: { lobby: lobby(false), lobbyToken: 'guest-token' } })
    })
    for (const [page, token] of [[host, 'host-token'], [guest, 'guest-token']] as const) {
      const isHost = page === host
      await page.route(`**/api/lobbies/${lobbyCode}`, (route) => {
        expect(route.request().headers()['x-lobby-token']).toBe(token)
        return route.fulfill({ json: lobby(isHost) })
      })
      await page.route(`**/api/lobbies/${lobbyCode}/match`, (route) => {
        expect(route.request().headers()['x-lobby-token']).toBe(token)
        return route.fulfill({ json: {
          lobby: lobby(isHost),
          match: {
            status: 'playing', round: null, results: [], roundComplete: false,
            leaderboard: [], you: { finalized: false },
          },
        } })
      })
    }
    await host.route(`**/api/lobbies/${lobbyCode}/start`, (route) => {
      expect(route.request().headers()['x-lobby-token']).toBe('host-token')
      playing = true
      return route.fulfill({ json: {} })
    })

    await host.goto('/multiplayer')
    await host.getByLabel('Your name').fill('Test Host')
    await host.getByRole('button', { name: 'Create lobby' }).click()
    await expect(host.getByText('1 joined')).toBeVisible()

    await guest.goto('/multiplayer?mode=join')
    await guest.getByLabel('Your name').fill('Test Guest')
    await guest.getByLabel('Lobby code').fill(lobbyCode.toLowerCase())
    await guest.getByRole('button', { name: 'Join lobby' }).click()
    await expect(guest.getByText('Waiting for the host to start…')).toBeVisible()

    await Promise.all([
      host.waitForResponse((response) => response.url().endsWith(`/api/lobbies/${lobbyCode}/match`) && response.ok()),
      guest.waitForResponse((response) => response.url().endsWith(`/api/lobbies/${lobbyCode}/match`) && response.ok()),
      host.getByRole('button', { name: 'Start match' }).click(),
    ])
    await expect(host).toHaveURL(/\/lobby\/ABC123\/play$/)
    await expect(guest).toHaveURL(/\/lobby\/ABC123\/play$/)
  } finally {
    await host.close()
    await guest.close()
  }
})
