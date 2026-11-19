import type { DragEndEvent, LeafletMouseEvent, Marker as LeafletMarker } from 'leaflet'
import { divIcon } from 'leaflet'
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet'
import type { LatLon } from '../../api/types'
import 'leaflet/dist/leaflet.css'
import './MapPicker.css'

export interface MapPickerProps {
  /** Current guess. When null, no marker is shown until the map is clicked. */
  guess: LatLon | null
  /** Called with the new guess whenever the marker is dropped or moved. */
  onChange: (guess: LatLon) => void
  /** Extra markers to render read-only (e.g. the revealed actual location). */
  actual?: LatLon | null
  center?: LatLon
  zoom?: number
  interactive?: boolean
}

const DEFAULT_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const DEFAULT_MAP_ATTRIBUTION = '&copy; OpenStreetMap contributors'
const DEFAULT_MAP_CENTER: LatLon = { lat: 20, lon: 0 }
const DEFAULT_MAP_ZOOM = 2

const GUESS_MARKER_ICON = divIcon({
  className: 'tg-map-pin tg-map-pin--guess',
  html: '<span aria-hidden="true"></span>',
  iconSize: [28, 38],
  iconAnchor: [14, 36],
})

const ACTUAL_MARKER_ICON = divIcon({
  className: 'tg-map-pin tg-map-pin--actual',
  html: '<span aria-hidden="true"></span>',
  iconSize: [28, 38],
  iconAnchor: [14, 36],
})

function toTuple({ lat, lon }: LatLon): [number, number] {
  return [lat, lon]
}

function toLatLon(lat: number, lng: number): LatLon {
  return { lat, lon: lng }
}

function MapClickHandler({ onMapClick, interactive }: { onMapClick: (guess: LatLon) => void; interactive: boolean }) {
  useMapEvents({
    click(event: LeafletMouseEvent) {
      if (interactive) onMapClick(toLatLon(event.latlng.lat, event.latlng.lng))
    },
  })
  return null
}

export function MapPicker({
  guess,
  onChange,
  actual = null,
  center = DEFAULT_MAP_CENTER,
  zoom = DEFAULT_MAP_ZOOM,
  interactive = true,
}: MapPickerProps) {
  const tileUrl = import.meta.env.VITE_TILE_URL || DEFAULT_TILE_URL
  const attribution = import.meta.env.VITE_MAP_ATTRIBUTION || DEFAULT_MAP_ATTRIBUTION

  function handleMarkerDragEnd(event: DragEndEvent) {
    const marker = event.target as LeafletMarker
    const latlng = marker.getLatLng()
    onChange(toLatLon(latlng.lat, latlng.lng))
  }

  return (
    <div className="tg-map-picker" data-testid="map-picker">
      <MapContainer center={toTuple(center)} zoom={zoom} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
        <TileLayer url={tileUrl} attribution={attribution} />
        <MapClickHandler onMapClick={onChange} interactive={interactive} />
        {guess ? (
          <Marker
            position={toTuple(guess)}
            icon={GUESS_MARKER_ICON}
            draggable={interactive}
            eventHandlers={interactive ? { dragend: handleMarkerDragEnd } : undefined}
          />
        ) : null}
        {actual ? <Marker position={toTuple(actual)} icon={ACTUAL_MARKER_ICON} /> : null}
      </MapContainer>
    </div>
  )
}
