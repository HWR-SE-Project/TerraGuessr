import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { pageTransition, pageVariants } from '../../lib/motion'

/** Wraps a single route's content with the app-wide page enter/exit motion. */
export function PageTransition({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
      style={{ willChange: 'transform, opacity' }}
    >
      {children}
    </motion.div>
  )
}
