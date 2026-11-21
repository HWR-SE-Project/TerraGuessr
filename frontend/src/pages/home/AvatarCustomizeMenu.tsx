import { Button } from '../../components/ui/Button'

/** A centered scene control that keeps the explorer and planet unobstructed. */
export function AvatarCustomizeMenu() {
  return (
    <Button to="/avatar" variant="secondary" icon="person" size="sm">
      Edit avatar
    </Button>
  )
}
