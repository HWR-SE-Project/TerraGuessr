export function GameplayHUD({
  round,
  roundsTotal,
  score,
  status,
}: {
  round: number
  roundsTotal?: number
  score: number
  status: string
}) {
  return (
    <div className="sp-hud" role="status" aria-label="Game progress" aria-atomic="true">
      <span className="sp-hud-round">
        Round {round}
        {roundsTotal !== undefined && <span className="sp-hud-sr-only"> of {roundsTotal}</span>}
      </span>
      <strong className="sp-hud-score">
        <span className="sp-hud-sr-only">Total score: </span>
        {score.toLocaleString()} <span className="sp-hud-unit">pts</span>
      </strong>
      <span className="sp-hud-sr-only">{status}</span>
    </div>
  )
}
