# Plan: Backoffice switchers

**Spec:** spec.md
**Tier:** 🟡
**Seam:** `apps/api/src/backoffice`: `request-context.ts`, `routes/locale-routes.ts`, `layout.tsx`, `assets/backoffice.css`.
**Assumptions (decided, owner can override):**
- One developer, one pass, no ADR, form POST, `SameSite=Lax`, dark tokens written twice with a parity test, no switchers on `/start`: owner delegated 2026-11-11.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/api/src/backoffice/**` (`backoffice-theme.ts`, `return-target.ts`, `preference-cookie.ts` new; `locale.ts`, `request-context.ts`, `backoffice-env.ts`, `backoffice-constants.ts`, `backoffice-paths.ts`, `backoffice-copy.ts`, `app.ts`, `page-context.ts`, `layout.tsx`, the views, `routes/locale-routes.ts`, `routes/theme-routes.ts` new, `components/*`, `assets/backoffice.css`), `apps/api/test/unit/backoffice-*.test.ts`, `apps/api/test/integration/backoffice-preferences.test.ts` (new), `tools/repository-shape/src/backoffice-tokens.test.ts`, `tools/repository-shape/src/backoffice-contrast.test.ts`, `.claude/rules/backoffice.md`, `docs/features/backoffice/spec.md` (one sentence) | `developer-1` |

## Sequencing

One developer, one branch, five steps in order.

## Steps

### G1

- [ ] **Step 1:** red: unit tests for `resolveTheme`, `resolveLocale` (kept) and `returnTargetOf` (valid pages, `//evil.test`, `https://evil.test`, `/\evil.test`, `javascript:`, empty, control characters). Then `backoffice-theme.ts`, `return-target.ts`, the cookie name constant and `BackofficePath.Theme`.
- [ ] **Step 2:** red: integration `backoffice-preferences.test.ts` (cookie attributes, allow-list, `303` target, CSRF refusal, rendered `data-theme`). Then `preference-cookie.ts`, `theme-routes.ts`, `locale-routes.ts` on the helper with `SameSite=Lax`, `request-context.ts` and `backoffice-env.ts` carrying `theme`, `app.ts` with `BackofficePath.Theme` in `FORM_PATHS`.
- [ ] **Step 3:** red: unit tests for the layout (`<html data-theme>`, both switchers on the sign-in page and a signed-in page) and the copy parity (`ThemeLabel`, `ThemeLight`, `ThemeDark`, `ThemeSystem` in pt_BR and en_US). Then `icons.tsx`, `theme-switch.tsx`, the globe in `locale-switch.tsx`, `Layout`, `PageContext` and the nine views.
- [ ] **Step 4:** red: update the stylesheet shape tests (three token blocks, the two dark blocks equal, forced-dark contrast pairs, no raw colour outside `:root`). Then the CSS: dark under `:root:not([data-theme='light'])` and `:root[data-theme='dark']`, `color-scheme`, the switcher and icon styles, the 375 px rule.
- [ ] **Step 5:** `.claude/rules/backoffice.md` (cookies, theme attribute, the two dark blocks) and the one sentence about the locale cookie in `docs/features/backoffice/spec.md`; set this feature's status to `Shipped` at merge.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | `Lax` cookie rejected by a browser without `Secure` on plain HTTP | the dev stack shows no theme change; `Set-Cookie` lacks `Secure` in the integration test | revert the helper to the previous attributes |
| 3 | a view forgets `theme` | `tsc` fails on the missing required `LayoutProps.theme` | add the prop |
| 4 | the two dark blocks drift | the parity shape test fails | copy the block |
| 4 | a `style=` attribute on an icon trips the CSP | a CSP violation in the browser console | size the icon by class |

**Steps with no backout:** none (no migration, no data).

## Z. Prove and ship

One pass.

- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` once and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict.
- [ ] **/open-pr:** PR opened with the 1280 and 375 screenshots, light and dark.
