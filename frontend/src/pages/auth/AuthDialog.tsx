import { useState } from 'react'
import googleLogo from '../../assets/auth/google-logo.svg'
import appleLogo from '../../assets/auth/apple-logo.svg'
import facebookLogo from '../../assets/auth/facebook-logo.svg'
import closeIcon from '../../assets/auth/close-icon.svg'
import backIcon from '../../assets/auth/back-icon.svg'
import { googleSignInUrl } from '../../api/auth'
import { useSession } from '../../state/SessionContext'
import { EmailAuthForm } from '../../components/auth/EmailAuthForm'
import { ForgotPasswordForm } from '../../components/auth/ForgotPasswordForm'
import { UnavailableNotice } from '../../components/UnavailableNotice'
import './AuthDialog.css'

type DialogView = 'providers' | 'email' | 'forgot'

interface AuthDialogProps {
  variant: 'desktop' | 'mobile'
  initialMode?: 'login' | 'register'
  onClose: () => void
}

export function AuthDialog({ variant, initialMode = 'register', onClose }: AuthDialogProps) {
  const { authConfig } = useSession()
  const [view, setView] = useState<DialogView>('providers')
  const [unavailableProvider, setUnavailableProvider] = useState<'Apple' | 'Facebook' | null>(null)

  const title = initialMode === 'login' ? 'Log in to play' : 'Sign up to play'

  return (
    <div className={`tg-dialog-scrim tg-dialog-scrim--${variant}`} role="presentation" onClick={onClose}>
      <div
        className={`tg-dialog tg-dialog--${variant}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        {view === 'providers' ? (
          <div className="tg-dialog-panel">
            <h2 className="tg-dialog-title">{title}</h2>

            <button
              type="button"
              className="tg-dialog-btn tg-dialog-btn--google"
              disabled={!authConfig?.googleAvailable}
              onClick={() => {
                window.location.href = googleSignInUrl()
              }}
            >
              <img src={googleLogo} alt="" />
              <span>Continue with Google</span>
            </button>

            <button type="button" className="tg-dialog-btn tg-dialog-btn--apple" onClick={() => setUnavailableProvider('Apple')}>
              <img src={appleLogo} alt="" />
              <span>Continue with Apple</span>
            </button>

            <button type="button" className="tg-dialog-btn tg-dialog-btn--facebook" onClick={() => setUnavailableProvider('Facebook')}>
              <img src={facebookLogo} alt="" />
              <span>Continue with Facebook</span>
            </button>

            <button type="button" className="tg-dialog-btn tg-dialog-btn--email" onClick={() => setView('email')}>
              <span>Continue with Email</span>
            </button>

            <div className="tg-dialog-divider-row">
              <span className="tg-dialog-divider" />
              <span className="tg-dialog-or">Or</span>
              <span className="tg-dialog-divider" />
            </div>

            <div className="tg-dialog-footer-row">
              <span className="tg-dialog-footer-text">
                {initialMode === 'login' ? "Don't have an account?" : 'Already have an account?'}
              </span>
              <button
                type="button"
                className="tg-dialog-login-pill"
                onClick={() => setView('email')}
              >
                {initialMode === 'login' ? 'Sign up' : 'Log in'}
              </button>
            </div>

            {unavailableProvider && (
              <UnavailableNotice>
                Signing in with {unavailableProvider} isn&apos;t available yet — TerraGuessr only supports Google and email sign-in today.
              </UnavailableNotice>
            )}

            <button type="button" className="tg-dialog-close" onClick={onClose} aria-label="Close">
              <img src={closeIcon} alt="" />
            </button>
          </div>
        ) : (
          <div className="tg-dialog-panel tg-dialog-panel--email">
            <div className="tg-dialog-email-header">
              <button type="button" className="tg-dialog-back" onClick={() => setView('providers')} aria-label="Back">
                <img src={backIcon} alt="" />
              </button>
              <button type="button" className="tg-dialog-close" onClick={onClose} aria-label="Close">
                <img src={closeIcon} alt="" />
              </button>
            </div>
            {view === 'email' ? (
              <EmailAuthForm
                initialMode={initialMode === 'login' ? 'login' : 'register'}
                onSuccess={onClose}
                onForgotPassword={() => setView('forgot')}
              />
            ) : (
              <ForgotPasswordForm onBack={() => setView('email')} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
