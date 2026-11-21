import { Icon } from '../../components/ui/Icon'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AppHeader } from '../../components/layout/AppHeader'
import { InlineNotice } from '../../components/ui/InlineNotice'
import './HomePage.css'
import { ResumeLobbyBanner } from './ResumeLobbyBanner'
import { Home3DScene } from '../../scene/home/Home3DScene'
import type { CharacterStatus } from '../../scene/home/CharacterModel'
import { AvatarEditor } from '../../features/avatar/AvatarEditor'
import { useAvatarPersistence } from '../../features/avatar/useAvatarPersistence'
import { noticeVariants, staggerContainer, staggerItem } from '../../lib/motion'

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
    <motion.main
      className="th-hero"
      id="home-main"
      tabIndex={-1}
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <motion.div className="th-hero-copy" variants={staggerItem}>
        <h1>
          Explore the <span>World</span>
        </h1>
        <p className="th-description">
          Somewhere incredible. No idea where.
          <br className="th-desktop-break" /> Follow the clues. Find your place
          in the world.
        </p>
      </motion.div>
      <motion.div
        className="th-avatar-display"
        variants={staggerItem}
        style={{ '--feet-y': feetOffset == null ? undefined : `${feetOffset}px` } as CSSProperties}
      >
        <div className="th-character-slot" data-character-status={characterStatus}
          role="img" aria-label={characterStatus === 'ready' ? 'Your explorer, ready for the next discovery' : characterStatus === 'loading' ? 'Loading explorer avatar' : 'Explorer avatar unavailable'}>
          {characterStatus !== 'ready' && <span className="th-character-status" role="status">
            {characterStatus === 'loading' ? 'Loading avatar…' : 'Avatar unavailable'}
          </span>}
        </div>
        <button className="th-edit-avatar tg-control tg-action" type="button" aria-haspopup="dialog" onClick={event => onEditAvatar(event.currentTarget)}>
          <Icon name="pencil" /> Edit Avatar
        </button>
      </motion.div>
    </motion.main>
  )
}

export function HomePage() {
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
      <AppHeader />
      <HeroSection characterStatus={characterStatus} feetOffset={feetOffset} onEditAvatar={(button) => {
        editAvatarRef.current = button
        setAvatarFeedback('')
        setEditorOpen(true)
      }} />
      <ResumeLobbyBanner />
      <AnimatePresence>
        {avatarFeedback && (
          <motion.div
            key="avatar-feedback"
            variants={noticeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <InlineNotice tone="success" className="th-toast">
              {avatarFeedback}
            </InlineNotice>
          </motion.div>
        )}
      </AnimatePresence>
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
