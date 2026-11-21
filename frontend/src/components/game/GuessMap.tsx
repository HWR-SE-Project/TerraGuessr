import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { LatLon } from '../../lib/contracts'
import { browserMapsKey, loadGoogleMaps } from './googleMaps'
import { Button } from '../ui/Button'

export interface MapResult {
  actual: LatLon
  guess: LatLon | null
  label?: string
}

export interface MapMarker {
  position: LatLon
  title: string
  label?: string
  color?: string
}

// The guessing map: an interactive world map for placing a guess, or a read-only
// reveal map for showing results. Google Maps JavaScript API under the hood.

export function GuessMap({
  guess,
  onChange,
  results = [],
  markers = [],
  interactive = true,
  countryBorders = true,
  fallback,
}: {
  guess?: LatLon | null
  onChange?: (point: LatLon) => void
  results?: MapResult[]
  markers?: MapMarker[]
  interactive?: boolean
  countryBorders?: boolean
  fallback?: ReactNode
}) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<google.maps.Map | null>(null)
  const guessMarker = useRef<google.maps.Marker | null>(null)
  const overlayRef = useRef<(google.maps.Marker | google.maps.Polyline)[]>([])
  const extraMarkers = useRef<google.maps.Marker[]>([])
  const canSelect = useRef(interactive)
  const onChangeRef = useRef(onChange)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    canSelect.current = interactive
  }, [interactive])
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const resultsSignature = results
    .map((r) => `${r.actual.lat},${r.actual.lon},${r.guess?.lat ?? ''},${r.guess?.lon ?? ''}`)
    .join('|')
  const markersSignature = markers
    .map((m) => `${m.position.lat},${m.position.lon},${m.color ?? ''},${m.label ?? ''}`)
    .join('|')

  // Initialize the map once.
  useEffect(() => {
    if (!browserMapsKey()) {
      setError('World map unavailable')
      return
    }
    let cancelled = false
    const overlays: (google.maps.Marker | google.maps.Polyline)[] = []
    void loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !container.current) return
        const instance = new maps.Map(container.current, {
          center: { lat: 20, lng: 0 },
          zoom: 0,
          minZoom: 0,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: 'greedy',
          keyboardShortcuts: false,
          zoomControl: true,
          zoomControlOptions: { position: maps.ControlPosition.LEFT_TOP },
          backgroundColor: '#8ea6b8',
          styles: countryBorders
            ? []
            : [
                { featureType: 'administrative.country', stylers: [{ visibility: 'off' }] },
                { featureType: 'administrative.province', stylers: [{ visibility: 'off' }] },
              ],
        })
        map.current = instance
        instance.addListener('click', (event: google.maps.MapMouseEvent) => {
          if (canSelect.current && event.latLng) {
            onChangeRef.current?.({ lat: event.latLng.lat(), lon: event.latLng.lng() })
          }
        })
        setError(null)
        setReady(true)
      })
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message)
      })
    return () => {
      cancelled = true
      overlays.forEach((overlay) => overlay.setMap(null))
      extraMarkers.current.forEach((overlay) => overlay.setMap(null))
      extraMarkers.current = []
      guessMarker.current?.setMap(null)
      guessMarker.current = null
      if (map.current) google.maps.event.clearInstanceListeners(map.current)
      map.current = null
    }
  }, [countryBorders])

  // Render result pins/lines.
  useEffect(() => {
    if (!ready || !map.current) return
    void loadGoogleMaps().then((maps) => {
      if (!map.current) return
      overlayRef.current.forEach((overlay) => overlay.setMap(null))
      overlayRef.current = []
      const bounds = new maps.LatLngBounds()
      const pin = (point: LatLon, color: string) =>
        new maps.Marker({
          map: map.current!,
          position: { lat: point.lat, lng: point.lon },
          icon: { path: maps.SymbolPath.CIRCLE, fillColor: color, fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3, scale: 9 },
        })
      results.forEach((result) => {
        overlayRef.current.push(pin(result.actual, '#a8e04e'))
        bounds.extend({ lat: result.actual.lat, lng: result.actual.lon })
        if (result.guess) {
          overlayRef.current.push(pin(result.guess, '#a78bfa'))
          bounds.extend({ lat: result.guess.lat, lng: result.guess.lon })
          overlayRef.current.push(
            new maps.Polyline({
              map: map.current!,
              path: [result.guess, result.actual].map((p) => ({ lat: p.lat, lng: p.lon })),
              geodesic: true,
              strokeColor: '#8b5cf6',
              strokeOpacity: 0.85,
              strokeWeight: 3,
            }),
          )
        }
      })
      if (results.length) map.current.fitBounds(bounds, 56)
    })
  }, [resultsSignature, ready])

  // Participant pins.
  useEffect(() => {
    if (!ready || !map.current) return
    void loadGoogleMaps().then((maps) => {
      if (!map.current) return
      extraMarkers.current.forEach((overlay) => overlay.setMap(null))
      extraMarkers.current = markers.map(
        (entry) =>
          new maps.Marker({
            map: map.current!,
            position: { lat: entry.position.lat, lng: entry.position.lon },
            title: entry.title,
            label: entry.label,
            icon: {
              path: maps.SymbolPath.CIRCLE,
              fillColor: entry.color ?? '#ffb45e',
              fillOpacity: 1,
              strokeColor: '#fff',
              strokeWeight: 3,
              scale: 9,
            },
          }),
      )
      if (markers.length) {
        const bounds = new maps.LatLngBounds()
        markers.forEach((entry) => bounds.extend({ lat: entry.position.lat, lng: entry.position.lon }))
        map.current.fitBounds(bounds, 56)
      }
    })
  }, [markersSignature, ready])

  // Guess marker.
  useEffect(() => {
    if (!ready || !map.current) return
    if (!guess) {
      guessMarker.current?.setMap(null)
      guessMarker.current = null
      return
    }
    void loadGoogleMaps().then((maps) => {
      if (!map.current) return
      const position = { lat: guess.lat, lng: guess.lon }
      if (guessMarker.current) {
        guessMarker.current.setPosition(position)
        guessMarker.current.setDraggable(interactive)
      } else {
        guessMarker.current = new maps.Marker({
          map: map.current,
          position,
          draggable: interactive,
          title: 'Your guess',
          icon: {
            path: maps.SymbolPath.CIRCLE,
            fillColor: '#8b5cf6',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 3,
            scale: 10,
          },
        })
        guessMarker.current.addListener('dragend', (event: google.maps.MapMouseEvent) => {
          if (canSelect.current && event.latLng) {
            onChangeRef.current?.({ lat: event.latLng.lat(), lon: event.latLng.lng() })
          }
        })
      }
    })
  }, [guess, interactive, ready])

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        ref={container}
        className="h-full w-full"
        aria-label={interactive ? 'World map. Click to place your guess.' : 'Round result map'}
      />
      <AnimatePresence>
        {error && (
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-space-800 p-6 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {fallback ? (
              fallback
            ) : (
              <>
                <span className="text-2xl">🗺️</span>
                <p className="max-w-xs text-sm font-semibold text-muted">{error}</p>
                <Button variant="tinted" size="sm" onClick={() => setError(null)}>
                  Retry map
                </Button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
