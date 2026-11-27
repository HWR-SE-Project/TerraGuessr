import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Switch } from '../../components/ui/Form'
import { SettingRow, SettingSection } from '../../components/ui/SettingsCard'
import { usePreferences, toggleFullscreen } from '../../state/preferences'
import { staggerContainer, staggerItem } from '../../lib/motion'

export function SettingsPage() {
  const prefs = usePreferences()

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="flex flex-col gap-6">
        <motion.div variants={staggerItem}>
          <p className="eyebrow">Settings</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-cream">Make it yours</h1>
        </motion.div>

        <SettingSection title="Game preferences">
          <SettingRow icon="fullscreen" title="Fullscreen" hint="Expand the game to fill your screen">
            <Switch
              checked={prefs.fullscreen}
              onChange={() => void toggleFullscreen()}
              label="Fullscreen"
            />
          </SettingRow>
        </SettingSection>

        <p className="text-center text-xs text-subtle">
          Preferences sync to your account when signed in; guests keep them on this device.{' '}
          <Link
            to="/privacy"
            className="font-semibold text-muted underline decoration-white/20 underline-offset-4 transition-colors hover:text-cream"
          >
            How your data is used
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
