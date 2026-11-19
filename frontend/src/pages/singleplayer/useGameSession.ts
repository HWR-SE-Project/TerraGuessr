import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../../api/client'
import { singleplayerApi } from '../../api/singleplayer'
import type {
  StreetCredentials,
  StreetResult,
  StreetSession,
} from '../../api/singleplayer'
import type { LatLon } from '../../api/types'
import { browserMapsKey } from './googleMaps'

const STORAGE = 'terraguessr.streetSession.v1'
const emptySession = (): StreetSession => ({
  id: '',
  roundsTotal: 5,
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
function save(value: StreetCredentials | null) {
  try {
    if (value) sessionStorage.setItem(STORAGE, JSON.stringify(value))
    else sessionStorage.removeItem(STORAGE)
  } catch {
    /* Memory-only play works with blocked storage. */
  }
}
export function useGameSession() {
  const [session, setSession] = useState<StreetSession>(emptySession)
  const [result, setResult] = useState<StreetResult | null>(null)
  const [guess, setGuess] = useState<LatLon | null>(null)
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(true)
  const [available, setAvailable] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [panoramaReady, setPanoramaReady] = useState(false)
  const [showFinal, setShowFinal] = useState(false)
  const credentials = useRef<StreetCredentials | null>(savedCredentials())
  const locked = useRef(false)
  const refreshConfig = useCallback(async () => {
    setChecking(true)
    setError(null)
    try {
      if (!browserMapsKey()) {
        setAvailable(false)
        return
      }
      const config = await singleplayerApi.config()
      setAvailable(config.available)
      if (credentials.current) {
        try {
          const restored = await singleplayerApi.session(credentials.current)
          setSession(restored)
          if (restored.completed) setShowFinal(true)
          else if (!restored.activeRound && restored.results.length)
            setResult(restored.results.at(-1)!)
        } catch (cause) {
          if (cause instanceof ApiError && cause.status === 404) {
            credentials.current = null
            save(null)
          } else throw cause
        }
      }
    } catch {
      setError(
        'Unable to reach the game server. Check your connection and try again.',
      )
      setAvailable(false)
    } finally {
      setChecking(false)
    }
  }, [])
  useEffect(() => {
    void Promise.resolve().then(refreshConfig)
  }, [refreshConfig])

  async function run(action: () => Promise<void>) {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The request failed. Please retry.',
      )
    } finally {
      locked.current = false
      setBusy(false)
    }
  }
  async function next(restart = false) {
    await run(async () => {
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
        credentials.current = await singleplayerApi.create()
        save(credentials.current)
      }
      const round = await singleplayerApi.next(credentials.current)
      const fresh = await singleplayerApi.session(credentials.current)
      setSession({ ...fresh, activeRound: round })
      setResult(null)
      setGuess(null)
      setPanoramaReady(false)
      setShowFinal(false)
    })
  }
  async function submit() {
    if (
      !guess ||
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
    await run(async () => {
      // Identical retries are idempotent on the server if the response was lost.
      let received: StreetResult
      try {
        received = await singleplayerApi.guess(auth, round.id, submitted)
      } catch (cause) {
        // A disconnected response may hide an accepted guess. Reconcile with
        // persisted results before allowing the player to attempt it again.
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
  const inProgress = Boolean(session.id && !showFinal)
  useEffect(() => {
    if (!inProgress) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [inProgress])
  return {
    session,
    result,
    guess,
    setGuess,
    busy,
    checking,
    available,
    error,
    panoramaReady,
    setPanoramaReady,
    showFinal,
    finish: () => {
      setResult(null)
      setShowFinal(true)
    },
    next,
    submit,
    refreshConfig,
    inProgress,
  }
}
