import { useEffect, useState } from 'react'
import { forgetLobby, getCurrentLobbyCode, getLobby, getLobbyToken } from '../api/lobbies'
import type { LobbyDTO } from '../api/types'

/** Home and lobby entry share the same resumable-membership check. */
export function useCurrentLobby(enabled = true) {
  const [lobby, setLobby] = useState<LobbyDTO | null>(null)
  useEffect(() => {
    if (!enabled) return
    const code = getCurrentLobbyCode()
    const token = code ? getLobbyToken(code) : null
    if (!code || !token) return
    let active = true
    getLobby(code, token).then(next => { if (active) setLobby(next) }).catch(() => {
      if (!active) return
      forgetLobby(code)
      setLobby(null)
    })
    return () => { active = false }
  }, [enabled])
  return enabled && lobby && getLobbyToken(lobby.code) ? lobby : null
}
