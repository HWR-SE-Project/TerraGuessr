import './Brand.css'

/** One mark and wordmark across navigation, account screens, and gameplay. */
export function Brand() {
  return (
    <span className="tg-brand">
      <span className="tg-brand-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="none">
          <path
            d="M16 3 27 9v14l-11 6L5 23V9Z"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <path
            d="M10 11h12M16 11v11"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <circle cx="24" cy="7" r="3" fill="currentColor" />
        </svg>
      </span>
      <span className="tg-brand-word">
        Terra<span>Guessr</span>
        <span className="tg-brand-period">.</span>
      </span>
    </span>
  )
}
