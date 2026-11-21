import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { PageNavigation } from '../../components/ui/PageNavigation'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { InlineNotice } from '../../components/ui/InlineNotice'
import './HomePage.css'
import { HomeIcon } from './HomeIcon'
import { ResumeLobbyBanner } from './ResumeLobbyBanner'
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
  return (
    <Modal title="Not available yet" onClose={onClose} className="th-notice">
      <p>{message}</p>
      <Button className="th-notice-action" onClick={onClose} autoFocus>
        Got it
      </Button>
    </Modal>
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
      <div className="th-orbits" aria-hidden="true">
        <div className="th-orbit th-orbit-one" />
        <div className="th-orbit th-orbit-two" />
      </div>
      <PageNavigation />
      <HeroSection characterStatus={characterStatus} feetOffset={feetOffset} onEditAvatar={(button) => {
        editAvatarRef.current = button
        setAvatarFeedback('')
        setEditorOpen(true)
      }} />
      <ResumeLobbyBanner />
      {avatarFeedback && (
        <InlineNotice tone="success" className="th-toast">
          {avatarFeedback}
        </InlineNotice>
      )}
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
