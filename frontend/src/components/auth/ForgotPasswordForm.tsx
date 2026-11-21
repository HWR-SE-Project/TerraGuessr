import { Input } from '../ui/Input'
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import * as authApi from '../../api/auth'
import { mapApiError } from '../../api/errorMessages'
import { Button } from '../ui/Button'
import { collapseVariants, noticeVariants } from '../../lib/motion'
import './EmailAuthForm.css'

export function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await authApi.requestPasswordReset(email)
      setSent(true)
    } catch (cause) {
      setError(mapApiError(cause, { RATE_LIMITED: 'Too many requests. Try again in an hour.' }))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {sent ? (
        <motion.div
          key="sent"
          className="tg-email-form"
          variants={collapseVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <h2 className="tg-email-form-title">Check your email</h2>
          <p className="tg-email-hint" style={{ textAlign: 'center' }}>
            If an account exists for {email}, a reset link is on its way.
          </p>
          <button type="button" className="tg-email-link" onClick={onBack}>
            Back to sign in
          </button>
        </motion.div>
      ) : (
        <motion.form
          key="form"
          className="tg-email-form"
          onSubmit={submit}
          variants={collapseVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <h2 className="tg-email-form-title">Reset your password</h2>
          <label className="tg-email-field">
            <span>Email</span>
            <Input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <AnimatePresence>
            {error && (
              <motion.p
                key="forgot-error"
                className="tg-email-error"
                role="alert"
                variants={noticeVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
          <Button type="submit" className="tg-email-submit" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send reset link'}
          </Button>
          <div className="tg-email-footer">
            <button type="button" className="tg-email-link" onClick={onBack}>
              Back to sign in
            </button>
          </div>
        </motion.form>
      )}
    </AnimatePresence>
  )
}
