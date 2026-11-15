// Playable solo loop (M3 integration glue):
// home (difficulty) -> ROUNDS_PER_GAME rounds (weather + map/list + submit + reveal)
// -> results. All server I/O goes through src/api/gameDataSource.ts, which in
// turn uses src/api/client.ts; session state lives in the gameStore context.
import { useEffect, useMemo, useState } from 'react';
import { ApiError, apiFetch, setPlayerToken } from './api/client';
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
import { AuthDialog } from './features/auth/AuthDialog';
import type { AuthUser } from './features/auth/AuthDialog';
import { AccountPages } from './features/auth/AccountPages';
import { GameSetup } from './features/setup/GameSetup';
import { GameStoreProvider, useGameStore } from './state/gameStore';

type Phase = 'home' | 'playing' | 'results';

type LoadStatus = 'idle' | 'loading' | 'error';
type AccountPage = 'profile' | 'settings' | null;

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
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [accountPage, setAccountPage] = useState<AccountPage>(null);
  const [gameSetupOpen, setGameSetupOpen] = useState(false);
  const [activeRoundsTotal, setActiveRoundsTotal] = useState(ROUNDS_PER_GAME);
  const [configuredRoundsTotal, setConfiguredRoundsTotal] = useState(ROUNDS_PER_GAME);
  const [authConfig, setAuthConfig] = useState({ googleAvailable: false, passwordRecoveryAvailable: false });
  const [resetToken] = useState(() => typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('token'));
  const [language, setLanguage] = useState<'en' | 'de'>('en');

  useEffect(() => {
    void apiFetch<{ user: AuthUser | null; preferences?: { language?: 'en' | 'de' } | null }>('/auth/session').then((result) => { setAuthUser(result.user); if (result.preferences?.language) setLanguage(result.preferences.language); }).catch(() => undefined);
    void apiFetch<typeof authConfig>('/auth/config').then(setAuthConfig).catch(() => undefined);
    if (resetToken) setAuthOpen(true);
  }, [resetToken]);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const copy = language === 'de'
    ? { help: 'Hilfe', settings: 'Einstellungen', profile: 'Profil', signIn: 'Anmelden', signOut: 'Abmelden', welcome: 'Willkommen zurück', dashboard: 'Wähle dein nächstes Abenteuer', solo: 'Solo-Expedition', soloCopy: 'Lies das Wetter, setze deinen Tipp und finde in fünf Runden heraus, wie nah du liegst.', create: 'Solo-Spiel starten', preparing: 'Wird vorbereitet…', homeEyebrow: 'Eine Welt voller Hinweise, ein guter Tipp', homeTitleA: 'Lies den Himmel.', homeTitleB: 'Finde den Ort.', homeCopy: 'Jede Runde beginnt an einem anderen Ort der Erde. Untersuche das Wetter, vertraue deinem Gefühl und setze deine Markierung.', start: 'Solo-Expedition starten', learn: 'Hinweise kennenlernen' }
    : { help: 'Help', settings: 'Settings', profile: 'Profile', signIn: 'Sign in', signOut: 'Sign out', welcome: 'Welcome back', dashboard: 'Choose your next expedition', solo: 'Solo expedition', soloCopy: 'Read the weather, place your guess, and see how close you get across five rounds.', create: 'Create solo game', preparing: 'Preparing…', homeEyebrow: 'A world of clues, one great guess', homeTitleA: 'Read the sky.', homeTitleB: 'Find the place.', homeCopy: 'Every round begins with a different corner of the Earth. Study its weather, trust your instincts, and drop your pin where you think you are.', start: 'Start solo expedition', learn: 'Learn the signals' };

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

  async function handleSignOut(): Promise<void> {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
      setAuthUser(null);
      setAccountPage(null);
      setLanguage('en');
    } catch (cause) {
      setError(friendlyErrorMessage(cause));
    }
  }

  async function startGame(nextSelection: DifficultySelection, roundsTotal = ROUNDS_PER_GAME): Promise<void> {
    if (busy) {
      return;
    }
    setSelection(nextSelection);
    setConfiguredRoundsTotal(roundsTotal);
    setStatus('loading');
    setError(null);
    setRound(null);
    setRevealed(null);
    setResults(null);

    let active = source;
    try {
      let created: CreateGameResponse;
      try {
        created = await active.createGame({ mode: 'solo', difficulty: nextSelection.difficulty, roundsTotal });
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
      void startGame(selection, configuredRoundsTotal);
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

  const isFinalRound = round !== null && round.roundNumber >= activeRoundsTotal;
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
          {phase !== 'home' ? <span className="tg-chip"><span className="tg-dot" />Solo expedition</span> : null}
          <button type="button" onClick={() => setTutorialOpen(true)} data-testid="how-to-play"><span aria-hidden="true">ⓘ</span><span className="tg-nav-label">{copy.help}</span></button>
          {authUser && phase === 'home' ? <>
            <button type="button" aria-label={copy.settings} onClick={() => setAccountPage('settings')}>{copy.settings}</button>
            <button type="button" aria-label={copy.profile} onClick={() => setAccountPage('profile')}>{copy.profile}</button>
            <button type="button" aria-label={copy.signOut} onClick={() => void handleSignOut()}>{copy.signOut}</button>
          </> : phase === 'home' ? <button type="button" onClick={() => setAuthOpen(true)}>{copy.signIn}</button> : null}
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

        {phase === 'home' && accountPage && authUser ? (
          <AccountPages page={accountPage} user={authUser} onBack={() => setAccountPage(null)} onDeleted={() => { setAuthUser(null); setAccountPage(null); }} onProfileUpdated={(displayName) => setAuthUser({ ...authUser, displayName })} onLanguageChange={setLanguage} />
        ) : null}

        {phase === 'home' && authUser && !accountPage && gameSetupOpen ? (
          <GameSetup initialSelection={selection} initialRoundsTotal={configuredRoundsTotal} language={language} loading={busy} onBack={() => setGameSetupOpen(false)} onStart={(chosen, count) => { setGameSetupOpen(false); void startGame(chosen, count); }} />
        ) : null}

        {phase === 'home' && authUser && !accountPage && !gameSetupOpen ? (
          <section className="tg-dashboard" aria-labelledby="dashboard-heading">
            <div className="tg-eyebrow">{copy.welcome}, {authUser.displayName}</div>
            <h1 id="dashboard-heading">{copy.dashboard}</h1>
            <p className="tg-muted">Your account is ready. Solo expeditions are available now; other modes will appear as their server features are completed.</p>
            <div className="tg-dashboard-grid">
              <article className="tg-dashboard-card tg-panel"><span className="tg-eyebrow">Explore at your pace</span><h2>{copy.solo}</h2><p>{copy.soloCopy}</p><button type="button" onClick={() => setGameSetupOpen(true)} disabled={busy} className="tg-button tg-button-primary">{copy.create}</button></article>
              <article className="tg-dashboard-card tg-panel tg-mode-unavailable"><span className="tg-eyebrow">Coming in later phases</span><h2>Multiplayer · Ranked · Daily</h2><p>Live rooms, matchmaking, and shared daily challenges are not enabled yet.</p></article>
            </div>
          </section>
        ) : null}

        {phase === 'home' && !authUser ? (
          <section aria-labelledby="home-heading" className="tg-hero">
            <div>
              <div className="tg-eyebrow">{copy.homeEyebrow}</div>
              <h1 id="home-heading">{copy.homeTitleA}<br /><span>{copy.homeTitleB}</span></h1>
              <p className="tg-hero-copy">{copy.homeCopy}</p>
              <div className="tg-hero-cta">
              <button
                type="button"
                onClick={() => void startGame(selection)}
                disabled={busy}
                data-testid="start-game"
                className="tg-button tg-button-primary"
              >
                {busy ? copy.preparing : `◉  ${copy.start}`}
              </button>
                <button type="button" onClick={() => setTutorialOpen(true)} data-testid="hero-tutorial" className="tg-button tg-button-quiet">{copy.learn}</button>
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
                <div className="tg-stat"><span className="tg-stat-label">Round</span><span className="tg-stat-value">{round?.roundNumber ?? '-'} <span className="tg-muted">/ {activeRoundsTotal}</span></span></div>
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
      <AuthDialog open={authOpen} googleAvailable={authConfig.googleAvailable} recoveryAvailable={authConfig.passwordRecoveryAvailable} resetToken={resetToken} onClose={() => setAuthOpen(false)} onAuthenticated={(user) => { setAuthUser(user); setAccountPage(null); setPhase('home'); }} />
    </div>
  );
}

export default App;
