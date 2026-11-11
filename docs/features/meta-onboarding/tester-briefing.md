# Tester briefing: Meta onboarding

Written by the developer. The developer did not run `test-plan.md` and does not declare the feature works.

## What changed

- `libs/types/src/constants.ts`: `META_APP_ID`, `META_APP_LABEL`, `META_LOGIN_CONFIGURATION_ID` (`946808808378298`), `ONBOARDING_PIN_PATTERN`.
- `apps/api/migrations/0008_meta_onboarding.sql`: guard against a foreign app, rebuild of `whatsapp_numbers` without `meta_app_ref`, drop of `meta_apps`, `backoffice_sessions.onboarding_grant_until`.
- `apps/api/src/numbers/meta-onboarding.ts`: `onboardNumber` (form exchange, list read, `debug_token`, number webhook read, subscribe without override, register with PIN, per-number override), `OnboardingError`.
- `apps/api/src/routes/whatsapp.ts`, `adapters/whatsapp/signature.ts`: one `META_APP_SECRET`, fail closed when unset.
- `apps/api/src/operations/deploy-preflight.ts`, `worker-secret.ts`: `META_APP_SECRET` is a typed warning, never a refusal.
- `apps/api/src/backoffice/numbers/routes/connect-routes.tsx`, `views/connect-number.tsx`, `views/connect-meta.tsx`, `onboarding-form.ts`, `auth/onboarding-grant.ts`: the step-up grant, the page, the post.
- `apps/api/src/backoffice/assets/embedded-signup.ts`, `security-headers.ts`, `backoffice-constants.ts`: the SDK script and `PagePolicy`.
- Removed: the typed register form, the app secret route, the Meta app column and block, `registerMetaApp`, `openAppSecret`.
- `apps/api/test/support/fake-graph.ts`: defaults for the exchange, subscribe, register and read; scoping by signup code.
- `apps/api/e2e/backoffice/*`: the stubbed Embedded Signup walk; `numbers.spec.ts` and `ui-polish.spec.ts` moved to the connect flow.

## How to run

```bash
pnpm --filter @zapbip/api test:unit
pnpm --filter @zapbip/api test:integration
pnpm --filter @zapbip/api exec playwright test --config playwright.config.ts
```

## Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `migration-0008.test.ts` (6) | `ENOENT: no such file or directory, open '../../migrations/0008_meta_onboarding.sql'` | the migration copies the number, refuses a foreign app, adds the grant column |
| `backoffice-numbers.test.ts` (5 of 18) | register form `200` (expected 404); app secret route `303` (expected 404); list still held `App da Meta`; number page still held `Trocar o segredo do app`; empty-state link `/numbers/new` | the routes, column and block are gone |
| `whatsapp-webhook-numbers.test.ts`, `number-registry.test.ts`, `deploy-preflight.test.ts` | `expected 401 to be 200`; `D1_TYPE_ERROR: Type 'undefined' not supported for value 'undefined'`; `Imported HMAC key length (0) must be a non-zero value`; `expected [] to deeply equal [ {...} ]` (no warning) | one secret verifies, a number registers without an app, the preflight warns |
| `meta-onboarding.test.ts` (18) | `Error: onboardNumber is not implemented for 1000000000000301` | the four calls run in order and fail typed |
| `backoffice-meta-onboarding.test.ts` (20 of 22) | `expected 404 to be 303`, `expected 404 to be 429`, `the form answered 404 without a Location`; `Error: parseOnboarding is not implemented for 5 fields` (unit, 9) | the grant and the connect post |
| `backoffice-headers-meta-onboarding.test.ts` (6 of 14), `backoffice-page-policy.test.ts` (1 of 3) | meta page `404`, asset `404`, embedded signup policy equal to strict | the page policy and the script asset |

Pins (green when they landed): the strict-policy cases for other pages, the removed manual routes, the no-secret-escapes case, the whole browser walk (`bb334ed4`).

## Hypotheses to attack

1. The code, the PIN and the business token reach no browser, log, flash, `Location` or error. Break it by: grep every captured line of a failed and a successful connect.
2. The grant is single use and consumed before any Graph call. Break it by: two concurrent posts with one grant; the second must call Graph zero times.
3. Only `GET /numbers/connect/meta` carries the SDK policy. Break it by: an error thrown while that route renders, a `HEAD`, a trailing-dot host.
4. Migration `0008` is safe on any data. Break it by: a copy holding a foreign app, a fixed-app number with bound accounts and `activity_daily` rows.
5. The webhook fails closed. Break it by: deliver with `META_APP_SECRET` unset, empty, and set to whitespace.
6. The script ignores foreign origins and never posts without both the IDs and the code. Break it by: a `message` from `https://evilfacebook.com` and from `http://www.facebook.com`.

## Known gaps

- The real SDK, popup and Meta Graph are not exercised: the exchange as a form `POST`, the override handshake, the allowlist and the register call are proven only by the owner's first staging connect.
- A callback that carries a code but never a `FINISH` message shows no status line (it keeps waiting); only `CANCEL`, `ERROR` and a callback without a code show one.
- Owner-only: `wrangler secret put META_APP_SECRET` in both environments (the preflight only warns), the D1 bookmark and the `meta_apps` count before migrating, and the staging connect.
