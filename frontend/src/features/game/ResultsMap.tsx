import { Fragment } from 'react';
import { divIcon, latLngBounds } from 'leaflet';
import { MapContainer, Marker, Polyline, TileLayer } from 'react-leaflet';
import type { ResultDTO } from '../../api/types';
import { DEFAULT_MAP_ATTRIBUTION, DEFAULT_TILE_URL } from '../map/MapPicker';
import 'leaflet/dist/leaflet.css';

export interface ResultsMapProps {
  results: ResultDTO[];
  className?: string;
}

const GUESS_ICON = divIcon({ className: 'tg-map-pin', html: '<span aria-hidden="true"></span>', iconSize: [22, 30], iconAnchor: [11, 28] });
const ACTUAL_ICON = divIcon({ className: 'tg-map-pin tg-map-pin-actual', html: '<span aria-hidden="true"></span>', iconSize: [22, 30], iconAnchor: [11, 28] });

function toTuple(point: { lat: number; lon: number }): [number, number] {
  return [point.lat, point.lon];
}

/** Final-results overview map: every round's guess + actual location and connecting line (R18). */
export function ResultsMap({ results, className }: ResultsMapProps) {
  const tileUrl = import.meta.env.VITE_TILE_URL || DEFAULT_TILE_URL;
  const attribution = import.meta.env.VITE_MAP_ATTRIBUTION || DEFAULT_MAP_ATTRIBUTION;
  if (results.length === 0) return null;
  const points = results.flatMap((entry) => [toTuple(entry.guess), toTuple(entry.actual)]);
  const bounds = latLngBounds(points).pad(0.25);

  return (
    <div className={className} data-testid="results-map">
      <MapContainer bounds={bounds} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer url={tileUrl} attribution={attribution} />
        {results.map((entry) => (
          <Fragment key={entry.resultId}>
            <Marker position={toTuple(entry.actual)} icon={ACTUAL_ICON} />
            <Marker position={toTuple(entry.guess)} icon={GUESS_ICON} />
            <Polyline positions={[toTuple(entry.guess), toTuple(entry.actual)]} pathOptions={{ color: '#1a1638', weight: 3, dashArray: '2 9', lineCap: 'round', opacity: 0.85 }} />
          </Fragment>
        ))}
      </MapContainer>
    </div>
  );
}

export default ResultsMap;
