import { api } from '../../services'
import { TokenConfirmation } from './TokenConfirmation'

async function confirmEmailChange(token: string) {
  const result = await api.auth.confirmEmailChange(token)
  return result.changed && result.email
    ? `Your email is now ${result.email}.`
    : 'Your email address has been confirmed.'
}

export function EmailChangePage() {
  const account = { to: '/account', label: 'Back to account' }
  return (
    <TokenConfirmation
      title="Confirm email change"
      loadingLabel="Confirming…"
      missingTokenMessage="This confirmation link is missing a token."
      confirm={confirmEmailChange}
      success={account}
      failure={account}
    />
  )
}
