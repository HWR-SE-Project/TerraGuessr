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

import { authMock } from './mock/auth'
import { singleplayerMock } from './mock/singleplayer'
import { lobbyMock } from './mock/lobbies'
import { geoMock } from './mock/geo'

export const api = {
  auth: authMock,
  singleplayer: singleplayerMock,
  lobby: lobbyMock,
  geo: geoMock,
}

export type Api = typeof api
