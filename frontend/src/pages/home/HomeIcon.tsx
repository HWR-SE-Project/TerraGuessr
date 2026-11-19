import type { ReactNode } from 'react'

export type HomeIconName =
  | 'gamepad'
  | 'users'
  | 'bolt'
  | 'community'
  | 'shop'
  | 'search'
  | 'chevron'
  | 'flame'
  | 'calendar'
  | 'trophy'
  | 'globe'
  | 'lock'
  | 'pencil'
  | 'crown'
  | 'check'
  | 'play'
  | 'rank'
  | 'pin'
  | 'menu'
  | 'close'
  | 'coin'

const paths: Record<HomeIconName, ReactNode> = {
  gamepad: (
    <>
      <path
        d="M7 5h10c3 0 5 11 3 13-1 1-3-2-5-3H9c-2 1-4 4-5 3C2 16 4 5 7 5Z"
        fill="currentColor"
        stroke="none"
      />
      <path
        d="M7 8v5M4.5 10.5h5M15.5 9h.01M18 12h.01"
        stroke="var(--icon-cutout, #34401e)"
      />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="7" r="4" fill="currentColor" stroke="none" />
      <path d="M1 21v-3c0-6 16-6 16 0v3Z" fill="currentColor" stroke="none" />
      <circle cx="18" cy="8" r="3" fill="currentColor" stroke="none" />
      <path
        d="M18 14c4 0 5 2 5 5v2h-4v-3c0-2-.5-3-1-4Z"
        fill="currentColor"
        stroke="none"
      />
    </>
  ),
  bolt: (
    <path
      d="m13 1-8 13h6l-1 9 9-14h-7l3-8Z"
      fill="currentColor"
      stroke="none"
    />
  ),
  community: (
    <>
      <circle cx="12" cy="5" r="2.5" />
      <circle cx="4" cy="9" r="2" />
      <circle cx="20" cy="9" r="2" />
      <path d="M7 16v-2c0-5 10-5 10 0v2M1 18v-3c0-2 2-3 4-3M23 18v-3c0-2-2-3-4-3M5 20h14" />
    </>
  ),
  shop: (
    <>
      <rect x="4" y="6" width="16" height="16" rx="2" />
      <path d="M8 9V5a4 4 0 0 1 8 0v4" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="8" />
      <path d="m17 17 5 5" />
    </>
  ),
  chevron: <path d="m9 4 7 8-7 8" />,
  flame: (
    <>
      <path
        d="M12 1c6 5 1 7 5 10 0-3 2-4 2-4 6 10 1 16-7 16S0 17 5 9c1 4 3 3 3 1 0-3 5-4 4-9Z"
        fill="#ffa80b"
        stroke="none"
      />
      <path d="M12 14c4 4 3 8 0 9-4-1-4-5 0-9Z" fill="#ffce3d" stroke="none" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="17" rx="2" />
      <path d="M7 2v6M17 2v6M3 10h18M7 14h.01M12 14h.01M17 14h.01M7 18h.01M12 18h.01" />
    </>
  ),
  trophy: (
    <>
      <path d="M7 3h10v6c0 8-10 8-10 0V3ZM12 15v6M7 22h10M7 5H2v3c0 4 3 5 6 5M17 5h5v3c0 4-3 5-6 5" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="10" />
      <ellipse cx="12" cy="12" rx="4.5" ry="10" />
      <path d="M2 12h20M4 6h16M4 18h16" />
    </>
  ),
  lock: (
    <>
      <rect
        x="5"
        y="10"
        width="14"
        height="12"
        rx="2"
        fill="currentColor"
        stroke="none"
      />
      <path d="M8 10V6a4 4 0 0 1 8 0v4" />
      <path d="M12 14v3" stroke="var(--icon-cutout, #34401e)" />
    </>
  ),
  pencil: (
    <>
      <path d="m15 3 6 6L8 22H2v-6ZM12 6l6 6M2 22l6-2-4-4" />
    </>
  ),
  crown: (
    <>
      <path
        d="m2 6 5 4 5-8 5 8 5-4-3 13H5Z"
        fill="currentColor"
        stroke="none"
      />
      <path d="M6 22h12" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="11" fill="currentColor" stroke="none" />
      <path d="m7 12 3 3 7-7" stroke="#324321" strokeWidth="2.5" />
    </>
  ),
  play: (
    <path
      d="M5 3c0-2 2-3 4-2l14 9c2 1 2 3 0 4L9 23c-2 1-4 0-4-2Z"
      fill="currentColor"
      stroke="none"
    />
  ),
  rank: (
    <>
      <rect
        x="1"
        y="14"
        width="5"
        height="9"
        rx="1.5"
        fill="currentColor"
        stroke="none"
      />
      <rect
        x="9"
        y="7"
        width="5"
        height="16"
        rx="1.5"
        fill="currentColor"
        stroke="none"
      />
      <rect
        x="17"
        y="1"
        width="5"
        height="22"
        rx="1.5"
        fill="currentColor"
        stroke="none"
      />
    </>
  ),
  pin: (
    <path
      d="M12 1a9 9 0 0 0-9 9c0 7 9 14 9 14s9-7 9-14a9 9 0 0 0-9-9Zm0 5a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z"
      fill="currentColor"
      fillRule="evenodd"
      stroke="none"
    />
  ),
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  close: <path d="m5 5 14 14M19 5 5 19" />,
  coin: (
    <>
      <circle cx="12" cy="12" r="10" fill="#9850ee" stroke="#b77aff" />
      <ellipse cx="12" cy="12" rx="4" ry="6" stroke="#dcbaff" />
    </>
  ),
}

export function HomeIcon({
  name,
  className = '',
}: {
  name: HomeIconName
  className?: string
}) {
  return (
    <svg
      className={`th-icon ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}
