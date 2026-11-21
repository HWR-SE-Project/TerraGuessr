import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Button } from './Button'
import { Modal } from './Modal'
import { staggerContainer, staggerItem } from '../../lib/motion'
import './ConfirmDialog.css'

export interface ConfirmDialogProps {
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
  children?: ReactNode
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  return (
    <Modal title={title} onClose={onCancel} closeDisabled={busy} className="tg-confirm-dialog" role="alertdialog">
      <motion.div variants={staggerContainer} initial="initial" animate="animate">
        {description && (
          <motion.p variants={staggerItem}>{description}</motion.p>
        )}
        {children && <motion.div variants={staggerItem}>{children}</motion.div>}
        <motion.div variants={staggerItem} className="tg-confirm-actions">
          <Button variant="secondary" className="tg-confirm-cancel" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            className="tg-confirm-confirm"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Please wait…' : confirmLabel}
          </Button>
        </motion.div>
      </motion.div>
    </Modal>
  )
}
