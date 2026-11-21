import type { Variants } from 'framer-motion'

// One motion system for the whole app. Values are intentionally short and
// restrained; framer-motion's `MotionConfig reducedMotion="user"` plus the CSS
// media query handle the prefers-reduced-motion case.

export const spring = {
  // Snappy, slightly bouncy — used for selections, score pops, press feedback.
  snappy: { type: 'spring', stiffness: 520, damping: 32 },
  // Gentle, used for panels and cards entering the screen.
  gentle: { type: 'spring', stiffness: 260, damping: 26 },
} as const

export const tween = {
  fast: { duration: 0.16, ease: [0.2, 0.8, 0.2, 1] as const },
  base: { duration: 0.26, ease: [0.16, 1, 0.3, 1] as const },
  slow: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
}

export const fadeUp: Variants = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.18, ease: [0.2, 0.8, 0.2, 1] } },
}

export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.16 } },
}

export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.94 },
  animate: { opacity: 1, scale: 1, transition: spring.gentle },
  exit: { opacity: 0, scale: 0.96, transition: tween.fast },
}

export const staggerContainer: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
}

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: tween.base },
}

/** Pop animation for a value that changes (scores, round numbers). */
export const popIn: Variants = {
  initial: { opacity: 0.4, scale: 0.9, y: 4 },
  animate: { opacity: 1, scale: 1, y: 0, transition: spring.snappy },
}
