import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import type { IconName } from '../../components/ui/Icon'
import { staggerContainer, staggerItem } from '../../lib/motion'
import { DIFFICULTY_LEVELS, difficultyDetails } from '../../lib/difficulty'
import { formatDistance, formatScore } from '../../lib/format'
import { resolveLobbyBounds } from '../../lib/lobby'
import { useGameRules } from '../../state/gameRules'
import { scoreForDistance } from '../../services/mock/gameRules'

interface ClueHighlight {
  icon: IconName
  signal: string
  narrows: string
  summary: string
  accent: string
}

const KEY_CLUES: ClueHighlight[] = [
  {
    icon: 'sun',
    signal: 'Sky lighting',
    narrows: 'Longitude (East–West)',
    summary:
      'Day, dusk, and night match real solar time right now. Compare the 3D sky to your own clock to slice off half the globe — dusk pins you right on the sunrise/sunset line.',
    accent: 'text-amber-300 bg-amber-400/15',
  },
  {
    icon: 'flame',
    signal: 'Temperature + season',
    narrows: 'Latitude & hemisphere',
    summary:
      'Read temperature against today’s calendar month. Warm air in northern winter points to the tropics or Southern Hemisphere summer; Peak UV confirms solar angle even at night.',
    accent: 'text-rose-300 bg-rose-400/15',
  },
  {
    icon: 'globe',
    signal: '3D Biome',
    narrows: 'Terrain & geography',
    summary:
      'Each island renders the destination’s real biome — Coast, Mountains, Desert, Tundra, Forest, Grasslands, or Urban — so you can rule out impossible regions at a glance.',
    accent: 'text-lime-300 bg-lime-400/15',
  },
  {
    icon: 'mountain',
    signal: 'Elevation (Dossier)',
    narrows: 'Altitude trap-breaker',
    summary:
      'Air cools ~6.5°C per 1,000 m. High elevation explains cool temperatures near the equator (Andes, East African Rift, Mexico) so you don’t confuse Quito with Scandinavia.',
    accent: 'text-sky-300 bg-sky-400/15',
  },
  {
    icon: 'drop',
    signal: '24h temp swing (Δ°) & humidity',
    narrows: 'Coastal vs. inland',
    summary:
      'Oceans buffer temperature: islands and humid coasts swing only Δ3–6°C across 24 hours, while dry deserts and continental interiors swing Δ14–22°C+.',
    accent: 'text-violet-300 bg-violet-400/15',
  },
]

const DISTANCE_PRESETS = [
  { label: 'Bullseye', km: 50 },
  { label: 'London ↔ Paris', km: 344 },
  { label: 'London ↔ Rome', km: 1435 },
  { label: 'New York ↔ London', km: 5570 },
  { label: 'Halfway round Earth', km: 10000 },
] as const

export function HowToPlayPage() {
  const rules = useGameRules()
  const { minPlayers, maxPlayers } = resolveLobbyBounds(rules?.lobby)
  const [previewKm, setPreviewKm] = useState(344)

  const maxScore = rules?.scoring.maxScore ?? 5000
  const fullScoreKm = rules?.scoring.fullScoreKm ?? 100
  const zeroScoreKm = rules?.scoring.zeroScoreKm ?? 20000
  const previewScore = scoreForDistance(previewKm)
  const scorePct = Math.max(0, Math.min(100, (previewScore / maxScore) * 100))

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="flex flex-col gap-10">
        {/* Hero */}
        <motion.div variants={staggerItem} className="text-center">
          <p className="eyebrow">How to play</p>
          <h1 className="mt-2 font-display text-4xl font-semibold text-cream sm:text-5xl">
            Learn to read the planet
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
            Every round drops your explorer onto a live 3D biome shaped by real-time weather. Practice the core
            deduction loop in a 2-round guided tutorial, or dive into the Ultimate Guide for every metric.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
            <Button size="lg" icon="play" to="/how-to-play/tutorial">
              Start interactive tutorial
            </Button>
            <Button size="lg" variant="tinted" icon="book" to="/how-to-play/guide">
              Read Ultimate Guide
            </Button>
          </div>
          <p className="mt-2.5 text-xs text-subtle">
            2 guided practice rounds · Easy &amp; Medium hands-on · Skip or restart anytime
          </p>
        </motion.div>

        {/* Key deduction clues */}
        <motion.section variants={staggerItem} aria-labelledby="clues-heading">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">Start here</p>
              <h2 id="clues-heading" className="mt-1 font-display text-2xl font-semibold text-cream">
                The 5 highest-leverage clues
              </h2>
            </div>
            <Link
              to="/how-to-play/guide"
              className="inline-flex items-center gap-1 text-sm font-bold text-lime-300 transition-colors hover:text-lime-400"
            >
              See all 12+ metrics in Ultimate Guide
              <Icon name="chevronRight" size={16} />
            </Link>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {KEY_CLUES.map((clue) => (
              <div key={clue.signal} className="surface flex flex-col gap-2.5 p-5">
                <div className="flex items-center gap-3">
                  <span className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${clue.accent}`}>
                    <Icon name={clue.icon} size={20} />
                  </span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-subtle">
                      {clue.narrows}
                    </p>
                    <h3 className="font-display text-base font-semibold text-cream">{clue.signal}</h3>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-muted sm:text-sm">{clue.summary}</p>
              </div>
            ))}

            {/* Featured card linking to the Ultimate Guide */}
            <Link
              to="/how-to-play/guide"
              className="surface group flex flex-col justify-between gap-3 border-lime-400/25 p-5 transition-colors hover:border-lime-400/50"
            >
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-lime-400/15 px-2.5 py-1 font-display text-[11px] font-semibold uppercase tracking-wider text-lime-300">
                  <Icon name="book" size={12} />
                  Deep dive
                </span>
                <h3 className="mt-3 font-display text-lg font-semibold text-cream">
                  Ultimate Field Guide
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-muted sm:text-sm">
                  Dew point, sea-level pressure, wind direction, Peak UV bands, climate cheat combos, and unlock economics.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 font-display text-sm font-semibold text-lime-300 transition-transform group-hover:translate-x-0.5">
                Open guide
                <Icon name="chevronRight" size={16} />
              </span>
            </Link>
          </div>
        </motion.section>

        {/* Game Modes & Difficulty */}
        <motion.section variants={staggerItem} aria-labelledby="modes-heading" className="flex flex-col gap-5">
          <div className="text-center">
            <p className="eyebrow">Game modes</p>
            <h2 id="modes-heading" className="mt-1 font-display text-2xl font-semibold text-cream">
              Play solo or challenge friends
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="surface-flat flex items-start gap-4 p-5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-lime-400/15 text-lime-300">
                <Icon name="play" size={20} />
              </span>
              <div>
                <h3 className="font-display text-lg font-semibold text-cream">Singleplayer</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  Choose a fixed round count or endless exploring. Take your time studying each reveal, track your
                  accuracy over time in Stats, and sharpen your instincts across all three difficulties.
                </p>
              </div>
            </div>

            <div className="surface-flat flex items-start gap-4 p-5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-violet-400/15 text-violet-300">
                <Icon name="users" size={20} />
              </span>
              <div>
                <h3 className="font-display text-lg font-semibold text-cream">
                  Multiplayer ({minPlayers}–{maxPlayers} players)
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  Share a lobby code so everyone plays the exact same mystery location and difficulty. Scores stay
                  private during play, then all guesses reveal together on one map with a 15-second review and shared leaderboard.
                </p>
              </div>
            </div>
          </div>

          {rules && (
            <div className="grid gap-4 sm:grid-cols-3">
              {DIFFICULTY_LEVELS.map((difficulty) => (
                <div key={difficulty.id} className="surface-flat p-5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-display text-lg font-semibold text-lime-300">{difficulty.label}</h3>
                    <span className="text-xs font-bold text-subtle">{difficulty.tagline}</span>
                  </div>
                  <ul className="mt-3 flex flex-col gap-1.5">
                    {difficultyDetails(rules.difficulties[difficulty.id]).map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm text-muted">
                        <Icon name="check" size={14} className="shrink-0 text-lime-300" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <p className="text-center text-xs text-subtle">
            Changing your selected pin or city is always free before submitting. On Easy &amp; Medium, multiple attempts
            act as <strong className="text-muted">Best-of-N</strong> bets — your closest submitted guess counts, even if time runs out.
          </p>
        </motion.section>

        {/* Distance & Scoring Interactive Curve */}
        <motion.section variants={staggerItem} aria-labelledby="scoring-heading">
          <h2 id="scoring-heading" className="mb-4 text-center font-display text-2xl font-semibold text-cream">
            Distance &amp; scoring
          </h2>
          <div className="surface p-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="font-display text-3xl font-semibold text-cream">
                Up to <span className="text-lime-300">{formatScore(maxScore)} points</span> per round
              </p>
              <p className="max-w-lg text-sm leading-relaxed text-muted">
                Distance is measured along Earth’s curve (Haversine). Land within{' '}
                <strong className="text-cream">{formatScore(fullScoreKm)} km</strong> for the full score; points decrease
                smoothly to zero at {formatScore(zeroScoreKm)} km.
              </p>
            </div>

            <div className="mt-5 rounded-2xl bg-space-800 p-4 sm:p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <output
                  aria-live="polite"
                  aria-label="Preview score"
                  className="font-display text-2xl font-semibold text-lime-300 tabular-nums"
                >
                  {formatScore(previewScore)}{' '}
                  <span className="text-sm font-normal text-subtle">/ {formatScore(maxScore)} pts</span>
                </output>
                <span className="text-sm font-semibold text-cream tabular-nums">
                  {formatDistance(previewKm)} away
                </span>
              </div>

              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-space-900">
                <div
                  className="h-full rounded-full bg-lime-400 transition-[width] duration-150"
                  style={{ width: `${scorePct}%` }}
                />
              </div>

              <input
                aria-label="Preview distance in kilometres"
                type="range"
                min={0}
                max={zeroScoreKm}
                step={50}
                value={previewKm}
                onChange={(event) => setPreviewKm(Number(event.target.value))}
                className="mt-3 w-full accent-lime-400"
              />

              <div className="mt-3 flex flex-wrap gap-1.5">
                {DISTANCE_PRESETS.map((preset) => {
                  const active = Math.abs(previewKm - preset.km) < 25
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setPreviewKm(preset.km)}
                      className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                        active
                          ? 'bg-lime-400/20 text-lime-300'
                          : 'bg-space-700 text-muted hover:bg-space-600 hover:text-cream'
                      }`}
                    >
                      {preset.label} ({preset.km.toLocaleString('en-US')} km)
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </motion.section>

        {/* Footer CTA */}
        <motion.div variants={staggerItem} className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-muted">Ready to put your instincts to the test?</p>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
            <Button size="lg" icon="play" to="/singleplayer">
              Singleplayer
            </Button>
            <Button size="lg" variant="secondary" icon="users" to="/multiplayer">
              Multiplayer
            </Button>
          </div>
          <Link to="/" className="text-sm font-bold text-subtle hover:text-cream">
            Back home
          </Link>
        </motion.div>
      </motion.div>
    </div>
  )
}
