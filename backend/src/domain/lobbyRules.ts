/**
 * @deprecated Import from `domain/gameRules.ts` instead. Kept as a thin alias
 * so older lobby code/tests keep working during the shared-rules migration.
 */

export type {
  GameDifficulty as LobbyDifficulty,
  GameRules as LobbyRules,
} from './gameRules.js';
export { gameRulesFor as lobbyRulesFor } from './gameRules.js';
