import type { LatLon } from '../api/types'
import { coordinates } from '../lib/format'

export function ResultCoords({
  actual,
  guess,
}: {
  actual: LatLon
  guess: LatLon | null
}) {
  return (
    <div className="sp-result-coords">
      <span>
        Correct location<strong>{coordinates(actual)}</strong>
      </span>
      <span>
        Your guess<strong>{coordinates(guess)}</strong>
      </span>
    </div>
  )
}
