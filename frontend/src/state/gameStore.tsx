// Global game session state: React Context + useReducer only (approved stack —
// no Redux/Zustand). Server I/O stays in src/api/client.ts.
import { createContext, useContext, useMemo, useReducer } from 'react';
import type { Dispatch, ReactNode } from 'react';
import { getPlayerToken } from '../api/client';
import type { Difficulty, GameMode } from '../api/types';

export interface GameState {
  gameId: string | null;
  playerToken: string | null;
  difficulty: Difficulty;
  mode: GameMode;
}

export type GameAction =
  | {
      type: 'game/created';
      gameId: string;
      playerToken: string;
      difficulty: Difficulty;
      mode: GameMode;
    }
  | { type: 'game/difficultySet'; difficulty: Difficulty }
  | { type: 'game/modeSet'; mode: GameMode }
  | { type: 'game/reset' };

export function createInitialGameState(): GameState {
  return {
    gameId: null,
    playerToken: getPlayerToken(),
    difficulty: 'easy',
    mode: 'solo',
  };
}

export const initialGameState: GameState = createInitialGameState();

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'game/created':
      return {
        ...state,
        gameId: action.gameId,
        playerToken: action.playerToken,
        difficulty: action.difficulty,
        mode: action.mode,
      };
    case 'game/difficultySet':
      return { ...state, difficulty: action.difficulty };
    case 'game/modeSet':
      return { ...state, mode: action.mode };
    case 'game/reset':
      return { ...initialGameState, playerToken: null };
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

const GameStateContext = createContext<GameState | null>(null);
const GameDispatchContext = createContext<Dispatch<GameAction> | null>(null);

export interface GameStoreProviderProps {
  children: ReactNode;
  /** Test seam: lets tests start from a deterministic state. */
  initialState?: GameState;
}

export function GameStoreProvider({ children, initialState }: GameStoreProviderProps) {
  // playerToken persistence to localStorage happens synchronously at the call
  // site that receives the token (App.tsx), not here. An effect-based sync
  // would only commit after this render, which raced the round-start request
  // that immediately follows game creation (P0-2) — see api/client.ts
  // setPlayerToken and the explicit playerToken propagation in App.tsx.
  const [state, dispatch] = useReducer(
    gameReducer,
    initialState ?? initialGameState,
    (value) => value,
  );

  return (
    <GameStateContext.Provider value={state}>
      <GameDispatchContext.Provider value={dispatch}>{children}</GameDispatchContext.Provider>
    </GameStateContext.Provider>
  );
}

export function useGameState(): GameState {
  const state = useContext(GameStateContext);
  if (state === null) {
    throw new Error('useGameState must be used inside a <GameStoreProvider>');
  }
  return state;
}

export function useGameDispatch(): Dispatch<GameAction> {
  const dispatch = useContext(GameDispatchContext);
  if (dispatch === null) {
    throw new Error('useGameDispatch must be used inside a <GameStoreProvider>');
  }
  return dispatch;
}

export function useGameStore(): { state: GameState; dispatch: Dispatch<GameAction> } {
  const state = useGameState();
  const dispatch = useGameDispatch();
  return useMemo(() => ({ state, dispatch }), [state, dispatch]);
}

export type { GameMode, Difficulty };
