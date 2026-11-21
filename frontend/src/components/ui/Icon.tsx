import type { ReactNode } from 'react'

const paths = {
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
  chevron: <path d="m9 4 7 8-7 8" />,
  pencil: (
    <path d="m14.5 5.5 4 4M4 20l4.5-1 12-12a2.8 2.8 0 0 0-4-4l-12 12L4 20Z" />
  ),
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  close: <path d="m5 5 14 14M19 5 5 19" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 11v6" />
      <circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M9.1 9a3 3 0 1 1 4.6 2.7c-1 .6-1.7 1.3-1.7 2.6" />
      <circle cx="12" cy="17.3" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  gear: (
    <path
      d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41L9.25 5.35c-.59.24-1.13.57-1.62.94L5.24 5.33c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.03-1.58ZM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6Z"
      fill="currentColor"
      stroke="none"
    />
  ),
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
  expand: <path d="M14 3h7v7M21 3l-7 7M10 21H3v-7M3 21l7-7" />,
  collapse: <path d="M21 3l-7 7m0-7v7h7M3 21l7-7m-7 0h7v7" />,
  pin: (
      <>
        <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
} satisfies Record<string, ReactNode>

export function Icon({ name, className = '' }: { name: keyof typeof paths; className?: string }) {
  return <svg className={`tg-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
