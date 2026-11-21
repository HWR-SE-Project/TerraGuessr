import { useMemo } from 'react'
import type { CSSProperties } from 'react'

// A fixed, pointer-transparent cosmic backdrop that sits behind every page:
// deep indigo-violet space, soft nebula glows, and two twinkling star layers.
// Pure CSS (no WebGL) so it stays cheap on every screen and never competes
// with the Home 3D scene. Respects prefers-reduced-motion via the global
// media rule.

function mulberry(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

function stars(count: number, seed: number, maxPx: number) {
  const rand = mulberry(seed)
  const shadows: string[] = []
  for (let i = 0; i < count; i++) {
    const x = Math.round(rand() * 100 * 10) / 10
    const y = Math.round(rand() * 100 * 10) / 10
    const size = maxPx === 1 ? 1 : Math.round(rand() * (maxPx - 1)) + 1
    const alpha = 0.25 + rand() * 0.6
    shadows.push(`${x}vw ${y}vh 0 ${size}px rgba(255,255,255,${alpha.toFixed(2)})`)
  }
  return shadows.join(', ')
}

export function CosmicBackground() {
  const layerA = useMemo(() => stars(130, 42, 1), [])
  const layerB = useMemo(() => stars(55, 99, 2), [])

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(120% 90% at 50% -10%, #241d4a 0%, #14112a 42%, #0e0b20 100%)',
        }}
      />
      {/* Nebula glows */}
      <div
        className="absolute left-1/2 top-[-20%] h-[60vh] w-[80vw] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{ background: 'radial-gradient(closest-side, #4a3d8f 0%, transparent 70%)' }}
      />
      <div
        className="absolute right-[-10%] top-[30%] h-[55vh] w-[45vw] rounded-full opacity-30 blur-3xl"
        style={{ background: 'radial-gradient(closest-side, #1d4a5e 0%, transparent 70%)' }}
      />
      <div
        className="absolute bottom-[-15%] left-[-5%] h-[50vh] w-[45vw] rounded-full opacity-25 blur-3xl"
        style={{ background: 'radial-gradient(closest-side, #5e3a6e 0%, transparent 70%)' }}
      />
      {/* Star layers */}
      <div className="absolute inset-0 animate-twinkle" style={{ boxShadow: layerA } as CSSProperties} />
      <div
        className="absolute inset-0 animate-twinkle opacity-70"
        style={{ boxShadow: layerB, animationDelay: '-2s' } as CSSProperties}
      />
      {/* Vignette to focus the centre */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 120% at 50% 40%, transparent 55%, rgba(9,7,24,0.7) 100%)' }} />
    </div>
  )
}
