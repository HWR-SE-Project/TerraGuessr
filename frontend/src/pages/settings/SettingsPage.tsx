import { Switch } from '../../components/ui/Switch'
import { Button } from '../../components/ui/Button'
import { IconButton } from '../../components/ui/IconButton'
import { Input } from '../../components/ui/Input'
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useSession } from '../../state/SessionContext'
import { requestEmailChange } from '../../api/auth'
import { mapApiError } from '../../api/errorMessages'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { AppHeader } from '../../components/layout/AppHeader'
import { staggerContainer, staggerItem, collapseVariants } from '../../lib/motion'
import './SettingsPage.css'

function LanguageIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M4 4.5h15a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-5.2l-4.4 4v-4H6a2 2 0 0 1-2-2v-13Z" />
      <path d="M10 9.5h6M13 8v2m-4 5.5c2-.8 4.2-2.6 5.5-5.2M10 11.5c.8 2.2 2.5 3.8 4.5 4.7" />
      <path d="M17 16.5h9a2 2 0 0 1 2 2v8h-4l-3 2v-2h-4a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z" />
    </svg>
  )
}

function Slider({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="settings-item">
      <h2 className="settings-item__label">{label}</h2>
      <div className="settings-slider-wrap">
        <input
          aria-label={label}
          className="settings-slider"
          type="range"
          min="0"
          max="100"
          value={value}
          style={{ '--slider-progress': `${value}%` } as CSSProperties}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span className="settings-slider__value">{value}</span>
      </div>
    </div>
  )
}

export function SettingsPage() {
  const navigate = useNavigate()
  const {
    status,
    user,
    preferences,
    updateProfile,
    updatePreferences,
    logout,
    deleteAccount,
  } = useSession()
  const [nameDraft, setDisplayName] = useState<string | null>(null)
  const displayName = nameDraft ?? user?.displayName ?? ''
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState<string | null>(null)

  const [emailFormOpen, setEmailFormOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailPassword, setEmailPassword] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailMessage, setEmailMessage] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)

  const [prefsError, setPrefsError] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented && !deleteOpen) navigate('/')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate, deleteOpen])

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault()
    setProfileSaving(true)
    setProfileMessage(null)
    try {
      await updateProfile(displayName.trim())
      setProfileMessage('Saved.')
    } catch (cause) {
      setProfileMessage(mapApiError(cause))
    } finally {
      setProfileSaving(false)
    }
  }

  async function submitEmailChange(event: React.FormEvent) {
    event.preventDefault()
    setEmailBusy(true)
    setEmailMessage(null)
    setEmailError(null)
    try {
      const result = await requestEmailChange(newEmail.trim(), emailPassword || undefined)
      setEmailMessage(result.message)
      setEmailFormOpen(false)
      setNewEmail('')
      setEmailPassword('')
    } catch (cause) {
      setEmailError(
        mapApiError(cause, {
          EMAIL_IN_USE: 'That email is already used by another account.',
          EMAIL_UNCHANGED: 'Choose a different email address.',
          UNAUTHORIZED: 'Current password is incorrect.',
        }),
      )
    } finally {
      setEmailBusy(false)
    }
  }

  async function patchPreferences(
    changes: Parameters<typeof updatePreferences>[0],
  ) {
    setPrefsError(null)
    if ('fullscreen' in changes) {
      try {
        if (changes.fullscreen) await document.documentElement.requestFullscreen()
        else if (document.fullscreenElement) await document.exitFullscreen()
      } catch {
        setPrefsError('Your browser blocked fullscreen. Try again from a direct click.')
        return
      }
    }
    try {
      await updatePreferences(changes)
    } catch (cause) {
      setPrefsError(mapApiError(cause))
    }
  }

  // Keep the toggle in sync when fullscreen is left via Escape or browser UI.
  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && preferences?.fullscreen) void updatePreferences({ fullscreen: false })
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [preferences?.fullscreen, updatePreferences])

  async function confirmDelete() {
    setDeleteBusy(true)
    setDeleteError(null)
    try {
      await deleteAccount(deletePassword || undefined)
      navigate('/')
    } catch (cause) {
      setDeleteError(
        mapApiError(cause, { UNAUTHORIZED: 'Current password is incorrect.' }),
      )
    } finally {
      setDeleteBusy(false)
    }
  }

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  if (status === 'loading') {
    return (
      <>
        <AppHeader />
        <main className="settings-screen">
          <p className="settings-note">Loading…</p>
        </main>
      </>
    )
  }

  return (
    <>
      <AppHeader />
      <main className="settings-screen" onClick={(event) => {
        if (event.target === event.currentTarget && !deleteOpen) navigate('/')
      }}>
        <section className="settings-window tg-glass tg-glass--panel" aria-label="Settings">
          <header className="settings-window__header">
            <h1>Settings</h1>
            <IconButton className="settings-window__close" aria-label="Close settings" onClick={() => navigate('/')}>
              ×
            </IconButton>
          </header>

          <motion.div
            className="settings-window__body"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            <motion.section variants={staggerItem} className="settings-group settings-group--account">
              <h2 className="settings-group__title">Account</h2>
              {!user ? (
                <div className="settings-group__box">
                  <div className="settings-item settings-item--guest">
                    <p>Sign in to manage your account.</p>
                    <Button type="button" size="sm" onClick={() => navigate('/auth')}>
                      Sign in
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="settings-group__box">
                  <form className="settings-item" onSubmit={saveProfile}>
                    <h2 className="settings-item__label">Name</h2>
                    <div className="settings-inline-group">
                      <Input
                        aria-label="Display name"
                        className="settings-text-input"
                        value={displayName}
                        minLength={2}
                        maxLength={40}
                        onChange={(event) => setDisplayName(event.target.value)}
                      />
                      <Button
                        type="submit"
                        size="sm"
                        disabled={profileSaving || displayName.trim() === user.displayName}
                      >
                        {profileSaving ? 'Saving…' : 'Save'}
                      </Button>
                    </div>
                    {profileMessage && <span className="settings-inline-message">{profileMessage}</span>}
                  </form>

                  <div className="settings-item settings-item--stack">
                    <h2 className="settings-item__label">Email</h2>
                    <div className="settings-email">
                      <div className="settings-inline-group">
                        <span className="settings-email-address">{user.email}</span>
                        <Button
                          variant="secondary"
                          type="button"
                          size="sm"
                          onClick={() => {
                            setEmailFormOpen((open) => !open)
                            setEmailError(null)
                            setEmailMessage(null)
                          }}
                        >
                          {emailFormOpen ? 'Cancel' : 'Change'}
                        </Button>
                      </div>
                      {emailMessage && <span className="settings-inline-message">{emailMessage}</span>}
                      <AnimatePresence initial={false}>
                        {emailFormOpen && (
                          <motion.form
                            className="settings-email-form"
                            onSubmit={submitEmailChange}
                            variants={collapseVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            style={{ overflow: 'hidden' }}
                          >
                            <Input
                              type="email"
                              required
                              aria-label="New email address"
                              className="settings-text-input"
                              placeholder="New email address"
                              value={newEmail}
                              onChange={(event) => setNewEmail(event.target.value)}
                            />
                            {user.hasPassword && (
                              <Input
                                type="password"
                                required
                                aria-label="Current password"
                                className="settings-text-input"
                                placeholder="Current password"
                                value={emailPassword}
                                onChange={(event) => setEmailPassword(event.target.value)}
                              />
                            )}
                            <p className="settings-note">
                              We'll email both addresses — the change applies once both confirm.
                            </p>
                            <Button type="submit" size="sm" disabled={emailBusy || !newEmail.trim()}>
                              {emailBusy ? 'Sending…' : 'Send confirmation'}
                            </Button>
                            {emailError && (
                              <p className="settings-inline-message settings-inline-message--error">{emailError}</p>
                            )}
                          </motion.form>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <div className="settings-item settings-item--actions">
                    <h2 className="settings-item__label">Account</h2>
                    <div className="settings-account-actions">
                      <Button variant="secondary" appearance="flat" type="button" size="sm" onClick={handleLogout}>
                        Log out
                      </Button>
                      <Button variant="danger" appearance="flat" type="button" size="sm" onClick={() => setDeleteOpen(true)}>
                        Delete my account
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </motion.section>

            <motion.section variants={staggerItem} className="settings-group">
              <h2 className="settings-group__title">Preferences</h2>
              <div className="settings-group__box">
                <Slider
                  label="Effects"
                  value={preferences?.soundFxVolume ?? 50}
                  onChange={(value) => patchPreferences({ soundFxVolume: value })}
                />
                <Slider
                  label="Music"
                  value={preferences?.musicVolume ?? 35}
                  onChange={(value) => patchPreferences({ musicVolume: value })}
                />

                <div className="settings-item">
                  <h2 className="settings-item__label">Language</h2>
                  <div className="settings-language-select tg-field">
                    <span className="settings-language-select__icon">
                      <LanguageIcon />
                    </span>
                    <select
                      aria-label="Language"
                      value={preferences?.language ?? 'en'}
                      onChange={(event) =>
                        patchPreferences({
                          language: event.target.value as 'en' | 'de',
                        })
                      }
                    >
                      <option value="en">English</option>
                      <option value="de">Deutsch</option>
                    </select>
                    <span className="settings-language-select__chevron" aria-hidden="true" />
                  </div>
                </div>

                <div className="settings-item">
                  <h2 className="settings-item__label">Fullscreen</h2>
                  <label className="settings-toggle">
                    <Switch
                      aria-label="Fullscreen"
                      checked={preferences?.fullscreen ?? false}
                      onChange={(event) => patchPreferences({ fullscreen: event.target.checked })}
                    />
                  </label>
                </div>

                {prefsError && <p className="settings-inline-message settings-inline-message--error">{prefsError}</p>}
              </div>
            </motion.section>
          </motion.div>
        </section>

        {deleteOpen && (
          <ConfirmDialog
            title="Delete your account?"
            description="This can't be undone. Past games and results are kept, anonymized. If your account has a password, confirm it below."
            confirmLabel="Delete account"
            destructive
            busy={deleteBusy}
            onConfirm={confirmDelete}
            onCancel={() => {
              setDeleteOpen(false)
              setDeleteError(null)
              setDeletePassword('')
            }}
          >
            <Input
              type="password"
              aria-label="Current password"
              placeholder="Current password (if set)"
              className="settings-text-input settings-delete-password"
              value={deletePassword}
              onChange={(event) => setDeletePassword(event.target.value)}
            />
            {deleteError && <p className="settings-inline-message settings-inline-message--error">{deleteError}</p>}
          </ConfirmDialog>
        )}
      </main>
    </>
  )
}
