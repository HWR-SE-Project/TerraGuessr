import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Logo, LogoMark } from '../ui/Logo'
import { Button, IconButton } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { Dropdown } from '../ui/Dropdown'
import { useSession, signOut } from '../../state/session'
import { hueFromString, initials } from '../../lib/format'

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/singleplayer', label: 'Singleplayer' },
  { to: '/multiplayer', label: 'Multiplayer' },
  { to: '/stats', label: 'Stats' },
  { to: '/how-to-play', label: 'How to play' },
]

function AvatarBubble({ name, size = 36 }: { name: string; size?: number }) {
  const hue = hueFromString(name)
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-display font-semibold text-ink"
      style={{ width: size, height: size, background: `hsl(${hue} 70% 72%)`, fontSize: size * 0.4 }}
    >
      {initials(name)}
    </span>
  )
}

export function Header() {
  const session = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const user = session.user
  const onSettings = location.pathname === '/settings'
  const toggleSettings = () => (onSettings ? navigate(-1) : navigate('/settings'))

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [mobileOpen])

  return (
    <header
      className={`sticky top-0 z-40 isolate transition-[background-color,backdrop-filter,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        scrolled
          ? 'bg-space-950/75 backdrop-blur-md shadow-[0_1px_0_0_rgba(255,255,255,0.06),0_8px_24px_-4px_rgba(5,3,16,0.45)]'
          : 'bg-transparent backdrop-blur-0 shadow-none'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Logo />

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                  isActive ? 'bg-lime-400/15 text-lime-300' : 'text-muted hover:bg-white/6 hover:text-cream'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="hidden items-center gap-2 md:flex">
            <IconButton
              name="settings"
              label={onSettings ? 'Close settings' : 'Settings'}
              onClick={toggleSettings}
            />
            {user ? (
              <Dropdown
                align="end"
                trigger={({ toggle, ref }) => (
                  <button
                    ref={ref}
                    onClick={toggle}
                    className="flex items-center gap-2 rounded-full p-1 pr-1 transition-colors hover:bg-white/6"
                    aria-label="Account menu"
                  >
                    <AvatarBubble name={user.displayName} />
                    <Icon name="chevronDown" size={16} className="text-subtle" />
                  </button>
                )}
                items={[
                  { key: 'account', label: 'Account', icon: <Icon name="person" size={18} />, onSelect: () => navigate('/account') },
                  { key: 'avatar', label: 'Customize avatar', icon: <Icon name="sparkle" size={18} />, onSelect: () => navigate('/avatar') },
                  { key: 'logout', label: 'Sign out', icon: <Icon name="exit" size={18} />, danger: true, onSelect: () => void signOut() },
                ]}
              />
            ) : (
              <Button size="sm" icon="person" onClick={() => navigate('/auth')}>
                Sign in
              </Button>
            )}
          </div>
          <IconButton name="menu" label="Menu" onClick={() => setMobileOpen(true)} className="md:hidden" />
        </div>
      </div>

      {/* Portal the mobile drawer to document.body so header's scrolled backdrop-filter
          never traps position:fixed inside the 64px header bar. */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {mobileOpen && (
              <motion.div
                className="fixed inset-0 z-50 md:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="absolute inset-0 bg-space-950/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                  className="absolute right-0 top-0 flex h-dvh w-72 max-w-[85vw] flex-col overflow-y-auto bg-space-800 p-5 pt-safe shadow-panel"
                >
                  <div className="flex items-center justify-between">
                    <LogoMark />
                    <IconButton name="close" label="Close menu" onClick={() => setMobileOpen(false)} />
                  </div>
                  <nav className="mt-8 flex flex-col gap-1" aria-label="Mobile">
                    {NAV.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-3 rounded-2xl px-4 py-3 text-lg font-bold ${
                            isActive ? 'bg-lime-400/15 text-lime-300' : 'text-cream hover:bg-white/6'
                          }`
                        }
                      >
                        {item.label}
                      </NavLink>
                    ))}
                  </nav>
                  <div className="mt-auto flex flex-col gap-2 pt-6 pb-safe">
                    {user ? (
                      <>
                        <Link
                          to="/account"
                          onClick={() => setMobileOpen(false)}
                          className="flex items-center gap-3 rounded-2xl px-4 py-3 hover:bg-white/6"
                        >
                          <AvatarBubble name={user.displayName} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-bold text-cream">{user.displayName}</span>
                            <span className="block truncate text-sm text-subtle">{user.email}</span>
                          </span>
                        </Link>
                        <Button
                          variant="secondary"
                          icon="sparkle"
                          onClick={() => {
                            setMobileOpen(false)
                            navigate('/avatar')
                          }}
                        >
                          Customize avatar
                        </Button>
                        <Button
                          variant="secondary"
                          icon="settings"
                          onClick={() => {
                            setMobileOpen(false)
                            toggleSettings()
                          }}
                        >
                          {onSettings ? 'Close settings' : 'Settings'}
                        </Button>
                        <Button variant="ghost" icon="exit" onClick={() => { setMobileOpen(false); void signOut() }}>
                          Sign out
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="secondary"
                          icon="settings"
                          onClick={() => {
                            setMobileOpen(false)
                            toggleSettings()
                          }}
                        >
                          {onSettings ? 'Close settings' : 'Settings'}
                        </Button>
                        <Button icon="person" onClick={() => { setMobileOpen(false); navigate('/auth') }}>
                          Sign in or create account
                        </Button>
                      </>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </header>
  )
}
