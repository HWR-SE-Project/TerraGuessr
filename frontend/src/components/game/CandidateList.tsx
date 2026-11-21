import { motion } from 'framer-motion'
import type { Candidate } from '../../lib/contracts'
import { Icon } from '../ui/Icon'

/** Easy-mode city shortlist. Selecting a city is choosing your guess. */
export function CandidateList({
  candidates,
  selected,
  onSelect,
}: {
  candidates: Candidate[]
  selected: string | null
  onSelect: (candidate: Candidate) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {candidates.map((candidate) => {
        const isSelected = selected === candidate.id
        return (
          <motion.button
            key={candidate.id}
            type="button"
            onClick={() => onSelect(candidate)}
            whileTap={{ scale: 0.97 }}
            className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-left text-sm transition-colors ${
              isSelected
                ? 'border-lime-400/70 bg-lime-400/12'
                : 'border-white/10 bg-space-700 hover:border-white/20'
            }`}
          >
            {isSelected ? (
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-lime-400 text-ink">
                <Icon name="check" size={12} />
              </span>
            ) : (
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-space-600 text-subtle">
                <Icon name="pin" size={12} />
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate font-bold text-cream">{candidate.name}</span>
              <span className="block truncate text-xs text-subtle">{candidate.region}</span>
            </span>
          </motion.button>
        )
      })}
    </div>
  )
}
