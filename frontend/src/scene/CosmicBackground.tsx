import { useEffect, useMemo, useRef } from 'react'
import type { CSSProperties, RefObject } from 'react'

// A fixed, pointer-transparent cosmic backdrop that sits behind every page:
// deep navy-black space, drifting nebula glows (screen-blended for soft,
// additive light), a distant spinning galaxy, a faraway orbiting planet,
// a faint galactic haze, star depth with natural glow/bloom on brighter
// stars, drifting dust, blinking satellites and the occasional shooting
// star. Pure CSS animation (no WebGL) so it stays cheap everywhere this
// mounts — including behind live gameplay — and never competes with the
// Home page's 3D scene. The star layers also carry a light parallax tied
// to cursor position (see useStarParallax below); everything else stays
// purely ambient and ignores the pointer.

// Max px shift at full tilt for a layer with --depth: 1. Kept small and
// scaled per layer so the effect reads as a subtle depth cue, never a
// cursor-chasing gimmick.
const PARALLAX_RANGE = 12

// Tracks pointer position and writes it as CSS vars (--mx/--my, in px) on
// the given element, throttled to once per animation frame. Layers read
// these through `calc(var(--mx) * var(--depth))` and ease toward the new
// value via a CSS transition, so no continuous rAF loop is needed — work
// only happens while the pointer is actually moving.
function useStarParallax(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let ticking = false
    let lastX = 0
    let lastY = 0

    const apply = () => {
      ticking = false
      const nx = (lastX / window.innerWidth - 0.5) * 2
      const ny = (lastY / window.innerHeight - 0.5) * 2
      el.style.setProperty('--mx', `${(nx * PARALLAX_RANGE).toFixed(2)}px`)
      el.style.setProperty('--my', `${(ny * PARALLAX_RANGE).toFixed(2)}px`)
    }

    const handleMove = (e: MouseEvent) => {
      lastX = e.clientX
      lastY = e.clientY
      if (!ticking) {
        ticking = true
        requestAnimationFrame(apply)
      }
    }

    window.addEventListener('mousemove', handleMove, { passive: true })
    return () => window.removeEventListener('mousemove', handleMove)
  }, [ref])
}

function mulberry(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

function stars(count: number, seed: number, maxPx: number, alphaMin = 0.25, alphaMax = 0.85, glow = 0) {
  const rand = mulberry(seed)
  const shadows: string[] = []
  for (let i = 0; i < count; i++) {
    const x = Math.round(rand() * 100 * 10) / 10
    const y = Math.round(rand() * 100 * 10) / 10
    const size = maxPx === 1 ? 1 : Math.round(rand() * (maxPx - 1)) + 1
    const alpha = alphaMin + rand() * (alphaMax - alphaMin)
    // A touch of blur on brighter stars reads as a soft natural glow/bloom;
    // distant, dim stars stay crisp pinpoints (glow stays 0 for those layers).
    shadows.push(`${x}vw ${y}vh ${glow}px ${size}px rgba(255,255,255,${alpha.toFixed(2)})`)
  }
  return shadows.join(', ')
}

interface Meteor {
  id: number
  top: number
  left: number
  angle: number
  distance: number
  duration: number
  delay: number
}

function meteors(count: number, seed: number): Meteor[] {
  const rand = mulberry(seed)
  return Array.from({ length: count }, (_, id) => {
    const duration = 16 + rand() * 14
    return {
      id,
      top: rand() * 42,
      left: rand() * 70,
      angle: 18 + rand() * 20,
      distance: 180 + rand() * 160,
      duration,
      delay: -rand() * duration,
    }
  })
}

interface Satellite {
  id: number
  top: number
  dy: number
  duration: number
  delay: number
}

function satellites(count: number, seed: number): Satellite[] {
  const rand = mulberry(seed)
  return Array.from({ length: count }, (_, id) => {
    const duration = 75 + rand() * 60
    return {
      id,
      top: rand() * 55,
      dy: 10 + rand() * 45,
      duration,
      delay: -rand() * duration,
    }
  })
}

interface Dust {
  id: number
  top: number
  left: number
  size: number
  dx: number
  dy: number
  duration: number
  twinkle: number
  delay: number
  color: string
}

// Pale, desaturated tones — dust lit by distant starlight, not coloured confetti.
const DUST_COLORS = ['#eef2ff', '#cfe0ff', '#fff2dc']

function dust(count: number, seed: number): Dust[] {
  const rand = mulberry(seed)
  return Array.from({ length: count }, (_, id) => {
    const duration = 14 + rand() * 11
    return {
      id,
      top: 10 + rand() * 80,
      left: rand() * 100,
      size: 1 + rand() * 2,
      dx: (rand() - 0.5) * 50,
      dy: -30 - rand() * 50,
      duration,
      twinkle: 4 + rand() * 5,
      delay: -rand() * duration,
      color: DUST_COLORS[id % DUST_COLORS.length],
    }
  })
}

export function CosmicBackground() {
  // Most of the sky holds still — only a handful of stars twinkle, and they
  // twinkle out of phase with each other, so the field never pulses as one.
  // Brighter layers carry a touch of blur for a soft, natural glow/bloom.
  const starsStatic = useMemo(() => stars(85, 11, 2, 0.08, 0.38), [])
  const starsAnchor = useMemo(() => stars(8, 37, 2, 0.28, 0.48, 1), [])
  const twinkleA = useMemo(() => stars(4, 42, 2, 0.4, 0.72, 1.2), [])
  const twinkleB = useMemo(() => stars(3, 73, 2, 0.4, 0.68, 1.2), [])
  const twinkleC = useMemo(() => stars(2, 97, 1, 0.45, 0.78, 1.4), [])
  const meteorList = useMemo(() => meteors(3, 17), [])
  const satelliteList = useMemo(() => satellites(2, 29), [])
  const dustList = useMemo(() => dust(5, 53), [])

  const rootRef = useRef<HTMLDivElement>(null)
  useStarParallax(rootRef)

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden animate-breathe"
    >
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(130% 100% at 50% -8%, #161a35 0%, #0a0c1e 45%, #04050b 100%)',
        }}
      />

      {/* Distant galaxy: a slow-spinning smudge of colour tucked in a corner. */}
      <div
        className="cosmic-galaxy opacity-20"
        style={{
          right: '-12%',
          top: '-14%',
          width: '52vw',
          height: '52vw',
          background:
            'radial-gradient(ellipse at 35% 40%, rgba(130,120,195,0.3) 0%, transparent 55%), radial-gradient(ellipse at 62% 62%, rgba(100,165,190,0.16) 0%, transparent 60%)',
        }}
      />

      {/* A faraway planet/moon, drifting along a shallow orbital arc — kept
          small and faint so it reads as ambient depth, never competing with
          the page's own focal planet/character. */}
      <div
        className="cosmic-orbit opacity-12"
        style={{
          right: '6%',
          bottom: '8%',
          width: '58px',
          height: '58px',
          background:
            'radial-gradient(circle at 35% 35%, rgba(150,165,205,0.55) 0%, rgba(90,100,140,0.25) 45%, rgba(20,22,40,0) 72%)',
        }}
      />

      {/* Nebula glows — slowly drifting for depth, kept soft and atmospheric. */}
      <div
        className="absolute top-[-20%] h-[60vh] w-[80vw] animate-nebula-drift rounded-full opacity-18 blur-3xl"
        style={{
          left: '50%',
          marginLeft: '-40vw',
          background: 'radial-gradient(closest-side, #2f2a5a 0%, transparent 78%)',
          mixBlendMode: 'screen',
        }}
      />
      <div
        className="absolute right-[-10%] top-[30%] h-[55vh] w-[45vw] animate-nebula-drift rounded-full opacity-13 blur-3xl"
        style={{
          background: 'radial-gradient(closest-side, #163b4a 0%, transparent 78%)',
          mixBlendMode: 'screen',
          animationDelay: '-9s',
        }}
      />
      <div
        className="absolute bottom-[-15%] left-[-5%] h-[50vh] w-[45vw] animate-nebula-drift rounded-full opacity-10 blur-3xl"
        style={{
          background: 'radial-gradient(closest-side, #3c2f52 0%, transparent 78%)',
          mixBlendMode: 'screen',
          animationDelay: '-17s',
        }}
      />

      {/* Faint galactic haze — barely-there dust lane, not a decorative sweep. */}
      <div
        className="cosmic-haze left-[-10%] top-[6%] h-[30vh] w-[120%]"
        style={{
          background:
            'linear-gradient(100deg, transparent 0%, rgba(180,195,225,0.1) 35%, rgba(150,170,210,0.08) 55%, transparent 85%)',
        }}
      />

      {/* Star + dust layers, wrapped in a soft radial mask (.cosmic-starfield)
          that recedes the field near the centre of the viewport — giving the
          hero's focal planet/character (or any page's centred content)
          breathing room instead of an even, flat scatter edge-to-edge.

          Each star div is a near-zero (1x1px) point — the visible "stars"
          are entirely its box-shadow clones, positioned via vw/vh offsets.
          rounded-full is required for those clones to render as circles
          rather than squares, but it only takes effect once the host box
          has nonzero size — border-radius on a true 0x0 box computes to 0
          and every shadow clone paints square. Giving the div large
          dimensions (e.g. inset-0) would make every clone a full-size copy
          of the box instead of a tiny dot, so 1x1px is the floor. The bulk
          of the field is static — only small, phase-staggered groups
          twinkle, so brightness never pulses in unison. Each layer also
          carries a --depth used by .cosmic-parallax (see index.css) to
          shift slightly with the cursor — brighter/"closer" layers move a
          bit more than the dim, distant ones. */}
      <div className="cosmic-starfield absolute inset-0">
        <div
          className="cosmic-parallax absolute left-0 top-0 h-px w-px rounded-full"
          style={{ boxShadow: starsStatic, '--depth': 0.12 } as CSSProperties}
        />
        <div
          className="cosmic-parallax absolute left-0 top-0 h-px w-px rounded-full"
          style={{ boxShadow: starsAnchor, '--depth': 0.45 } as CSSProperties}
        />
        <div
          className="cosmic-parallax absolute left-0 top-0 h-px w-px rounded-full animate-twinkle"
          style={{ boxShadow: twinkleA, animationDuration: '6s', '--depth': 0.32 } as CSSProperties}
        />
        <div
          className="cosmic-parallax absolute left-0 top-0 h-px w-px rounded-full animate-twinkle"
          style={{ boxShadow: twinkleB, animationDuration: '4.5s', animationDelay: '-2.1s', '--depth': 0.26 } as CSSProperties}
        />
        <div
          className="cosmic-parallax absolute left-0 top-0 h-px w-px rounded-full animate-twinkle"
          style={{ boxShadow: twinkleC, animationDuration: '3.6s', animationDelay: '-1.3s', '--depth': 0.18 } as CSSProperties}
        />

        {/* Ambient glowing dust — soft motes that rise and fade. */}
        {dustList.map((d) => (
          <div
            key={d.id}
            className="cosmic-dust"
            style={
              {
                top: `${d.top}%`,
                left: `${d.left}%`,
                width: `${d.size}px`,
                height: `${d.size}px`,
                background: `radial-gradient(circle, ${d.color}aa 0%, ${d.color}00 75%)`,
                mixBlendMode: 'screen',
                animationDuration: `${d.duration}s, ${d.twinkle}s`,
                animationDelay: `${d.delay}s, ${d.delay}s`,
                '--dust-dx': `${d.dx}px`,
                '--dust-dy': `${d.dy}px`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      {/* Satellites — tiny blinking lights drifting slowly across the sky. */}
      {satelliteList.map((s) => (
        <div
          key={s.id}
          className="cosmic-satellite"
          style={
            {
              top: `${s.top}%`,
              left: 0,
              animationDuration: `${s.duration}s, 2.3s`,
              animationDelay: `${s.delay}s, 0s`,
              '--sat-dy': `${s.dy}vh`,
            } as CSSProperties
          }
        />
      ))}

      {/* Shooting stars — rare diagonal streaks. */}
      {meteorList.map((m) => (
        <div
          key={m.id}
          className="cosmic-meteor"
          style={
            {
              top: `${m.top}%`,
              left: `${m.left}%`,
              animationDuration: `${m.duration}s`,
              animationDelay: `${m.delay}s`,
              '--meteor-angle': `${m.angle}deg`,
              '--meteor-dist': `${m.distance}px`,
            } as CSSProperties
          }
        />
      ))}

      {/* A rare, soft celestial flare — a distant star quietly flickering. */}
      <div
        className="cosmic-event"
        style={{
          left: '18%',
          top: '22%',
          width: '80px',
          height: '80px',
          background: 'radial-gradient(circle, rgba(255,225,185,0.55) 0%, rgba(255,225,185,0) 70%)',
        }}
      />

      {/* Vignette to focus the centre */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(120% 120% at 50% 40%, transparent 50%, rgba(3,3,9,0.78) 100%)' }}
      />
    </div>
  )
}
