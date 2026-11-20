import { ConfirmDialog } from '../ConfirmDialog'
import { useNavigationGuard } from './NavigationGuard'

/** Confirmation for routes whose unsent answer exists only on the page.
 * Server-finalized Street View sessions use the same blocker with their
 * own End Game dialog and finalization request.
 */
export function LeaveGameGuard({ active, busy = false }: { active: boolean; busy?: boolean }) {
  const navigation = useNavigationGuard(active)
  if (navigation.state !== 'blocked') return null
  return <ConfirmDialog title="Leave this game?"
    description="Your current selection will be lost when you leave."
    cancelLabel="Keep Playing" confirmLabel="Leave Game" busy={busy}
    onCancel={navigation.reset} onConfirm={navigation.proceed} />
}
