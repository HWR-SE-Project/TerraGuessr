import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Dialog } from './Dialog'

afterEach(() => { document.body.style.overflow = ''; vi.restoreAllMocks() })

describe('shared dialog lifecycle', () => {
  it('owns native modality, background scrolling and focus restoration', () => {
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()
    document.body.style.overflow = 'auto'
    const view = render(<Dialog aria-label="Editor" onClose={vi.fn()}><button>Save</button></Dialog>)
    expect(screen.getByRole('dialog')).toHaveAttribute('open')
    expect(document.body.style.overflow).toBe('hidden')
    view.unmount()
    expect(document.body.style.overflow).toBe('auto')
    expect(trigger).toHaveFocus()
    trigger.remove()
  })

  it('blocks Escape, native cancellation and backdrop dismissal during a pending save', () => {
    const close = vi.fn()
    render(<Dialog aria-label="Saving" onClose={close} closeDisabled><button>Wait</button></Dialog>)
    const dialog = screen.getByRole('dialog')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    fireEvent.click(dialog, { clientX: -10, clientY: -10 })
    expect(close).not.toHaveBeenCalled()
  })

  it('distinguishes the backdrop from empty space inside the dialog', () => {
    const close = vi.fn()
    render(<Dialog aria-label="Menu" onClose={close}>Content</Dialog>)
    const dialog = screen.getByRole('dialog')
    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({ left: 20, top: 20, right: 100, bottom: 100 } as DOMRect)
    fireEvent.click(dialog, { clientX: 50, clientY: 50 })
    expect(close).not.toHaveBeenCalled()
    fireEvent.click(dialog, { clientX: 10, clientY: 10 })
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('traps keyboard focus and consumes Escape before page-level navigation', () => {
    const close = vi.fn(), pageShortcut = vi.fn()
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{ width: 10, height: 10 }] as unknown as DOMRectList)
    render(<div onKeyDown={pageShortcut}><Dialog aria-label="Menu" onClose={close}><h2 tabIndex={-1}>Menu</h2><button>First</button><button>Last</button></Dialog></div>)
    const first = screen.getByRole('button', { name: 'First' }), last = screen.getByRole('button', { name: 'Last' })
    first.focus()
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
    expect(last).toHaveFocus()
    fireEvent.keyDown(last, { key: 'Tab' })
    expect(first).toHaveFocus()
    pageShortcut.mockClear()
    fireEvent.keyDown(first, { key: 'Escape' })
    expect(close).toHaveBeenCalledTimes(1)
    expect(pageShortcut).not.toHaveBeenCalled()
  })
})
