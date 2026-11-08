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
| `apps/api/test/unit/backoffice-contrast.test.ts` | `<contrast is not implemented>` (hash `<…>`) | the helper parses hex and `rgb()` with alpha |
| `apps/api/test/unit/backoffice-design-rules.test.ts` (pairs, dark counterparts, motion guard, forced colors) | `<first failure text>` | tokens, guard and forced-colors block exist |
| `apps/api/test/unit/backoffice-layout.test.ts`, `backoffice-hooks.test.ts`, `backoffice-copy.test.ts` | `<…>` | the hooks and keys exist |
| `apps/api/test/integration/backoffice-home-sparklines.test.ts` | `<…>` | one batch of four read-only selects |
| `apps/api/test/unit/backoffice-sparkline.test.ts` | `<…>` | `Sparkline` exists |
| `apps/api/test/integration/backoffice-headers-ui-polish.test.ts` | pin, green on landing (hash `<…>`) | unchanged |
| `apps/api/e2e/backoffice/ui-polish.spec.ts` | `<…>` | no sideways scroll, no overlap, motion and forced colors honoured |
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
- `<anything the developers found missing while building>`
