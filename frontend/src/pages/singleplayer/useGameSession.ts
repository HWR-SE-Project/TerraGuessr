import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../../api/client'
import { singleplayerApi } from '../../api/singleplayer'
import type {
  StreetCredentials,
  StreetResult,
  StreetSession,
} from '../../api/singleplayer'
import type { Difficulty, LatLon } from '../../api/types'
import { browserMapsKey } from '../../game/googleMaps'
import { DEFAULT_DIFFICULTY } from '../../game/difficulty'

const emptySession = (): StreetSession => ({
  id: '',
  difficulty: DEFAULT_DIFFICULTY,
  totalScore: 0,
  activeRound: null,
  results: [],
})
export function useGameSession(autoStart = false) {
  const [session, setSession] = useState<StreetSession>(emptySession)
  const [result, setResult] = useState<StreetResult | null>(null)
  const [guess, setGuess] = useState<LatLon | null>(null)
  const [operation, setOperation] = useState<'location' | 'guess' | null>(null)
  const busy = operation !== null
  const [checking, setChecking] = useState(true)
  const [available, setAvailable] = useState(false)
  const [setupIssues, setSetupIssues] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [panoramaReady, setPanoramaReady] = useState(false)
  const [panoramaUnavailable, setPanoramaUnavailable] = useState(false)
  const [showFinal, setShowFinal] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  // Credentials live only in memory for this tab's current session — never
  // written to storage — so a refresh or tab close can never resume a prior
  // game. An interrupted session simply ages out server-side via the 24h
  // expiry sweep instead (see StreetGame lifecycle doc in schema.prisma).
  const credentials = useRef<StreetCredentials | null>(null)
  const locked = useRef(false)
  const exitLock = useRef(false)
  const checked = useRef(0)
  const autoStarted = useRef(false)
  const timeoutSettled = useRef<string | null>(null)
  const refreshConfig = useCallback(async () => {
    const generation = ++checked.current
    setChecking(true)
    setError(null)
    const issues = browserMapsKey()
      ? []
      : ['Google Maps browser key is missing (VITE_GOOGLE_MAPS_API_KEY).']
    try {
      const config = await singleplayerApi.config()
      if (generation !== checked.current) return
      if (!config.available)
        issues.push(
          'Street View server key is missing (GOOGLE_MAPS_SERVER_API_KEY).',
        )
      setSetupIssues(issues)
      setAvailable(config.available && Boolean(browserMapsKey()))
    } catch (cause) {
      if (generation !== checked.current) return
      const message =
        cause instanceof ApiError && cause.status === 404
          ? 'The running backend does not support Street View. Start the updated TerraGuessr backend.'
          : 'Unable to reach the game server. Check the backend connection and try again.'
      setError(message)
      setSetupIssues([...issues, message])
      setAvailable(false)
    } finally {
      if (generation === checked.current) setChecking(false)
    }
  }, [])
  useEffect(() => {
    void Promise.resolve().then(refreshConfig)
  }, [refreshConfig])
  const run = useCallback(
    async (kind: 'location' | 'guess', action: () => Promise<void>) => {
      if (locked.current || exitLock.current) return
      locked.current = true
      setOperation(kind)
      setError(null)
      try {
        await action()
      } catch (cause) {
        if (cause instanceof ApiError && cause.status === 404) {
          credentials.current = null
          setSession(emptySession())
          setResult(null)
          setGuess(null)
          setPanoramaReady(false)
          setShowFinal(false)
          setError(
            'Your expedition has expired or is no longer available. Start a new game.',
          )
        } else
          setError(
            cause instanceof Error
              ? cause.message
              : 'The request failed. Please retry.',
          )
      } finally {
        locked.current = false
        setOperation(null)
      }
    },
    [],
  )
  const next = useCallback(
    async (options: { restart?: boolean; difficulty?: Difficulty } = {}) => {
      const { restart = false, difficulty } = options
      await run('location', async () => {
        if (restart) {
          credentials.current = null
          setSession(emptySession())
          setResult(null)
          setShowFinal(false)
          setGuess(null)
          setPanoramaReady(false)
          setUnlockError(null)
        }
        if (!credentials.current) {
          credentials.current = await singleplayerApi.create(difficulty)
          setSession({ ...emptySession(), id: credentials.current.id })
        }
        const auth = credentials.current
        const round = await singleplayerApi.next(auth)
        const fresh = await singleplayerApi.session(auth)
        setSession({ ...fresh, activeRound: round })
        setResult(null)
        setGuess(null)
        setPanoramaReady(false)
        setShowFinal(false)
        setUnlockError(null)
        timeoutSettled.current = null
      })
    },
    [run],
  )
  useEffect(() => {
    if (
      autoStart &&
      available &&
      !checking &&
      !session.id &&
      !error &&
      !autoStarted.current
    ) {
      autoStarted.current = true
      void Promise.resolve().then(() => next())
    }
  }, [autoStart, available, checking, session.id, error, next])
  // Keep the local clock aligned with the server-declared round deadline.
  useEffect(() => {
    if (!session.activeRound || result || showFinal) return
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [session.activeRound, result, showFinal])
  const remainingSeconds = session.activeRound?.endsAt
    ? Math.max(
        0,
        Math.ceil((Date.parse(session.activeRound.endsAt) - now) / 1000),
      )
    : null
  // The server settles expired rounds when the session is read. Ask once the
  // visible timer reaches zero so the timeout result replaces the round.
  useEffect(() => {
    const active = session.activeRound
    const auth = credentials.current
    if (!active || !auth || result || showFinal) return
    if (remainingSeconds === null || remainingSeconds > 0) return
    if (timeoutSettled.current === active.id) return
    timeoutSettled.current = active.id
    void singleplayerApi
      .session(auth)
      .then((fresh) => {
        setSession(fresh)
        const scored = fresh.results.find(
          (entry) => entry.roundId === active.id,
        )
        if (scored) {
          setResult(scored)
          setGuess(scored.guess)
        }
      })
      .catch(() => {})
  }, [remainingSeconds, session.activeRound, result, showFinal])
  // Persist the latest pin so a timeout can evaluate it even if the player
  // never pressed Submit (R08). Debounced so ordinary map clicks stay cheap.
  useEffect(() => {
    const round = session.activeRound
    const auth = credentials.current
    if (!round || !guess || !auth || result || showFinal) return
    const timer = window.setTimeout(() => {
      void Promise.resolve(
        singleplayerApi.selection(auth, round.id, guess),
      ).catch(() => {})
    }, 400)
    return () => window.clearTimeout(timer)
  }, [guess, session.activeRound, result, showFinal])
  async function retryLocation() {
    if (!session.activeRound || !credentials.current || result || showFinal)
      return
    const auth = credentials.current
    const round = session.activeRound
    await run('location', async () => {
      const replacement = await singleplayerApi.retry(auth, round.id)
      setSession((current) => ({ ...current, activeRound: replacement }))
      setGuess(null)
      setPanoramaReady(false)
      setUnlockError(null)
      timeoutSettled.current = null
    })
  }
  async function submit(final = false) {
    if (
      !guess ||
      !Number.isFinite(guess.lat) ||
      Math.abs(guess.lat) > 90 ||
      !Number.isFinite(guess.lon) ||
      Math.abs(guess.lon) > 180 ||
      !session.activeRound ||
      !credentials.current ||
      (!panoramaReady && !panoramaUnavailable) ||
      result ||
      showFinal
    )
      return
    const submitted = guess
    const round = session.activeRound
    const auth = credentials.current
    await run('guess', async () => {
      let received
      try {
        received = await singleplayerApi.guess(auth, round.id, submitted, final)
      } catch (cause) {
        const restored = await singleplayerApi.session(auth).catch(() => null)
        const accepted = restored?.results.find(
          (entry) => entry.roundId === round.id,
        )
        if (!accepted) throw cause
        setResult(accepted)
        setGuess(accepted.guess)
        setSession((current) => ({
          ...current,
          activeRound: null,
          results: [
            ...current.results.filter((r) => r.roundId !== accepted.roundId),
            accepted,
          ],
          totalScore: current.totalScore + accepted.score,
        }))
        return
      }
      if (!received.finalized) {
        setSession((current) =>
          current.activeRound
            ? {
                ...current,
                activeRound: {
                  ...current.activeRound,
                  attemptsUsed:
                    current.activeRound.attemptsTotal -
                    received.attemptsRemaining,
                },
              }
            : current,
        )
        return
      }
      const scored = received.result
      if (!scored) throw new Error('The round result was missing. Please retry.')
      setResult(scored)
      setGuess(scored.guess)
      setSession((current) => {
        const results = [
          ...current.results.filter((r) => r.roundId !== scored.roundId),
          scored,
        ]
        return {
          ...current,
          activeRound: null,
          results,
          totalScore: results.reduce((sum, r) => sum + r.score, 0),
        }
      })
    })
  }
  async function unlockExtraData() {
    if (
      !session.activeRound ||
      !credentials.current ||
      result ||
      showFinal ||
      unlocking
    )
      return
    const auth = credentials.current
    const round = session.activeRound
    setUnlocking(true)
    setUnlockError(null)
    try {
      const updated = await singleplayerApi.unlock(auth, round.id)
      setSession((current) => ({ ...current, activeRound: updated }))
    } catch (cause) {
      setUnlockError(
        cause instanceof Error
          ? cause.message
          : 'Additional data could not be unlocked.',
      )
    } finally {
      setUnlocking(false)
    }
  }
  const [exitPending, setExitPending] = useState<'end' | null>(null)
  const [exitError, setExitError] = useState<{
    action: 'end'
    message: string
  } | null>(null)
  const clearExitError = useCallback(() => setExitError(null), [])
  // Explicit End Game: finalizes the session server-side (a hard delete, so
  // it can never be resumed or continued through the API) while keeping the
  // in-memory results so the session summary can display them.
  const endGame = useCallback(async () => {
    if (exitLock.current || locked.current) return false
    exitLock.current = true
    setExitPending('end')
    setExitError(null)
    try {
      if (credentials.current) {
        try {
          await singleplayerApi.end(credentials.current)
        } catch (cause) {
          // Already gone is still a successful end.
          if (!(cause instanceof ApiError && cause.status === 404)) throw cause
        }
      }
      credentials.current = null
      setResult(null)
      setGuess(null)
      setPanoramaReady(false)
      setError(null)
      setSession(current => ({ ...current, activeRound: null }))
      setShowFinal(true)
      return true
    } catch {
      setExitError({
        action: 'end',
        message:
          'Unable to reach the game server. Check your connection and try again.',
      })
      return false
    } finally {
      exitLock.current = false
      setExitPending(null)
    }
  }, [])
  const loadIntelligence = useCallback(
    (roundId: string, signal?: AbortSignal) => {
      const auth = credentials.current
      if (!auth) return Promise.reject(new Error('No active expedition.'))
      return singleplayerApi.intelligence(auth, roundId, signal)
    },
    [],
  )
  const view = showFinal ? 'session-summary'
    : result ? 'round-results'
      : session.activeRound ? 'playing'
        : busy ? 'loading' : 'setup'
  const inProgress = Boolean((session.id || busy) && !showFinal)
  const phase = error
    ? 'error'
    : operation === 'guess'
      ? 'guess-submitted'
      : busy
        ? session.results.length
          ? 'transitioning-to-next-round'
          : 'loading-location'
        : showFinal
          ? 'game-completed'
          : result
            ? 'round-results'
            : session.activeRound
              ? !panoramaReady
                ? 'loading-location'
                : guess
                  ? 'selecting-location'
                  : 'exploring'
              : 'not-started'
  return {
    session,
    view,
    loadIntelligence,
    result,
    guess,
    setGuess,
    busy,
    checking,
    available,
    setupIssues,
    error,
    phase,
    panoramaReady,
    setPanoramaReady,
    panoramaUnavailable,
    setPanoramaUnavailable,
    showFinal,
    remainingSeconds,
    unlocking,
    unlockError,
    next,
    retryLocation,
    submit,
    unlockExtraData,
    refreshConfig,
    inProgress,
    endGame,
    exitPending,
    exitError,
    clearExitError,
  }
}
