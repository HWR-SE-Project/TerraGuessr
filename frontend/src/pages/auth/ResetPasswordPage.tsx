import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AppHeader } from '../../components/layout/AppHeader'
import { useNavigate, useSearchParams } from 'react-router-dom'
import * as authApi from '../../api/auth'
import { mapApiError } from '../../api/errorMessages'
import { collapseVariants, noticeVariants, staggerContainer, staggerItem } from '../../lib/motion'
import './AuthPage.css'
import '../../components/auth/EmailAuthForm.css'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await authApi.completePasswordReset(token, password)
      setDone(true)
    } catch (cause) {
      setError(
        mapApiError(cause, {
          VALIDATION_ERROR: 'That reset link is invalid or has expired.',
        }),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
    <AppHeader />
    <main className="tg-auth-root">
      <motion.div
        className="tg-reset-card"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        <AnimatePresence mode="wait" initial={false}>
          {!token ? (
            <motion.div
              key="invalid"
              className="tg-email-form"
              variants={collapseVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <motion.h2 className="tg-email-form-title" variants={staggerItem}>Invalid link</motion.h2>
              <motion.p className="tg-email-hint" style={{ textAlign: 'center' }} variants={staggerItem}>
                This password reset link is missing its token. Request a new one
                from the sign-in screen.
              </motion.p>
              <motion.div variants={staggerItem}>
                <Button
                  type="button"
                  className="tg-email-submit"
                  onClick={() => navigate('/auth')}
                >
                  Back to sign in
                </Button>
              </motion.div>
            </motion.div>
          ) : done ? (
            <motion.div
              key="done"
              className="tg-email-form"
              variants={collapseVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <motion.h2 className="tg-email-form-title" variants={staggerItem}>Password updated</motion.h2>
              <motion.p className="tg-email-hint" style={{ textAlign: 'center' }} variants={staggerItem}>
                You can now log in with your new password.
              </motion.p>
              <motion.div variants={staggerItem}>
                <Button
                  type="button"
                  className="tg-email-submit"
                  onClick={() => navigate('/auth')}
                >
                  Go to sign in
                </Button>
              </motion.div>
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
              <h2 className="tg-email-form-title">Choose a new password</h2>
              <label className="tg-email-field">
                <span>New password</span>
                <Input
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <small className="tg-email-hint">At least 12 characters.</small>
              </label>
              <AnimatePresence>
                {error && (
                  <motion.p
                    key="reset-error"
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
              <Button
                type="submit"
                className="tg-email-submit"
                disabled={submitting}
              >
                {submitting ? 'Updating…' : 'Update password'}
              </Button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </main>
    </>
  )
}
