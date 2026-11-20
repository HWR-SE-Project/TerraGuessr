import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as lobbiesApi from '../../api/lobbies'
import type { LobbyDTO } from '../../api/types'
import { HomeIcon } from './HomeIcon'

export function ResumeLobbyBanner() {
  const [lobby, setLobby] = useState<LobbyDTO | null>(null)
  const [code, setCode] = useState<string | null>(null)

  useEffect(() => {
    const current = lobbiesApi.getCurrentLobbyCode()
    const token = current ? lobbiesApi.getLobbyToken(current) : null
    if (!current || !token) return
    let cancelled = false
    lobbiesApi
      .getLobby(current, token)
      .then((value) => {
        if (cancelled) return
        setCode(current)
        setLobby(value)
      })
      .catch(() => {
        if (cancelled) return
        lobbiesApi.clearLobbyToken(current)
        lobbiesApi.clearCurrentLobbyCode()
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!lobby || !code) return null

  return (
    <aside className="th-resume" aria-label="Return to lobby">
      <span className="th-resume-icon" aria-hidden="true">
        <HomeIcon name="users" />
      </span>
      <span className="th-resume-copy">
        <strong>Your multiplayer lobby is still open</strong>
        <small>
          Lobby {code} · {lobby.members.length} players ·{' '}
          {lobby.status === 'playing'
            ? 'match in progress'
            : lobby.status === 'finished'
              ? 'final results ready'
              : 'waiting room'}
        </small>
      </span>
      <Link
        to={`/lobby/${code}`}
        className="th-resume-action tg-control tg-control--primary"
      >
        Return to lobby <HomeIcon name="arrow" />
      </Link>
    </aside>
  )
}
