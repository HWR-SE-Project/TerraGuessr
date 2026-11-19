import googleLogo from '../../assets/auth/google-logo.svg'
import appleLogo from '../../assets/auth/apple-logo.svg'
import facebookLogo from '../../assets/auth/facebook-logo.svg'
import closeIcon from '../../assets/auth/close-icon.svg'
import backIcon from '../../assets/auth/back-icon.svg'
import './AuthDialog.css'

interface AuthDialogProps {
  variant: 'desktop' | 'mobile'
  view: 'providers' | 'email'
  onClose: () => void
  onContinueWithEmail: () => void
  onBack: () => void
}

export function AuthDialog({ variant, view, onClose, onContinueWithEmail, onBack }: AuthDialogProps) {
  return (
    <div className={`tg-dialog-scrim tg-dialog-scrim--${variant}`} role="presentation" onClick={onClose}>
      <div
        className={`tg-dialog tg-dialog--${variant}`}
        role="dialog"
        aria-modal="true"
        aria-label={view === 'providers' ? 'Sign up to play' : 'Continue with email'}
        onClick={(e) => e.stopPropagation()}
      >
        {view === 'providers' ? (
          <div className="tg-dialog-panel">
            <h2 className="tg-dialog-title">Sign up to play</h2>

            <button type="button" className="tg-dialog-btn tg-dialog-btn--google">
              <img src={googleLogo} alt="" />
              <span>Continue with Google</span>
            </button>

            <button type="button" className="tg-dialog-btn tg-dialog-btn--apple">
              <img src={appleLogo} alt="" />
              <span>Continue with Apple</span>
            </button>

            <button type="button" className="tg-dialog-btn tg-dialog-btn--facebook">
              <img src={facebookLogo} alt="" />
              <span>Continue with Facebook</span>
            </button>

            <button type="button" className="tg-dialog-btn tg-dialog-btn--email" onClick={onContinueWithEmail}>
              <span>Continue with Email</span>
            </button>

            <div className="tg-dialog-divider-row">
              <span className="tg-dialog-divider" />
              <span className="tg-dialog-or">Or</span>
              <span className="tg-dialog-divider" />
            </div>

            <div className="tg-dialog-footer-row">
              <span className="tg-dialog-footer-text">Already have an account?</span>
              <button type="button" className="tg-dialog-login-pill">
                Log in
              </button>
            </div>

            <button type="button" className="tg-dialog-close" onClick={onClose} aria-label="Close">
              <img src={closeIcon} alt="" />
            </button>
          </div>
        ) : (
          <div className="tg-dialog-panel tg-dialog-panel--email">
            <div className="tg-dialog-email-header">
              <button type="button" className="tg-dialog-back" onClick={onBack} aria-label="Back">
                <img src={backIcon} alt="" />
              </button>
              <div className="tg-dialog-email-title-placeholder" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
