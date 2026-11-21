import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { api } from '../../services'
import { browserMapsKey, loadGoogleMaps } from './googleMaps'
import { Icon } from '../ui/Icon'

// Interactive Street View panorama. Resolves the round's panoId to a position,
// then hides every Google control (address, links, fullscreen) so the location
// stays a mystery. Falls back to an art-directed placeholder when the key is
// missing or the panorama can't load.

type Phase = 'loading' | 'ready' | 'error'

export function StreetView({
  panoId,
  onReady,
}: {
  panoId: string
  onReady?: () => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const panorama = useRef<google.maps.StreetViewPanorama | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')

  useEffect(() => {
    if (!browserMapsKey()) {
      setPhase('error')
      return
    }
    let cancelled = false

    void (async () => {
      try {
        const position = await api.geo.resolvePano(panoId)
        const maps = await loadGoogleMaps()
        if (cancelled || !container.current) return
        const instance = new maps.StreetViewPanorama(container.current, {
          position: { lat: position.lat, lng: position.lon },
          pov: { heading: 165, pitch: 0 },
          zoom: 1,
          addressControl: false,
          fullscreenControl: false,
          motionTracking: false,
          motionTrackingControl: false,
          showRoadLabels: false,
          clickToGo: false,
          linksControl: false,
          panControl: false,
          zoomControl: false,
          disableDefaultUI: true,
          enableCloseButton: false,
        })
        panorama.current = instance
        const check = () => {
          if (cancelled) return
          const status = instance.getStatus()
          if (status === 'OK') {
            setPhase('ready')
            onReady?.()
          }
        }
        instance.addListener('pano_changed', check)
        // Some panoramas report OK immediately; also poll once shortly after.
        window.setTimeout(check, 1200)
      } catch {
        if (!cancelled) setPhase('error')
      }
    })()

    return () => {
      cancelled = true
      if (panorama.current) {
        google.maps.event.clearInstanceListeners(panorama.current)
        panorama.current = null
      }
    }
  }, [panoId, onReady])

  return (
    <div className="relative h-full w-full overflow-hidden bg-space-800">
      <div ref={container} className="h-full w-full" />
      <AnimatePresence>
        {phase === 'loading' && (
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-space-800"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <span className="text-lime-300">
              <Icon name="globe" size={34} className="animate-spin-slow" />
            </span>
            <p className="text-sm font-semibold text-muted">Setting off into the world…</p>
          </motion.div>
        )}
        {phase === 'error' && (
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <PanoramaPlaceholder />
            <p className="rounded-full bg-space-900/70 px-4 py-1.5 text-xs font-semibold text-muted">
              Street View unavailable — keep your eyes on the clues
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** A friendly stylized panorama shown when real Street View can't load. */
function PanoramaPlaceholder() {
  return (
    <div className="absolute inset-0" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, #2a4a7f 0%, #5e89c9 34%, #a9c6e8 46%, #c9d9e8 50%, #8a9a82 51%, #55634c 70%, #2e2f34 100%)',
        }}
      />
      <div className="absolute left-1/2 top-1/2 h-[52%] w-[140%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-space-900/30 blur-xl" />
    </div>
  )
}
