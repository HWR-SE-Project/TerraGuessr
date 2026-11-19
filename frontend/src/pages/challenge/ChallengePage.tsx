import { useEffect, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import * as challengesApi from '../../api/challenges'
import { mapApiError } from '../../api/errorMessages'
import { setPlayerToken } from '../../api/client'
import { useSession } from '../../state/SessionContext'
import type { GuessResultDTO, LatLon, LeaderboardDTO, RoundDTO } from '../../api/types'
import { WeatherPanel } from '../../components/WeatherPanel'
import { MapPicker } from '../../components/map/MapPicker'
import { CandidateList } from '../../components/CandidateList'
import './ChallengePage.css'

type Phase =
  | { kind: 'idle' }
  | { kind: 'playing'; gameId: string; playerToken: string; round: RoundDTO }
  | { kind: 'done'; guess: LatLon; result: GuessResultDTO; entered: boolean }

function playedKey(challengeId: string) {
  return `terraguessr.challengePlayed.${challengeId}`
}

export function ChallengePage() {
  const { challengeId = '' } = useParams()
  const location = useLocation()
  const { user } = useSession()
  const shareState = location.state as { justCreated?: boolean; shareUrl?: string } | null

  const [leaderboard, setLeaderboard] = useState<LeaderboardDTO | null>(null)
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guess, setGuess] = useState<LatLon | null>(null)
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [copied, setCopied] = useState(false)
  const [alreadyPlayed, setAlreadyPlayed] = useState(false)

  useEffect(() => {
    setAlreadyPlayed(Boolean(localStorage.getItem(playedKey(challengeId))))
  }, [challengeId])

  async function loadLeaderboard() {
    try {
      const board = await challengesApi.getChallengeLeaderboard(challengeId)
      setLeaderboard(board)
    } catch (cause) {
      setLeaderboardError(mapApiError(cause, { NOT_FOUND: 'This challenge link is invalid or has expired.' }))
    }
  }

  useEffect(() => {
    loadLeaderboard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeId])

  async function handleJoin() {
    setJoining(true)
    setError(null)
    try {
      const joined = await challengesApi.joinChallenge(challengeId)
      setPlayerToken(joined.playerToken)
      setPhase({ kind: 'playing', gameId: joined.gameId, playerToken: joined.playerToken, round: joined.round })
    } catch (cause) {
      setError(mapApiError(cause, { NOT_FOUND: 'This challenge link is invalid or has expired.' }))
    } finally {
      setJoining(false)
    }
  }

  function handleCandidateChange(round: RoundDTO, next: LatLon) {
    setGuess(next)
    const match = round.candidates?.find((candidate) => candidate.lat === next.lat && candidate.lon === next.lon)
    setSelectedCandidateId(match?.id ?? null)
  }

  async function handleSubmitGuess() {
    if (phase.kind !== 'playing' || !guess) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await challengesApi.submitChallengeGuess(phase.round.roundId, guess)
      setPhase({ kind: 'done', guess, result, entered: false })
    } catch (cause) {
      setError(mapApiError(cause))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmitEntry() {
    if (phase.kind !== 'done') return
    setSubmitting(true)
    setError(null)
    try {
      await challengesApi.submitChallengeEntry(challengeId, phase.result.resultId, displayName.trim() || undefined)
      localStorage.setItem(playedKey(challengeId), phase.result.resultId)
      setPhase({ ...phase, entered: true })
      await loadLeaderboard()
    } catch (cause) {
      setError(mapApiError(cause))
    } finally {
      setSubmitting(false)
    }
  }

  async function copyLink() {
    const url = shareState?.shareUrl ? new URL(shareState.shareUrl, window.location.origin).toString() : window.location.href
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be denied by the browser; the link is still visible to copy manually.
    }
  }

  return (
    <div className="tg-challenge-page">
      <div className="tg-challenge-shell">
        {shareState?.justCreated && (
          <div className="tg-challenge-share-banner">
            <span>Challenge created — share this link so a friend can play the same spot:</span>
            <button type="button" onClick={copyLink}>
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
        )}

        <div className="tg-challenge-eyebrow">Async challenge</div>
        <h1 className="tg-challenge-title">Beat this location</h1>
        <p className="tg-challenge-subtitle">
          Everyone who opens this link plays the exact same weather clues. Highest score wins — no live matchmaking, just one shared leaderboard.
        </p>

        {phase.kind === 'idle' && (
          <>
            {alreadyPlayed ? (
              <p className="tg-challenge-note">You've already played this challenge — check the leaderboard below.</p>
            ) : (
              <button type="button" className="tg-challenge-cta" disabled={joining} onClick={handleJoin}>
                {joining ? 'Loading…' : 'Play this challenge'}
              </button>
            )}
            {error && <p className="tg-challenge-error" role="alert">{error}</p>}
          </>
        )}

        {phase.kind === 'playing' && (
          <div className="tg-challenge-play">
            <div className="tg-challenge-play-body">
              <WeatherPanel weather={phase.round.weather} access={phase.round.additionalData} />
              <div className="tg-challenge-map">
                {phase.round.selectionMode === 'map' ? (
                  <MapPicker guess={guess} onChange={setGuess} />
                ) : (
                  <CandidateList candidates={phase.round.candidates ?? []} onChange={(next) => handleCandidateChange(phase.round, next)} selectedId={selectedCandidateId} />
                )}
              </div>
            </div>
            {error && <p className="tg-challenge-error" role="alert">{error}</p>}
            <button type="button" className="tg-challenge-cta" disabled={!guess || submitting} onClick={handleSubmitGuess}>
              {submitting ? 'Submitting…' : 'Submit guess'}
            </button>
          </div>
        )}

        {phase.kind === 'done' && (
          <div className="tg-challenge-result">
            <div className="tg-challenge-result-score">
              <span>{phase.result.score.toLocaleString()}</span>
              <small>points · {phase.result.distanceKm.toFixed(1)} km away</small>
            </div>
            {!phase.entered ? (
              <div className="tg-challenge-entry-form">
                <label>
                  <span>Name on the leaderboard (optional)</span>
                  <input value={displayName} maxLength={40} onChange={(event) => setDisplayName(event.target.value)} placeholder="Stay anonymous" />
                </label>
                {error && <p className="tg-challenge-error" role="alert">{error}</p>}
                <button type="button" className="tg-challenge-cta" disabled={submitting} onClick={handleSubmitEntry}>
                  {submitting ? 'Submitting…' : 'Add to leaderboard'}
                </button>
              </div>
            ) : (
              <p className="tg-challenge-note">You're on the leaderboard below.</p>
            )}
          </div>
        )}

        <div className="tg-challenge-leaderboard">
          <h2>Leaderboard</h2>
          {leaderboardError && <p className="tg-challenge-error" role="alert">{leaderboardError}</p>}
          {leaderboard && (
            leaderboard.entries.length === 0 ? (
              <p className="tg-challenge-note">No entries yet — be the first to play.</p>
            ) : (
              <ol className="tg-challenge-leaderboard-list">
                {leaderboard.entries.map((entry) => (
                  <li key={entry.rank}>
                    <span>#{entry.rank}</span>
                    <span>{entry.displayName ?? 'Anonymous'}</span>
                    <span>{entry.distanceKm.toFixed(1)} km</span>
                    <span>{entry.score.toLocaleString()} pts</span>
                  </li>
                ))}
              </ol>
            )
          )}
        </div>
      </div>
    </div>
  )
}
