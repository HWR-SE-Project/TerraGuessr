import type { ReactNode } from 'react'
export function GameIcon({
  name,
}: {
  name: 'settings' | 'menu' | 'return' | 'expand' | 'collapse' | 'pin' | 'info'
}) {
  const paths: Record<typeof name, ReactNode> = {
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
  score,
  status,
}: {
  round: number
  score: number
  status: string
}) {
  return (
    <div className="sp-hud sp-glass" aria-label="Game progress">
      <div>
        <span>ROUND</span>
        <strong>{round}</strong>
      </div>
      <i />
      <div>
        <span>TOTAL SCORE</span>
        <strong>
          {score.toLocaleString()}
          <small> pts</small>
        </strong>
      </div>
      <p role="status">{status}</p>
    </div>
  )
}
