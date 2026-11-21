import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CandidateList } from './CandidateList'
import type { CandidateDTO } from '../api/types'

const candidates: CandidateDTO[] = [
  { id: '0', name: 'London', region: 'EUROPE', lat: 51.5, lon: -0.1 },
  { id: '1', name: 'Paris', region: 'EUROPE', lat: 48.9, lon: 2.3 },
  { id: '2', name: 'Tokyo', region: 'ASIA', lat: 35.7, lon: 139.7 },
]

describe('CandidateList (R07 list-mode guess selection)', () => {
  it('renders every candidate as a selectable option', () => {
    render(<CandidateList candidates={candidates} onChange={vi.fn()} />)
    expect(screen.getAllByTestId('candidate-option')).toHaveLength(3)
    expect(screen.getByText('London')).toBeVisible()
    expect(screen.getByText('Paris')).toBeVisible()
    expect(screen.getByText('Tokyo')).toBeVisible()
  })

  it('emits the exact coordinates of the clicked candidate, same shape as the map picker', () => {
    const onChange = vi.fn()
    render(<CandidateList candidates={candidates} onChange={onChange} />)
    screen.getByText('Paris').closest('button')!.click()
    expect(onChange).toHaveBeenCalledWith({ lat: 48.9, lon: 2.3 })
  })

  it('never marks which candidate is the actual answer', () => {
    render(<CandidateList candidates={candidates} onChange={vi.fn()} />)
    for (const button of screen.getAllByTestId('candidate-option')) {
      expect(button).toHaveAttribute('aria-pressed', 'false')
    }
  })

  it('marks the selected candidate as pressed once chosen', () => {
    render(
      <CandidateList candidates={candidates} onChange={vi.fn()} selectedId="1" />,
    )
    expect(screen.getByText('Paris').closest('button')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText('London').closest('button')).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('shows a status message instead of an empty list', () => {
    render(<CandidateList candidates={[]} onChange={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent(
      'No candidates available.',
    )
  })
})
