import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { HomeIcon } from '../../pages/home/HomeIcon'

const options = [
  { mode: 'create', title: 'Create a Lobby', description: 'Start a new game with friends.', icon: 'users' },
  { mode: 'join', title: 'Join a Lobby', description: 'Enter an existing lobby using a code.', icon: 'gamepad' },
] as const

/** A menu button with native links, arrow-key navigation and no focus trap. */
export function MultiplayerMenu({ mobileMenuOpen, onNavigate }: {
  mobileMenuOpen: boolean
  onNavigate: () => void
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const location = useLocation()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([])
  const initialFocus = useRef(0)
  const active = location.pathname.startsWith('/multiplayer') || location.pathname.startsWith('/lobby')

  // Also reset on browser Back and when the containing mobile navigation closes.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setOpen(false)
  }, [location, mobileMenuOpen])

  useEffect(() => {
    if (!open) return
    itemRefs.current[initialFocus.current]?.focus()
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false)
    }
    window.addEventListener('pointerdown', outside)
    return () => window.removeEventListener('pointerdown', outside)
  }, [open])

  function show(index = 0) {
    initialFocus.current = index
    setOpen(true)
    if (open) itemRefs.current[index]?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      triggerRef.current?.focus()
      return
    }
    if (!open || event.target === triggerRef.current) return
    if (event.key === 'Tab') {
      setOpen(false)
      triggerRef.current?.focus()
      // Forward Tab continues to the next navigation control; Shift+Tab
      // returns to the menu button instead of entering the popup again.
      if (event.shiftKey) event.preventDefault()
      return
    }
    const current = itemRefs.current.findIndex(item => item === document.activeElement)
    let next: number
    switch (event.key) {
      case 'ArrowDown': next = (current + 1) % options.length; break
      case 'ArrowUp': next = (current - 1 + options.length) % options.length; break
      case 'Home': next = 0; break
      case 'End': next = options.length - 1; break
      case ' ': event.preventDefault(); itemRefs.current[current]?.click(); return
      default: {
        const match = options.findIndex(option => option.title.toLowerCase().startsWith(event.key.toLowerCase()))
        if (event.key.length !== 1 || event.altKey || event.ctrlKey || event.metaKey || match < 0) return
        next = match
      }
    }
    event.preventDefault()
    itemRefs.current[next]?.focus()
  }

  return <div ref={rootRef} className="th-multiplayer" onKeyDown={handleKeyDown}
    onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
    }}>
    <button ref={triggerRef} type="button" className="th-nav-link th-multiplayer-trigger"
      id={`${id}-trigger`} aria-haspopup="menu" aria-expanded={open} aria-controls={`${id}-menu`}
      aria-current={active ? 'page' : undefined}
      onClick={() => open ? setOpen(false) : show()}
      onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          show(event.key === 'ArrowUp' ? options.length - 1 : 0)
        }
      }}>
      Multiplayer <HomeIcon name="chevron" className="th-multiplayer-chevron" />
    </button>
    <div id={`${id}-menu`} className={`th-multiplayer-menu${open ? ' th-multiplayer-menu-open' : ''}`}
      role="menu" aria-labelledby={`${id}-trigger`} aria-hidden={!open} inert={!open}>
      {options.map((option, index) => <Link key={option.mode} to={`/multiplayer/${option.mode}`}
        ref={element => { itemRefs.current[index] = element }} role="menuitem" tabIndex={-1}
        className="th-multiplayer-option" aria-labelledby={`${id}-${option.mode}-title`}
        aria-describedby={`${id}-${option.mode}-description`}
        onClick={() => { setOpen(false); onNavigate() }}>
        <span className="th-multiplayer-icon"><HomeIcon name={option.icon} /></span>
        <span className="th-multiplayer-copy">
          <span id={`${id}-${option.mode}-title`} className="th-multiplayer-title">{option.title}</span>
          <span id={`${id}-${option.mode}-description`} className="th-multiplayer-description">{option.description}</span>
        </span>
        <HomeIcon name="arrow" className="th-multiplayer-arrow" />
      </Link>)}
    </div>
  </div>
}
