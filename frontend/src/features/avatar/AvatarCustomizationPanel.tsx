import type { CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { AvatarConfig, AvatarPart } from './avatarConfig'

import { CATEGORIES } from './avatarCategories'
import type { AvatarCategory } from './avatarCategories'
import { duration, ease, spring, staggerContainer, staggerItem } from '../../lib/motion'
const LABELS: Record<AvatarPart, string> = { hairColor: 'Hair & brows', eyeColor: 'Eyes', shirtColor: 'Shirt', pantsColor: 'Shorts', shoeColor: 'Slippers' }
const COLORS = [
  ['Espresso', '#36251e'], ['Chestnut', '#895236'], ['Honey', '#d9ab57'], ['Pearl', '#deded3'],
  ['Lime', '#b9ed66'], ['Forest', '#388365'], ['Ocean', '#378bce'], ['Midnight', '#333b67'],
  ['Lilac', '#a58bd7'], ['Rose', '#db769d'], ['Coral', '#e67b58'], ['Charcoal', '#353942'],
] as const
export function AvatarCustomizationPanel({ category, config, onChange }: {
  category: AvatarCategory; config: AvatarConfig; onChange: (part: AvatarPart, value: string | null) => void
}) {
  const selected = CATEGORIES.find(item => item.id === category)!
  return <AnimatePresence mode="wait" initial={false}>
    <motion.div
      key={category}
      className="ae-options"
      id="ae-options"
      aria-label={`${selected.label} customization`}
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      exit={{ opacity: 0, transition: { duration: duration.instant, ease: ease.out } }}
    >
      <motion.div variants={staggerItem} className="ae-section-heading"><span className="ae-eyebrow">MAKE IT YOURS</span><h3>{selected.label}</h3><p>{selected.description}</p></motion.div>
      {selected.parts.map(part => <motion.fieldset variants={staggerItem} className="ae-color-picker" key={part}>
        <legend>{LABELS[part]} <span>{config[part] ? 'Custom color' : 'Original'}</span></legend>
        <div className="ae-swatches">
          <button type="button" className="ae-swatch ae-original" aria-label={`${LABELS[part]} original color`} aria-pressed={config[part] == null} onClick={() => onChange(part, null)} title="Original color">
            {config[part] == null && <motion.span className="ae-swatch-ring" layoutId={`ae-swatch-ring-${part}`} transition={spring.snappy} />}
            ↺
          </button>
          {COLORS.map(([name, color]) => <button key={color} type="button" className="ae-swatch" style={{ '--swatch': color } as CSSProperties}
            title={name} aria-label={`${LABELS[part]} ${name}`} aria-pressed={config[part] === color} onClick={() => onChange(part, color)}>
            {config[part] === color && <motion.span className="ae-swatch-ring" layoutId={`ae-swatch-ring-${part}`} transition={spring.snappy} />}
            {config[part] === color && <span aria-hidden="true">✓</span>}
          </button>)}
        </div>
        <label className="ae-custom-color">Choose any color <input type="color" aria-label={`${LABELS[part]} custom color`} value={config[part] ?? '#895236'} onChange={event => onChange(part, event.target.value)} /></label>
      </motion.fieldset>)}
      {category !== 'hair' && <motion.p variants={staggerItem} className="ae-model-note">{category === 'face' ? 'Color your irises. Your explorer’s expression stays the same.' : 'Your explorer’s original outfit, in your own colors.'}</motion.p>}
    </motion.div>
  </AnimatePresence>
}
