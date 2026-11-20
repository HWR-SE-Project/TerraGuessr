import { useEffect } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SingleplayerGamePage } from './SingleplayerGamePage'
import { singleplayerApi } from '../../api/singleplayer'
import type { Difficulty, StreetSession } from '../../api/singleplayer'
import { markTutorialSeen } from './Tutorial'

// Real page, tutorial, selection list and session controller; only external services are doubled.
vi.mock('../../api/singleplayer', () => ({ singleplayerApi: {
  config: vi.fn(), create: vi.fn(), next: vi.fn(), session: vi.fn(), intelligence: vi.fn(), guess: vi.fn(), end: vi.fn(),
} }))
vi.mock('./googleMaps', () => ({ browserMapsKey: () => 'test-key' }))
vi.mock('../../components/cosmic/CosmicContext', () => ({ useCosmicBackgroundMode: vi.fn() }))
vi.mock('./StreetViewViewer', () => ({ StreetViewViewer: ({ onReady }: { onReady: (ready: boolean) => void }) => {
  useEffect(() => { onReady(true) }, [onReady])
  return <div data-testid="panorama-instance">Street View provider double</div>
} }))
vi.mock('./GuessMap', () => ({ GuessMap: ({ onChange, interactive, guess }: {
  onChange?: (guess: { lat: number; lon: number }) => void; interactive: boolean; guess?: { lat: number; lon: number }
}) => <button disabled={!interactive} onClick={() => onChange?.({ lat: 12, lon: 34 })}>Map SDK double {guess?.lat}</button> }))
const round = { id: 'round-2', number: 2, panoId: 'private-panorama' }
const session = (difficulty: Difficulty): StreetSession => ({
  id: 'active-game', difficulty, totalScore: 4200, activeRound: round, results: [],
})
beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  vi.clearAllMocks()
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  vi.mocked(singleplayerApi.config).mockResolvedValue({ available: true, provider: 'google', serverKeyConfigured: true })
  vi.mocked(singleplayerApi.intelligence).mockRejectedValue(new Error('Offline'))
  vi.mocked(singleplayerApi.create).mockResolvedValue({ id: 'new-game', playerToken: 'test-token' })
  vi.mocked(singleplayerApi.next).mockResolvedValue(round)
  vi.mocked(singleplayerApi.session).mockResolvedValue(session('medium'))
})
afterEach(() => vi.unstubAllGlobals())
function renderGame(url = '/game/singleplayer') {
  return render(<MemoryRouter initialEntries={[url]}><SingleplayerGamePage /></MemoryRouter>)
}
async function openFromMenu() {
  fireEvent.click(screen.getByRole('button', { name: 'Game menu' }))
  fireEvent.click(screen.getByRole('button', { name: 'How to Play / Tutorial' }))
  await screen.findByRole('heading', { name: 'Read the world around you' })
}
async function startGameAndDismissAutoTutorial(difficulty: Difficulty) {
  vi.mocked(singleplayerApi.session).mockResolvedValue(session(difficulty))
  renderGame()
  fireEvent.click(await screen.findByRole('button', { name: /Start exploring/ }))
  await screen.findByRole('dialog', { name: 'How to play / Tutorial' })
  await waitFor(() => expect(singleplayerApi.create).toHaveBeenCalledOnce())
  fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
  await screen.findByTestId('panorama-instance')
}
describe('R14 Singleplayer integration', () => {
  it('opens from the game menu and the home-menu deep link before starting any game', async () => {
    const { unmount } = renderGame()
    await openFromMenu()
    expect(singleplayerApi.create).not.toHaveBeenCalled()
    unmount()
    renderGame('/game/singleplayer?tutorial=1')
    expect(await screen.findByRole('dialog', { name: 'How to play / Tutorial' })).toBeVisible()
    expect(singleplayerApi.create).not.toHaveBeenCalled()
  })
  it.each([1, 2, 3, 4, 5])('preserves the live session, difficulty, score, round, marker and panorama on exit from step %i', async step => {
    localStorage.setItem('terraguessr.difficulty.v1', 'easy') // live session difficulty takes precedence over this
    await startGameAndDismissAutoTutorial('hard')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Map SDK double' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Map SDK double' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guess' })).toBeEnabled())
    const panorama = screen.getByTestId('panorama-instance')
    await openFromMenu()
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('STEP 1 OF 5 · HARD')).toBeVisible()
    if (step >= 2) {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Step 2: Location' }))
      fireEvent.click(within(dialog).getByRole('button', { name: 'Map SDK double' }))
      fireEvent.click(within(dialog).getByRole('button', { name: 'Step 3: Confirmation' }))
      fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm practice guess' }))
    }
    fireEvent.click(within(dialog).getByRole('button', { name: `Step ${step}: ${['Weather', 'Location', 'Confirmation', 'Distance', 'Points'][step - 1]}` }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Skip' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByTestId('panorama-instance')).toBe(panorama)
    expect(screen.getByText('12.000°, 34.000° · pin placed')).toBeVisible()
    expect(screen.getByText('4,200')).toBeVisible()
    expect(singleplayerApi.guess).not.toHaveBeenCalled()
    expect(singleplayerApi.next).toHaveBeenCalledTimes(1) // only the initial start, never re-triggered by the tutorial
    expect(singleplayerApi.end).not.toHaveBeenCalled()
    expect(singleplayerApi.create).toHaveBeenCalledTimes(1)
    await openFromMenu() // completion/skip never gates manual restart
    expect(within(screen.getByRole('dialog')).getByText('STEP 1 OF 5 · HARD')).toBeVisible()
  })
  it('automatically opens for every new game despite seen status, but never while simply reopening the menu', async () => {
    markTutorialSeen()
    renderGame()
    fireEvent.click(await screen.findByRole('button', { name: /Start exploring/ }))
    await screen.findByRole('dialog', { name: 'How to play / Tutorial' })
    await waitFor(() => expect(singleplayerApi.create).toHaveBeenCalledOnce())
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    fireEvent.click(screen.getByRole('button', { name: 'Game menu' }))
    fireEvent.click(screen.getByRole('button', { name: /Back to game/ }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(singleplayerApi.create).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Game menu' }))
    fireEvent.click(screen.getByRole('button', { name: 'Restart game' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Restart game' }))
    await screen.findByRole('dialog', { name: 'How to play / Tutorial' })
    await waitFor(() => expect(singleplayerApi.create).toHaveBeenCalledTimes(2))
  })
})
