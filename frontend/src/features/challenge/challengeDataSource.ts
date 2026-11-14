// R16 async challenges (ADR-0005) — server I/O for the challenge UI.
// Every call goes through api/client.ts, so the X-Player-Token header and the
// ADR-0009 ApiError mapping stay in one place. A deterministic stub keeps the
// UI and tests runnable without a backend.
import { apiFetch } from '../../api/client';
import type { ChallengeDTO, ChallengeEntryDTO, LeaderboardDTO } from '../../api/types';

/** POST /api/challenges/{challengeId}/entries body (displayName <= 40 chars, no PII). */
export interface JoinChallengeInput {
  resultId: string;
  displayName?: string;
}

export interface ChallengeDataSource {
  createChallenge(roundId: string): Promise<ChallengeDTO>;
  joinChallenge(challengeId: string, input: JoinChallengeInput): Promise<ChallengeEntryDTO>;
  getLeaderboard(challengeId: string): Promise<LeaderboardDTO>;
}

export const apiChallengeDataSource: ChallengeDataSource = {
  async createChallenge(roundId) {
    return apiFetch<ChallengeDTO>('/challenges', { method: 'POST', body: { roundId } });
  },
  async joinChallenge(challengeId, input) {
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

/**
 * In-memory stub. Entries inserted through joinChallenge() show up on the next
 * getLeaderboard() call, which lets a single test cover create -> join -> list.
 */
export function createStubChallengeDataSource(
  overrides: Partial<ChallengeDataSource> = {},
): ChallengeDataSource {
  let entries = STUB_LEADERBOARD_ENTRIES.map((entry) => ({ ...entry }));

  return {
    async createChallenge() {
      return { ...stubChallenge };
    },
    async joinChallenge(_challengeId, input) {
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
