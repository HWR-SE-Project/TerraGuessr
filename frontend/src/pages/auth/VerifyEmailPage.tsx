import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AppHeader } from '../../components/layout/AppHeader'
import { Button } from '../../components/ui/Button'
import { useNavigate, useSearchParams } from 'react-router-dom'
import * as authApi from '../../api/auth'
import { collapseVariants, staggerContainer, staggerItem } from '../../lib/motion'
import './AuthPage.css'
import '../../components/auth/EmailAuthForm.css'

type Status = 'verifying' | 'success' | 'error'

export function VerifyEmailPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''
  const [status, setStatus] = useState<Status>(token ? 'verifying' : 'error')
  const [message, setMessage] = useState(
    token ? '' : 'This verification link is missing its token.',
  )
  const started = useRef(false)

  useEffect(() => {
    // Effect cleanup in StrictMode must not cancel the single-use request:
    // a second POST would always report an already-consumed token.
    if (!token || started.current) return
    started.current = true
    authApi
      .verifyEmail(token)
      .then(() => setStatus('success'))
      .catch(() => {
        setStatus('error')
        setMessage(
          'This verification link is invalid or has expired. Sign in to request a new one.',
        )
      })
  }, [token])

  return (
    <>
    <AppHeader />
    <main className="tg-auth-root">
      <div className="tg-reset-card">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={status}
            className="tg-email-form"
            variants={collapseVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <motion.div variants={staggerContainer} initial="initial" animate="animate">
              {status === 'verifying' ? (
                <>
                  <motion.h2 className="tg-email-form-title" variants={staggerItem}>Verifying your email</motion.h2>
                  <motion.p className="tg-email-hint" style={{ textAlign: 'center' }} variants={staggerItem}>
                    One moment…
                  </motion.p>
                </>
              ) : status === 'success' ? (
                <>
                  <motion.h2 className="tg-email-form-title" variants={staggerItem}>Email verified</motion.h2>
                  <motion.p className="tg-email-hint" style={{ textAlign: 'center' }} variants={staggerItem}>
                    Your account is active. Sign in to start exploring.
                  </motion.p>
                </>
              ) : (
                <>
                  <motion.h2 className="tg-email-form-title" variants={staggerItem}>Verification failed</motion.h2>
                  <motion.p className="tg-email-hint" style={{ textAlign: 'center' }} variants={staggerItem}>
                    {message}
                  </motion.p>
                </>
              )}
              {status !== 'verifying' && (
                <motion.div variants={staggerItem}>
                  <Button className="tg-email-submit" onClick={() => navigate('/auth')}>
                    {status === 'success' ? 'Go to sign in' : 'Back to sign in'}
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
