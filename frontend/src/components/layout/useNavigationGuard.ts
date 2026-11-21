import { useEffect } from 'react'
import { useBlocker } from 'react-router-dom'

/** Router-owned blocking covers links, imperative routing and browser Back.
 * The caller owns the confirmation and finalizes its session before proceeding.
 */
export function useNavigationGuard(active: boolean) {
  useEffect(() => {
    if (!active) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [active])
  return useBlocker(({ currentLocation, nextLocation }) =>
    active && currentLocation.pathname !== nextLocation.pathname,
  )
}
