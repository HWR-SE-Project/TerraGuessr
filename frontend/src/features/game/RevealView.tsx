import type { GuessResultDTO } from '../../api/types';

export interface RevealViewProps {
  result: GuessResultDTO;
}

/** R11 — shown only after a submitted guess; reveals distance, score and the actual location. */
export function RevealView({ result }: RevealViewProps) {
  return (
    <section aria-labelledby="reveal-heading" data-testid="reveal-view">
      <h2 id="reveal-heading">Result</h2>
      <p data-testid="reveal-score">Score: {result.score}</p>
      <p data-testid="reveal-distance">Distance: {result.distanceKm} km</p>
      <p data-testid="reveal-actual">
        Actual location: {result.actual.lat.toFixed(4)}, {result.actual.lon.toFixed(4)}
      </p>
    </section>
  );
}

export default RevealView;
