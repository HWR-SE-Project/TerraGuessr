import { Icon } from '../components/ui/Icon'
import { useId, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import type { CandidateDTO, LatLon } from '../api/types'
import { CandidateList } from './CandidateList'
import { collapseVariants } from '../lib/motion'
import './CityGuessPanel.css'

interface CityGuessPanelProps {
  candidates: CandidateDTO[]
  selectedId: string | null
  onChange: (guess: LatLon) => void
  children: ReactNode
  metadata?: string
  collapsed?: boolean
  onToggle?: () => void
  className?: string
}

/** List mode has its own content-sized layout instead of inheriting a map viewport. */
export function CityGuessPanel({
  candidates, selectedId, onChange, children, metadata,
  collapsed = false, onToggle, className = '',
}: CityGuessPanelProps) {
  const contentId = useId()
  const selected = candidates.find(candidate => candidate.id === selectedId)
  const heading = <>
    <Icon name="pin" />
    <span>Pick a city</span>
    <small>{metadata || `${candidates.length} cities`}</small>
    {onToggle && <svg className="tg-city-chevron" viewBox="0 0 16 16" aria-hidden="true">
      <path d={collapsed ? 'm5 9 3-3 3 3' : 'm5 7 3 3 3-3'} />
    </svg>}
  </>

  return (
    <aside className={`sp-guess-panel tg-city-panel tg-guess-surface tg-glass tg-glass--panel ${className}`} aria-label="City selection">
      <header className="tg-city-header">
        {onToggle ? (
          <button type="button" className="tg-city-toggle" aria-expanded={!collapsed}
            aria-controls={contentId} onClick={onToggle}>
            {heading}
          </button>
        ) : <h2 className="tg-city-title">{heading}</h2>}
      </header>
      <motion.div
        id={contentId}
        inert={collapsed}
        initial={false}
        animate={collapsed ? 'initial' : 'animate'}
        variants={collapseVariants}
        style={{ overflow: 'hidden' }}
      >
        <CandidateList candidates={candidates} selectedId={selectedId} onChange={onChange} />
        <footer className="tg-city-footer">
          <span className="tg-city-status" role="status">
            {selected ? `${selected.name || 'Location'} selected` : 'Choose a city before submitting'}
          </span>
          <div className="tg-city-actions">{children}</div>
        </footer>
      </motion.div>
    </aside>
  )
}
