import { divIcon, latLngBounds } from 'leaflet';
import { MapContainer, Marker, Polyline, TileLayer } from 'react-leaflet';
import type { LatLon } from '../../api/types';
import { DEFAULT_MAP_ATTRIBUTION, DEFAULT_TILE_URL } from '../map/MapPicker';
import 'leaflet/dist/leaflet.css';

export interface ResultMapProps {
  guess: LatLon | null;
  actual: LatLon;
  className?: string;
}

const GUESS_ICON = divIcon({ className: 'tg-map-pin', html: '<span aria-hidden="true"></span>', iconSize: [28, 38], iconAnchor: [14, 36] });
const ACTUAL_ICON = divIcon({ className: 'tg-map-pin tg-map-pin-actual', html: '<span aria-hidden="true"></span>', iconSize: [28, 38], iconAnchor: [14, 36] });

function toTuple({ lat, lon }: LatLon): [number, number] {
  return [lat, lon];
}

/** Round-result map: actual + guess markers joined by a line, auto-framed to fit both (R11). */
export function ResultMap({ guess, actual, className }: ResultMapProps) {
  const tileUrl = import.meta.env.VITE_TILE_URL || DEFAULT_TILE_URL;
  const attribution = import.meta.env.VITE_MAP_ATTRIBUTION || DEFAULT_MAP_ATTRIBUTION;
  const points = guess ? [toTuple(guess), toTuple(actual)] : [toTuple(actual)];
  const bounds = latLngBounds(points).pad(0.35);

  return (
    <div className={className} data-testid="result-map">
      <MapContainer bounds={bounds} scrollWheelZoom={false} dragging={false} doubleClickZoom={false} zoomControl={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer url={tileUrl} attribution={attribution} />
        <Marker position={toTuple(actual)} icon={ACTUAL_ICON} />
        {guess ? <Marker position={toTuple(guess)} icon={GUESS_ICON} /> : null}
        {guess ? <Polyline positions={[toTuple(guess), toTuple(actual)]} pathOptions={{ color: '#1a1638', weight: 4, dashArray: '2 10', lineCap: 'round', opacity: 0.9 }} /> : null}
      </MapContainer>
    </div>
  );
}

export default ResultMap;
