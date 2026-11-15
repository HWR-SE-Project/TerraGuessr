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
      <h3 id={headingId} style={{ marginBottom: '8px' }}>
        Leaderboard
      </h3>

      {state.status === 'loading' ? (
        <p role="status" data-testid="leaderboard-loading" style={{ margin: 0 }}>
          Loading leaderboard...
        </p>
      ) : null}

      {state.status === 'error' ? (
        <p role="alert" data-testid="leaderboard-error" style={{ margin: 0 }}>
          {state.message}
        </p>
      ) : null}

      {state.status === 'ready' && rows.length === 0 ? (
        <p data-testid="leaderboard-empty" style={{ margin: 0 }}>
          {EMPTY_LEADERBOARD_MESSAGE}
        </p>
      ) : null}

      {state.status === 'ready' && rows.length > 0 ? (
        <table data-testid="leaderboard-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th scope="col" style={cellStyle}>
                Rank
              </th>
              <th scope="col" style={cellStyle}>
                Player
              </th>
              <th scope="col" style={cellStyle}>
                Score
              </th>
              <th scope="col" style={cellStyle}>
                Distance
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((entry, index) => (
              <tr
                key={entry.rank + '-' + (entry.displayName ?? 'anonymous') + '-' + index}
                data-testid="leaderboard-row"
              >
                <td style={cellStyle} data-testid="leaderboard-rank">
                  {entry.rank}
                </td>
                <td style={cellStyle} data-testid="leaderboard-name">
                  {formatDisplayName(entry)}
                </td>
                <td style={cellStyle} data-testid="leaderboard-score">
                  {entry.score}
                </td>
                <td style={cellStyle} data-testid="leaderboard-distance">
                  {entry.distanceKm} km
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}

const cellStyle = {
  padding: '6px 8px',
  borderBottom: '1px solid #e2dfd8',
  textAlign: 'left',
} as const;

export default ChallengeLeaderboard;
