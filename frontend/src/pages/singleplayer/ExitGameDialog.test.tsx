import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ExitGameDialog } from './ExitGameDialog'

function renderDialog(
  overrides: Partial<Parameters<typeof ExitGameDialog>[0]> = {},
) {
  const onContinue = vi.fn()
  const onSaveExit = vi.fn()
  const onLeave = vi.fn()
  render(
    <ExitGameDialog
      onContinue={onContinue}
      onSaveExit={onSaveExit}
      onLeave={onLeave}
      pending={null}
      error={null}
      round={3}
      roundsTotal={5}
      score={8240}
      {...overrides}
    />,
  )
  return { onContinue, onSaveExit, onLeave }
}

describe('ExitGameDialog', () => {
  it('shows the leave confirmation with a progress recap', () => {
    renderDialog()
    expect(
      screen.getByRole('dialog', { name: 'Leave this game?' }),
    ).toBeVisible()
    expect(screen.getByText(/Round 3 of 5/)).toBeVisible()
    expect(screen.getByText(/8,240 pts/)).toBeVisible()
  })

  it('Continue Playing calls onContinue and nothing else', () => {
    const { onContinue, onSaveExit, onLeave } = renderDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Continue Playing' }))
    expect(onContinue).toHaveBeenCalledTimes(1)
    expect(onSaveExit).not.toHaveBeenCalled()
    expect(onLeave).not.toHaveBeenCalled()
  })

  it('Save & Exit calls onSaveExit', () => {
    const { onSaveExit } = renderDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Save & Exit' }))
    expect(onSaveExit).toHaveBeenCalledTimes(1)
  })

  it('Leave Game calls onLeave', () => {
    const { onLeave } = renderDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Leave Game' }))
    expect(onLeave).toHaveBeenCalledTimes(1)
  })

  it('disables every action and shows a saving label while a save is pending', () => {
    renderDialog({ pending: 'save' })
    expect(screen.getByRole('button', { name: 'Continue Playing' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Leave Game' })).toBeDisabled()
  })

  it('disables every action and shows a leaving label while abandonment is pending', () => {
    renderDialog({ pending: 'leave' })
    expect(screen.getByRole('button', { name: 'Continue Playing' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save & Exit' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Leaving…' })).toBeDisabled()
  })

  it('surfaces a save failure without claiming success', () => {
    renderDialog({
      error: { action: 'save', message: 'Unable to reach the game server.' },
    })
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Unable to reach the game server.',
    )
  })

  it('surfaces an abandonment failure distinctly', () => {
    renderDialog({
      error: { action: 'leave', message: 'Unable to abandon this expedition.' },
    })
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Unable to abandon this expedition.',
    )
  })

  it('explains the resume limitation so guests are not misled about cross-device saves', () => {
    renderDialog()
    expect(screen.getByText(/resumable from this browser for up to 24/i)).toBeVisible()
  })
})
