import { useEffect, useRef, useState } from 'react'
import { AppHeader } from '../../components/layout/AppHeader'
import { Button } from '../../components/ui/Button'
import { useNavigate, useSearchParams } from 'react-router-dom'
import * as authApi from '../../api/auth'
import type { EmailChangeConfirmation } from '../../api/types'
import { mapApiError } from '../../api/errorMessages'
import { useSession } from '../../state/SessionContext'
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
        <div className="tg-email-form">
          {status === 'confirming' ? (
            <>
              <h2 className="tg-email-form-title">Confirming your email change</h2>
              <p className="tg-email-hint" style={{ textAlign: 'center' }}>
                One moment…
              </p>
            </>
          ) : status === 'done' && result?.changed ? (
            <>
              <h2 className="tg-email-form-title">Email updated</h2>
              <p className="tg-email-hint" style={{ textAlign: 'center' }}>
                Your address is now {result.email}. For security, every session
                has been signed out. Sign in again with the new address.
              </p>
            </>
          ) : status === 'done' && result ? (
            <>
              <h2 className="tg-email-form-title">{pendingCopy(result).heading}</h2>
              <p className="tg-email-hint" style={{ textAlign: 'center' }}>
                {pendingCopy(result).body}
              </p>
            </>
          ) : (
            <>
              <h2 className="tg-email-form-title">Confirmation failed</h2>
              <p className="tg-email-hint" style={{ textAlign: 'center' }}>
                {message}
              </p>
            </>
          )}
          {status !== 'confirming' && (
            <Button className="tg-email-submit" onClick={() => navigate(changed ? '/auth' : '/settings')}>
              {changed ? 'Go to sign in' : status === 'done' ? 'Back to settings' : 'Back'}
            </Button>
          )}
        </div>
      </div>
    </main>
    </>
  )
}
