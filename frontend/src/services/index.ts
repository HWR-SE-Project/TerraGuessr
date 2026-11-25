// Service boundary. The UI imports only this module — never a mock or HTTP
// implementation directly. In Phase 1 it points at the mock layer; in Phase 2
// replace the mock re-exports below with an HTTP implementation that speaks
// the same contracts (lib/contracts.ts).
//
//   export const api = {
//     auth: httpAuth,          // real fetch calls, same method names
//     singleplayer: httpSingleplayer,
//     lobby: httpLobby,
//   }

import { authHttp } from './http/auth'
import { singleplayerHttp } from './http/singleplayer'
import { lobbyHttp } from './http/lobbies'
import { statsHttp } from './http/stats'
import { apiFetch } from './http/client'
import type { GameRulesCatalog } from '../lib/contracts'

export { ApiError } from './http/client'

export const api = {
  auth: authHttp,
  singleplayer: singleplayerHttp,
  lobby: lobbyHttp,
  stats: statsHttp,
  gameRules: () => apiFetch<GameRulesCatalog>('/game-rules'),
}

export type Api = typeof api
