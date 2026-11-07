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

### Tester findings fixed (step 40)

| Item | Red | Failure text printed | Green |
|---|---|---|---|
| 1 post, redirect, get | 760841ef | `the rejected form answered 401 without a Location`; `expected 401 to be 303` | cb96679e |
| 2 duplicate is 409 | e3bdb700 | `expected 422 to be 409` | edf0c43c |
| 3 favicon | 7b059ceb | favicon routes answer 404; layout lacks `<link rel="icon">` | 2a5fe2dc |
| 4 audit at 375 | f879b997 | stylesheet has no `.data-table .mono` with `overflow-wrap: anywhere` | ee1be832 |
| 5 forwarded headers | b674e1d1 | pin | |
| 6 lockout literals, Secure | 64d80c38 | pin | |
| 7 step-up audit label | 266137f9 | `expected ... to contain 'Código de confirmação recusado'` | fa771a68 |

The flash lives in `backoffice_sessions.flash` (migration `0006_backoffice_flash.sql`); the redirected GET answers the stored status (401, 409 or 422). The walk now expects `/sign-in?notice=SignInFailed` after a failed sign-in.

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

## G3 numbers registry and channel (developer-3)

### What changed and where

- Registry write side: `numbers/number-registry.ts` (port: `registerMetaApp`, `registerNumber`, `registerNumberWithNewMetaApp`, `findNumber`, `transition`), `numbers/number-admin.ts` and `adapters/d1/d1-number-admin.ts` (list, verification record, credential replacement), `numbers/number-state.ts`, `numbers/registration-conflict.ts`, `numbers/graph-error-kind.ts`, `numbers/number-verification.ts`, `numbers/number-notice.ts`, `numbers/sendable-number.ts`.
- Webhook: `adapters/whatsapp/webhook-routing-peek.ts`; `routes/whatsapp.ts` attributes each delivery to one number and one Meta app, verifies with that app's secret, answers `401 {"error":"unauthorized"}` for an unknown number, two apps, bad JSON and a bad signature; `pending` and `disabled` numbers are acknowledged and ignored.
- Accounts: `libs/core` `openOwnerAccount` takes `homeNumberId`, `AccountRecord.homeNumberId`, `ownerLocaleOf`; `d1-account-directory.ts` writes `number_id` in the account insert; `inbound/owner-inbound.ts` refuses a new owner on a closed number and answers an owner of another number from the receiving number.
- Outbound: `cloud-api-message-sender.ts` takes `resolveNumber` and `channelOf`; `AccountInbox.createSender` resolves the number of the account on every send.
- Registration backfill: the first registered number binds every account without a number in the same batch.
- Pages: `apps/api/src/backoffice/numbers/**` (list, register, detail, verify, verification result, state, access token, app secret); one line in `backoffice/app.ts`.
- Shared: `IdPrefix.Number` and `IdPrefix.MetaApp`, `HttpStatus.UnprocessableEntity`, `LogFields.numberId`.

### How to run

From `apps/api`, integration one file at a time (port 4012): `pnpm exec vitest run --config vitest.integration.config.mts test/integration/<file>`. G3 files: `number-registry*.test.ts`, `whatsapp-webhook-numbers.test.ts`, `whatsapp-webhook-number-states.test.ts`, `whatsapp-webhook-account-binding.test.ts`, `whatsapp-webhook-media-number.test.ts`, `number-outbound.test.ts`, `backoffice-numbers*.test.ts`; unit: `webhook-routing-peek`, `number-state`, `graph-request-error-kind`, `number-verification`, `backoffice-registration-form`.

### Red then green (failure text printed by the red run)

| Step | Red | Failure text | Green |
|---|---|---|---|
| 20 | 5a7de37 | `registerMetaApp is not implemented` (3 of 5) | d7b0a0c |
| 21 | 8f7887f3 | `assertNumberTransition is not implemented` (17), `transition is not implemented` (5) | f1e6507a |
| 22 | b47495f2 | `peekWebhookRouting is not implemented` (29 of 30) | e45f6f6d |
| 23 | caeee131 | `Error: more than one WhatsApp number is registered`, `expected 500 to be 200` (8 of 8) | 063cd454 |
| 24 | 60ce415f | `expected [ 'Oi' ] to deeply equal []`; `expected 1 to be +0` | a900a9a1 |
| 25 | b9dbc521 | `expected null to be 'num_test'`; `expected [ 'Oi' ] to deeply equal []`; `expected [Function] to throw error including 'acc_unbound' but got 'no entry expected'` | b9e5155d (+ 4035e3b5) |
| 26 | 38de3968 | `more than one WhatsApp number is registered` (6 of 6) | 2517c98c |
| 27 | pin 43e143f9 | green on landing | |
| 28 | 92d4d9b3 | `expected [ null, null ] to deeply equal [ …(2) ]` (the second-number case is a pin) | cd98d2c0 |
| 29a | 5c00fee1 | `graphErrorKindOf is not implemented` (8 of 8) | 0cdba2b9 |
| 30 | 9d083703 | `expected 404 to be 200/303/401/422/429` (35 of 38) | 3191866a |

Pins: 43e143f9, `number-registry-state` second-number case, 99501b0a (form rules and snapshot), 0e2500d2 (logs).

`whatsapp-webhook.test.ts` expectations that changed: WI-23 (`400` → `401`), the signed JSON body without an entry array (`400` → `401`), WI-27 and WI-31 (`200` → `401`, event `inbound.unattributed`).

### Hypotheses for the tester

- A delivery for an unregistered number, for two Meta apps, with bad JSON or a bad signature answers the same `401` body; a registered `pending` or `disabled` number answers `200` and stores nothing.
- A new owner on a `closed` number gets one text from that number and no account; an owner whose account is on another number gets that number's display number and is not routed.
- Two numbers send with their own token, a rotated token is used on the next send, and a restriction on one `phone_number_id` does not pause the other.
- Register, verify, activate, close, disable and re-close work from the browser; each action needs a fresh code and the response never carries the token or the app secret.
- A verify against Meta shows the four template rows; a mismatch or a Graph error shows its copy and leaves `verified_at` as it was.

### Gaps and deviations

- Files outside the G3 map that changed: `libs/types/src/enums.ts` (`IdPrefix`, `HttpStatus.UnprocessableEntity`), `contract/log.ts` (`numberId`), `routes/dev-owner.ts` (passes the only number), `outbound-builders.ts` (two exported constants), `backoffice/app.ts` (one line), `test/support/seed.ts` (`numberId`), many integration suites (they seed the registered number).
- `openTheOnlyNumber` stays for the development simulator only; no production path calls it.
- A webhook with a wrong or missing `NUMBER_REGISTRY_KEY` answers `500`, not `401` (the app secret open throws); Meta retries either way.
- "Last changed" for the access token is the number's `updated_at`, so a state change also moves it.
- The state form does not keep the chosen radio after a failed step-up.
- `INVALID_JSON_BODY` in `contract/constants.ts` is now unused (G1 file).
- The numbers pages reuse G2's stylesheet classes; `dl` and the template table have no dedicated styles.
- The `AccountOnOtherNumber` text is filled with `fillCopyTokens`, not `renderCopy`.

## G5 deploy, smoke, runbooks and rules

| Step | Red | Failure text | Green |
|------|-----|--------------|-------|
| 34 | pin 4968aca0 | green on landing | |
| 35 | pin 21947d9b | green on landing | |
| 36 | 43d565c3 | `deploy.md lists the go-live steps in order`: `expected [ 'Prepare your machine', …(15) ] to deeply equal [ 'Prepare your machine', …(24) ]` | 448a56fe |
| 37 | | | 448a56fe |

### Hypotheses for the tester

- `deploy.md` lists 25 go-live steps in the order secrets, migrate, enroll, deploy, register, webhook, smoke for both environments, and no runbook names `META_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN` or `WHATSAPP_PHONE_NUMBER_ID`.
- Following `backoffice.md` by hand enrolls, signs in, registers, verifies and activates a number.
- `dig` and `curl` on the backoffice host of `dns.md` step 3 work after a deploy.

### Gaps and deviations

- Production gets its own "Production resources and secrets" go-live step, because the secrets must precede the migration; the plan listed only the split of the deploy step.
- The sealed-column isolation test also allows `d1-number-admin.ts` and `development-number-seed.ts`, the writers of those columns, beyond the spec's list.
- `docs/features/README.md` already carried the backoffice row. The smoke inputs `SMOKE_META_APP_SECRET` and `SMOKE_PHONE_NUMBER_ID` stay (they are smoke inputs, not Worker secrets); no `.env.example` line named a removed Worker secret.

## G6 browser specs (developer-6)

### What changed and where

- `apps/api/playwright.config.ts`: two projects (`desktop` 1280x800, `mobile` 375x812), one worker, locale `pt-BR`, results under the system temporary folder.
- `apps/api/e2e/backoffice/global-setup.ts`: migrates a throwaway D1, starts the fake Graph and `wrangler dev --env development` on free ports with the test operator credentials, then exports the origin through `support/walk-environment.ts`.
- `apps/api/e2e/backoffice/fixtures.ts`: a unique `cf-connecting-ip` per test (the development limiter allows 5 a minute per address), a clean registry before each test, and a guard that fails a test on any console error or warning, page error or failed request, which includes every CSP block. A failing document response (401, 403, 404, 429) accounts for its own "Failed to load resource" line.
- `apps/api/e2e/backoffice/support/operator-database.ts`: opens the Miniflare D1 file with `node:sqlite` to reset the TOTP step and the lockout, so each act can use the current code.
- Specs: `sign-in.spec.ts`, `numbers.spec.ts`, `error-pages.spec.ts`. `scripts/verify-gates.tsv`: `apps/api/e2e/*` runs `typecheck` only; the browser walk is not a gate.
- Product fix outside the lane: `Referrer-Policy: no-referrer` made Chromium send `Origin: null` on every form post, so the CSRF check refused every sign-in. It is `same-origin` now in `backoffice-constants.ts`, `backoffice-headers.test.ts`, `spec.md` and `design.md`.

### How to run

From `apps/api`: `pnpm test:walk` (needs the Playwright Chromium; no fixed port; port 4012 is not used).

### Red then green

| Step | Red | Failure text printed | Green |
|---|---|---|---|
| 38 | c38ca2e8 | `getByRole('heading', { name: 'Visão geral' })` not found; page showed `403 Pedido recusado`; wrangler log `backoffice.csrf_rejected`; request header `origin: "null"` | 40d35cac |
| 39 | fb50c691 | the same 403 on the first registration | 40d35cac, 319e2cda |

### Hypotheses for the tester

- Sign-in, sign-out, a wrong code and the 10-failure lockout behave as `design.md` says at both widths.
- Register, verify, activate, replace token and replace secret each refuse a wrong step-up code and never print a credential.
- The 404, 403 and 429 pages render with their headings; 401 page is walked by a post without a session; the 500 page is covered by integration only.

### Gaps and deviations

- `env.development` now carries `"routes": []` so `wrangler dev` keeps the request host; the walk needs no `--local-upstream`.
- The lockout and 429 specs rotate or share the client address through a request header, which only works because the development Worker trusts `cf-connecting-ip` as sent.
- `metrics.spec.ts` waits for G4.
- The walk shares one database across the two projects and cleans only the registry, audit and sessions.
