# Plan: Web shell

**Spec:** spec.md
**Tier:** 🟡
**Seam:** `apps/api/src/web-shell`, the three layouts and stylesheets
**Assumptions (decided, owner can override):**
- The compact footer links to the production site for the legal pages, so staging links to the same text.
- The menu order is the order of `LOCALE_PROFILES`, not the enum order.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/api/src/web-shell/**`, `apps/api/src/client-app/**`, the layouts and stylesheets of the site and the backoffice, their tests and the rules | `developer` |

## Sequencing

One developer: red integration tests, then the shared module, then the three surfaces, then the stylesheets, then the walks.

## Steps

### G1

- [x] **Step 1:** failing integration tests for the shared shell, the app preferences and the sign-in page — bb0af01a
- [x] **Step 2:** the `web-shell` module (menu, switch, footer, copy, profiles, stylesheet)
- [x] **Step 3:** site, app and backoffice use it; the app gets `POST /locale`, `POST /theme` and the hero
- [x] **Step 4:** isolation test, rules and docs
- [x] **Step 5:** Playwright walks (`e2e/client-app/web-shell.spec.ts`, `e2e/backoffice/web-shell.spec.ts`) and screenshots; the backoffice stylesheet fix has its own red commit

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 3 | A cookie or a return target accepts a hostile value | `client-app-preferences.test.ts` hostile targets | revert the route |
| 3 | The site theme script loses its form | `landing-theme.spec.ts` red | restore `themeId` |
