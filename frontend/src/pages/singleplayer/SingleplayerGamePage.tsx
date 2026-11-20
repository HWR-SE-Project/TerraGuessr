import { useEffect, useState } from 'react'
import { Brand } from '../../components/ui/Brand'
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
import { DIFFICULTY_LEVELS, readDifficulty, saveDifficulty } from './difficulty'
import { Tutorial, markTutorialSeen, shouldShowTutorialForNewGame } from './Tutorial'
import { RoundResults, FinalResults } from './GameResults'
import { useCosmicBackgroundMode } from '../../components/cosmic/CosmicContext'
import './SingleplayerGamePage.css'

export function SingleplayerGamePage() {
  const navigate = useNavigate()
  const game = useGameSession()
  const [searchParams, setSearchParams] = useSearchParams()
  const [dialog, setDialog] = useState<
    'settings' | 'menu' | 'end' | 'restart' | 'tutorial' | null
  >(() => searchParams.get('tutorial') === '1' ? 'tutorial' : null)
  useEffect(() => {
    if (searchParams.get('tutorial') === '1') {
      setSearchParams(params => { params.delete('tutorial'); return params }, { replace: true })
    }
  }, [searchParams, setSearchParams])
  const [settings, setSettings] = useState(readSettings)
  const [difficulty, setDifficulty] = useState(readDifficulty)
  const [expanded, setExpanded] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const active = game.session.activeRound
  const exploring = Boolean(active && !game.result && !game.showFinal)
  const selectedCandidateId =
    active?.candidates?.find(
      (candidate) =>
        game.guess &&
        candidate.lat === game.guess.lat &&
        candidate.lon === game.guess.lon,
    )?.id ?? null
  useCosmicBackgroundMode(!exploring)
  const mapExpanded = expanded || (hovered && settings.hoverExpand)
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
        (event.target instanceof Element && event.target.closest('dialog'))
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
      if (event.key === 'Escape' && !dialog) {
        if (expanded || hovered) {
          setExpanded(false)
          setHovered(false)
        } else setDialog('menu')
      }
    }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [dialog, expanded, hovered, exploring, game])
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
  // Browser back must never silently discard an active expedition: while one
  // is in progress, swallow the implicit back navigation (re-pushing the
  // entry it would have left) and open the same confirmation every other
  // exit path uses instead.
  useEffect(() => {
    if (!game.inProgress) return
    window.history.pushState({ spExitGuard: true }, '')
    const onPopState = () => {
      window.history.pushState({ spExitGuard: true }, '')
      setDialog('end')
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [game.inProgress])
  function closeExitDialog() {
    setDialog(null)
    game.clearExitError()
  }
  // Ending finalizes the session server-side and switches this same page
  // into the session summary view (game.showFinal) — no route change.
  async function handleEndGame() {
    if (await game.endGame()) setDialog(null)
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
      data-cosmic={exploring ? 'off' : 'on'}
    >
      <div className="sp-top-shade" />
      <header className="sp-topbar">
        <button
          className="sp-brand"
          aria-label="TerraGuessr home"
          onClick={leave}
        >
          <Brand />
        </button>
        <div className="sp-top-controls">
          <button
            className="sp-icon tg-control sp-glass"
            aria-label="How to play"
            data-tutorial-trigger
            onClick={() => setDialog('tutorial')}
          >
            <GameIcon name="info" />
          </button>
          <button
            className="sp-icon tg-control sp-glass"
            aria-label="Game settings"
            onClick={() => setDialog('settings')}
          >
            <GameIcon name="settings" />
          </button>
          <button
            className="sp-icon tg-control sp-glass"
            aria-label="Game menu"
            onClick={() => setDialog('menu')}
          >
            <GameIcon name="menu" />
          </button>
        </div>

      </header>

      {!active && !game.result && !game.showFinal && (
        <section className="sp-welcome sp-glass" aria-label="Start expedition">
          <span className="sp-welcome-globe" aria-hidden="true">
            ◎
          </span>
          <span className="sp-eyebrow">SINGLEPLAYER · WORLD EXPLORER</span>
          <h1>
            The world is out there.
            <br />
            <em>Find your place.</em>
          </h1>
          <p>
            Explore real streets. Follow the clues.
            <br />
            Drop your pin and see how close you get.
          </p>
          <div className="sp-rules">
            <span>
              <b>Unlimited</b> rounds
            </span>
            <i />
            <span>
              Up to <b>5,000</b> points / round
            </span>
            <i />
            <span>No time limit</span>
          </div>
          {game.checking ? (
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
                <span>
                  {game.busy
                    ? 'Finding your first location…'
                    : game.session.id
                      ? 'Continue expedition'
                      : 'Start exploring'}
                  {!game.busy && !game.session.id && (
                    <span className="sp-primary-difficulty">
                      {' '}
                      · {DIFFICULTY_LEVELS.find((level) => level.id === difficulty)?.label ?? difficulty}
                    </span>
                  )}
                </span>
                <span aria-hidden="true">→</span>
              </button>
            </>
          )}
        </section>
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
          />
        )}
      </section>}
      {game.result && (
        <RoundResults
          result={game.result}
          busy={game.busy}
          onNext={() => void game.next()}
        />
      )}
      {game.showFinal && (
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
      <footer className="sp-bottom-bar">
        <button
          aria-label="Return"
          className="sp-return tg-control sp-glass"
          onClick={leave}
        >
          <GameIcon name="return" />
          <span>Return</span>
        </button>
        <GameplayHUD
          round={
            active?.number ??
            game.result?.number ??
            (game.showFinal ? game.session.results.length : 1)
          }
          score={game.session.totalScore}
          status={status}
        />

      </footer>

      {!game.result && !game.showFinal && (
        <aside
          className={`sp-guess-panel sp-glass${mapExpanded ? ' sp-guess-expanded' : ''}${collapsed ? ' sp-guess-collapsed' : ''}`}
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
              aria-expanded={!collapsed}
              aria-controls="guess-map-content"
              onClick={() => setCollapsed(!collapsed)}
            >
              <GameIcon name="pin" />
              <span>
                {active?.candidates ? 'Pick a city' : 'World Explorer'}
                <small>NO TIME LIMIT · MOVING ALLOWED</small>
              </span>
              <span aria-hidden="true">{collapsed ? '▴' : '▾'}</span>
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
          <div id="guess-map-content" hidden={collapsed}>
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
          difficulty={game.session.id ? game.session.difficulty : difficulty}
          round={exploring ? active : null}
          loadIntelligence={game.loadIntelligence}
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
            <button className="sp-primary tg-control tg-control--primary" onClick={() => setDialog(null)}>
              Back to game <span>→</span>
            </button>
            <button className="sp-secondary tg-control" onClick={() => setDialog('tutorial')}>
              How to Play / Tutorial
            </button>
            <button
              className="sp-secondary tg-control"
              disabled={game.busy || !game.available}
              onClick={() => {
                if (game.inProgress || game.session.id) setDialog('restart')
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
              Return home
            </button>
          </div>
        </GameDialog>
      )}
      {dialog === 'end' && (
        <ExitGameDialog
          onContinue={closeExitDialog}
          onEnd={() => void handleEndGame()}
          pending={game.exitPending}
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
              disabled={game.busy}
              onClick={restartExpedition}
            >
              Restart game
            </button>
          </div>
        </GameDialog>
      )}
    </main>
  )
}
