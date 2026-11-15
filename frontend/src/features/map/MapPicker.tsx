import type { DragEndEvent, LeafletMouseEvent, Marker as LeafletMarker } from 'leaflet';
import { divIcon } from 'leaflet';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import type { LatLon } from '../../api/types';
import 'leaflet/dist/leaflet.css';

export interface MapPickerProps {
  /** Current guess. When null, no marker is shown until the map is clicked. */
  guess: LatLon | null;
  /** Called with the new guess whenever the marker is dropped or moved (R08 client state). */
  onChange: (guess: LatLon) => void;
  /** Initial viewport center. Defaults to a neutral world view. */
  center?: LatLon;
  /** Initial zoom level. Defaults to 2 (whole world). */
  zoom?: number;
}

// Dev defaults (architecture.md §10 / ADR-0007). Production values come from
// import.meta.env; the tile provider is finalized at deploy time.
export const DEFAULT_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const DEFAULT_MAP_ATTRIBUTION = '© OpenStreetMap contributors';
export const DEFAULT_MAP_CENTER: LatLon = { lat: 20, lon: 0 };
export const DEFAULT_MAP_ZOOM = 2;

/** Inline marker avoids broken default Leaflet image URLs in production builds. */
const GUESS_MARKER_ICON = divIcon({
  className: 'tg-map-pin',
  html: '<span aria-hidden="true"></span>',
  iconSize: [28, 38],
  iconAnchor: [14, 36],
});

/** WGS84 LatLon -> Leaflet LatLngTuple ([lat, lng]). */
function toTuple({ lat, lon }: LatLon): [number, number] {
  return [lat, lon];
}

function toLatLon(lat: number, lng: number): LatLon {
  return { lat, lon: lng };
}

interface MapClickHandlerProps {
  onMapClick: (guess: LatLon) => void;
}

/** Translates a Leaflet map click into a guess (drops the marker). */
function MapClickHandler({ onMapClick }: MapClickHandlerProps) {
  useMapEvents({
    click(event: LeafletMouseEvent) {
      onMapClick(toLatLon(event.latlng.lat, event.latlng.lng));
    },
  });
  return null;
}

export function MapPicker({
  guess,
  onChange,
  center = DEFAULT_MAP_CENTER,
  zoom = DEFAULT_MAP_ZOOM,
}: MapPickerProps) {
  const tileUrl = import.meta.env.VITE_TILE_URL || DEFAULT_TILE_URL;
  const attribution = import.meta.env.VITE_MAP_ATTRIBUTION || DEFAULT_MAP_ATTRIBUTION;

  function handleMarkerDragEnd(event: DragEndEvent) {
    const marker = event.target as LeafletMarker;
    const latlng = marker.getLatLng();
    onChange(toLatLon(latlng.lat, latlng.lng));
  }

  return (
    // A fixed, explicit height (not min-height) is required here: MapContainer's
    // own height:100% can only resolve against a parent with a definite CSS
    // height. Nothing further up this tree (RoundScreen's <section>, App's
    // flex shell) establishes one, so a min-height-only wrapper left Leaflet's
    // container at a computed 0px height — invisible visually (tiles are
    // absolutely positioned and overflow their collapsed parent) but it
    // desynced Leaflet's internal pixel origin from the real screen position,
    // so clicks landed on whatever sat behind the map instead of the map.
    <div data-testid="map-picker" style={{ height: '100%', minHeight: '250px', width: '100%' }}>
      <MapContainer
        center={toTuple(center)}
        zoom={zoom}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer url={tileUrl} attribution={attribution} />
        <MapClickHandler onMapClick={onChange} />
        {guess ? (
          <Marker
            position={toTuple(guess)}
            icon={GUESS_MARKER_ICON}
            draggable
            eventHandlers={{ dragend: handleMarkerDragEnd }}
          />
        ) : null}
      </MapContainer>
    </div>
  );
}

export default MapPicker;
