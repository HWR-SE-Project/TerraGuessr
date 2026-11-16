// Playable solo loop (M3 integration glue):
// home (difficulty) -> ROUNDS_PER_GAME rounds (weather + map/list + submit + reveal)
// -> results. All server I/O goes through src/api/gameDataSource.ts, which in
// turn uses src/api/client.ts; session state lives in the gameStore context.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { ApiError, apiFetch, setPlayerToken } from '../api/client';
import { mapApiError } from '../api/errorMessages';
import {
  ROUNDS_PER_GAME,
  apiGameDataSource,
  createStubGameDataSource,
} from '../api/gameDataSource';
import type { CreateGameResponse, GameDataSource } from '../api/gameDataSource';
import type { AdditionalDataUnlockMode, GameResultsDTO, GuessResultDTO, RoundDTO, SelectionMode } from '../api/types';
import { ChallengePanel } from '../features/challenge';
import { DEFAULT_DIFFICULTY, DifficultyPicker, normalizeSelection } from '../features/difficulty';
import type { DifficultySelection } from '../features/difficulty';
import { ResultsMap, RoundScreen } from '../features/game';
import type { RoundDataSource } from '../features/game';
import { GameSetup } from '../features/setup/GameSetup';
import { useGameStore } from '../state/gameStore';
import type { RootOutletContext } from './RootLayout';

type Phase = 'home' | 'playing' | 'results';
type LoadStatus = 'idle' | 'loading' | 'error';

export interface HomePageProps {
  /** Test seam: inject a deterministic data source. Defaults to the real API. */
  dataSource?: GameDataSource;
}

export function HomePage({ dataSource }: HomePageProps) {
  return <HomePageInner dataSource={dataSource ?? apiGameDataSource} />;
}

const HOME_COPY = {
  en: { welcome: 'Welcome back', dashboard: 'Choose your next expedition', solo: 'Solo expedition', soloCopy: 'Read the weather, place your guess, and see how close you get across five rounds.', create: 'Create solo game', preparing: 'Preparing…', homeTitleA: 'Explore the', homeTitleB: 'world!', homeCopy: 'Every round drops you somewhere on Earth with no street-view photo at all. Read the live weather, trust your instincts, and drop your pin where you think you are.', start: 'Start solo expedition', startHover: 'Taking off!', learn: 'Learn the signals', playInBrowser: 'Play free in your browser', weatherOnly: 'No camera view — weather clues only', chooseChallenge: 'Choose your challenge', learnCardTitle: 'Learn how the clues work', duels: 'Duels', duelsCopy: 'Challenge a friend to the location you just played and compare scores on a shared leaderboard.', duelsCta: 'Open Duels' },
  de: { welcome: 'Willkommen zurück', dashboard: 'Wähle dein nächstes Abenteuer', solo: 'Solo-Expedition', soloCopy: 'Lies das Wetter, setze deinen Tipp und finde in fünf Runden heraus, wie nah du liegst.', create: 'Solo-Spiel starten', preparing: 'Wird vorbereitet…', homeTitleA: 'Entdecke die', homeTitleB: 'Welt!', homeCopy: 'Jede Runde beginnt an einem anderen Ort der Erde – ganz ohne Street-View-Fotos. Lies das Wetter, vertraue deinem Gefühl und setze deine Markierung.', start: 'Solo-Expedition starten', startHover: 'Bereit zum Abheben!', learn: 'Hinweise kennenlernen', playInBrowser: 'Direkt im Browser spielen', weatherOnly: 'Kein Kamerabild – nur Wetterdaten', chooseChallenge: 'Wähle deine Herausforderung', learnCardTitle: 'So funktionieren die Hinweise', duels: 'Duelle', duelsCopy: 'Fordere einen Freund für den gerade gespielten Ort heraus und vergleicht eure Punkte auf einer gemeinsamen Bestenliste.', duelsCta: 'Duelle öffnen' },
};

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

function HomePageInner({ dataSource }: { dataSource: GameDataSource }) {
  const { state, dispatch } = useGameStore();
  const { authUser, language, setChrome, openTutorial } = useOutletContext<RootOutletContext>();

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
  const [gameSetupOpen, setGameSetupOpen] = useState(false);
  const [activeRoundsTotal, setActiveRoundsTotal] = useState(ROUNDS_PER_GAME);
  const [configuredRoundsTotal, setConfiguredRoundsTotal] = useState(ROUNDS_PER_GAME);
  const [configuredAttemptsPerRound, setConfiguredAttemptsPerRound] = useState(1);
  const [attemptProgress, setAttemptProgress] = useState({ current: 1, total: 1 });
  const [configuredGeography, setConfiguredGeography] = useState<'world' | 'AFRICA' | 'EUROPE' | 'ASIA' | 'NORTH_AMERICA' | 'SOUTH_AMERICA' | 'OCEANIA'>('world');
  const [configuredCandidateCount, setConfiguredCandidateCount] = useState<number | undefined>();
  const [configuredUnlockMode, setConfiguredUnlockMode] = useState<AdditionalDataUnlockMode>('immediate');
  const [configuredUnlockCost, setConfiguredUnlockCost] = useState(500);
  const [dailyMode, setDailyMode] = useState(false);
  const [dailyDate, setDailyDate] = useState<string | null>(null);
  const [dailyLeaderboard, setDailyLeaderboard] = useState<{ entries: Array<{ rank: number; displayName: string; score: number; distanceKm: number }>; myRank: number | null } | null>(null);

  useEffect(() => { setChrome(phase === 'playing' ? 'compact' : 'normal'); }, [phase, setChrome]);

  const copy = HOME_COPY[language];
  const busy = status === 'loading';
  const handleAttemptChange = useCallback((current: number, total: number) => setAttemptProgress({ current, total }), []);

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

  async function startGame(nextSelection: DifficultySelection, roundsTotal = ROUNDS_PER_GAME, geography = configuredGeography, candidateCount = configuredCandidateCount, attemptsPerRound = configuredAttemptsPerRound, unlockMode = configuredUnlockMode, unlockCost = configuredUnlockCost): Promise<void> {
    if (busy) {
      return;
    }
    setSelection(nextSelection);
    setConfiguredRoundsTotal(roundsTotal);
    setConfiguredAttemptsPerRound(attemptsPerRound);
    setConfiguredGeography(geography);
    setConfiguredCandidateCount(candidateCount);
    setConfiguredUnlockMode(unlockMode);
    setConfiguredUnlockCost(unlockCost);
    setStatus('loading');
    setError(null);
    setRound(null);
    setRevealed(null);
    setResults(null);
    setDailyMode(false);

    let active = source;
    try {
      let created: CreateGameResponse;
      try {
        created = await active.createGame({ mode: 'solo', difficulty: nextSelection.difficulty, roundsTotal, geography, ...(candidateCount !== undefined ? { candidateCount } : {}), attemptsPerRound, additionalDataUnlockMode: unlockMode, ...(unlockMode !== 'immediate' ? { additionalDataUnlockCost: unlockCost } : {}) });
      } catch (cause) {
        // Dev fallback: with no backend running the UI must still be playable.
        if (isNetworkError(cause) && import.meta.env.DEV) {
          active = createStubGameDataSource();
          setSource(active);
          setDemoMode(true);
          created = await active.createGame({
            mode: 'solo',
            difficulty: nextSelection.difficulty,
            roundsTotal,
            geography,
            ...(candidateCount !== undefined ? { candidateCount } : {}),
            attemptsPerRound,
            additionalDataUnlockMode: unlockMode,
            ...(unlockMode !== 'immediate' ? { additionalDataUnlockCost: unlockCost } : {}),
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
      setActiveRoundsTotal(created.roundsTotal ?? roundsTotal);
      setConfiguredAttemptsPerRound(created.attemptsPerRound ?? attemptsPerRound);
      setAttemptProgress({ current: 1, total: created.attemptsPerRound ?? attemptsPerRound });
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

  async function startDaily(): Promise<void> {
    if (busy || !authUser) return;
    setStatus('loading'); setError(null); setDailyMode(true); setDailyLeaderboard(null); setRevealed(null); setResults(null);
    try {
      const response = await apiFetch<{ date: string; status: 'open' | 'completed'; round: RoundDTO; result?: GuessResultDTO }>('/daily/today');
      setDailyDate(response.date); setRound(response.round); setActiveGameId(response.date); setActiveRoundsTotal(1); setAttemptProgress({ current: 1, total: 1 }); setPhase('playing'); setStatus('idle');
      if (response.result) setRevealed(response.result);
      dispatch({ type: 'game/created', gameId: response.date, playerToken: '', difficulty: 'hard', mode: 'solo' });
      if (response.status === 'completed') {
        const board = await apiFetch<{ entries: Array<{ rank: number; displayName: string; score: number; distanceKm: number }>; myRank: number | null }>(`/daily/${response.date}/leaderboard`);
        setDailyLeaderboard(board);
      }
    } catch (cause) { setDailyMode(false); setStatus('error'); setError(friendlyErrorMessage(cause)); }
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
    if (dailyMode) { handlePlayAgain(); return; }
    if (round.roundNumber >= activeRoundsTotal) {
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
      void startGame(selection, configuredRoundsTotal, configuredGeography, configuredCandidateCount, configuredAttemptsPerRound, configuredUnlockMode, configuredUnlockCost);
      return;
    }
    // A failed results fetch happens after the final round was revealed.
    if (round && round.roundNumber >= activeRoundsTotal) {
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
    setGameSetupOpen(false);
    setDailyMode(false);
    setDailyDate(null);
    setDailyLeaderboard(null);
  }

  // RoundScreen fetches through this seam; Home already holds the round, so
  // the wrapper hands it back and records the reveal for the "next round" control.
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
          const result = dailyMode
            ? (await apiFetch<{ result: GuessResultDTO }>('/daily/today/guess', { method: 'POST', body: guess })).result
            : await source.submitGuess(roundId, guess);
          setRevealed(result);
          if (dailyMode && dailyDate) {
            void apiFetch<{ entries: Array<{ rank: number; displayName: string; score: number; distanceKm: number }>; myRank: number | null }>(`/daily/${dailyDate}/leaderboard`).then(setDailyLeaderboard).catch(() => undefined);
          }
          return result;
        } catch (cause) {
          throw new Error(friendlyErrorMessage(cause));
        }
      },
      async submitAttempt(roundId, guess) {
        const response = await apiFetch<{ attemptNumber: number; attemptsTotal: number; attemptsRemaining: number; distanceKm: number; score: number; result: GuessResultDTO | null }>(`/rounds/${encodeURIComponent(roundId)}/attempts`, { method: 'POST', body: guess });
        if (response.result) setRevealed(response.result);
        return response;
      },
      async finishRound(roundId) {
        const result = await apiFetch<GuessResultDTO>(`/rounds/${encodeURIComponent(roundId)}/finish`, { method: 'POST' });
        setRevealed(result);
        return result;
      },
      async unlockAdditionalData(roundId) {
        return apiFetch<RoundDTO>(`/rounds/${encodeURIComponent(roundId)}/intelligence/unlock`, { method: 'POST' });
      },
    };
  }, [round, source, dailyMode, dailyDate]);

  const isFinalRound = round !== null && round.roundNumber >= activeRoundsTotal;
  // R16: the challenge replays the last completed round with the player's result.
  const lastResult = results ? (results.results[results.results.length - 1] ?? null) : null;

  return (
    <main className={phase === 'playing' ? 'tg-game' : phase === 'home' ? 'tg-landing' : 'tg-main'}>
      {demoMode ? (
        <p role="status" data-testid="demo-notice" className="tg-chip">
          Backend unavailable - running in offline demo mode.
        </p>
      ) : null}

      {error ? (
        <div role="alert" data-testid="error-banner" className="tg-error">
          <p className="tg-mb-2">{error}</p>
          <button type="button" className="tg-button tg-button-secondary" onClick={handleRetry}>
            Try again
          </button>
          {phase !== 'home' ? (
            <button type="button" className="tg-button tg-button-quiet tg-ml-2" onClick={handlePlayAgain}>
              Back to home
            </button>
          ) : null}
        </div>
      ) : null}

      {phase === 'home' && authUser && gameSetupOpen ? (
        <GameSetup initialSelection={selection} initialRoundsTotal={configuredRoundsTotal} initialAttemptsPerRound={configuredAttemptsPerRound} initialGeography={configuredGeography} initialCandidateCount={configuredCandidateCount} initialAdditionalDataUnlockMode={configuredUnlockMode} initialAdditionalDataUnlockCost={configuredUnlockCost} language={language} loading={busy} onBack={() => setGameSetupOpen(false)} onStart={(chosen, count, geography, candidateCount, attempts, unlockMode, unlockCost) => { setGameSetupOpen(false); void startGame(chosen, count, geography, candidateCount, attempts, unlockMode, unlockCost); }} />
      ) : null}

      {phase === 'home' && authUser && !gameSetupOpen ? (
        <section className="tg-dashboard" aria-labelledby="dashboard-heading">
          <div className="tg-eyebrow">{copy.welcome}, {authUser.displayName}</div>
          <h1 id="dashboard-heading">{copy.dashboard}</h1>
          <p className="tg-muted">Your account is ready. Take a solo expedition, join today’s shared UTC challenge, or duel a friend.</p>
          <div className="tg-dashboard-grid">
            <article className="tg-dashboard-card tg-panel"><span className="tg-dashboard-card-icon" aria-hidden="true">✈</span><span className="tg-eyebrow">Explore at your pace</span><h2>{copy.solo}</h2><p>{copy.soloCopy}</p><button type="button" onClick={() => setGameSetupOpen(true)} disabled={busy} className="tg-button tg-button-primary">{copy.create}</button></article>
            <article className="tg-dashboard-card tg-panel"><span className="tg-dashboard-card-icon" aria-hidden="true">☀</span><span className="tg-eyebrow">One shared location · resets at 00:00 UTC</span><h2>Daily Challenge</h2><p>Everyone gets the same location each UTC day. Submit one guess, then compare your score on the global table.</p><button type="button" onClick={() => void startDaily()} disabled={busy} className="tg-button tg-button-primary">{busy ? 'Preparing…' : 'Play today’s challenge'}</button></article>
            <article className="tg-dashboard-card tg-panel"><span className="tg-dashboard-card-icon" aria-hidden="true">⚔</span><span className="tg-eyebrow">Async · share a link</span><h2>{copy.duels}</h2><p>{copy.duelsCopy}</p><Link to="/duels" className="tg-button tg-button-primary">{copy.duelsCta}</Link></article>
          </div>
        </section>
      ) : null}

      {phase === 'home' && !authUser ? (
        <section aria-labelledby="home-heading" className="tg-hero-fig">
          <div className="tg-hero-fig-bg" aria-hidden="true"><div className="tg-hero-fig-rings" /></div>
          <div className="tg-hero-fig-overlay" aria-hidden="true" />
          <div className="tg-hero-fig-content">
            <div className="tg-hero-fig-logo">
              <span className="tg-brand-mark" aria-hidden="true">⌖</span>
              <span className="tg-hero-fig-wordmark">Terra<span>Guessr</span></span>
            </div>
            <h1 id="home-heading" className="tg-hero-fig-title">{copy.homeTitleA}<br />{copy.homeTitleB}</h1>
            <p className="tg-hero-fig-copy">{copy.homeCopy}</p>
            <div className="tg-hero-fig-meta">
              <span className="tg-hero-fig-meta-item"><span aria-hidden="true">🌐</span>{copy.playInBrowser}</span>
              <span className="tg-hero-fig-meta-divider" aria-hidden="true" />
              <span className="tg-hero-fig-meta-item"><span aria-hidden="true">⌖</span>{copy.weatherOnly}</span>
            </div>
            <div className="tg-hero-cta">
              <button
                type="button"
                onClick={() => void startGame(selection)}
                disabled={busy}
                data-testid="start-game"
                aria-label={busy ? copy.preparing : copy.start}
                className="tg-button tg-button-primary tg-fly-button"
              >
                {busy ? (
                  copy.preparing
                ) : (
                  <>
                    <span className="tg-fly-plane" aria-hidden="true">✈</span>
                    <span className="tg-fly-text" aria-hidden="true">
                      <span className="tg-fly-text-a">{copy.start}</span>
                      <span className="tg-fly-text-b">{copy.startHover}</span>
                    </span>
                  </>
                )}
              </button>
              <button type="button" onClick={openTutorial} data-testid="hero-tutorial" className="tg-button tg-button-quiet">{copy.learn}</button>
            </div>
            <div className="tg-mt-6">
              <div className="tg-eyebrow tg-mb-3">{copy.chooseChallenge}</div>
              <DifficultyPicker value={selection} onChange={setSelection} disabled={busy} />
            </div>
          </div>
          <button type="button" className="tg-hero-fig-card" onClick={openTutorial}>
            <span className="tg-hero-fig-card-title">{copy.learnCardTitle}</span>
            <span className="tg-hero-fig-card-arrow" aria-hidden="true">↗</span>
          </button>
        </section>
      ) : null}

      {phase === 'playing' ? (
        <section>
          <div className="tg-game-top">
            <div className="tg-game-stats">
              <div className="tg-stat"><span className="tg-stat-label">Round</span><span className="tg-stat-value">{round?.roundNumber ?? '-'} <span className="tg-muted">/ {activeRoundsTotal}</span></span></div>
              <div className="tg-stat"><span className="tg-stat-label">Difficulty</span><span className="tg-stat-value tg-capitalize">{state.difficulty}</span></div>
              {round && round.attemptsTotal > 1 ? <div className="tg-stat"><span className="tg-stat-label">Attempt</span><span className="tg-stat-value">{attemptProgress.current} <span className="tg-muted">/ {attemptProgress.total}</span></span></div> : null}
              <div className="tg-stat"><span className="tg-stat-label">Score</span><span className="tg-stat-value mono">{revealed?.score ?? '—'}</span></div>
            </div>
            <div className="tg-game-top-actions">
              <span className="tg-chip"><span className="tg-dot" />{dailyMode ? `Daily · ${dailyDate ?? 'UTC'}` : 'Solo expedition'}</span>
              <span className="tg-chip"><span className="tg-dot" />{round?.selectionMode === 'list' ? 'Choice mode' : 'Map mode'}</span>
              {revealed ? (
                <button
                  type="button"
                  onClick={() => void handleAdvance()}
                  disabled={busy}
                  data-testid="advance"
                  className="tg-button tg-button-secondary"
                >
                  {isFinalRound ? 'See final results' : 'Next round'}
                </button>
              ) : null}
            </div>
          </div>
          {busy && !round ? <p role="status">Loading round...</p> : null}
          {round && roundSource ? (
            <RoundScreen
              key={round.roundId}
              dataSource={roundSource}
              gameId={activeGameId ?? undefined}
              onAttemptChange={handleAttemptChange}
            />
          ) : null}
          {dailyMode && revealed ? <section className="tg-panel tg-daily-leaderboard-panel" aria-label="Daily leaderboard"><div className="tg-eyebrow">{dailyDate} · UTC daily leaderboard</div><h2 className="tg-mt-2">Your placement: {dailyLeaderboard?.myRank ? `#${dailyLeaderboard.myRank}` : '—'}</h2><ol>{dailyLeaderboard?.entries.map((entry) => <li key={entry.rank}>{entry.rank}. {entry.displayName} · {entry.score} pts · {entry.distanceKm.toFixed(1)} km</li>)}</ol></section> : null}
        </section>
      ) : null}

      {phase === 'results' && results ? (
        <section aria-labelledby="results-heading" data-testid="results-view" className="tg-panel tg-results">
          <div className="tg-eyebrow">Expedition complete</div>
          <h2 id="results-heading" className="tg-heading-lg">Your journey</h2>
          <p className="tg-muted">Total score</p>
          <p className="tg-result-score"><strong data-testid="total-score">{results.totalScore}</strong><span className="tg-result-score-suffix"> pts</span></p>
          <p className="tg-muted tg-mt-1">Total distance: {results.results.reduce((sum, entry) => sum + entry.distanceKm, 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} km across {results.results.length} round{results.results.length === 1 ? '' : 's'}</p>
          <div className="tg-results-map-wrap">
            <ResultsMap className="tg-results-map" results={results.results} />
          </div>
          <ol data-testid="result-list">
            {results.results.map((entry) => (
              <li key={entry.resultId} data-testid="result-row" className="tg-result-row">
                <span>Round {entry.roundNumber}</span><span><strong>{entry.score} pts</strong> · {entry.distanceKm.toLocaleString(undefined, { maximumFractionDigits: 1 })} km</span>
              </li>
            ))}
          </ol>
          <div className="tg-results-actions tg-mt-6">
            <button type="button" onClick={() => void startGame(selection, configuredRoundsTotal, configuredGeography, configuredCandidateCount, configuredAttemptsPerRound, configuredUnlockMode, configuredUnlockCost)} data-testid="play-again" className="tg-button tg-button-primary">↻ &nbsp; Play again</button>
            <button type="button" onClick={handlePlayAgain} data-testid="return-home" className="tg-button tg-button-secondary">Return home</button>
          </div>
          {round && lastResult ? (
            <ChallengePanel roundId={round.roundId} resultId={lastResult.resultId} />
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

export default HomePage;
