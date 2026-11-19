import { useEffect, useRef, useState } from 'react'
import type { StreetRound } from '../../api/singleplayer'
import { loadGoogleMaps, onMapsAuthFailure } from './googleMaps'

export function StreetViewViewer({
  round,
  onReady,
  showCompass,
  scrollZoom,
}: {
  round: StreetRound
  onReady: (ready: boolean) => void
  showCompass: boolean
  scrollZoom: boolean
}) {
  const element = useRef<HTMLDivElement>(null)
  const panorama = useRef<google.maps.StreetViewPanorama | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [heading, setHeading] = useState(0)
  const settings = useRef({ scrollZoom })
  useEffect(() => {
    settings.current = { scrollZoom }
  }, [scrollZoom])
  useEffect(() => {
    let cancelled = false
    let viewer: google.maps.StreetViewPanorama | null = null
    let timer: ReturnType<typeof setTimeout>
    onReady(false)
    const fail = (message: string) => {
      if (!cancelled) {
        clearTimeout(timer)
        onReady(false)
        setError(message)
      }
    }
    const unsubscribe = onMapsAuthFailure(() =>
      fail(
        'Street View access was denied. The Maps API configuration needs attention.',
      ),
    )
    void loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !element.current) return
        viewer = new maps.StreetViewPanorama(element.current, {
          pano: round.panoId,
          pov: { heading: 0, pitch: 0 },
          zoom: 0,
          addressControl: false,
          showRoadLabels: false,
          imageDateControl: false,
          fullscreenControl: false,
          enableCloseButton: false,
          linksControl: true,
          clickToGo: true,
          panControl: false,
          zoomControl: true,
          zoomControlOptions: { position: maps.ControlPosition.LEFT_CENTER },
          motionTracking: false,
          motionTrackingControl: false,
          scrollwheel: settings.current.scrollZoom,
        })
        setError(null)
        panorama.current = viewer
        viewer.addListener('status_changed', () => {
          if (cancelled || !viewer) return
          clearTimeout(timer)
          if (viewer.getStatus() === maps.StreetViewStatus.OK) {
            setError(null)
            onReady(true)
          } else
            fail(
              'This panorama could not be loaded. Retry the view or restart the expedition.',
            )
        })
        viewer.addListener('pov_changed', () => {
          if (!cancelled && viewer) setHeading(viewer.getPov().heading)
        })
        timer = setTimeout(
          () =>
            fail(
              'Street View is taking too long. Check your connection and retry.',
            ),
          25000,
        )
      })
      .catch((cause: Error) => fail(cause.message))
    return () => {
      cancelled = true
      clearTimeout(timer)
      unsubscribe()
      if (viewer) {
        google.maps.event.clearInstanceListeners(viewer)
        viewer.setVisible(false)
      }
      panorama.current = null
    }
  }, [round.id, round.panoId, attempt, onReady])
  useEffect(() => {
    panorama.current?.setOptions({ scrollwheel: scrollZoom })
  }, [scrollZoom])
  return (
    <>
      <div
        className="sp-panorama"
        ref={element}
        aria-label="Interactive Street View panorama"
      />
      {showCompass && (
        <button
          className="sp-compass sp-glass"
          aria-label="Face north"
          title="Face north"
          onClick={() => panorama.current?.setPov({ heading: 0, pitch: 0 })}
        >
          <span style={{ transform: `rotate(${-heading}deg)` }}>
            N<i />
          </span>
        </button>
      )}
      {error && (
        <div className="sp-view-error sp-glass" role="alert">
          <strong>Street View unavailable</strong>
          <p>{error}</p>
          <button
            className="sp-primary"
            onClick={() => setAttempt((a) => a + 1)}
          >
            Retry panorama
          </button>
        </div>
      )}
    </>
  )
}
