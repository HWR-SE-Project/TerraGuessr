import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { RoundScene } from '../../lib/contracts'
import { usePrefersReducedMotion, useWebGLSupport } from '../hooks'
import { Icon } from '../../components/ui/Icon'
import { IslandBase } from './IslandBase'
import { BiomeProps } from './BiomeProps'
import { WeatherEffects } from './WeatherEffects'
import { DioramaExplorer } from './DioramaExplorer'
import { DioramaFallback } from './DioramaFallback'
import { LIGHTING_PALETTES, skyForWeather } from './palettes'
import { quipsForScene } from './quips'

const DEFAULT_CAMERA_POSITION: [number, number, number] = [0, 5.2, 12.2]
const NOTE_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

class DioramaErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}

function CompassSync({
  controlsRef,
  needleRef,
}: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>
  needleRef: React.RefObject<HTMLSpanElement | null>
}) {
  useFrame(() => {
    const controls = controlsRef.current
    const needle = needleRef.current
    if (!controls || !needle) return
    const degrees = (controls.getAzimuthalAngle() * 180) / Math.PI
    needle.style.transform = `rotate(${degrees.toFixed(1)}deg)`
  })
  return null
}

function DioramaCanvasContent({
  scene,
  reducedMotion,
  controlsRef,
  needleRef,
  onInteract,
  activeQuip,
  quipKey,
  onDismissQuip,
}: {
  scene: RoundScene
  reducedMotion: boolean
  controlsRef: React.RefObject<OrbitControlsImpl | null>
  needleRef: React.RefObject<HTMLSpanElement | null>
  onInteract: () => void
  activeQuip: string | null
  quipKey: number
  onDismissQuip: () => void
}) {
  const lighting = LIGHTING_PALETTES[scene.lighting]
  const sky = skyForWeather(scene.lighting, scene.weather)

  return (
    <>
      <fog attach="fog" args={[sky.fogColor, sky.fogNear, sky.fogFar]} />
      <ambientLight intensity={0.32} color={lighting.hemiSky} />
      <hemisphereLight args={[lighting.hemiSky, lighting.hemiGround, lighting.hemiIntensity]} />
      <directionalLight
        position={lighting.sunPosition}
        color={lighting.sunColor}
        intensity={lighting.sunIntensity}
      />
      <directionalLight
        position={[-6, 4, -7]}
        color={lighting.rimColor}
        intensity={lighting.rimIntensity}
      />
      <IslandBase scene={scene} reducedMotion={reducedMotion} />
      <BiomeProps scene={scene} reducedMotion={reducedMotion} />
      <WeatherEffects scene={scene} reducedMotion={reducedMotion} />
      <Suspense fallback={null}>
        <DioramaExplorer
          scene={scene}
          reducedMotion={reducedMotion}
          onInteract={onInteract}
          activeQuip={activeQuip}
          quipKey={quipKey}
          onDismissQuip={onDismissQuip}
        />
      </Suspense>
      <OrbitControls
        ref={controlsRef}
        target={[0, 0.75, 0]}
        enablePan={false}
        enableDamping={!reducedMotion}
        dampingFactor={0.07}
        minDistance={5.8}
        maxDistance={17}
        minPolarAngle={0.42}
        maxPolarAngle={Math.PI / 2 - 0.08}
      />
      <CompassSync controlsRef={controlsRef} needleRef={needleRef} />
    </>
  )
}

/**
 * Interactive 3D stylized Biome Diorama starring the player's customized
 * avatar, with 360° OrbitControls, left-docked camera-synced compass, live
 * weather particles, and smoothly animated R04-safe explorer notes.
 */
export function BiomeDiorama({ scene }: { scene: RoundScene }) {
  const webglSupported = useWebGLSupport()
  const reducedMotion = usePrefersReducedMotion()
  const [contextLost, setContextLost] = useState(false)
  const [quipIndex, setQuipIndex] = useState<number | null>(null)
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const needleRef = useRef<HTMLSpanElement | null>(null)

  const quips = useMemo(() => quipsForScene(scene), [scene])
  const sky = skyForWeather(scene.lighting, scene.weather)

  const cycleQuip = useCallback(() => {
    setQuipIndex((previous) => (previous === null ? 0 : (previous + 1) % quips.length))
  }, [quips.length])

  const dismissQuip = useCallback(() => {
    setQuipIndex(null)
  }, [])

  useEffect(() => {
    if (quipIndex === null) return
    const timeout = window.setTimeout(() => setQuipIndex(null), 6500)
    return () => window.clearTimeout(timeout)
  }, [quipIndex])

  const resetNorth = useCallback(() => {
    controlsRef.current?.reset()
  }, [])

  const fallback = <DioramaFallback scene={scene} onAskExplorer={cycleQuip} />
  const activeQuip = quipIndex !== null ? quips[quipIndex] ?? null : null
  const useWebGL = webglSupported && !contextLost

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ background: sky.gradient }}
    >
      {useWebGL ? (
        <DioramaErrorBoundary fallback={fallback}>
          <Canvas
            className="h-full w-full"
            camera={{ position: DEFAULT_CAMERA_POSITION, fov: 38, near: 0.1, far: 120 }}
            dpr={[1, 1.5]}
            gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
            onCreated={({ gl }) => {
              const handleLost = (event: Event) => {
                event.preventDefault()
                setContextLost(true)
              }
              gl.domElement.addEventListener('webglcontextlost', handleLost, false)
            }}
          >
            <DioramaCanvasContent
              scene={scene}
              reducedMotion={reducedMotion}
              controlsRef={controlsRef}
              needleRef={needleRef}
              onInteract={cycleQuip}
              activeQuip={activeQuip}
              quipKey={quipIndex ?? 0}
              onDismissQuip={dismissQuip}
            />
          </Canvas>
        </DioramaErrorBoundary>
      ) : (
        fallback
      )}

      {/* Left-anchored R04-safe explorer note for non-WebGL fallback */}
      {!useWebGL && (
        <div className="pointer-events-none absolute left-4 top-20 z-20 max-w-xs sm:max-w-sm lg:bottom-[4.5rem] lg:top-auto lg:w-[340px]">
          <AnimatePresence>
            {activeQuip && (
              <motion.div
                key="explorer-note-card"
                initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
                transition={{ duration: reducedMotion ? 0.12 : 0.34, ease: NOTE_EASE }}
                role="status"
                aria-live="polite"
                className="surface-flat pointer-events-auto px-4 py-3 text-left shadow-card"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-display text-[11px] font-semibold uppercase tracking-widest text-lime-300">
                    <Icon name="sparkle" size={12} />
                    Explorer note
                  </span>
                  <button
                    type="button"
                    onClick={dismissQuip}
                    aria-label="Dismiss explorer note"
                    className="flex size-5 items-center justify-center rounded-full text-subtle transition-colors hover:bg-white/10 hover:text-cream"
                  >
                    <Icon name="close" size={12} />
                  </button>
                </div>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p
                    key={quipIndex}
                    initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                    transition={{ duration: reducedMotion ? 0.1 : 0.22, ease: NOTE_EASE }}
                    className="text-sm leading-relaxed font-medium text-cream"
                  >
                    “{activeQuip}”
                  </motion.p>
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Left-docked camera-synced compass + explorer note trigger */}
      <div className="pointer-events-auto absolute bottom-4 left-4 z-20 hidden items-center gap-2 lg:flex">
        <button
          type="button"
          onClick={resetNorth}
          aria-label="Compass. Click to reset camera north."
          title="Reset camera orientation"
          className="relative flex size-11 items-center justify-center rounded-full border border-white/8 bg-space-700 text-cream shadow-card transition-colors hover:bg-space-600"
        >
          <span className="absolute top-1 text-[8px] leading-none font-bold text-subtle">N</span>
          <span
            ref={needleRef}
            className="mt-1.5 flex h-5 w-2 flex-col items-center justify-center"
            style={{ transform: 'rotate(0deg)' }}
          >
            <span className="h-2.5 w-1.5 rounded-t-full bg-rose-400" />
            <span className="h-2.5 w-1.5 rounded-b-full bg-white/75" />
          </span>
        </button>
        <button
          type="button"
          onClick={cycleQuip}
          title="Ask your explorer about the weather"
          className="flex items-center gap-1.5 rounded-full border border-white/8 bg-space-700 px-3.5 py-2.5 text-xs font-bold text-cream shadow-card transition-colors hover:bg-space-600"
        >
          <Icon name="sparkle" size={14} className="text-lime-300" />
          Explorer note
        </button>
      </div>
    </div>
  )
}
