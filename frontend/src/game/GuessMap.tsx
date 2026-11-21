import { Button } from '../components/ui/Button'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { LatLon } from '../api/types'
import type { StreetResult } from '../api/singleplayer'
import { browserMapsKey, loadGoogleMaps, onMapsAuthFailure } from './googleMaps'
import { duration, ease, spring } from '../lib/motion'

export interface GuessMapMarker {
  position: LatLon
  title: string
  label?: string
  color?: string
}

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
  results?: StreetResult[]
  /** Read-only participant pins shown alongside the round results. */
  markers?: GuessMapMarker[]
  interactive?: boolean
  countryBorders?: boolean
  /** Optional, explicitly labeled tutorial practice when the provider is unavailable. */
  fallback?: ReactNode
}) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<google.maps.Map | null>(null)
  const marker = useRef<google.maps.Marker | null>(null)
  const extraMarkers = useRef<google.maps.Marker[]>([])
  const [mapReady, setMapReady] = useState(0)
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
  const markersRef = useRef(markers)
  const markerSignature = markers
    .map(
      (entry) =>
        `${entry.position.lat},${entry.position.lon},${entry.title},${entry.color ?? ''},${entry.label ?? ''}`,
    )
    .join('|')
  const [error, setError] = useState<string | null>(null)
  const [tilesReady, setTilesReady] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    markersRef.current = markers
  }, [markers])
  useEffect(() => {
    if (!browserMapsKey()) return
    let cancelled = false
    let observer: ResizeObserver | null = null
    let resizeFrame = 0
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
          styles: countryBorders ? [] : [
            { featureType: 'administrative.country', stylers: [{ visibility: 'off' }] },
            { featureType: 'administrative.province', stylers: [{ visibility: 'off' }] },
          ],
        })
        setError(null)
        setTilesReady(false)
        map.current = instance
        tilesTimer = setTimeout(() => {
          if (!cancelled)
            setError(
              'Map tiles could not be loaded. Check your connection and retry.',
            )
        }, 20000)
        instance.addListener('tilesloaded', () => {
          clearTimeout(tilesTimer)
          if (!cancelled) {
            setError(null)
            setTilesReady(true)
          }
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
                result.actual,
                '#9deb39',
                `Round ${result.number}: correct location`,
              ),
            )
            if (result.guess) {
              overlays.push(
                pin(
                  result.guess,
                  '#a78bfa',
                  `Round ${result.number}: your guess`,
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
            } else {
              bounds.extend({
                lat: result.actual.lat,
                lng: result.actual.lon,
              })
            }
          }
          instance.fitBounds(bounds, 56)
          maps.event.addListenerOnce(instance, 'idle', () => {
            if ((instance.getZoom() ?? 0) > 13) instance.setZoom(13)
          })
        }
        setMapReady((version) => version + 1)
        observer = new ResizeObserver(() => {
          cancelAnimationFrame(resizeFrame)
          resizeFrame = requestAnimationFrame(() => {
          if (cancelled || !container.current?.clientWidth || !container.current.clientHeight) return
          const center = instance.getCenter()
          maps.event.trigger(instance, 'resize')
          if (center) instance.setCenter(center)
          if (initialResults.current.length) {
            const b = new maps.LatLngBounds()
            initialResults.current.forEach((r) => {
              b.extend({ lat: r.actual.lat, lng: r.actual.lon })
              if (r.guess) b.extend({ lat: r.guess.lat, lng: r.guess.lon })
            })
            instance.fitBounds(b, 56)
          }
          })
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
      cancelAnimationFrame(resizeFrame)
      overlays.forEach((overlay) => overlay.setMap(null))
      extraMarkers.current.forEach((overlay) => overlay.setMap(null))
      extraMarkers.current = []
      marker.current?.setMap(null)
      marker.current = null
      if (map.current) google.maps.event.clearInstanceListeners(map.current)
      map.current = null
    }
  }, [retry, countryBorders])
  // Participant pins arrive progressively while a multiplayer round settles,
  // so synchronize them without recreating the map.
  useEffect(() => {
    if (!mapReady || !browserMapsKey()) return
    let cancelled = false
    void loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !map.current) return
        const nextMarkers = markersRef.current
        extraMarkers.current.forEach((overlay) => overlay.setMap(null))
        extraMarkers.current = nextMarkers.map(
          (entry) =>
            new maps.Marker({
              map: map.current!,
              position: { lat: entry.position.lat, lng: entry.position.lon },
              title: entry.title,
              ...(entry.label ? { label: entry.label } : {}),
              icon: {
                path: maps.SymbolPath.CIRCLE,
                fillColor: entry.color ?? '#f59e0b',
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 3,
                scale: 8,
              },
            }),
        )
        if (initialResults.current.length || nextMarkers.length) {
          const bounds = new maps.LatLngBounds()
          initialResults.current.forEach((result) => {
            bounds.extend({ lat: result.actual.lat, lng: result.actual.lon })
            if (result.guess)
              bounds.extend({ lat: result.guess.lat, lng: result.guess.lon })
          })
          nextMarkers.forEach((entry) =>
            bounds.extend({
              lat: entry.position.lat,
              lng: entry.position.lon,
            }),
          )
          map.current.fitBounds(bounds, 56)
          maps.event.addListenerOnce(map.current, 'idle', () => {
            if ((map.current?.getZoom() ?? 0) > 13) map.current?.setZoom(13)
          })
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
      extraMarkers.current.forEach((overlay) => overlay.setMap(null))
      extraMarkers.current = []
    }
  }, [markerSignature, mapReady, retry])
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
  }, [guess, interactive, retry, countryBorders])
  return (
    <div className="sp-map-surface">
      <div
        className="sp-google-map"
        data-tiles-ready={tilesReady}
        ref={container}
        aria-label={
          interactive
            ? 'World map. Click to place your guess.'
            : 'Round result map'
        }
      />
      <AnimatePresence>
        {fallback && (!browserMapsKey() || error) ? fallback : !browserMapsKey() && (
          <motion.div
            key="unavailable"
            className="sp-map-unavailable"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1, transition: spring.gentle }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: duration.fast, ease: ease.out } }}
          >
            <span aria-hidden="true">◎</span>
            <strong>World map</strong>
            <small>Google Maps browser key is missing</small>
          </motion.div>
        )}
        {error && !fallback && (
          <motion.div
            key="failure"
            className="sp-map-failure"
            role="alert"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1, transition: spring.gentle }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: duration.fast, ease: ease.out } }}
          >
            <p>{error}</p>
            <Button variant="light" onClick={() => setRetry((r) => r + 1)}>Retry map</Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
