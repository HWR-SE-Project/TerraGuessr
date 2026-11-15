# Figma-sourced visual redesign — handoff

Branch: `figma/visual-fidelity` (off `main`, not merged). Figma file:
`sIKTjQ2LtnU5acvpcwZELG` ("software-engineering-design"), root node `0:1`.

## What was actually inspected in Figma

The file contains exactly three `html.to.design`-imported sections (desktop
1920w + mobile 390w frame per section):

- `53:300` — `geoguessr.com/multiplayer/duels` (the Duels pre-game lobby).
- `53:766` — `geoguessr.com/` (authenticated dashboard: avatar-on-globe hero,
  left flyout nav card, right ad/subscribe cards, header nav).
- `53:1154` — `geoguessr.com/?utm_source=chatgpt.com` (the logged-out public
  marketing landing page: "Explore the world" hero + footer w/ FAQ accordion).

All three were opened via `get_metadata`/`get_screenshot`/`get_design_context`
(session `eb524ac0-...`) and cropped around the oversized decorative
background layers that `html.to.design` imports without clipping (they
report an inflated bounding box — `get_screenshot` with `contentsOnly` does
not fix this; the fix was screenshotting the inner content frame directly,
e.g. node `53:12` for Duels' `Main` container).

Exact tokens pulled from the Duels frame's `get_design_context` reference
code (now in `frontend/src/styles/design-system.css`):
- Font: Inter, Black Italic (900) for headings, Bold Italic (700) for
  buttons/emphasis — not Archivo/Manrope as the prior (pre-Figma) redesign
  guessed.
- Background `#171235`, panel gradient `rgb(57 50 115 / x%)`.
- Green CTA gradient `#97e851 → #479440` with `inset 0 1px 0 #fff/20%, inset
  0 -2px 0 #000/30%` and a `0 1px 2px #171235` text-shadow on the label.
- Gold `#ffc628`, teal `#3ae8bd`, and rank-tier colors Champion `#00a2fe` /
  Master `#e94555` / Gold `#ffc628` / Silver `#fff` / Bronze `#ffa43d`.

## What was implemented

- **Design tokens** (`frontend/src/styles/design-system.css`): corrected to
  the exact Figma values above. This cascades through every screen already
  built on `--tg-*` variables, so buttons, headings, panels, dashboard,
  gameplay HUD, results, settings, etc. all picked up the corrected palette,
  font, and button recipe (pill, uppercase, italic, Figma shadow stack)
  without per-screen edits.
- **"Challenge a friend"** (`ChallengePanel`/`ChallengeLeaderboard`) — this is
  TerraGuessr's real async-duel feature (create a challenge from a finished
  round, share a link, a friend plays the same location, both land on one
  leaderboard). It is the functional equivalent of the Figma Duels screen and
  was reskinned directly against that frame: bigger italic/uppercase heading,
  a rank-tier colour accent bar, and rank badges (bordered circle, gold /
  silver / bronze by position) on the leaderboard rows — all driven by real
  `LeaderboardEntryDTO.rank` data, nothing fabricated. No fake opponent
  pairing, duel-round tabs, or ranked ladder were added, since the backend
  has none of that — only the real create/share/join/leaderboard flow got a
  visual upgrade.
- **Dashboard cards** got a small icon badge (top-right, matching the Figma
  card layout convention) for Solo / Daily Challenge / Multiplayer-placeholder.
- Verified end-to-end against the real stack: rebuilt `terraguessr-frontend`
  via `docker compose up -d --build frontend` (this repo's own
  `docker-compose.yml`, documented in `docs/MANUAL-TESTING.md`), played a
  full 5-round solo game, created a challenge, joined it, and signed up for
  the authenticated dashboard — all via Playwright, screens hold up at
  1920×1080, 1440×900, and 390×844 with no overflow/overlap.
- Full `npm run test` (42/42) and the full `e2e/` Playwright suite (20/20)
  pass against a clean, isolated `docker-compose.test.yml` stack (ports
  5433/3005/8085/4004 to avoid colliding with other stacks already running
  on this machine). Two apparent failures on the first run
  (`phase1-visual.spec.ts` ×2, `00-weather-fallback.spec.ts`) were both
  artifacts of ad-hoc manual verification requests polluting the shared
  deterministic weather-mock counters / round sequence beforehand, and a
  hardcoded `localhost:4001` default in that one spec not matching the
  isolated stack's weather-mock port — not regressions. Re-run clean, all 20
  pass.

## What was not done (deferred)

This Figma file only covers Duels + the dashboard/landing marketing page.
The brief's full priority list (landing, dashboard, config, solo gameplay,
map guessing, round/final results, lobby, tutorial, settings/leaderboard)
only has direct Figma coverage for the dashboard and the Duels-equivalent
challenge screen — everything else in TerraGuessr already existed from the
prior (pre-Figma) redesign commit `be57bec` and now inherits the
Figma-corrected tokens, but was **not** individually re-checked frame-by-frame
against Figma because there is no Figma reference for those screens. Not
done in this session:

- The public logged-out marketing landing page (`53:1154`) was inspected
  (hero + footer) but TerraGuessr's own hero copy/structure was kept as-is
  (different product, no "100M players"/App Store rating claims to fabricate)
  — only the type/color system was pulled forward, not a literal rebuild of
  that page's layout.
- The dashboard's right-side ad cards ("Play our free horror mode",
  "Subscribe") and the notifications drawer have no TerraGuessr equivalent
  and were intentionally not replicated (would be fake UI for features that
  don't exist).
- No mobile bottom tab bar (seen in the Figma mobile captures) was added;
  TerraGuessr mobile still relies on the existing collapsed top nav.
- Visual regression screenshots only cover the screens touched this session
  (landing hero, solo game, results + challenge panel, dashboard) at the
  four required breakpoints. `docs/screenshots/*.png` were refreshed by the
  existing `e2e/zz-screenshots.spec.ts`/`phase2-auth.spec.ts` suite, not a
  new exhaustive breakpoint matrix for every screen.

## Next steps if continuing

1. If more Figma frames get added to the file (the brief says it "currently"
   has three imported sections, implying more may follow), re-run
   `get_metadata` on `0:1` — it's cheap and will show new top-level sections.
2. Decide whether the dashboard's left "flyout" card style (streak counter,
   locked "World" tile) is worth adapting for TerraGuessr's real
   streak/statistics data — there's a real daily-streak feature already
   (`PlayerPages`) that could reuse that visual pattern.
3. Any work on the mobile bottom tab bar should map to real destinations
   only (Home, Daily Challenge) — don't add a third icon unless a third real
   mode exists.

## Verification artifacts (this session, not committed — ephemeral)

Playwright screenshots from this session's manual verification live under
the session scratchpad, not in the repo. Re-run them anytime with:
`docker compose up -d --build frontend && npx playwright test` (default
`docker-compose.yml`, backend on 3004, frontend on 8080).
