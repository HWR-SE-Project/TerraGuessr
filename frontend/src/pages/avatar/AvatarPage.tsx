import { lazy, Suspense, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Button, IconButton, Spinner } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import type { IconName } from '../../components/ui/Icon'
import { SectionErrorBoundary } from '../../components/layout/ErrorFallback'
import { useSession } from '../../state/session'
import { useAvatar, saveAvatar, AVATAR_PALETTE } from '../../state/avatar'
import type { AvatarPart } from '../../lib/contracts'
import { spring } from '../../lib/motion'

const AvatarPreview = lazy(() =>
  import('../../scene/AvatarPreview').then((m) => ({ default: m.AvatarPreview })),
)

type Category = 'hair' | 'face' | 'outfit'

const CATEGORIES: { id: Category; label: string; icon: IconName; parts: AvatarPart[] }[] = [
  { id: 'hair', label: 'Hair', icon: 'sparkle', parts: ['hairColor'] },
  { id: 'face', label: 'Face', icon: 'face', parts: ['eyeColor'] },
  { id: 'outfit', label: 'Outfit', icon: 'shirt', parts: ['shirtColor', 'pantsColor', 'shoeColor'] },
]

const PART_LABELS: Record<AvatarPart, string> = {
  hairColor: 'Hair & brows',
  eyeColor: 'Eyes',
  shirtColor: 'Shirt',
  pantsColor: 'Shorts',
  shoeColor: 'Slippers',
}

export function AvatarPage() {
  const navigate = useNavigate()
  const session = useSession()
  const saved = useAvatar()
  const authed = session.status === 'authed'

  const [draft, setDraft] = useState(saved)
  const [category, setCategory] = useState<Category>('hair')
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState(false)
  // Let SiteLayout's 360ms route enter transition finish before mounting WebGL
  // so shader compilation never stalls the slide animation mid-flight.
  const [previewReady, setPreviewReady] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setPreviewReady(true), 360)
    return () => window.clearTimeout(timer)
  }, [])

  const active = CATEGORIES.find((c) => c.id === category)!
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)

  function setPart(part: AvatarPart, value: string | null) {
    setDraft((prev) => ({ ...prev, [part]: value }))
  }

  async function save() {
    setSaving(true)
    await saveAvatar(draft, authed)
    setSaving(false)
    setSavedMessage(true)
    window.setTimeout(() => setSavedMessage(false), 1600)
  }

  return (
    <div className="relative mx-auto flex h-[calc(100dvh-4rem)] max-w-5xl flex-col overflow-hidden px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:block md:h-auto md:overflow-visible md:px-6 md:pt-6 md:pb-12 lg:pt-8">
      {/* Ambient background glow — echoes the cosmic hero without competing with the character. */}
      <div aria-hidden className="pointer-events-none absolute -left-16 top-4 size-64 rounded-full bg-violet-400/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-12 top-52 size-72 rounded-full bg-lime-400/8 blur-3xl" />

      <div className="relative flex min-h-0 flex-1 flex-col gap-3 md:gap-5">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5 md:gap-3">
            <IconButton name="chevronLeft" label="Back" variant="solid" size="sm" onClick={() => navigate(-1)} className="md:size-11" />
            <div className="min-w-0">
              <p className="eyebrow hidden md:block">Avatar editor</p>
              <h1 className="truncate font-display text-lg font-semibold text-cream md:text-2xl lg:text-3xl">Style your explorer</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 md:hidden">
            <AnimatePresence>{savedMessage && <SavedBadge />}</AnimatePresence>
            {dirty && !savedMessage && (
              <span className="rounded-full bg-lime-400/15 px-2.5 py-1 text-[11px] font-bold text-lime-300">
                Unsaved
              </span>
            )}
          </div>
          <div className="hidden items-center gap-2.5 md:flex">
            <AnimatePresence>{savedMessage && <SavedBadge />}</AnimatePresence>
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button icon="check" loading={saving} onClick={save} disabled={!dirty}>
              Save
            </Button>
          </div>
        </div>

        {/* Stage + Controls: pinned split-studio on phones, 2-column on tablets/desktop */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:items-start md:gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          {/* 3D Preview Stage */}
          <div className="surface relative h-[34dvh] min-h-[190px] max-h-[290px] shrink-0 overflow-hidden md:sticky md:top-24 md:h-[460px] md:max-h-none lg:h-[500px]">
            <div
              className="absolute inset-0"
              style={{ background: 'radial-gradient(85% 70% at 50% 28%, #342a5c 0%, #1a1636 65%, #140f2a 100%)' }}
            />
            {/* Floor glow reinforcing the WebGL contact shadow below the character's feet. */}
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-1/3"
              style={{ background: 'radial-gradient(60% 100% at 50% 100%, rgba(192,246,107,0.1) 0%, transparent 70%)' }}
            />
            <Icon name="sparkle" size={16} className="animate-twinkle absolute left-5 top-5 text-lime-300/70 md:left-6 md:top-8" />
            <Icon name="sparkle" size={12} className="animate-float absolute right-8 top-10 text-sky-300/60 md:right-10 md:top-16" />
            <Icon name="sparkle" size={14} className="animate-float-slow absolute right-12 top-24 text-violet-300/50 md:right-16 md:top-32" />

            <div className="absolute inset-0">
              {previewReady ? (
                <SectionErrorBoundary
                  name="AvatarPreview"
                  fallback={
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
                      <Icon name="person" size={32} className="text-subtle" />
                      <p className="font-display text-sm font-semibold text-cream">3D preview unavailable</p>
                      <p className="max-w-xs text-xs text-muted">
                        You can still pick colors below and save your explorer.
                      </p>
                    </div>
                  }
                >
                  <Suspense
                    fallback={
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Spinner className="size-8 text-subtle" />
                      </div>
                    }
                  >
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.25 }}
                      className="h-full w-full"
                    >
                      <AvatarPreview config={draft} />
                    </motion.div>
                  </Suspense>
                </SectionErrorBoundary>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Spinner className="size-8 text-subtle" />
                </div>
              )}
            </div>

            <div className="pointer-events-none absolute inset-x-3 bottom-3 hidden items-center justify-between gap-2 md:inset-x-4 md:bottom-4 md:flex">
              <span className="rounded-full bg-space-900/70 px-3 py-1.5 text-xs font-bold text-muted backdrop-blur-sm">
                {authed ? 'Saved to your account' : 'Saved on this device'}
              </span>
              {dirty && (
                <motion.span
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-full bg-lime-400/15 px-3 py-1.5 text-xs font-bold text-lime-300"
                >
                  Unsaved changes
                </motion.span>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="surface flex min-h-0 flex-1 flex-col overflow-hidden p-3.5 md:overflow-visible md:p-6">
            <div className="relative grid shrink-0 grid-cols-3 gap-1 rounded-2xl bg-space-800 p-1">
              {CATEGORIES.map((c) => {
                const isActive = category === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    className={`relative flex items-center justify-center rounded-xl py-2 text-xs font-bold transition-colors md:py-3 md:text-sm ${
                      isActive ? 'text-ink' : 'text-subtle hover:text-cream'
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="avatar-tab-bg"
                        className="absolute inset-0 rounded-xl bg-lime-400"
                        transition={spring.snappy}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5 md:gap-2">
                      <Icon name={c.icon} size={15} />
                      {c.label}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="scroll-thin mt-3.5 min-h-0 flex-1 overflow-y-auto pr-0.5 md:mt-5 md:overflow-visible md:pr-0">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={category}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col gap-4 md:gap-5"
                >
                  {active.parts.map((part) => (
                    <PartEditor key={part} part={part} value={draft[part]} onChange={(value) => setPart(part, value)} />
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>

            <p className="hairline-t mt-5 hidden pt-4 text-xs leading-relaxed text-subtle md:block">
              <Icon name="info" size={13} className="mr-1 inline-block align-text-bottom text-subtle" />
              Colors preview instantly on your explorer — hit <span className="font-bold text-cream">Save</span> to
              keep them.
            </p>
          </div>
        </div>

        {/* Mobile bottom actions — part of the flex layout so it never overlaps swatches */}
        <div className="flex shrink-0 items-center gap-2.5 md:hidden">
          <Button variant="secondary" fullWidth onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button icon="check" fullWidth loading={saving} onClick={save} disabled={!dirty}>
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

function SavedBadge() {
  return (
    <motion.span
      initial={{ opacity: 0, y: 4, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.95 }}
      className="flex items-center gap-1.5 text-xs font-bold text-lime-300 md:text-sm"
    >
      <Icon name="check" size={15} />
      Saved
    </motion.span>
  )
}

function PartEditor({
  part,
  value,
  onChange,
}: {
  part: AvatarPart
  value: string | null
  onChange: (value: string | null) => void
}) {
  const customSelected = value != null && !AVATAR_PALETTE.some((c) => c.value === value)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-display text-sm font-semibold text-cream">{PART_LABELS[part]}</span>
        {value && <span className="text-xs font-bold text-subtle">Custom</span>}
      </div>
      {/* 14 swatches (reset + 12 palette + custom) = 2 balanced rows of 7 on phones */}
      <div className="grid grid-cols-7 justify-items-center gap-2 md:flex md:flex-wrap md:gap-2.5">
        <Swatch
          selected={value == null}
          label={`${PART_LABELS[part]} original color`}
          onClick={() => onChange(null)}
        >
          <Icon name="refresh" size={14} className="text-subtle" />
        </Swatch>

        {AVATAR_PALETTE.map((color) => (
          <Swatch
            key={color.value}
            selected={value === color.value}
            label={`${PART_LABELS[part]} ${color.name}`}
            background={color.value}
            onClick={() => onChange(color.value)}
          />
        ))}

        <CustomSwatch label={PART_LABELS[part]} value={value} selected={customSelected} onChange={onChange} />
      </div>
    </div>
  )
}

function Swatch({
  selected,
  label,
  background,
  onClick,
  children,
}: {
  selected: boolean
  label: string
  background?: string
  onClick: () => void
  children?: React.ReactNode
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      title={label}
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.12 }}
      transition={spring.snappy}
      className={`relative flex size-9 items-center justify-center rounded-full border-2 md:size-10 ${
        selected ? 'border-lime-400 shadow-[0_0_0_3px_rgba(192,246,107,0.25)]' : 'border-white/15 hover:border-white/35'
      }`}
      style={background ? { background } : undefined}
    >
      {!selected && children}
      <AnimatePresence>
        {selected && (
          <motion.span
            key="check"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={spring.snappy}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Icon name="check" size={14} className={background ? 'text-white drop-shadow' : 'text-lime-300'} />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  )
}

function CustomSwatch({
  label,
  value,
  selected,
  onChange,
}: {
  label: string
  value: string | null
  selected: boolean
  onChange: (value: string) => void
}) {
  return (
    <motion.div
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.12 }}
      transition={spring.snappy}
      className={`relative flex size-9 items-center justify-center rounded-full border-2 md:size-10 ${
        selected ? 'border-lime-400 shadow-[0_0_0_3px_rgba(192,246,107,0.25)]' : 'border-white/15 hover:border-white/35'
      }`}
      style={{
        background: selected
          ? (value ?? undefined)
          : 'conic-gradient(from 90deg, #f27f88, #ffb45e, #d7ff96, #57c4e8, #9d7dff, #f27f88)',
      }}
    >
      <input
        type="color"
        value={value ?? '#895236'}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
        aria-label={`${label} custom color`}
      />
      <Icon
        name={selected ? 'check' : 'plus'}
        size={14}
        className={`pointer-events-none ${selected ? 'text-white drop-shadow' : 'text-ink/80'}`}
      />
    </motion.div>
  )
}
