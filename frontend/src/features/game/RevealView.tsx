import type { GuessResultDTO } from '../../api/types';

export interface RevealViewProps {
  result: GuessResultDTO;
}

/** R11 — shown only after a submitted guess; reveals distance, score and the actual location. */
export function RevealView({ result }: RevealViewProps) {
  return (
    <section aria-labelledby="reveal-heading" data-testid="reveal-view" className="tg-result-card">
      <div className="tg-eyebrow">Location revealed</div>
      <h2 id="reveal-heading" className="tg-heading-md">Round result</h2>
      <p data-testid="reveal-score" className="tg-reveal-score">Score: {result.score}</p>
      <div className="tg-result-metrics">
        <div className="tg-result-metric"><span className="tg-stat-label">Distance</span><p data-testid="reveal-distance">Distance: {result.distanceKm} km</p></div>
        <div className="tg-result-metric"><span className="tg-stat-label">Actual location</span><p data-testid="reveal-actual" className="tg-text-xs">Actual location: {result.actual.lat.toFixed(4)}, {result.actual.lon.toFixed(4)}</p></div>
      </div>
      <p className="tg-muted tg-text-xs tg-mt-4">Your next location is waiting beyond the horizon.</p>
    </section>
  );
}

export default RevealView;
