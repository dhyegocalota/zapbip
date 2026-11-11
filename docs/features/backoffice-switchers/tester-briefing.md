# Tester briefing: Backoffice switchers

## What changed

- `apps/api/src/backoffice`: `backoffice-theme.ts`, `return-target.ts`, `preference-cookie.ts`, `routes/theme-routes.ts`, `components/icons.tsx`, `components/theme-switch.tsx` are new. `locale-routes.ts` moved onto the shared cookie helper (`SameSite=Lax`) and the return-target allow-list. `request-context.ts`, `backoffice-env.ts`, `page-context.ts`, `layout.tsx`, `error-response.tsx` and the nine views carry `theme`; `locale-switch.tsx` gained a globe; the stylesheet has three token blocks and the switcher and icon rules.
- `tools/repository-shape/src/contrast.ts` reads the three-block stylesheet (`forcedDarkTokens`).
- `.claude/rules/backoffice.md` and one sentence in `docs/features/backoffice/spec.md`.

## How to run

- Unit: `pnpm --filter @zapbip/api test:unit`; shape: `pnpm --filter @zapbip/repository-shape test:unit` (workspace names as in each `package.json`).
- Integration: `pnpm --filter @zapbip/api test:integration -- test/integration/backoffice-preferences.test.ts test/integration/backoffice-auth-redirects.test.ts`.

## Red today, green after (failure text the red run printed)

| Step | Red commit | Test | Failure printed |
|------|------------|------|-----------------|
| 1 | 2186ca98 | `backoffice-theme.test.ts`, `backoffice-return-target.test.ts` (25 red) | `Error: resolveTheme is not implemented for <script>`; `returnTargetOf is not implemented for ...` |
| 1 | 2186ca98 | `backoffice-locale.test.ts` | pin: green when it landed (3 tests) |
| 2 | ab7df820 | `backoffice-preferences.test.ts` (19 red of 21) | `AssertionError: expected 404 to be 303` (no `/theme` route), `expected 404 to be 403`, `expected '__Host-zb_bo_locale=en_US; Max-Age=31...' to contain 'SameSite=Lax'`, `expected '<html lang="en">...' to contain 'data-theme="dark"'`. The `GET /theme` 404 and the unknown-locale cases are pins |
| 3 | 20c7feb1 | `backoffice-layout.test.ts`, `backoffice-theme-switch.test.ts`, `backoffice-copy.test.ts` (18 red) | `Error: ThemeSwitch is not implemented for /metrics`; `expected '<html lang="en">...' to contain '<html lang="en" data-theme="system">'`; `expected 2 to be 3`; `expected [ Array(251) ] to include 'ThemeLabel'` |
| 4 | c7dfd2b5 | `backoffice-design-rules.test.ts` (4 red), `backoffice-tokens.test.ts`, `backoffice-contrast.test.ts` (6 red) | `expected [ ... ] to have a length of 3 but got 2`; `Error: the stylesheet has no dark token block`; `Error: forcedDarkTokens is not implemented for 27969 characters`; `expected ':root {...' to contain 'color-scheme: light;'` |

Notes:

- The `has a rule for every class a view emits` test went red at step 3 (`[ 'icon', 'theme-switch' ]`) and green at step 4.
- The dark-parity test in the step 4 red commit had a wrong body pattern; it was fixed in the green commit 851f8fa0 (it was red for the missing block, not for the pattern, at red time).

## Hypotheses for the tester (not claims)

- Both switchers render with icons on `/sign-in` and every signed-in page; the error pages carry `data-theme` and no switcher.
- A switch answers `303` to the same page (query dropped) and the choice survives reload and navigation.
- `system` follows the OS (`browser_emulate_media`), `light` and `dark` override it, native controls and scrollbars follow `color-scheme`.
- Every button is at least 44 px at 375 and 1280; the pressed button is clear in both themes and under forced colors.
- The CSP header is unchanged and the console and network stay clean.

## Known gaps

- No browser walk was run by the developer (per the role). The icon geometry and the look of the pressed state at 375 are unseen.
- The header may wrap to a second row at 375 with signed-in navigation plus both switchers and sign-out; the tester should judge it.
- `/start` is untouched by design.
