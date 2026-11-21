import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'
import { createElement, forwardRef, type ElementType, type ReactNode } from 'react'

// jsdom does not implement window.matchMedia; AppHeader's compact-nav
// breakpoint detection relies on it.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = function (query: string): MediaQueryList {
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    } as MediaQueryList
  }
}

// jsdom never ticks the rAF-driven transitions Framer Motion relies on, so
// any `motion.*` element would stay stuck at its `initial` (often
// opacity: 0) style — failing RTL's toBeVisible() everywhere the redesign
// added animation. Component tests exercise behavior, not animation, so
// replace `motion.*`/AnimatePresence/MotionConfig with plain passthroughs
// that strip animation-only props and render children synchronously.
const ANIMATION_PROPS = new Set([
  'initial', 'animate', 'exit', 'variants', 'transition',
  'whileHover', 'whileTap', 'whileFocus', 'whileInView', 'whileDrag',
  'layout', 'layoutId', 'drag', 'dragConstraints', 'onAnimationComplete',
])

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  const passthrough = (tag: ElementType) =>
    forwardRef<Element, Record<string, unknown>>((props, ref) => {
      const rest: Record<string, unknown> = {}
      for (const key in props) if (!ANIMATION_PROPS.has(key)) rest[key] = props[key]
      return createElement(tag, { ...rest, ref })
    })
  const motion = new Proxy({} as Record<string, unknown>, {
    get: (cache, tag: string) =>
      tag === 'create'
        ? (component: ElementType) => passthrough(component)
        : (cache[tag] ??= passthrough(tag as ElementType)),
  })
  return {
    ...actual,
    motion,
    AnimatePresence: ({ children }: { children?: ReactNode }) => children,
    MotionConfig: ({ children }: { children?: ReactNode }) => children,
  }
})

// jsdom does not implement <dialog>'s showModal()/close() (as of jsdom 31).
// Components like Modal rely on them; polyfill minimally for tests.
if (typeof HTMLDialogElement !== 'undefined') {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    }
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      this.removeAttribute('open')
    }
  }
}
