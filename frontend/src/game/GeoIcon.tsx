import type { CSSProperties, ReactNode } from 'react'

/** Weather/environment glyphs specific to the geographic-intelligence panel.
 * These are deliberately distinct from the shared UI icon set (thinner
 * strokes, weather-specific pictographs) and only used here. */
export type GeoIconName =
  | 'scan'
  | 'sun'
  | 'cloud'
  | 'rain'
  | 'snow'
  | 'wind'
  | 'drop'
  | 'pressure'
  | 'mountain'
  | 'chevron'

const paths: Record<GeoIconName, ReactNode> = {
  scan: (
    <>
      <circle cx="12" cy="12" r="7" />
      <ellipse cx="12" cy="12" rx="3" ry="7" />
      <path d="M5 12h14M12 2v2m0 16v2M2 12h2m16 0h2" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5" />
    </>
  ),
  cloud: (
    <>
      <path d="M6 18a4 4 0 0 1-1-7.9A6 6 0 0 1 16.7 9 4.5 4.5 0 1 1 18 18Z" />
      <path d="M5 5 4 4m6-1V2M2 9H1" />
    </>
  ),
  rain: (
    <>
      <path d="M5 15a4 4 0 0 1 0-8 6 6 0 0 1 11-1 4.5 4.5 0 0 1 2 9M8 17l-1 3m6-3-1 3m6-3-1 3" />
    </>
  ),
  snow: (
    <>
      <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9 5l3 3 3-3M9 19l3-3 3 3" />
    </>
  ),
  wind: (
    <>
      <path d="M3 8h12a3 3 0 1 0-3-3M2 12h17a3 3 0 1 1-3 3M4 16h5a3 3 0 1 1-3 3" />
    </>
  ),
  drop: (
    <path d="M12 3S5 10 5 15a7 7 0 0 0 14 0c0-5-7-12-7-12Zm-3 13a3 3 0 0 0 3 3" />
  ),
  pressure: (
    <>
      <path d="M5 19a9 9 0 1 1 14 0M12 3v2M5 7l2 2m12-2-2 2M3 13h2m14 0h2M12 13l4-5" />
      <circle cx="12" cy="13" r="1.5" />
      <path d="M9 20h6" />
    </>
  ),
  mountain: (
    <>
      <path d="m2 20 8-15 5 9 3-5 5 11ZM7 11l3 2 3-2" />
    </>
  ),
  chevron: <path d="m8 10 4 4 4-4" />,
}

export function GeoIcon({ name, style }: { name: GeoIconName; style?: CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      {paths[name]}
    </svg>
  )
}
