import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ExitGameDialog } from './ExitGameDialog'

function renderDialog(
  overrides: Partial<Parameters<typeof ExitGameDialog>[0]> = {},
) {
  const onContinue = vi.fn()
  const onEnd = vi.fn()
  render(
    <ExitGameDialog
      onContinue={onContinue}
      onEnd={onEnd}
      pending={null}
      error={null}
      round={3}
      score={8240}
      {...overrides}
    />,
  )
  return { onContinue, onEnd }
}

describe('ExitGameDialog', () => {
  it('shows the end-game confirmation with a progress recap', () => {
    renderDialog()
    expect(
      screen.getByRole('dialog', { name: 'End your adventure?' }),
    ).toBeVisible()
    expect(screen.getByText(/Round 3/)).toBeVisible()
    expect(screen.getByText(/8,240 pts/)).toBeVisible()
    expect(
      screen.getByText(/won't be able to continue this session afterward/i),
    ).toBeVisible()
  })

  it('Keep Playing calls onContinue and nothing else', () => {
    const { onContinue, onEnd } = renderDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Keep Playing' }))
    expect(onContinue).toHaveBeenCalledTimes(1)
    expect(onEnd).not.toHaveBeenCalled()
  })

  it('End Game calls onEnd', () => {
    const { onEnd } = renderDialog()
    fireEvent.click(screen.getByRole('button', { name: 'End Game' }))
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('disables every action and shows an ending label while finalizing is pending', () => {
    renderDialog({ pending: 'end' })
    expect(screen.getByRole('button', { name: 'Keep Playing' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Ending…' })).toBeDisabled()
  })

  it('surfaces an end-game failure without claiming success', () => {
    renderDialog({
      error: { action: 'end', message: 'Unable to reach the game server.' },
    })
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Unable to reach the game server.',
    )
  })

  it('never offers a Save & Exit or Leave Game action (R06)', () => {
    renderDialog()
    expect(
      screen.queryByRole('button', { name: /save & exit/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^leave game$/i }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/resumable from this browser/i)).not.toBeInTheDocument()
  })
})
