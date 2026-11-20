import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Tutorial, hasSeenTutorial, markTutorialSeen } from './Tutorial'

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

describe('hasSeenTutorial / markTutorialSeen (R14 persistence)', () => {
  it('is unseen until explicitly marked', () => {
    expect(hasSeenTutorial()).toBe(false)
    markTutorialSeen()
    expect(hasSeenTutorial()).toBe(true)
  })
})

describe('Tutorial (R14)', () => {
  it('walks through every step and calls onClose after the last one', () => {
    const onClose = vi.fn()
    render(<Tutorial onClose={onClose} />)
    expect(screen.getByText('STEP 1 OF 5')).toBeVisible()
    expect(screen.getByText('A world, five rounds')).toBeVisible()
    for (let step = 2; step <= 5; step++) {
      fireEvent.click(screen.getByRole('button', { name: /Next|Got it/ }))
      expect(screen.getByText(`STEP ${step} OF 5`)).toBeVisible()
    }
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Got it/ }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('can be skipped at any point without finishing the steps', () => {
    const onClose = vi.fn()
    render(<Tutorial onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('can navigate backward', () => {
    render(<Tutorial onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('STEP 2 OF 5')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText('STEP 1 OF 5')).toBeVisible()
  })

  it('never blocks gameplay — it is just a dialog the caller controls', () => {
    const onClose = vi.fn()
    const { unmount } = render(<Tutorial onClose={onClose} />)
    unmount()
    expect(onClose).not.toHaveBeenCalled()
  })
})
