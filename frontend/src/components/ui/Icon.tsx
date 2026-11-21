import type { SVGProps, ReactNode } from 'react'

// A single lightweight inline icon set — no icon library dependency. Icons are
// drawn on a 24×24 grid and inherit currentColor.

const PATHS: Record<string, ReactNode> = {
  play: <path d="M8 5.5v13a1 1 0 0 0 1.53.85l10.2-6.5a1 1 0 0 0 0-1.7L9.53 4.65A1 1 0 0 0 8 5.5Z" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 12h18M12 3c2.5 2.4 3.8 5.5 3.8 9S14.5 18.6 12 21c-2.5-2.4-3.8-5.5-3.8-9S9.5 5.4 12 3Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 20c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 5.4a3.4 3.4 0 0 1 0 5.9M17.8 15.6c1.5.7 2.5 2.2 2.9 4.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4.5 20c.8-3.6 3.6-5.6 7.5-5.6s6.7 2 7.5 5.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.5-2-3.4-2.4 1a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.6A7.6 7.6 0 0 0 7 6.6l-2.4-1-2 3.4 2 1.5a7.6 7.6 0 0 0 0 3l-2 1.5 2 3.4 2.4-1a7.6 7.6 0 0 0 2.6 1.5l.4 2.6h4l.4-2.6a7.6 7.6 0 0 0 2.6-1.5l2.4 1 2-3.4Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />,
  chevronDown: <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />,
  chevronLeft: <path d="m15 5-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />,
  chevronRight: <path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />,
  check: <path d="m5 12 5 5 9-10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  volume: (
    <>
      <path d="M4 10v4h3l4 3V7l-4 3H4Z" fill="currentColor" />
      <path d="M15 9.5a4 4 0 0 1 0 5M17.5 7a7.5 7.5 0 0 1 0 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  fullscreen: <path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  language: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3.5 9h17M3.5 15h17M12 3c1.6 1.7 2.4 3.7 2.4 6S13.6 13.3 12 15c-1.6-1.7-2.4-3.7-2.4-6S10.4 4.7 12 3Z" fill="none" stroke="currentColor" strokeWidth="1.6" />,
  timer: (
    <>
      <circle cx="12" cy="13" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 9.5V13l2.5 2M9 2.5h6M12 2.5V6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-6.5-5.3-6.5-10A6.5 6.5 0 0 1 12 4a6.5 6.5 0 0 1 6.5 7c0 4.7-6.5 10-6.5 10Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="10.7" r="2.4" fill="currentColor" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="m15.5 8.5-2 5-5 2 2-5Z" fill="currentColor" />
    </>
  ),
  star: <path d="M12 3.5 14.7 9l6 .9-4.4 4.2 1 6L12 17.3 6.7 20l1-6-4.4-4.2 6-.9Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />,
  plus: <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />,
  minus: <path d="M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />,
  refresh: <path d="M20 11a8 8 0 1 0-2.3 6.3M20 5v6h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  search: <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </>
  ),
  crown: <path d="M4 8l4.5 3.5L12 5l3.5 6.5L20 8l-1.8 8.5a1 1 0 0 1-1 .8H6.8a1 1 0 0 1-1-.8Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />,
  exit: <path d="M9 5H5.5A1.5 1.5 0 0 0 4 6.5v11A1.5 1.5 0 0 0 5.5 19H9M14 8l4 4-4 4M18 12H9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  trophy: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 5H5a3 3 0 0 0 3 4M16 5h3a3 3 0 0 1-3 4M12 13v3.5M8.5 20h7M10 16.5h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  sparkle: <path d="M12 3l1.7 4.8L18.5 9.5l-4.8 1.7L12 16l-1.7-4.8L5.5 9.5l4.8-1.7ZM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8ZM5 16l.6 1.6L7.2 18.2l-1.6.6L5 20.5l-.6-1.7-1.6-.6 1.6-.6Z" fill="currentColor" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 11v5M12 8h.01" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  cloud: <path d="M7 18h10a4 4 0 0 0 .7-7.9A6 6 0 0 0 6.2 8.6 4.5 4.5 0 0 0 7 18Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />,
  rain: (
    <>
      <path d="M7 15h10a3.5 3.5 0 0 0 .6-6.9A5 5 0 0 0 7.2 7 3.8 3.8 0 0 0 7 15Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8 18.5 7 21M12 18.5l-1 2.5M16 18.5l-1 2.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </>
  ),
  snow: <path d="M12 3v18M4 8l16 8M20 8 4 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />,
  wind: <path d="M3 8h11a2.5 2.5 0 1 0-2.5-2.5M3 12h15a2.5 2.5 0 1 1-2.5 2.5M3 16h7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />,
  drop: <path d="M12 3.5S6.5 9 6.5 13a5.5 5.5 0 0 0 11 0C17.5 9 12 3.5 12 3.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" />,
  pressure: <path d="M12 7a5 5 0 0 1 5 5M5 12a7 7 0 0 1 10-6.4M7.5 15.5A9 9 0 0 1 5 12m14 0a9 9 0 0 1-.5 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />,
  mountain: <path d="m3 19 6-11 4 7 2-3 6 7Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />,
  scan: <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M4 12h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />,
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </>
  ),
  mail: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="m4 7 8 6 8-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </>
  ),
  heart: <path d="M12 20s-7.5-4.4-7.5-10A4.2 4.2 0 0 1 12 6.4 4.2 4.2 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />,
  book: <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5ZM4 5.5v16M11 3h6.5A2.5 2.5 0 0 1 20 5.5v16a2.5 2.5 0 0 0-2.5-2.5H11Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />,
  flag: <path d="M5 21V4a1 1 0 0 1 1-1h6l.7 3H19a1 1 0 0 1 .8 1.5L17.6 12l2.2 4.5A1 1 0 0 1 19 18h-7.3L11 15H7v6Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />,
}

export type IconName = keyof typeof PATHS

export function Icon({
  name,
  size = 20,
  ...props
}: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {PATHS[name]}
    </svg>
  )
}
