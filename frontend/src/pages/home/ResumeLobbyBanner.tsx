import { Icon } from '../../components/ui/Icon'
import { Link } from 'react-router-dom'
import { useCurrentLobby } from '../../game/useCurrentLobby'

export function ResumeLobbyBanner() {
  const lobby = useCurrentLobby()
  if (!lobby) return null
  const code = lobby.code

  return (
    <aside className="th-resume" aria-label="Return to lobby">
      <span className="th-resume-icon" aria-hidden="true">
        <Icon name="users" />
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
        Return to lobby <Icon name="arrow" />
      </Link>
    </aside>
  )
}
