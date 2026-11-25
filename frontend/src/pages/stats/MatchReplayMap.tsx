import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { MatchHistoryRound } from '../../lib/contracts'
import { formatDistance, formatScore } from '../../lib/format'
import { greatCircleSegments } from '../../lib/geodesic'

const TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'
const TILE_ATTRIBUTION = 'Tiles &copy; Esri'

function pinIcon(background: string, textColor: string, label: string): L.DivIcon {
  const size = 26
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;background:${background};color:${textColor};font-size:11px;font-weight:800;border:2.5px solid #ffffff;box-shadow:0 2px 8px rgba(5,3,20,0.55);">${label}</span>`,
  })
}

export function MatchReplayMap({ round }: { round: MatchHistoryRound }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const map = L.map(el, {
      center: [20, 0],
      zoom: 1.5,
      minZoom: 1,
      maxZoom: 12,
      zoomSnap: 0.5,
      worldCopyJump: true,
      maxBounds: [
        [-85, -Infinity],
        [85, Infinity],
      ],
      maxBoundsViscosity: 0.85,
      zoomControl: true,
      attributionControl: true,
    })

    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 14,
    }).addTo(map)

    const layer = L.layerGroup().addTo(map)
    mapRef.current = map
    layerRef.current = layer

    const timer = window.setTimeout(() => map.invalidateSize(), 120)
    return () => {
      window.clearTimeout(timer)
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return

    layer.clearLayers()
    const points: [number, number][] = [[round.actual.lat, round.actual.lon]]
    const placeLabel = round.placeName ?? `Round ${round.roundNumber}`

    if (round.guess) {
      points.push([round.guess.lat, round.guess.lon])
      const segments = greatCircleSegments(round.guess, round.actual)
      for (const segment of segments) {
        L.polyline(segment, {
          color: '#c0f66b',
          weight: 3,
          opacity: 0.9,
          dashArray: '6 6',
        }).addTo(layer)
      }

      L.marker([round.guess.lat, round.guess.lon], {
        icon: pinIcon('#57c4e8', '#090718', String(round.roundNumber)),
        zIndexOffset: 300,
      })
        .bindTooltip(
          `Your guess · ${formatDistance(round.distanceKm)} (${formatScore(round.score)} pts)`,
          { direction: 'top', offset: [0, -10] },
        )
        .addTo(layer)
    }

    L.marker([round.actual.lat, round.actual.lon], {
      icon: pinIcon('#c0f66b', '#1b2a10', String(round.roundNumber)),
      zIndexOffset: 400,
    })
      .bindTooltip(`Target: ${placeLabel}`, {
        direction: 'top',
        offset: [0, -10],
      })
      .addTo(layer)

    if (points.length >= 2) {
      map.fitBounds(L.latLngBounds(points), {
        padding: [42, 42],
        maxZoom: 7,
        animate: false,
      })
    } else {
      map.setView(points[0]!, 4, { animate: false })
    }
  }, [round])

  return (
    <div className="relative h-64 w-full overflow-hidden rounded-2xl border border-white/10 bg-space-900 sm:h-72">
      <div ref={containerRef} className="h-full w-full" />
      <div className="pointer-events-none absolute bottom-2.5 left-2.5 z-[400] flex items-center gap-3 rounded-full bg-space-950/85 px-3 py-1 text-[11px] font-bold text-cream backdrop-blur-sm">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-lime-400" />
          Target
        </span>
        {round.guess ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-sky-400" />
            Your guess
          </span>
        ) : (
          <span className="text-rose-300">No guess submitted</span>
        )}
      </div>
    </div>
  )
}
