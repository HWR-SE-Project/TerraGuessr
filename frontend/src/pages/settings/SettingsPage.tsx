import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import './SettingsPage.css'

type SettingsTab = 'general' | 'keybindings'
type CompassStyle = 'classic' | 'modern' | 'both'
type MapQuality = 'high' | 'balanced'

const KEYBINDINGS = [
  { action: 'Move forward', key: 'W / ↑' },
  { action: 'Move backward', key: 'S / ↓' },
  { action: 'Turn left', key: 'A / ←' },
  { action: 'Turn right', key: 'D / →' },
  { action: 'Place guess', key: 'Space' },
]

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

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
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
        <output className="settings-slider__value" style={{ left: `clamp(24px, ${value}%, calc(100% - 24px))` }}>{value}</output>
      </div>
    </div>
  )
}

function ChoiceCard<T extends string>({
  name,
  value,
  selected,
  onSelect,
  children,
}: {
  name: string
  value: T
  selected: boolean
  onSelect: (value: T) => void
  children: ReactNode
}) {
  return (
    <label className={`settings-choice${selected ? ' is-selected' : ''}`}>
      <input type="radio" name={name} value={value} checked={selected} onChange={() => onSelect(value)} />
      <span className="settings-choice__radio" aria-hidden="true"><span /></span>
      <span className="settings-choice__text">{children}</span>
    </label>
  )
}

export function SettingsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<SettingsTab>('general')
  const [effectVolume, setEffectVolume] = useState(30)
  const [musicVolume, setMusicVolume] = useState(0)
  const [compass, setCompass] = useState<CompassStyle>('modern')
  const [mapQuality, setMapQuality] = useState<MapQuality>('high')
  const [language, setLanguage] = useState('English')

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') navigate('/landing')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate])

  return (
    <main className="settings-screen">
      <section className="settings-panel" aria-label="Settings">
        <button className="settings-top-close" type="button" aria-label="Close settings" onClick={() => navigate('/landing')}>
          <CloseIcon />
        </button>

        <header className="settings-header">
          <h1>Settings</h1>
          <nav className="settings-tabs" aria-label="Settings sections">
            <button type="button" className={tab === 'general' ? 'is-active' : ''} onClick={() => setTab('general')}>General</button>
            <button type="button" className={tab === 'keybindings' ? 'is-active' : ''} onClick={() => setTab('keybindings')}>Keybindings</button>
          </nav>
          <span className="settings-header__spacer" />
        </header>

        <div className="settings-content" key={tab}>
          {tab === 'general' ? (
            <>
              <Slider label="Effect volume" value={effectVolume} onChange={setEffectVolume} />
              <Slider label="Music volume" value={musicVolume} onChange={setMusicVolume} />

              <div className="settings-row settings-row--choices">
                <h2 className="settings-row__label">Compass</h2>
                <div className="settings-choice-grid settings-choice-grid--three">
                  <ChoiceCard name="compass" value="classic" selected={compass === 'classic'} onSelect={setCompass}>Classic</ChoiceCard>
                  <ChoiceCard name="compass" value="modern" selected={compass === 'modern'} onSelect={setCompass}>Modern</ChoiceCard>
                  <ChoiceCard name="compass" value="both" selected={compass === 'both'} onSelect={setCompass}>Classic &amp; Modern</ChoiceCard>
                </div>
              </div>

              <div className="settings-row settings-row--map-quality">
                <h2 className="settings-row__label">Map Quality</h2>
                <div className="settings-map-quality__options">
                  <div className="settings-choice-grid settings-choice-grid--two">
                    <ChoiceCard name="map-quality" value="high" selected={mapQuality === 'high'} onSelect={setMapQuality}>High (vector)</ChoiceCard>
                    <ChoiceCard name="map-quality" value="balanced" selected={mapQuality === 'balanced'} onSelect={setMapQuality}>Balanced (faster)</ChoiceCard>
                  </div>
                  <p className="settings-note">Takes effect the next time the page loads.</p>
                </div>
              </div>

              <div className="settings-row settings-row--language">
                <h2 className="settings-row__label">Language</h2>
                <div className="settings-language-select">
                  <span className="settings-language-select__icon"><LanguageIcon /></span>
                  <select aria-label="Language" value={language} onChange={(event) => setLanguage(event.target.value)}>
                    {['English', 'Deutsch', 'Español', 'Français', 'Italiano', '日本語', 'Português', 'Русский'].map((item) => <option key={item}>{item}</option>)}
                  </select>
                  <span className="settings-language-select__chevron" aria-hidden="true" />
                </div>
              </div>

              <div className="settings-row settings-row--toggle">
                <h2 className="settings-row__label">Show location names</h2>
                <label className="settings-toggle">
                  <input type="checkbox" defaultChecked />
                  <span aria-hidden="true" />
                </label>
              </div>
            </>
          ) : (
            <div className="settings-keybindings">
              <div className="settings-keybindings__heading">
                <h2>Movement</h2>
                <span>Click a key to change its binding</span>
              </div>
              {KEYBINDINGS.map(({ action, key }) => (
                <div className="settings-keybinding" key={action}>
                  <span>{action}</span>
                  <button type="button" aria-label={`Change key for ${action}`}>{key}</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <footer className="settings-footer">
          <button className="settings-footer__close" type="button" onClick={() => navigate('/landing')}>Close</button>
        </footer>
      </section>
    </main>
  )
}
