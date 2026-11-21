import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AppHeader } from '../../components/layout/AppHeader'
import { Button } from '../../components/ui/Button'
import { useNavigate, useSearchParams } from 'react-router-dom'
import * as authApi from '../../api/auth'
import type { EmailChangeConfirmation } from '../../api/types'
import { mapApiError } from '../../api/errorMessages'
import { useSession } from '../../state/SessionContext'
import { collapseVariants, staggerContainer, staggerItem } from '../../lib/motion'
import './AuthPage.css'
import '../../components/auth/EmailAuthForm.css'

type Status = 'confirming' | 'done' | 'error'

function pendingCopy(result: EmailChangeConfirmation): { heading: string; body: string } {
  if (result.side === 'old') {
    return {
      heading: 'Current address confirmed',
      body: 'Now open the confirmation email sent to your new address to finish the change.',
    }
  }
  return {
    heading: 'New address confirmed',
    body: 'Now open the confirmation email sent to your current address to approve the change.',
  }
}

export function EmailChangePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { refresh } = useSession()
  const token = params.get('token') ?? ''
  const [status, setStatus] = useState<Status>(token ? 'confirming' : 'error')
  const [result, setResult] = useState<EmailChangeConfirmation | null>(null)
  const [message, setMessage] = useState(
    token ? '' : 'This confirmation link is missing its token.',
  )
  const started = useRef(false)

  useEffect(() => {
    // The token is single-use, so StrictMode must not fire the request twice.
    if (!token || started.current) return
    started.current = true
    authApi
      .confirmEmailChange(token)
      .then(async (confirmation) => {
        setResult(confirmation)
        setStatus('done')
        if (confirmation.changed) await refresh().catch(() => {})
      })
      .catch((error) => {
        setStatus('error')
        setMessage(
          mapApiError(
            error,
            { INVALID_EMAIL_CHANGE_TOKEN: 'This confirmation link is invalid or has expired.' },
          ),
        )
      })
  }, [token, refresh])

  const changed = status === 'done' && result?.changed === true

  return (
    <>
    <AppHeader />
    <main className="tg-auth-root">
      <div className="tg-reset-card">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${status}-${result?.changed ?? ''}`}
            className="tg-email-form"
            variants={collapseVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <motion.div variants={staggerContainer} initial="initial" animate="animate">
              {status === 'confirming' ? (
                <>
                  <motion.h2 className="tg-email-form-title" variants={staggerItem}>Confirming your email change</motion.h2>
                  <motion.p className="tg-email-hint" style={{ textAlign: 'center' }} variants={staggerItem}>
                    One moment…
                  </motion.p>
                </>
              ) : status === 'done' && result?.changed ? (
                <>
                  <motion.h2 className="tg-email-form-title" variants={staggerItem}>Email updated</motion.h2>
                  <motion.p className="tg-email-hint" style={{ textAlign: 'center' }} variants={staggerItem}>
                    Your address is now {result.email}. For security, every session
                    has been signed out. Sign in again with the new address.
                  </motion.p>
                </>
              ) : status === 'done' && result ? (
                <>
                  <motion.h2 className="tg-email-form-title" variants={staggerItem}>{pendingCopy(result).heading}</motion.h2>
                  <motion.p className="tg-email-hint" style={{ textAlign: 'center' }} variants={staggerItem}>
                    {pendingCopy(result).body}
                  </motion.p>
                </>
              ) : (
                <>
                  <motion.h2 className="tg-email-form-title" variants={staggerItem}>Confirmation failed</motion.h2>
                  <motion.p className="tg-email-hint" style={{ textAlign: 'center' }} variants={staggerItem}>
                    {message}
                  </motion.p>
                </>
              )}
              {status !== 'confirming' && (
                <motion.div variants={staggerItem}>
                  <Button className="tg-email-submit" onClick={() => navigate(changed ? '/auth' : '/settings')}>
                    {changed ? 'Go to sign in' : status === 'done' ? 'Back to settings' : 'Back'}
                  </Button>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
    </>
  )
}
