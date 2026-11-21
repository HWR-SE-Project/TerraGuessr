# TerraGuessr design system

One navy/lime/glass visual language, shared across Home, Auth, Singleplayer, Multiplayer, Avatar Editor, and Settings. This is a consolidation of an existing, partially-adopted token system — not a rebuild. See `docs/DESIGN-OVERHAUL.md` for the historical overhaul this builds on (note: that doc predates the singleplayer/lobby unification and references routes — `/play`, `/duels`, `/challenge` — that no longer exist).

## Tokens

`frontend/src/design-system/tokens.css` — the single `:root` source of truth.

| Category | Tokens |
| --- | --- |
| Color | `--color-bg/surface/surface-raised/surface-hover`, `--color-text/muted/subtle`, `--color-lime` + `-hover`/`-10`/`-20`/`-40`/`-70` alpha scale, `--color-cyan/purple/orange/gold/red`, `--color-on-lime`, `--color-border/border-strong` |
| Spacing | `--space-1` … `--space-8` (4–64px) |
| Radius | `--radius-sm` (8) / `-control` (16) / `-card` (20) / `-panel` (28) / `-pill` (999) |
| Geometry | `--control-height` (48), `--nav-height`, `--container-width` |
| Type | `--font-body/display`, `--text-caption/body/title` |
| Effects | `--glass-blur` (34, chrome/dialogs), `--glass-blur-panel` (20, interactive panels), `--glass-fill/border/shading/reflection/shadow/inner`, `--shadow-panel` |
| Motion | `--ease-out`, `--duration-fast/panel` |

Use the alpha scale (`var(--color-lime-10)` etc., or `color-mix(in srgb, var(--color-lime) N%, transparent)` for values outside the scale) instead of hand-picked hex+alpha literals — this was the single largest source of drift before this pass (11+ divergent "accent green" hex values across the app).

## Surfaces (`design-system/controls.css`)

Three intentional glass tiers, not one-off per component:

1. **Surface 1 — floating controls.** `.tg-control` (buttons) and `.tg-action` / `.tg-icon-button` (quiet pills/icon buttons). Blur 34px. Used by nav, HUD buttons, edit-avatar pill.
2. **Surface 2 — interactive panels.** `.gi-panel`, `.mp-timer`, `.tl-entry-form`, plus page-local panels that pull the same tokens (`.sp-world-panel`, `.tg-city-panel`). Blur 20px (`--glass-blur-panel`) — lighter so Street View/the map stays legible underneath.
3. **Surface 3 — elevated dialogs.** `.sp-dialog`, `.th-notice`, `.tt-coach`, `.ae-dialog`, `.th-multiplayer-menu`, `.geo-landing__signup-card`, bare `.sp-glass`. Blur 34px + `--shadow-panel`.

All three respect `prefers-reduced-transparency` (flat `--color-surface`-equivalent fallback, blur removed) and `forced-colors`.

## Primitives (`components/ui/`)

| Component | Replaces | Notes |
| --- | --- | --- |
| `Button` | ~30 bespoke button implementations | Variants: `primary/secondary/danger/ghost/tinted/cyan/light`. Renders `tg-button tg-button--{variant} tg-control tg-control--{variant}` — pass extra classes additively for page-specific layout. |
| `IconButton` | `.sp-icon`, `.th-icon-btn`, `.ae-icon-button`, `.tt-icon-btn` | One circular (`--radius-pill`) icon-only control; requires `aria-label`. |
| `Modal` | `GameDialog` (promoted/renamed) | Native `<dialog>`, real focus trap, Escape via `onCancel`, outside-click-to-close. Used by Settings-in-game, Exit confirm, GI lock dialog, Avatar Editor shell, Home's availability notice, multiplayer match menu. |
| `ConfirmDialog` | its own bespoke scrim+div | Now a thin wrapper around `Modal` with `role="alertdialog"`. |
| `Spinner` | `.sp-spinner`, `.tl-spinner` (partially; see below) | Labeled (`role="status"`), lime ring on `--glass-border`. |
| `InlineNotice` | ad hoc `.sp-error`, `.tl-feedback`, `.ae-home-toast`, etc. | `tone="info\|error\|success"`. |

Not merged: `.tl-spinner` (inline, `aria-hidden`, `currentColor`-based so it matches whatever button hosts it) is a deliberately different, decorative-only pattern from the labeled standalone `Spinner` — kept distinct rather than forced together.

## What changed

- **Buttons**: every primary/secondary/danger action now resolves through `Button`'s `tg-control` variants. Fixed real, visible mismatches: Lobby's "Create Lobby" was a 999px pill with its own green (`#c6ef94`); Singleplayer's "Start Exploring" and Home/Avatar/Settings buttons are now the same 16px-radius shape and the same lime.
- **Selectable cards**: Lobby's difficulty picker now shares `.sp-difficulty-option`'s exact visual recipe (border/radius/selected-state) instead of a separately hand-tuned version.
- **Dialogs**: 5 independent shells (GameDialog, ConfirmDialog, Avatar Editor, Home's notice, Tutorial) collapsed to 1 shared `Modal` + Tutorial's intentionally distinct coach-mark overlay (smaller, contextual, but pulling the same color/radius tokens).
- **Dead code removed**: `pages/auth/tokens.css` (an unused purple "horror theme" palette) and ~140 lines of `product.css` rules for `tg-play-*`/`tg-challenge-*`/`tg-weather-*`/`tg-page-notice`/unused `tg-candidate-*` modifiers — all confirmed zero-usage leftovers from a prior mode removal.
- **Radius**: ~20 distinct hardcoded values snapped onto the 5-token scale (buttons/inputs → control, cards/selectable rows → card, dialogs/hero panels → panel, chips → sm, CTA/unlock pills → pill).
- **Color**: 11+ hardcoded green hex values (`#97e851`, `#68c045`, `#c5f47b`, `#c6ef94`, `#b0ee64`, `#a3ed45`, `#c0ed8b`, …) replaced with `--color-lime` + the alpha scale. Dozens of near-duplicate muted-gray text colors consolidated onto `--color-text`/`--color-muted`.
- **CSS consolidation**: `SingleplayerGamePage.css`'s `.sp-dialog`/`.sp-primary`/`.sp-welcome` selectors, each previously redeclared 2–3 times across the file as it evolved, merged into single declarations with no visual change.

## Conventions going forward

- Add new accent-alpha values via the `--color-lime-N` scale or `color-mix()`, never a new hex+alpha literal.
- Pick a radius from the 5-token scale; don't introduce a 6th.
- A new floating/interactive/dialog surface should extend one of the three shared `#root :is(...)` groups in `controls.css` rather than hand-rolling backdrop-filter/background/border/shadow.
- Prefer `Button`/`IconButton`/`Modal`/`InlineNotice`/`Spinner` over new bespoke markup; add a variant to `Button` before adding a new button class.
