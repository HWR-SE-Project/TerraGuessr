# ADR-0008: Rounds-per-game and location-selection algorithm

**Status:** Accepted (Principal Architect, Phase 1 finalization, 2026-11-14). Resolves ordinary
engineering decisions left open by the Phase 0.5 docs; traces to R01, R02, R05, R07.

> **Superseded (2026-11-21):** the removed `/play` weather game this ADR originally described
> has been replaced by the Street View singleplayer game. The shipped implementation uses 30
> curated `ROAD_TARGETS`, endless solo rounds, and the rules in `backend/src/domain/gameRules.ts`.
> In particular, R07 is Easy ⇒ list, Medium/Hard ⇒ map with country borders; there is no
> client-chosen list/map mode. The location-pool and round-count bullets below are historical.

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
- **List-mode candidates:** Easy only — the actual target plus 5 distinct random distractors
  drawn from `ROAD_TARGETS`, shuffled (6 options total). Medium and Hard receive no candidates.
- **Selection mode (R07):** Easy ⇒ always `list`. Medium and Hard ⇒ always `map` with country
  borders, enforced by `gameRulesFor()` in `backend/src/domain/gameRules.ts`. There is no
  client-chosen list/map mode.

## Consequences
`ROUNDS_PER_GAME`, the region set, and the candidate counts are single-source constants; changing
them is a one-line edit and a test-vector update, not a redesign. The selection core is pure and
RNG-injected so QA can assert "no repeat", "respects region", and "respects separation"
deterministically.
