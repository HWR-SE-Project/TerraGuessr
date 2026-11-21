import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FinalResults, RoundResults } from './GameResults'
import type { StreetSession } from '../../api/singleplayer'
vi.mock('../../game/GuessMap', () => ({ GuessMap: () => <div>Result map provider double</div> }))

describe('R14 consistent geographic distance display', () => {
  it.each([[0, '0.0 km'], [0.05, '0.1 km'], [123, '123.0 km'], [343.556, '343.6 km']])('displays %s km with one decimal in round results', (km, label) => {
    render(<RoundResults result={{ roundId: 'scored-example', number: 1, guess: { lat: 0, lon: 0 }, actual: { lat: 0, lon: 0 }, distanceKm: Number(km), score: 4000 }} busy={false} onNext={vi.fn()} />)
    expect(screen.getByText(label)).toBeVisible()
  })
})

describe('endless mode: round results never offer a final-results branch', () => {
  it('always labels the action "Next round", regardless of round number', () => {
    render(
      <RoundResults
        result={{ roundId: 'r-12', number: 12, guess: { lat: 0, lon: 0 }, actual: { lat: 0, lon: 0 }, distanceKm: 10, score: 4800 }}
        busy={false}
        onNext={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: /Next round/ })).toBeVisible()
    expect(screen.queryByText(/view final results/i)).not.toBeInTheDocument()
    expect(screen.getByText('ROUND 12 COMPLETE')).toBeVisible()
  })
})

const baseSession: StreetSession = {
  id: 'summary-game',
  difficulty: 'hard',
  totalScore: 0,
  activeRound: null,
  results: [],
}

describe('FinalResults: session summary', () => {
  it('shows an empty-session state instead of fabricated stats when no rounds were played', () => {
    render(<FinalResults session={baseSession} busy={false} onPlayAgain={vi.fn()} onHome={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Adventure ended' })).toBeVisible()
    expect(screen.getByText('No rounds completed this time. Ready for another journey?')).toBeVisible()
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
    expect(screen.queryByText(/Round breakdown/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Difficulty/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/average score/i)).not.toBeInTheDocument()
  })

  it('computes rounds completed, average score, best round, average distance and difficulty', () => {
    const session: StreetSession = {
      ...baseSession,
      totalScore: 9000,
      results: [
        { roundId: 'r1', number: 1, guess: { lat: 1, lon: 1 }, actual: { lat: 2, lon: 2 }, distanceKm: 100, score: 4000 },
        { roundId: 'r2', number: 2, guess: { lat: 1, lon: 1 }, actual: { lat: 2, lon: 2 }, distanceKm: 300, score: 5000 },
      ],
    }
    const { container } = render(
      <FinalResults session={session} busy={false} onPlayAgain={vi.fn()} onHome={vi.fn()} />,
    )
    const stats = container.querySelector('.sp-summary-stats')!
    expect(screen.getByText('9,000')).toBeVisible()
    expect(screen.getByText('total points')).toBeVisible()
    expect(stats).toHaveTextContent('Rounds completed2')
    expect(stats).toHaveTextContent('Average score / round4,500 pts')
    expect(stats).toHaveTextContent('Best round5,000 pts Round 2')
    expect(container.querySelector('.sp-summary-breakdown')).not.toHaveAttribute('open')
    expect(stats).toHaveTextContent('Average distance200.0 km')
    expect(stats).toHaveTextContent('DifficultyHard')
    expect(screen.queryByText(/\/ \d.*points/)).not.toBeInTheDocument() // no total-score cap
  })
})
