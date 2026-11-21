import { lazy, Suspense, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { useSession } from '../../state/session'
import { useAvatar, saveAvatar, AVATAR_PALETTE } from '../../state/avatar'
import type { AvatarPart } from '../../lib/contracts'
import { fadeUp, staggerItem } from '../../lib/motion'

const AvatarPreview = lazy(() =>
  import('../../scene/AvatarPreview').then((m) => ({ default: m.AvatarPreview })),
)

type Category = 'hair' | 'face' | 'outfit'

const CATEGORIES: { id: Category; label: string; icon: string; parts: AvatarPart[] }[] = [
  { id: 'hair', label: 'Hair', icon: '✦', parts: ['hairColor'] },
  { id: 'face', label: 'Face', icon: '◉', parts: ['eyeColor'] },
  { id: 'outfit', label: 'Outfit', icon: '♧', parts: ['shirtColor', 'pantsColor', 'shoeColor'] },
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

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Avatar editor</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-cream">Style your explorer</h1>
        </div>
        <div className="flex items-center gap-2">
          {savedMessage && (
            <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-sm font-bold text-lime-300">
              Saved ✓
            </motion.span>
          )}
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button icon="check" loading={saving} onClick={save} disabled={!dirty}>
            Save
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Preview */}
        <motion.div variants={fadeUp} initial="initial" animate="animate" className="surface relative h-[420px] overflow-hidden sm:h-[500px]">
          <div className="absolute inset-0" style={{ background: 'radial-gradient(80% 80% at 50% 20%, #2b2452 0%, #1a1636 70%)' }}>
            <Suspense fallback={null}>
              <AvatarPreview config={draft} />
            </Suspense>
          </div>
          <div className="absolute bottom-4 left-4 rounded-full bg-space-900/70 px-3 py-1.5 text-xs font-bold text-muted backdrop-blur-sm">
            {authed ? 'Saved to your account' : 'Saved on this device'}
          </div>
        </motion.div>

        {/* Controls */}
        <motion.div variants={fadeUp} initial="initial" animate="animate" className="surface p-6">
          <div className="flex gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`flex flex-1 flex-col items-center gap-1 rounded-2xl border px-3 py-3 transition-colors ${
                  category === c.id ? 'border-lime-400/70 bg-lime-400/12' : 'border-white/10 bg-space-800 hover:border-white/20'
                }`}
              >
                <span className="text-lg text-lime-300">{c.icon}</span>
                <span className="text-sm font-bold text-cream">{c.label}</span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={category}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="mt-6 flex flex-col gap-5"
            >
              {active.parts.map((part) => (
                <motion.div key={part} variants={staggerItem}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-cream">{PART_LABELS[part]}</span>
                    <span className="text-xs text-subtle">{draft[part] ? 'Custom color' : 'Original'}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      aria-label={`${PART_LABELS[part]} original color`}
                      aria-pressed={draft[part] == null}
                      onClick={() => setPart(part, null)}
                      className={`flex size-9 items-center justify-center rounded-full border-2 text-subtle transition-colors ${
                        draft[part] == null ? 'border-lime-400' : 'border-white/15 hover:border-white/35'
                      }`}
                      title="Original color"
                    >
                      ↺
                    </button>
                    {AVATAR_PALETTE.map((color) => {
                      const selected = draft[part] === color.value
                      return (
                        <button
                          key={color.value}
                          type="button"
                          aria-label={`${PART_LABELS[part]} ${color.name}`}
                          aria-pressed={selected}
                          title={color.name}
                          onClick={() => setPart(part, color.value)}
                          className={`flex size-9 items-center justify-center rounded-full border-2 transition-transform hover:scale-110 ${
                            selected ? 'border-lime-400' : 'border-white/15'
                          }`}
                          style={{ background: color.value }}
                        >
                          {selected && <Icon name="check" size={16} className="text-white drop-shadow" />}
                        </button>
                      )
                    })}
                  </div>
                  <label className="mt-3 inline-flex items-center gap-2 text-sm text-subtle">
                    Any color
                    <input
                      type="color"
                      value={draft[part] ?? '#895236'}
                      onChange={(e) => setPart(part, e.target.value)}
                      className="size-8 cursor-pointer rounded-md border-none bg-transparent p-0"
                      aria-label={`${PART_LABELS[part]} custom color`}
                    />
                  </label>
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}
