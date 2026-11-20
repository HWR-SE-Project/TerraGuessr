import { useRef } from 'react'
import { useSession } from '../../state/SessionContext'
import { HomeIcon } from '../home/HomeIcon'
import { PageNavigation } from '../../components/ui/PageNavigation'
import { useDuelFlow } from './useDuelFlow'
import { DuelRoundOverlay } from './DuelRoundOverlay'
import characters from '../../assets/duels/desktop/hero-bg.png'
import blades from '../../assets/duels/desktop/hero-emblem.webp'
import './DuelsPage.css'

function Laurel({ right = false }: { right?: boolean }) {
  return (
    <svg
      className={`td-laurel${right ? ' td-laurel-right' : ''}`}
      viewBox="0 0 62 108"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M48 103C10 85 6 40 31 7l2 1C11 43 17 82 49 100Z" />
      <path d="M28 19C15 16 17 5 28 0c5 8 5 14 0 19ZM21 33C6 30 6 17 12 12c10 4 13 12 9 21ZM17 48C2 45 0 34 4 27c11 3 17 11 13 21ZM19 65C4 65-2 54 1 46c12 1 19 9 18 19ZM25 81C10 85 1 74 2 65c13-1 22 5 23 16ZM38 95C24 102 13 95 10 85c12-4 22-1 28 10Z" />
      <path d="M23 34c-5-12 3-20 12-23 1 12-3 19-12 23ZM19 51c-2-14 7-21 16-21-1 11-7 18-16 21ZM22 68c-1-14 9-19 17-17-3 11-9 16-17 17ZM30 83c1-13 11-17 19-13-4 10-11 14-19 13ZM43 96c3-12 14-13 21-8-7 9-13 11-21 8Z" />
    </svg>
  )
}

export function DuelsPage() {
  const { user, status } = useSession()
  const { stage, busy, start, submitGuess, reset } = useDuelFlow()
  const playButton = useRef<HTMLButtonElement>(null)
  const name =
    status === 'loading' ? 'Loading…' : (user?.displayName ?? 'Guest')

  return (
    <div className="td-page">
      <a href="#td-main" className="td-skip">
        Skip to duels
      </a>
      <PageNavigation active="multiplayer" />
      <main className="td-main" id="td-main" tabIndex={-1}>
        <div className="td-title">
          <div className="td-title-line">
            <Laurel />
            <h1>Duels</h1>
            <Laurel right />
          </div>
          <p>One location. Two perspectives. Who gets closer?</p>
        </div>
        <div className="td-arena">
          <div
            className="td-player-label td-player-left"
            aria-busy={status === 'loading'}
          >
            {name}
          </div>
          <div className="td-player-label td-player-right">Unknown player</div>
          <div
            className="td-player-glow td-player-glow-left"
            aria-hidden="true"
          />
          <div
            className="td-player-glow td-player-glow-right"
            aria-hidden="true"
          />
          <img
            className="td-characters"
            src={characters}
            alt="An explorer facing a mysterious purple opponent"
            width="672"
            height="480"
            fetchPriority="high"
          />
          <img
            className="td-blades"
            src={blades}
            alt=""
            width="700"
            height="700"
          />
        </div>
        <div className="td-controls">
          <button
            ref={playButton}
            type="button"
            className="td-play"
            onClick={start}
            disabled={busy || status === 'loading'}
          >
            <HomeIcon name="play" />
            <span>{busy ? 'Starting…' : 'Play'}</span>
          </button>
        </div>
      </main>
      {stage.kind !== 'idle' && (
        <DuelRoundOverlay
          round={stage.kind === 'round' ? stage.round : null}
          creating={stage.kind === 'creating'}
          busy={busy}
          error={stage.kind === 'error' ? stage.message : null}
          onSubmit={submitGuess}
          onClose={() => {
            reset()
            requestAnimationFrame(() => playButton.current?.focus())
          }}
        />
      )}
    </div>
  )
}
