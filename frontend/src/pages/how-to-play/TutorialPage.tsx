import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import type { GuessInput, LatLon, StreetResult } from '../../lib/contracts'
import { formatDistance, formatScore } from '../../lib/format'
import { markTutorialSeen } from '../../components/tutorial/Tutorial'
import { RoundStage } from '../../components/game/RoundStage'
import { RoundResultDetails } from '../../components/game/RoundResultDetails'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Icon } from '../../components/ui/Icon'
import { useGameRules } from '../../state/gameRules'
import {
  buildTutorialIntelligence,
  buildTutorialRoundView,
  buildTutorialScenarios,
  evaluateTutorialRound,
  resolveChoicePoint,
} from './tutorialScenarios'

type Phase = 'playing' | 'result' | 'summary'

interface RoundProgress {
  unlocked: boolean
  pointsSpent: number
  submittedGuesses: LatLon[]
  submittedCandidateIds: string[]
}

function initialProgress(roundIndex: number): RoundProgress {
  return {
    // Easy starts with Station Dossier unlocked; Medium starts locked (-100 pts).
    unlocked: roundIndex === 0,
    pointsSpent: 0,
    submittedGuesses: [],
    submittedCandidateIds: [],
  }
}

export function TutorialPage() {
  const navigate = useNavigate()
  const rulesCatalog = useGameRules()
  const [scenarios, setScenarios] = useState(() => buildTutorialScenarios(new Date()))

  const [roundIndex, setRoundIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('playing')
  const [coachIndex, setCoachIndex] = useState(0)
  const [coachOpen, setCoachOpen] = useState(true)
  const [progress, setProgress] = useState<RoundProgress>(() => initialProgress(0))
  const [results, setResults] = useState<StreetResult[]>([])
  const [exitOpen, setExitOpen] = useState(false)

  useEffect(() => {
    markTutorialSeen()
  }, [])

  const scenario = scenarios[roundIndex]!
  const totalScore = results.reduce((sum, entry) => sum + entry.score, 0)
  const latestResult = results.at(-1) ?? null

  const roundView = useMemo(
    () =>
      buildTutorialRoundView(scenario, {
        unlocked: progress.unlocked,
        pointsSpent: progress.pointsSpent,
        attemptsUsed: progress.submittedGuesses.length,
        submittedGuesses: progress.submittedGuesses,
        submittedCandidateIds: progress.submittedCandidateIds,
      }),
    [scenario, progress],
  )

  const loadIntelligence = useCallback(async () => {
    return buildTutorialIntelligence(scenario, progress.unlocked)
  }, [scenario, progress.unlocked])

  const startRound = useCallback((nextIndex: number) => {
    setRoundIndex(nextIndex)
    setProgress(initialProgress(nextIndex))
    setCoachIndex(0)
    setCoachOpen(true)
    setPhase('playing')
  }, [])

  const restartTutorial = useCallback(() => {
    setScenarios(buildTutorialScenarios(new Date()))
    setResults([])
    setRoundIndex(0)
    setProgress(initialProgress(0))
    setCoachIndex(0)
    setCoachOpen(true)
    setPhase('playing')
  }, [])

  const handleSelect = useCallback(async (_choice: GuessInput) => {
    // Selections in the tutorial are local-only; changing them never costs an attempt.
  }, [])

  const handleUnlock = useCallback(async () => {
    const cost = roundView.extraData.mode === 'points' ? (roundView.extraData.cost ?? 100) : 0
    setProgress((prev) =>
      prev.unlocked ? prev : { ...prev, unlocked: true, pointsSpent: cost },
    )
    // Automatically advance from the "Unlock Station Dossier" beat to the pin-drop beat.
    setCoachIndex((prev) => Math.max(prev, scenario.coachSteps.length - 1))
    setCoachOpen(true)
  }, [roundView.extraData, scenario.coachSteps.length])

  const finalizeRound = useCallback(
    (points: LatLon[], pointsSpent: number) => {
      const evaluated = evaluateTutorialRound(scenario, points, pointsSpent)
      setResults((prev) => [...prev.filter((r) => r.roundId !== evaluated.roundId), evaluated])
      setPhase('result')
    },
    [scenario],
  )

  const handleSubmit = useCallback(
    async (choice: GuessInput, final: boolean) => {
      const point = resolveChoicePoint(scenario, choice)
      if (!point) return
      const nextGuesses = [...progress.submittedGuesses, point]
      const nextCandidateIds =
        'candidateId' in choice
          ? [...progress.submittedCandidateIds, choice.candidateId]
          : progress.submittedCandidateIds

      const exhausted = nextGuesses.length >= roundView.attemptsTotal
      setProgress((prev) => ({
        ...prev,
        submittedGuesses: nextGuesses,
        submittedCandidateIds: nextCandidateIds,
      }))

      if (final || exhausted) {
        finalizeRound(nextGuesses, progress.pointsSpent)
      } else {
        // Keep the coach open on the action step so the player sees the Best-of-N feedback.
        setCoachIndex(scenario.coachSteps.length - 1)
        setCoachOpen(true)
      }
    },
    [scenario, progress, roundView.attemptsTotal, finalizeRound],
  )

  const handleFinish = useCallback(async () => {
    if (progress.submittedGuesses.length === 0) return
    finalizeRound(progress.submittedGuesses, progress.pointsSpent)
  }, [progress, finalizeRound])

  const currentStep = scenario.coachSteps[Math.min(coachIndex, scenario.coachSteps.length - 1)]!
  const isFirstStep = coachIndex === 0
  const isLastStep = coachIndex === scenario.coachSteps.length - 1
  const attemptsUsed = progress.submittedGuesses.length
  const attemptsRemaining = roundView.attemptsTotal - attemptsUsed
  const scoring = rulesCatalog?.scoring

  return (
    <RoundStage
      round={phase === 'summary' ? null : roundView}
      hud={
        phase === 'playing'
          ? {
              score: totalScore,
              roundsTotal: scenarios.length,
              timerBadge: (
                <div
                  className="flex items-center gap-1.5 rounded-2xl border border-lime-400/30 bg-space-700 px-3 py-2 font-display text-sm font-semibold text-lime-300 shadow-card"
                  aria-label={`Practice tutorial: ${scenario.modeLabel}`}
                >
                  <Icon name="compass" size={16} />
                  <span>{scenario.modeLabel}</span>
                </div>
              ),
              onExpired: () => {},
              onLeave: () => setExitOpen(true),
              leaveLabel: 'Exit tutorial',
            }
          : undefined
      }
      controls={
        phase === 'playing'
          ? {
              loadIntelligence,
              select: handleSelect,
              submit: handleSubmit,
              finish: handleFinish,
              unlock: handleUnlock,
            }
          : undefined
      }
    >
      {/* Non-blocking Coach Dock floating cleanly in the open center-bottom space */}
      {phase === 'playing' && (
        <div className="pointer-events-none fixed inset-x-3 bottom-3 z-[25] flex justify-center sm:inset-x-6 lg:pointer-events-none lg:inset-x-[405px] lg:bottom-4">
          <AnimatePresence mode="wait">
            {coachOpen ? (
              <motion.section
                key={`${scenario.id}-${currentStep.id}`}
                aria-label="Tutorial guide"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }}
                className="pointer-events-auto surface w-full max-w-md border-lime-400/25 p-4 shadow-panel"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-lime-400/15 px-2.5 py-1 font-display text-[11px] font-semibold uppercase tracking-wider text-lime-300">
                    <Icon name="sparkle" size={12} />
                    {currentStep.badge}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold tabular-nums text-subtle">
                      Tip {coachIndex + 1} / {scenario.coachSteps.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCoachOpen(false)}
                      aria-label="Minimize tutorial coach"
                      className="flex size-7 items-center justify-center rounded-full text-subtle transition-colors hover:bg-white/10 hover:text-cream"
                    >
                      <Icon name="chevronDown" size={16} />
                    </button>
                  </div>
                </div>

                <h2 className="mt-2 font-display text-base font-semibold text-cream sm:text-lg">
                  {currentStep.title}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted sm:text-sm">
                  {currentStep.body}
                </p>

                {attemptsUsed > 0 && attemptsRemaining > 0 && (
                  <div
                    role="status"
                    className="mt-2.5 flex items-start gap-2 rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs text-amber-200"
                  >
                    <Icon name="check" size={14} className="mt-0.5 shrink-0 text-amber-300" />
                    <span>
                      Bet #{attemptsUsed} locked in! You have {attemptsRemaining}{' '}
                      {attemptsRemaining === 1 ? 'try' : 'tries'} left — place another bet to hedge, or click{' '}
                      <strong className="text-cream">Final submit</strong> to reveal your score now.
                    </span>
                  </div>
                )}

                {currentStep.tip && attemptsUsed === 0 && (
                  <p className="mt-2.5 rounded-xl bg-space-800/90 px-3 py-2 text-xs leading-relaxed text-lime-300/90">
                    {currentStep.tip}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/8 pt-2.5">
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="!h-8 !px-2.5 !text-xs"
                      onClick={() => navigate('/how-to-play')}
                    >
                      Skip
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="!h-8 !px-2.5 !text-xs"
                      onClick={restartTutorial}
                    >
                      Restart
                    </Button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="!h-8 !px-3 !text-xs"
                      disabled={isFirstStep}
                      onClick={() => setCoachIndex((i) => Math.max(0, i - 1))}
                    >
                      Back
                    </Button>
                    {!isLastStep ? (
                      <Button
                        size="sm"
                        className="!h-8 !px-3 !text-xs"
                        trailingIcon="chevronRight"
                        onClick={() =>
                          setCoachIndex((i) => Math.min(scenario.coachSteps.length - 1, i + 1))
                        }
                      >
                        Next tip
                      </Button>
                    ) : roundIndex === 0 ? (
                      <Button
                        variant="tinted"
                        size="sm"
                        className="!h-8 !px-3 !text-xs"
                        trailingIcon="chevronRight"
                        onClick={() => startRound(1)}
                      >
                        Skip to Round 2
                      </Button>
                    ) : (
                      <Button
                        variant="tinted"
                        size="sm"
                        className="!h-8 !px-3 !text-xs"
                        onClick={() => setPhase('summary')}
                      >
                        See wrap-up
                      </Button>
                    )}
                  </div>
                </div>
              </motion.section>
            ) : (
              <motion.button
                key="coach-pill"
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                onClick={() => setCoachOpen(true)}
                className="pointer-events-auto flex items-center gap-2 rounded-full border border-lime-400/35 bg-space-700 px-4 py-2 font-display text-xs font-semibold text-lime-300 shadow-panel transition-colors hover:bg-space-600"
              >
                <Icon name="sparkle" size={14} />
                <span>Show tutorial tip ({coachIndex + 1}/{scenario.coachSteps.length})</span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Round Reveal Dialog */}
      <Dialog
        open={phase === 'result'}
        onClose={() => {}}
        dismissible={false}
        maxWidth="max-w-lg"
        title={`Round ${scenario.roundNumber} reveal · ${scenario.modeLabel}`}
      >
        {latestResult && (
          <div className="flex flex-col gap-4">
            <RoundResultDetails result={latestResult} />

            {latestResult.extraDataPointsSpent != null && latestResult.extraDataPointsSpent > 0 && (
              <p className="text-center text-xs text-subtle">
                Includes −{formatScore(latestResult.extraDataPointsSpent)} pts for unlocking the Station Dossier.
              </p>
            )}

            <div className="rounded-2xl border border-lime-400/20 bg-space-800/90 p-3.5">
              <p className="flex items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-wider text-lime-300">
                <Icon name="compass" size={14} />
                How the clues pointed to {scenario.placeName}
              </p>
              <ul className="mt-2 flex flex-col gap-1.5 text-xs leading-relaxed text-muted">
                {scenario.deductionSummary.map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <Icon name="check" size={13} className="mt-0.5 shrink-0 text-lime-300" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl bg-space-800 px-4 py-3 text-xs leading-relaxed text-muted">
              <strong className="text-cream">How scoring works:</strong> Great-circle (Haversine) distance
              within <strong className="text-lime-300">{formatScore(scoring?.fullScoreKm ?? 100)} km</strong>{' '}
              earns the full <strong className="text-lime-300">{formatScore(scoring?.maxScore ?? 5000)} pts</strong>,
              falling smoothly to 0 pts at {formatScore(scoring?.zeroScoreKm ?? 20000)} km.
            </div>

            {roundIndex === 0 ? (
              <Button
                fullWidth
                size="lg"
                trailingIcon="chevronRight"
                onClick={() => startRound(1)}
              >
                Continue to Round 2 (Medium · World map)
              </Button>
            ) : (
              <Button
                fullWidth
                size="lg"
                icon="trophy"
                onClick={() => setPhase('summary')}
              >
                Finish tutorial &amp; see Hard / Multiplayer
              </Button>
            )}
          </div>
        )}
      </Dialog>

      {/* Finale / Mode Wrap-up Screen */}
      {phase === 'summary' && (
        <div className="scroll-thin absolute inset-0 z-30 overflow-y-auto bg-space-900/95 backdrop-blur-sm">
          <div className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center px-4 py-10">
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full"
            >
              <div className="text-center">
                <span className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-lime-400 text-ink">
                  <Icon name="trophy" size={32} />
                </span>
                <p className="eyebrow mt-4">Tutorial complete</p>
                <h1 className="mt-1 font-display text-3xl font-semibold text-cream sm:text-4xl">
                  Ready to read the planet
                </h1>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
                  You’ve practiced Easy (6 marked cities, free clues, Best-of-3) and Medium (free world map,
                  paid Station Dossier, Best-of-2). Here’s what changes in Hard and Multiplayer:
                </p>
              </div>

              {results.length > 0 && (
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="surface-flat px-4 py-3 text-center">
                    <p className="font-display text-2xl font-semibold text-lime-300">
                      {formatScore(totalScore)}
                    </p>
                    <p className="mt-0.5 text-xs font-bold uppercase tracking-wider text-subtle">
                      Tutorial score
                    </p>
                  </div>
                  {results.map((entry) => (
                    <div key={entry.roundId} className="surface-flat px-4 py-3 text-center">
                      <p className="font-display text-lg font-semibold text-cream">
                        {entry.placeName ?? `Round ${entry.number}`}
                      </p>
                      <p className="mt-0.5 text-xs text-muted tabular-nums">
                        {formatDistance(entry.distanceKm)} ·{' '}
                        <span className="font-bold text-lime-300">+{formatScore(entry.score)}</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="surface p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-rose-400/15 text-rose-300">
                      <Icon name="flame" size={20} />
                    </span>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-rose-300">Hard difficulty</p>
                      <h2 className="font-display text-lg font-semibold text-cream">One shot, clock pressure</h2>
                    </div>
                  </div>
                  <ul className="mt-3 flex flex-col gap-1.5 text-sm text-muted">
                    <li className="flex items-start gap-2">
                      <Icon name="check" size={14} className="mt-1 shrink-0 text-lime-300" />
                      <span><strong className="text-cream">1 attempt only</strong> on the world map — no hedge bet.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon name="check" size={14} className="mt-1 shrink-0 text-lime-300" />
                      <span><strong className="text-cream">2-minute timer</strong> per round.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon name="check" size={14} className="mt-1 shrink-0 text-lime-300" />
                      <span>Unlocking the Station Dossier costs <strong className="text-cream">20 seconds</strong> instead of points.</span>
                    </li>
                  </ul>
                </div>

                <div className="surface p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-violet-400/15 text-violet-300">
                      <Icon name="users" size={20} />
                    </span>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-violet-300">Multiplayer lobbies</p>
                      <h2 className="font-display text-lg font-semibold text-cream">Same mystery, shared reveal</h2>
                    </div>
                  </div>
                  <ul className="mt-3 flex flex-col gap-1.5 text-sm text-muted">
                    <li className="flex items-start gap-2">
                      <Icon name="check" size={14} className="mt-1 shrink-0 text-lime-300" />
                      <span>Share a lobby code — everyone plays the <strong className="text-cream">exact same location</strong> and difficulty.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon name="check" size={14} className="mt-1 shrink-0 text-lime-300" />
                      <span>Scores stay private during play, then <strong className="text-cream">all guesses reveal together</strong> on one map.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon name="check" size={14} className="mt-1 shrink-0 text-lime-300" />
                      <span>15-second shared review (or advance immediately when all players click Continue).</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
                <Button size="lg" icon="play" fullWidth to="/singleplayer">
                  Play Singleplayer
                </Button>
                <Button size="lg" variant="secondary" icon="users" fullWidth to="/multiplayer">
                  Play Multiplayer
                </Button>
                <Button size="lg" variant="tinted" icon="book" fullWidth to="/how-to-play/guide">
                  Ultimate Guide
                </Button>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
                <Link
                  to="/"
                  className="inline-flex items-center gap-1.5 font-bold text-subtle transition-colors hover:text-cream"
                >
                  <Icon name="globe" size={14} />
                  Back to main menu
                </Link>
                <Link
                  to="/how-to-play"
                  className="font-bold text-subtle transition-colors hover:text-cream"
                >
                  Back to How to play
                </Link>
                <button
                  type="button"
                  onClick={restartTutorial}
                  className="inline-flex items-center gap-1.5 font-bold text-subtle transition-colors hover:text-cream"
                >
                  <Icon name="refresh" size={14} />
                  Restart tutorial
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      )}

      {/* Exit confirmation */}
      <Dialog
        open={exitOpen}
        onClose={() => setExitOpen(false)}
        title="Leave the tutorial?"
        footer={
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <Button variant="secondary" fullWidth onClick={() => setExitOpen(false)}>
              Keep practicing
            </Button>
            <Button variant="danger" fullWidth icon="exit" onClick={() => navigate('/how-to-play')}>
              Exit tutorial
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted">
          You can restart the interactive tutorial anytime from the How to play page.
        </p>
      </Dialog>
    </RoundStage>
  )
}
