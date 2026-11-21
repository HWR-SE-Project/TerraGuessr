import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '../../components/ui/Button'
import { Field, Input, Slider, Switch } from '../../components/ui/Form'
import { Dialog } from '../../components/ui/Dialog'
import { Icon } from '../../components/ui/Icon'
import { useSession, signOut, setUser } from '../../state/session'
import { usePreferences, updatePreference, toggleFullscreen } from '../../state/preferences'
import { api } from '../../services'
import { staggerContainer, staggerItem } from '../../lib/motion'
import type { PublicUser } from '../../lib/contracts'

export function SettingsPage() {
  const session = useSession()
  const prefs = usePreferences()
  const authed = session.status === 'authed'
  const user = session.user

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="flex flex-col gap-6">
        <motion.div variants={staggerItem}>
          <p className="eyebrow">Settings</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-cream">Make it yours</h1>
        </motion.div>

        {/* Preferences */}
        <SettingSection title="Preferences">
          <SettingRow icon="language" title="Language" hint="Interface language">
            <div className="flex gap-1 rounded-2xl bg-space-800 p-1">
              {(['en', 'de'] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => void updatePreference({ language: lang })}
                  className={`rounded-xl px-4 py-1.5 text-sm font-bold transition-colors ${
                    prefs.language === lang ? 'bg-lime-400 text-ink' : 'text-muted hover:text-cream'
                  }`}
                >
                  {lang === 'en' ? 'English' : 'Deutsch'}
                </button>
              ))}
            </div>
          </SettingRow>

          <SettingRow icon="fullscreen" title="Fullscreen" hint="Expand the game to fill your screen">
            <Switch
              checked={prefs.fullscreen}
              onChange={() => void toggleFullscreen()}
              label="Fullscreen"
            />
          </SettingRow>

          <SettingRow icon="volume" title="Sound effects" hint="Feedback for guesses and actions">
            <div className="w-44">
              <Slider
                value={prefs.soundFxVolume}
                onChange={(value) => void updatePreference({ soundFxVolume: value })}
                label="Sound effects volume"
              />
            </div>
          </SettingRow>

          <SettingRow icon="volume" title="Music" hint="Ambient background music">
            <div className="w-44">
              <Slider
                value={prefs.musicVolume}
                onChange={(value) => void updatePreference({ musicVolume: value })}
                label="Music volume"
              />
            </div>
          </SettingRow>
        </SettingSection>

        {/* Account */}
        <SettingSection title="Account">
          {authed && user ? (
            <>
              <AccountProfile user={user} onUpdate={(updated) => setUser(updated)} />
              <SettingRow icon="mail" title="Email" hint={user.email}>
                <Button variant="secondary" size="sm" disabled title="Email change requires backend delivery — available in Phase 2.">
                  Change
                </Button>
              </SettingRow>
              <SettingRow icon="exit" title="Sign out" hint="Leave this device">
                <Button variant="secondary" size="sm" onClick={() => void signOut()}>
                  Sign out
                </Button>
              </SettingRow>
              <DeleteAccount />
            </>
          ) : (
            <div className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <p className="font-semibold text-cream">Sign in</p>
                <p className="text-sm text-subtle">Save your explorer, history and preferences to an account.</p>
              </div>
              <Button to="/auth" size="sm" className="shrink-0">Sign in</Button>
            </div>
          )}
        </SettingSection>

        <p className="text-center text-xs text-subtle">
          Preferences sync to your account when signed in; guests keep them on this device.
        </p>
      </motion.div>
    </div>
  )
}

function AccountProfile({ user, onUpdate }: { user: PublicUser; onUpdate: (user: PublicUser) => void }) {
  const [name, setName] = useState(user.displayName)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      const { user: updated } = await api.auth.updateProfile(name)
      onUpdate(updated)
      setMessage('Display name updated.')
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not update.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label="Display name" htmlFor="profile-name">
        <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} icon="person" />
      </Field>
      <div className="flex items-center gap-3">
        <Button size="sm" loading={saving} onClick={save} disabled={name.trim().length < 2 || name === user.displayName}>
          Save name
        </Button>
        {message && <span className="text-sm font-semibold text-lime-300">{message}</span>}
      </div>
    </div>
  )
}

function DeleteAccount() {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function remove() {
    setLoading(true)
    setError(null)
    try {
      await api.auth.deleteAccount('DELETE', password || undefined)
      setOpen(false)
      window.location.href = '/'
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete the account.')
      setLoading(false)
    }
  }

  return (
    <>
      <SettingRow icon="lock" title="Delete account" hint="Permanently remove your account" danger>
        <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
          Delete
        </Button>
      </SettingRow>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Delete your account?"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" fullWidth loading={loading} disabled={confirm !== 'DELETE'} onClick={remove}>
              Delete forever
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            This permanently deletes your account and personal data. Type <span className="font-bold text-cream">DELETE</span> to confirm.
          </p>
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" />
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Current password (if set)" icon="lock" />
          {error && <p className="text-sm font-semibold text-rose-300">{error}</p>}
        </div>
      </Dialog>
    </>
  )
}

function SettingSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface overflow-hidden">
      <h2 className="border-b border-white/8 px-5 py-3 font-display text-sm font-semibold uppercase tracking-widest text-subtle">
        {title}
      </h2>
      <div className="divide-y divide-white/6">{children}</div>
    </section>
  )
}

function SettingRow({
  icon,
  title,
  hint,
  children,
  danger,
}: {
  icon: Parameters<typeof Icon>[0]['name']
  title: string
  hint?: string
  children: React.ReactNode
  danger?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${danger ? 'bg-rose-400/15 text-rose-300' : 'bg-space-800 text-subtle'}`}>
          <Icon name={icon} size={18} />
        </span>
        <div className="min-w-0">
          <p className={`font-semibold ${danger ? 'text-rose-300' : 'text-cream'}`}>{title}</p>
          {hint && <p className="truncate text-sm text-subtle">{hint}</p>}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
