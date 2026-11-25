import { api } from '../../services'
import { TokenConfirmation } from './TokenConfirmation'

async function verifyEmail(token: string) {
  await api.auth.verifyEmail(token)
  return 'Your email is verified. Welcome aboard!'
}

export function VerifyEmailPage() {
  return (
    <TokenConfirmation
      title="Email verification"
      loadingLabel="Verifying…"
      missingTokenMessage="This verification link is missing a token."
      confirm={verifyEmail}
      success={{ to: '/auth', label: 'Sign in' }}
      failure={{ to: '/auth', label: 'Back to sign in' }}
    />
  )
}
