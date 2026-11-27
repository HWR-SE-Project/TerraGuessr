/**
 * Lobby contract (R16). A lobby is a pre-game waiting room: membership plus
 * the host's difficulty and round count. It deliberately carries no location
 * data, so level generation stays server-side.
 */

import { Type, type Static } from '@sinclair/typebox';

import {
  Candidate,
  Coordinates,
  Difficulty,
  EvaluatedAttempt,
  ExtraDataAccess,
  GameRulesView,
  RoundSceneView,
  RoundsTotal,
} from './shared.js';

const LobbyStatus = Type.Union([
  Type.Literal('waiting'),
  Type.Literal('playing'),
  Type.Literal('finished'),
]);

/** Public member summary — never exposes player tokens. */
export const LobbyMemberView = Type.Object({
  displayName: Type.Union([Type.String(), Type.Null()]),
  isHost: Type.Boolean(),
  isYou: Type.Boolean(),
  joinedAt: Type.String(),
});

/** Public lobby view returned by create/join/get. */
export const LobbyView = Type.Object({
  lobbyId: Type.String(),
  code: Type.String(),
  difficulty: Difficulty,
  status: LobbyStatus,
  roundsTotal: Type.Integer({ minimum: 1 }),
  maxMembers: Type.Integer({ minimum: 2 }),
  rules: GameRulesView,
  createdAt: Type.String(),
  expiresAt: Type.String(),
  members: Type.Array(LobbyMemberView),
  /** True when the caller presented the host's lobby token. */
  youAreHost: Type.Boolean(),
});

/** POST /api/lobbies request body. */
export const CreateLobbyBody = Type.Object({
  difficulty: Difficulty,
  /** Host-selected match length; defaults to the standard five rounds. */
  roundsTotal: Type.Optional(RoundsTotal),
  displayName: Type.Optional(Type.String({ maxLength: 40 })),
}, { additionalProperties: false });

/** POST /api/lobbies → 201; the token is returned exactly once (ADR-0011). */
export const CreateLobbyResponse = Type.Object({
  lobby: LobbyView,
  lobbyToken: Type.String(),
});

/** Path params for every lobby-scoped route. */
export const LobbyCodeParams = Type.Object({
  code: Type.String({ minLength: 6, maxLength: 6, pattern: '^[A-Z0-9]{6}$' }),
});

/** POST /api/lobbies/:code/join request body. */
export const JoinLobbyBody = Type.Object({
  displayName: Type.Optional(Type.String({ maxLength: 40 })),
}, { additionalProperties: false });

/** POST /api/lobbies/:code/join → 201; issues a fresh lobby token. */
export const JoinLobbyResponse = Type.Object({
  lobby: LobbyView,
  lobbyToken: Type.String(),
});

export const LobbyCoordinates = Coordinates;

const MatchCandidate = Candidate;

/** R5 per-round additional-data access state. */
const ExtraDataAccessView = ExtraDataAccess;

const MatchRound = Type.Object({
  id: Type.String(),
  number: Type.Integer(),
  scene: RoundSceneView,
  candidates: Type.Optional(Type.Array(MatchCandidate)),
  endsAt: Type.Union([Type.String(), Type.Null()]),
  attemptsUsed: Type.Integer(),
  attemptsTotal: Type.Integer(),
  extraData: ExtraDataAccessView,
});

const MatchParticipantGuess = Type.Object({
  memberId: Type.String(),
  displayName: Type.Union([Type.String(), Type.Null()]),
  isHost: Type.Boolean(),
  isYou: Type.Boolean(),
  guess: Type.Union([LobbyCoordinates, Type.Null()]),
  distanceKm: Type.Union([Type.Number(), Type.Null()]),
  score: Type.Integer(),
  /** Easy mode: the candidate city they picked; null on map placements. */
  answer: Type.Union([Type.String(), Type.Null()]),
});

const MatchResult = Type.Object({
  roundNumber: Type.Integer(),
  score: Type.Integer(),
  distanceKm: Type.Union([Type.Number(), Type.Null()]),
  guess: Type.Union([LobbyCoordinates, Type.Null()]),
  actual: LobbyCoordinates,
  placeName: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  attemptsUsed: Type.Integer(),
  extraDataPointsSpent: Type.Integer(),
  attempts: Type.Array(EvaluatedAttempt),
  /** Every participant who has submitted this round, including the caller. */
  guesses: Type.Array(MatchParticipantGuess),
});

const MatchLeaderboardEntry = Type.Object({
  memberId: Type.String(),
  rank: Type.Integer(),
  displayName: Type.Union([Type.String(), Type.Null()]),
  isHost: Type.Boolean(),
  isYou: Type.Boolean(),
  totalScore: Type.Integer(),
  roundsCompleted: Type.Integer(),
});

const MatchYou = Type.Object({
  attemptsUsed: Type.Integer(),
  attemptsTotal: Type.Integer(),
  selection: Type.Union([LobbyCoordinates, Type.Null()]),
  selectedCandidateId: Type.Union([Type.String(), Type.Null()]),
  submittedGuesses: Type.Array(LobbyCoordinates),
  submittedCandidateIds: Type.Array(Type.String()),
  finalized: Type.Boolean(),
  result: Type.Union([MatchResult, Type.Null()]),
});

/**
 * Present while a round review is open so players can see who has chosen to
 * continue early before the shared review countdown expires (R16).
 */
const MatchReviewPrompt = Type.Object({
  readyPlayers: Type.Array(Type.String()),
  pendingPlayers: Type.Array(Type.String()),
  youReady: Type.Boolean(),
});

/**
 * Present on a finished match so players can see rematch readiness. `deadline`
 * stays null while players view final standings (R16), and starts once at least
 * one player requests a rematch so silent players never block them forever.
 */
const MatchContinuePrompt = Type.Object({
  deadline: Type.Union([Type.String(), Type.Null()]),
  readyPlayers: Type.Array(Type.String()),
  pendingPlayers: Type.Array(Type.String()),
  youRequested: Type.Boolean(),
});

export const LobbyMatchView = Type.Object({
  matchId: Type.String(),
  status: LobbyStatus,
  currentRound: Type.Union([Type.Integer(), Type.Null()]),
  roundsTotal: Type.Integer(),
  difficulty: Difficulty,
  rules: GameRulesView,
  startedAt: Type.Union([Type.String(), Type.Null()]),
  endsAt: Type.Union([Type.String(), Type.Null()]),
  round: Type.Union([MatchRound, Type.Null()]),
  roundComplete: Type.Boolean(),
  reviewEndsAt: Type.Union([Type.String(), Type.Null()]),
  reviewPrompt: Type.Union([MatchReviewPrompt, Type.Null()]),
  pendingPlayers: Type.Array(Type.String()),
  you: MatchYou,
  leaderboard: Type.Array(MatchLeaderboardEntry),
  results: Type.Array(MatchResult),
  continuePrompt: Type.Union([MatchContinuePrompt, Type.Null()]),
});

export const LobbyMatchResponse = Type.Object({
  lobby: LobbyView,
  match: LobbyMatchView,
});

export const LobbyRoundParams = Type.Object({
  code: Type.String({ minLength: 6, maxLength: 6, pattern: '^[A-Z0-9]{6}$' }),
  roundNumber: Type.Integer({ minimum: 1, maximum: 100 }),
});

export const LobbySelectionBody = Type.Union([
  Type.Object(
    {
      ...LobbyCoordinates.properties,
      roundId: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      candidateId: Type.String({ minLength: 1, maxLength: 100 }),
      roundId: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
    },
    { additionalProperties: false },
  ),
]);

export const LobbyGuessBody = Type.Union([
  Type.Object(
    {
      lat: Type.Number({ minimum: -90, maximum: 90 }),
      lon: Type.Number({ minimum: -180, maximum: 180 }),
      final: Type.Optional(Type.Boolean()),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      candidateId: Type.String({ minLength: 1, maxLength: 100 }),
      final: Type.Optional(Type.Boolean()),
    },
    { additionalProperties: false },
  ),
]);

export const LobbyGuessResponse = Type.Object({
  finalized: Type.Boolean(),
  attemptsRemaining: Type.Integer(),
  attemptsUsed: Type.Integer(),
});

export type CreateLobbyBody = Static<typeof CreateLobbyBody>;
export type CreateLobbyResponse = Static<typeof CreateLobbyResponse>;
export type LobbyCodeParams = Static<typeof LobbyCodeParams>;
export type JoinLobbyBody = Static<typeof JoinLobbyBody>;
export type JoinLobbyResponse = Static<typeof JoinLobbyResponse>;
export type LobbyMemberView = Static<typeof LobbyMemberView>;
export type LobbyRulesView = Static<typeof GameRulesView>;
export type LobbyView = Static<typeof LobbyView>;
export type LobbyStatus = Static<typeof LobbyStatus>;
export type LobbyDifficulty = Static<typeof Difficulty>;
export type LobbyCoordinates = Static<typeof LobbyCoordinates>;
export type LobbyMatchView = Static<typeof LobbyMatchView>;
export type LobbyMatchResponse = Static<typeof LobbyMatchResponse>;
export type LobbyRoundParams = Static<typeof LobbyRoundParams>;
export type LobbySelectionBody = Static<typeof LobbySelectionBody>;
export type LobbyGuessBody = Static<typeof LobbyGuessBody>;
export type LobbyGuessResponse = Static<typeof LobbyGuessResponse>;
