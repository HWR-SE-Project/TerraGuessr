import type { ReactNode } from 'react'
import { Icon } from './Icon'

export function SettingSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="surface overflow-hidden">
      <h2 className="border-b border-white/8 px-5 py-3 font-display text-sm font-semibold uppercase tracking-widest text-subtle">
        {title}
      </h2>
      <div className="divide-y divide-white/6">{children}</div>
    </section>
  )
}

export function SettingRow({
  icon,
  title,
  hint,
  children,
  danger,
}: {
  icon: Parameters<typeof Icon>[0]['name']
  title: string
  hint?: string
  children: ReactNode
  danger?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
            danger ? 'bg-rose-400/15 text-rose-300' : 'bg-space-800 text-subtle'
          }`}
        >
          <Icon name={icon} size={18} />
        </span>
        <div className="min-w-0">
          <p className={`font-semibold ${danger ? 'text-rose-300' : 'text-cream'}`}>{title}</p>
          {hint && <p className="truncate text-sm text-subtle">{hint}</p>}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
