import type { GuessResultDTO } from '../../api/types';

export interface RevealViewProps {
  result: GuessResultDTO;
}

/** R11 — shown only after a submitted guess; reveals distance, score and the actual location. */
export function RevealView({ result }: RevealViewProps) {
  return (
    <section aria-labelledby="reveal-heading" data-testid="reveal-view" className="tg-result-card">
      <div className="tg-eyebrow">Location revealed</div>
      <h2 id="reveal-heading" style={{ margin: '8px 0 0', fontSize: 25, letterSpacing: '-.04em' }}>Round result</h2>
      <p data-testid="reveal-score" style={{ margin: '15px 0 0', color: 'var(--tg-mint)', fontSize: 52, fontWeight: 800, letterSpacing: '-.07em' }}>Score: {result.score}</p>
      <div className="tg-result-metrics">
        <div className="tg-result-metric"><span className="tg-stat-label">Distance</span><p data-testid="reveal-distance" style={{ margin: '7px 0 0', fontWeight: 800 }}>Distance: {result.distanceKm} km</p></div>
        <div className="tg-result-metric"><span className="tg-stat-label">Actual location</span><p data-testid="reveal-actual" style={{ margin: '7px 0 0', fontSize: 12, fontWeight: 800 }}>Actual location: {result.actual.lat.toFixed(4)}, {result.actual.lon.toFixed(4)}</p></div>
      </div>
      <p className="tg-muted" style={{ fontSize: 12, marginBottom: 0 }}>Your next location is waiting beyond the horizon.</p>
    </section>
  );
}

export default RevealView;
