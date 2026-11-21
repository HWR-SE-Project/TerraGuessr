// In-memory mock database. Everything here lives only for the current page
// session (a reload resets it). Clearly separated from the UI so Phase 2 can
// swap this whole layer for real HTTP calls behind the same service surface.

import type {
  AvatarConfig,
  Candidate,
  Difficulty,
  LobbyMatchResult,
  PublicUser,
  UserPreferences,
} from '../../lib/contracts'

export interface MockUser {
  id: string
  email: string
  password: string
  displayName: string
  emailVerifiedAt: string | null
  createdAt: string
  hasPassword: boolean
  hasGoogle: boolean
}

export interface MockUserPreferences {
  language: 'en' | 'de'
  soundFxVolume: number
  musicVolume: number
  fullscreen: boolean
  avatarConfig: AvatarConfig | null
}

const now = () => new Date().toISOString()

let counter = 0
export function uid(prefix: string): string {
  counter += 1
  return `${prefix}_${counter.toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

export function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

export const DEFAULT_PREFERENCES: MockUserPreferences = {
  language: 'en',
  soundFxVolume: 70,
  musicVolume: 50,
  fullscreen: false,
  avatarConfig: null,
}

export const DEFAULT_AVATAR: AvatarConfig = {
  version: 1,
  hairColor: null,
  eyeColor: null,
  shirtColor: null,
  pantsColor: null,
  shoeColor: null,
}

export const db = {
  users: new Map<string, MockUser>(),
  preferences: new Map<string, MockUserPreferences>(),
  // Maps an opaque session token to a user id.
  sessions: new Map<string, string>(),
  // email → user id lookup
  byEmail: new Map<string, string>(),
}

export function toPublicUser(user: MockUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    emailVerifiedAt: user.emailVerifiedAt,
    createdAt: user.createdAt,
    hasPassword: user.hasPassword,
    hasGoogle: user.hasGoogle,
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function toPreferences(userId: string): UserPreferences {
  const prefs = db.preferences.get(userId) ?? { ...DEFAULT_PREFERENCES }
  return {
    userId,
    language: prefs.language,
    soundFxVolume: prefs.soundFxVolume,
    musicVolume: prefs.musicVolume,
    fullscreen: prefs.fullscreen,
  }
}

export function nowIso(): string {
  return now()
}

export interface MockGame {
  id: string
  playerToken: string
  difficulty: Difficulty
  totalScore: number
  activeRound: MockRound | null
  results: MockStreetResult[]
  roundsPlayed: number
  locationHistory: string[]
}

export interface MockRound {
  id: string
  number: number
  locationId: string
  candidates: Candidate[]
  startedAt: string
  endsAt: string | null
  attemptsUsed: number
  attemptsTotal: number
  extraDataUnlocked: boolean
  extraDataPointsSpent: number
  guess: { lat: number; lon: number } | null
  result: MockStreetResult | null
}

export interface MockStreetResult {
  roundId: string
  number: number
  guess: { lat: number; lon: number } | null
  actual: { lat: number; lon: number }
  distanceKm: number | null
  score: number
  extraDataPointsSpent: number
}

export const games = new Map<string, MockGame>()

// ---------------------------------------------------------------------------
// Lobby mock state

export interface MockLobbyMember {
  id: string
  displayName: string
  isHost: boolean
  joinedAt: string
}

export interface MockLobby {
  lobbyId: string
  code: string
  difficulty: Difficulty
  status: 'waiting' | 'playing' | 'finished'
  roundsTotal: number
  createdAt: string
  expiresAt: string
  members: MockLobbyMember[]
  /** member id → token */
  tokens: Map<string, string>
  hostId: string
  // Match state (populated on start)
  match: MockMatch | null
}

export interface MockMatch {
  status: 'playing' | 'finished'
  currentRound: number
  roundsTotal: number
  startedAt: string
  rounds: Map<number, MockMatchRound>
  /** memberId → total score */
  scores: Map<string, number>
  results: LobbyMatchResult[]
  /** Timestamp when a fully-finalized round should advance (grace window). */
  advanceAt?: number
}

export interface MockMatchRound {
  id: string
  number: number
  locationId: string
  candidates: Candidate[]
  endsAt: string | null
  extraDataUnlocked: boolean
  extraDataPointsSpent: number
  /** memberId → submitted guess */
  guesses: Map<string, { lat: number; lon: number; answer: string | null }>
  /** memberId → attempts used */
  memberAttempts: Map<string, number>
  finalized: Set<string>
}

export const lobbies = new Map<string, MockLobby>()
export const lobbiesByCode = new Map<string, string>()
