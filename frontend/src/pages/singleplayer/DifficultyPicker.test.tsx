import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DifficultyPicker } from './DifficultyPicker'

describe('DifficultyPicker (R05)', () => {
  it('renders all three levels with exactly one marked as selected', () => {
    render(<DifficultyPicker value="medium" onChange={vi.fn()} />)
    const options = screen.getAllByRole('radio')
    expect(options).toHaveLength(3)
    expect(screen.getByRole('radio', { name: /Medium/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByRole('radio', { name: /Easy/ })).toHaveAttribute(
      'aria-checked',
      'false',
    )
    expect(screen.getByRole('radio', { name: /Hard/ })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })

  it('reports the chosen difficulty without changing it locally', () => {
    const onChange = vi.fn()
    render(<DifficultyPicker value="medium" onChange={onChange} />)
    screen.getByRole('radio', { name: /Easy/ }).click()
    expect(onChange).toHaveBeenCalledWith('easy')
    // Still shows medium selected: the parent owns the selected value.
    expect(screen.getByRole('radio', { name: /Medium/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('disables every option while a game request is in flight', () => {
    render(<DifficultyPicker value="easy" onChange={vi.fn()} disabled />)
    for (const option of screen.getAllByRole('radio')) {
      expect(option).toBeDisabled()
    }
  })

  it('explains the difference between difficulty levels', () => {
    render(<DifficultyPicker value="easy" onChange={vi.fn()} />)
    expect(screen.getByText(/handful of named cities/i)).toBeVisible()
    expect(screen.getByText(/starts collapsed/i)).toBeVisible()
  })
})
