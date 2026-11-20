import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { GameModeCard } from '../../components/ui/GameModeCard'
import { PageNavigation } from '../../components/ui/PageNavigation'
import './HomePage.css'
import './TutorialEntry.css'
import { HomeIcon } from './HomeIcon'
import { Home3DScene } from './scene/Home3DScene'
import type { CharacterStatus } from './scene/CharacterModel'
import { AvatarEditor } from '../../features/avatar/AvatarEditor'
import { useAvatarPersistence } from '../../features/avatar/useAvatarPersistence'

function HeroSection({
  characterStatus,
  onEditAvatar,
  feetOffset,
}: {
  characterStatus: CharacterStatus
  onEditAvatar: (button: HTMLButtonElement) => void
  feetOffset: number | null
}) {
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
      <div className="th-avatar-display" style={{ '--feet-y': feetOffset == null ? undefined : `${feetOffset}px` } as CSSProperties}>
        <div className="th-character-slot" data-character-status={characterStatus}
          role="img" aria-label={characterStatus === 'ready' ? 'Your explorer, ready for the next discovery' : characterStatus === 'loading' ? 'Loading explorer avatar' : 'Explorer avatar unavailable'}>
          {characterStatus !== 'ready' && <span className="th-character-status" role="status">
            {characterStatus === 'loading' ? 'Loading avatar…' : 'Avatar unavailable'}
          </span>}
        </div>
        <button className="th-edit-avatar tg-control tg-action" type="button" aria-haspopup="dialog" onClick={event => onEditAvatar(event.currentTarget)}>
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
  const [feetOffset, setFeetOffset] = useState<number | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [avatarFeedback, setAvatarFeedback] = useState('')
  const avatar = useAvatarPersistence()
  useEffect(() => {
    if (!avatarFeedback) return
    const timeout = window.setTimeout(() => setAvatarFeedback(''), 5000)
    return () => window.clearTimeout(timeout)
  }, [avatarFeedback])
  const editAvatarRef = useRef<HTMLElement | null>(null)
  return (
    <div className="th-home">
      <a className="th-skip" href="#home-main">
        Skip to content
      </a>
      <Home3DScene onCharacterStatus={setCharacterStatus} onFeetOffset={setFeetOffset} />
      <div className="th-orbit th-orbit-one" aria-hidden="true" />
      <div className="th-orbit th-orbit-two" aria-hidden="true" />
      <PageNavigation active="none" />
      <HeroSection characterStatus={characterStatus} feetOffset={feetOffset} onEditAvatar={(button) => {
        editAvatarRef.current = button
        setAvatarFeedback('')
        setEditorOpen(true)
      }} />
      <section className="th-actions">
        <Link className="th-tutorial-entry" to="/game/singleplayer?tutorial=1">
          <HomeIcon name="info" /> How to Play / Tutorial
        </Link>
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
      </section>
      {avatarFeedback && <div className="ae-home-toast" role="status">{avatarFeedback}</div>}
      {editorOpen && <AvatarEditor key={avatar.identity} initialConfig={avatar.config} account={avatar.account}
        loading={avatar.loading} loadError={avatar.error} onRetry={avatar.retry} onSave={avatar.save}
        onClose={(saved) => {
          setEditorOpen(false)
          if (saved) setAvatarFeedback(avatar.account ? 'Avatar saved to your account.' : 'Avatar saved on this device.')
          editAvatarRef.current?.focus()
        }} />}

    </div>
  )
}
