// P0-3: the "second player" side of an async challenge (R16/ADR-0005). A
// shared link (shareUrl = '/challenge/:id') lands here instead of the normal
// home/playing/results flow. It joins the challenge (a fresh, independent
// player token + a round pinned to the same location/weather as the
// original), plays that one round through the existing RoundScreen, then
// hands off to ChallengePanel for entry submission + the public leaderboard.
import { useEffect, useMemo, useState } from 'react';
import { ApiError, setPlayerToken } from '../../api/client';
import type { GuessResultDTO, RoundDTO } from '../../api/types';
import { RoundScreen } from '../game';
import type { RoundDataSource } from '../game';
import { ChallengePanel } from './ChallengePanel';
import { apiChallengeDataSource } from './challengeDataSource';
import type { ChallengeDataSource } from './challengeDataSource';

export interface ChallengeJoinFlowProps {
  challengeId: string;
  /** Test seam: inject a deterministic data source. Defaults to the real API. */
  dataSource?: ChallengeDataSource;
}

type Status = 'joining' | 'ready' | 'error';

/** ADR-0009 codes -> copy a player can act on. */
function joinErrorMessage(cause: unknown): string {
  if (cause instanceof ApiError) {
    switch (cause.code) {
      case 'NOT_FOUND':
        return 'This challenge link is invalid or no longer available.';
      case 'NETWORK_ERROR':
        return 'Could not reach the game server. Check your connection and try again.';
      default:
        return cause.message;
    }
  }
  return cause instanceof Error ? cause.message : 'Something went wrong.';
}

export function ChallengeJoinFlow({
  challengeId,
  dataSource = apiChallengeDataSource,
}: ChallengeJoinFlowProps) {
  const [status, setStatus] = useState<Status>('joining');
  const [error, setError] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [round, setRound] = useState<RoundDTO | null>(null);
  const [revealed, setRevealed] = useState<GuessResultDTO | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('joining');
    setError(null);

    dataSource
      .startChallengeRound(challengeId)
      .then((joined) => {
        if (cancelled) {
          return;
        }
        // Same pattern as App.tsx's startGame (P0-2): persist the token
        // synchronously, right where it's received, instead of depending on
        // an effect that could race the next request.
        setPlayerToken(joined.playerToken);
        setGameId(joined.gameId);
        setRound(joined.round);
        setStatus('ready');
      })
      .catch((cause: unknown) => {
        if (cancelled) {
          return;
        }
        setError(joinErrorMessage(cause));
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [challengeId, dataSource]);

  // Same wrapper trick App.tsx uses: RoundScreen's dataSource re-serves the
  // round we already fetched and forwards the guess to the real endpoint.
  const roundSource = useMemo<RoundDataSource | null>(() => {
    if (!round) {
      return null;
    }
    const loadedRound = round;
    return {
      async startRound() {
        return loadedRound;
      },
      async submitGuess(roundId, guess) {
        const result = await dataSource.submitGuess(roundId, guess);
        setRevealed(result);
        return result;
      },
    };
  }, [round, dataSource]);

  if (status === 'joining') {
    return <p role="status">Joining challenge...</p>;
  }

  if (status === 'error') {
    return (
      <div role="alert" data-testid="error-banner">
        <p>{error}</p>
      </div>
    );
  }

  if (!round || !roundSource) {
    return null;
  }

  return (
    <section aria-labelledby="challenge-join-heading" data-testid="challenge-join-flow">
      <h2 id="challenge-join-heading" style={{ marginTop: 0 }}>
        Challenge round
      </h2>
      <RoundScreen dataSource={roundSource} gameId={gameId ?? undefined} />
      {revealed ? (
        <ChallengePanel
          initialChallengeId={challengeId}
          resultId={revealed.resultId}
          dataSource={dataSource}
        />
      ) : null}
    </section>
  );
}

export default ChallengeJoinFlow;
