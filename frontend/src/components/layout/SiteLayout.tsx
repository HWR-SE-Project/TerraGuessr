import { useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CosmicBackground } from '../../scene/CosmicBackground'
import { Header } from './Header'
import { initSession } from '../../state/session'
import { hydratePreferences } from '../../state/preferences'
import { loadAvatar } from '../../state/avatar'
import { useSession } from '../../state/session'

// Pages that already render their own inline privacy link or full privacy
// content skip the shared footer to avoid visual duplication.
const HIDE_FOOTER_PATHS = new Set(['/privacy', '/auth', '/settings', '/account'])

export function SiteLayout() {
  const location = useLocation()
  const session = useSession()
  const showFooter = !HIDE_FOOTER_PATHS.has(location.pathname)

  // One-time bootstrap: load the session, then hydrate preferences/avatar.
  useEffect(() => {
    void initSession()
  }, [])

  useEffect(() => {
    if (session.status === 'loading') return
    hydratePreferences(session.status === 'authed', session.preferences)
    void loadAvatar(session.status === 'authed')
  }, [session.status, session.user?.id, session.preferences])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [location.pathname])

  return (
    <div className="relative flex min-h-dvh flex-col">
      <CosmicBackground />
      <Header />
      <main className="relative flex-1">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
        >
          <Outlet />
        </motion.div>
      </main>
      {showFooter && (
        <footer className="relative flex h-10 items-center justify-center px-4 pb-[env(safe-area-inset-bottom)] text-xs text-subtle/75 sm:px-6">
          <Link
            to="/privacy"
            className="font-semibold transition-colors hover:text-cream hover:underline hover:underline-offset-4"
          >
            Data &amp; privacy
          </Link>
        </footer>
      )}
    </div>
  )
}
