import '@testing-library/jest-dom/vitest'
import { MotionGlobalConfig } from 'framer-motion'

// Complete Framer Motion transitions immediately in jsdom so `toBeVisible()`
// assertions never race against `initial={{ opacity: 0 }}` frames in CI.
MotionGlobalConfig.skipAnimations = true
