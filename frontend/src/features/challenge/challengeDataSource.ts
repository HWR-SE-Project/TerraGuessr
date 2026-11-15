// R16 async challenges (ADR-0005) — server I/O for the challenge UI.
// Every call goes through api/client.ts, so the X-Player-Token header and the
// ADR-0009 ApiError mapping stay in one place. A deterministic stub keeps the
// UI and tests runnable without a backend.
import { apiFetch } from '../../api/client';
import { apiGameDataSource } from '../../api/gameDataSource';
import type {
  ChallengeDTO,
  ChallengeEntryDTO,
  GuessResultDTO,
  LatLon,
  LeaderboardDTO,
  RoundDTO,
  SelectionMode,
} from '../../api/types';

/** POST /api/challenges/{challengeId}/entries body (displayName <= 40 chars, no PII). */
export interface JoinChallengeInput {
  resultId: string;
  displayName?: string;
}

/** POST /api/challenges/{challengeId}/join → 201 (P0-3). */
export interface JoinedChallengeRound {
  gameId: string;
  playerToken: string;
  round: RoundDTO;
}

export interface ChallengeDataSource {
  createChallenge(roundId: string): Promise<ChallengeDTO>;
  /** P0-3: issues an independent player a round pinned to this challenge's location/weather. */
  startChallengeRound(
    challengeId: string,
    selectionMode?: SelectionMode,
  ): Promise<JoinedChallengeRound>;
  /** Same endpoint solo games use (`/api/rounds/:roundId/guess`) — mode-agnostic. */
  submitGuess(roundId: string, guess: LatLon): Promise<GuessResultDTO>;
  /** Attaches an already-owned result to the challenge's public leaderboard. */
  submitEntry(challengeId: string, input: JoinChallengeInput): Promise<ChallengeEntryDTO>;
  getLeaderboard(challengeId: string): Promise<LeaderboardDTO>;
}

export const apiChallengeDataSource: ChallengeDataSource = {
  async createChallenge(roundId) {
    return apiFetch<ChallengeDTO>('/challenges', { method: 'POST', body: { roundId } });
  },
  async startChallengeRound(challengeId, selectionMode) {
    // No token exists yet for this participant (ADR-0011), same as createGame.
    return apiFetch<JoinedChallengeRound>(
      '/challenges/' + encodeURIComponent(challengeId) + '/join',
      {
        method: 'POST',
        body: selectionMode ? { selectionMode } : {},
        playerToken: null,
      },
    );
  },
  async submitGuess(roundId, guess) {
    return apiGameDataSource.submitGuess(roundId, guess);
  },
  async submitEntry(challengeId, input) {
    return apiFetch<ChallengeEntryDTO>(
      '/challenges/' + encodeURIComponent(challengeId) + '/entries',
      { method: 'POST', body: input },
    );
  },
  async getLeaderboard(challengeId) {
    // Public endpoint (B.6). apiFetch still attaches the stored token when one
    // exists; the backend ignores it for this route.
    return apiFetch<LeaderboardDTO>(
      '/challenges/' + encodeURIComponent(challengeId) + '/leaderboard',
    );
  },
};

// ---------------------------------------------------------------------------
// Stub data source: deterministic, in-memory, no network.
// ---------------------------------------------------------------------------

const STUB_CHALLENGE_ID = 'stub-challenge-1';
const STUB_SHARE_URL = 'https://terraguessr.example/c/' + STUB_CHALLENGE_ID;

const STUB_LEADERBOARD_ENTRIES = [
  { rank: 1, displayName: 'Ada', score: 4800, distanceKm: 12.4 },
  { rank: 2, displayName: 'Grace', score: 4120, distanceKm: 88.6 },
  { rank: 3, displayName: null, score: 3550, distanceKm: 210.9 },
];

export const stubChallenge: ChallengeDTO = {
  challengeId: STUB_CHALLENGE_ID,
  shareUrl: STUB_SHARE_URL,
};

const STUB_JOINED_ACTUAL: LatLon = { lat: 41.9028, lon: 12.4964 };

/**
 * In-memory stub. Entries inserted through submitEntry() show up on the next
 * getLeaderboard() call, which lets a single test cover create -> join -> list.
 */
export function createStubChallengeDataSource(
  overrides: Partial<ChallengeDataSource> = {},
): ChallengeDataSource {
  let entries = STUB_LEADERBOARD_ENTRIES.map((entry) => ({ ...entry }));
  let joinedRounds = 0;

  return {
    async createChallenge() {
      return { ...stubChallenge };
    },
    async startChallengeRound(_challengeId, selectionMode = 'list') {
      joinedRounds += 1;
      return {
        gameId: 'stub-joined-game-' + joinedRounds,
        playerToken: 'stub-joined-token-' + joinedRounds,
        round: {
          roundId: 'stub-joined-round-' + joinedRounds,
          roundNumber: 1,
          attemptsTotal: 1,
          difficulty: 'easy',
          selectionMode,
          weather: { temperatureC: 18, precipitationMm: 0, humidityPct: 55, windSpeedKmh: 7 },
          candidates:
            selectionMode === 'list'
              ? [{ id: 'c-rome', name: 'Rome', lat: 41.9028, lon: 12.4964, region: 'EUROPE' }]
              : undefined,
        },
      };
    },
    async submitGuess(roundId, guess) {
      const dx = guess.lat - STUB_JOINED_ACTUAL.lat;
      const dy = guess.lon - STUB_JOINED_ACTUAL.lon;
      const distanceKm = Math.round(Math.sqrt(dx * dx + dy * dy) * 111 * 10) / 10;
      return {
        resultId: 'stub-joined-result-' + roundId,
        distanceKm,
        score: Math.max(0, Math.round(5000 - distanceKm * 2)),
        actual: STUB_JOINED_ACTUAL,
      };
    },
    async submitEntry(_challengeId, input) {
      const rank = entries.length + 1;
      entries = [
        ...entries,
        {
          rank,
          displayName: input.displayName && input.displayName.length > 0 ? input.displayName : null,
          score: 3210,
          distanceKm: 412.3,
        },
      ];
      return { entryId: 'stub-entry-' + rank, rank };
    },
    async getLeaderboard(challengeId) {
      return { challengeId, entries: entries.map((entry) => ({ ...entry })) };
    },
    ...overrides,
  };
}
