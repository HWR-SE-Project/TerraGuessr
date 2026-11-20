import { useEffect, useRef, useState } from 'react'
import type { StreetRound } from '../../api/singleplayer'
import { loadGoogleMaps, onMapsAuthFailure } from './googleMaps'

export function StreetViewViewer({
  round,
  onReady,
  showCompass,
  scrollZoom,
  onRetryLocation,
  retrying = false,
}: {
  round: StreetRound
  onReady: (ready: boolean) => void
  showCompass: boolean
  scrollZoom: boolean
  onRetryLocation?: () => void
  retrying?: boolean
}) {
  const element = useRef<HTMLDivElement>(null)
  const panorama = useRef<google.maps.StreetViewPanorama | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [heading, setHeading] = useState(0)
  const [currentPano, setCurrentPano] = useState(round.panoId)
  const [ready, setReady] = useState(false)
  const settings = useRef({ scrollZoom })
  useEffect(() => {
    settings.current = { scrollZoom }
  }, [scrollZoom])
  useEffect(() => {
    let cancelled = false
    let viewer: google.maps.StreetViewPanorama | null = null
    let timer: ReturnType<typeof setTimeout>
    let linksTimer: ReturnType<typeof setTimeout>
    onReady(false)
    const fail = (message: string) => {
      if (!cancelled) {
        clearTimeout(timer)
        clearTimeout(linksTimer)
        onReady(false)
        setReady(false)
        setError(message)
      }
    }
    const unsubscribe = onMapsAuthFailure(() =>
      fail(
        'Google Maps rejected browser access. Check Maps JavaScript API activation, billing, and allowed website origins.',
      ),
    )
    void loadGoogleMaps()
      .then(async (maps) => {
        if (cancelled || !element.current) return
        timer = setTimeout(
          () =>
            fail(
              'Street View is taking too long. Check your connection and retry.',
            ),
          25000,
        )
        const { data } = await new maps.StreetViewService().getPanorama({
          pano: round.panoId,
        })
        if (cancelled) return
        if (!data.location?.pano) {
          fail(
            'This panorama is unavailable. Try another location to continue this round.',
          )
          return
        }
        viewer = new maps.StreetViewPanorama(element.current!, {
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
        const statusChanged = () => {
          if (cancelled || !viewer) return
          clearTimeout(timer)
          if (viewer.getStatus() === maps.StreetViewStatus.OK) {
            setError(null)
            onReady(true)
            setReady(true)
            setCurrentPano(viewer.getPano())
          } else
            fail(
              'This panorama could not be loaded. Retry the view or restart the expedition.',
            )
        }
        viewer.addListener('status_changed', statusChanged)
        if (viewer.getStatus() === maps.StreetViewStatus.OK) statusChanged()
        const checkLinks = () => {
          if (!cancelled && viewer && (viewer.getLinks()?.length ?? 0) > 0)
            clearTimeout(linksTimer)
        }
        viewer.addListener('links_changed', checkLinks)
        linksTimer = setTimeout(() => {
          if (viewer && !viewer.getLinks()?.length)
            fail(
              'This panorama has no connected streets. Try another location to continue this round.',
            )
        }, 5000)
        checkLinks()
        viewer.addListener('pano_changed', () => {
          if (!cancelled && viewer) setCurrentPano(viewer.getPano())
        })
        viewer.addListener('pov_changed', () => {
          if (!cancelled && viewer) setHeading(viewer.getPov().heading)
        })
      })
      .catch((cause: Error) => fail(cause.message))
    return () => {
      cancelled = true
      clearTimeout(timer)
      clearTimeout(linksTimer)
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
        tabIndex={0}
        onFocus={(event) => {
          if (event.target === event.currentTarget) panorama.current?.focus()
        }}
        data-panorama={currentPano}
        data-ready={ready}
        data-heading={heading}
      />
      {showCompass && (
        <button
          className="sp-compass tg-control sp-glass"
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
            className="sp-primary tg-control tg-control--primary"
            onClick={() => setAttempt((a) => a + 1)}
            disabled={retrying}
          >
            Retry panorama
          </button>
          {onRetryLocation && (
            <button
              className="sp-secondary tg-control"
              disabled={retrying}
              onClick={onRetryLocation}
            >
              {retrying ? 'Finding another panorama…' : 'Try another location'}
            </button>
          )}
        </div>
      )}
    </>
  )
}
