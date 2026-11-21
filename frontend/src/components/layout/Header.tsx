import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Logo, LogoMark } from '../ui/Logo'
import { Button, IconButton } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { Dropdown } from '../ui/Dropdown'
import { useSession, signOut } from '../../state/session'
import { hueFromString, initials } from '../../lib/format'

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/singleplayer', label: 'Play' },
  { to: '/multiplayer', label: 'Multiplayer' },
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
  const [mobileOpen, setMobileOpen] = useState(false)
  const user = session.user

  return (
    <header className="sticky top-0 z-40">
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
          <IconButton
            name="settings"
            label="Settings"
            onClick={() => navigate('/settings')}
            className="hidden sm:inline-flex"
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
                  <Icon name="chevronDown" size={16} className="hidden text-subtle sm:block" />
                </button>
              )}
              items={[
                { key: 'avatar', label: 'Customize avatar', icon: <Icon name="person" size={18} />, onSelect: () => navigate('/avatar') },
                { key: 'settings', label: 'Settings', icon: <Icon name="settings" size={18} />, onSelect: () => navigate('/settings') },
                { key: 'logout', label: 'Sign out', icon: <Icon name="exit" size={18} />, danger: true, onSelect: () => void signOut() },
              ]}
            />
          ) : (
            <Button size="sm" icon="person" onClick={() => navigate('/auth')} className="hidden sm:inline-flex">
              Sign in
            </Button>
          )}
          <IconButton name="menu" label="Menu" onClick={() => setMobileOpen(true)} className="md:hidden" />
        </div>
      </div>

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
              className="absolute right-0 top-0 flex h-full w-72 max-w-[85vw] flex-col bg-space-800 p-5 pt-safe"
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
              <div className="mt-auto flex flex-col gap-2 pb-safe">
                {user ? (
                  <>
                    <Link
                      to="/avatar"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 rounded-2xl px-4 py-3 hover:bg-white/6"
                    >
                      <AvatarBubble name={user.displayName} />
                      <span className="flex-1">
                        <span className="block font-bold text-cream">{user.displayName}</span>
                        <span className="block text-sm text-subtle">{user.email}</span>
                      </span>
                    </Link>
                    <Button variant="secondary" icon="settings" to="/settings" onClick={() => setMobileOpen(false)}>
                      Settings
                    </Button>
                    <Button variant="ghost" icon="exit" onClick={() => { setMobileOpen(false); void signOut() }}>
                      Sign out
                    </Button>
                  </>
                ) : (
                  <Button icon="person" onClick={() => { setMobileOpen(false); navigate('/auth') }}>
                    Sign in or create account
                  </Button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
