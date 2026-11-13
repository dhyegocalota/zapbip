# Tester briefing: Web shell

## What changed

`apps/api/src/web-shell/` is the shared header and footer parts. The site, the app and the backoffice render the language menu and the theme switch from it in the footer. The app gained `POST /locale`, `POST /theme` and a hero on its signed-out page.

## Red today, green after

- `web-shell.test.ts`: red text `TypeError: Cannot read properties of null (reading '0')` on the app and the backoffice footer menu.
- `client-app-preferences.test.ts`: red, the routes answered `404`.
- `client-app-sign-in-page.test.ts`: red, no `figure.phone`.

- `web-shell.test.ts` stylesheet rows: red, `expected ':root {…' to contain '.lang-menu {'` on the backoffice stylesheet (the served sheet lacked the shell rules).

## Hypotheses for the tester

- The menu opens upward in each footer and a tap on a language lands on the same page in that language.
- The theme switch works with no script in the app and the backoffice and with the script on the site.
- The hero fits 375 and 1440 in both themes and nothing overflows.
- Reduced motion shows both chat bubbles at once and no typing dots.

## Known gaps

- The shell footer on the backoffice shows no controls on a page with no CSRF token (error pages without a session).

- Pre-existing and not touched: `ui-polish.spec.ts` navigation count (expects 4 links, the nav has 5) and `landing-quick-start.spec.ts` command `white-space` (expects `pre`, the code wraps since site-polish).
