import { useEffect, useRef, useState } from 'react'
import type { LatLon } from '../../api/types'
import type { StreetResult } from '../../api/singleplayer'
import { browserMapsKey, loadGoogleMaps, onMapsAuthFailure } from './googleMaps'

export function GuessMap({
  guess,
  onChange,
  results = [],
  interactive = true,
}: {
  guess?: LatLon | null
  onChange?: (point: LatLon) => void
  results?: StreetResult[]
  interactive?: boolean
}) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<google.maps.Map | null>(null)
  const marker = useRef<google.maps.Marker | null>(null)
  const canSelect = useRef(interactive)
  useEffect(() => {
    canSelect.current = interactive
    marker.current?.setDraggable(interactive)
  }, [interactive])
  const callback = useRef(onChange)
  useEffect(() => {
    callback.current = onChange
  }, [onChange])
  const initialResults = useRef(results)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!browserMapsKey()) return
    let cancelled = false
    let observer: ResizeObserver | null = null
    let tilesTimer: ReturnType<typeof setTimeout>
    const unsubscribe = onMapsAuthFailure(() =>
      setError('Map access denied. Check Maps API configuration.'),
    )
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
          keyboardShortcuts: true,
          zoomControl: true,
          zoomControlOptions: { position: maps.ControlPosition.LEFT_TOP },
          backgroundColor: '#c5d3d7',
        })
        setError(null)
        map.current = instance
        tilesTimer = setTimeout(() => {
          if (!cancelled)
            setError(
              'Map tiles could not be loaded. Check your connection and retry.',
            )
        }, 20000)
        instance.addListener('tilesloaded', () => {
          clearTimeout(tilesTimer)
          if (!cancelled) setError(null)
        })
        instance.addListener('click', (event: google.maps.MapMouseEvent) => {
          if (canSelect.current && event.latLng)
            callback.current?.({
              lat: event.latLng.lat(),
              lon: event.latLng.lng(),
            })
        })
        const pin = (point: LatLon, color: string, label: string) =>
          new maps.Marker({
            map: instance,
            position: { lat: point.lat, lng: point.lon },
            title: label,
            icon: {
              path: maps.SymbolPath.CIRCLE,
              fillColor: color,
              fillOpacity: 1,
              strokeColor: '#fff',
              strokeWeight: 3,
              scale: 8,
            },
          })
        if (initialResults.current.length) {
          const bounds = new maps.LatLngBounds()
          for (const result of initialResults.current) {
            overlays.push(
              pin(
                result.guess,
                '#a78bfa',
                `Round ${result.number}: your guess`,
              ),
              pin(
                result.actual,
                '#9deb39',
                `Round ${result.number}: correct location`,
              ),
            )
            const path = [result.guess, result.actual].map((point) => ({
              lat: point.lat,
              lng: point.lon,
            }))
            path.forEach((point) => bounds.extend(point))
            overlays.push(
              new maps.Polyline({
                map: instance,
                path,
                geodesic: true,
                strokeColor: '#663ab8',
                strokeOpacity: 0.8,
                strokeWeight: 3,
              }),
            )
          }
          instance.fitBounds(bounds, 56)
          maps.event.addListenerOnce(instance, 'idle', () => {
            if ((instance.getZoom() ?? 0) > 13) instance.setZoom(13)
          })
        }
        observer = new ResizeObserver(() => {
          maps.event.trigger(instance, 'resize')
          if (initialResults.current.length) {
            const b = new maps.LatLngBounds()
            initialResults.current.forEach((r) => {
              b.extend({ lat: r.actual.lat, lng: r.actual.lon })
              b.extend({ lat: r.guess.lat, lng: r.guess.lon })
            })
            instance.fitBounds(b, 56)
          }
        })
        observer.observe(container.current)
      })
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message)
      })
    return () => {
      cancelled = true
      clearTimeout(tilesTimer)
      unsubscribe()
      observer?.disconnect()
      overlays.forEach((overlay) => overlay.setMap(null))
      marker.current?.setMap(null)
      marker.current = null
      if (map.current) google.maps.event.clearInstanceListeners(map.current)
      map.current = null
    }
  }, [retry])
  // Synchronize the pin after map initialization, including saved guesses.
  // Changing editability preserves the map, its zoom, and its center.
  useEffect(() => {
    let cancelled = false
    if (!guess) {
      marker.current?.setMap(null)
      marker.current = null
      return
    }
    if (!browserMapsKey()) return
    void loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !map.current) return
        const position = { lat: guess.lat, lng: guess.lon }
        if (marker.current) {
          marker.current.setPosition(position)
          marker.current.setDraggable(interactive)
        } else {
          marker.current = new maps.Marker({
            map: map.current,
            position,
            draggable: interactive,
            title: 'Your guess. Drag to move.',
            icon: {
              path: maps.SymbolPath.CIRCLE,
              fillColor: '#8759d8',
              fillOpacity: 1,
              strokeColor: '#fff',
              strokeWeight: 3,
              scale: 9,
            },
          })
          marker.current.addListener(
            'dragend',
            (event: google.maps.MapMouseEvent) => {
              if (canSelect.current && event.latLng)
                callback.current?.({
                  lat: event.latLng.lat(),
                  lon: event.latLng.lng(),
                })
            },
          )
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [guess, interactive, retry])
  return (
    <div className="sp-map-surface">
      <div
        className="sp-google-map"
        ref={container}
        aria-label={
          interactive
            ? 'World map. Click to place your guess.'
            : 'Round result map'
        }
      />
      {!browserMapsKey() && (
        <div className="sp-map-unavailable">
          <span aria-hidden="true">◎</span>
          <strong>World map</strong>
          <small>Google Maps browser key is missing</small>
        </div>
      )}
      {error && (
        <div className="sp-map-failure" role="alert">
          <p>{error}</p>
          <button className="tg-control tg-control--light" onClick={() => setRetry((r) => r + 1)}>Retry map</button>
        </div>
      )}
    </div>
  )
}
