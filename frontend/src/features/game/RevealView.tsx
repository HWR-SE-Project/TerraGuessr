import type { GuessResultDTO, LatLon } from '../../api/types';
import { ResultMap } from './ResultMap';

export interface RevealViewProps {
  result: GuessResultDTO;
  /** The player's submitted guess, when available, to plot alongside the actual location (R11). */
  guess?: LatLon | null;
}

/** R11 — shown only after a submitted guess; reveals distance, score and the actual location. */
export function RevealView({ result, guess = null }: RevealViewProps) {
  return (
    <section aria-labelledby="reveal-heading" data-testid="reveal-view" className="tg-result-card">
      <ResultMap className="tg-result-map" guess={guess} actual={result.actual} />
      <div className="tg-result-card-body">
        <div className="tg-eyebrow">Location revealed</div>
        <h2 id="reveal-heading" className="tg-heading-md">Round result</h2>
        <p data-testid="reveal-score" className="tg-reveal-score">Score: {result.score}</p>
        <div className="tg-result-metrics">
          <div className="tg-result-metric"><span className="tg-stat-label">Distance</span><p data-testid="reveal-distance">Distance: {result.distanceKm.toLocaleString(undefined, { maximumFractionDigits: 1 })} km</p></div>
          <div className="tg-result-metric"><span className="tg-stat-label">Actual location</span><p data-testid="reveal-actual" className="tg-text-xs">Actual location: {result.actual.lat.toFixed(4)}, {result.actual.lon.toFixed(4)}</p></div>
        </div>
        <p className="tg-muted tg-text-xs tg-mt-4">Your next location is waiting beyond the horizon.</p>
      </div>
    </section>
  );
}

export default RevealView;
