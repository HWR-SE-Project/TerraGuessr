// Hand-mirrored copy of backend/src/contracts/*.ts and the auth/daily/
// statistics route shapes. The backend owns the frozen contract — never
// invent a shape here that isn't backed by a real route.

export type Difficulty = 'easy' | 'medium' | 'hard'
export type GameMode = 'solo' | 'challenge'
export type SelectionMode = 'map' | 'list'
export type AdditionalDataUnlockMode = 'immediate' | 'time' | 'points'
export type Continent = 'AFRICA' | 'EUROPE' | 'ASIA' | 'NORTH_AMERICA' | 'SOUTH_AMERICA' | 'OCEANIA'

export interface LatLon {
  lat: number
  lon: number
}

export interface ErrorDTO {
  error: { code: string; message: string; details?: Record<string, unknown> }
}

export interface AdditionalDataAccessDTO {
  mode: AdditionalDataUnlockMode
  cost: number | null
  availableAt: string | null
  unlocked: boolean
}

/** Exactly these four metrics are always present; the rest are optionally null. */
export interface WeatherDTO {
  temperatureC: number
  precipitationMm: number
  humidityPct: number
  windSpeedKmh: number
  airPressureHpa: number | null
  windDirectionDeg: number | null
  uvIndex: number | null
  sunshineDurationSeconds: number | null
  localTime: string | null
}

export interface CandidateDTO {
  id: string
  name: string | null
  lat: number
  lon: number
  region: string
}

// --- Games / Rounds / Results -----------------------------------------

export interface CreateGameInput {
  mode: GameMode
  difficulty: Difficulty
  roundsTotal?: number
  geography?: 'world' | Continent
  candidateCount?: number
  attemptsPerRound?: number
  additionalDataUnlockMode?: AdditionalDataUnlockMode
  additionalDataUnlockCost?: number
}

export interface CreateGameResponse {
  gameId: string
  playerToken: string
  roundsTotal: number
  attemptsPerRound: number
  additionalDataUnlockMode: AdditionalDataUnlockMode
  additionalDataUnlockCost: number | null
}

export interface GameSummary {
  gameId: string
  mode: GameMode
  difficulty: Difficulty
  roundsTotal: number
  attemptsPerRound: number
  status: 'active' | 'completed'
  roundsPlayed: number
  currentRound: { roundId: string; roundNumber: number; status: 'active' | 'completed' } | null
}

export interface RoundDTO {
  roundId: string
  roundNumber: number
  attemptsTotal: number
  difficulty: Difficulty
  selectionMode: SelectionMode
  weather: WeatherDTO
  additionalData: AdditionalDataAccessDTO
  candidates?: CandidateDTO[]
}

export interface GuessResultDTO {
  resultId: string
  distanceKm: number
  score: number
  actual: LatLon
}

export interface ResultDTO {
  resultId: string
  roundNumber: number
  distanceKm: number
  score: number
  actual: LatLon
  guess: LatLon
  createdAt: string
}

export interface GameResultsDTO {
  results: ResultDTO[]
  totalScore: number
}

// --- Challenges (async "duels") -----------------------------------------

export interface ChallengeDTO {
  challengeId: string
  shareUrl: string
}

export interface JoinedChallengeRound {
  gameId: string
  playerToken: string
  round: RoundDTO
}

export interface ChallengeEntryDTO {
  entryId: string
  rank: number
}

export interface LeaderboardEntryDTO {
  rank: number
  displayName: string | null
  score: number
  distanceKm: number
}

export interface LeaderboardDTO {
  challengeId: string
  entries: LeaderboardEntryDTO[]
}

// --- Auth / account -------------------------------------------------------

export interface PublicUser {
  id: string
  email: string
  displayName: string
  emailVerifiedAt: string | null
  createdAt: string
}

export interface UserPreferences {
  userId: string
  language: 'en' | 'de'
  soundFxVolume: number
  musicVolume: number
  fullscreen: boolean
}

export interface DailyStreak {
  current: number
  longest: number
}

export interface SessionResponse {
  user: PublicUser | null
  preferences?: UserPreferences | null
  dailyStreak?: DailyStreak
}

export interface AuthConfigResponse {
  googleAvailable: boolean
  passwordRecoveryAvailable: boolean
}

export interface RegisterInput {
  email: string
  password: string
  displayName: string
}

export interface LoginInput {
  email: string
  password: string
}

// --- Daily challenge -------------------------------------------------------

export interface DailyRoundView {
  roundId: string
  roundNumber: number
  attemptsTotal: number
  difficulty: Difficulty
  selectionMode: SelectionMode
  additionalData: AdditionalDataAccessDTO
  weather: WeatherDTO
}

export interface DailyResultDTO {
  resultId: string
  distanceKm: number
  score: number
  guess: LatLon
  actual: LatLon
}

export interface DailyTodayResponse {
  date: string
  status: 'open' | 'completed'
  round: DailyRoundView
  result?: DailyResultDTO
}

export interface DailyGuessResponse {
  date: string
  result: DailyResultDTO
}

export interface DailyLeaderboardEntry {
  rank: number
  displayName: string
  score: number
  distanceKm: number
  isCurrentUser: boolean
}

export interface DailyLeaderboardResponse {
  date: string
  entries: DailyLeaderboardEntry[]
  total: number
  offset: number
  limit: number
  myRank: number | null
}

// --- Statistics -------------------------------------------------------

export type StatisticsMode = 'solo' | 'multiplayer' | 'ranked' | 'daily'

export interface StatisticsEntry {
  id: string
  date: string
  roundNumber: number
  locationName: string | null
  actual: LatLon
  guess: LatLon
  score: number
  distanceKm: number
  createdAt: string
}

export interface StatisticsResponse {
  mode: StatisticsMode
  available: boolean
  entries: StatisticsEntry[]
  total: number
  offset: number
  limit: number
  averageScore: number | null
  averageDistanceKm: number | null
}
