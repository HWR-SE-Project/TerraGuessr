# ADR-0008: Rounds-per-game and location-selection algorithm

**Status:** Accepted (Principal Architect, Phase 1 finalization, 2026-11-14). Resolves ordinary
engineering decisions left open by the Phase 0.5 docs; traces to R01, R02, R05, R07.

## Context
The Phase 0.5 docs never fix (a) how many rounds a game has — the idea document only says "Es
gibt mehrere Runden"; (b) the concrete selection algorithm behind R01's "random location" under
the difficulty scoping of `architecture.md` §4; (c) how list-mode distractor candidates are
chosen. Implementing agents cannot proceed without these as fixed numbers.

## Decision
- **Rounds per game:** solo games have a fixed `ROUNDS_PER_GAME = 5`. Challenge games have
  exactly 1 shared round (ADR-0005). The constant lives in `backend/src/config/constants.ts`.
- **Pool:** ~2000 `Location` rows seeded offline (ADR-0004), stratified roughly equally across 6
  regions `AFRICA | EUROPE | ASIA | NORTH_AMERICA | SOUTH_AMERICA | OCEANIA`. Antarctica and
  `lat < -60` are excluded (no meaningful gameplay weather). `source = 'grid'`.
- **Actual-location selection per round** (pure function `domain/selection.ts`, injected RNG +
  candidate list, so it is deterministic under test):
  - *Easy*: pick one region uniformly at random for the round; actual = random `Location` in that
    region not already used in this game.
  - *Medium / Hard*: actual = random `Location` from the whole pool not already used in this game.
  - **No repeat within a game**: exclude `locationId`s already used by rounds of the game.
  - **Diversity rule** (satisfies the idea doc's "runs differ strongly"): for Medium/Hard, if the
    picked actual is within `MIN_SEPARATION_KM = 500` of any previous actual in the same game,
    resample; bounded to `MAX_SELECTION_TRIES = 10`, then accept the last pick.
- **List-mode candidates:** `actual` plus distinct random distractors from the same scope
  (Easy: same region; Medium: whole pool), shuffled. `EASY_CANDIDATES = 5`, `MEDIUM_CANDIDATES = 8`
  (within the 4–6 / 6–10 ranges of `architecture.md` §4). Hard has no candidates.
- **Selection mode (R07):** Easy ⇒ always `list`. Hard ⇒ always `map`. Medium ⇒ the client chooses
  via the `selectionMode` field on round creation (`'map' | 'list'`); default `'list'` if omitted.

## Consequences
`ROUNDS_PER_GAME`, the region set, and the candidate counts are single-source constants; changing
them is a one-line edit and a test-vector update, not a redesign. The selection core is pure and
RNG-injected so QA can assert "no repeat", "respects region", and "respects separation"
deterministically.
