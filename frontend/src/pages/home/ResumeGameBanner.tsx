import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { singleplayerApi } from '../../api/singleplayer'
import type { StreetCredentials, StreetSession } from '../../api/singleplayer'
import { STREET_SESSION_STORAGE_KEY } from '../singleplayer/useGameSession'
import { DIFFICULTY_LEVELS } from '../singleplayer/difficulty'
import { HomeIcon } from './HomeIcon'

function readCredentials(): StreetCredentials | null {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(STREET_SESSION_STORAGE_KEY) || 'null',
    )
    return typeof value?.id === 'string' && typeof value?.playerToken === 'string'
      ? value
      : null
  } catch {
    return null
  }
}

/**
 * Only ever reads sessionStorage (tab-scoped) — this mode has no
 * account-bound persistence, so there is nothing to resume once the tab
 * that started the expedition is closed. Silently shows nothing rather than
 * a broken/expired resume prompt (R18: sessions quietly age out after 24h).
 */
export function ResumeGameBanner() {
  const [session, setSession] = useState<StreetSession | null>(null)
  useEffect(() => {
    const credentials = readCredentials()
    if (!credentials) return
    let cancelled = false
    singleplayerApi
      .session(credentials)
      .then((result) => {
        if (!cancelled && !result.completed) setSession(result)
      })
      .catch(() => {
        /* Expired or unreachable: no resumable session to offer. */
      })
    return () => {
      cancelled = true
    }
  }, [])
  if (!session) return null
  const difficultyLabel =
    DIFFICULTY_LEVELS.find((level) => level.id === session.difficulty)
      ?.label ?? session.difficulty
  const currentRound = session.activeRound?.number ?? session.results.length + 1
  return (
    <aside className="th-resume" aria-label="Resume expedition">
      <span className="th-resume-icon" aria-hidden="true">
        <HomeIcon name="pin" />
      </span>
      <span className="th-resume-copy">
        <strong>Continue your expedition</strong>
        <small>
          Round {currentRound} of {session.roundsTotal} ·{' '}
          {session.totalScore.toLocaleString('en-US')} pts · {difficultyLabel}
        </small>
      </span>
      <Link
        to="/game/singleplayer"
        className="th-resume-action tg-control tg-control--primary"
      >
        Resume Game <HomeIcon name="arrow" />
      </Link>
    </aside>
  )
}
