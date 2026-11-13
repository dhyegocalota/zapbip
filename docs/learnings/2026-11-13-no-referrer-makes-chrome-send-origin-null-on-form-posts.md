# A form post is refused with 403 in Chrome and accepted in a request test, because `Referrer-Policy: no-referrer` sends `Origin: null`

- Date: 2026-11-13
- Inspired by: `docs/features/client-app/` (the Playwright walk of the Continue button)
- Revisited: 2026-11-13 — still true

## Signal
Every `POST` of a same-origin form answers `403` in a real browser, the server log shows an Origin check failing, and the integration test that sets `Origin` by hand is green.

## Cause
With `Referrer-Policy: no-referrer`, Chrome sends `Origin: null` on form submissions, even to the same origin. A handler that compares `Origin` with its own origin refuses them.

## Do
Use `same-origin` where a page has an Origin check: same-origin requests keep the header, cross-origin links send nothing. Walk the flow in a browser; a test that forges the header cannot see this.

## Anchor
`apps/api/src/client-app/client-app-policy.ts`, `apps/api/e2e/client-app/client-app.spec.ts`.
