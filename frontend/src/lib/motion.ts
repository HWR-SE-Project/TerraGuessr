/**
 * Shared motion design system — the single source of truth for durations,
 * easings, springs, and reusable Framer Motion variants across the app.
 * Everything here is GPU-friendly (transform/opacity only) and automatically
 * respects `prefers-reduced-motion` via <MotionConfig reducedMotion="user">
 * in main.tsx — no per-component checks needed.
 */
import type { Transition, Variants } from 'framer-motion'

/** Duration scale (seconds — Framer Motion's native unit). */
export const duration = {
  instant: 0.1,
  fast: 0.16,
  base: 0.26,
  slow: 0.42,
  page: 0.5,
} as const

/** Cubic-bezier matching --ease-out in tokens.css, plus a couple of siblings. */
export const ease = {
  out: [0.2, 0.8, 0.2, 1] as const,
  inOut: [0.4, 0, 0.2, 1] as const,
  emphasized: [0.16, 1, 0.3, 1] as const,
}

/** Spring presets for playful, game-like interactions. */
export const spring = {
  snappy: { type: 'spring', stiffness: 520, damping: 34, mass: 0.7 } satisfies Transition,
  bouncy: { type: 'spring', stiffness: 360, damping: 20, mass: 0.8 } satisfies Transition,
  gentle: { type: 'spring', stiffness: 220, damping: 26, mass: 1 } satisfies Transition,
}

export const stagger = {
  tight: 0.04,
  base: 0.07,
  relaxed: 0.1,
}

/** Press/hover feedback shared by pressable surfaces (cards, chips, rows). */
export const pressable = {
  whileHover: { y: -2, scale: 1.01 },
  whileTap: { y: 0, scale: 0.97 },
  transition: spring.snappy,
}

export const tapOnly = {
  whileTap: { scale: 0.96 },
  transition: spring.snappy,
}

/** Full-page enter/exit used by the route-level PageTransition wrapper. */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 14, scale: 0.99 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -10, scale: 0.99 },
}

export const pageTransition: Transition = {
  duration: duration.page,
  ease: ease.emphasized,
}

/** Stagger container for page/section content — pair with `staggerItem`. */
export const staggerContainer: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: stagger.base, delayChildren: 0.06 } },
}

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.out } },
}

/** Modal / dialog panel entrance+exit. Pair with `overlayVariants` for the backdrop. */
export const modalVariants: Variants = {
  initial: { opacity: 0, scale: 0.94, y: 12 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { ...spring.snappy } },
  exit: { opacity: 0, scale: 0.96, y: 8, transition: { duration: duration.fast, ease: ease.out } },
}

export const overlayVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: duration.base, ease: ease.out } },
  exit: { opacity: 0, transition: { duration: duration.fast, ease: ease.out } },
}

/** Collapsible sections (Geographic Intelligence, accordions, dropdowns). */
export const collapseVariants: Variants = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto', transition: { duration: duration.base, ease: ease.emphasized } },
  exit: { opacity: 0, height: 0, transition: { duration: duration.fast, ease: ease.out } },
}

/** Dropdown / menu panel used by nav and settings popovers. */
export const dropdownVariants: Variants = {
  initial: { opacity: 0, y: -6, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: spring.snappy },
  exit: { opacity: 0, y: -4, scale: 0.98, transition: { duration: duration.instant, ease: ease.out } },
}

/** Notifications / toasts sliding in. */
export const noticeVariants: Variants = {
  initial: { opacity: 0, y: -8, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: spring.gentle },
  exit: { opacity: 0, y: -6, scale: 0.98, transition: { duration: duration.fast, ease: ease.out } },
}

/** Celebratory pop for great guesses / score reveals. */
export const celebrateVariants: Variants = {
  initial: { opacity: 0, scale: 0.6 },
  animate: { opacity: 1, scale: 1, transition: spring.bouncy },
  exit: { opacity: 0, scale: 0.8, transition: { duration: duration.fast } },
}
