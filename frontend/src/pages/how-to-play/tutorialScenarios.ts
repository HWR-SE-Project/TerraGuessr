import type {
  Candidate,
  Difficulty,
  EvaluatedAttempt,
  GeographicIntelligence,
  GuessInput,
  LatLon,
  RoundScene,
  SceneLighting,
  StreetResult,
  StreetRound,
} from '../../lib/contracts'
import { haversineKm, mockGameRules, scoreForDistance } from '../../services/mock/gameRules'

export interface TutorialCoachStep {
  id: string
  badge: string
  title: string
  body: string
  tip?: string
}

export interface TutorialScenario {
  id: string
  roundNumber: number
  difficulty: Difficulty
  modeLabel: string
  actual: LatLon
  placeName: string
  countrySummary: string
  scene: RoundScene
  candidates?: Candidate[]
  weather: NonNullable<GeographicIntelligence['weather']>
  environment: GeographicIntelligence['environment']
  /** Explanation shown on the round reveal dialog so the deduction clicks. */
  deductionSummary: string[]
  coachSteps: TutorialCoachStep[]
}

/**
 * Mirrors backend/src/domain/scene.ts `classifyLighting` so tutorial sky lighting
 * always matches the player's real live UTC clock.
 */
export function classifyTutorialLighting(lon: number, now: Date = new Date()): SceneLighting {
  const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60
  const solarHour = (((utcHours + lon / 15) % 24) + 24) % 24
  if (
    (solarHour >= 5.25 && solarHour < 7.25) ||
    (solarHour >= 17.75 && solarHour < 20.0)
  ) {
    return 'dusk'
  }
  return solarHour >= 7.25 && solarHour < 17.75 ? 'day' : 'night'
}

export function formatUtcClock(now: Date): string {
  const hh = String(now.getUTCHours()).padStart(2, '0')
  const mm = String(now.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm} UTC`
}

export function solarHourAt(lon: number, now: Date): number {
  const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60
  return (((utcHours + lon / 15) % 24) + 24) % 24
}

function lightingLabel(lighting: SceneLighting): string {
  if (lighting === 'day') return 'bright daylight'
  if (lighting === 'dusk') return 'golden-hour twilight (sunrise or sunset)'
  return 'starry night'
}

function lightingBandHint(lighting: SceneLighting, regionName: string, now: Date, lon: number): string {
  const utc = formatUtcClock(now)
  const hour = solarHourAt(lon, now)
  if (lighting === 'dusk') {
    const phase = hour < 12 ? 'sunrise' : 'sunset'
    return `At ${utc}, the sky is in ${lightingLabel(lighting)} — right on Earth’s ${phase} line! That narrow band immediately points toward ${regionName} and rules out the opposite side of the planet.`
  }
  if (lighting === 'day') {
    return `At ${utc}, this spot is in ${lightingLabel(lighting)}. Comparing that sky to the current time immediately rules out the night side of Earth and points toward ${regionName}.`
  }
  return `At ${utc}, this spot is in ${lightingLabel(lighting)}. Comparing that sky to the current time immediately rules out the sunlit side of Earth and points toward ${regionName}.`
}

const QUITO_CANDIDATES: Candidate[] = [
  { id: 'tut-quito', name: 'Quito', region: 'SOUTH_AMERICA', lat: -0.1807, lon: -78.4678 },
  { id: 'tut-manaus', name: 'Manaus', region: 'SOUTH_AMERICA', lat: -3.119, lon: -60.0217 },
  { id: 'tut-reykjavik', name: 'Reykjavik', region: 'EUROPE', lat: 64.1466, lon: -21.9426 },
  { id: 'tut-zurich', name: 'Zurich', region: 'EUROPE', lat: 47.3769, lon: 8.5417 },
  { id: 'tut-tokyo', name: 'Tokyo', region: 'ASIA', lat: 35.6762, lon: 139.6503 },
  { id: 'tut-perth', name: 'Perth', region: 'OCEANIA', lat: -31.9523, lon: 115.8613 },
]

/**
 * Builds the 2 curated practice rounds using the player's real live clock:
 *  - Round 1 (Easy): Quito, Ecuador (UTC-5, equatorial highland, mountains)
 *  - Round 2 (Medium): Singapore (UTC+8, equatorial coast — ~12.1h antipodal to Quito,
 *    guaranteeing contrasting live sky lighting across the two rounds!)
 */
export function buildTutorialScenarios(now: Date = new Date()): [TutorialScenario, TutorialScenario] {
  const modelTime = now.toISOString()

  const quitoActual: LatLon = { lat: -0.1807, lon: -78.4678 }
  const quitoLighting = classifyTutorialLighting(quitoActual.lon, now)

  const round1: TutorialScenario = {
    id: 'tutorial-round-1',
    roundNumber: 1,
    difficulty: 'easy',
    modeLabel: 'Easy · 6 cities',
    actual: quitoActual,
    placeName: 'Quito, Ecuador',
    countrySummary: 'Equatorial Andes · 2,850 m',
    scene: {
      biome: 'mountains',
      weather: 'cloudy',
      lighting: quitoLighting,
      temperatureBand: 'mild',
      windBand: 'calm',
      seed: 104729,
    },
    candidates: QUITO_CANDIDATES,
    weather: {
      modelTime,
      temperatureC: 14.2,
      condition: 'Partly cloudy',
      windSpeedKmh: 10.8,
      windDirectionDeg: 270,
      humidityPct: 68,
      pressureHpa: 1015,
      precipitationMm: 0.0,
      precipitationIntervalMinutes: 60,
      dewPointC: 8.4,
      cloudCoverPct: 54,
      windGustKmh: 16.2,
      uvIndex: quitoLighting === 'day' ? 9.8 : 0,
      uvIndexMax24h: 11.2,
      tempMin24hC: 9.1,
      tempMax24hC: 19.3,
      precipitation24hMm: 1.8,
      fogPct: 0,
      thunderProbabilityPct: 0,
    },
    environment: {
      elevationM: 2850,
      reliefM: 840,
      terrain: 'High relief',
      biome: null,
      vegetation: null,
    },
    deductionSummary: [
      `Sky lighting (${lightingLabel(quitoLighting)} at ${formatUtcClock(now)}) ruled out the opposite hemisphere’s longitude band (Tokyo & Perth).`,
      '14.2°C looks cool, but Peak UV 11.2 (Extreme) + 2,850 m elevation + Mountains biome point straight to an equatorial highland — Quito, not sea-level Manaus or low-UV Reykjavik/Zurich.',
    ],
    coachSteps: [
      {
        id: 'r1-sky-biome',
        badge: 'Clue 1 · Sky & Biome',
        title: 'Start with the 3D scene',
        body: `${lightingBandHint(quitoLighting, 'the Americas', now, quitoActual.lon)} The steep peaks tell you the biome is Mountains — drag to orbit the island or click your explorer for quick notes.`,
        tip: 'Rule of thumb: Sky lighting slices East–West (longitude); the biome filters terrain.',
      },
      {
        id: 'r1-dossier',
        badge: 'Clue 2 · Weather & Elevation',
        title: 'Cool air + Extreme UV = High altitude',
        body: 'Check Geographic intelligence on the left. On Easy, the Station Dossier is free! 14.2°C feels crisp, yet Peak UV is 11.2 (Extreme) and Elevation is 2,850 m. Only an equatorial mountain city fits — ruling out hot lowland Manaus and low-UV European cities.',
        tip: 'Never assume cool = far north without checking Elevation and Peak UV first.',
      },
      {
        id: 'r1-guess',
        badge: 'Action · Pick & Submit',
        title: 'Select a city & try Best-of-3',
        body: 'In Pick a city, click any marker to select it — switching picks is always free before submitting. Submit guess places 1 of your 3 bets without revealing the answer (great for hedging); Final submit locks in and reveals immediately.',
        tip: 'Try submitting a guess or clicking Final submit to reveal Round 1.',
      },
    ],
  }

  const singaporeActual: LatLon = { lat: 1.3521, lon: 103.8198 }
  const singaporeLighting = classifyTutorialLighting(singaporeActual.lon, now)

  const round2: TutorialScenario = {
    id: 'tutorial-round-2',
    roundNumber: 2,
    difficulty: 'medium',
    modeLabel: 'Medium · World map',
    actual: singaporeActual,
    placeName: 'Singapore',
    countrySummary: 'Equatorial Southeast Asia · 15 m',
    scene: {
      biome: 'coast',
      weather: 'rain',
      lighting: singaporeLighting,
      temperatureBand: 'hot',
      windBand: 'calm',
      seed: 229403,
    },
    weather: {
      modelTime,
      temperatureC: 30.4,
      condition: 'Rain showers',
      windSpeedKmh: 9.4,
      windDirectionDeg: 185,
      humidityPct: 84,
      pressureHpa: 1009,
      precipitationMm: 2.4,
      precipitationIntervalMinutes: 60,
      dewPointC: 27.1,
      cloudCoverPct: 78,
      windGustKmh: 15.1,
      uvIndex: singaporeLighting === 'day' ? 8.6 : 0,
      uvIndexMax24h: 11.5,
      tempMin24hC: 26.2,
      tempMax24hC: 31.1,
      precipitation24hMm: 14.6,
      fogPct: 0,
      thunderProbabilityPct: 35,
    },
    environment: {
      elevationM: 15,
      reliefM: 18,
      terrain: 'Low relief',
      biome: null,
      vegetation: null,
    },
    deductionSummary: [
      `Notice the sky flipped to ${lightingLabel(singaporeLighting)} — roughly 12 hours opposite Quito, putting you in Asia–Pacific.`,
      '30.4°C, 84% humidity, Coast biome, 15 m elevation, Peak UV 11.5, and a tiny 24h temp swing (Δ5°) are the signature of an equatorial coastal hub like Singapore.',
    ],
    coachSteps: [
      {
        id: 'r2-sky-coast',
        badge: 'Clue 1 · Opposite Sky',
        title: 'Medium mode: open world map',
        body: `${lightingBandHint(singaporeLighting, 'Asia–Pacific', now, singaporeActual.lon)} Combined with 30.4°C, 84% humidity, rain showers, and a Coast biome, you’re already narrowed to humid tropical coasts in the Eastern Hemisphere.`,
        tip: 'In live games, pair temperature with today’s month too — summer in the Southern Hemisphere flips north and south.',
      },
      {
        id: 'r2-unlock',
        badge: 'Clue 2 · Paid Dossier',
        title: 'Unlock the Station Dossier (−100 pts)',
        body: 'On Medium, extra clues start locked and cost 100 points (on Hard they cost 20 seconds instead). Click "Unlock · −100 pts" in Geographic intelligence to check Elevation, 24h temp range, and Peak UV.',
        tip: '100 points is only ~400 km on the score curve — unlocking almost always pays for itself when you’re unsure.',
      },
      {
        id: 'r2-pin',
        badge: 'Action · Drop Your Pin',
        title: 'Tiny Δ5° swing + 15 m coast = Equatorial Asia',
        body: 'Look at that tiny 24h swing (26°–31°C, Δ5°), 15 m sea-level elevation, and Peak UV 11.5 — inland deserts swing 15–20°C+, while equatorial islands stay warm all night. Click anywhere on the map in Place your pin and submit!',
        tip: 'Medium gives you 2 attempts (Best-of-2). Your closest submitted pin scores, even if time runs out.',
      },
    ],
  }

  return [round1, round2]
}

export function buildTutorialRoundView(
  scenario: TutorialScenario,
  state: {
    unlocked: boolean
    pointsSpent: number
    attemptsUsed: number
    submittedGuesses: LatLon[]
    submittedCandidateIds: string[]
  },
): Omit<StreetRound, 'startedAt'> {
  const rules = mockGameRules(scenario.difficulty)
  const extraMode =
    rules.extraData.mode === 'free'
      ? 'immediate'
      : rules.extraData.mode
  const extraCost = rules.extraData.mode === 'free' ? null : rules.extraData.cost

  return {
    id: scenario.id,
    number: scenario.roundNumber,
    scene: scenario.scene,
    candidates: scenario.candidates,
    rules,
    selection: null,
    selectedCandidateId: null,
    submittedGuesses: state.submittedGuesses,
    submittedCandidateIds: state.submittedCandidateIds,
    endsAt: null,
    attemptsUsed: state.attemptsUsed,
    attemptsTotal: rules.attemptsPerRound,
    extraData: {
      mode: extraMode,
      cost: extraCost,
      availableAt: null,
      unlocked: state.unlocked,
      pointsSpent: state.pointsSpent,
    },
  }
}

export function buildTutorialIntelligence(
  scenario: TutorialScenario,
  unlocked: boolean,
): GeographicIntelligence {
  if (!unlocked) {
    return {
      fetchedAt: scenario.weather.modelTime ?? new Date().toISOString(),
      cached: true,
      weather: {
        modelTime: scenario.weather.modelTime,
        temperatureC: scenario.weather.temperatureC,
        condition: scenario.weather.condition,
        windSpeedKmh: scenario.weather.windSpeedKmh,
        windDirectionDeg: scenario.weather.windDirectionDeg,
        humidityPct: scenario.weather.humidityPct,
        pressureHpa: null,
        precipitationMm: scenario.weather.precipitationMm,
        precipitationIntervalMinutes: scenario.weather.precipitationIntervalMinutes,
      },
      environment: {
        elevationM: null,
        reliefM: null,
        terrain: null,
        biome: null,
        vegetation: null,
      },
      climate: null,
    }
  }

  return {
    fetchedAt: scenario.weather.modelTime ?? new Date().toISOString(),
    cached: true,
    weather: scenario.weather,
    environment: scenario.environment,
    climate: null,
  }
}

export function resolveChoicePoint(scenario: TutorialScenario, choice: GuessInput): LatLon | null {
  if ('candidateId' in choice) {
    const match = scenario.candidates?.find((c) => c.id === choice.candidateId)
    if (match && typeof match.lat === 'number' && typeof match.lon === 'number') {
      return { lat: match.lat, lon: match.lon }
    }
    return null
  }
  return { lat: choice.lat, lon: choice.lon }
}

export function evaluateTutorialRound(
  scenario: TutorialScenario,
  submittedPoints: LatLon[],
  pointsSpent: number,
): StreetResult {
  if (submittedPoints.length === 0) {
    return {
      roundId: scenario.id,
      number: scenario.roundNumber,
      guess: null,
      actual: scenario.actual,
      placeName: scenario.placeName,
      distanceKm: null,
      score: 0,
      extraDataPointsSpent: pointsSpent,
      attempts: [],
    }
  }

  const rawAttempts = submittedPoints.map((guess, index) => {
    const distanceKm = haversineKm(guess, scenario.actual)
    return {
      attemptNumber: index + 1,
      guess,
      distanceKm,
      score: scoreForDistance(distanceKm),
    }
  })

  let bestIndex = 0
  for (let i = 1; i < rawAttempts.length; i++) {
    if (rawAttempts[i]!.distanceKm < rawAttempts[bestIndex]!.distanceKm) {
      bestIndex = i
    }
  }

  const attempts: EvaluatedAttempt[] = rawAttempts.map((entry, index) => ({
    ...entry,
    isBest: index === bestIndex,
  }))
  const best = attempts[bestIndex]!
  const finalScore = Math.max(0, best.score - pointsSpent)

  return {
    roundId: scenario.id,
    number: scenario.roundNumber,
    guess: best.guess,
    actual: scenario.actual,
    placeName: scenario.placeName,
    distanceKm: best.distanceKm,
    score: finalScore,
    extraDataPointsSpent: pointsSpent,
    attempts,
  }
}
