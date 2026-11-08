# Tester briefing: UI polish

Written by the developer sub-agents when their steps are done (lane A for the backoffice, lane B for the docs). The developers do not run `test-plan.md` and do not declare the feature works. Fill the `<…>` fields with the real hashes and the failure text the red runs printed.

## What changed

Lane A, the backoffice (`apps/api`):
- `src/backoffice/assets/backoffice.css` — the Signal tokens, components, motion, reduced-motion guard and forced-colors block; one stylesheet, two `:root` blocks.
- `src/backoffice/layout.tsx`, `views/**`, `components/**`, `numbers/**`, `metrics/**` — the markup hooks of design §15 (`.hero-card`, `.sparkline`, `.live-dot`, `.empty-state`, `.page-head`, `.crumb`, `.detail-grid`, `.header-end`, `.shell-signed-out`).
- `src/backoffice/views/sparkline.tsx`, `home-sparklines.ts`, `routes/session-routes.tsx` — three read-only `SELECT`s joined to the state counts in one `database.batch`, and the sparkline component.
- `src/backoffice/backoffice-copy.ts` — the new copy keys of design §11, in pt_BR and en_US.
- `test/support/contrast.ts` and the new unit, integration and e2e tests of the plan.

Lane B, the docs (`apps/docs`, `tools/repository-shape`):
- `docs.json` — `colors`, `background`, `appearance`, `logo`; the navigation is untouched.
- `logo/light.svg`, `logo/dark.svg`, `snippets/hero.jsx`, `snippets/chat.jsx`, `zapbip.css`, both `index.mdx`.
- `tools/repository-shape/src/docs-visual.test.ts` and the extended images-sized rule.

Not changed: routes, forms, `CONTENT_SECURITY_POLICY`, existing copy keys, the MCP contract, the docs navigation, the docs Playwright selectors, the favicon.

## How to run

```bash
pnpm install
pnpm --filter @zapbip/api test:unit
pnpm --filter @zapbip/api test:integration
pnpm --filter @zapbip/api test:walk
pnpm --filter ./tools/repository-shape test:unit
pnpm --filter @zapbip/docs dev
pnpm --filter @zapbip/docs test:walk
pnpm --filter @zapbip/docs broken-links
pnpm verify
```

The backoffice walk fixtures start from `apps/api/e2e/backoffice/support/`. The before set is already in `/Users/dhyegocalota/Projects/zapbip/zapbip/.pr-media/ui-polish/before-*.png` (52 files, taken on merged `main` before any lane edit); take the after set on the same ports and data.

## Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `tools/repository-shape/src/contrast.test.ts` (the helper lives in repository-shape by the coordinator's decision) | `contrast is not implemented`, 8 failed (7aeaad98) | the helper parses hex and `rgb()` with alpha (d9b029e7) |
| `tools/repository-shape/src/backoffice-contrast.test.ts`, `backoffice-tokens.test.ts`; `apps/api/test/unit/backoffice-design-rules.test.ts` (motion guard, hero border, forced colors, class coverage) | `the stylesheet does not define --color-sunken` (a6afaa49); `expected … to match /@media (prefers-reduced-motion: reduce)…` (b5483a27); the class-coverage list starting `shell-signed-out, header-end, notice-glyph` (bd46d10a) | tokens e8339391, guard and hero 3b18e65c, component styles bae4b703 |
| `apps/api/test/unit/backoffice-layout.test.ts`, `backoffice-hooks.test.ts`, `backoffice-copy.test.ts`, `backoffice-metrics-polish.test.ts` | `expected undefined to be type of 'string'` for the new keys, `to contain '<body class="shell-signed-out">'` (c9d2a10e); `to contain '<a href="/numbers" class="crumb">'` (83d7c347); `expected undefined to be '10'`, sparkline `Target cannot be null` (4295f347); `expected '' to match /freshness-(live\|hourly)/` (47339c14); hero card on the detail summary (a49ea4e8) | eea97e82, d5895291, 17f8a1f9, 971bf8e1, 6f003ab3 |
| `apps/api/test/integration/backoffice-home-sparklines.test.ts` | `readHomeOverview is not implemented`, `expected [] to have a length of 1 but got +0` (067fce99) | one batch of four read-only selects (67411132) |
| `apps/api/test/unit/backoffice-sparkline.test.ts` | `Sparkline is not implemented`, 12 failed (4568aa0b) | `Sparkline` exists (96c6a015) |
| `apps/api/test/integration/backoffice-headers-ui-polish.test.ts` | pin, green on landing (74e30b67) | unchanged |
| `apps/api/e2e/backoffice/ui-polish.spec.ts` | pin, green on landing (98236193): the CSS landed in step 7, before the spec, per the plan order | no sideways scroll, no overlap, motion and forced colors honoured |
| `tools/repository-shape/src/docs-visual.test.ts` | `<…>` | logos, tokens, chat, `zapbip.css`, Hero parity |
| `apps/docs/e2e/ui-polish.spec.ts` | `<…>` | custom CSS injected, hero laid out |

## Hypotheses to attack

Every "it works" is a hypothesis the tester tries to break.

1. Hypothesis: the home page makes exactly one `database.batch` call of four read-only statements. Break it by: counting `prepare` and `batch` calls with 1 and 50 numbers, and grepping the statements for anything but `SELECT`.
2. Hypothesis: every text pair is AA in light and dark, the translucent header included. Break it by: scrolling a dark table under the header and sampling the pixels; computing the muted text on the page glow by hand.
3. Hypothesis: a zero series never shows a flat line as its only signal. Break it by: an empty database, then one with a single registration 13 days ago (the oldest point) and one 14 days ago (excluded).
4. Hypothesis: the live dot never shows on production. Break it by: the production, staging and development fixtures, and by a locale switch on each.
5. Hypothesis: the CSP is unchanged and no page needs `style=` or a script. Break it by: diffing the constant against `origin/main`, loading every page with a violation listener.
6. Hypothesis: no page scrolls sideways at 375. Break it by: long mono targets in Audit, a 40-character number label, 400% zoom at 320 px.
7. Hypothesis: the hero-card border survives forced colors. Break it by: `forcedColors: 'active'` on home, number detail and metrics.
8. Hypothesis: Mintlify 0.0.4077 injects `zapbip.css`. Break it by: running with the pinned client and again with the cached default; compare `style[data-custom-css-path]`.
9. Hypothesis: the existing docs walk is untouched. Break it by: `git diff origin/main -- apps/docs/e2e` listing only the new `ui-polish.spec.ts`.
10. Hypothesis: the pt-BR hero is not a translation of the English rhythm. Break it by: reading both aloud; the tester flags any literal calque.

## Known gaps

- Real iOS Safari, Android and Windows high-contrast are not run; Chromium emulation only.
- Whether the design is "hyper sexy" has no machine check; the before and after pairs are for the owner.
- Lane A deviations: the contrast helper and every contrast test live in `tools/repository-shape` (coordinator decision); the metrics hero card is the first card, the accounts section, because the page has no card named period summary; an empty numbers list moves the register button from the page head into the empty state so there is one primary button; header contrast over a dark row is the shape test floor over `#000000`, and the e2e asserts the sticky header, not sampled pixels; `HomePage` now takes the `overview`; `applyDirectoryMigration` of the test support now includes the activity migration.
- Lane A has not measured the live look in a browser: the screenshots and the contrast on the real pixels are the tester's.

## Lane B (docs), steps 16 to 21

Changed: `apps/docs/docs.json` (logo, colors, background, appearance), `apps/docs/logo/{light,dark}.svg`, `apps/docs/snippets/{hero,chat}.jsx`, `apps/docs/zapbip.css`, both Overviews, `apps/docs/e2e/ui-polish.spec.ts`, `tools/repository-shape/src/docs-visual.test.ts`, `docs-experience.test.ts` (images-sized rule now covers snippets and `<Image>`).

Run: `cd tools/repository-shape && pnpm exec vitest run src/docs-visual.test.ts src/docs-experience.test.ts`; `cd apps/docs && pnpm exec playwright test`.

| Test | Red text printed (hash) | Green after |
|---|---|---|
| `docs-visual.test.ts` logo | `Error: docs.json has no logo.light` (52b3e059) | 1c333655 |
| `docs-visual.test.ts` hero | `ENOENT apps/docs/snippets/hero.jsx`, `Error: index has no Hero` (edac8c35) | 5f03c7c1 |
| `docs-visual.test.ts` theme | `expected '#128C7E' to be '#0B6B60'` (77466999) | 060a029d |
| `docs-visual.test.ts` chat | `chat.jsx has no header colour`, `expected 4.19 to be >= 4.5` (c1b6c8e0) | f2a759c8 |
| `docs-visual.test.ts` stylesheet | `ENOENT apps/docs/zapbip.css` (cb2f3bc2) | b71a14c3 |
| `docs-experience.test.ts` images-sized extension | pin (52b3e059) | n/a |
| `apps/docs/e2e/ui-polish.spec.ts` | not recorded red (written after the steps) | 65d083ff |

Deviations:
- Both Overviews carry `mode: "wide"` (red 13067d5a, 19ec79fb → green d538017d), which the pinned client 0.0.4077 honours: at 1280 the hero sits side by side, and `zapbip.css` caps prose at 44rem below it. Hypothesis: other pages are untouched (their column is already narrower than 44rem).
- The Overview now has five chats (hero plus four cards); `get-started.spec.ts` `OVERVIEW_EXAMPLE_COUNT.maximum` went from 4 to 5. No selector changed, so hypothesis 9 lists this one-constant diff.
- The logo `font-family` is the system stack, not `--font-display`, because lane A's stylesheet defines no such token.
- Contrast helper is `tools/repository-shape/src/contrast.ts` (lane A's coordinated location).
