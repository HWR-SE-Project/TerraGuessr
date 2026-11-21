import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { HowToPlayPage } from './HowToPlayPage'

vi.mock('../../state/SessionContext', () => ({ useSession: () => ({ user: null }) }))

describe('How to play page', () => {
  it('shows the full guide together with difficulty rules and a play link', () => {
    render(<MemoryRouter><HowToPlayPage /></MemoryRouter>)
    for (const title of ['Look around', 'Follow the clues', 'Choose your location', 'Make your guess', 'Easy', 'Medium', 'Hard']) {
      expect(screen.getByRole('heading', { name: title })).toBeVisible()
    }
    expect(screen.getByText('7 min · 3 attempts · free clues')).toBeVisible()
    expect(screen.getByText('4 min · 2 attempts · clues cost 100 pts')).toBeVisible()
    expect(screen.getByText('2 min · 1 attempt · clues cost 20 s')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Let’s explore' })).toHaveAttribute('href', '/game/singleplayer')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('demonstrates the scoring curve without starting a round', () => {
    render(<MemoryRouter><HowToPlayPage /></MemoryRouter>)
    for (const [distance, score] of [[0, '5,000'], [2000, '4,522'], [20000, '0']]) {
      fireEvent.change(screen.getByRole('slider'), { target: { value: distance } })
      expect(screen.getByLabelText('Example score')).toHaveTextContent(`${score} / 5,000 pts`)
    }
    expect(screen.getByText(/a location in Paris is about 343.6 km away/)).toBeVisible()
  })
})
