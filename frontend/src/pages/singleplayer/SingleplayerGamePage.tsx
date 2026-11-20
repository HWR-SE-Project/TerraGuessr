import { useEffect, useState } from 'react'
import { useNavigationGuard } from '../../components/ui/NavigationGuard'
import { BackNavigation } from '../../components/ui/BackNavigation'
import { AppNavigation, PageNavigation } from '../../components/ui/PageNavigation'
import type { CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { GuessButton } from './GuessButton'
import { useGameSession } from './useGameSession'
import { StreetViewViewer } from './StreetViewViewer'
import { GuessMap } from './GuessMap'
import { CandidateList } from '../../components/CandidateList'
import { GameplayHUD, GameIcon } from './GameplayHUD'
import { GameDialog } from './GameDialog'
import { GameSettings } from './GameSettings'
import { GeographicIntelligence } from './GeographicIntelligence'
import { readSettings } from './settings'
import { DifficultyPicker } from './DifficultyPicker'
import { ExitGameDialog } from './ExitGameDialog'
import { readDifficulty, saveDifficulty } from './difficulty'
import { Tutorial, markTutorialSeen, shouldShowTutorialForNewGame } from './Tutorial'
import { RoundResults, FinalResults } from './GameResults'
import { useCosmicBackgroundMode } from '../../components/cosmic/CosmicContext'
import './SingleplayerGamePage.css'
import './SingleplayerSetup.css'
import './SessionSummary.css'

export function SingleplayerGamePage() {
  const navigate = useNavigate()
  const game = useGameSession()
  const navigation = useNavigationGuard(game.inProgress)
  const [searchParams, setSearchParams] = useSearchParams()
  const [localDialog, setDialog] = useState<
    'settings' | 'menu' | 'end' | 'restart' | 'tutorial' | null
  >(() => searchParams.get('tutorial') === '1' ? 'tutorial' : null)
  useEffect(() => {
    if (searchParams.get('tutorial') === '1') {
      setSearchParams(params => { params.delete('tutorial'); return params }, { replace: true })
    }
  }, [searchParams, setSearchParams])
  const [settings, setSettings] = useState(readSettings)
  const [difficulty, setDifficulty] = useState(readDifficulty)
  const [tutorialStep, setTutorialStep] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const active = game.session.activeRound
  const view = game.view
  const exploring = view === 'playing'
  const dialog = navigation.state === 'blocked' ? 'end' : localDialog
  const selectedCandidateId =
    active?.candidates?.find(
      (candidate) =>
        game.guess &&
        candidate.lat === game.guess.lat &&
        candidate.lon === game.guess.lon,
    )?.id ?? null
  useCosmicBackgroundMode(!exploring)
  const tutorialOpen = dialog === 'tutorial'
  const mapExpanded = !tutorialOpen && (expanded || (hovered && settings.hoverExpand))
  const mapCollapsed = !tutorialOpen && collapsed
  useEffect(() => {
    try {
      localStorage.setItem(
        'terraguessr.gameplay.settings',
        JSON.stringify(settings),
      )
    } catch {
      /* Settings remain available in memory. */
    }
  }, [settings])
  useEffect(() => {
    saveDifficulty(difficulty)
  }, [difficulty])
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        (event.target instanceof Element && event.target.closest('dialog, .tg-page-nav'))
      )
        return
      if (
        event.key === 'Enter' &&
        !dialog &&
        event.target === document.body &&
        exploring &&
        game.guess &&
        game.panoramaReady &&
        !game.busy
      ) {
        event.preventDefault()
        void game.submit()
      }
      if (event.key === 'Escape' && !dialog && game.inProgress) {
        if (expanded || hovered) {
          setExpanded(false)
          setHovered(false)
        } else setDialog('menu')
      }
    }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [dialog, expanded, hovered, exploring, game, view])
  function leave() {
    if (game.inProgress) setDialog('end')
    else navigate('/')
  }
  // The only two places a brand-new expedition actually begins: the welcome
  // screen's start button (no session yet) and an explicit restart/play-again.
  // Resuming a restored session and advancing to the next round must never
  // pass through here, so the tutorial can't re-trigger for those.
  function startExpedition() {
    const isNewGame = !game.session.id
    setDialog(isNewGame && shouldShowTutorialForNewGame() ? 'tutorial' : null)
    void game.next({ difficulty })
  }
  function restartExpedition() {
    setDialog(shouldShowTutorialForNewGame() ? 'tutorial' : null)
    void game.next({ restart: true, difficulty })
  }
  function closeExitDialog() {
    setDialog(null)
    game.clearExitError()
    if (navigation.state === 'blocked') navigation.reset()
  }
  // Ending finalizes the session server-side and switches this same page
  // into the session summary view (game.showFinal) — no route change.
  async function handleEndGame() {
    if (await game.endGame()) {
      setDialog(null)
      if (navigation.state === 'blocked') navigation.proceed()
    }
  }
  const status = game.busy
    ? 'Please wait…'
    : game.result
      ? 'Round complete'
      : game.showFinal
        ? 'Expedition complete'
        : game.guess
          ? 'Ready to make your guess'
          : game.panoramaReady
            ? 'Explore. Find your bearings.'
            : active
              ? 'Loading Street View…'
              : 'Endless rounds. A whole world.'
  return (
    <main
      className="sp-page"
      aria-label="TerraGuessr singleplayer game"
      data-game-phase={game.phase}
      data-tutorial-step={tutorialOpen ? tutorialStep : undefined}
      data-view={view}
      data-cosmic={exploring ? 'off' : 'on'}
    >
      <div className="sp-top-shade" />
      <PageNavigation active="singleplayer" game={game.inProgress} summary={view === 'session-summary'}
        onHelp={() => setDialog('tutorial')} onSettings={() => setDialog('settings')}
        onMenu={() => setDialog('menu')} />

      {(view === 'setup' || view === 'loading') && (
        <div className="sp-setup-shell">
          <section className="sp-welcome sp-glass" aria-label="Start expedition">
            <div className="sp-setup-intro">
              <h1>
                <span>The world is out there.</span>
                <em>Find your place.</em>
              </h1>
              <p>Explore the world. Follow the clues. Make your guess.</p>
              <p className="sp-setup-meta">
                Unlimited rounds · Up to 5,000 points per round · No time limit
              </p>
            </div>
            <div className="sp-setup-options">
              {view === 'loading' ? (
                <div className="sp-setup-loading" role="status">
                  <span className="sp-spinner" />
                  <p>
                    {game.session.id
                      ? 'Scouting your next location…'
                      : 'Preparing your first expedition…'}
                  </p>
                </div>
              ) : game.checking ? (
                <p role="status">Checking game availability…</p>
              ) : !game.available ? (
                <div className="sp-unavailable" role="status">
                  <strong>Street View is currently unavailable</strong>
                  <p>
                    {game.setupIssues.join(' ') ||
                      'The map provider could not be reached. Check the connection and retry.'}
                  </p>
                  <button
                    className="sp-secondary tg-control"
                    onClick={() => void game.refreshConfig()}
                  >
                    Check again
                  </button>
                </div>
              ) : (
                <>
                  {!game.session.id && (
                    <DifficultyPicker
                      value={difficulty}
                      onChange={setDifficulty}
                      disabled={game.busy}
                    />
                  )}
                  <button
                    className="sp-primary tg-control tg-control--primary"
                    disabled={game.busy}
                    onClick={startExpedition}
                  >
                    {game.session.id ? 'Continue expedition' : 'Start Exploring'}
                  </button>
                </>
              )}
            </div>
          </section>
          <BackNavigation to="/">Return Home</BackNavigation>
        </div>
      )}
      {exploring && <section className="sp-stage" aria-label="Exploration controls">
        {active && (
          <StreetViewViewer
            round={active}
            onReady={game.setPanoramaReady}
            showCompass={settings.compass}
            scrollZoom={settings.scrollZoom}
            onRetryLocation={() => void game.retryLocation()}
            retrying={game.busy}
          />
        )}
        {exploring && !game.panoramaReady && (
          <div className="sp-loading sp-glass" role="status">
            <span className="sp-spinner" />
            Loading your location…
          </div>
        )}

        {exploring && active && (
          <GeographicIntelligence
            key={`${active.id}:${active.panoId}`}
            load={game.loadIntelligence}
            round={active}
            defaultExpanded={game.session.difficulty !== 'hard'}
            tutorialFocused={tutorialOpen && tutorialStep === 0}
          />
        )}
      </section>}
      {view === 'round-results' && game.result && (
        <RoundResults
          result={game.result}
          busy={game.busy}
          onNext={() => void game.next()}
        />
      )}
      {view === 'session-summary' && (
        <FinalResults
          session={game.session}
          busy={game.busy}
          onPlayAgain={restartExpedition}
          onHome={() => navigate('/')}
        />
      )}
      {game.error && (
        <div className="sp-error sp-glass" role="alert">
          {game.error}
        </div>
      )}
      {exploring && <footer className="sp-bottom-bar">
        <GameplayHUD round={active?.number ?? 1} score={game.session.totalScore} status={status} />
      </footer>}

      {exploring && (
        <aside
          className={`sp-guess-panel sp-glass${mapExpanded ? ' sp-guess-expanded' : ''}${mapCollapsed ? ' sp-guess-collapsed' : ''}`}
          style={
            { '--map-opacity': settings.mapOpacity / 100 } as CSSProperties
          }
          aria-label="Guessing map"
          onPointerEnter={(event) => {
            if (event.pointerType === 'mouse') setHovered(true)
          }}
          onPointerLeave={() => setHovered(false)}
        >
          <header className="sp-map-header">
            <button
              className="sp-map-mode tg-control"
              aria-expanded={!mapCollapsed}
              aria-controls="guess-map-content"
              onClick={() => setCollapsed(!collapsed)}
            >
              <GameIcon name="pin" />
              <span>
                {active?.candidates ? 'Pick a city' : 'World Explorer'}
                <small>NO TIME LIMIT · MOVING ALLOWED</small>
              </span>
              <span aria-hidden="true">{mapCollapsed ? '▴' : '▾'}</span>
            </button>
            {!active?.candidates && (
              <button
                className="sp-icon tg-control"
                aria-label={mapExpanded ? 'Shrink map' : 'Expand map'}
                aria-expanded={mapExpanded}
                onClick={() => {
                  setExpanded(!mapExpanded)
                  setHovered(false)
                  setCollapsed(false)
                }}
              >
                <GameIcon name={mapExpanded ? 'collapse' : 'expand'} />
              </button>
            )}
          </header>
          <div id="guess-map-content" hidden={mapCollapsed}>
            <div className="sp-map-wrap">
              {active?.candidates ? (
                <CandidateList
                  candidates={active.candidates}
                  onChange={game.setGuess}
                  selectedId={selectedCandidateId}
                />
              ) : (
                <GuessMap
                  key={active?.id ?? 'idle'}
                  guess={game.guess}
                  onChange={game.setGuess}
                  interactive={exploring && game.panoramaReady && !game.busy}
                  countryBorders={game.session.difficulty !== 'hard'}
                />
              )}
              {!active?.candidates && !game.guess && game.panoramaReady && (
                <span className="sp-map-hint">
                  Click the map to place your pin
                </span>
              )}
            </div>
            <div className="sp-map-footer">
              <span aria-live="polite">
                {game.guess
                  ? `${game.guess.lat.toFixed(3)}°, ${game.guess.lon.toFixed(3)}° · pin placed`
                  : 'Where in the world are you?'}
              </span>
              <GuessButton
                disabled={!game.guess || !game.panoramaReady || game.busy || !exploring}
                busy={game.busy}
                onClick={() => void game.submit()}
              />
            </div>
          </div>
        </aside>
      )}
      {dialog === 'tutorial' && (
        <Tutorial
          round={exploring ? active : null}
          result={game.result}
          onStepChange={setTutorialStep}
          onClose={() => {
            setDialog(null)
            markTutorialSeen()
          }}
        />
      )}
      {dialog === 'settings' && (
        <GameSettings
          settings={settings}
          onChange={setSettings}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'menu' && (
        <GameDialog title="Take a breather" onClose={() => setDialog(null)}>
          <p className="sp-muted">Your next discovery can wait.</p>
          <div className="sp-menu-actions">
            <AppNavigation active="singleplayer" onNavigate={() => setDialog(null)} />
            <button className="sp-primary tg-control tg-control--primary" onClick={() => setDialog(null)}>
              Back to game <span>→</span>
            </button>
            <button className="sp-secondary tg-control" onClick={() => setDialog('tutorial')}>
              How to Play / Tutorial
            </button>
            <button className="sp-secondary tg-control" onClick={() => setDialog('settings')}>Game settings</button>
            <button
              className="sp-secondary tg-control"
              disabled={game.busy || !game.available}
              onClick={() => {
                if (game.inProgress) setDialog('restart')
                else restartExpedition()
              }}
            >
              Restart game
            </button>
            <button
              className="sp-secondary tg-control"
              disabled={game.busy}
              onClick={leave}
            >
              {game.inProgress ? 'Exit Game' : 'Return Home'}
            </button>
          </div>
        </GameDialog>
      )}
      {dialog === 'end' && (
        <ExitGameDialog
          onContinue={closeExitDialog}
          onEnd={() => void handleEndGame()}
          pending={game.exitPending}
          waiting={game.busy}
          error={game.exitError}
          round={
            active?.number ??
            game.result?.number ??
            (game.showFinal ? game.session.results.length : 1)
          }
          score={game.session.totalScore}
        />
      )}
      {dialog === 'restart' && (
        <GameDialog title="Start a new expedition?" onClose={() => setDialog(null)}>
          <p className="sp-muted">
            Your current expedition will be replaced. Start a new endless
            session?
          </p>
          <div className="sp-dialog-actions">
            <button
              className="sp-secondary tg-control"
              disabled={game.busy}
              onClick={() => setDialog(null)}
            >
              Keep exploring
            </button>
            <button
              className="sp-primary tg-control tg-control--primary"
              disabled={game.busy || game.exitPending !== null}
              onClick={async () => {
                if (await game.endGame()) restartExpedition()
              }}
            >
              Restart game
            </button>
          </div>
        </GameDialog>
      )}
    </main>
  )
}
