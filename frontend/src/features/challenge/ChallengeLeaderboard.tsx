import { useEffect, useId, useState } from 'react';
import type { LeaderboardDTO, LeaderboardEntryDTO } from '../../api/types';
import { apiChallengeDataSource } from './challengeDataSource';
import type { ChallengeDataSource } from './challengeDataSource';

export const ANONYMOUS_PLAYER_LABEL = 'Anonymous';
export const EMPTY_LEADERBOARD_MESSAGE = 'No scores yet. Be the first to play this challenge.';

export interface ChallengeLeaderboardProps {
  challengeId: string;
  /** Test seam: inject a deterministic data source. Defaults to the real API. */
  dataSource?: ChallengeDataSource;
  /** Bump to force a re-fetch (e.g. right after the player joins). */
  refreshKey?: number;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; board: LeaderboardDTO };

/** Anonymous entries (displayName: null) still get a readable label. */
export function formatDisplayName(entry: LeaderboardEntryDTO): string {
  const name = entry.displayName?.trim();
  return name && name.length > 0 ? name : ANONYMOUS_PLAYER_LABEL;
}

function toErrorMessage(cause: unknown): string {
  return cause instanceof Error && cause.message.length > 0
    ? cause.message
    : 'Could not load the leaderboard.';
}

/**
 * R16 public leaderboard for one challenge (GET .../leaderboard). Only the
 * challenge's fixed round is ever listed — isolation is enforced server-side.
 */
export function ChallengeLeaderboard({
  challengeId,
  dataSource = apiChallengeDataSource,
  refreshKey = 0,
}: ChallengeLeaderboardProps) {
  const headingId = useId();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    dataSource.getLeaderboard(challengeId).then(
      (board) => {
        if (!cancelled) {
          setState({ status: 'ready', board });
        }
      },
      (cause: unknown) => {
        if (!cancelled) {
          setState({ status: 'error', message: toErrorMessage(cause) });
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [challengeId, dataSource, refreshKey]);

  const rows = state.status === 'ready' ? state.board.entries : [];

  return (
    <section aria-labelledby={headingId} data-testid="challenge-leaderboard">
      <h3 id={headingId}>
        Leaderboard
      </h3>

      {state.status === 'loading' ? (
        <p role="status" data-testid="leaderboard-loading" className="tg-challenge-loading">
          Loading leaderboard...
        </p>
      ) : null}

      {state.status === 'error' ? (
        <p role="alert" data-testid="leaderboard-error" className="tg-challenge-error">
          {state.message}
        </p>
      ) : null}

      {state.status === 'ready' && rows.length === 0 ? (
        <p data-testid="leaderboard-empty" className="tg-challenge-empty">
          {EMPTY_LEADERBOARD_MESSAGE}
        </p>
      ) : null}

      {state.status === 'ready' && rows.length > 0 ? (
        <div className="tg-challenge-table-wrap">
          <table data-testid="leaderboard-table" className="tg-challenge-table">
            <thead>
              <tr>
                <th scope="col">
                  Rank
                </th>
                <th scope="col">
                  Player
                </th>
                <th scope="col">
                  Score
                </th>
                <th scope="col">
                  Distance
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry, index) => (
                <tr
                  key={entry.rank + '-' + (entry.displayName ?? 'anonymous') + '-' + index}
                  data-testid="leaderboard-row"
                  data-tier={entry.rank <= 3 ? entry.rank : undefined}
                >
                  <td data-testid="leaderboard-rank">
                    <span className="tg-rank-cell">
                      <span className="tg-rank-badge">{entry.rank}</span>
                    </span>
                  </td>
                  <td data-testid="leaderboard-name">
                    {formatDisplayName(entry)}
                  </td>
                  <td data-testid="leaderboard-score">
                    {entry.score}
                  </td>
                  <td data-testid="leaderboard-distance">
                    {entry.distanceKm} km
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

export default ChallengeLeaderboard;
