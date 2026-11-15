import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { mapApiError } from '../../api/errorMessages';
import type { ChallengeDTO } from '../../api/types';
import { ChallengeLeaderboard } from './ChallengeLeaderboard';
import { apiChallengeDataSource } from './challengeDataSource';
import type { ChallengeDataSource } from './challengeDataSource';

export interface ChallengePanelProps {
  /** Completed round the challenge replays (POST /api/challenges {roundId}). */
  roundId?: string;
  /** Completed result for that round; enables joining the leaderboard. */
  resultId?: string | null;
  /** Open an existing challenge instead of creating one (shared-link entry). */
  initialChallengeId?: string | null;
  /** Test seam: inject a deterministic data source. Defaults to the real API. */
  dataSource?: ChallengeDataSource;
  /** Fired once the share link exists (e.g. to remember the challenge id). */
  onCreated?: (challenge: ChallengeDTO) => void;
}

type RequestState = 'idle' | 'loading' | 'done';

/** ADR-0009 codes -> copy a player can act on. */
function challengeErrorMessage(cause: unknown): string {
  return mapApiError(cause, {
    NETWORK_ERROR: 'Could not reach the game server. Check your connection and try again.',
    NOT_FOUND: 'That challenge or result could not be found.',
    CONFLICT: 'That result was already entered, or it is not from this challenge round.',
    VALIDATION_ERROR: 'That result or display name was not accepted.',
  });
}

/**
 * R16 async challenge UI: create a challenge from a completed round, share the
 * returned URL, enter a result under an optional display name, and show the
 * public leaderboard. No auth is needed for the leaderboard read.
 */
export function ChallengePanel({
  roundId,
  resultId = null,
  initialChallengeId = null,
  dataSource = apiChallengeDataSource,
  onCreated,
}: ChallengePanelProps) {
  const headingId = useId();
  const shareInputId = useId();
  const nameInputId = useId();

  const [challenge, setChallenge] = useState<ChallengeDTO | null>(null);
  const [createState, setCreateState] = useState<RequestState>('idle');
  const [createError, setCreateError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const [displayName, setDisplayName] = useState('');
  const [joinState, setJoinState] = useState<RequestState>('idle');
  const [joinRank, setJoinRank] = useState<number | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [leaderboardRefresh, setLeaderboardRefresh] = useState(0);

  const challengeId = challenge?.challengeId ?? initialChallengeId;
  const creating = createState === 'loading';
  const joining = joinState === 'loading';
  const joined = joinState === 'done';

  async function handleCreate(): Promise<void> {
    if (!roundId || creating) {
      return;
    }
    setCreateState('loading');
    setCreateError(null);
    try {
      const created = await dataSource.createChallenge(roundId);
      setChallenge(created);
      setCreateState('done');
      setCopyState('idle');
      onCreated?.(created);
    } catch (cause) {
      setCreateError(challengeErrorMessage(cause));
      setCreateState('idle');
    }
  }

  async function handleCopy(): Promise<void> {
    if (!challenge) {
      return;
    }
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard) {
        setCopyState('failed');
        return;
      }
      await navigator.clipboard.writeText(challenge.shareUrl);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  async function handleJoin(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!challengeId || !resultId || joining || joined) {
      return;
    }
    const trimmedName = displayName.trim();
    setJoinState('loading');
    setJoinError(null);
    try {
      const entry = await dataSource.submitEntry(
        challengeId,
        trimmedName.length > 0 ? { resultId, displayName: trimmedName } : { resultId },
      );
      setJoinRank(entry.rank);
      setJoinState('done');
      setLeaderboardRefresh((value) => value + 1);
    } catch (cause) {
      setJoinError(challengeErrorMessage(cause));
      setJoinState('idle');
    }
  }

  return (
    <section
      aria-labelledby={headingId}
      data-testid="challenge-panel"
      style={{
        marginTop: '24px',
        padding: '16px',
        background: '#ffffff',
        border: '1px solid #d9d6d0',
        borderRadius: '8px',
      }}
    >
      <h2 id={headingId} style={{ marginTop: 0 }}>
        Challenge a friend
      </h2>

      {!challengeId && roundId ? (
        <>
          <p style={{ marginTop: 0 }}>
            Share this round as an async challenge. Friends play the same location and land on one
            leaderboard.
          </p>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={creating}
            data-testid="create-challenge"
          >
            {creating ? 'Creating challenge...' : 'Challenge a friend'}
          </button>
        </>
      ) : null}

      {createError ? (
        <p role="alert" data-testid="challenge-error" style={{ marginBottom: 0 }}>
          {createError}
        </p>
      ) : null}

      {challenge ? (
        <div data-testid="challenge-share" style={{ marginTop: '12px' }}>
          <label htmlFor={shareInputId} style={{ display: 'block', fontWeight: 600 }}>
            Share link
          </label>
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <input
              id={shareInputId}
              data-testid="share-url"
              value={challenge.shareUrl}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
              style={{ flex: 1, padding: '6px 8px', font: 'inherit' }}
            />
            <button type="button" onClick={() => void handleCopy()} data-testid="copy-share-url">
              Copy link
            </button>
          </div>
          {copyState === 'copied' ? (
            <p role="status" data-testid="share-status" style={{ margin: '6px 0 0' }}>
              Link copied to clipboard.
            </p>
          ) : null}
          {copyState === 'failed' ? (
            <p role="status" data-testid="share-status" style={{ margin: '6px 0 0' }}>
              Copy failed - select the link and copy it manually.
            </p>
          ) : null}
        </div>
      ) : null}

      {challengeId && resultId ? (
        <form
          onSubmit={(event) => void handleJoin(event)}
          data-testid="join-form"
          style={{ marginTop: '16px' }}
        >
          <label htmlFor={nameInputId} style={{ display: 'block', fontWeight: 600 }}>
            Display name (optional)
          </label>
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <input
              id={nameInputId}
              data-testid="display-name"
              value={displayName}
              maxLength={40}
              autoComplete="nickname"
              onChange={(event) => setDisplayName(event.target.value)}
              style={{ flex: 1, padding: '6px 8px', font: 'inherit' }}
            />
            <button type="submit" data-testid="join-challenge" disabled={joining || joined}>
              {joining ? 'Adding...' : joined ? 'Score added' : 'Add my score'}
            </button>
          </div>
          {joinRank !== null ? (
            <p role="status" data-testid="join-result" style={{ margin: '6px 0 0' }}>
              You are ranked #{joinRank} on this challenge.
            </p>
          ) : null}
          {joinError ? (
            <p role="alert" data-testid="join-error" style={{ margin: '6px 0 0' }}>
              {joinError}
            </p>
          ) : null}
        </form>
      ) : null}

      {challengeId ? (
        <div style={{ marginTop: '16px' }}>
          <ChallengeLeaderboard
            challengeId={challengeId}
            dataSource={dataSource}
            refreshKey={leaderboardRefresh}
          />
        </div>
      ) : null}
    </section>
  );
}

export default ChallengePanel;
