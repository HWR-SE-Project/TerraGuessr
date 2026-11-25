import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Candidate, GameRules, GuessInput, LatLon } from '../../lib/contracts'
import { formatRegion } from '../../lib/format'
import { ApiError } from '../../services'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { CandidateList } from './CandidateList'
import { GuessMap } from './GuessMap'
import type { MapCandidate } from './GuessMap'

/** Coalesce rapid pin drags/city taps so normal play never trips write rate limits (R08). */
const SELECTION_COALESCE_MS = 150
/** Flush immediately during the final 3 seconds so last-second picks land before timeout (R08). */
const IMMEDIATE_FLUSH_WINDOW_MS = 3_000
const MAX_SELECTION_RETRIES = 2
const RETRY_BASE_DELAY_MS = 250

type SelectionSyncState = 'idle' | 'saving' | 'saved' | 'error'

function isTransientSelectionError(cause: unknown): boolean {
  if (cause instanceof ApiError) {
    return cause.status === 0 || cause.status === 429 || cause.status >= 500
  }
  return true
}

function isNearDeadline(endsAt: string | null | undefined): boolean {
  if (!endsAt) return false
  const deadline = Date.parse(endsAt)
  return Number.isFinite(deadline) && deadline - Date.now() <= IMMEDIATE_FLUSH_WINDOW_MS
}

function defaultPanelOpen(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return window.matchMedia('(min-width: 1024px)').matches
}

export function GuessPanel({
  rules, candidates = [], initialSelection = null, initialCandidateId = null,
  submittedGuesses = [], submittedCandidateIds = [], endsAt = null, attemptsUsed, attemptsTotal,
  submitting, disabled = false, onSelect, onSubmit,
}: {
  rules?: Pick<GameRules, 'selectionMode' | 'countryBorders'>
  candidates?: Candidate[]
  initialSelection?: LatLon | null
  initialCandidateId?: string | null
  submittedGuesses?: LatLon[]
  submittedCandidateIds?: string[]
  endsAt?: string | null
  attemptsUsed: number
  attemptsTotal: number
  submitting: boolean
  disabled?: boolean
  onSelect: (choice: GuessInput) => Promise<void>
  onSubmit: (choice: GuessInput, final: boolean) => void
}) {
  const [open, setOpen] = useState(defaultPanelOpen)
  const [selection, setSelection] = useState(initialSelection)
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(initialCandidateId)
  const [syncState, setSyncState] = useState<SelectionSyncState>('idle')
  const [syncError, setSyncError] = useState<string | null>(null)

  const mountedRef = useRef(true)
  const onSelectRef = useRef(onSelect)
  const endsAtRef = useRef(endsAt)
  const lockedRef = useRef(false)
  const latestVersionRef = useRef(0)
  const inFlightRef = useRef(false)
  const pendingRef = useRef<{ choice: GuessInput; version: number } | null>(null)
  const failedRef = useRef<{ choice: GuessInput; version: number } | null>(null)
  const debounceTimerRef = useRef<number | undefined>(undefined)
  const retryTimerRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])
  useEffect(() => {
    endsAtRef.current = endsAt
  }, [endsAt])

  // Older round payloads signaled list mode by supplying city candidates.
  const selectionMode = rules?.selectionMode
  const listMode = selectionMode ? selectionMode === 'list' : candidates.length > 0
  const remaining = attemptsTotal - attemptsUsed
  const locked = disabled || submitting || remaining <= 0
  lockedRef.current = locked

  const clearTimers = useCallback(() => {
    if (debounceTimerRef.current !== undefined) {
      window.clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = undefined
    }
    if (retryTimerRef.current !== undefined) {
      window.clearTimeout(retryTimerRef.current)
      retryTimerRef.current = undefined
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearTimers()
    }
  }, [clearTimers])

  const sendChoice = useCallback(async (choice: GuessInput, version: number, attempt = 0) => {
    if (!mountedRef.current || version !== latestVersionRef.current) return
    inFlightRef.current = true
    setSyncState('saving')
    setSyncError(null)
    try {
      await onSelectRef.current(choice)
      inFlightRef.current = false
      if (!mountedRef.current) return
      const queued = pendingRef.current
      if (queued && queued.version === latestVersionRef.current) {
        pendingRef.current = null
        void sendChoice(queued.choice, queued.version, 0)
        return
      }
      if (version === latestVersionRef.current) {
        failedRef.current = null
        setSyncState('saved')
        setSyncError(null)
      }
    } catch (cause) {
      inFlightRef.current = false
      if (!mountedRef.current) return
      const queued = pendingRef.current
      if (queued && queued.version === latestVersionRef.current) {
        pendingRef.current = null
        void sendChoice(queued.choice, queued.version, 0)
        return
      }
      if (version !== latestVersionRef.current) return
      // A 409 means the round has already ended or locked server-side; stop silently.
      if (cause instanceof ApiError && cause.status === 409) {
        failedRef.current = null
        setSyncState('idle')
        setSyncError(null)
        return
      }
      if (!lockedRef.current && attempt < MAX_SELECTION_RETRIES && isTransientSelectionError(cause)) {
        const delayMs = RETRY_BASE_DELAY_MS * (attempt + 1)
        retryTimerRef.current = window.setTimeout(() => {
          retryTimerRef.current = undefined
          if (!mountedRef.current || lockedRef.current) return
          void sendChoice(choice, version, attempt + 1)
        }, delayMs)
        return
      }
      failedRef.current = { choice, version }
      setSyncState('error')
      setSyncError(
        cause instanceof Error && cause.message
          ? cause.message
          : 'Could not save your selection for timeout.',
      )
    }
  }, [])

  // If the round locks while a debounced selection is waiting, flush it once immediately;
  // cancel any scheduled retry timer so nothing fires after lock.
  useEffect(() => {
    if (!disabled) return
    if (retryTimerRef.current !== undefined) {
      window.clearTimeout(retryTimerRef.current)
      retryTimerRef.current = undefined
    }
    if (debounceTimerRef.current !== undefined && pendingRef.current && !inFlightRef.current) {
      window.clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = undefined
      const queued = pendingRef.current
      pendingRef.current = null
      void sendChoice(queued.choice, queued.version, MAX_SELECTION_RETRIES)
    }
  }, [disabled, sendChoice])

  const selectedCity =
    candidates.find(
      (candidate) =>
        candidate.id === selectedCandidateId &&
        !submittedCandidateIds.includes(candidate.id),
    ) ?? null
  const mappedCandidates = useMemo<MapCandidate[]>(
    () =>
      candidates.flatMap((candidate) =>
        typeof candidate.lat === 'number' &&
        Number.isFinite(candidate.lat) &&
        typeof candidate.lon === 'number' &&
        Number.isFinite(candidate.lon)
          ? [
              {
                id: candidate.id,
                name: candidate.name ?? 'Unknown location',
                region: candidate.region,
                lat: candidate.lat,
                lon: candidate.lon,
              },
            ]
          : [],
      ),
    [candidates],
  )
  const useCandidateMap =
    listMode && mappedCandidates.length > 0 && mappedCandidates.length === candidates.length
  const activeChoice: GuessInput | null = listMode
    ? (selectedCity ? { candidateId: selectedCity.id } : null)
    : selection

  function select(choice: GuessInput) {
    if (locked) return
    if ('candidateId' in choice) {
      setSelectedCandidateId(choice.candidateId)
    } else {
      setSelection({ lat: choice.lat, lon: choice.lon })
    }
    const version = ++latestVersionRef.current
    failedRef.current = null
    setSyncError(null)
    setSyncState('saving')
    clearTimers()

    if (inFlightRef.current) {
      pendingRef.current = { choice, version }
      return
    }
    if (isNearDeadline(endsAtRef.current)) {
      pendingRef.current = null
      void sendChoice(choice, version, 0)
      return
    }
    pendingRef.current = { choice, version }
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = undefined
      const queued = pendingRef.current
      if (!queued || queued.version !== latestVersionRef.current || inFlightRef.current) return
      pendingRef.current = null
      void sendChoice(queued.choice, queued.version, 0)
    }, SELECTION_COALESCE_MS)
  }

  function retrySelectionSave() {
    if (locked || inFlightRef.current) return
    const failed = failedRef.current
    if (!failed) return
    clearTimers()
    void sendChoice(failed.choice, failed.version, 0)
  }

  function handleSubmit(final: boolean) {
    if (!activeChoice || locked) return
    // Submitting a guess persists the chosen location server-side, superseding any queued selection write.
    latestVersionRef.current += 1
    pendingRef.current = null
    failedRef.current = null
    clearTimers()
    setSyncError(null)
    setSyncState('idle')
    onSubmit(activeChoice, final)
  }

  return (
    <div className="surface-flat overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left lg:px-4 lg:py-3"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Icon name="pin" size={15} className="shrink-0 text-lime-300" />
          <span className="font-display text-sm font-semibold text-cream">
            {listMode ? 'Pick a city' : 'Place your pin'}
          </span>
          {!open && selectedCity && (
            <span className="truncate text-xs font-semibold text-lime-300">· {selectedCity.name}</span>
          )}
        </span>
        <motion.span initial={false} animate={{ rotate: open ? 0 : 180 }} transition={{ duration: 0.2 }} className="shrink-0">
          <Icon name="chevronDown" size={18} className="text-subtle" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/8 px-3 pb-3 pt-3">
              {listMode ? (
                useCandidateMap ? (
                  <>
                    <div className="h-44 overflow-hidden rounded-2xl sm:h-56 lg:h-72">
                      <GuessMap
                        candidates={mappedCandidates}
                        selectedCandidateId={selectedCity?.id ?? null}
                        submittedCandidateIds={submittedCandidateIds}
                        onSelectCandidate={(candidate) => select({ candidateId: candidate.id })}
                        interactive={!locked}
                        countryBorders={rules?.countryBorders}
                      />
                    </div>
                    <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/8 bg-space-800/80 px-3 py-2 text-xs">
                      {selectedCity ? (
                        <>
                          <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-lime-400 text-ink">
                            <Icon name="check" size={10} />
                          </span>
                          <span className="truncate font-bold text-cream">{selectedCity.name}</span>
                          {selectedCity.region && (
                            <span className="shrink-0 text-subtle">· {formatRegion(selectedCity.region)}</span>
                          )}
                        </>
                      ) : (
                        <>
                          <Icon name="pin" size={13} className="shrink-0 text-subtle" />
                          <span className="text-muted">Click a location on the map to select it.</span>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <CandidateList
                    candidates={candidates}
                    selected={selectedCity?.id ?? null}
                    submittedIds={submittedCandidateIds}
                    onSelect={(candidate) => select({ candidateId: candidate.id })}
                    disabled={locked}
                  />
                )
              ) : (
                <div className="h-44 overflow-hidden rounded-2xl sm:h-56 lg:h-72">
                  <GuessMap
                    guess={selection}
                    submittedGuesses={submittedGuesses}
                    onChange={(point) => select(point)}
                    interactive={!locked}
                    countryBorders={rules?.countryBorders}
                  />
                </div>
              )}
              {(attemptsTotal > 1 || syncState === 'saving' || (attemptsUsed > 0 && remaining > 0)) && (
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  {attemptsTotal > 1 && (
                    <p className="min-w-0 flex-1 text-[11px] text-subtle">
                      Best of {attemptsTotal}: your closest submitted guess counts.
                    </p>
                  )}
                  {syncState === 'saving' && (
                    <span className="shrink-0 text-[11px] font-semibold text-subtle">Saving…</span>
                  )}
                  {attemptsUsed > 0 && remaining > 0 && (
                    <span className="shrink-0 text-xs font-bold text-amber-300">{remaining} {remaining === 1 ? 'try' : 'tries'} left</span>
                  )}
                </div>
              )}
              {syncState === 'error' && syncError && (
                <div
                  role="alert"
                  className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-rose-400/40 bg-rose-400/10 px-2.5 py-1.5 text-xs text-rose-200"
                >
                  <span className="min-w-0 flex-1">
                    Selection not saved for timeout ({syncError}).
                  </span>
                  {!locked && (
                    <button
                      type="button"
                      onClick={retrySelectionSave}
                      className="shrink-0 rounded-lg bg-rose-400/20 px-2 py-0.5 font-bold text-rose-100 hover:bg-rose-400/30"
                    >
                      Retry
                    </button>
                  )}
                </div>
              )}
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Button
                  icon="pin"
                  disabled={locked || !activeChoice}
                  loading={submitting}
                  className="min-w-0 flex-1 max-sm:px-3 max-sm:text-sm"
                  onClick={() => handleSubmit(false)}
                >
                  Submit guess
                </Button>
                {remaining > 1 && (
                  <Button
                    variant="tinted"
                    icon="check"
                    disabled={locked || !activeChoice}
                    className="min-w-0 flex-1 max-sm:px-3 max-sm:text-sm"
                    onClick={() => handleSubmit(true)}
                  >
                    Final submit
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
