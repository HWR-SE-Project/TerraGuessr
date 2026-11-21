import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { DifficultyPicker } from './DifficultyPicker'
import type { Difficulty } from '../api/types'

/** A real controlled usage, so arrow-key presses visibly move the selection. */
function ControlledPicker({ initial = 'medium' as Difficulty }) {
  const [value, setValue] = useState<Difficulty>(initial)
  return <DifficultyPicker value={value} onChange={setValue} />
}

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
    expect(screen.getByText(/6 locations/i)).toBeVisible()
    expect(screen.getByText(/3 attempts/i)).toBeVisible()
    expect(screen.getByText(/with country borders/i)).toBeVisible()
    expect(screen.getByText(/20 seconds/i)).toBeVisible()
  })

  it('marks the selected option with a non-color checkmark indicator', () => {
    render(<DifficultyPicker value="hard" onChange={vi.fn()} />)
    const hard = screen.getByRole('radio', { name: /Hard/ })
    const easy = screen.getByRole('radio', { name: /Easy/ })
    expect(hard.querySelector('.tg-difficulty-check')).not.toBeNull()
    expect(easy.querySelector('.tg-difficulty-check')).toBeNull()
  })

  it('gives only the selected option a tab stop (roving tabindex)', () => {
    render(<DifficultyPicker value="medium" onChange={vi.fn()} />)
    expect(screen.getByRole('radio', { name: /Easy/ })).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('radio', { name: /Medium/ })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('radio', { name: /Hard/ })).toHaveAttribute('tabindex', '-1')
  })

  it('moves selection and focus together with ArrowRight/ArrowLeft, wrapping at the ends', () => {
    render(<ControlledPicker initial="medium" />)
    const group = screen.getByRole('radiogroup')
    fireEvent.keyDown(group, { key: 'ArrowRight' })
    expect(screen.getByRole('radio', { name: /Hard/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /Hard/ })).toHaveFocus()
    fireEvent.keyDown(group, { key: 'ArrowRight' })
    expect(screen.getByRole('radio', { name: /Easy/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /Easy/ })).toHaveFocus()
    fireEvent.keyDown(group, { key: 'ArrowLeft' })
    expect(screen.getByRole('radio', { name: /Hard/ })).toHaveAttribute('aria-checked', 'true')
  })

  it('jumps to the first/last option with Home/End', () => {
    render(<ControlledPicker initial="medium" />)
    const group = screen.getByRole('radiogroup')
    fireEvent.keyDown(group, { key: 'End' })
    expect(screen.getByRole('radio', { name: /Hard/ })).toHaveAttribute('aria-checked', 'true')
    fireEvent.keyDown(group, { key: 'Home' })
    expect(screen.getByRole('radio', { name: /Easy/ })).toHaveAttribute('aria-checked', 'true')
  })

  it('ignores arrow keys while disabled', () => {
    const onChange = vi.fn()
    render(<DifficultyPicker value="medium" onChange={onChange} disabled />)
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowRight' })
    expect(onChange).not.toHaveBeenCalled()
  })
  it('moves from the focused option when keyboard focus differs from the selected option', () => {
    render(<ControlledPicker initial="hard" />)
    const easy = screen.getByRole('radio', { name: /Easy/ })
    easy.focus()
    fireEvent.keyDown(easy, { key: 'ArrowRight' })
    expect(screen.getByRole('radio', { name: /Medium/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /Medium/ })).toHaveFocus()
  })

})
