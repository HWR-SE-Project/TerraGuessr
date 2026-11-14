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

  if (candidates.length === 0) {
    return (
      <p data-testid="candidate-list-empty" role="status">
        {EMPTY_CANDIDATES_MESSAGE}
      </p>
    );
  }

  return (
    <section aria-labelledby={headingId} data-testid="candidate-list">
      <h2 id={headingId}>Pick the location</h2>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {candidates.map((candidate) => {
          const selected = candidate.id === selectedId;
          return (
            <li key={candidate.id}>
              <button
                type="button"
                data-testid="candidate-item"
                data-candidate-id={candidate.id}
                aria-pressed={selected}
                onClick={() => onChange({ lat: candidate.lat, lon: candidate.lon })}
                style={{
                  display: 'block',
                  width: '100%',
                  marginBottom: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontWeight: selected ? 700 : 400,
                  outline: selected ? '2px solid currentColor' : undefined,
                }}
              >
                <span data-testid="candidate-name">
                  {candidate.name ?? UNNAMED_CANDIDATE_LABEL}
                </span>
                {' — '}
                <span data-testid="candidate-region">{formatRegion(candidate.region)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default CandidateList;
