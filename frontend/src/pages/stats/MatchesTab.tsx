import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import type {
  MatchHistoryEntry,
  StatsDifficultyFilter,
  StatsModeFilter,
} from '../../lib/contracts'
import { capitalize, formatScore } from '../../lib/format'
import { api } from '../../services'
import { MatchReplayDialog } from './MatchReplayDialog'
import {
  DIFFICULTY_OPTIONS,
  MODE_OPTIONS,
  formatMatchDateTime,
  formatPlacement,
} from './statsLabels'

const PAGE_SIZE = 15

function placementBadgeClass(placement: number): string {
  if (placement === 1) return 'border-amber-300/40 bg-amber-300/15 text-amber-300'
  if (placement === 2) return 'border-sky-300/35 bg-sky-300/12 text-sky-300'
  if (placement === 3) return 'border-violet-300/35 bg-violet-300/12 text-violet-300'
  return 'border-white/12 bg-white/6 text-muted'
}

export function MatchesTab() {
  const [mode, setMode] = useState<StatsModeFilter>('all')
  const [difficulty, setDifficulty] = useState<StatsDifficultyFilter>('all')
  const [reloadNonce, setReloadNonce] = useState(0)
  const requestKey = `${mode}:${difficulty}:${reloadNonce}`
  const [feed, setFeed] = useState<{
    resolvedKey: string | null
    matches: MatchHistoryEntry[]
    total: number
    error: string | null
  }>({ resolvedKey: null, matches: [], total: 0, error: null })
  const [loadingMore, setLoadingMore] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState<MatchHistoryEntry | null>(null)

  useEffect(() => {
    let cancelled = false
    api.stats
      .getMatches({
        limit: PAGE_SIZE,
        offset: 0,
        ...(mode !== 'all' ? { mode } : {}),
        ...(difficulty !== 'all' ? { difficulty } : {}),
      })
      .then((res) => {
        if (cancelled) return
        setFeed({
          resolvedKey: requestKey,
          matches: res.matches,
          total: res.total,
          error: null,
        })
      })
      .catch((cause) => {
        if (!cancelled) {
          setFeed({
            resolvedKey: requestKey,
            matches: [],
            total: 0,
            error: cause instanceof Error ? cause.message : 'Could not load match history.',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [mode, difficulty, requestKey])

  const loading = feed.resolvedKey !== requestKey
  const matches = feed.matches
  const total = feed.total
  const error = feed.resolvedKey === requestKey ? feed.error : null

  async function loadMore() {
    if (loadingMore || matches.length >= total) return
    setLoadingMore(true)
    try {
      const res = await api.stats.getMatches({
        limit: PAGE_SIZE,
        offset: matches.length,
        ...(mode !== 'all' ? { mode } : {}),
        ...(difficulty !== 'all' ? { difficulty } : {}),
      })
      setFeed((prev) => ({
        ...prev,
        matches: [...prev.matches, ...res.matches],
        total: res.total,
        error: null,
      }))
    } catch (cause) {
      setFeed((prev) => ({
        ...prev,
        error: cause instanceof Error ? cause.message : 'Could not load more matches.',
      }))
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Mode / Difficulty filter bar */}
      <div className="surface-flat flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-white/10 bg-space-800 p-1" role="group" aria-label="Match mode filter">
            {MODE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={mode === opt.value}
                onClick={() => setMode(opt.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                  mode === opt.value
                    ? 'bg-sky-400/20 text-sky-300'
                    : 'text-muted hover:text-cream'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="inline-flex rounded-full border border-white/10 bg-space-800 p-1" role="group" aria-label="Match difficulty filter">
            {DIFFICULTY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={difficulty === opt.value}
                onClick={() => setDifficulty(opt.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                  difficulty === opt.value
                    ? 'bg-violet-400/20 text-violet-300'
                    : 'text-muted hover:text-cream'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <span className="text-xs font-semibold text-subtle">
          {total} {total === 1 ? 'match' : 'matches'}
        </span>
      </div>

      {error && (
        <div role="alert" className="surface-flat flex flex-wrap items-center justify-between gap-3 border-rose-400/30 px-5 py-4">
          <p className="text-sm font-semibold text-rose-300">{error}</p>
          <Button size="sm" variant="secondary" onClick={() => setReloadNonce((n) => n + 1)}>
            Retry
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="surface-flat h-20 animate-pulse bg-space-700/70" />
          ))}
        </div>
      ) : matches.length === 0 ? (
        <div className="surface flex flex-col items-center gap-3 px-6 py-12 text-center">
          <h2 className="font-display text-xl font-semibold text-cream">No matches found</h2>
          <p className="max-w-md text-sm text-muted">
            {mode !== 'all' || difficulty !== 'all'
              ? 'Try clearing your mode or difficulty filters.'
              : 'Completed Singleplayer and Multiplayer matches will appear here with full map replays.'}
          </p>
          {mode !== 'all' || difficulty !== 'all' ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setMode('all')
                setDifficulty('all')
              }}
            >
              Reset filters
            </Button>
          ) : (
            <Button to="/singleplayer" size="sm" icon="play">
              Start a game
            </Button>
          )}
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2.5">
            {matches.map((match) => {
              const placeNames = match.results
                .map((r) => r.placeName)
                .filter((name): name is string => Boolean(name))
              const previewPlaces =
                placeNames.length > 0
                  ? `${placeNames.slice(0, 3).join(', ')}${
                      placeNames.length > 3 ? ` +${placeNames.length - 3}` : ''
                    }`
                  : null

              return (
                <li key={match.matchId}>
                  <button
                    type="button"
                    onClick={() => setSelectedMatch(match)}
                    className="surface-flat group flex w-full flex-wrap items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:border-lime-400/35 hover:bg-space-600/60"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white/8 px-2.5 py-0.5 text-[11px] font-bold text-cream">
                          {capitalize(match.mode)}
                        </span>
                        <span className="rounded-full bg-violet-400/15 px-2.5 py-0.5 text-[11px] font-bold text-violet-300">
                          {capitalize(match.difficulty)}
                        </span>
                        {match.matchPlacement !== null && match.matchPlayerCount !== null && (
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${placementBadgeClass(match.matchPlacement)}`}
                          >
                            {formatPlacement(match.matchPlacement, match.matchPlayerCount)}
                          </span>
                        )}
                        <span className="text-xs text-subtle">
                          {formatMatchDateTime(match.playedAt)}
                        </span>
                      </div>

                      <p className="mt-1.5 truncate text-xs text-muted">
                        {match.results.length}{' '}
                        {match.results.length === 1 ? 'round' : 'rounds'}
                        {match.perfectCount > 0 && (
                          <span className="ml-2 font-bold text-lime-300">
                            · {match.perfectCount} × 5K
                          </span>
                        )}
                        {previewPlaces && (
                          <span className="ml-2 text-subtle">· {previewPlaces}</span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-display text-xl font-semibold text-cream">
                          {formatScore(match.totalScore)}
                        </p>
                        <p className="text-[11px] text-subtle">
                          avg {formatScore(match.averageScore)}
                        </p>
                      </div>
                      <Icon
                        name="chevronRight"
                        size={18}
                        className="text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-lime-300"
                      />
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>

          {matches.length < total && (
            <div className="flex justify-center pt-1">
              <Button variant="secondary" size="sm" loading={loadingMore} onClick={loadMore}>
                Load more matches ({total - matches.length} remaining)
              </Button>
            </div>
          )}
        </>
      )}

      <MatchReplayDialog match={selectedMatch} onClose={() => setSelectedMatch(null)} />
    </div>
  )
}
