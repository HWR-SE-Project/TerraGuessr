import {useEffect, useRef, useState} from 'react'
import type {CSSProperties} from 'react'
import {useSession} from '../../state/SessionContext'
import {HomeIcon} from '../home/HomeIcon'
import {HomeNavigation} from '../home/HomeExperience'
import {useDuelFlow} from './useDuelFlow'
import {DuelRoundOverlay} from './DuelRoundOverlay'
import earth from '../../assets/home/official/earth-horizon.webp'
import characters from '../../assets/duels/desktop/hero-bg.png'
import blades from '../../assets/duels/desktop/hero-ghost.png'
import defaultAvatar from '../../assets/duels/desktop/rank-current-bg.png'
import champion from '../../assets/duels/desktop/rank-champion.png'
import master from '../../assets/duels/desktop/rank-master.png'
import gold from '../../assets/duels/desktop/rank-gold.png'
import silver from '../../assets/duels/desktop/rank-silver.png'
import bronze from '../../assets/duels/desktop/rank-bronze.png'
import './DuelsPage.css'

const RANKS = [
    {name: 'Champion', icon: champion, color: '#59cfff', pips: false},
    {name: 'Master', icon: master, color: '#f177b8', pips: false},
    {name: 'Gold', icon: gold, color: '#f3d26d', pips: true},
    {name: 'Silver', icon: silver, color: '#d4dce4', pips: true},
    {name: 'Bronze', icon: bronze, color: '#e7a06b', pips: true},
]

function Laurel({right = false}: { right?: boolean }) {
    return (
        <svg className={`td-laurel${right ? ' td-laurel-right' : ''}`} viewBox="0 0 62 108" fill="currentColor"
             aria-hidden="true">
            <path d="M48 103C10 85 6 40 31 7l2 1C11 43 17 82 49 100Z"/>
            <path
                d="M28 19C15 16 17 5 28 0c5 8 5 14 0 19ZM21 33C6 30 6 17 12 12c10 4 13 12 9 21ZM17 48C2 45 0 34 4 27c11 3 17 11 13 21ZM19 65C4 65-2 54 1 46c12 1 19 9 18 19ZM25 81C10 85 1 74 2 65c13-1 22 5 23 16ZM38 95C24 102 13 95 10 85c12-4 22-1 28 10Z"/>
            <path
                d="M23 34c-5-12 3-20 12-23 1 12-3 19-12 23ZM19 51c-2-14 7-21 16-21-1 11-7 18-16 21ZM22 68c-1-14 9-19 17-17-3 11-9 16-17 17ZM30 83c1-13 11-17 19-13-4 10-11 14-19 13ZM43 96c3-12 14-13 21-8-7 9-13 11-21 8Z"/>
        </svg>
    )
}

function RankPanel({name, loading}: { name: string; loading: boolean }) {
    return (
        <aside className="td-ranks" aria-labelledby="td-ranks-heading">
            <h2 id="td-ranks-heading">Ranks</h2>
            <ol className="td-rank-ladder" aria-label="Ranked ladder design demonstration">
                {RANKS.map((rank) => (
                    <li key={rank.name} style={{'--rank-color': rank.color} as CSSProperties}>
                        <span className="td-rank-marker" aria-hidden="true"/>
                        <img src={rank.icon} alt="" width="64" height="64"/>
                        <div>
                            <span className="td-rank-name">{rank.name}</span>
                            {rank.pips && <span className="td-rank-pips" aria-hidden="true"><i/><i/><i/><i/></span>}
                        </div>
                    </li>
                ))}
            </ol>
            <div className="td-current-player" aria-busy={loading}>
                <span className="td-player-avatar" title="Default explorer avatar"><img src={defaultAvatar}
                                                                                        alt="Default explorer avatar"
                                                                                        width="48" height="48"/></span>
                <div>
                    <span className="td-current-name">{name}</span>
                    <span className="td-current-rank">Unranked</span>
                </div>
            </div>
            <p className="td-ranks-note">Ladder preview · Ranked play coming soon</p>
        </aside>
    )
}

export function DuelsPage() {
    const {user, status} = useSession()
    const {stage, busy, start, submitGuess, reset} = useDuelFlow()
    const [notice, setNotice] = useState<string | null>(null)
    const noticeDialog = useRef<HTMLDialogElement>(null)
    const playButton = useRef<HTMLButtonElement>(null)
    const name = status === 'loading' ? 'Loading…' : user?.displayName ?? 'Guest'

    useEffect(() => {
        if (notice) noticeDialog.current?.showModal()
    }, [notice])

    return (
        <div className="td-page">
            <a href="#td-main" className="td-skip">Skip to duels</a>
            <div className="td-earth" aria-hidden="true"><img src={earth} alt="" fetchPriority="high"/></div>
            <div className="td-atmosphere" aria-hidden="true"/>
            <HomeNavigation active="multiplayer" showNotice={setNotice}/>
            <main className="td-main" id="td-main" tabIndex={-1}>
                <div className="td-title">
                    <div className="td-title-line"><Laurel/><h1>Duels</h1><Laurel right/></div>
                    <p>Play 3 duels to get ranked</p>
                </div>
                <div className="td-arena">
                    <div className="td-player-label td-player-left" aria-busy={status === 'loading'}>{name}</div>
                    <div className="td-player-label td-player-right">Unknown player</div>
                    <div className="td-player-glow td-player-glow-left" aria-hidden="true"/>
                    <div className="td-player-glow td-player-glow-right" aria-hidden="true"/>
                    <img className="td-characters" src={characters}
                         alt="An explorer facing a mysterious purple opponent" width="672" height="480"
                         fetchPriority="high"/>
                    <img className="td-blades" src={blades} alt="" width="700" height="700"/>
                </div>
                <div className="td-controls">
                    <div className="td-duel-steps" role="group" aria-label="Ranked placement duels (coming soon)">
                        {[1, 2, 3].map((duel) => (
                            <button key={duel} type="button"
                                    className={`td-duel-step${duel === 1 ? ' td-duel-step-active' : ''}`}
                                    aria-haspopup="dialog" aria-describedby="td-availability"
                                    title="Ranked placement duels are not available yet"
                                    onClick={() => setNotice('Ranked placement duels are not available yet. You can play an async duel and share the location with a friend using PLAY.')}>
                                Duel {duel}
                            </button>
                        ))}
                    </div>
                    <button ref={playButton} type="button" className="td-play" onClick={start}
                            disabled={busy || status === 'loading'} aria-describedby="td-availability">
                        <HomeIcon name="play"/><span>{busy ? 'Starting…' : 'Play'}</span>
                    </button>
                    <p className="td-availability" id="td-availability">Async challenges available · Live ranked duels
                        coming soon</p>
                </div>
            </main>
            <RankPanel name={name} loading={status === 'loading'}/>
            {notice && (
                <dialog ref={noticeDialog} className="td-notice" aria-labelledby="td-notice-title"
                        onClose={() => setNotice(null)} onClick={(event) => {
                    if (event.target === event.currentTarget) noticeDialog.current?.close()
                }}>
                    <h2 id="td-notice-title">Not available yet</h2><p>{notice}</p>
                    <button type="button" autoFocus onClick={() => noticeDialog.current?.close()}>Got it</button>
                </dialog>
            )}
            {stage.kind !== 'idle' && (
                <DuelRoundOverlay round={stage.kind === 'round' ? stage.round : null}
                                  creating={stage.kind === 'creating'} busy={busy}
                                  error={stage.kind === 'error' ? stage.message : null} onSubmit={submitGuess}
                                  onClose={() => {
                                      reset();
                                      requestAnimationFrame(() => playButton.current?.focus())
                                  }}/>
            )}
        </div>
    )
}
