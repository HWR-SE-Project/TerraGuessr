import type { GuessResultDTO, RoundDTO } from '../../api/types';

export type RoundStatus = 'loading' | 'ready' | 'submitting' | 'revealed' | 'error';

export interface RoundState {
  status: RoundStatus;
  round: RoundDTO | null;
  result: GuessResultDTO | null;
  error: string | null;
}

export type RoundAction =
  | { type: 'round/loadStarted' }
  | { type: 'round/loaded'; round: RoundDTO }
  | { type: 'round/loadFailed'; message: string }
  | { type: 'round/submitStarted' }
  | { type: 'round/submitted'; result: GuessResultDTO }
  | { type: 'round/submitFailed'; message: string };

export function createInitialRoundState(): RoundState {
  return { status: 'loading', round: null, result: null, error: null };
}

export function roundReducer(state: RoundState, action: RoundAction): RoundState {
  switch (action.type) {
    case 'round/loadStarted':
      return { ...state, status: 'loading', error: null };
    case 'round/loaded':
      return { ...state, status: 'ready', round: action.round, error: null };
    case 'round/loadFailed':
      return { ...state, status: 'error', error: action.message };
    case 'round/submitStarted':
      return { ...state, status: 'submitting', error: null };
    case 'round/submitted':
      return { ...state, status: 'revealed', result: action.result };
    case 'round/submitFailed':
      return { ...state, status: 'ready', error: action.message };
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
