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
  | 'arrow'

const paths: Record<HomeIconName, ReactNode> = {
  gamepad: (
    <>
      <path d="M8 6h8c3 0 4 4 5 9 .8 4-1 5-3 3l-3-3H9l-3 3c-2 2-3.8 1-3-3 1-5 2-9 5-9Z" />
      <path d="M8 9v4M6 11h4M15 10h.01M18 12h.01" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20v-2a6.5 6.5 0 0 1 13 0v2M16 4.7a3.5 3.5 0 0 1 0 6.6M18 14a5 5 0 0 1 3.5 4.8V20" />
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
    <path d="m14.5 5.5 4 4M4 20l4.5-1 12-12a2.8 2.8 0 0 0-4-4l-12 12L4 20Z" />
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
    <path d="M7 5.5c0-1.2 1-1.8 2-1.2l10 6.5a1.4 1.4 0 0 1 0 2.4L9 19.7c-1 .6-2 0-2-1.2Z" fill="currentColor" stroke="none" />
  ),
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
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
