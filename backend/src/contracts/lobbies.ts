/**
 * Lobby contract (R16). A lobby is a pre-game waiting room: membership plus
 * the host's difficulty. It deliberately carries no round/location data, so
 * level generation can be added later without changing these shapes.
 */

import { Type, type Static } from '@sinclair/typebox';

const Difficulty = Type.Union([
  Type.Literal('easy'),
  Type.Literal('medium'),
  Type.Literal('hard'),
]);

const LobbyStatus = Type.Union([
  Type.Literal('waiting'),
  Type.Literal('playing'),
  Type.Literal('finished'),
]);

const SelectionMode = Type.Union([
  Type.Literal('map'),
  Type.Literal('list'),
]);

/** R5 rules derived from the host's difficulty (informational until play starts). */
export const LobbyRulesView = Type.Object({
  timeLimitSeconds: Type.Integer({ minimum: 1 }),
  attemptsPerRound: Type.Integer({ minimum: 1 }),
  selectionMode: SelectionMode,
});

/** Public member summary — never exposes player tokens. */
export const LobbyMemberView = Type.Object({
  displayName: Type.Union([Type.String(), Type.Null()]),
  isHost: Type.Boolean(),
  joinedAt: Type.String(),
});

/** Public lobby view returned by create/join/get. */
export const LobbyView = Type.Object({
  lobbyId: Type.String(),
  code: Type.String(),
  difficulty: Difficulty,
  status: LobbyStatus,
  maxPlayers: Type.Integer({ minimum: 1 }),
  roundsTotal: Type.Integer({ minimum: 1 }),
  rules: LobbyRulesView,
  createdAt: Type.String(),
  expiresAt: Type.String(),
  members: Type.Array(LobbyMemberView),
  /** True when the caller presented the host's lobby token. */
  youAreHost: Type.Boolean(),
});

/** POST /api/lobbies request body. */
export const CreateLobbyBody = Type.Object({
  difficulty: Difficulty,
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

export type CreateLobbyBody = Static<typeof CreateLobbyBody>;
export type CreateLobbyResponse = Static<typeof CreateLobbyResponse>;
export type LobbyCodeParams = Static<typeof LobbyCodeParams>;
export type JoinLobbyBody = Static<typeof JoinLobbyBody>;
export type JoinLobbyResponse = Static<typeof JoinLobbyResponse>;
export type LobbyMemberView = Static<typeof LobbyMemberView>;
export type LobbyRulesView = Static<typeof LobbyRulesView>;
export type LobbyView = Static<typeof LobbyView>;
export type LobbyStatus = Static<typeof LobbyStatus>;
export type LobbyDifficulty = Static<typeof Difficulty>;
