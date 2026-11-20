import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../../api/client'
import { singleplayerApi } from '../../api/singleplayer'
import type {
  Difficulty,
  StreetCredentials,
  StreetResult,
  StreetSession,
} from '../../api/singleplayer'
import type { LatLon } from '../../api/types'
import { browserMapsKey } from './googleMaps'
import { DEFAULT_DIFFICULTY } from './difficulty'

export const STREET_SESSION_STORAGE_KEY = 'terraguessr.streetSession.v1'
const STORAGE = STREET_SESSION_STORAGE_KEY
const GUESS_STORAGE = 'terraguessr.streetGuess.v1'
const emptySession = (): StreetSession => ({
  id: '',
  roundsTotal: 5,
  difficulty: DEFAULT_DIFFICULTY,
  totalScore: 0,
  completed: false,
  activeRound: null,
  results: [],
})
function savedCredentials(): StreetCredentials | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE) || 'null')
    return typeof value?.id === 'string' &&
      typeof value?.playerToken === 'string'
      ? value
      : null
  } catch {
    return null
  }
}
function savedGuess(gameId: string, roundId: string): LatLon | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(GUESS_STORAGE) || 'null')
    return value?.gameId === gameId &&
      value?.roundId === roundId &&
      Number.isFinite(value?.guess?.lat) &&
      Math.abs(value.guess.lat) <= 90 &&
      Number.isFinite(value?.guess?.lon) &&
      Math.abs(value.guess.lon) <= 180
      ? value.guess
      : null
  } catch {
    return null
  }
}
function save(value: StreetCredentials | null) {
  try {
    if (value) sessionStorage.setItem(STORAGE, JSON.stringify(value))
    else {
      sessionStorage.removeItem(STORAGE)
      sessionStorage.removeItem(GUESS_STORAGE)
    }
  } catch {
    /* Memory-only play remains possible. */
  }
}
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
  const [showFinal, setShowFinal] = useState(false)
  const credentials = useRef<StreetCredentials | null>(savedCredentials())
  const locked = useRef(false)
  const checked = useRef(0)
  const autoStarted = useRef(false)
  const refreshConfig = useCallback(async () => {
    const generation = ++checked.current
    const restoring = credentials.current
    setChecking(true)
    setError(null)
    const issues = browserMapsKey()
      ? []
      : ['Google Maps browser key is missing (VITE_GOOGLE_MAPS_API_KEY).']
    try {
      // Always inspect the backend, even when the browser key is missing.
      const config = await singleplayerApi.config()
      if (generation !== checked.current) return
      if (!config.available)
        issues.push(
          'Street View server key is missing (GOOGLE_MAPS_SERVER_API_KEY).',
        )
      setSetupIssues(issues)
      setAvailable(config.available && Boolean(browserMapsKey()))
      if (restoring && config.available) {
        try {
          const restored = await singleplayerApi.session(restoring)
          if (generation !== checked.current) return
          setSession(restored)
          setGuess(
            restored.activeRound
              ? savedGuess(restored.id, restored.activeRound.id)
              : null,
          )
          setResult(
            !restored.completed && !restored.activeRound
              ? (restored.results.at(-1) ?? null)
              : null,
          )
          setShowFinal(restored.completed)
        } catch (cause) {
          if (cause instanceof ApiError && cause.status === 404) {
            credentials.current = null
            save(null)
            setSession(emptySession())
            setError('Your previous expedition expired. Start a new game.')
          } else throw cause
        }
      }
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
  useEffect(() => {
    if (!session.activeRound) return
    try {
      if (guess)
        sessionStorage.setItem(
          GUESS_STORAGE,
          JSON.stringify({
            gameId: session.id,
            roundId: session.activeRound.id,
            guess,
          }),
        )
      else sessionStorage.removeItem(GUESS_STORAGE)
    } catch {
      /* Pin selection still works when storage is blocked. */
    }
  }, [session.id, session.activeRound, guess])
  const run = useCallback(
    async (kind: 'location' | 'guess', action: () => Promise<void>) => {
      if (locked.current) return
      locked.current = true
      setOperation(kind)
      setError(null)
      try {
        await action()
      } catch (cause) {
        if (cause instanceof ApiError && cause.status === 404) {
          credentials.current = null
          save(null)
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
          save(null)
          setSession(emptySession())
          setResult(null)
          setShowFinal(false)
          setGuess(null)
          setPanoramaReady(false)
        }
        if (!credentials.current) {
          credentials.current = await singleplayerApi.create(difficulty)
          save(credentials.current)
          setSession({ ...emptySession(), id: credentials.current.id })
        }
        const auth = credentials.current
        const round = await singleplayerApi.next(auth)
        const fresh = await singleplayerApi.session(auth)
        setSession({ ...fresh, activeRound: round })
        setResult(null)
        setGuess(savedGuess(auth.id, round.id))
        setPanoramaReady(false)
        setShowFinal(false)
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
    })
  }
  async function submit() {
    if (
      !guess ||
      !Number.isFinite(guess.lat) ||
      Math.abs(guess.lat) > 90 ||
      !Number.isFinite(guess.lon) ||
      Math.abs(guess.lon) > 180 ||
      !session.activeRound ||
      !credentials.current ||
      !panoramaReady ||
      result ||
      showFinal
    )
      return
    const submitted = guess
    const round = session.activeRound
    const auth = credentials.current
    await run('guess', async () => {
      let received: StreetResult
      try {
        received = await singleplayerApi.guess(auth, round.id, submitted)
      } catch (cause) {
        const restored = await singleplayerApi.session(auth).catch(() => null)
        const accepted = restored?.results.find(
          (entry) => entry.roundId === round.id,
        )
        if (!accepted) throw cause
        received = accepted
        setGuess(accepted.guess)
      }
      setResult(received)
      setSession((current) => {
        const results = [
          ...current.results.filter((r) => r.roundId !== received.roundId),
          received,
        ]
        return {
          ...current,
          activeRound: null,
          results,
          totalScore: results.reduce((sum, r) => sum + r.score, 0),
          completed: results.length === current.roundsTotal,
        }
      })
    })
  }
  const exitLock = useRef(false)
  const [exitPending, setExitPending] = useState<'save' | 'leave' | null>(
    null,
  )
  const [exitError, setExitError] = useState<{
    action: 'save' | 'leave'
    message: string
  } | null>(null)
  const clearExitError = useCallback(() => setExitError(null), [])
  // Every round/guess is already persisted server-side as it happens (see
  // api docs); "saving" here just confirms the session is still reachable
  // and unexpired before the player walks away believing it is safe to.
  const saveAndExit = useCallback(async () => {
    if (exitLock.current) return false
    if (!credentials.current) return true
    exitLock.current = true
    setExitPending('save')
    setExitError(null)
    try {
      await singleplayerApi.session(credentials.current)
      return true
    } catch (cause) {
      setExitError({
        action: 'save',
        message:
          cause instanceof ApiError && cause.status === 404
            ? 'This expedition has expired and can no longer be saved. You can still leave the game.'
            : 'Unable to reach the game server to save your progress. Check your connection and try again.',
      })
      return false
    } finally {
      exitLock.current = false
      setExitPending(null)
    }
  }, [])
  const leaveGame = useCallback(async () => {
    if (exitLock.current) return false
    exitLock.current = true
    setExitPending('leave')
    setExitError(null)
    try {
      if (credentials.current) {
        try {
          await singleplayerApi.abandon(credentials.current)
        } catch (cause) {
          // Already gone is still a successful abandonment.
          if (!(cause instanceof ApiError && cause.status === 404)) throw cause
        }
      }
      credentials.current = null
      save(null)
      setSession(emptySession())
      setResult(null)
      setGuess(null)
      setPanoramaReady(false)
      setShowFinal(false)
      return true
    } catch {
      setExitError({
        action: 'leave',
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
  const inProgress = Boolean((session.id || busy) && !showFinal)
  useEffect(() => {
    if (!inProgress) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [inProgress])
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
    showFinal,
    finish: () => {
      if (session.completed) {
        setResult(null)
        setShowFinal(true)
      }
    },
    next,
    retryLocation,
    submit,
    refreshConfig,
    inProgress,
    saveAndExit,
    leaveGame,
    exitPending,
    exitError,
    clearExitError,
  }
}
