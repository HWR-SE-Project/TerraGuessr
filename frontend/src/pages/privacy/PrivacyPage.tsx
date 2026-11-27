import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { staggerContainer, staggerItem } from '../../lib/motion'
import { PrivacyTopicsList } from './PrivacyContent'

export function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="flex flex-col gap-6">
        <motion.div variants={staggerItem}>
          <p className="eyebrow">Data &amp; privacy</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-cream">How your data is used</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            TerraGuessr stores only what’s needed to run the game and keep your account working. No ads, no analytics,
            and no tracking cookies.
          </p>
        </motion.div>

        <motion.section variants={staggerItem} className="surface overflow-hidden">
          <PrivacyTopicsList />
        </motion.section>

        <motion.div variants={staggerItem} className="text-center">
          <Link to="/" className="text-sm font-bold text-subtle hover:text-cream">
            Back home
          </Link>
        </motion.div>
      </motion.div>
    </div>
  )
}
