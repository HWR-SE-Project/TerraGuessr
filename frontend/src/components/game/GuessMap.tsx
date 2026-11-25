import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { LatLon } from '../../lib/contracts'
import { formatRegion } from '../../lib/format'
import { greatCircleSegments, normalizeCoordinates } from '../../lib/geodesic'

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

export interface MapCandidate {
  id: string
  name: string
  region: string
  lat: number
  lon: number
}

const DEFAULT_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'
const DEFAULT_ATTRIBUTION = 'Tiles &copy; Esri'
const PHYSICAL_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}'
const PHYSICAL_ATTRIBUTION = 'Tiles &copy; Esri &mdash; US National Park Service'

function pinIcon(color: string, size = 20): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:3px solid #ffffff;box-shadow:0 2px 8px rgba(5,3,20,0.45);"></span>`,
  })
}

function fitCandidateBounds(instance: L.Map, candidates: MapCandidate[]): boolean {
  if (candidates.length === 0) return false
  const size = instance.getSize()
  if (size.x <= 0 || size.y <= 0) return false
  const points: [number, number][] = candidates.map((candidate) => [candidate.lat, candidate.lon])
  if (points.length >= 2) {
    instance.fitBounds(L.latLngBounds(points), {
      paddingTopLeft: [50, 44],
      paddingBottomRight: [50, 32],
      maxZoom: 4,
      animate: false,
    })
  } else {
    instance.setView(points[0]!, 4, { animate: false })
  }
  return true
}

/**
 * Interactive world guessing map & read-only result reveal map backed by
 * Leaflet + Esri World Street Map raster tiles (English labels, country borders,
 * zero API keys), switching to Esri World Physical Map when borders are disabled.
 */
export function GuessMap({
  guess,
  submittedGuesses = [],
  onChange,
  candidates = [],
  selectedCandidateId = null,
  submittedCandidateIds = [],
  onSelectCandidate,
  results = [],
  markers = [],
  interactive = true,
  countryBorders = true,
}: {
  guess?: LatLon | null
  submittedGuesses?: LatLon[]
  onChange?: (point: LatLon) => void
  candidates?: MapCandidate[]
  selectedCandidateId?: string | null
  submittedCandidateIds?: string[]
  onSelectCandidate?: (candidate: MapCandidate) => void
  results?: MapResult[]
  markers?: MapMarker[]
  interactive?: boolean
  countryBorders?: boolean
  fallback?: ReactNode
}) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const guessMarkerRef = useRef<L.Marker | null>(null)
  const submittedLayerRef = useRef<L.LayerGroup | null>(null)
  const candidatesLayerRef = useRef<L.LayerGroup | null>(null)
  const candidateEntriesRef = useRef<
    Map<string, { marker: L.Marker; button: HTMLButtonElement; candidate: MapCandidate }>
  >(new Map())
  const revealLayerRef = useRef<L.LayerGroup | null>(null)
  const drawnReveal = useRef<string | null>(null)
  const fittedCandidatesRef = useRef<string | null>(null)
  const canSelect = useRef(interactive)
  const onChangeRef = useRef(onChange)
  const onSelectCandidateRef = useRef(onSelectCandidate)
  const candidatesRef = useRef(candidates)
  const submittedCandidateSetRef = useRef<Set<string>>(new Set(submittedCandidateIds))

  useEffect(() => {
    canSelect.current = interactive
  }, [interactive])
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])
  useEffect(() => {
    onSelectCandidateRef.current = onSelectCandidate
  }, [onSelectCandidate])

  const revealSignature = JSON.stringify([results, markers])
  const submittedSignature = JSON.stringify(submittedGuesses)
  const candidatesSignature = JSON.stringify(candidates)
  const submittedCandidateSignature = JSON.stringify(submittedCandidateIds)
  const candidatesSignatureRef = useRef(candidatesSignature)

  useEffect(() => {
    candidatesRef.current = candidates
    candidatesSignatureRef.current = candidatesSignature
  }, [candidates, candidatesSignature])

  // Initialize Leaflet map once.
  useEffect(() => {
    const el = container.current
    if (!el) return

    const instance = L.map(el, {
      center: [20, 0],
      zoom: 1,
      minZoom: 0.5,
      maxZoom: 14,
      zoomSnap: 0.5,
      zoomDelta: 0.5,
      worldCopyJump: true,
      maxBounds: [
        [-85, -Infinity],
        [85, Infinity],
      ],
      maxBoundsViscosity: 0.85,
      zoomControl: true,
      attributionControl: true,
    })

    const submittedLayer = L.layerGroup().addTo(instance)
    const candidatesLayer = L.layerGroup().addTo(instance)
    const revealLayer = L.layerGroup().addTo(instance)
    const candidateEntries = candidateEntriesRef.current
    mapRef.current = instance
    submittedLayerRef.current = submittedLayer
    candidatesLayerRef.current = candidatesLayer
    revealLayerRef.current = revealLayer

    instance.on('click', (event: L.LeafletMouseEvent) => {
      if (!canSelect.current || !onChangeRef.current) return
      onChangeRef.current(normalizeCoordinates(event.latlng.lat, event.latlng.lng))
    })

    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            instance.invalidateSize({ animate: false })
            if (
              candidatesRef.current.length > 0 &&
              fittedCandidatesRef.current !== candidatesSignatureRef.current
            ) {
              if (fitCandidateBounds(instance, candidatesRef.current)) {
                fittedCandidatesRef.current = candidatesSignatureRef.current
              }
            }
          })
        : null
    observer?.observe(el)

    return () => {
      observer?.disconnect()
      drawnReveal.current = null
      fittedCandidatesRef.current = null
      guessMarkerRef.current = null
      submittedLayerRef.current = null
      candidatesLayerRef.current = null
      candidateEntries.clear()
      revealLayerRef.current = null
      tileLayerRef.current = null
      mapRef.current = null
      instance.remove()
    }
  }, [])

  // Swap tile layer cleanly when countryBorders toggles (e.g. Hard mode physical map).
  useEffect(() => {
    const instance = mapRef.current
    if (!instance) return
    tileLayerRef.current?.remove()
    const customUrl = import.meta.env.VITE_MAP_TILE_URL?.trim()
    const customAttribution = import.meta.env.VITE_MAP_ATTRIBUTION?.trim()
    const usePhysical = !countryBorders && !customUrl
    const tileUrl = customUrl || (usePhysical ? PHYSICAL_TILE_URL : DEFAULT_TILE_URL)
    const attribution =
      customAttribution || (usePhysical ? PHYSICAL_ATTRIBUTION : DEFAULT_ATTRIBUTION)
    const layer = L.tileLayer(tileUrl, {
      maxNativeZoom: usePhysical ? 8 : 19,
      maxZoom: 19,
      attribution,
    }).addTo(instance)
    tileLayerRef.current = layer
    return () => {
      layer.remove()
    }
  }, [countryBorders])

  // Fit target, viewer guess, and other participants on reveal maps.
  useEffect(() => {
    const instance = mapRef.current
    const layer = revealLayerRef.current
    if (!instance || !layer || drawnReveal.current === revealSignature) return
    drawnReveal.current = revealSignature
    layer.clearLayers()

    const points: [number, number][] = []
    const addPin = (point: LatLon, color: string, title: string) => {
      const latLng: [number, number] = [point.lat, point.lon]
      points.push(latLng)
      L.marker(latLng, { icon: pinIcon(color, 18), title, interactive: true })
        .bindTooltip(title, { direction: 'top', offset: [0, -10] })
        .addTo(layer)
    }

    for (const result of results) {
      addPin(result.actual, '#a8e04e', 'Actual location')
      if (!result.guess) continue
      addPin(result.guess, '#a78bfa', result.label ?? 'Your guess')
      for (const segment of greatCircleSegments(result.guess, result.actual)) {
        L.polyline(segment, {
          color: '#8b5cf6',
          opacity: 0.85,
          weight: 3,
          dashArray: '6 4',
        }).addTo(layer)
      }
    }

    for (const marker of markers) {
      addPin(marker.position, marker.color ?? '#ffb45e', marker.title)
    }

    if (points.length >= 2) {
      instance.fitBounds(L.latLngBounds(points), { padding: [44, 44], maxZoom: 6 })
    } else if (points.length === 1) {
      instance.setView(points[0]!, 4)
    }
  }, [results, markers, revealSignature])

  // Easy-mode candidate markers plotted directly on the map.
  useEffect(() => {
    const instance = mapRef.current
    const layer = candidatesLayerRef.current
    if (!instance || !layer) return

    layer.clearLayers()
    candidateEntriesRef.current.clear()

    if (candidates.length === 0) {
      fittedCandidatesRef.current = null
      return
    }

    for (const candidate of candidates) {
      const marker = L.marker([candidate.lat, candidate.lon], {
        icon: L.divIcon({
          className: 'tg-candidate-marker',
          iconSize: [0, 0],
          iconAnchor: [0, 0],
          html: '',
        }),
        interactive: true,
        keyboard: false,
      }).addTo(layer)

      const el = marker.getElement()
      if (!el) continue
      L.DomEvent.disableClickPropagation(el)

      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'tg-candidate-pin'

      const dot = document.createElement('span')
      dot.className = 'tg-candidate-dot'
      dot.setAttribute('aria-hidden', 'true')

      button.append(dot)
      el.append(button)

      button.addEventListener('click', (event) => {
        event.stopPropagation()
        if (!canSelect.current || submittedCandidateSetRef.current.has(candidate.id)) return
        onSelectCandidateRef.current?.(candidate)
      })

      candidateEntriesRef.current.set(candidate.id, { marker, button, candidate })
    }

    if (fittedCandidatesRef.current !== candidatesSignature) {
      if (fitCandidateBounds(instance, candidates)) {
        fittedCandidatesRef.current = candidatesSignature
      }
    }
  }, [candidates, candidatesSignature])

  // Keep Easy-mode candidate selection, submitted, and disabled states in sync without recreating markers.
  useEffect(() => {
    const submitted = new Set(submittedCandidateIds)
    submittedCandidateSetRef.current = submitted

    for (const { marker, button, candidate } of candidateEntriesRef.current.values()) {
      const isSubmitted = submitted.has(candidate.id)
      const isSelected = !isSubmitted && selectedCandidateId === candidate.id
      const state = isSubmitted ? 'submitted' : isSelected ? 'selected' : 'available'
      const regionLabel = formatRegion(candidate.region)
      const baseLabel = regionLabel ? `${candidate.name}, ${regionLabel}` : candidate.name

      button.dataset.state = state
      button.disabled = !interactive || isSubmitted
      button.setAttribute('aria-pressed', String(isSelected))
      button.setAttribute('aria-label', isSubmitted ? `${baseLabel} (submitted)` : baseLabel)
      button.title = isSubmitted
        ? `${candidate.name} · Submitted`
        : regionLabel
          ? `${candidate.name} · ${regionLabel}`
          : candidate.name
      marker.setZIndexOffset(isSelected ? 500 : isSubmitted ? 250 : 100)
    }
  }, [candidatesSignature, selectedCandidateId, submittedCandidateIds, submittedCandidateSignature, interactive])

  // Previously submitted bets in the active round (Best-of-N).
  useEffect(() => {
    const layer = submittedLayerRef.current
    if (!layer) return
    layer.clearLayers()
    submittedGuesses.forEach((point, index) => {
      const title = `Submitted guess #${index + 1}`
      L.marker([point.lat, point.lon], {
        icon: pinIcon('#38bdf8', 16),
        title,
        interactive: true,
      })
        .bindTooltip(title, { direction: 'top', offset: [0, -8] })
        .addTo(layer)
    })
  }, [submittedGuesses, submittedSignature])

  // Interactive guess marker.
  useEffect(() => {
    const instance = mapRef.current
    if (!instance) return
    if (!guess) {
      guessMarkerRef.current?.remove()
      guessMarkerRef.current = null
      return
    }
    const latLng: [number, number] = [guess.lat, guess.lon]
    if (guessMarkerRef.current) {
      guessMarkerRef.current.setLatLng(latLng)
      if (interactive) guessMarkerRef.current.dragging?.enable()
      else guessMarkerRef.current.dragging?.disable()
    } else {
      const marker = L.marker(latLng, {
        icon: pinIcon('#8b5cf6', 20),
        draggable: interactive,
        title: 'Your guess',
      }).addTo(instance)
      marker.on('dragend', () => {
        if (!canSelect.current) return
        const pos = marker.getLatLng()
        onChangeRef.current?.(normalizeCoordinates(pos.lat, pos.lng))
      })
      guessMarkerRef.current = marker
    }
  }, [guess, interactive])

  const ariaLabel = !interactive
    ? 'Round result map'
    : candidates.length > 0
      ? 'World map with candidate locations. Click a location to select your guess.'
      : 'World map. Click to place your guess.'

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#8ea6b8]">
      <div
        ref={container}
        className="h-full w-full"
        aria-label={ariaLabel}
      />
      {candidates.length > 1 && (
        <button
          type="button"
          onClick={() => {
            const instance = mapRef.current
            if (instance) fitCandidateBounds(instance, candidates)
          }}
          className="absolute top-2 right-2 z-[800] rounded-lg border border-white/20 bg-space-900/90 px-2.5 py-1 text-[11px] font-bold text-cream shadow-md transition-colors hover:border-lime-400/60 hover:text-lime-300"
          title="Reset map view to show all locations"
        >
          Show all
        </button>
      )}
    </div>
  )
}
