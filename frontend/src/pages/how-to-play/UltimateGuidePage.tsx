import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import type { IconName } from '../../components/ui/Icon'
import { staggerContainer, staggerItem } from '../../lib/motion'
import { formatScore } from '../../lib/format'
import { resolveLobbyBounds } from '../../lib/lobby'
import { useGameRules } from '../../state/gameRules'

const SECTIONS = [
  { id: 'workflow', label: 'Workflow' },
  { id: 'diorama', label: 'Diorama & Lighting' },
  { id: 'core-weather', label: 'Core Weather' },
  { id: 'dossier', label: 'Station Dossier' },
  { id: 'archetypes', label: 'Climate Combos' },
  { id: 'strategy', label: 'Modes & Strategy' },
] as const

interface MetricDoc {
  icon: IconName
  name: string
  unit: string
  whatItShows: string
  howToUseIt: string
  benchmarks: string[]
}

const CORE_METRICS: MetricDoc[] = [
  {
    icon: 'flame',
    name: 'Temperature & Condition',
    unit: '°C · Sky label',
    whatItShows: 'Live surface air temperature and weather condition (Clear, Cloudy, Fog, Drizzle, Rain, Snow, Thunderstorm).',
    howToUseIt:
      'Always read temperature together with today’s calendar month and elevation. Warm readings in November–February point south of the Tropic of Cancer (tropics or Southern Hemisphere summer); freezing conditions narrow to winter mid/high latitudes or high mountains.',
    benchmarks: ['≤ 1°C: Freezing / snow possible', '10–22°C: Temperate, highland tropics, or cool maritime', '≥ 30°C: Tropics, summer interior, or hot desert'],
  },
  {
    icon: 'rain',
    name: 'Precipitation',
    unit: 'mm',
    whatItShows: 'Recent/current rainfall or snowfall amount over the active forecast window (1h or 6h).',
    howToUseIt:
      'Active rain immediately cools the air slightly and rules out most hyper-arid desert cores unless it’s a brief monsoon burst. Snow confirms near- or sub-zero temperatures aloft.',
    benchmarks: ['0.0 mm: Dry right now (check 24h precip in dossier)', '0.2–2 mm: Light rain / drizzle / steady snow', '≥ 5 mm: Heavy showers, tropical downpour, or storm front'],
  },
  {
    icon: 'drop',
    name: 'Relative Humidity',
    unit: '%',
    whatItShows: 'How saturated the air is at the current temperature.',
    howToUseIt:
      'Humidity rises at night and drops in the afternoon, so read it alongside sky lighting. Daytime humidity under 30% strongly signals deserts, steppes, or dry highland interiors; 80%+ in warm air points to humid tropics or oceanside air.',
    benchmarks: ['< 30%: Arid desert or very dry continental air', '45–70%: Typical temperate or seasonal interior', '> 80%: Maritime coast, rainforest, fog, or active rain'],
  },
  {
    icon: 'wind',
    name: 'Wind Speed & Direction',
    unit: 'm/s · N–NW',
    whatItShows: 'Sustained wind speed in metres per second plus the compass direction the wind blows FROM.',
    howToUseIt:
      'Strong winds (> 8–10 m/s) favor exposed coasts, islands, open plains, mountain passes, or active cyclones. Wind direction helps confirm prevailing belts (e.g. trade winds from E/NE/SE in the tropics, westerlies from W/SW in mid-latitudes).',
    benchmarks: ['< 4 m/s: Calm / sheltered inland or equatorial doldrums', '4–10 m/s: Breezy coastal or open terrain', '> 10 m/s: Windy storm system, exposed island, or high-latitude coast'],
  },
]

const DOSSIER_METRICS: MetricDoc[] = [
  {
    icon: 'mountain',
    name: 'Elevation & Relief',
    unit: 'm · Low / Rolling / High',
    whatItShows: 'Station altitude above sea level (metres) and local terrain relief.',
    howToUseIt:
      'The single biggest trap-breaker in TerraGuessr. Air cools by roughly 6.5°C per 1,000 m of elevation. If a spot is 12°C with Extreme UV, high elevation tells you it’s the Andes, Ethiopian Highlands, Mexican Plateau, or Tibetan fringe — not Scandinavia.',
    benchmarks: ['0–50 m: Coastal plains, river deltas, islands', '500–1,500 m: Plateaus & foothills (Madrid, Nairobi, Denver, Johannesburg)', '2,000 m+: High mountain cities (Quito, Bogotá, Mexico City, La Paz, Addis Ababa)'],
  },
  {
    icon: 'flame',
    name: '24h Temperature Range (Δ°)',
    unit: 'min° – max°C (Δ°)',
    whatItShows: 'Expected lowest and highest temperatures over the next 24 hours, plus the diurnal swing Δ.',
    howToUseIt:
      'Water buffers temperature; dry land and clear skies let heat escape fast at night. This makes Δ° your best continentality and aridity detector — even when you land at night.',
    benchmarks: ['Δ 2–6°C: Equatorial islands, overcast maritime coasts, polar overcast', 'Δ 7–12°C: Typical temperate coastal or humid inland', 'Δ 14–22°C+: Dry deserts, semi-arid plateaus, deep continental interiors'],
  },
  {
    icon: 'sun',
    name: 'Peak UV (24h)',
    unit: 'Index · Low → Extreme',
    whatItShows: 'Clear-sky peak ultraviolet index over the 24-hour window (independent of whether it’s currently night!).',
    howToUseIt:
      'Because Peak UV reflects solar noon elevation angle, it works like a direct latitude + season meter even when you appear at midnight. High elevation also boosts UV slightly (~10% per 1,000 m).',
    benchmarks: ['0–2 (Low): High-latitude winter (> 50°)', '3–5 (Moderate): Mid-latitude spring/autumn or subtropics in winter', '6–7 (High): Mid-latitude summer or subtropics', '8–10+ (Very High / Extreme): Tropics, summer subtropics, or tropical highlands'],
  },
  {
    icon: 'drop',
    name: 'Dew Point',
    unit: '°C',
    whatItShows: 'The temperature at which moisture in the air condenses — a direct measure of absolute moisture.',
    howToUseIt:
      'Unlike relative humidity, dew point doesn’t swing wildly between day and night. A 24°C+ dew point almost exclusively occurs in muggy equatorial/monsoon zones; sub-zero dew points mean very dry or frigid air.',
    benchmarks: ['< 0°C: Dry arctic, winter continental, or high desert air', '5–15°C: Comfortable temperate or dry highland air', '18–22°C: Humid subtropical / warm coastal', '≥ 23°C: Oppressive equatorial rainforest, monsoon coast, or Persian Gulf'],
  },
  {
    icon: 'rain',
    name: '24h Precipitation',
    unit: 'mm',
    whatItShows: 'Total forecast rainfall/snowfall summed across the next 24 hours.',
    howToUseIt:
      'Catches wet climates even if it happens to be dry at this exact hour. Consistently high 24h totals align with active frontal zones, tropical convergence (ITCZ), or monsoon belts.',
    benchmarks: ['0 mm: High-pressure ridge or arid belt', '1–10 mm: Passing front or light showers', '15 mm+: Tropical wet belt, monsoon, or strong coastal storm'],
  },
  {
    icon: 'cloud',
    name: 'Cloud Cover',
    unit: '%',
    whatItShows: 'Fraction of the sky covered by clouds right now.',
    howToUseIt:
      'Persistent 85–100% cloud cover pairs with small 24h Δ° in maritime west coasts (NW Europe, Pacific NW, southern Chile, NZ). Near-0% clouds + huge Δ° points to subtropical deserts and high-pressure interiors.',
    benchmarks: ['0–15%: Clear skies (high pressure / desert / crisp winter)', '40–70%: Convective or changeable mid-latitudes', '85–100%: Frontal rain, marine layer, or winter stratus'],
  },
  {
    icon: 'pressure',
    name: 'Sea-Level Pressure',
    unit: 'hPa',
    whatItShows: 'Atmospheric pressure reduced to sea level (standard average is 1,013 hPa).',
    howToUseIt:
      'Helps identify large-scale weather regimes: deep lows (< 1,000 hPa) point to mid/high-latitude storm tracks (North Atlantic, Southern Ocean, Aleutians) or tropical cyclones; strong highs (> 1,028 hPa) often sit over cold winter continental interiors (Siberia, Canada) or subtropical ridges.',
    benchmarks: ['< 1,000 hPa: Active cyclone / stormy oceanic belt', '1,008–1,016 hPa: Typical equatorial trough or calm average', '> 1,025 hPa: Strong anticyclone / winter continental high'],
  },
  {
    icon: 'wind',
    name: 'Wind Gusts, Fog & Thunder Risk',
    unit: 'm/s · %',
    whatItShows: 'Extra alert metrics shown when relevant: peak wind gusts, fog cover %, and thunderstorm probability %.',
    howToUseIt:
      'High thunder risk points to warm, humid convective regions (tropics, summer plains). Thick fog often forms along cold ocean currents (California, Peru/Chile, Namibia, Newfoundland) or damp river valleys. Large gaps between wind and gusts indicate turbulent mountains or squalls.',
    benchmarks: ['Thunder risk > 20%: Tropics, summer lowlands, or humid interiors', 'Fog cover > 30%: Cold-current coasts, valleys, or autumn/winter inversions', 'Gusts ≫ Wind speed: Mountain terrain or passing storm front'],
  },
]

const BIOMES: { name: string; icon: IconName; clue: string }[] = [
  { name: 'Coast', icon: 'drop', clue: 'Near ocean or major sea shoreline — immediately rule out deep landlocked interiors.' },
  { name: 'Mountains', icon: 'mountain', clue: 'Alpine/highland regions (Andes, Alps, Rockies, Himalayas, East African Rift, Caucasus).' },
  { name: 'Desert', icon: 'sun', clue: 'Arid belts (~15°–35° N/S like Sahara, Arabia, Australia, SW USA) and rain-shadow basins (Gobi, Atacama, Central Asia).' },
  { name: 'Tundra', icon: 'snow', clue: 'High-latitude subarctic/arctic (Iceland, northern Scandinavia, Siberia, Alaska, northern Canada, Greenland) or extreme altitude.' },
  { name: 'Forest', icon: 'compass', clue: 'Temperate woodland, boreal taiga, or tropical rainforest — pair with temperature & UV to pick the latitude.' },
  { name: 'Grasslands', icon: 'wind', clue: 'Open plains, savannas, pampas, or steppes (Great Plains, Central Asia, East Africa, Argentina, Australian outback fringes).' },
  { name: 'Urban', icon: 'globe', clue: 'Dense metro area — doesn’t restrict climate on its own, so lean harder on lighting, UV, elevation, and Δ°.' },
]

interface ClimateArchetype {
  name: string
  examples: string
  signature: string
  why: string
  accent: string
}

const ARCHETYPES: ClimateArchetype[] = [
  {
    name: 'Equatorial Highland',
    examples: 'Quito, Bogotá, Addis Ababa, Cusco, Nairobi',
    signature: '10–18°C · Peak UV 10–12 · Elevation 1,800–3,500 m · Mountains',
    why: 'Extreme UV proves low latitude, while elevation explains why it feels like cool spring all year.',
    accent: 'text-lime-300',
  },
  {
    name: 'Equatorial Maritime',
    examples: 'Singapore, Jakarta, Panama City, Suva, Colombo',
    signature: '27–32°C · Dew point ≥ 23°C · Δ 3–6°C · Peak UV 10–12 · Coast',
    why: 'Warm sea air locks temperatures into a narrow band day and night with heavy moisture and frequent showers.',
    accent: 'text-sky-300',
  },
  {
    name: 'Subtropical Desert',
    examples: 'Cairo, Riyadh, Phoenix, Alice Springs, Windhoek',
    signature: 'Low humidity (< 30%) · Δ 14–22°C · Clear skies · Desert',
    why: 'Dry air heats up fast under strong sun and plunges after sunset, creating a massive 24-hour swing.',
    accent: 'text-amber-300',
  },
  {
    name: 'Marine West Coast',
    examples: 'Bergen, Seattle, Dublin, Auckland, Puerto Montt',
    signature: '6–18°C · Cloud cover 80%+ · Δ 3–7°C · Breezy W/SW · Coast',
    why: 'Onshore ocean westerlies keep temperatures mild, overcast, damp, and tightly buffered across 24 hours.',
    accent: 'text-violet-300',
  },
  {
    name: 'Continental Interior',
    examples: 'Astana, Winnipeg, Ulaanbaatar, Novosibirsk, Denver',
    signature: 'Extreme seasonal temp · Δ 12–18°C · Low dew point · High winter hPa',
    why: 'Far from ocean moderation: frigid, high-pressure winters and hot, convective summers with wide daily swings.',
    accent: 'text-rose-300',
  },
  {
    name: 'Subarctic / Tundra',
    examples: 'Reykjavík, Tromsø, Nuuk, Anchorage, Fairbanks',
    signature: '≤ 5°C (or chilly summer) · Low Peak UV · Tundra · Low hPa near oceans',
    why: 'Low solar angle keeps Peak UV small; coastal North Atlantic spots stay windier and milder than inland Siberia/Canada.',
    accent: 'text-sky-300',
  },
]

export function UltimateGuidePage() {
  const rules = useGameRules()
  const { minPlayers, maxPlayers } = resolveLobbyBounds(rules?.lobby)

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="flex flex-col gap-10">
        {/* Header & Breadcrumb */}
        <motion.div variants={staggerItem}>
          <Link
            to="/how-to-play"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-subtle transition-colors hover:text-cream"
          >
            <Icon name="chevronLeft" size={16} />
            Back to How to play
          </Link>

          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">Ultimate Field Guide</p>
              <h1 className="mt-1.5 font-display text-3xl font-semibold text-cream sm:text-4xl">
                Every clue, decoded
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
                The complete reference for reading TerraGuessr’s live weather, 3D diorama, Station Dossier,
                and mode rules to pinpoint any spot on Earth.
              </p>
            </div>
            <Button size="md" icon="play" to="/how-to-play/tutorial" className="shrink-0">
              Interactive tutorial
            </Button>
          </div>

          {/* Jump nav */}
          <nav
            aria-label="Guide sections"
            className="scroll-thin mt-6 flex gap-2 overflow-x-auto pb-1"
          >
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="shrink-0 rounded-full border border-white/10 bg-space-700/80 px-3.5 py-1.5 text-xs font-bold text-muted transition-colors hover:border-lime-400/40 hover:text-lime-300"
              >
                {section.label}
              </a>
            ))}
          </nav>
        </motion.div>

        {/* 1. Triangulation Workflow */}
        <motion.section id="workflow" variants={staggerItem} className="scroll-mt-20">
          <SectionHeading
            eyebrow="Step-by-step"
            title="The 4-step triangulation workflow"
            subtitle="Don’t guess from a single number — narrow the globe in order from broadest slice to sharpest pinpoint."
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                num: '01',
                title: 'Slice East–West',
                detail: 'Check Day / Dusk / Night in the 3D sky against your own local clock to cut out half the globe (or lock onto the dawn/dusk terminator).',
              },
              {
                num: '02',
                title: 'Band North–South',
                detail: 'Combine Temperature with today’s calendar month — then verify solar angle using Peak UV (24h) once unlocked.',
              },
              {
                num: '03',
                title: 'Filter Geography',
                detail: 'Use the 3D Biome + Elevation + 24h Temp Range (Δ°) to separate coasts, islands, mountains, deserts, and inland plains.',
              },
              {
                num: '04',
                title: 'Fine-tune & Hedge',
                detail: 'Use Dew Point, Pressure, Wind Direction, and Best-of-N attempts to refine your pin or hedge between two candidate regions.',
              },
            ].map((step) => (
              <div key={step.num} className="surface-flat flex flex-col gap-2 p-4">
                <span className="font-display text-xs font-semibold uppercase tracking-widest text-lime-300">
                  Stage {step.num}
                </span>
                <h3 className="font-display text-base font-semibold text-cream">{step.title}</h3>
                <p className="text-xs leading-relaxed text-muted">{step.detail}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* 2. Diorama & Lighting */}
        <motion.section id="diorama" variants={staggerItem} className="scroll-mt-20">
          <SectionHeading
            eyebrow="Visual signals"
            title="3D Diorama, sky lighting & biomes"
            subtitle="Every round’s 3D island is procedurally built from the location’s real biome and live MET Norway weather — never from random decoration."
          />

          <div className="surface mt-4 p-5">
            <h3 className="font-display text-base font-semibold text-cream">
              How sky lighting maps to local solar time
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted sm:text-sm">
              Solar time advances by <strong className="text-cream">1 hour for every 15° of longitude</strong>.
              Compare the diorama’s sky to current UTC time (or your local clock) to find which longitudes match:
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-space-800 p-3.5">
                <p className="font-display text-sm font-semibold text-sky-300">Day · ~07:15 – 17:45</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Bright sky &amp; sun overhead. Spans roughly a ~155° longitude band on Earth’s sunlit side.
                </p>
              </div>
              <div className="rounded-2xl border border-amber-300/25 bg-space-800 p-3.5">
                <p className="font-display text-sm font-semibold text-amber-300">Dusk · ~05:15–07:15 &amp; 17:45–20:00</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Golden-hour sky — the sharpest longitude clue in the game! Only two narrow ~30° strips on Earth (sunrise &amp; sunset) qualify.
                </p>
              </div>
              <div className="rounded-2xl bg-space-800 p-3.5">
                <p className="font-display text-sm font-semibold text-violet-300">Night · ~20:00 – 05:15</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Starry dark sky. Immediately rules out the entire daytime half of Earth.
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-subtle">
              Tip: Click your explorer (or the <strong className="text-cream">Explorer note</strong> button on desktop)
              for spoken notes summarizing sky lighting, weather, wind band, temperature band, and biome.
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {BIOMES.map((biome) => (
              <div key={biome.name} className="surface-flat flex items-start gap-3 p-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-lime-400/15 text-lime-300">
                  <Icon name={biome.icon} size={18} />
                </span>
                <div>
                  <h3 className="font-display text-sm font-semibold text-cream">{biome.name}</h3>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">{biome.clue}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* 3. Core Weather Readouts */}
        <motion.section id="core-weather" variants={staggerItem} className="scroll-mt-20">
          <SectionHeading
            eyebrow="Always visible"
            title="Core weather readouts"
            subtitle="Shown from second zero in every difficulty, pulled live and never older than 120 minutes."
          />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {CORE_METRICS.map((metric) => (
              <MetricCard key={metric.name} metric={metric} />
            ))}
          </div>
        </motion.section>

        {/* 4. Station Dossier (Unlocked) */}
        <motion.section id="dossier" variants={staggerItem} className="scroll-mt-20">
          <SectionHeading
            eyebrow="Station Dossier"
            title="Every unlockable clue explained"
            subtitle="Free on Easy, −100 pts on Medium, and −20 seconds on Hard. This is where most big score jumps come from."
          />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {DOSSIER_METRICS.map((metric) => (
              <MetricCard key={metric.name} metric={metric} />
            ))}
          </div>
        </motion.section>

        {/* 5. Signature Climate Combos */}
        <motion.section id="archetypes" variants={staggerItem} className="scroll-mt-20">
          <SectionHeading
            eyebrow="Pattern recognition"
            title="Signature climate combos"
            subtitle="When several clues line up at once, you can recognize an entire climate zone in seconds."
          />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {ARCHETYPES.map((arch) => (
              <div key={arch.name} className="surface flex flex-col gap-2 p-5">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className={`font-display text-lg font-semibold ${arch.accent}`}>{arch.name}</h3>
                </div>
                <p className="text-xs font-bold text-subtle">e.g. {arch.examples}</p>
                <p className="rounded-xl bg-space-800 px-3 py-2 font-mono text-xs text-cream">
                  {arch.signature}
                </p>
                <p className="text-xs leading-relaxed text-muted">{arch.why}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* 6. Modes, Unlock Economics & Strategy */}
        <motion.section id="strategy" variants={staggerItem} className="scroll-mt-20">
          <SectionHeading
            eyebrow="Meta & rules"
            title="Modes, unlock economics & scoring strategy"
            subtitle="Knowing the rules turns close calls into consistent 4,000+ point rounds."
          />

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="surface p-5">
              <h3 className="font-display text-base font-semibold text-lime-300">
                When to unlock the Station Dossier
              </h3>
              <ul className="mt-2.5 flex flex-col gap-2 text-xs leading-relaxed text-muted sm:text-sm">
                <li>
                  <strong className="text-cream">Easy (Free):</strong> Always read it — Elevation, Peak UV, and Δ° are already unlocked for you.
                </li>
                <li>
                  <strong className="text-cream">Medium (−100 pts):</strong> On the 0–5,000 curve, 100 points equals roughly{' '}
                  <strong className="text-cream">400 km</strong> of distance. If unlocking saves you from guessing the wrong continent or mountain range, it pays for itself 5×–10× over.
                </li>
                <li>
                  <strong className="text-cream">Hard (−20 s):</strong> Unlock early (within the first 20 seconds) if the core weather is ambiguous — waiting until 30 seconds left leaves too little time to inspect the map.
                </li>
              </ul>
            </div>

            <div className="surface p-5">
              <h3 className="font-display text-base font-semibold text-amber-300">
                Best-of-N hedging &amp; timeout safety
              </h3>
              <ul className="mt-2.5 flex flex-col gap-2 text-xs leading-relaxed text-muted sm:text-sm">
                <li>
                  <strong className="text-cream">Split your bets:</strong> On Easy (3 tries) and Medium (2 tries), intermediate submissions don’t reveal the answer, and your <strong className="text-cream">closest submitted bet scores</strong>. When torn between sunrise vs. sunset (or two similar regions), place one bet in each rather than clustering pins together.
                </li>
                <li>
                  <strong className="text-cream">Changing pins is free:</strong> Clicking around the map never uses an attempt until you press Submit guess or Final submit.
                </li>
                <li>
                  <strong className="text-cream">Timeout safety net:</strong> If time runs out, your best submitted guess counts — or if you submitted none, your last selected pin is evaluated automatically.
                </li>
              </ul>
            </div>

            <div className="surface p-5">
              <h3 className="font-display text-base font-semibold text-sky-300">
                Distance &amp; scoring math
              </h3>
              <ul className="mt-2.5 flex flex-col gap-2 text-xs leading-relaxed text-muted sm:text-sm">
                <li>
                  <strong className="text-cream">Haversine distance:</strong> Measured along Earth’s curve in km (rounded to 1 decimal place).
                </li>
                <li>
                  <strong className="text-cream">Full score:</strong> Landing within{' '}
                  <strong className="text-lime-300">{formatScore(rules?.scoring.fullScoreKm ?? 100)} km</strong> earns{' '}
                  <strong className="text-lime-300">{formatScore(rules?.scoring.maxScore ?? 5000)} pts</strong>.
                </li>
                <li>
                  <strong className="text-cream">Linear decay:</strong> Points decrease smoothly to 0 at{' '}
                  {formatScore(rules?.scoring.zeroScoreKm ?? 20000)} km (~251 pts per 1,000 km). Point deductions (like Medium’s −100 pts) subtract from your round score down to a minimum of 0.
                </li>
              </ul>
            </div>

            <div className="surface p-5">
              <h3 className="font-display text-base font-semibold text-violet-300">
                Singleplayer vs. Multiplayer
              </h3>
              <ul className="mt-2.5 flex flex-col gap-2 text-xs leading-relaxed text-muted sm:text-sm">
                <li>
                  <strong className="text-cream">Singleplayer:</strong> Play a fixed round count or endless mode and review each round at your own pace.
                </li>
                <li>
                  <strong className="text-cream">Multiplayer ({minPlayers}–{maxPlayers} players):</strong> Create or join a lobby with a code. Every player gets the exact same target location and difficulty; scores stay private while playing, then reveal together on one map with a 15-second review timer (or advance immediately once everyone clicks Continue).
                </li>
              </ul>
            </div>
          </div>
        </motion.section>

        {/* Bottom CTA */}
        <motion.div variants={staggerItem} className="surface flex flex-col items-center gap-4 p-6 text-center sm:p-8">
          <h2 className="font-display text-2xl font-semibold text-cream">Put it into practice</h2>
          <p className="max-w-md text-sm text-muted">
            Try the 2-round guided tutorial to see these clues live in the 3D diorama, or jump straight into a match.
          </p>
          <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
            <Button size="lg" icon="compass" to="/how-to-play/tutorial">
              Start interactive tutorial
            </Button>
            <Button size="lg" variant="secondary" icon="play" to="/singleplayer">
              Singleplayer
            </Button>
            <Button size="lg" variant="secondary" icon="users" to="/multiplayer">
              Multiplayer
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}

function SectionHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-1 font-display text-2xl font-semibold text-cream">{title}</h2>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">{subtitle}</p>
    </div>
  )
}

function MetricCard({ metric }: { metric: MetricDoc }) {
  return (
    <article className="surface-flat flex flex-col gap-2.5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-lime-400/15 text-lime-300">
            <Icon name={metric.icon} size={18} />
          </span>
          <div>
            <h3 className="font-display text-base font-semibold text-cream">{metric.name}</h3>
            <p className="text-[11px] font-bold uppercase tracking-wider text-subtle">{metric.unit}</p>
          </div>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-muted">{metric.whatItShows}</p>
      <p className="text-xs leading-relaxed text-cream/90">{metric.howToUseIt}</p>
      <ul className="mt-auto flex flex-col gap-1 border-t border-white/8 pt-2.5 text-[11px] text-subtle">
        {metric.benchmarks.map((item) => (
          <li key={item} className="flex items-start gap-1.5">
            <span className="mt-1 size-1.5 shrink-0 rounded-full bg-lime-400/70" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </article>
  )
}
