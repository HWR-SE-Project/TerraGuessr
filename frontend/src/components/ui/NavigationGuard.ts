import { useBlocker } from 'react-router-dom'

/** Router-owned blocking covers links, imperative routing and browser Back.
 * The caller owns the confirmation and finalizes its session before proceeding.
 */
export function useNavigationGuard(active: boolean) {
  return useBlocker(({ currentLocation, nextLocation }) =>
    active && currentLocation.pathname !== nextLocation.pathname,
  )
}
