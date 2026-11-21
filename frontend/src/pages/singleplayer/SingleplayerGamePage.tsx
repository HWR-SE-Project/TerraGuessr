import { GameMenu } from '../../game/GameMenu'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { useEffect, useState } from 'react'
import { useNavigationGuard } from '../../components/layout/useNavigationGuard'
import { AppHeader } from '../../components/layout/AppHeader'
import type { CSSProperties } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { GuessButton } from '../../game/GuessButton'
import { useGameSession } from './useGameSession'
import { StreetViewViewer } from '../../game/StreetViewViewer'
import { GuessMap } from '../../game/GuessMap'
import { CityGuessPanel } from '../../game/CityGuessPanel'
import { GameplayHUD } from '../../game/GameplayHUD'
import { Modal } from '../../components/ui/Modal'
import { GameSettings } from '../../game/GameSettings'
import { GeographicIntelligence } from '../../game/GeographicIntelligence'
import { useGameplaySettings } from '../../game/settings'
import { DifficultyPicker } from '../../game/DifficultyPicker'
import { ExitGameDialog } from './ExitGameDialog'
import { readDifficulty, saveDifficulty } from '../../game/difficulty'
import { Tutorial, markTutorialSeen, shouldShowTutorialForNewGame } from './Tutorial'
import { RoundResults, FinalResults } from './GameResults'
import { useCosmicBackgroundMode } from '../../scene/cosmic/CosmicContext'
import '../../game/Game.css'
import './GuessingMapPanel.css'
import './SingleplayerSetup.css'
import './SessionSummary.css'
import { clockLabel } from '../../lib/format'

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
  const [settings, setSettings] = useGameplaySettings()
  const [difficulty, setDifficulty] = useState(readDifficulty)
  const [tutorialStep, setTutorialStep] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const active = game.session.activeRound
  const view = game.view
  const exploring = view === 'playing'
  // R07: a failed panorama must not block placing and submitting a guess.
  const guessReady = game.panoramaReady || game.panoramaUnavailable
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
  const mapExpanded = !tutorialOpen && !active?.candidates && !collapsed && (expanded || (hovered && settings.hoverExpand))
  const mapCollapsed = !tutorialOpen && collapsed
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
        guessReady &&
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
  }, [dialog, expanded, guessReady, hovered, exploring, game, view])
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
        : game.panoramaReady
          ? ''
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
      <AppHeader game={game.inProgress} summary={view === 'session-summary'}
        onHelp={() => setDialog('tutorial')} onSettings={() => setDialog('settings')}
        onMenu={() => setDialog('menu')} />

      {(view === 'setup' || view === 'loading') && (
        <div className="sp-setup-shell">
          <section className="sp-welcome sp-glass tg-glass" aria-label="Start expedition">
            <div className="sp-setup-intro">
              <h1>
                <span>The world is out there.</span>
                <em>Find your place.</em>
              </h1>
              <p className="sp-setup-meta">
                Timed rounds · Difficulty-based attempts · Up to 5,000 points
                per round
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
                  <Button variant="secondary"
                    size="sm"
                    onClick={() => void game.refreshConfig()}
                  >
                    Check again
                  </Button>
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
                  <Button
                    block
                    size="lg"
                    disabled={game.busy}
                    onClick={startExpedition}
                  >
                    {game.session.id ? 'Continue expedition' : 'Start Exploring'}
                  </Button>
                </>
              )}
            </div>
          </section>
        </div>
      )}
      {exploring && <section className="sp-stage" aria-label="Exploration controls">
        {active && (
          <StreetViewViewer
            round={active}
            onReady={game.setPanoramaReady}
            onUnavailable={game.setPanoramaUnavailable}
            showCompass={settings.compass}
            scrollZoom={settings.scrollZoom}
            onRetryLocation={() => void game.retryLocation()}
            retrying={game.busy}
          />
        )}
        {exploring && !game.panoramaReady && !game.panoramaUnavailable && (
          <div className="sp-loading sp-glass tg-glass" role="status">
            <span className="sp-spinner" />
            Loading your location…
          </div>
        )}

        {exploring && active && (
          <GeographicIntelligence
            key={`${active.id}:${active.panoId}`}
            load={game.loadIntelligence}
            round={active}
            tutorialFocused={tutorialOpen && tutorialStep === 0}
            access={active.extraData}
            onUnlock={() => void game.unlockExtraData()}
            unlocking={game.unlocking}
            unlockError={game.unlockError}
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
        <div className="sp-error sp-glass tg-glass" role="alert">
          {game.error}
        </div>
      )}
      {exploring && <footer className="sp-bottom-bar">
        <GameplayHUD round={active?.number ?? 1} score={game.session.totalScore} status={status} />
      </footer>}

      {exploring && active?.candidates ? (
        <CityGuessPanel
          candidates={active.candidates}
          selectedId={selectedCandidateId}
          onChange={game.setGuess}
          collapsed={mapCollapsed}
          onToggle={() => setCollapsed(!collapsed)}
          metadata={[
            game.remainingSeconds !== null ? clockLabel(game.remainingSeconds) : '',
            active.attemptsTotal > 0 ? `${active.attemptsUsed}/${active.attemptsTotal} attempts used` : '',
          ].filter(Boolean).join(' · ')}
        >
          <GuessButton compact
            disabled={!game.guess || !guessReady || game.busy}
            busy={game.busy}
            onClick={() => void game.submit(false)}
          />
          {active.attemptsUsed > 0 && active.attemptsUsed < active.attemptsTotal && (
            <GuessButton compact variant="secondary" label="Final submit"
              disabled={!game.guess || !guessReady || game.busy}
              busy={game.busy}
              onClick={() => void game.submit(true)}
            />
          )}
        </CityGuessPanel>
      ) : exploring && (
        <aside
          className={`sp-guess-panel sp-world-panel tg-guess-surface tg-glass tg-glass--panel${mapExpanded ? ' sp-guess-expanded' : ''}${mapCollapsed ? ' sp-guess-collapsed' : ''}`}
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
              className="sp-map-mode"
              aria-expanded={!mapCollapsed}
              aria-controls="guess-map-content"
              onClick={() => setCollapsed(!collapsed)}
            >
              <span>World Explorer</span>
              <svg className="sp-map-chevron" viewBox="0 0 16 16" aria-hidden="true">
                <path d={mapCollapsed ? 'm5 10 3-3 3 3' : 'm5 6 3 3 3-3'} />
              </svg>
            </button>
            {game.remainingSeconds !== null && (
              <span className="sp-map-timer" aria-label={`${clockLabel(game.remainingSeconds)} remaining`}>
                {clockLabel(game.remainingSeconds)}
              </span>
            )}
            {!active?.candidates && (
              <button
                className="sp-map-expand"
                aria-label={mapExpanded ? 'Shrink map' : 'Expand map'}
                title={mapExpanded ? 'Shrink map' : 'Expand map'}
                aria-expanded={mapExpanded}
                aria-controls="guess-map-content"
                onClick={() => {
                  setExpanded(!mapExpanded)
                  setHovered(false)
                  setCollapsed(false)
                }}
              >
                <Icon name={mapExpanded ? 'collapse' : 'expand'} />
              </button>
            )}
          </header>
          <div id="guess-map-content" hidden={mapCollapsed}>
            <div className="sp-map-wrap">
              <GuessMap
                key={active?.id ?? 'idle'}
                guess={game.guess}
                onChange={game.setGuess}
                interactive={exploring && guessReady && !game.busy}
                countryBorders
              />
            </div>
            <div className="sp-map-footer">
              <span className="sp-map-status" aria-live="polite" aria-atomic="true">
                {game.guess
                  ? `${game.guess.lat.toFixed(3)}°, ${game.guess.lon.toFixed(3)}° · pin placed`
                  : guessReady ? 'Tap or click the map to place a pin' : 'Preparing map…'}
              </span>
              {active && active.attemptsTotal > 1 && (
                <small className="sp-map-attempts">
                  {active.attemptsTotal - active.attemptsUsed}{' '}
                  {active.attemptsTotal - active.attemptsUsed === 1 ? 'try' : 'tries'} left
                </small>
              )}
              <div className="sp-map-actions">
                <GuessButton
                  appearance="map"
                  disabled={!game.guess || !guessReady || game.busy || !exploring}
                  busy={game.busy}
                  onClick={() => void game.submit(false)}
                />
                {active && active.attemptsUsed > 0 &&
                  active.attemptsUsed < active.attemptsTotal && (
                    <GuessButton
                      appearance="map"
                      variant="secondary"
                      label="Final submit"
                      disabled={!game.guess || !guessReady || game.busy || !exploring}
                      busy={game.busy}
                      onClick={() => void game.submit(true)}
                    />
                  )}
              </div>
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
        <GameMenu onClose={() => setDialog(null)} onHelp={() => setDialog('tutorial')} onSettings={() => setDialog('settings')}>
            <Link className="tg-button tg-button--secondary tg-control tg-control--secondary" to="/multiplayer" onClick={() => setDialog(null)}>
              <Icon name="users" />
              Multiplayer
            </Link>
            <Button variant="secondary"
              disabled={game.busy || !game.available}
              onClick={() => {
                if (game.inProgress) setDialog('restart')
                else restartExpedition()
              }}
            >
              <Icon name="restart" />
              Restart game
            </Button>
            <Button variant={game.inProgress ? 'danger' : 'secondary'}
              disabled={game.busy}
              onClick={leave}
            >
              <Icon name="exit" />
              {game.inProgress ? 'Exit Game' : 'Return Home'}
            </Button>
        </GameMenu>
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
        <Modal title="Start a new expedition?" onClose={() => setDialog(null)}>
          <p>
            Your current expedition will be replaced. Start a new endless
            session?
          </p>
          <div className="tg-dialog-actions">
            <Button variant="secondary"
              disabled={game.busy}
              onClick={() => setDialog(null)}
            >
              Keep exploring
            </Button>
            <Button
              disabled={game.busy || game.exitPending !== null}
              onClick={async () => {
                if (await game.endGame()) restartExpedition()
              }}
            >
              Restart game
            </Button>
          </div>
        </Modal>
      )}
    </main>
  )
}
