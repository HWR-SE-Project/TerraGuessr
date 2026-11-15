// Playable solo loop (M3 integration glue):
// home (difficulty) -> ROUNDS_PER_GAME rounds (weather + map/list + submit + reveal)
// -> results. All server I/O goes through src/api/gameDataSource.ts, which in
// turn uses src/api/client.ts; session state lives in the gameStore context.
import { useMemo, useState } from 'react';
import { ApiError, setPlayerToken } from './api/client';
import { mapApiError } from './api/errorMessages';
import {
  ROUNDS_PER_GAME,
  apiGameDataSource,
  createStubGameDataSource,
} from './api/gameDataSource';
import type { CreateGameResponse, GameDataSource } from './api/gameDataSource';
import type { GameResultsDTO, GuessResultDTO, RoundDTO, SelectionMode } from './api/types';
import { ChallengeJoinFlow, ChallengePanel } from './features/challenge';
import { DEFAULT_DIFFICULTY, DifficultyPicker, normalizeSelection } from './features/difficulty';
import type { DifficultySelection } from './features/difficulty';
import { RoundScreen } from './features/game';
import type { RoundDataSource } from './features/game';
import { TutorialDialog } from './features/tutorial';
import { GameStoreProvider, useGameStore } from './state/gameStore';

type Phase = 'home' | 'playing' | 'results';

type LoadStatus = 'idle' | 'loading' | 'error';

/** Shared-link challenges land on shareUrl = '/challenge/:id' (P0-3). */
function parseChallengeId(pathname: string): string | null {
  const match = /^\/challenge\/([^/]+)\/?$/.exec(pathname);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/** ADR-0009 codes -> copy a player can act on. */
function friendlyErrorMessage(error: unknown): string {
  return mapApiError(error, {
    NETWORK_ERROR: 'Could not reach the game server. Check your connection and try again.',
    NOT_FOUND: 'That game could not be found. Start a new game.',
    CONFLICT: 'That action is not available right now. Start a new game or try the next round.',
    VALIDATION_ERROR: 'That guess was not accepted. Check the coordinates and try again.',
    SERVICE_UNAVAILABLE: 'The weather service is busy right now. Please try again in a moment.',
  });
}

function isNetworkError(error: unknown): boolean {
  return error instanceof ApiError && (error.code === 'NETWORK_ERROR' || error.status === 0);
}

export interface AppProps {
  /** Test seam: inject a deterministic data source. Defaults to the real API. */
  dataSource?: GameDataSource;
}

export function App({ dataSource }: AppProps) {
  return (
    <GameStoreProvider>
      <AppShell dataSource={dataSource ?? apiGameDataSource} />
    </GameStoreProvider>
  );
}

interface AppShellProps {
  dataSource: GameDataSource;
}

function AppShell({ dataSource }: AppShellProps) {
  const { state, dispatch } = useGameStore();

  const [challengeId] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : parseChallengeId(window.location.pathname),
  );
  const [source, setSource] = useState<GameDataSource>(dataSource);
  const [phase, setPhase] = useState<Phase>('home');
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [selection, setSelection] = useState<DifficultySelection>(() =>
    normalizeSelection(DEFAULT_DIFFICULTY),
  );
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [round, setRound] = useState<RoundDTO | null>(null);
  const [revealed, setRevealed] = useState<GuessResultDTO | null>(null);
  const [results, setResults] = useState<GameResultsDTO | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const busy = status === 'loading';

  async function loadRound(
    active: GameDataSource,
    gameId: string,
    selectionMode: SelectionMode,
    playerToken?: string,
  ): Promise<void> {
    setStatus('loading');
    setError(null);
    setRound(null);
    setRevealed(null);
    try {
      const next = await active.startRound(gameId, selectionMode, playerToken);
      setRound(next);
      setStatus('idle');
    } catch (cause) {
      setError(friendlyErrorMessage(cause));
      setStatus('error');
    }
  }

  async function startGame(nextSelection: DifficultySelection): Promise<void> {
    if (busy) {
      return;
    }
    setSelection(nextSelection);
    setStatus('loading');
    setError(null);
    setRound(null);
    setRevealed(null);
    setResults(null);

    let active = source;
    try {
      let created: CreateGameResponse;
      try {
        created = await active.createGame({ mode: 'solo', difficulty: nextSelection.difficulty });
      } catch (cause) {
        // Dev fallback: with no backend running the UI must still be playable.
        if (isNetworkError(cause) && import.meta.env.DEV) {
          active = createStubGameDataSource();
          setSource(active);
          setDemoMode(true);
          created = await active.createGame({
            mode: 'solo',
            difficulty: nextSelection.difficulty,
          });
        } else {
          throw cause;
        }
      }

      // Persist the token synchronously, before anything else runs: the
      // player-token useEffect pattern this used to rely on only commits
      // after this render, which raced the startRound call right below
      // (P0-2). The explicit `created.playerToken` argument to loadRound
      // closes the same gap for this specific request, independent of
      // localStorage/React timing altogether.
      setPlayerToken(created.playerToken);
      setActiveGameId(created.gameId);
      dispatch({
        type: 'game/created',
        gameId: created.gameId,
        playerToken: created.playerToken,
        difficulty: nextSelection.difficulty,
        mode: 'solo',
      });
      setPhase('playing');
      await loadRound(active, created.gameId, nextSelection.selectionMode, created.playerToken);
    } catch (cause) {
      setError(friendlyErrorMessage(cause));
      setStatus('error');
    }
  }

  async function loadResults(): Promise<void> {
    if (!activeGameId) {
      return;
    }
    setStatus('loading');
    setError(null);
    try {
      const nextResults = await source.getResults(activeGameId);
      setResults(nextResults);
      setStatus('idle');
      setPhase('results');
    } catch (cause) {
      setError(friendlyErrorMessage(cause));
      setStatus('error');
    }
  }

  async function handleAdvance(): Promise<void> {
    if (!round) {
      return;
    }
    if (round.roundNumber >= ROUNDS_PER_GAME) {
      await loadResults();
      return;
    }
    if (!activeGameId) {
      return;
    }
    await loadRound(source, activeGameId, selection.selectionMode);
  }

  function handleRetry(): void {
    if (phase === 'home') {
      void startGame(selection);
      return;
    }
    // A failed results fetch happens after the final round was revealed.
    if (round && round.roundNumber >= ROUNDS_PER_GAME) {
      void loadResults();
      return;
    }
    if (activeGameId) {
      void loadRound(source, activeGameId, selection.selectionMode);
    }
  }

  function handlePlayAgain(): void {
    setPlayerToken(null);
    dispatch({ type: 'game/reset' });
    setPhase('home');
    setStatus('idle');
    setError(null);
    setActiveGameId(null);
    setRound(null);
    setRevealed(null);
    setResults(null);
  }

  // RoundScreen fetches through this seam; App already holds the round, so the
  // wrapper hands it back and records the reveal for the "next round" control.
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
        try {
          const result = await source.submitGuess(roundId, guess);
          setRevealed(result);
          return result;
        } catch (cause) {
          throw new Error(friendlyErrorMessage(cause));
        }
      },
    };
  }, [round, source]);

  const isFinalRound = round !== null && round.roundNumber >= ROUNDS_PER_GAME;
  // R16: the challenge replays the last completed round with the player's result.
  const lastResult = results ? (results.results[results.results.length - 1] ?? null) : null;

  // P0-3: a shared challenge link bypasses the normal home/playing/results
  // flow entirely — this browser is an independent participant, not the
  // original creator, and never touches that player's game/token.
  if (challengeId) {
    return (
      <div className="tg-shell">
        <header className="tg-topbar"><a className="tg-brand" href="/"><span className="tg-brand-mark" aria-hidden="true">⌖</span><span className="tg-brand-name">Terra<span>Guessr</span></span></a></header>
        <main className="tg-main">
          <ChallengeJoinFlow challengeId={challengeId} />
        </main>
      </div>
    );
  }

  return (
    <div className="tg-shell">
      <header className="tg-topbar">
        <a className="tg-brand" href="/" onClick={(event) => { if (phase !== 'home') { event.preventDefault(); handlePlayAgain(); } }}><span className="tg-brand-mark" aria-hidden="true">⌖</span><span className="tg-brand-name">Terra<span>Guessr</span></span></a>
        <nav className="tg-nav" aria-label="Main navigation">
          {phase === 'home' ? <button type="button" onClick={() => setTutorialOpen(true)} data-testid="how-to-play"><span aria-hidden="true">ⓘ</span><span className="tg-nav-label">How to play</span></button> : <span className="tg-chip"><span className="tg-dot" />Solo expedition</span>}
        </nav>
      </header>
      <main className={phase === 'playing' ? 'tg-game' : phase === 'home' ? 'tg-landing' : 'tg-main'}>
        {demoMode ? (
          <p
            role="status"
            data-testid="demo-notice"
            className="tg-chip"
          >
            Backend unavailable - running in offline demo mode.
          </p>
        ) : null}

        {error ? (
          <div
            role="alert"
            data-testid="error-banner"
            className="tg-error"
          >
            <p style={{ margin: '0 0 8px' }}>{error}</p>
              <button type="button" className="tg-button tg-button-secondary" onClick={handleRetry}>
              Try again
            </button>
            {phase !== 'home' ? (
              <button type="button" className="tg-button tg-button-quiet" onClick={handlePlayAgain} style={{ marginLeft: '8px' }}>
                Back to home
              </button>
            ) : null}
          </div>
        ) : null}

        {phase === 'home' ? (
          <section aria-labelledby="home-heading" className="tg-hero">
            <div>
              <div className="tg-eyebrow">A world of clues, one great guess</div>
              <h1 id="home-heading">Read the sky.<br /><span>Find the place.</span></h1>
              <p className="tg-hero-copy">Every round begins with a different corner of the Earth. Study its weather, trust your instincts, and drop your pin where you think you are.</p>
              <div className="tg-hero-cta">
              <button
                type="button"
                onClick={() => void startGame(selection)}
                disabled={busy}
                data-testid="start-game"
                className="tg-button tg-button-primary"
              >
                {busy ? 'Preparing expedition…' : '◉  Start solo expedition'}
              </button>
                <button type="button" onClick={() => setTutorialOpen(true)} data-testid="hero-tutorial" className="tg-button tg-button-quiet">Learn the signals</button>
              </div>
              <div style={{ marginTop: 30 }}>
                <div className="tg-eyebrow" style={{ marginBottom: 10 }}>Choose your challenge</div>
                <DifficultyPicker value={selection} onChange={setSelection} disabled={busy} />
              </div>
            </div>
            <div className="tg-hero-orbit" aria-hidden="true">
              <div className="tg-globe"><div className="tg-globe-grid" /></div>
              <div className="tg-orbit-tag one">◌ &nbsp; Weather is your compass</div>
              <div className="tg-orbit-tag two">⌖ &nbsp; Five locations. One world.</div>
              <div className="tg-orbit-tag three">↗ &nbsp; Every kilometer counts</div>
            </div>
          </section>
        ) : null}

        {phase === 'playing' ? (
          <section>
            <div className="tg-game-top">
              <div className="tg-game-stats">
                <div className="tg-stat"><span className="tg-stat-label">Round</span><span className="tg-stat-value">{round?.roundNumber ?? '-'} <span className="tg-muted">/ {ROUNDS_PER_GAME}</span></span></div>
                <div className="tg-stat"><span className="tg-stat-label">Difficulty</span><span className="tg-stat-value" style={{ textTransform: 'capitalize' }}>{state.difficulty}</span></div>
                <div className="tg-stat"><span className="tg-stat-label">Score</span><span className="tg-stat-value mono">{revealed?.score ?? '—'}</span></div>
              </div>
              <span className="tg-chip"><span className="tg-dot" />{round?.selectionMode === 'list' ? 'Choice mode' : 'Map mode'}</span>
            </div>
            {busy && !round ? <p role="status">Loading round...</p> : null}
            {round && roundSource ? (
              <>
                <RoundScreen
                  key={round.roundId}
                  dataSource={roundSource}
                  gameId={activeGameId ?? undefined}
                />
                {revealed ? (
                  <p style={{ position: 'absolute', top: 82, right: 24, zIndex: 10, margin: 0 }}>
                    <button
                      type="button"
                      onClick={() => void handleAdvance()}
                      disabled={busy}
                      data-testid="advance"
                      className="tg-button tg-button-secondary"
                    >
                      {isFinalRound ? 'See final results' : 'Next round'}
                    </button>
                  </p>
                ) : null}
              </>
            ) : null}
          </section>
        ) : null}

        {phase === 'results' && results ? (
          <section aria-labelledby="results-heading" data-testid="results-view" className="tg-panel tg-results">
            <div className="tg-eyebrow">Expedition complete</div>
            <h2 id="results-heading" style={{ margin: '8px 0', fontSize: 38, letterSpacing: '-.06em' }}>Your journey</h2>
            <p className="tg-muted">Total score</p>
            <p className="tg-result-score"><strong data-testid="total-score">{results.totalScore}</strong><span style={{ fontSize: 15, color: 'var(--tg-muted)', letterSpacing: 0 }}> pts</span></p>
            <ol data-testid="result-list">
              {results.results.map((entry) => (
                <li key={entry.resultId} data-testid="result-row" className="tg-result-row">
                  <span>Round {entry.roundNumber}</span><span><strong style={{ color: 'var(--tg-text)' }}>{entry.score} pts</strong> · {entry.distanceKm} km</span>
                </li>
              ))}
            </ol>
            <button type="button" onClick={handlePlayAgain} data-testid="play-again" className="tg-button tg-button-primary">↻ &nbsp; Play again</button>
            {round && lastResult ? (
              <ChallengePanel roundId={round.roundId} resultId={lastResult.resultId} />
            ) : null}
          </section>
        ) : null}
      </main>
      <TutorialDialog open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
    </div>
  );
}

export default App;
