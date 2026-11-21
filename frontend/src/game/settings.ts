import { useEffect, useState } from 'react'

export interface GameplaySettings {
  hoverExpand: boolean
  compass: boolean
  scrollZoom: boolean
  mapOpacity: number
}
const STORAGE_KEY = 'terraguessr.gameplay.settings'
const defaults: GameplaySettings = { hoverExpand: true, compass: true, scrollZoom: true, mapOpacity: 94 }

function readSettings(): GameplaySettings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    return {
      hoverExpand: typeof saved?.hoverExpand === 'boolean' ? saved.hoverExpand : defaults.hoverExpand,
      compass: typeof saved?.compass === 'boolean' ? saved.compass : defaults.compass,
      scrollZoom: typeof saved?.scrollZoom === 'boolean' ? saved.scrollZoom : defaults.scrollZoom,
      mapOpacity: Number.isFinite(saved?.mapOpacity) ? Math.max(60, Math.min(100, saved.mapOpacity)) : defaults.mapOpacity,
    }
  } catch { return defaults }
}

/** Each game owns its settings; persistence has one implementation. */
export function useGameplaySettings() {
  const [settings, setSettings] = useState(readSettings)
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)) }
    catch { /* The current game's settings still work without browser storage. */ }
  }, [settings])
  return [settings, setSettings] as const
}
