import type { RoundScene } from '../../lib/contracts'
import { BIOME_PALETTES, skyForWeather } from './palettes'

/** Lightweight stylized 2D fallback used when WebGL is unavailable (e.g. headless CI). */
export function DioramaFallback({
  scene,
  onAskExplorer,
}: {
  scene: RoundScene
  onAskExplorer?: () => void
}) {
  const sky = skyForWeather(scene.lighting, scene.weather)
  const biome = BIOME_PALETTES[scene.biome]

  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden"
      style={{ background: sky.gradient }}
      aria-label={`${biome.label} diorama scene`}
    >
      <div
        className="h-28 w-72 rounded-[50%] shadow-2xl"
        style={{ background: scene.weather === 'snow' ? biome.snowyGround : biome.ground }}
        aria-hidden="true"
      />
      <div className="mt-4 flex flex-col items-center gap-2 text-center">
        <span className="rounded-full bg-space-900/75 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-cream backdrop-blur-md">
          {biome.label} · {scene.weather} · {scene.lighting}
        </span>
        {onAskExplorer && (
          <button
            type="button"
            onClick={onAskExplorer}
            className="rounded-full border border-white/15 bg-space-900/75 px-3.5 py-1.5 text-xs font-semibold text-lime-300 backdrop-blur-md hover:bg-space-900/90"
          >
            Tap explorer for a weather note
          </button>
        )}
      </div>
    </div>
  )
}
