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
  This section is itself named "auth page" in the Figma file and embeds a
  sign-up card over the hero — desktop instance at node `53:1080`, mobile
  instance (390w `Dialog` frame) at node `53:1322`. See "Auth dialog" below.

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
  card layout convention) for Solo / Multiplayer-placeholder.
- **Auth dialog** (`frontend/src/features/auth/AuthDialog.tsx`) — rebuilt the
  entry step 1:1 against the Figma sign-up card (node `53:1080` desktop /
  `53:1322` mobile): title ("Sign up to play" / "Log in to play"), the
  Google/Apple/Facebook/"Continue with Email" pill stack, the dashed "OR"
  divider, and the bottom "Already have an account? LOG IN" gradient pill —
  new `.tg-auth-figma-*`/`.tg-auth-provider-*` classes in
  `design-system.css`, brand marks downloaded to
  `frontend/src/assets/auth/*.svg` (not hot-linked). The real Google OAuth
  and email/password register-login-forgot-reset flow (TerraGuessr's actual
  backend capability) now sits one level deeper, behind "Continue with
  Email" — clicking it reveals the pre-existing form unchanged. The real
  Google button keeps its existing `googleAvailable` disabled-state handling.
  Apple and Facebook have no backend (no OAuth app registered for either) —
  per explicit product decision this session, their buttons are rendered
  exactly as Figma shows and are clickable, but show an inline
  "isn't available yet" note instead of performing real sign-in, since
  TerraGuessr has no way to honor them. The bottom-of-chooser "LOG IN"/"SIGN
  UP" pill swaps between the two chooser variants; "Create an account" /
  "Back to sign in" inside the email form instead swap mode while staying in
  the email form (so a user who already opted into email isn't bounced back
  to the OAuth chooser). `e2e/phase2-auth.spec.ts`,
  `e2e/phase3-configuration.spec.ts` was
  updated to click "Continue with Email" before filling the register form,
  and the Google-button locator moved from `.tg-google-button` to
  `.tg-auth-provider-google`.
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
- Auth dialog session (later, separate from the above): re-ran `npm run
  test` (42/42) and the full `e2e/` suite (20/20) against a freshly built
  isolated `docker-compose.test.yml` stack (same 5433/3005/8085/4004 ports).
  One apparent failure (`00-weather-fallback.spec.ts`) was the same
  pre-existing `localhost:4001` default not matching this stack's
  `4004` weather-mock port noted above — not a regression; passes with
  `PLAYWRIGHT_WEATHER_URL=http://localhost:4004` set explicitly. Also
  visually verified the chooser (login + register, desktop + 390w mobile),
  the Apple/Facebook "isn't available yet" note, and the email-form
  fallback via Playwright screenshots against the rebuilt `terraguessr-frontend`
  dev container on :8080.

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
  that page's layout. (Update, later session: the sign-up card embedded in
  that same section — the part actually named "auth page" in Figma — *was*
  subsequently rebuilt 1:1; see "Auth dialog" above. The hero/footer layout
  itself is still not a literal rebuild.)
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
   only (Home) — don't add another icon unless another real mode exists.

## Verification artifacts (this session, not committed — ephemeral)

Playwright screenshots from this session's manual verification live under
the session scratchpad, not in the repo. Re-run them anytime with:
`docker compose up -d --build frontend && npx playwright test` (default
`docker-compose.yml`, backend on 3004, frontend on 8080).

## Follow-up session — full breakpoint sweep + regression re-verification

Continued on the same branch (`figma/visual-fidelity`, still unmerged).
Checked `get_metadata` on page `0:1` again — the file still only has the
same three `html.to.design` sections listed above; no new frames to pick up.

New work this session:

- **`docs/screenshots/qa/*.png`** — a full breakpoint sweep (1920×1080,
  1440×900, 768×1024, 390×844) for the five screens the brief calls out as
  highest priority and hardest to get right responsively: landing/difficulty
  picker, the map-guess game view, the list/"Easy" candidate game view, the
  round-reveal screen, and the final-results screen. Captured against the
  already-running `docker-compose.yml` stack (frontend on 8080) with a
  throwaway Playwright spec (not committed — written, run, and deleted in
  this session) that also asserted
  `document.documentElement.scrollWidth === clientWidth` at every size.
  Result: zero horizontal overflow at any of the 20 screen×breakpoint
  combinations; no default browser form controls or raw lat/lon text
  visible anywhere. Existing `e2e/*.spec.ts` suites only exercised
  1440×1000/960 and 375×812/390×844 — this fills the 1920×1080 and
  768×1024 gap the brief specifically asks for.
- Re-verified against the real Duels frame screenshot (`get_screenshot` on
  node `53:12`): the dark-navy background, white italic "DUELS"-style
  heading treatment, gold subtitle color, green pill CTA, and
  Champion/Master/Gold/Silver/Bronze rank ladder colors still match what's
  implemented in `ChallengePanel`/`ChallengeLeaderboard`. The Figma frame's
  3D player avatars are GeoGuessr-proprietary art and were correctly never
  replicated — TerraGuessr's challenge UI only reuses the color/type system
  and rank-badge convention, not the illustration.
- **Regression suite**: ran the full `e2e/` suite twice — once against the
  long-lived dev stack on port 8080, once against a freshly built, isolated
  `docker-compose.test.yml` stack (custom ports to avoid clashing with other
  stacks already running on this machine). On the fresh stack, 19/20 pass
  outright; the 20th (`00-weather-fallback.spec.ts`, R13) fails only because
  its `weatherUrl` default (`localhost:4001`) doesn't match the custom
  `TERRAGUESSR_TEST_WEATHER_PORT` used for this run — passing
  `PLAYWRIGHT_WEATHER_URL` pointed at the correct port makes it 20/20. This
  reconfirms last session's note that this is a test-fixture port mismatch,
  not a frontend regression. On the long-lived shared stack, the same test
  plus both `phase1-visual.spec.ts` cases failed on the first pass because
  the shared Postgres has accumulated rounds/weather-mock counter state from
  unrelated runs across this machine's session history; a second pass
  against the clean, isolated stack confirmed these are pre-existing
  environment artifacts, not something this session's changes caused.
  `npm run typecheck`, `npm run lint`, `npm test` (42/42), and `npm run
  build` all stayed green with zero frontend source changes needed.
- No code changes were required this session — the prior session's
  token/component work already held up under the wider breakpoint matrix
  and a clean-stack regression run. The three deferred items from the list
  above (ad cards/notifications, mobile bottom tab bar, dashboard flyout
  reuse) remain deliberate scope calls, not oversights: TerraGuessr has no
  backing feature for the first two, and the third is a real enhancement
  candidate for a future session, not a defect.
