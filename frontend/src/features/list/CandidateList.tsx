import { useId } from 'react';
import type { CandidateDTO, LatLon } from '../../api/types';

export interface CandidateListProps {
  /** R07 list mode candidates (exactly one is the actual location; the client must not mark it). */
  candidates: CandidateDTO[];
  /** Same contract as MapPicker: emits the chosen candidate's coordinates. */
  onChange: (guess: LatLon) => void;
  /** Optional controlled highlight for the candidate the player picked. */
  selectedId?: string | null;
}

export const EMPTY_CANDIDATES_MESSAGE = 'No candidates available.';
export const UNNAMED_CANDIDATE_LABEL = 'Unknown location';

/** 'NORTH_AMERICA' -> 'North America'. Keeps display text human-readable. */
export function formatRegion(region: string): string {
  return region
    .split('_')
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * List selection mode (M3). Renders the round's candidates as a list of
 * buttons; choosing one emits {lat, lon} exactly like MapPicker (R07/R08).
 * The actual location is never flagged here (R04).
 */
export function CandidateList({ candidates, onChange, selectedId = null }: CandidateListProps) {
  const headingId = useId();
  const seenLabels = new Map<string, number>();

  if (candidates.length === 0) {
    return (
      <p data-testid="candidate-list-empty" role="status">
        {EMPTY_CANDIDATES_MESSAGE}
      </p>
    );
  }

  return (
    <section aria-labelledby={headingId} data-testid="candidate-list">
      <div className="tg-eyebrow">Choose your hypothesis</div>
      <h2 id={headingId} className="tg-heading-md">Which region matches?</h2>
      <p className="tg-muted tg-lead">Compare the conditions, then select the most likely sector.</p>
      <ul className="tg-candidate-list">
        {candidates.map((candidate, index) => {
          const selected = candidate.id === selectedId;
          const label = candidate.name?.trim() || candidateSector(candidate);
          const occurrence = seenLabels.get(label) ?? 0;
          seenLabels.set(label, occurrence + 1);
          const uniqueLabel = occurrence ? `${label} · sector ${occurrence + 1}` : label;
          return (
            <li key={candidate.id}>
              <button
                type="button"
                data-testid="candidate-item"
                data-candidate-id={candidate.id}
                aria-pressed={selected}
                onClick={() => onChange({ lat: candidate.lat, lon: candidate.lon })}
                className="tg-candidate"
              >
                <span className="tg-candidate-index" aria-hidden="true">{String.fromCharCode(65 + index)}</span>
                  <span><span data-testid="candidate-name" className="tg-candidate-name">{uniqueLabel}</span>
                  <span className="tg-candidate-region"><span data-testid="candidate-region">{formatRegion(candidate.region)}</span> · {Math.abs(candidate.lat).toFixed(0)}°{candidate.lat < 0 ? 'S' : 'N'} latitude band</span></span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** A concise, non-identifying geographic sector label for the seeded land grid. */
function candidateSector(candidate: CandidateDTO): string {
  const region = formatRegion(candidate.region);
  const latBand = Math.floor(Math.abs(candidate.lat) / 10) * 10;
  const lonBand = Math.floor((candidate.lon + 180) / 20) * 20 - 180;
  const hemisphere = candidate.lat < 0 ? 'S' : 'N';
  const longitude = lonBand < 0 ? `${Math.abs(lonBand)}°W sector` : `${lonBand}°E sector`;
  return `${region} · ${latBand}°${hemisphere} / ${longitude}`;
}

export default CandidateList;
