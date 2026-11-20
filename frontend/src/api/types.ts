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

// --- Lobbies (R16) -------------------------------------------------------

export type LobbyStatus = 'waiting' | 'playing' | 'finished'

export interface LobbyRulesDTO {
  timeLimitSeconds: number
  attemptsPerRound: number
  selectionMode: SelectionMode
}

export interface LobbyMemberDTO {
  displayName: string | null
  isHost: boolean
  joinedAt: string
}

export interface LobbyDTO {
  lobbyId: string
  code: string
  difficulty: Difficulty
  status: LobbyStatus
  roundsTotal: number
  rules: LobbyRulesDTO
  createdAt: string
  expiresAt: string
  members: LobbyMemberDTO[]
  /** True when the caller presented the host's lobby token. */
  youAreHost: boolean
}

export interface LobbySessionDTO {
  lobby: LobbyDTO
  lobbyToken: string
}

export interface LobbyMatchCandidate {
  id: string
  name: string
  region: string
  lat: number
  lon: number
}

export interface LobbyMatchRound {
  id: string
  number: number
  panoId: string
  candidates?: LobbyMatchCandidate[]
}

export interface LobbyMatchParticipantGuess {
  displayName: string | null
  isHost: boolean
  isYou: boolean
  guess: LatLon | null
  distanceKm: number | null
  score: number
  /** Easy mode: the candidate city they picked; null on map placements. */
  answer: string | null
}

export interface LobbyMatchResult {
  roundNumber: number
  score: number
  distanceKm: number | null
  guess: LatLon | null
  actual: LatLon
  attemptsUsed: number
  guesses: LobbyMatchParticipantGuess[]
}

export interface LobbyMatchLeaderboardEntry {
  rank: number
  displayName: string | null
  isHost: boolean
  isYou: boolean
  totalScore: number
  roundsCompleted: number
}

export interface LobbyContinuePromptDTO {
  deadline: string
  readyPlayers: string[]
  pendingPlayers: string[]
  youRequested: boolean
}

export interface LobbyMatchDTO {
  status: LobbyStatus
  currentRound: number | null
  roundsTotal: number
  difficulty: Difficulty
  rules: LobbyRulesDTO
  startedAt: string | null
  endsAt: string | null
  round: LobbyMatchRound | null
  roundComplete: boolean
  pendingPlayers: string[]
  you: {
    attemptsUsed: number
    attemptsTotal: number
    selection: LatLon | null
    finalized: boolean
    result: LobbyMatchResult | null
  }
  leaderboard: LobbyMatchLeaderboardEntry[]
  results: LobbyMatchResult[]
  continuePrompt: LobbyContinuePromptDTO | null
}

export interface LobbyMatchResponseDTO {
  lobby: LobbyDTO
  match: LobbyMatchDTO
}

export interface LobbyGuessResponseDTO {
  finalized: boolean
  attemptsRemaining: number
  result?: LobbyMatchResult
}

// --- Auth / account -------------------------------------------------------

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
  emailVerificationAvailable: boolean
}

export interface RegisterInput {
  email: string
  password: string
  displayName: string
}

export interface RegisterResponse {
  user: PublicUser
  /** True when a verification email was sent and sign-in is blocked until confirmed. */
  verificationRequired: boolean
}

export interface LoginInput {
  email: string
  password: string
}

export interface EmailChangeRequestResponse {
  message: string
  pendingEmail: string
}

export interface EmailChangeConfirmation {
  side: 'old' | 'new'
  changed: boolean
  email?: string
  pending: 'old' | 'new' | null
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
