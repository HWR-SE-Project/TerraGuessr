# TerraGuessr visual review

The **after** captures use the production build and the actual running backend,
Google Maps / Street View, and live game data. No image or API replacements were
used for gameplay or results. `home-no-webgl-reduced-motion.png` deliberately
checks the supported fallback.

All seven requested viewport sizes are included in `after/`: 1920×1080,
1711×864, 1440×900, 1280×800, 768×1024, 390×844, and 375×812.

| Screen | Before | Desktop after | Mobile after |
| --- | --- | --- | --- |
| Home | [Before](before/home.png) | [1440×900](after/home-1440x900.png) | [390×844](after/home-390x844.png) |
| Duels | [Before](before/duels.png) | [1440×900](after/duels-1440x900.png) | [375×812](after/duels-375x812.png) |
| Authentication | [Before](before/auth.png) | [1440×900](after/auth-1440x900.png) | [375×812](after/auth-375x812.png) |
| Street View | [Previous live capture](before/live-gameplay.png) | [1440×900](after/gameplay-1440x900.png) | [390×844](after/gameplay-390x844.png) |
| Round results | [Previous live capture](before/round-results.png) | [1440×900](after/round-results-1440x900.png) | [390×844](after/round-results-390x844.png) |
| Final results | [Previous live capture](before/final-results.png) | [1440×900](after/final-results-1440x900.png) | [375×812](after/final-results-375x812.png) |
| Weather expedition | [Before](before/play.png) | [1440×900](after/weather-expedition-1440x900.png) | [390×844](after/weather-expedition-390x844.png) |
| Settings | [Guest before](before/settings.png) | [Account](after/settings-account-desktop.png), [Preferences](after/settings-preferences-desktop.png) | [390×844](after/settings-390x844.png) |
| Daily challenge | [Guest before](before/daily.png) | [Desktop](after/daily-desktop.png) | [Mobile](after/daily-mobile.png) |
| Password reset | — | [1440×900](after/password-reset-1440x900.png) | [390×844](after/password-reset-390x844.png) |

Additional states: [Email registration](after/auth-email-desktop.png),
[Game settings](after/game-settings-desktop.png), [Game menu](after/game-menu-desktop.png),
[Mobile intelligence](after/intelligence-mobile.png),
[Expanded map on desktop](after/expanded-map-desktop.png),
[Expanded map on mobile](after/expanded-map-mobile.png),
[No WebGL / reduced motion](after/home-no-webgl-reduced-motion.png).

The original audit captures were taken at 1440×900. The local API proxy was
unavailable at the beginning of the audit; the before gameplay/results examples
above are therefore recovered from the verified live captures in checkpoint
`94d4031`, at their original viewport sizes. They are earlier captures, not an
identical replay of the after rounds.

Machine-readable viewport and interaction results: [visual-qa.json](after/visual-qa.json).
Reproduce with `PLAYWRIGHT_BASE_URL=http://localhost:5175 node scripts/visual-qa.mjs`.

Supplemental screens: [Duel dialog](after/duel-dialog-desktop.png),
[Mobile duel dialog](after/duel-dialog-mobile.png),
[Challenge created](after/challenge-created-desktop.png),
[Mobile challenge](after/challenge-created-mobile.png),
[Challenge leaderboard](after/challenge-leaderboard-desktop.png),
[Mobile leaderboard](after/challenge-leaderboard-mobile.png),
[Invalid challenge](after/challenge-invalid-mobile.png),
[Mobile navigation](after/navigation-mobile.png),
[Mobile login](after/auth-login-mobile.png).
