import { lazy, Suspense, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Button, IconButton, Spinner } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import type { IconName } from '../../components/ui/Icon'
import { useSession } from '../../state/session'
import { useAvatar, saveAvatar, AVATAR_PALETTE } from '../../state/avatar'
import type { AvatarPart } from '../../lib/contracts'
import { fadeUp, spring, staggerContainer, staggerItem } from '../../lib/motion'

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
    <div className="relative mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-6 sm:pb-12 sm:pt-8">
      {/* Ambient background glow — echoes the cosmic hero without competing with the character. */}
      <div aria-hidden className="pointer-events-none absolute -left-16 top-4 size-64 rounded-full bg-violet-400/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-12 top-52 size-72 rounded-full bg-lime-400/8 blur-3xl" />

      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="relative flex flex-col gap-5">
        {/* Header */}
        <motion.div variants={staggerItem} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <IconButton name="chevronLeft" label="Back" variant="solid" onClick={() => navigate(-1)} />
            <div>
              <p className="eyebrow">Avatar editor</p>
              <h1 className="font-display text-xl font-semibold text-cream sm:text-3xl">Style your explorer</h1>
            </div>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            <AnimatePresence>{savedMessage && <SavedBadge />}</AnimatePresence>
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button icon="check" loading={saving} onClick={save} disabled={!dirty}>
              Save
            </Button>
          </div>
        </motion.div>

        {/* Stage */}
        <motion.div variants={staggerItem} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-start">
          <div className="surface relative aspect-[4/5] overflow-hidden sm:aspect-[5/6] lg:aspect-auto lg:h-[500px]">
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
            <Icon name="sparkle" size={18} className="animate-twinkle absolute left-6 top-8 text-lime-300/70" />
            <Icon name="sparkle" size={13} className="animate-float absolute right-10 top-16 text-sky-300/60" />
            <Icon name="sparkle" size={15} className="animate-float-slow absolute right-16 top-32 text-violet-300/50" />

            <Suspense
              fallback={
                <div className="absolute inset-0 flex items-center justify-center">
                  <Spinner className="size-8 text-subtle" />
                </div>
              }
            >
              <AvatarPreview config={draft} />
            </Suspense>

            <div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-2">
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
          <div className="surface flex flex-col gap-5 p-4 sm:p-6">
            <div className="relative grid grid-cols-3 gap-1 rounded-2xl bg-space-800 p-1">
              {CATEGORIES.map((c) => {
                const isActive = category === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    className={`relative flex items-center justify-center rounded-xl py-2.5 text-xs font-bold transition-colors sm:py-3 sm:text-sm ${
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
                    <span className="relative z-10 flex items-center gap-1.5 sm:gap-2">
                      <Icon name={c.icon} size={16} />
                      {c.label}
                    </span>
                  </button>
                )
              })}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={category}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-5"
              >
                {active.parts.map((part) => (
                  <PartEditor key={part} part={part} value={draft[part]} onChange={(value) => setPart(part, value)} />
                ))}
              </motion.div>
            </AnimatePresence>

            <p className="hairline-t pt-4 text-xs leading-relaxed text-subtle">
              <Icon name="info" size={13} className="mr-1 inline-block align-text-bottom text-subtle" />
              Colors preview instantly on your explorer — hit <span className="font-bold text-cream">Save</span> to
              keep them.
            </p>
          </div>
        </motion.div>
      </motion.div>

      {/* Mobile action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-space-900/85 px-4 pb-safe pt-3 backdrop-blur-md sm:hidden">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          {savedMessage && (
            <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-sm font-bold text-lime-300">Saved ✓</span>
          )}
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
      className="flex items-center gap-1.5 text-sm font-bold text-lime-300"
    >
      <Icon name="check" size={16} />
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
    <motion.div variants={fadeUp} initial="initial" animate="animate" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-display text-sm font-semibold text-cream">{PART_LABELS[part]}</span>
        {value && <span className="text-xs font-bold text-subtle">Custom</span>}
      </div>
      <div className="flex flex-wrap gap-2.5">
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
    </motion.div>
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
      className={`relative flex size-10 items-center justify-center rounded-full border-2 ${
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
      className={`relative flex size-10 items-center justify-center rounded-full border-2 ${
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
