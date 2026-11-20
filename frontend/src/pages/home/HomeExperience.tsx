import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { GameModeCard } from '../../components/ui/GameModeCard'
import { PageNavigation } from '../../components/ui/PageNavigation'
import './HomePage.css'
import { HomeIcon } from './HomeIcon'
import { ResumeGameBanner } from './ResumeGameBanner'
import { Home3DScene } from './scene/Home3DScene'
import type { CharacterStatus } from './scene/CharacterModel'

function HeroSection({
  characterStatus,
  onEditAvatar,
  feetPixelY,
}: {
  characterStatus: CharacterStatus
  onEditAvatar: () => void
  feetPixelY: number | null
}) {
  const avatarRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Anchor the button to the character's *actual* measured sole-contact line
  // (reported by the 3D scene in viewport pixels), not a fixed CSS offset —
  // so it stays glued to the feet regardless of breakpoint or how the globe
  // happens to be scaled. `feetPixelY` is the exact lowest rendered pixel of
  // the model (see CharacterModel's onFeetPixelY), so placing the button's
  // top edge this many px *above* that line makes the button's own top band
  // visually cover that same strip of shoe/lower-leg pixels — by design, a
  // deliberate overlap rather than the button resting just below the feet.
  useLayoutEffect(() => {
    const avatar = avatarRef.current
    const button = buttonRef.current
    if (!avatar || !button || feetPixelY == null) return
    const avatarTop = avatar.getBoundingClientRect().top
    const BUTTON_FEET_OVERLAP_PX = 12
    button.style.top = `${feetPixelY - avatarTop - BUTTON_FEET_OVERLAP_PX}px`
    button.style.bottom = 'auto'
  }, [feetPixelY])

  return (
    <main className="th-hero" id="home-main" tabIndex={-1}>
      <div className="th-hero-copy">
        <h1>
          Explore the <span>World</span>
        </h1>
        <p className="th-description">
          Somewhere incredible. No idea where.
          <br className="th-desktop-break" /> Follow the clues. Find your place
          in the world.
        </p>
      </div>
      <div className="th-avatar-display" ref={avatarRef}>
        <div className="th-character-slot" data-character-status={characterStatus}
          role="img" aria-label={characterStatus === 'ready' ? 'Your explorer, ready for the next discovery' : characterStatus === 'loading' ? 'Loading explorer avatar' : 'Explorer avatar unavailable'}>
          {characterStatus !== 'ready' && <span className="th-character-status" role="status">
            {characterStatus === 'loading' ? 'Loading avatar…' : 'Avatar unavailable'}
          </span>}
        </div>
        <button ref={buttonRef} className="th-edit-avatar tg-control tg-action" type="button" aria-haspopup="dialog" onClick={onEditAvatar}>
          <HomeIcon name="pencil" /> Edit Avatar
        </button>
      </div>
    </main>
  )
}

export function AvailabilityNotice({
  message,
  onClose,
}: {
  message: string
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  const close = () => ref.current?.close()
  return (
    <dialog
      ref={ref}
      className="th-notice"
      aria-labelledby="th-notice-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <button
        className="th-notice-close tg-control"
        type="button"
        aria-label="Close notice"
        onClick={close}
      >
        <HomeIcon name="close" />
      </button>
      <h2 id="th-notice-title">Not available yet</h2>
      <p>{message}</p>
      <button
        type="button"
        className="th-notice-action tg-control tg-control--primary"
        onClick={close}
        autoFocus
      >
        Got it
      </button>
    </dialog>
  )
}

export function HomeExperience() {
  const [characterStatus, setCharacterStatus] = useState<CharacterStatus>('loading')
  const [feetPixelY, setFeetPixelY] = useState<number | null>(null)
  const [notice, setNotice] = useState(false)
  const editAvatarRef = useRef<HTMLElement | null>(null)
  return (
    <div className="th-home">
      <a className="th-skip" href="#home-main">
        Skip to content
      </a>
      <Home3DScene onCharacterStatus={setCharacterStatus} onFeetPixelY={setFeetPixelY} />
      <div className="th-orbit th-orbit-one" aria-hidden="true" />
      <div className="th-orbit th-orbit-two" aria-hidden="true" />
      <PageNavigation active="none" />
      <HeroSection characterStatus={characterStatus} feetPixelY={feetPixelY} onEditAvatar={() => {
        editAvatarRef.current = document.activeElement as HTMLElement
        setNotice(true)
      }} />
      <ResumeGameBanner />
      <nav className="th-game-modes" aria-label="Game modes">
        <GameModeCard
          to="/game/singleplayer"
          icon="play"
          title="Play Solo"
          subtitle="Challenge yourself"
          primary
        />
        <GameModeCard
          to="/multiplayer"
          icon="users"
          title="Play Together"
          subtitle="With friends"
        />
        <GameModeCard
          to="/duels"
          icon="trophy"
          title="Compete"
          subtitle="Climb the leaderboards"
        />
      </nav>
      {notice && <AvailabilityNotice message="Avatar customization is not available yet." onClose={() => {
        setNotice(false)
        editAvatarRef.current?.focus()
      }} />}
    </div>
  )
}
