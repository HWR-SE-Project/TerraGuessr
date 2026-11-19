import './UnavailableNotice.css'

export function UnavailableNotice({ children }: { children: React.ReactNode }) {
  return (
    <p className="tg-unavailable-notice" role="status">
      {children}
    </p>
  )
}
