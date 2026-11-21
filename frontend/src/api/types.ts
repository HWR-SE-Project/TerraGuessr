// Hand-mirrored copy of backend/src/contracts/*.ts and the auth/
// statistics route shapes. The backend owns the frozen contract — never
// invent a shape here that isn't backed by a real route.

export type Difficulty = 'easy' | 'medium' | 'hard'
export type SelectionMode = 'map' | 'list'
export type AdditionalDataUnlockMode = 'immediate' | 'time' | 'points'

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
  /** Points already deducted from this round for additional data. */
  pointsSpent: number
}

export interface CandidateDTO {
  id: string
  name: string | null
  lat: number
  lon: number
  region: string
}

// --- Lobbies (R16) -------------------------------------------------------

export type LobbyStatus = 'waiting' | 'playing' | 'finished'

export interface LobbyRulesDTO {
  timeLimitSeconds: number
  attemptsPerRound: number
  selectionMode: SelectionMode
  countryBorders: boolean
  extraData:
    | { mode: 'free' }
    | { mode: 'points'; cost: number }
    | { mode: 'time'; cost: number }
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

export interface LobbyMatchRound {
  id: string
  number: number
  panoId: string
  candidates?: CandidateDTO[]
  endsAt: string | null
  attemptsUsed: number
  attemptsTotal: number
  extraData: AdditionalDataAccessDTO
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
  extraDataPointsSpent?: number
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

export interface SessionResponse {
  user: PublicUser | null
  preferences?: UserPreferences | null
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
