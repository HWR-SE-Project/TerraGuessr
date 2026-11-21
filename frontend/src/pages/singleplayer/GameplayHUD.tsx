import type { ReactNode } from 'react'
export function GameIcon({
  name,
}: {
  name:
    | 'settings'
    | 'menu'
    | 'return'
    | 'expand'
    | 'collapse'
    | 'pin'
    | 'info'
    | 'flag'
    | 'star'
    | 'restart'
    | 'exit'
}) {
  const paths: Record<typeof name, ReactNode> = {
    restart: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v5h5" />
      </>
    ),
    exit: (
      <>
        <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
        <path d="M16 17l5-5-5-5M21 12H9" />
      </>
    ),
    flag: (
      <>
        <path d="M5 21V4" />
        <path d="M5 4h13l-3 4.5L18 13H5Z" />
      </>
    ),
    star: (
      <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" />
    ),
    settings: (
      <>
        <path d="m9 3-1 3-3 1-2 3 2 2v3l3 1 1 3h4l1-3 3-1v-3l2-2-2-3-3-1-1-3Z" />
        <circle cx="11" cy="11" r="3" />
      </>
    ),
    menu: (
      <>
        <path d="M4 6h16M4 12h16M4 18h16" />
      </>
    ),
    return: (
      <>
        <path d="m10 5-7 7 7 7M3 12h14a4 4 0 0 1 4 4v3" />
      </>
    ),
    expand: <path d="M14 3h7v7M21 3l-7 7M10 21H3v-7M3 21l7-7" />,
    collapse: <path d="M21 3l-7 7m0-7v7h7M3 21l7-7m-7 0h7v7" />,
    pin: (
      <>
        <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6m0-10v.2" />
      </>
    ),
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}
export function GameplayHUD({
  round,
  roundsTotal,
  score,
  status,
}: {
  round: number
  roundsTotal?: number
  score: number
  status: string
}) {
  return (
    <div className="sp-hud" role="status" aria-label="Game progress" aria-atomic="true">
      <span className="sp-hud-round">
        Round {round}
        {roundsTotal !== undefined && <span className="sp-hud-sr-only"> of {roundsTotal}</span>}
      </span>
      <strong className="sp-hud-score">
        <span className="sp-hud-sr-only">Total score: </span>
        {score.toLocaleString()} <span className="sp-hud-unit">pts</span>
      </strong>
      <span className="sp-hud-sr-only">{status}</span>
    </div>
  )
}
