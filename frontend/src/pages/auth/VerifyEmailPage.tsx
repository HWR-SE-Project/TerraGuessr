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
      success={{ to: '/', label: 'Continue exploring' }}
      failure={{ to: '/auth', label: 'Back to sign in' }}
    />
  )
}
