import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../../state/SessionContext'
import { requestEmailChange } from '../../api/auth'
import { mapApiError } from '../../api/errorMessages'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Brand } from '../../components/ui/Brand'
import { PageNavigation } from '../../components/ui/PageNavigation'
import './SettingsPage.css'

type SettingsTab = 'account' | 'preferences'

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 5 14 14M19 5 5 19" />
    </svg>
  )
}

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
    <div className="settings-row settings-row--slider">
      <h2 className="settings-row__label">{label}</h2>
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
        <output
          className="settings-slider__value"
          style={{ left: `clamp(24px, ${value}%, calc(100% - 24px))` }}
        >
          {value}
        </output>
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
  const [tab, setTab] = useState<SettingsTab>('account')

  const [displayName, setDisplayName] = useState('')
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
    if (user) setDisplayName(user.displayName)
  }, [user])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deleteOpen) navigate('/')
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
    try {
      await updatePreferences(changes)
    } catch (cause) {
      setPrefsError(mapApiError(cause))
    }
  }

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
        <PageNavigation active="none" />
        <main className="settings-screen">
          <p style={{ color: 'rgba(255,255,255,0.6)' }}>Loading…</p>
        </main>
      </>
    )
  }

  if (!user) {
    return (
      <>
        <PageNavigation active="none" />
        <main className="settings-screen">
          <section
            className="settings-panel settings-guest"
            aria-label="Settings"
          >
            <Brand />
            <h1>Make it your world.</h1>
            <p>Sign in to manage your account and preferences.</p>
            <button
              type="button"
              className="settings-save-btn tg-control tg-control--primary"
              onClick={() => navigate('/auth')}
            >
              Sign in
            </button>
            <button
              type="button"
              className="settings-footer__close tg-control"
              onClick={() => navigate('/')}
            >
              Return home
            </button>
          </section>
        </main>
      </>
    )
  }

  return (
    <>
      <PageNavigation active="none" />
      <main className="settings-screen">
        <section className="settings-panel" aria-label="Settings">
        <button
          className="settings-top-close tg-control"
          type="button"
          aria-label="Close settings"
          onClick={() => navigate('/')}
        >
          <CloseIcon />
        </button>

        <header className="settings-header">
          <h1>Settings</h1>
          <nav className="settings-tabs" aria-label="Settings sections">
            <button
              type="button"
              className={`tg-control${tab === 'account' ? ' is-active' : ''}`}
              aria-pressed={tab === 'account'}
              onClick={() => setTab('account')}
            >
              Account
            </button>
            <button
              type="button"
              className={`tg-control${tab === 'preferences' ? ' is-active' : ''}`}
              aria-pressed={tab === 'preferences'}
              onClick={() => setTab('preferences')}
            >
              Preferences
            </button>
          </nav>
          <span className="settings-header__spacer" />
        </header>

        <div className="settings-content" key={tab}>
          {tab === 'account' ? (
            <>
              <form className="settings-row" onSubmit={saveProfile}>
                <h2 className="settings-row__label">Display name</h2>
                <div
                  style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <input
                    aria-label="Display name"
                    className="settings-text-input"
                    value={displayName}
                    minLength={2}
                    maxLength={40}
                    onChange={(event) => setDisplayName(event.target.value)}
                  />
                  <button
                    type="submit"
                    className="settings-save-btn tg-control tg-control--primary"
                    disabled={
                      profileSaving || displayName.trim() === user.displayName
                    }
                  >
                    {profileSaving ? 'Saving…' : 'Save'}
                  </button>
                  {profileMessage && (
                    <span className="settings-inline-message">
                      {profileMessage}
                    </span>
                  )}
                </div>
              </form>

              <div className="settings-row">
                <h2 className="settings-row__label">Email</h2>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div
                    style={{
                      display: 'flex',
                      gap: 12,
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{ color: 'rgba(255,255,255,0.75)', fontSize: 16 }}
                    >
                      {user.email}
                    </span>
                    <button
                      type="button"
                      className="settings-save-btn settings-save-btn--muted"
                      onClick={() => {
                        setEmailFormOpen((open) => !open)
                        setEmailError(null)
                        setEmailMessage(null)
                      }}
                    >
                      {emailFormOpen ? 'Cancel' : 'Change email'}
                    </button>
                  </div>
                  {emailMessage && (
                    <span className="settings-inline-message">{emailMessage}</span>
                  )}
                  {emailFormOpen && (
                    <form
                      onSubmit={submitEmailChange}
                      style={{ display: 'grid', gap: 10, maxWidth: 420 }}
                    >
                      <input
                        type="email"
                        required
                        aria-label="New email address"
                        className="settings-text-input"
                        placeholder="New email address"
                        value={newEmail}
                        onChange={(event) => setNewEmail(event.target.value)}
                      />
                      {user.hasPassword && (
                        <input
                          type="password"
                          required
                          aria-label="Current password"
                          className="settings-text-input"
                          placeholder="Current password"
                          value={emailPassword}
                          onChange={(event) =>
                            setEmailPassword(event.target.value)
                          }
                        />
                      )}
                      <p className="settings-note" style={{ margin: 0 }}>
                        We will email both your current address and the new one.
                        The change applies only after both confirm.
                      </p>
                      <button
                        type="submit"
                        className="settings-save-btn"
                        disabled={emailBusy || !newEmail.trim()}
                        style={{ justifySelf: 'start' }}
                      >
                        {emailBusy ? 'Sending…' : 'Send confirmation'}
                      </button>
                      {emailError && (
                        <p className="settings-inline-message settings-inline-message--error">
                          {emailError}
                        </p>
                      )}
                    </form>
                  )}
                </div>
              </div>

              <div className="settings-row">
                <h2 className="settings-row__label">Session</h2>
                <button
                  type="button"
                  className="settings-save-btn tg-control tg-control--secondary settings-save-btn--muted"
                  onClick={handleLogout}
                >
                  Log out
                </button>
              </div>

              <div className="settings-row">
                <h2 className="settings-row__label">Delete account</h2>
                <div>
                  <p className="settings-note" style={{ marginBottom: 12 }}>
                    Permanently deletes your account and preferences. Past games
                    and results are kept, anonymized.
                  </p>
                  <button
                    type="button"
                    className="settings-save-btn tg-control tg-control--danger settings-save-btn--danger"
                    onClick={() => setDeleteOpen(true)}
                  >
                    Delete my account
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <Slider
                label="Effect volume"
                value={preferences?.soundFxVolume ?? 50}
                onChange={(value) => patchPreferences({ soundFxVolume: value })}
              />
              <Slider
                label="Music volume"
                value={preferences?.musicVolume ?? 35}
                onChange={(value) => patchPreferences({ musicVolume: value })}
              />

              <div className="settings-row settings-row--language">
                <h2 className="settings-row__label">Language</h2>
                <div className="settings-language-select">
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
                  <span
                    className="settings-language-select__chevron"
                    aria-hidden="true"
                  />
                </div>
              </div>

              <div className="settings-row settings-row--toggle">
                <h2 className="settings-row__label">Fullscreen</h2>
                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    aria-label="Fullscreen"
                    checked={preferences?.fullscreen ?? false}
                    onChange={(event) =>
                      patchPreferences({ fullscreen: event.target.checked })
                    }
                  />
                  <span aria-hidden="true" />
                </label>
              </div>

              {prefsError && (
                <p className="settings-inline-message settings-inline-message--error">
                  {prefsError}
                </p>
              )}
            </>
          )}
        </div>

        <footer className="settings-footer">
          <button
            className="settings-footer__close tg-control"
            type="button"
            onClick={() => navigate('/')}
          >
            Close
          </button>
        </footer>
      </section>

      {deleteOpen && (
        <ConfirmDialog
          title="Delete your account?"
          description="This can't be undone. If your account has a password, confirm it below."
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
          <input
            type="password"
            aria-label="Current password"
            className="settings-text-input"
            placeholder="Current password (if set)"
            value={deletePassword}
            onChange={(event) => setDeletePassword(event.target.value)}
            style={{ width: '100%', marginBottom: 8 }}
          />
          {deleteError && (
            <p className="settings-inline-message settings-inline-message--error">
              {deleteError}
            </p>
          )}
        </ConfirmDialog>
      )}
      </main>
    </>
  )
}
