import { Switch } from '../components/ui/Switch'
import './GameSettings.css'
import type { CSSProperties } from 'react'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import type { GameplaySettings } from './settings'
export function GameSettings({
  settings,
  onChange,
  onClose,
}: {
  settings: GameplaySettings
  onChange: (settings: GameplaySettings) => void
  onClose: () => void
}) {
  function toggle(key: 'hoverExpand' | 'compass' | 'scrollZoom') {
    onChange({ ...settings, [key]: !settings[key] })
  }
  return (
    <Modal title="Game settings" onClose={onClose}>
      {(
        [
          [
            'hoverExpand',
            'Expand map on hover',
            'A bigger map when your mouse enters it.',
          ],
          ['compass', 'Show compass', 'Find north with a single click.'],
          [
            'scrollZoom',
            'Scroll to zoom Street View',
            'Use your scroll wheel to take a closer look.',
          ],
        ] as const
      ).map(([key, label, description]) => (
        <label className="sp-setting" key={key}>
          <span>
            <strong>{label}</strong>
            <small>{description}</small>
          </span>
          <Switch
            checked={settings[key]}
            onChange={() => toggle(key)}
          />
        </label>
      ))}
      <label className="sp-setting sp-setting-range">
        <span>
          <strong>Map opacity</strong>
          <small>{settings.mapOpacity}%</small>
        </span>
        <input
          aria-label="Map opacity"
          type="range"
          min="60"
          max="100"
          value={settings.mapOpacity}
          style={{ '--range-fill': `${settings.mapOpacity}%` } as CSSProperties}
          onChange={(event) =>
            onChange({ ...settings, mapOpacity: Number(event.target.value) })
          }
        />
      </label>
      <Button block onClick={onClose}>
        Back to exploring
      </Button>
    </Modal>
  )
}
