export interface GameplaySettings {
  hoverExpand: boolean
  compass: boolean
  scrollZoom: boolean
  mapOpacity: number
}
export const defaultSettings: GameplaySettings = {
  hoverExpand: true,
  compass: true,
  scrollZoom: true,
  mapOpacity: 94,
}
export function readSettings(): GameplaySettings {
  try {
    const saved = JSON.parse(
      localStorage.getItem('terraguessr.gameplay.settings') || 'null',
    )
    return {
      hoverExpand:
        typeof saved?.hoverExpand === 'boolean' ? saved.hoverExpand : true,
      compass: typeof saved?.compass === 'boolean' ? saved.compass : true,
      scrollZoom:
        typeof saved?.scrollZoom === 'boolean' ? saved.scrollZoom : true,
      mapOpacity: Number.isFinite(saved?.mapOpacity)
        ? Math.max(60, Math.min(100, saved.mapOpacity))
        : 94,
    }
  } catch {
    return defaultSettings
  }
}
