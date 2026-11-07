# Tester briefing: Backoffice

## G1 platform and schema (developer-1)

### What changed and where

- `apps/api/wrangler.jsonc`: `BACKOFFICE_ORIGIN`, the backoffice custom-domain route (deployed blocks) and `BACKOFFICE_RATE_LIMITER` (namespaces 1005, 2005, 3005) in every block.
- `apps/api/src/operations/worker-secret.ts`, `.env.example`, `apps/api/.dev.vars.example`: `WorkerSecret` is `WHATSAPP_VERIFY_TOKEN`, the two signing keys, `WAKE_SECRET_KEY`, `NUMBER_REGISTRY_KEY`, `BACKOFFICE_KEY_DIGEST`, `BACKOFFICE_TOTP_SECRET`. The smoke inputs for the number are `SMOKE_META_APP_SECRET` and `SMOKE_PHONE_NUMBER_ID`.
- `apps/api/src/adapters/platform/aes-gcm-secret-box.ts`: the shared cipher with a `keyName`; the wake box delegates.
- `apps/api/migrations/0005_backoffice.sql`: `meta_apps`, `whatsapp_numbers`, `accounts.number_id`, `backoffice_operator`, `backoffice_sessions`, `backoffice_audit`.
- `apps/api/src/contract/{env,log,constants}.ts`, `adapters/whatsapp/whatsapp-enums.ts`: bindings, log events, operator events, session, lockout, audit and one-time-password constants. `tsconfig*.json`: Hono JSX.
- Bridge (step 5a, replaced by G3): `numbers/number-registry.ts` (port with `openTheOnlyNumber`), `numbers/number-sealing.ts`, `adapters/d1/d1-number-registry.ts`, `routes/whatsapp.ts`, `AccountInbox.createSender`, `dev/development-number*.ts`, `routes/dev-seed.ts`.
- The number bindings `META_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` are gone from `apps`, `libs`, `.agents`, `scripts` and `tools`.

### How to run

From `apps/api`: `pnpm test:unit`, `pnpm test:integration` (port 4012), `pnpm test:e2e`, `pnpm typecheck`.

### Red then green

| Step | Red | Failure text printed | Green |
|---|---|---|---|
| 1 | b36ccb4 | `expected undefined to be 'https://backoffice.zapbip.com'`, route and limiter mismatches | 7df0bde |
| 2 | abce0b4 | `expected [ 'META_APP_SECRET', ... ] to deeply equal [ 'WHATSAPP_VERIFY_TOKEN', ... ]` | 7afa00e |
| 3 | 50f9ff8 | `createAesGcmSecretBox is not implemented` | 1030415 |
| 3 pin | `aes-gcm-wake-secret-box.test.ts`, untouched, green throughout | | |
| 4 | 2c72f5f | `D1_ERROR: No SQL statements detected` (empty migration) | 3959b19 |
| 5 | 02d2f4b | three failures in `platform-contract.test.ts` | 0e677ef |
| 5a | 3bc3128 | `D1NumberRegistry.findByPhoneNumberIds is not implemented`; the old webhook suites: `Imported HMAC key length (0) must be a non-zero value` | 771710d |

`dev-seed-number.test.ts` is a pin written after the code.

### Hypotheses for the tester

- The development simulator still shows outbound messages: `DevAccountInbox` uses the in-object fake sender unless `WHATSAPP_SEND_THROUGH_GRAPH` is set (WI-17a to WI-17c).
- `POST /webhooks/whatsapp` verifies with the registry's app secret and drops a change whose `phone_number_id` is not the registered one, as before.
- `/dev/seed` registers the development number once, and never when a number already exists.
- A deployed Worker with no registered number answers `500` on the webhook and fails sends, until the operator registers one (G3 gives the page).

### Gaps

- The registry has one number in this lane: `openTheOnlyNumber` throws with zero or two. G3 replaces it.
- `openForAccount` and `openForInbound` are tested but unused until G3 step 25.
- Runbooks still name the removed secrets (G5 step 36).
- `docs/contributing/local-stack.md` gained `NUMBER_REGISTRY_KEY` in the `.dev.vars` line.

## G2 backoffice auth and shell (developer-2)

### What changed and where

- `apps/api/src/backoffice/**` (except `numbers/` and `metrics/`): host dispatch (`host-dispatch.ts`, used by `index.ts` and `index.dev.ts`), `app.ts`, `security-headers.ts`, `auth/` (TOTP, base32, sessions, sign-in, CSRF guard, step-up, failure count and lockout, rate limit, session guard), `audit/` (writer, prune), copy, layout and components, views (sign-in, home, audit, error), routes, the stylesheet.
- Shared pieces for G3: `layout.tsx` (`Layout`), `auth/require-session.ts` (`requireSession`), `auth/step-up.ts` (`verifyStepUp`, `StepUpOutcome`), `page-context.ts` (`signedInPageContext`), `error-response.tsx`, `backoffice-copy.ts` (every numbers, register, verify and metrics key is already there).
- G3 mounts its routes with one line in `app.ts` (`app.route('/', numbersRoutes)`); `/numbers`, `/numbers/*` and `/meta-apps/*` already sit behind `requireSession` and `csrfGuard`.
- `apps/api/scripts/backoffice-enroll.ts`, root scripts `backoffice:enroll:<environment>`, `uqr` 0.1.3 exact.
- `.agents/hooks/guard-deploy.sh` (`backoffice[:-]enroll`), `.agents/hooks/hooks.test.sh`, `.gitleaks.toml` (the public RFC 6238 secret, anchored).
- `apps/api/src/operations/scheduled.ts`: `ScheduledJobName.BackofficePrune`, daily at 04:00 UTC.
- `apps/api/wrangler.jsonc`: `rules` also bundle `**/*.css` as Text.

### How to run

From `apps/api`: `pnpm exec vitest run --config vitest.unit.config.mts test/unit/<file>`; integration one file at a time (port 4012): `pnpm exec vitest run --config vitest.integration.config.mts test/integration/<file>`.

### Red then green (failure text printed by the red run)

| Step | Red | Failure text | Green |
|---|---|---|---|
| 6 | 31f4b2d | `totpCodeAt is not implemented`, `encodeBase32 is not implemented` | f0e370e |
| 7 | 6839d10 | `expected 200 to be 404` | 2147994 |
| 8 | eb11193 | `handleBackofficeError is not implemented`, `expected null to be 'default-src …'` | 6cd16fe |
| 17 copy | eb64cc2 | `renderBackofficeCopy is not implemented`, missing keys | cbf356b |
| 17 layout | 685eaa7 | `Layout is not implemented` | 9ce7dc5 |
| 9 | d924cca | `the sign-in page set no csrf cookie` | 3663b3f |
| 10 | 8e0c727 | `expected [ 303, 303 ] to deeply equal [ 303, 401 ]` | 40dfb90 |
| 11 | bd94516 | `expected null to be 1794053700000`; `expected 303 to be 401` | a0262f0 |
| 12 | 6732172 | `expected 303 to be 429` | 904d675 |
| 13 | 22fd396 | `expected 303 to be 403`; `csrfTokenOf is not implemented` | d0661bd |
| 14 | c7934b5 | `expected 404 to be 303` | 396aef2 |
| 15 | 59f0796 | `verifyStepUp is not implemented` | 55007ff |
| 16 | b9a1714 | `expected 2 to be 1` (prune); sign-out audit row missing | 32346d4 |
| 17b | 6b14a58 | `expected 404 to be 303` | 52d5b1b |
| 16a | e20c484 | `expected 404 to be 200` | ab0c256 |
| 16b | c4ca964 | `expected 403 to be 404`; `stylesheetHrefFor is not implemented` | cb6704d |
| 17a | 8b6cac3 | token block count and both contrast cases | 36b5111 |
| 17 errors | 04b063a | `expected … to contain '>404 Page not found</h1>'` | 87d8e3e |
| 17c | 66c3e5e | `renderTerminalQr is not implemented` | d4a605d |
| 18 | a676cd5 | `runEnrollment is not implemented` | b1f056c |
| 19 | ab56edc | `expected exit 2, got 0` | b88d9fc |

Pins (green on landing, named as such in their commits): the MCP-host and other-port cases of step 7, the sequential replay of step 10, the reset and concurrency cases of step 11, the page and key cases of step 12, the key compare of step 13, the enum and secret-free audit cases of step 16, the notice cases of step 17b, the view cases of step 17a.

### Deviations from the plan

- Step 17 (copy, layout, error pages) was split and pulled forward: the sign-in view renders through the layout. The locale cookie switch is in 17b.
- Integration test names follow the file map (`backoffice-auth-*.test.ts`): `-headers`, `-csrf`, `-sessions`, `-lockout`, `-rate-limit`, `-step-up`, `-audit`, `-audit-page`, `-assets`, `-redirects`, `-error-pages`. The plan's `backoffice-headers.test.ts` is the unit file.
- Step-up is tested through `verifyStepUp`; the route-level cases (`POST /numbers/:id/state` without a code) belong to G3.
- `renderTerminalQr` and `runEnrollment` live in `apps/api/scripts/backoffice-enroll.ts`.
- Forms are guarded only on their own paths, so `POST /webhooks/whatsapp` on the backoffice host stays a 404.

### Hypotheses for the tester

- A signed-in browser reaches `/`, `/audit` and the language switch; sign-out deletes the session row and the old cookie redirects to `/sign-in`.
- Ten failures lock for 15 minutes with one `sign_in.locked` row; re-running enrollment resets it.
- No page carries a script or an inline style, and every response carries the ten headers.
- Enrollment off a terminal prints `backoffice:enroll needs an interactive terminal` and runs nothing. Development prints the two `NAME=value` lines for `apps/api/.dev.vars`.
- `__Host-` cookies over `http://backoffice.localhost` are untested in a browser (known risk 5).

### Gaps

- The numbers, register, verify and metrics pages do not exist (G3, G4); the nav links to them.
- The error pages show no navigation, even with a session.
- `design.md` states the audit table shows a short target ID; the page shows the stored ID as is.
