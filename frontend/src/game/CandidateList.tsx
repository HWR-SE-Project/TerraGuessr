import type { CandidateDTO, LatLon } from '../api/types'
import './CandidateList.css'

export interface CandidateListProps {
  /** Exactly one is the actual location; the client must never mark which. */
  candidates: CandidateDTO[]
  onChange: (guess: LatLon) => void
  selectedId?: string | null
}

function formatRegion(region: string): string {
  return region
    .split('_')
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function candidateSector(candidate: CandidateDTO): string {
  const region = formatRegion(candidate.region)
  const latBand = Math.floor(Math.abs(candidate.lat) / 10) * 10
  const lonBand = Math.floor((candidate.lon + 180) / 20) * 20 - 180
  const hemisphere = candidate.lat < 0 ? 'S' : 'N'
  const longitude = lonBand < 0 ? `${Math.abs(lonBand)}°W sector` : `${lonBand}°E sector`
  return `${region} · ${latBand}°${hemisphere} / ${longitude}`
}

/** Renders the round's candidates as a compact list; choosing one emits {lat, lon} exactly like the map picker. The actual location is never flagged. */
export function CandidateList({ candidates, onChange, selectedId = null }: CandidateListProps) {
  const seenLabels = new Map<string, number>()

  if (candidates.length === 0) {
    return (
      <p role="status" className="tg-candidate-empty">
        No candidates available.
      </p>
    )
  }

  return (
    <ul className="tg-candidate-list" aria-label="Choose a location">
      {candidates.map((candidate) => {
        const selected = candidate.id === selectedId
        const label = candidate.name?.trim() || candidateSector(candidate)
        const occurrence = seenLabels.get(label) ?? 0
        seenLabels.set(label, occurrence + 1)
        const uniqueLabel = occurrence ? `${label} · ${occurrence + 1}` : label
        return (
          <li key={candidate.id}>
            <button
              type="button"
              data-testid="candidate-option"
              aria-pressed={selected}
              onClick={() => onChange({ lat: candidate.lat, lon: candidate.lon })}
              className="tg-candidate-row"
            >
              <span className="tg-candidate-name">{uniqueLabel}</span>
              <svg className="tg-candidate-mark" viewBox="0 0 16 16" aria-hidden="true">
                <path d="m3.5 8 3 3 6-6" />
              </svg>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
