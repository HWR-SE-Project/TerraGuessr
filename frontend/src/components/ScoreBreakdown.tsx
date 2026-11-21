export function ScoreBreakdown({
  score,
  extraDataPointsSpent = 0,
  tutorialAnchor = false,
}: {
  score: number
  extraDataPointsSpent?: number
  /** Marks the earned block for the tutorial spotlight (singleplayer only). */
  tutorialAnchor?: boolean
}) {
  return (
    <>
      <div className="sp-earned" {...(tutorialAnchor ? { 'data-tutorial-points': true } : {})}>
        <strong>{score.toLocaleString()}</strong>
        <span> / 5,000 points</span>
      </div>
      <div className="sp-score-track">
        <span style={{ width: `${score / 50}%` }} />
      </div>
      {extraDataPointsSpent > 0 && (
        <p className="sp-result-extra">
          Additional data: −{extraDataPointsSpent} points
        </p>
      )}
    </>
  )
}
