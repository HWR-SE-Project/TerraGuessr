import { lazy, Suspense, useState } from 'react'
import { Dialog } from '../../components/ui/Dialog'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { SectionErrorBoundary } from '../../components/layout/ErrorFallback'
import type { MatchHistoryEntry } from '../../lib/contracts'
import { capitalize, formatCoordinates, formatDistance, formatScore } from '../../lib/format'
import {
  formatDurationSeconds,
  formatMatchDateTime,
  formatPlacement,
} from './statsLabels'

const MatchReplayMap = lazy(() =>
  import('./MatchReplayMap').then((m) => ({ default: m.MatchReplayMap })),
)

export function MatchReplayDialog({
  match,
  onClose,
}: {
  match: MatchHistoryEntry | null
  onClose: () => void
}) {
  const [selection, setSelection] = useState<{ matchId: string; index: number } | null>(null)

  const roundCount = match?.results.length ?? 0
  const rawIndex =
    match && selection && selection.matchId === match.matchId ? selection.index : 0
  const activeIndex = roundCount > 0 ? Math.min(Math.max(0, rawIndex), roundCount - 1) : 0
  const activeRound = match?.results[activeIndex] ?? null

  const selectIndex = (index: number) => {
    if (!match || roundCount === 0) return
    const clamped = Math.min(Math.max(0, index), roundCount - 1)
    setSelection({ matchId: match.matchId, index: clamped })
  }

  return (
    <Dialog
      open={match !== null}
      onClose={onClose}
      maxWidth="max-w-3xl"
      title={
        match
          ? `${capitalize(match.difficulty)} ${capitalize(match.mode)} · ${formatScore(match.totalScore)} pts`
          : undefined
      }
      footer={
        <div className="flex items-center justify-between gap-3">
          {roundCount > 1 ? (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                icon="chevronLeft"
                disabled={activeIndex === 0}
                onClick={() => selectIndex(activeIndex - 1)}
              >
                Prev
              </Button>
              <span className="px-1 text-xs font-bold text-muted">
                Round {activeIndex + 1} / {roundCount}
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={activeIndex >= roundCount - 1}
                onClick={() => selectIndex(activeIndex + 1)}
              >
                Next
                <Icon name="chevronRight" size={16} />
              </Button>
            </div>
          ) : (
            <span className="text-xs text-subtle">1 round</span>
          )}
          <Button size="sm" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      {match && activeRound && (
        <div className="flex flex-col gap-4">
          {/* Match header metadata */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>{formatMatchDateTime(match.playedAt)}</span>
            <span className="text-subtle">·</span>
            <span>
              {match.results.length} {match.results.length === 1 ? 'round' : 'rounds'}
            </span>
            <span className="text-subtle">·</span>
            <span>Avg {formatScore(match.averageScore)} pts</span>
            {match.perfectCount > 0 && (
              <>
                <span className="text-subtle">·</span>
                <span className="font-bold text-lime-300">{match.perfectCount} × 5K</span>
              </>
            )}
            {match.matchPlacement !== null && match.matchPlayerCount !== null && (
              <span className="rounded-full border border-amber-400/30 bg-amber-400/15 px-2.5 py-0.5 font-bold text-amber-300">
                Finished {formatPlacement(match.matchPlacement, match.matchPlayerCount)}
              </span>
            )}
          </div>

          {/* Lazy-loaded single-round Leaflet map */}
          <SectionErrorBoundary
            key={activeRound.id}
            name="MatchReplayMap"
            fallback={
              <div className="flex h-64 w-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-space-850 px-4 text-center sm:h-72">
                <Icon name="pin" size={24} className="text-subtle" />
                <p className="font-display text-sm font-semibold text-cream">Map preview unavailable</p>
                <p className="text-xs text-muted">Round details and scores are still available below.</p>
              </div>
            }
          >
            <Suspense
              fallback={
                <div className="flex h-64 w-full items-center justify-center rounded-2xl border border-white/10 bg-space-850 text-sm text-subtle sm:h-72">
                  Loading map…
                </div>
              }
            >
              <MatchReplayMap round={activeRound} />
            </Suspense>
          </SectionErrorBoundary>

          {/* Per-round selector list */}
          <ul className="flex flex-col gap-2">
            {match.results.map((round, index) => {
              const isSelected = index === activeIndex
              const metaChips = [
                round.biome ? capitalize(round.biome) : null,
                round.weather ? capitalize(round.weather) : null,
                round.elapsedSeconds !== null ? formatDurationSeconds(round.elapsedSeconds) : null,
                round.attemptsUsed !== null
                  ? `${round.attemptsUsed} ${round.attemptsUsed === 1 ? 'guess' : 'guesses'}`
                  : null,
                round.extraDataUnlocked === true
                  ? round.extraDataPointsSpent && round.extraDataPointsSpent > 0
                    ? `Extra intel (-${round.extraDataPointsSpent})`
                    : 'Extra intel'
                  : null,
              ].filter((chip): chip is string => chip !== null)

              return (
                <li key={round.id}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => selectIndex(index)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                      isSelected
                        ? 'border-lime-400/50 bg-lime-400/10'
                        : 'border-white/8 bg-space-800/75 hover:border-white/20 hover:bg-space-800'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold ${
                            isSelected
                              ? 'bg-lime-400 text-ink'
                              : 'bg-white/10 text-muted'
                          }`}
                        >
                          {round.roundNumber}
                        </span>
                        <span className="font-display text-sm font-semibold text-cream">
                          {round.placeName ?? formatCoordinates(round.actual)}
                        </span>
                        {round.guess === null && (
                          <span className="rounded-full bg-rose-400/15 px-2 py-0.5 text-[11px] font-bold text-rose-300">
                            Timed out
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-sky-300">{formatDistance(round.distanceKm)}</span>
                        <span className="font-display text-sm font-semibold text-cream">
                          {formatScore(round.score)} pts
                        </span>
                      </div>
                    </div>

                    {metaChips.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5 pl-8">
                        {metaChips.map((chip) => (
                          <span
                            key={chip}
                            className="rounded-full bg-white/6 px-2 py-0.5 text-[11px] font-semibold text-subtle"
                          >
                            {chip}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </Dialog>
  )
}
