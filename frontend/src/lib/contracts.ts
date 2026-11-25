// Typed contracts mirrored from the backend (see backend/src/contracts and
// backend/src/modules/*/routes.ts). These shapes are the single boundary
// between the UI and whatever service implementation backs it (mock in Phase 1,
// HTTP in Phase 2). Never invent a shape here that isn't backed by a real route.

export type Difficulty = 'easy' | 'medium' | 'hard'
export type SelectionMode = 'map' | 'list'
export type AdditionalDataUnlockMode = 'immediate' | 'time' | 'points'

export interface LatLon {
  lat: number
  lon: number
}

// --- Geographic intelligence ------------------------------------------------

export type WeatherCondition =
  | 'Clear sky'
  | 'Mainly clear'
  | 'Partly cloudy'
  | 'Overcast'
  | 'Fog'
  | 'Drizzle'
  | 'Freezing drizzle'
  | 'Rain'
  | 'Freezing rain'
  | 'Snow'
  | 'Snow grains'
  | 'Rain showers'
  | 'Snow showers'
  | 'Thunderstorm'

export interface GeographicIntelligence {
  fetchedAt: string
  cached: boolean
  weather: {
    modelTime: string | null
    temperatureC: number | null
    condition: WeatherCondition | null
    windSpeedKmh: number | null
    windDirectionDeg: number | null
    humidityPct: number | null
    pressureHpa: number | null
    precipitationMm: number | null
    precipitationIntervalMinutes: number | null
  } | null
  environment: {
    elevationM: number | null
    reliefM: number | null
    terrain: 'Low relief' | 'Rolling relief' | 'High relief' | null
    biome: null
    vegetation: null
  }
  climate: null
}

export interface AdditionalDataAccess {
  mode: AdditionalDataUnlockMode
  cost: number | null
  availableAt: string | null
  unlocked: boolean
  pointsSpent: number
}

export interface Candidate {
  id: string
  name: string | null
  region: string
}

export type GuessInput = LatLon | { candidateId: string }

export interface EvaluatedAttempt {
  attemptNumber: number
  guess: LatLon
  distanceKm: number
  score: number
  isBest: boolean
}

export type Biome =
  | 'desert'
  | 'forest'
  | 'mountains'
  | 'tundra'
  | 'coast'
  | 'grasslands'
  | 'urban'

export type SceneWeather = 'clear' | 'cloudy' | 'fog' | 'rain' | 'storm' | 'snow'
export type SceneLighting = 'day' | 'dusk' | 'night'
export type TemperatureBand = 'freezing' | 'cold' | 'mild' | 'warm' | 'hot'
export type WindBand = 'calm' | 'breezy' | 'windy'

export interface RoundScene {
  biome: Biome
  weather: SceneWeather
  lighting: SceneLighting
  temperatureBand: TemperatureBand
  windBand: WindBand
  seed: number
}

// --- Singleplayer -----------------------------------------------------------

export interface StreetRound {
  id: string
  number: number
  scene: RoundScene
  candidates?: Candidate[]
  // Older singleplayer servers omit these fields.
  rules?: GameRules
  selection?: LatLon | null
  selectedCandidateId?: string | null
  submittedGuesses?: LatLon[]
  submittedCandidateIds?: string[]
  startedAt: string | null
  endsAt: string | null
  attemptsUsed: number
  attemptsTotal: number
  extraData: AdditionalDataAccess
}

export interface StreetResult {
  roundId: string
  number: number
  guess: LatLon | null
  actual: LatLon
  placeName?: string | null
  distanceKm: number | null
  score: number
  extraDataPointsSpent?: number
  attempts?: EvaluatedAttempt[]
}

export interface StreetGuessResponse {
  finalized: boolean
  attemptsRemaining: number
  result?: StreetResult
}

export interface StreetSession {
  id: string
  difficulty: Difficulty
  roundsTotal?: number | null
  completed?: boolean
  totalScore: number
  activeRound: StreetRound | null
  results: StreetResult[]
}

export interface StreetCredentials {
  id: string
  playerToken: string
}

// --- Lobbies ----------------------------------------------------------------

export type LobbyStatus = 'waiting' | 'playing' | 'finished'

export interface GameRules {
  timeLimitSeconds: number
  attemptsPerRound: number
  selectionMode: SelectionMode
  countryBorders: boolean
  extraData:
    | { mode: 'free' }
    | { mode: 'points'; cost: number }
    | { mode: 'time'; cost: number }
}

export type LobbyRules = GameRules

export interface RoundBounds {
  min: number
  max: number
  default: number
}

export interface GameRulesCatalog {
  difficulties: Record<Difficulty, GameRules>
  scoring: {
    maxScore: number
    fullScoreKm: number
    zeroScoreKm: number
    exampleDistanceStepKm: number
    exampleScores: number[]
    londonParisKm: number
  }
  rounds?: RoundBounds
}

export interface LobbyMember {
  displayName: string | null
  isHost: boolean
  isYou?: boolean
  joinedAt: string
}

export interface Lobby {
  lobbyId: string
  code: string
  difficulty: Difficulty
  status: LobbyStatus
  roundsTotal: number
  rules: LobbyRules
  createdAt: string
  expiresAt: string
  members: LobbyMember[]
  youAreHost: boolean
}

export interface LobbySession {
  lobby: Lobby
  lobbyToken: string
}

export interface LobbyMatchRound {
  id: string
  number: number
  scene: RoundScene
  candidates?: Candidate[]
  endsAt: string | null
  attemptsUsed: number
  attemptsTotal: number
  extraData: AdditionalDataAccess
}

export interface LobbyParticipantGuess {
  memberId: string
  displayName: string | null
  isHost: boolean
  isYou: boolean
  guess: LatLon | null
  distanceKm: number | null
  score: number
  answer: string | null
}

export interface LobbyMatchResult {
  roundNumber: number
  score: number
  distanceKm: number | null
  guess: LatLon | null
  actual: LatLon
  placeName?: string | null
  attemptsUsed: number
  extraDataPointsSpent?: number
  attempts?: EvaluatedAttempt[]
  guesses: LobbyParticipantGuess[]
}

export interface LobbyLeaderboardEntry {
  memberId: string
  rank: number
  displayName: string | null
  isHost: boolean
  isYou: boolean
  totalScore: number
  roundsCompleted: number
}

export interface LobbyMatchContinuePrompt {
  deadline: string | null
  readyPlayers: string[]
  pendingPlayers: string[]
  youRequested: boolean
}

export interface LobbyMatch {
  matchId?: string
  status: LobbyStatus
  currentRound: number | null
  roundsTotal: number
  difficulty: Difficulty
  rules: LobbyRules
  startedAt: string | null
  endsAt: string | null
  round: LobbyMatchRound | null
  roundComplete: boolean
  reviewEndsAt: string | null
  pendingPlayers: string[]
  you: {
    attemptsUsed: number
    attemptsTotal: number
    selection: LatLon | null
    selectedCandidateId?: string | null
    submittedGuesses?: LatLon[]
    submittedCandidateIds?: string[]
    finalized: boolean
    result: LobbyMatchResult | null
  }
  leaderboard: LobbyLeaderboardEntry[]
  results: LobbyMatchResult[]
  continuePrompt?: LobbyMatchContinuePrompt | null
}

export interface LobbyMatchResponse {
  lobby: Lobby
  match: LobbyMatch
}

export interface LobbyGuessResponse {
  finalized: boolean
  attemptsRemaining: number
  attemptsUsed: number
}

// --- Auth / account ---------------------------------------------------------

export interface PublicUser {
  id: string
  email: string
  displayName: string
  emailVerifiedAt: string | null
  createdAt: string
  hasPassword?: boolean
  hasGoogle?: boolean
}

export interface UserPreferences {
  userId: string
  language: 'en' | 'de'
  soundFxVolume: number
  musicVolume: number
  fullscreen: boolean
}

export interface AuthConfig {
  googleAvailable: boolean
  passwordRecoveryAvailable: boolean
  emailVerificationAvailable: boolean
}

export interface SessionResponse {
  user: PublicUser | null
  preferences?: UserPreferences | null
}

export interface RegisterInput {
  email: string
  password: string
  displayName: string
}

export interface RegisterResponse {
  user: PublicUser
  verificationRequired: boolean
}

// --- Avatar -----------------------------------------------------------------

export const AVATAR_PARTS = [
  'hairColor',
  'eyeColor',
  'shirtColor',
  'pantsColor',
  'shoeColor',
] as const
export type AvatarPart = (typeof AVATAR_PARTS)[number]
export type AvatarConfig = { version: 1 } & Record<AvatarPart, string | null>
