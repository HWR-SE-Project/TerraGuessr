import { useEffect, useRef, useState } from 'react'
import { Brand } from '../../components/ui/Brand'
import { useNavigate, useSearchParams } from 'react-router-dom'
import * as authApi from '../../api/auth'
import './tokens.css'
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
    <div
      className="tg-auth-root"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div className="tg-reset-card">
        <Brand />
        <div className="tg-email-form">
          {status === 'verifying' ? (
            <>
              <h2 className="tg-email-form-title">Verifying your email</h2>
              <p className="tg-email-hint" style={{ textAlign: 'center' }}>
                One moment…
              </p>
            </>
          ) : status === 'success' ? (
            <>
              <h2 className="tg-email-form-title">Email verified</h2>
              <p className="tg-email-hint" style={{ textAlign: 'center' }}>
                Your account is active. Sign in to start exploring.
              </p>
            </>
          ) : (
            <>
              <h2 className="tg-email-form-title">Verification failed</h2>
              <p className="tg-email-hint" style={{ textAlign: 'center' }}>
                {message}
              </p>
            </>
          )}
          {status !== 'verifying' && (
            <button
              type="button"
              className="tg-email-submit"
              onClick={() => navigate('/auth')}
            >
              {status === 'success' ? 'Go to sign in' : 'Back to sign in'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
