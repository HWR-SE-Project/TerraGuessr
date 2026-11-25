import { motion } from 'framer-motion'
import type { Candidate } from '../../lib/contracts'
import { formatRegion } from '../../lib/format'
import { Icon } from '../ui/Icon'

/** Easy-mode city shortlist fallback when candidate coordinates are unavailable. */
export function CandidateList({
  candidates,
  selected,
  submittedIds = [],
  onSelect,
  disabled = false,
}: {
  candidates: Candidate[]
  selected: string | null
  submittedIds?: string[]
  onSelect: (candidate: Candidate) => void
  disabled?: boolean
}) {
  const submitted = new Set(submittedIds)
  return (
    <div className="grid grid-cols-2 gap-2">
      {candidates.map((candidate) => {
        const isSubmitted = submitted.has(candidate.id)
        const isSelected = !isSubmitted && selected === candidate.id
        return (
          <motion.button
            key={candidate.id}
            type="button"
            disabled={disabled || isSubmitted}
            aria-pressed={isSelected}
            onClick={() => onSelect(candidate)}
            whileTap={{ scale: 0.97 }}
            className={`flex items-start gap-2.5 rounded-2xl border px-3 py-2.5 text-left text-sm transition-colors ${
              isSubmitted
                ? 'border-sky-400/50 bg-sky-400/10 opacity-85'
                : isSelected
                  ? 'border-lime-400/70 bg-lime-400/12'
                  : 'border-white/10 bg-space-700 hover:border-white/20'
            }`}
          >
            {isSubmitted ? (
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-sky-400 text-ink">
                <Icon name="check" size={12} />
              </span>
            ) : isSelected ? (
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-lime-400 text-ink">
                <Icon name="check" size={12} />
              </span>
            ) : (
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-space-600 text-subtle">
                <Icon name="pin" size={12} />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block leading-snug font-bold wrap-anywhere text-cream">
                {candidate.name}
              </span>
              <span className="mt-0.5 block text-xs leading-tight text-subtle">
                {isSubmitted ? 'Submitted' : formatRegion(candidate.region)}
              </span>
            </span>
          </motion.button>
        )
      })}
    </div>
  )
}
