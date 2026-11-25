import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../services'
import { clearLobbySession, useLobbySession } from '../../state/lobby'
import type { LobbySession } from '../../state/lobby'

export function useLobbyRoute() {
  const { code: rawCode = '' } = useParams()
  const navigate = useNavigate()
  const storedSession = useLobbySession()
  const code = rawCode.toUpperCase()
  const session = storedSession?.code === code ? storedSession : null
  const [leaving, setLeaving] = useState(false)
  const leavePending = useRef(false)
  const activeRoute = useRef(false)

  useEffect(() => {
    if (!session) navigate('/multiplayer', { replace: true })
    activeRoute.current = Boolean(session)
    return () => { activeRoute.current = false }
  }, [navigate, session])

  const openMatch = useCallback(() => {
    if (activeRoute.current && !leavePending.current) navigate(`/lobby/${code}/play`, { replace: true })
  }, [code, navigate])

  const openWaitingRoom = useCallback(() => {
    if (activeRoute.current && !leavePending.current) navigate(`/lobby/${code}`, { replace: true })
  }, [code, navigate])

  async function leave() {
    if (!session || leavePending.current) return
    leavePending.current = true
    setLeaving(true)
    try {
      await api.lobby.leave(session.code, session.token)
    } catch {
      // Leaving locally also works when the connection is already gone.
    } finally {
      if (clearLobbySession(session)) navigate('/multiplayer')
      leavePending.current = false
      setLeaving(false)
    }
  }

  return { code, session, leaving, leave, openMatch, openWaitingRoom }
}

type LobbySnapshot<T> = { session: LobbySession; data: T | null; error: unknown }

/** Both views share one polling lifecycle. Mutations invalidate earlier reads. */
export function useLobbyPolling<T>(
  session: LobbySession | null,
  read: (code: string, token: string, signal: AbortSignal) => Promise<T>,
  intervalMs: number,
  enabled = true,
) {
  const [snapshot, setSnapshot] = useState<LobbySnapshot<T> | null>(null)
  const inFlight = useRef<AbortController | null>(null)
  const activeSession = useRef<LobbySession | null>(null)

  const refresh = useCallback(async () => {
    if (!session || activeSession.current !== session || inFlight.current) return
    const controller = new AbortController()
    inFlight.current = controller
    try {
      const data = await read(session.code, session.token, controller.signal)
      if (!controller.signal.aborted) setSnapshot({ session, data, error: null })
    } catch (error) {
      if (!controller.signal.aborted) {
        setSnapshot((previous) => ({ session, data: previous?.session === session ? previous.data : null, error }))
      }
    } finally {
      if (inFlight.current === controller) inFlight.current = null
    }
  }, [read, session])

  useEffect(() => {
    if (!session || !enabled) return
    activeSession.current = session
    const firstPoll = window.setTimeout(() => void refresh(), 0)
    const interval = window.setInterval(() => void refresh(), intervalMs)
    return () => {
      window.clearTimeout(firstPoll)
      window.clearInterval(interval)
      activeSession.current = null
      inFlight.current?.abort()
      inFlight.current = null
    }
  }, [enabled, intervalMs, refresh, session])

  function update(change: (previous: T | null) => T | null) {
    if (!session || activeSession.current !== session) return
    inFlight.current?.abort()
    inFlight.current = null
    setSnapshot((previous) => ({
      session,
      data: change(previous?.session === session ? previous.data : null),
      error: null,
    }))
  }

  const current = snapshot?.session === session ? snapshot : null
  return { data: current?.data ?? null, error: current?.error, refresh, update }
}
