import { useMemo } from 'react'
import type { Biome, RoundScene } from '../../lib/contracts'
import { useAvatar } from '../../state/avatar'
import { Icon } from '../../components/ui/Icon'
import { BIOME_PALETTES, LIGHTING_PALETTES, skyForWeather } from './palettes'
import { createRng, randRange } from './prng'

/** Minimal sky-only placeholder shown while the lazy 3D diorama chunk loads. */
export function DioramaLoading({ scene }: { scene: RoundScene }) {
  const sky = skyForWeather(scene.lighting, scene.weather)
  return (
    <div
      className="h-full w-full"
      style={{ background: sky.gradient }}
      aria-hidden="true"
    />
  )
}

function BiomeSilhouettes({
  biome,
  accentA,
  accentB,
  rock,
  snowy,
  windowGlow,
}: {
  biome: Biome
  accentA: string
  accentB: string
  rock: string
  snowy: boolean
  windowGlow: boolean
}) {
  const cap = '#eef5fb'
  switch (biome) {
    case 'desert':
      return (
        <g>
          {/* Soft dunes & mesa silhouettes */}
          <path d="M126 270 Q188 228 258 268 Z" fill={accentB} opacity="0.72" />
          <path d="M368 268 Q438 220 512 270 Z" fill={accentB} opacity="0.65" />
          <path d="M430 264 L446 218 L484 218 L496 264 Z" fill={rock} />
          {/* Stylized cacti */}
          <g fill={accentA}>
            <rect x="176" y="218" width="12" height="46" rx="6" />
            <path d="M176 238 H166 Q162 238 162 232 V224 Q162 220 166 220 Q170 220 170 224 V232 H176 Z" />
            <path d="M188 232 H198 Q202 232 202 226 V218 Q202 214 198 214 Q194 214 194 218 V226 H188 Z" />
            <rect x="406" y="232" width="10" height="34" rx="5" />
            <path d="M416 246 H424 Q427 246 427 241 V236 Q427 233 424 233 Q421 233 421 236 V241 H416 Z" />
          </g>
        </g>
      )
    case 'forest':
      return (
        <g>
          {[
            { x: 162, y: 266, s: 1.05, c: accentA },
            { x: 204, y: 262, s: 1.25, c: accentB },
            { x: 244, y: 266, s: 0.9, c: accentA },
            { x: 400, y: 266, s: 0.95, c: accentB },
            { x: 440, y: 262, s: 1.3, c: accentA },
            { x: 482, y: 266, s: 1.0, c: accentB },
          ].map((tree, idx) => (
            <g key={idx} transform={`translate(${tree.x} ${tree.y}) scale(${tree.s})`}>
              <rect x="-4" y="-14" width="8" height="16" rx="2" fill="#5e4334" />
              <polygon points="0,-68 -24,-22 24,-22" fill={tree.c} />
              <polygon points="0,-84 -19,-42 19,-42" fill={tree.c} />
              {snowy && <polygon points="0,-84 -11,-60 11,-60" fill={cap} opacity="0.9" />}
            </g>
          ))}
          <ellipse cx="268" cy="268" rx="14" ry="8" fill={rock} />
        </g>
      )
    case 'mountains':
      return (
        <g>
          <polygon points="122,268 202,158 286,268" fill={accentA} />
          <polygon points="184,184 202,158 221,184 209,178 202,188 194,178" fill={cap} />
          <polygon points="348,268 438,144 522,268" fill={rock} />
          <polygon points="416,174 438,144 461,174 447,168 438,180 428,168" fill={cap} />
          <polygon points="222,268 278,194 334,268" fill={accentA} opacity="0.88" />
          <polygon points="264,213 278,194 292,213 282,208 278,215 272,208" fill={cap} opacity="0.92" />
          {/* Foothill pines */}
          <polygon points="154,268 164,236 174,268" fill={accentB} />
          <polygon points="484,268 494,234 504,268" fill={accentB} />
        </g>
      )
    case 'tundra':
      return (
        <g>
          <polygon points="136,268 184,190 232,268" fill={accentA} />
          <polygon points="184,190 206,226 172,232" fill={cap} opacity="0.82" />
          <polygon points="402,268 456,184 506,268" fill={accentB} />
          <polygon points="456,184 480,224 444,230" fill={cap} opacity="0.85" />
          <ellipse cx="250" cy="264" rx="22" ry="11" fill={rock} />
          <ellipse cx="392" cy="266" rx="18" ry="9" fill={rock} opacity="0.85" />
          <path d="M160 272 Q225 256 290 272 Z" fill={cap} opacity="0.65" />
          <path d="M362 272 Q435 254 494 272 Z" fill={cap} opacity="0.65" />
        </g>
      )
    case 'coast':
      return (
        <g>
          {/* Coastal water cove + foam */}
          <path d="M364 268 Q448 254 532 274 Q454 300 358 286 Z" fill={accentB} opacity="0.88" />
          <path d="M388 274 Q420 268 452 274" fill="none" stroke="#e8fbff" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
          <path d="M432 283 Q462 278 492 283" fill="none" stroke="#e8fbff" strokeWidth="2.5" strokeLinecap="round" opacity="0.65" />
          {/* Striped lighthouse */}
          <g transform="translate(432 260)">
            <ellipse cx="0" cy="6" rx="26" ry="10" fill={rock} />
            <polygon points="-11,2 -8,-52 8,-52 11,2" fill="#f7f4ec" />
            <polygon points="-9.5,-22 -8.6,-36 8.6,-36 9.5,-22" fill="#e5625e" />
            <rect x="-10" y="-56" width="20" height="5" rx="2" fill="#3a4559" />
            <rect x="-7" y="-66" width="14" height="10" rx="2" fill={windowGlow ? '#ffe794' : '#d6ecf7'} />
            <polygon points="-10,-66 0,-77 10,-66" fill="#e5625e" />
          </g>
          {/* Coastal pines */}
          <g transform="translate(182 264)">
            <rect x="-3" y="-16" width="6" height="18" rx="2" fill="#6b4f3a" />
            <circle cx="0" cy="-26" r="18" fill={accentA} />
            <circle cx="14" cy="-20" r="13" fill={accentA} />
            <circle cx="-13" cy="-19" r="12" fill={accentA} />
          </g>
        </g>
      )
    case 'grasslands':
      return (
        <g>
          <path d="M122 272 Q204 234 292 272 Z" fill={accentA} opacity="0.6" />
          <path d="M352 272 Q442 232 522 272 Z" fill={accentA} opacity="0.52" />
          {/* Broadleaf / savanna trees */}
          <g transform="translate(188 264)">
            <rect x="-4" y="-32" width="8" height="34" rx="3" fill="#6b4e37" />
            <ellipse cx="0" cy="-40" rx="34" ry="16" fill={accentA} />
            <ellipse cx="14" cy="-46" rx="20" ry="12" fill={accentB} opacity="0.55" />
          </g>
          <g transform="translate(446 264)">
            <rect x="-4" y="-26" width="8" height="28" rx="3" fill="#6b4e37" />
            <ellipse cx="0" cy="-34" rx="28" ry="14" fill={accentA} />
          </g>
          <ellipse cx="256" cy="268" rx="14" ry="7" fill={rock} />
        </g>
      )
    case 'urban': {
      const lit = windowGlow ? '#ffe08a' : '#dbe8f5'
      return (
        <g>
          <g fill={accentA}>
            <rect x="148" y="208" width="36" height="60" rx="4" />
            <rect x="190" y="182" width="44" height="86" rx="4" />
            <rect x="404" y="192" width="42" height="76" rx="4" />
            <rect x="452" y="216" width="34" height="52" rx="4" />
          </g>
          <rect x="238" y="220" width="30" height="48" rx="4" fill={accentB} />
          <rect x="372" y="224" width="28" height="44" rx="4" fill={accentB} />
          {/* Windows */}
          <g fill={lit} opacity={windowGlow ? 0.92 : 0.45}>
            {[218, 232, 246].map((y) => (
              <g key={`l-${y}`}>
                <rect x="156" y={y} width="7" height="8" rx="1.5" />
                <rect x="169" y={y} width="7" height="8" rx="1.5" />
              </g>
            ))}
            {[194, 210, 226, 242].map((y) => (
              <g key={`m-${y}`}>
                <rect x="199" y={y} width="8" height="9" rx="1.5" />
                <rect x="215" y={y} width="8" height="9" rx="1.5" />
              </g>
            ))}
            {[204, 220, 236].map((y) => (
              <g key={`r-${y}`}>
                <rect x="413" y={y} width="8" height="9" rx="1.5" />
                <rect x="429" y={y} width="8" height="9" rx="1.5" />
              </g>
            ))}
            {[226, 240].map((y) => (
              <g key={`f-${y}`}>
                <rect x="460" y={y} width="6" height="7" rx="1.5" />
                <rect x="472" y={y} width="6" height="7" rx="1.5" />
              </g>
            ))}
          </g>
          {snowy && (
            <g fill={cap} opacity="0.9">
              <rect x="148" y="206" width="36" height="5" rx="2.5" />
              <rect x="190" y="180" width="44" height="5" rx="2.5" />
              <rect x="404" y="190" width="42" height="5" rx="2.5" />
              <rect x="452" y="214" width="34" height="5" rx="2.5" />
            </g>
          )}
        </g>
      )
    }
  }
}

/**
 * Illustrated 2D SVG biome diorama fallback used when WebGL is unavailable,
 * crashes, or loses context. Matches the 3D diorama's palette, weather, lighting,
 * biome silhouettes, and customized explorer without rendering raw debug labels.
 */
export function DioramaFallback({
  scene,
  onAskExplorer,
  onRetry3D,
}: {
  scene: RoundScene
  onAskExplorer?: () => void
  onRetry3D?: () => void
}) {
  const avatar = useAvatar()
  const sky = skyForWeather(scene.lighting, scene.weather)
  const lighting = LIGHTING_PALETTES[scene.lighting]
  const biome = BIOME_PALETTES[scene.biome]

  const isRain = scene.weather === 'rain' || scene.weather === 'storm'
  const isSnow = scene.weather === 'snow'
  const isFog = scene.weather === 'fog'
  const isNight = scene.lighting === 'night'
  const isDusk = scene.lighting === 'dusk'
  const isCold = scene.temperatureBand === 'freezing' || scene.temperatureBand === 'cold'
  const snowy = isSnow || (scene.temperatureBand === 'freezing' && scene.biome !== 'desert')

  const showClouds = scene.weather !== 'fog' && (scene.weather !== 'clear' || !isNight)
  const showAurora =
    isNight &&
    (scene.biome === 'tundra' || scene.biome === 'mountains') &&
    (scene.weather === 'clear' || scene.weather === 'cloudy' || isSnow)

  const cloudColor =
    scene.weather === 'storm'
      ? '#546078'
      : isDusk
        ? '#e8b39a'
        : isNight
          ? '#52658a'
          : '#f5f9fe'

  const { stars, precip } = useMemo(() => {
    const rng = createRng(scene.seed ^ 0x2d51a9)
    const starList = Array.from({ length: isNight ? 42 : 16 }, () => ({
      x: randRange(rng, 24, 616),
      y: randRange(rng, 18, 210),
      r: randRange(rng, 1.0, 2.2),
      opacity: randRange(rng, 0.4, 0.95),
    }))
    const precipList = Array.from({ length: isRain ? 28 : isSnow ? 24 : 0 }, () => ({
      x: randRange(rng, 90, 550),
      y: randRange(rng, 70, 290),
      delay: randRange(rng, 0, 1.8),
      size: randRange(rng, 2.2, 4.2),
    }))
    return { stars: starList, precip: precipList }
  }, [scene.seed, isNight, isRain, isSnow])

  const hairColor = avatar.hairColor ?? '#4a3228'
  const shirtColor = avatar.shirtColor ?? '#57c4e8'
  const pantsColor = avatar.pantsColor ?? '#333b67'
  const shoeColor = avatar.shoeColor ?? '#895236'

  const cloudList =
    scene.weather === 'clear'
      ? [
          { x: 145, y: 112, s: 0.9 },
          { x: 472, y: 100, s: 0.8 },
        ]
      : [
          { x: 138, y: 108, s: 1.05 },
          { x: 282, y: 86, s: 1.15 },
          { x: 454, y: 104, s: 1.1 },
          { x: 540, y: 136, s: 0.85 },
        ]

  const celestialColor = isNight ? '#f4f7ff' : isDusk ? '#ffd08a' : '#fff7d1'
  const celestialHalo = isNight ? '#8fb6ff' : isDusk ? '#ff9d66' : '#ffe899'

  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden select-none"
      style={{ background: sky.gradient }}
      aria-label={`${biome.label} diorama scene`}
    >
      <div className="relative flex aspect-[640/460] w-full max-w-[820px] items-center justify-center px-3">
        <svg
          viewBox="0 0 640 460"
          className="h-full w-full overflow-visible"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id={`celestial-${scene.seed}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={celestialHalo} stopOpacity="0.55" />
              <stop offset="100%" stopColor={celestialHalo} stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`aurora-${scene.seed}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#52f2bf" stopOpacity="0" />
              <stop offset="35%" stopColor="#52f2bf" stopOpacity="0.45" />
              <stop offset="68%" stopColor="#8f7cff" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#8f7cff" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`island-belly-${scene.seed}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={biome.underside} />
              <stop offset="100%" stopColor="#14112a" stopOpacity="0.88" />
            </linearGradient>
          </defs>

          {/* Stars (night / dusk) */}
          {lighting.stars && (
            <g>
              {stars.map((star, idx) => (
                <circle
                  key={idx}
                  cx={star.x}
                  cy={star.y}
                  r={star.r}
                  fill="#ffffff"
                  opacity={isRain || isFog ? star.opacity * 0.45 : star.opacity}
                />
              ))}
            </g>
          )}

          {/* Aurora ribbon (tundra / mountains at night) */}
          {showAurora && (
            <path
              d="M90 128 Q210 66 330 112 T560 92 L560 144 Q440 164 330 156 T90 168 Z"
              fill={`url(#aurora-${scene.seed})`}
            />
          )}

          {/* Sun / Moon */}
          {!isFog && scene.weather !== 'storm' && (
            <g transform="translate(510 92)">
              <circle r="56" fill={`url(#celestial-${scene.seed})`} />
              <circle r="21" fill={celestialColor} opacity={scene.weather === 'cloudy' || isRain || isSnow ? 0.78 : 1} />
            </g>
          )}

          {/* Clouds */}
          {showClouds && (
            <g fill={cloudColor} opacity={scene.weather === 'clear' ? 0.85 : 0.94}>
              {cloudList.map((cloud, idx) => (
                <g key={idx} transform={`translate(${cloud.x} ${cloud.y}) scale(${cloud.s})`}>
                  <ellipse cx="0" cy="4" rx="34" ry="15" />
                  <circle cx="-14" cy="-4" r="14" />
                  <circle cx="8" cy="-8" r="17" />
                  <circle cx="24" cy="0" r="12" />
                </g>
              ))}
            </g>
          )}

          {/* Floating diorama island */}
          <g className="tg-diorama-float">
            <ellipse cx="320" cy="390" rx="150" ry="18" fill="#090718" opacity="0.28" />

            {/* Rounded pebble underside */}
            <path
              d="M114 276 Q142 356 320 364 Q498 356 526 276 Z"
              fill={`url(#island-belly-${scene.seed})`}
            />

            {/* Overhanging terrain cap */}
            <ellipse
              cx="320"
              cy="274"
              rx="214"
              ry="34"
              fill={snowy ? biome.snowyGround : biome.ground}
            />
            <ellipse
              cx="320"
              cy="270"
              rx="192"
              ry="22"
              fill="#ffffff"
              opacity="0.1"
            />

            {/* Biome-specific silhouettes */}
            <BiomeSilhouettes
              biome={scene.biome}
              accentA={biome.accentA}
              accentB={biome.accentB}
              rock={biome.rock}
              snowy={snowy}
              windowGlow={lighting.windowGlow}
            />

            {/* Explorer standing on the central pad */}
            <g transform="translate(320 268)">
              <ellipse cx="0" cy="4" rx="16" ry="5.5" fill="#090718" opacity="0.3" />
              {/* Boots */}
              <ellipse cx="-6" cy="1" rx="5" ry="3.2" fill={shoeColor} />
              <ellipse cx="6" cy="1" rx="5" ry="3.2" fill={shoeColor} />
              {/* Legs / pants */}
              <rect x="-10" y="-16" width="8" height="17" rx="3.5" fill={pantsColor} />
              <rect x="2" y="-16" width="8" height="17" rx="3.5" fill={pantsColor} />
              {/* Torso / shirt */}
              <rect x="-13" y="-42" width="26" height="28" rx="9" fill={shirtColor} />
              {/* Cozy scarf in cold/freezing climates */}
              {isCold && <rect x="-11" y="-44" width="22" height="6" rx="3" fill="#ff9da3" />}
              {/* Head */}
              <circle cx="0" cy="-54" r="13.5" fill="#f7d3b5" />
              {/* Hair cap */}
              <path d="M-13.5 -55 A13.5 13.5 0 0 1 13.5 -55 Q8 -61 0 -60 Q-8 -61 -13.5 -55 Z" fill={hairColor} />
              {/* Eyes */}
              <circle cx="-4.5" cy="-53" r="1.6" fill="#1b2a10" />
              <circle cx="4.5" cy="-53" r="1.6" fill="#1b2a10" />
              {/* Umbrella during rain/storm */}
              {isRain && (
                <g transform="translate(15 -42)">
                  <line x1="0" y1="12" x2="0" y2="-32" stroke="#fbf7ee" strokeWidth="2.4" strokeLinecap="round" />
                  <path d="M-24 -30 Q0 -52 24 -30 Z" fill="#c0f66b" />
                </g>
              )}
            </g>
          </g>

          {/* Precipitation & fog overlays */}
          {isRain && (
            <g stroke="#d8ecff" strokeWidth="1.8" strokeLinecap="round" opacity="0.65">
              {precip.map((drop, idx) => (
                <line
                  key={idx}
                  x1={drop.x}
                  y1={drop.y}
                  x2={drop.x - 5}
                  y2={drop.y + 16}
                  className="tg-diorama-precip"
                  style={{ animationDelay: `${drop.delay.toFixed(2)}s` }}
                />
              ))}
            </g>
          )}

          {isSnow && (
            <g fill="#ffffff" opacity="0.88">
              {precip.map((flake, idx) => (
                <circle
                  key={idx}
                  cx={flake.x}
                  cy={flake.y}
                  r={flake.size * 0.7}
                  className="tg-diorama-precip"
                  style={{ animationDelay: `${flake.delay.toFixed(2)}s` }}
                />
              ))}
            </g>
          )}

          {isFog && (
            <g opacity="0.45">
              <ellipse cx="260" cy="242" rx="180" ry="26" fill={sky.fogColor} />
              <ellipse cx="400" cy="282" rx="190" ry="28" fill={sky.fogColor} />
            </g>
          )}
        </svg>

        {/* Accessible click target aligned over the 2D explorer on the island */}
        {onAskExplorer && (
          <button
            type="button"
            onClick={onAskExplorer}
            aria-label="Tap explorer for a weather note"
            title="Ask your explorer about the weather"
            className="absolute left-1/2 top-[51%] size-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-transparent transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-lime-400"
          />
        )}
      </div>

      {onRetry3D && (
        <button
          type="button"
          onClick={onRetry3D}
          className="surface-flat pointer-events-auto absolute bottom-4 left-4 z-20 flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-cream shadow-card transition-colors hover:bg-space-600"
        >
          <Icon name="refresh" size={14} className="text-lime-300" />
          Reload 3D view
        </button>
      )}
    </div>
  )
}
