// Playable solo loop (M3 integration glue):
// home (difficulty) -> ROUNDS_PER_GAME rounds (weather + map/list + submit + reveal)
// -> results. All server I/O goes through src/api/gameDataSource.ts, which in
// turn uses src/api/client.ts; session state lives in the gameStore context.
import { useMemo, useState } from 'react';
import { ApiError } from './api/client';
import {
  ROUNDS_PER_GAME,
  apiGameDataSource,
  createStubGameDataSource,
} from './api/gameDataSource';
import type { CreateGameResponse, GameDataSource } from './api/gameDataSource';
import type { GameResultsDTO, GuessResultDTO, RoundDTO, SelectionMode } from './api/types';
import { ChallengePanel } from './features/challenge';
import { DEFAULT_DIFFICULTY, DifficultyPicker, normalizeSelection } from './features/difficulty';
import type { DifficultySelection } from './features/difficulty';
import { RoundScreen } from './features/game';
import type { RoundDataSource } from './features/game';
import { TutorialDialog } from './features/tutorial';
import { GameStoreProvider, useGameStore } from './state/gameStore';

const shellStyle = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  color: '#1c1c1c',
  background: '#f6f5f2',
} as const;

const mainStyle = {
  flex: 1,
  padding: '24px 20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  maxWidth: '900px',
  width: '100%',
  boxSizing: 'border-box',
  margin: '0 auto',
} as const;

type Phase = 'home' | 'playing' | 'results';

type LoadStatus = 'idle' | 'loading' | 'error';

/** ADR-0009 codes -> copy a player can act on. */
function friendlyErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'NETWORK_ERROR':
        return 'Could not reach the game server. Check your connection and try again.';
      case 'NOT_FOUND':
        return 'That game could not be found. Start a new game.';
      case 'CONFLICT':
        return 'That action is not available right now. Start a new game or try the next round.';
      case 'VALIDATION_ERROR':
        return 'That guess was not accepted. Check the coordinates and try again.';
      case 'SERVICE_UNAVAILABLE':
        return 'The weather service is busy right now. Please try again in a moment.';
      default:
        return error.message;
    }
  }
  return error instanceof Error ? error.message : 'Something went wrong.';
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
  ): Promise<void> {
    setStatus('loading');
    setError(null);
    setRound(null);
    setRevealed(null);
    try {
      const next = await active.startRound(gameId, selectionMode);
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

      setActiveGameId(created.gameId);
      dispatch({
        type: 'game/created',
        gameId: created.gameId,
        playerToken: created.playerToken,
        difficulty: nextSelection.difficulty,
        mode: 'solo',
      });
      setPhase('playing');
      await loadRound(active, created.gameId, nextSelection.selectionMode);
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

  return (
    <div style={shellStyle}>
      <header style={{ padding: '12px 20px', borderBottom: '1px solid #d9d6d0' }}>
        <h1 style={{ margin: 0, fontSize: '20px' }}>TerraGuessr</h1>
      </header>
      <main style={mainStyle}>
        {demoMode ? (
          <p
            role="status"
            data-testid="demo-notice"
            style={{ margin: 0, padding: '8px 12px', background: '#fff4d6', borderRadius: '6px' }}
          >
            Backend unavailable - running in offline demo mode.
          </p>
        ) : null}

        {error ? (
          <div
            role="alert"
            data-testid="error-banner"
            style={{ padding: '10px 12px', background: '#fdecec', borderRadius: '6px' }}
          >
            <p style={{ margin: '0 0 8px' }}>{error}</p>
            <button type="button" onClick={handleRetry}>
              Try again
            </button>
            {phase !== 'home' ? (
              <button type="button" onClick={handlePlayAgain} style={{ marginLeft: '8px' }}>
                Back to home
              </button>
            ) : null}
          </div>
        ) : null}

        {phase === 'home' ? (
          <section aria-labelledby="home-heading">
            <h2 id="home-heading" style={{ marginTop: 0 }}>
              Home
            </h2>
            <p>Guess the place from its weather. Five rounds, one score.</p>
            <DifficultyPicker value={selection} onChange={setSelection} disabled={busy} />
            <p style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => void startGame(selection)}
                disabled={busy}
                data-testid="start-game"
              >
                {busy ? 'Starting...' : 'Start game'}
              </button>
              <button type="button" onClick={() => setTutorialOpen(true)} data-testid="how-to-play">
                How to play
              </button>
            </p>
          </section>
        ) : null}

        {phase === 'playing' ? (
          <section aria-labelledby="game-heading">
            <h2 id="game-heading" style={{ marginTop: 0 }}>
              Solo game
            </h2>
            <p style={{ marginTop: 0 }}>
              Round {round?.roundNumber ?? '-'} of {ROUNDS_PER_GAME} - difficulty: {state.difficulty}
            </p>
            {busy && !round ? <p role="status">Loading round...</p> : null}
            {round && roundSource ? (
              <>
                <RoundScreen
                  key={round.roundId}
                  dataSource={roundSource}
                  gameId={activeGameId ?? undefined}
                />
                {revealed ? (
                  <p style={{ marginTop: '16px' }}>
                    <button
                      type="button"
                      onClick={() => void handleAdvance()}
                      disabled={busy}
                      data-testid="advance"
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
          <section aria-labelledby="results-heading" data-testid="results-view">
            <h2 id="results-heading" style={{ marginTop: 0 }}>
              Results
            </h2>
            <p>
              Total score: <strong data-testid="total-score">{results.totalScore}</strong>
            </p>
            <ol data-testid="result-list">
              {results.results.map((entry) => (
                <li key={entry.resultId} data-testid="result-row">
                  Round {entry.roundNumber}: {entry.score} points, {entry.distanceKm} km away
                </li>
              ))}
            </ol>
            <button type="button" onClick={handlePlayAgain} data-testid="play-again">
              Play again
            </button>
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
