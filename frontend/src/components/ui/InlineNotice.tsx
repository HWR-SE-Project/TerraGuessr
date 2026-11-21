import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { noticeVariants } from '../../lib/motion'
import './InlineNotice.css'

export function InlineNotice({
  tone = 'info',
  children,
  className = '',
}: {
  tone?: 'info' | 'error' | 'success' | 'warning'
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div
      className={`tg-notice tg-notice--${tone} ${className}`}
      role={tone === 'error' ? 'alert' : 'status'}
      variants={noticeVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {children}
    </motion.div>
  )
}
