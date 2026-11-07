# Plan: Backoffice

**Spec:** spec.md
**Tier:** 🔴
**Seam:**
- the Worker `fetch` host dispatch (`apps/api/src/index.ts`);
- the `NumberRegistry` port replacing `read-whatsapp-env.ts` number fields in `routes/whatsapp.ts` and `AccountInbox.createSender`;
- `openOwnerAccount`'s `homeNumberId`;
- a new `DueTimeProvider` beside the v7 usage provider.

**Assumptions (decided, owner can override):**
- `feat/install-skills` (PR #9) and `feat/deploy-readiness` (PR #13) are merged; the lane branches `feat/backoffice` from `origin/main` at `273e1a2`.
- No deployed environment holds accounts yet, so `accounts.number_id` is added nullable and bound by the first registration. The red tests prove that path; no production backfill exists.
- The next D1 migration is `0005` and the next Durable Object migration is `v8`: `origin/main` holds D1 `0001`–`0004` and Durable Object `v1`–`v7` (`0003` and `v7` come from deploy-readiness).
- ADR 0031 is accepted and ADR 0032 (numbers registry) is written before any G3 code.
- `design.md` is written by a `frontend-designer` sub-agent and answered by the owner before G2 renders pages.
- G1 merges with typecheck, unit, integration and e2e green: step 5a (the fixture update that was step 29) lands inside G1 together with a bridge, so no lane lands red. G3 replaces the bridge.
- The go-live order is secrets → migrate → enroll → deploy → register number → point the Meta webhook → smoke (step 36).

## File map

Paths marked (new) do not exist on `origin/main` at `273e1a2`; every other path does.

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 platform and schema | `apps/api/migrations/0005_backoffice.sql` (new), `apps/api/src/contract/env.ts`, `apps/api/src/contract/log.ts`, `apps/api/src/contract/constants.ts`, `apps/api/src/operations/worker-secret.ts`, `apps/api/wrangler.jsonc`, `apps/api/src/adapters/platform/aes-gcm-secret-box.ts` (new), `apps/api/src/adapters/wake/aes-gcm-wake-secret-box.ts`, `apps/api/vitest.*.config.mts`, `apps/api/test/support/workers-env.ts`, `apps/api/tsconfig.json`, `.env.example`, `apps/api/.dev.vars.example`, `apps/api/test/unit/wrangler-config.test.ts`, `apps/api/test/unit/wrangler-rate-limit-namespaces.test.ts`, `apps/api/test/unit/env-example.test.ts`, `apps/api/test/unit/aes-gcm-secret-box.test.ts` (new), `apps/api/test/integration/migration-0005.test.ts` (new), the secret-name removals of step 2 (`apps/api/src/dev/dev-account-inbox.ts`, `apps/api/src/operations/smoke-inputs.ts`, `apps/api/src/operations/smoke-checks.ts`, `apps/api/test/unit/smoke-*.test.ts`, `apps/api/test/unit/fake-smoke-stack.ts`, `apps/api/test/unit/terminal-shell.test.ts`, the sample on line 118 of `.agents/hooks/hooks.test.sh`), and the step 5a bridge (`apps/api/src/numbers/number-registry.ts` (new, the port), the read side of `apps/api/src/adapters/d1/d1-number-registry.ts` (new), `apps/api/test/support/whatsapp-numbers.ts` (new), every existing test that reads the removed bindings, the two `global-setup.ts` files, `apps/api/src/dev/build-directory-seed.ts`, `apps/api/src/routes/dev-seed.ts`) | `developer-1` |
| G2 backoffice auth and shell | `apps/api/src/backoffice/**` (new) except `apps/api/src/backoffice/numbers/**` (new) and `apps/api/src/backoffice/metrics/**` (new); `apps/api/src/index.ts`, `apps/api/src/index.dev.ts`; `apps/api/scripts/backoffice-enroll.ts` (new); `apps/api/src/operations/scheduled.ts` (prune job); root `package.json` scripts; `.agents/hooks/guard-deploy.sh`, `.agents/hooks/hooks.test.sh`; `apps/api/test/unit/backoffice-*.test.ts`, `apps/api/test/integration/backoffice-auth*.test.ts`, `apps/api/test/integration/backoffice-host.test.ts`, `apps/api/test/unit/operator-enrollment-entry.test.ts`, `apps/api/test/unit/operator-enrollment-qr.test.ts` (new), `apps/api/package.json` (the `uqr` devDependency only) and `pnpm-lock.yaml`, `apps/api/src/backoffice/assets/backoffice.css` (new) | `developer-2` |
| G3 numbers registry and channel | `apps/api/src/numbers/**` (new), `apps/api/src/adapters/d1/d1-number-registry.ts` (new), `apps/api/src/adapters/d1/d1-account-directory.ts`, `apps/api/src/adapters/whatsapp/read-whatsapp-env.ts`, `apps/api/src/adapters/whatsapp/webhook-routing-peek.ts` (new), `apps/api/src/adapters/whatsapp/cloud-api-message-sender.ts`, `apps/api/src/adapters/whatsapp/whatsapp-copy.ts`, `apps/api/src/adapters/whatsapp/whatsapp-enums.ts`, `apps/api/src/routes/whatsapp.ts`, `apps/api/src/inbound/owner-inbound.ts`, `apps/api/src/account-inbox/account-inbox.ts`, `libs/core/src/accounts/**` (the `openOwnerAccount` input and `AccountDirectory` port), `apps/api/src/dev/build-directory-seed.ts`, `apps/api/src/routes/dev-seed.ts`, `apps/api/src/backoffice/numbers/**` (new), `apps/api/test/support/whatsapp-numbers.ts` (new), every existing test that reads the removed bindings, `apps/api/test/e2e/whatsapp-support/global-setup.ts`, `apps/api/test/e2e/global-setup.ts`, new `apps/api/test/integration/number-registry*.test.ts`, `apps/api/test/integration/whatsapp-webhook-numbers.test.ts`, `apps/api/test/integration/backoffice-numbers.test.ts` | `developer-3` |
| G4 metrics (PR B) | `apps/api/src/account-inbox/migrations/v8.sql` (new), `apps/api/src/account-inbox/migrations/index.ts`, `apps/api/src/account-inbox/activity-ledger.ts` (new), `apps/api/src/account-inbox/activity-provider.ts` (new), `apps/api/src/contract/activity-metric.ts` (new), `apps/api/migrations/0007_activity.sql` (new; 0006 is `0006_backoffice_flash.sql`, so G4's activity migration is 0007), `apps/api/src/adapters/d1/d1-activity-repository.ts` (new), `apps/api/src/backoffice/metrics/**` (new), `apps/api/test/integration/activity-*.test.ts`, `apps/api/test/integration/backoffice-metrics.test.ts`; the `recordActivity` calls in `account-inbox.ts` after G3's commit to that file lands | `developer-4` |
| G5 deploy, smoke, runbooks and rules | `apps/api/src/operations/smoke-checks.ts` (check 5's payload only; the input renames are in G1 step 2), `apps/api/src/operations/deploy-preflight.ts` (only if the enum change is not enough), `tools/repository-shape/src/runbooks.test.ts` (`GO_LIVE_ORDER`), `docs/runbooks/README.md`, `docs/runbooks/meta-setup.md`, `docs/runbooks/deploy.md`, `docs/runbooks/dns.md`, `docs/runbooks/backoffice.md` (new), `.claude/rules/backoffice.md` (new), `apps/api/README.md`, `docs/scenarios/backoffice.md` (new), `docs/features/README.md` row, `tools/repository-shape/src/backoffice-isolation.test.ts` (new), `apps/api/test/unit/smoke-*.test.ts` | `developer-5` |
| G6 browser specs | `apps/api/playwright.config.ts` (new), `apps/api/e2e/backoffice/**` (new), `apps/api/package.json` (`test:walk`, `@playwright/test`; edited only after G2's step 17c commit, so the two `package.json` edits and the lockfile never conflict), `scripts/verify-gates.tsv` row for `apps/api/e2e/*` | `developer-6` |

## Sequencing

- **G0, the lead, before any developer.**
  - Owner answers the pending rows of the spec (done under the owner's delegation, see Step 0a).
  - ADR 0031 accepted; ADR 0032 written.
  - `design.md` approved.
  - Dependencies approved by the owner's delegation of 2026-11-06: `uqr`, and `@playwright/test` in `apps/api` (pinned when G6 adds it; not in the lockfile today).
  - A reviewer reviews this plan and the test plan.
- **G1 first, alone.** Every other group needs its bindings, migration, enums and secret box. G1 ends with step 5a, so it merges with integration and e2e green.
- **G2 and G3 in parallel after G1 merges.** G3's backoffice pages under `apps/api/src/backoffice/numbers/**` need G2's layout, session and step-up helpers. G2 lands `backoffice/layout.tsx`, `backoffice/auth/require-session.ts` and `backoffice/auth/step-up.ts` as its first commits. G3 merges G2 at its next task boundary before step 20.
- **G5 after G3.** The smoke and runbooks describe the registry. The isolation test can start with G2.
- **PR A** = G1 + G2 + G3 + G5 + G6 specs for sign-in and numbers.
- **G4 (PR B) starts after PR A's `account-inbox.ts` change is on the lane.** It touches the same file, and G3 owns it until then. G6 adds the metrics spec with G4.

## Steps

Author this list with every box empty. A sub-agent ticks its own line. A wrong step is struck through with the reason, not deleted.

### G0 (lead)

- [x] **Step 0a:** owner answers the pending open questions; spec status → `Approved`; the index row in `docs/features/README.md` matches. — evidence: spec header `**Status:** Approved`; every open-question row answered with its recommended option under the owner's delegation of 2026-11-06; `docs/features/README.md` row `backoffice` `Approved`.
- [x] **Step 0b:** ADR 0031 status → `Accepted`, row in `docs/adr/README.md` in number order; ADR 0032 written at 0032 (0030 belongs to docs-experience, not merged) and accepted. — evidence: `docs/adr/0031-the-backoffice-is-a-separate-host-signed-in-with-a-key-and-totp-enrolled-from-the-owners-terminal.md` and `docs/adr/0032-whatsapp-numbers-are-rows-in-a-sealed-registry-not-worker-secrets.md` both `- Status: Accepted`; both rows in `docs/adr/README.md` after 0029; the document-indexes test in `pnpm verify`.
- [x] **Step 0c:** `frontend-designer` writes `docs/features/backoffice/design.md`: sign-in, the numbers list, empty, single and many, register, verify result, rotate, state change, metrics, audit, the error pages, at 1280 and 375. Owner answers. — evidence: design.md 785a4d8
- [x] **Step 0d:** reviewer sub-agent reviews `plan.md` and `test-plan.md` with the lens "what is missing or ambiguous"; findings fixed. — evidence: reviewer FIX FIRST, 12 findings resolved in 299f77a

### G1 platform and schema

- [x] **Step 1:** red: `wrangler-config.test.ts` expects each deployed block to have:
  - a `BACKOFFICE_ORIGIN` var;
  - a backoffice custom-domain route;
  - `BACKOFFICE_RATE_LIMITER` with namespaces 1005, 2005 and 3005;
  - development `BACKOFFICE_ORIGIN = http://backoffice.localhost:8787`.

  Then edit `wrangler.jsonc`. — evidence: red b36ccb4 → green 7df0bde (the `wrangler-config.test.ts` pins that asserted a single route now assert the two routes; `wrangler-rate-limit-namespaces.test.ts` expects five limiters).
- [x] **Step 2:** red: `env-example.test.ts` expects `WorkerSecret` to equal `WHATSAPP_VERIFY_TOKEN`, `MEDIA_LINK_SIGNING_KEY`, `UPLOAD_LINK_SIGNING_KEY`, `WAKE_SECRET_KEY`, `NUMBER_REGISTRY_KEY`, `BACKOFFICE_KEY_DIGEST` and `BACKOFFICE_TOTP_SECRET`; `smoke-inputs.test.ts` expects `SmokeInput.AppSecret = SMOKE_META_APP_SECRET` and `SmokeInput.PhoneNumberId = SMOKE_PHONE_NUMBER_ID`. Then, in one commit:
  - edit `worker-secret.ts`, `.env.example`, `.dev.vars.example` and `Bindings`; remove `META_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` from `Bindings`;
  - rename the `SmokeInput` values in `smoke-inputs.ts`, the placeholder in `smoke-checks.ts:12` and in `fake-smoke-stack.ts:13` to `SMOKE_META_APP_SECRET`;
  - replace the sample secret name in `terminal-shell.test.ts:9` and `hooks.test.sh:118` with `NUMBER_REGISTRY_KEY`;
  - remove the `WHATSAPP_ACCESS_TOKEN` fake-or-real switch in `dev-account-inbox.ts:25`: development `WHATSAPP_GRAPH_BASE_URL` points at the local fake Graph and the development registry seeds a fake number (phone number ID `1000000000000001`), so the real sender runs against the fake Graph;
  - the bindings removal breaks compilation in G3 files, so the lead lands step 2 together with step 5a's bridge (not a throwing stub), and typecheck stays green.
  - evidence: red abce0b4 → green 7afa00e. Deviation: the green covers the enum, the examples, the smoke renames and the sample names; the removal of the three bindings from `Bindings` and the dev-account-inbox switch landed with step 5a (771710d), because both need the registry bridge to compile. The new bindings (`NUMBER_REGISTRY_KEY`, `BACKOFFICE_KEY_DIGEST`, `BACKOFFICE_TOTP_SECRET`, `BACKOFFICE_ORIGIN`, `BACKOFFICE_RATE_LIMITER`) are in `Bindings` from 7afa00e.
- [x] **Step 3:** pin `aes-gcm-wake-secret-box.test.ts` as-is (`pin`). Red: `aes-gcm-secret-box.test.ts` covers seal and open round trip, associated-data mismatch → `null`, wrong version byte → `null`, and a wrong-length key → the error naming the key from the `keyName` parameter (`NUMBER_REGISTRY_KEY must be 32 bytes encoded in base64`). Then extract `aes-gcm-secret-box.ts`, whose factory takes `keyName`; the wake box delegates with `WAKE_SECRET_KEY` and the registry passes `NUMBER_REGISTRY_KEY`. The pinned test keeps expecting `WAKE_SECRET_KEY` in the wake error and stays green. — evidence: `aes-gcm-wake-secret-box.test.ts` is unchanged and green at every commit (pin); red 50f9ff8 (`createAesGcmSecretBox is not implemented`) → green 1030415.
- [x] **Step 4:** red: `migration-0005.test.ts` checks that:
  - the migration applies on top of `0001`–`0004`;
  - `backoffice_operator` has exactly the row `(1, 0, 0, NULL)`;
  - `whatsapp_numbers.state` refuses `bogus`;
  - `whatsapp_numbers.verification_snapshot` and `accounts.number_id` exist and are nullable.

  Then write `0005_backoffice.sql`. — evidence: red 2c72f5f (`D1_ERROR: No SQL statements detected`, the migration file was empty) → green 3959b19. Deviation: `migration-0005.test.ts` lives in `apps/api/test/integration/`, because D1 needs the Workers pool; the unit config is plain Node.
- [x] **Step 5:** add the test bindings: a 32-byte zero `NUMBER_REGISTRY_KEY`, the `BACKOFFICE_KEY_DIGEST` of a fixed test key, and a fixed base32 `BACKOFFICE_TOTP_SECRET`. Remove the three number bindings and `whatsappTestEnv`. Add the `LogEvent`, `OperatorEvent` and constants (`BACKOFFICE_SESSION_IDLE_MS`, `BACKOFFICE_SESSION_MAX_MS`, `BACKOFFICE_LOCKOUT_THRESHOLD`, `BACKOFFICE_LOCKOUT_MS`, `BACKOFFICE_AUDIT_RETENTION_MS`, `TOTP_PERIOD_MS`, `TOTP_DIGITS`, `TOTP_WINDOW_STEPS`). Set `jsx` and `jsxImportSource` in `tsconfig.json`. — evidence: red 02d2f4b (`platform-contract.test.ts`, three failures) → green 0e677ef. Deviations: the three number bindings and `whatsappTestEnv` were removed in step 5a, not here, because the existing suites read them; `tsconfig.test.json` got the same JSX settings; `OperatorEvent` lives in `adapters/whatsapp/whatsapp-enums.ts` (a G3 path, edited while G1 runs alone); `vitest.integration.config.mts` imports `DeployEnvironment` instead of `contract/constants`, because the config runs in plain Node and `contract/constants` now imports `@zapbip/types`; `test/support/backoffice-credentials.ts` holds the fixed test key, its digest and the TOTP secret for G2.
- [x] **Step 5a:** (folded in from the former step 29, so G1 merges green) red: `git grep -nwE "META_APP_SECRET|WHATSAPP_ACCESS_TOKEN|WHATSAPP_PHONE_NUMBER_ID" apps libs .agents scripts tools` lists a hit for every file the removal touches, and `pnpm --filter @zapbip/api test:integration` fails with `<NAME> is not set`. Then:
  - the `NumberRegistry` port and the read side of `d1-number-registry.ts` (`findByPhoneNumberIds`, `findByWabaIds`, `openAppSecret`, `openForAccount`, `openForInbound`) over the shared box;
  - `seedWhatsAppNumber()` in `test/support/whatsapp-numbers.ts`, inserting sealed rows; the dev seed and `/dev/seed` register the fake number;
  - every existing integration and e2e test, and both `global-setup.ts` files, move to `seedWhatsAppNumber()`;
  - the bridge: `routes/whatsapp.ts` and `AccountInbox.createSender` read the one seeded number through the registry, with today's single-number checks. G3 steps 22 to 26 replace the bridge.
  - Proof: the grep lists nothing, and `pnpm --filter @zapbip/api test:integration` and `test:e2e` are green.
  - evidence: red 3bc3128 (`registry-read-side.test.ts`: `D1NumberRegistry.* is not implemented`; the old webhook suites failed with `Imported HMAC key length (0)` because the number bindings were gone) → green 771710d.
  - Bridge decisions: the port gained `openTheOnlyNumber()` (throws when zero or more than one number is registered), used by `routes/whatsapp.ts` and `AccountInbox.createSender`, which now returns a sender that opens the number on every send. G3 steps 22 to 26 replace it. `openForAccount` and `openForInbound` are implemented and tested but unused by the bridge, because no account has `number_id` until G3 step 25.
  - Simulator: the simulator's outbound view reads the in-object fake sender, which cannot see what the fake Graph recorded. So `DevAccountInbox` keeps the fake sender unless the development-only binding `WHATSAPP_SEND_THROUGH_GRAPH` is set (the whatsapp e2e global setup and `whatsappTestEnv` set it). The number cannot carry a Graph URL, so the choice is not by the number. `WI-17a` to `WI-17c` pin it.
  - `/dev/seed` registers the development number (`src/dev/development-number.ts`, credentials shared with the whatsapp e2e constants) only while the registry is empty; `route-fixtures.ts` seeds the default test number once per file; both `global-setup.ts` files pass `NUMBER_REGISTRY_KEY`; `dev-seed-number.test.ts` is a pin written after the code.

### G2 backoffice auth and shell

- [x] **Step 6:** red: `backoffice-totp.test.ts` runs the RFC 6238 SHA-1 vectors truncated to 6 digits, the ±1 step window, step ≤ `lastStep` → `null`, and a non-numeric or 5-digit code → `null`. Then `auth/totp.ts`. — evidence: red 31f4b2d → green f0e370e. The RFC base32 secret is allowlisted in `.gitleaks.toml` (c51a4b4).
- [x] **Step 7:** red: `backoffice-host.test.ts`:
  - the backoffice host `GET /c/<secret>/mcp`, `GET /health`, `POST /webhooks/whatsapp` and `GET /i/<code>` → `404`;
  - the MCP host `GET /sign-in`, `GET /numbers` and `GET /assets/backoffice.css` → `404`;
  - host case is ignored: `BACKOFFICE.LOCALHOST:8787` is served as the backoffice (hosts are case-insensitive, RFC 3986);
  - a different port is not the backoffice: `backoffice.localhost:8788` → the MCP app;
  - a trailing dot is rejected: `backoffice.localhost.:8787` answers `404` on `/sign-in` and on `/health`, with the backoffice headers, and neither app runs.

  Then the host dispatch in `index.ts` and `index.dev.ts` (lowercased host and port compared to `BACKOFFICE_ORIGIN`; a trailing-dot variant → `404`), plus `backoffice/app.ts` with `notFound`. — evidence: red 6839d10 (`expected 200 to be 404`) → green 2147994. Deviation: the tests live in `backoffice-host.test.ts` for both entries; the trailing-dot headers are asserted in `backoffice-auth-headers.test.ts`.
- [x] **Step 8:** red: `backoffice-headers.test.ts` checks every header in the spec on `200` (`/sign-in`), `303`, `401`, `403`, `404`, `429` and a forced `500`. Then `backoffice/security-headers.ts` as middleware, plus `onError`. — evidence: red eb11193 (`securityHeaders is not implemented`, `expected null to be 'default-src …'`) → green 6cd16fe. Deviation: the header matrix over 200, 303, 401, 403, 404, 429 and 500 is the unit test `backoffice-headers.test.ts`; the real-app 404 and trailing-dot checks are in `backoffice-auth-headers.test.ts`.
- [x] **Step 9:** red: `backoffice-auth.test.ts`:
  - correct key and code → `303` to `/` with a `__Host-zb_bo_session` cookie carrying `Secure`, `HttpOnly`, `SameSite=Strict` and `Path=/`, and one session row holding a digest that is not the cookie value;
  - wrong key, wrong code or both → `401` with the same body byte for byte.

  Then `auth/sign-in.ts`, `auth/sessions.ts` and `views/sign-in.tsx`. — evidence: red d924cca (`the sign-in page set no csrf cookie`) → green 3663b3f. Deviation: the layout and copy (step 17) were pulled forward first (copy red eb64cc2 → green cbf356b, layout red 685eaa7 → green 9ce7dc5), because the sign-in view renders through the layout.
- [x] **Step 10:** red: replay. The same valid code twice → the second `401`. Two concurrent sign-ins with one code → exactly one `303`. Then the conditional `UPDATE`. — evidence: red 8e0c727 (`expected [ 303, 303 ] to deeply equal [ 303, 401 ]`; the sequential replay is a pin) → green 40dfb90.
- [x] **Step 11:** red: lockout.
  - 9 failures → `locked_until` still `NULL`; the 10th failure sets `locked_until = now + BACKOFFICE_LOCKOUT_MS` exactly and writes audit `sign_in.locked` once.
  - The 11th attempt with correct factors → `401`, `failed_attempts` unchanged, and no second `sign_in.locked`.
  - After `BACKOFFICE_LOCKOUT_MS` on the fake clock, a wrong attempt → `failed_attempts` 1 (the expired lock reset the count); a correct attempt → `303` and `failed_attempts` 0.
  - A success after 5 failures resets `failed_attempts` to 0.
  - 5 concurrent failures → `failed_attempts` 5 (no lost increment).

  Then the lockout logic as the single `UPDATE … SET failed_attempts = failed_attempts + 1, locked_until = CASE … END RETURNING …` of the spec, and the expired-lock reset. — evidence: red bd94516 (`expected null to be 1794053700000`, `expected 303 to be 401`) → green a0262f0. The audit writer landed here (needed by `sign_in.locked`); the concurrency and reset cases are pins.
- [x] **Step 12:** red: the rate limit. With `fake-rate-limiter.ts` refusing → `429` and `Retry-After: 60`, and no D1 write. Then wire `BACKOFFICE_RATE_LIMITER` and `clientRateKey`. — evidence: red 6732172 (`expected 303 to be 429`) → green 904d675.
- [x] **Step 13:** red: `backoffice-csrf.test.ts`. A POST is refused with `403` and no state change when:
  - `Origin` is missing;
  - `Origin` is `https://evil.example`;
  - the `csrf` field is missing;
  - the `csrf` field belongs to another session;
  - the sign-in `csrf` does not match its cookie.

  Then `auth/csrf.ts`. — evidence: red 22fd396 (`expected 303 to be 403`, `csrfTokenOf is not implemented`) → green d0661bd.
- [x] **Step 14:** red: sessions. Idle 31 min → redirect to `/sign-in`. Age 8 h 1 min → redirect. Sign-out deletes the row, and the old cookie → redirect. `last_seen_at` is written at most once per minute. Then `require-session.ts`. — evidence: red c7934b5 (`expected 404 to be 303`) → green 396aef2. The home page and `page-context.ts` landed here because the guard needs a protected page. Deviation: test names are `backoffice-auth-sessions.test.ts`.
- [x] **Step 15:** red: step-up.
  - A number action with a valid session but no code, or a reused code → `401`, no change.
  - A wrong step-up code → `401`, `failed_attempts` + 1, audit `step_up.failed`.
  - 10 wrong step-up codes → `locked_until` set and `sign_in.locked` audited once; then a correct step-up code → `401` without consuming the code, and a sign-in with correct factors → `401`.
  - A successful step-up resets `failed_attempts` to 0.
  - With the rate limiter refusing the `step-up:` key → `429`, `Retry-After: 60`, no code consumed, no D1 write.

  Then `auth/step-up.ts`, sharing the atomic increment with sign-in. — evidence: red 59f0796 (`verifyStepUp is not implemented`) → green 55007ff. Deviation: step-up is tested at the function level (`backoffice-auth-step-up.test.ts`), because the number routes belong to G3; G3 adds the route-level cases.
- [x] **Step 16:** red: the audit log. Each action in `BackofficeAuditAction` writes one row with no submitted value (the test greps the row for the key, the code and the token). The scheduled prune deletes expired sessions and audit rows older than 365 days. Then `audit/*.ts` and the `ScheduledJobName.BackofficePrune` entry. — evidence: red b9a1714 (`expected [ 'sign_in.failed', … ] to deeply equal [ …, 'sign_out' ]`, `expected 2 to be 1`) → green 32346d4. Deviation: the prune runs daily at 04:00 UTC (`BACKOFFICE_PRUNE_HOUR`).
- [x] **Step 17:** red: `backoffice-copy.test.ts`. Both locales have every `BackofficeCopyKey`. No JSX file holds a string literal child (a source scan like `no-interpolated-sql.test.ts`). The locale cookie switch works. Then `backoffice-copy.ts`, `layout.tsx` and `views/home.tsx`. — evidence: copy red eb64cc2 → green cbf356b; layout red 685eaa7 → green 9ce7dc5; error pages red 04b063a → green 87d8e3e; home view in 396aef2; the locale cookie switch is in step 17b. Deviation: the error pages show no navigation, even with a session.
- [x] **Step 16a:** red: `backoffice-audit-page.test.ts`. With 250 audit rows seeded, `GET /audit` → `200`, exactly 200 rows, newest first, the oldest 50 absent; without a session → `303 /sign-in`. Then `GET /audit`. — evidence: red e20c484 (`expected 404 to be 200`) → green ab0c256.
- [x] **Step 16b:** red: `backoffice-assets.test.ts`. `GET /assets/backoffice.css` without a session → `200`, `Content-Type: text/css; charset=utf-8`, `Cache-Control: public, max-age=31536000, immutable`, and the other nine headers present; the body has no `@import`, no `url(` to another origin and no `data:`; the page links `/assets/backoffice.css?v=<hash>` and the hash changes when the file does; `POST /assets/backoffice.css` → `404`. Then the asset route and the exception in `security-headers.ts`. — evidence: red c4ca964 (`expected 403 to be 404`, `stylesheetHrefFor is not implemented`) → green cb6704d. Deviation: `apps/api/wrangler.jsonc` `rules` also bundle `**/*.css` as Text (a G1 file, edited because the Worker imports the stylesheet).
- [x] **Step 17a:** red: `backoffice-design-rules.test.ts` (the rules of `design.md` §9).
  - A source scan of every view finds no `style=` attribute and no `<style>` or `<script>` element.
  - Every rendered page has exactly one `h1`, a skip link as the first focusable element, and a label for every input.
  - The stylesheet holds no raw colour outside the `:root` token blocks.
  - A contrast check of the token pairs of `design.md` §2.1, light and dark: at least 4.5:1 for text pairs and 3:1 for non-text pairs.

  Then the views and `backoffice.css` as designed. — evidence: red 8b6cac3 (`defines a token block for light and a second one for dark`, both contrast cases) → green 36b5111.
- [x] **Step 17b:** red: `backoffice-redirects.test.ts`. `POST /locale` with `returnTo` = `/numbers`, `/metrics`, `/audit` → `303` to that path; with `https://evil.example`, `//evil.example`, `/\evil.example`, `javascript:alert(1)`, `/numbers/../x` and an empty value → `303 /`. `?notice=` renders only a `BackofficeNotice` value; `?notice=<script>alert(1)</script>` and an unknown value render no notice and reflect nothing. Then the allow-lists. — evidence: red 6b14a58 (`expected 404 to be 303`) → green 52d5b1b. The notice cases are pins.
- [x] **Step 17c:** red: `operator-enrollment-qr.test.ts`. `renderTerminalQr({ text })` returns multi-line text whose lines all have the same width and which contains the three finder patterns; it fails with a missing module until `uqr` is installed. Then add `uqr` to `apps/api/package.json` `devDependencies` with an exact version (no `^`, no `~`), resolved by `pnpm view uqr version` and at least two weeks old, update `pnpm-lock.yaml`, and add the `renderTerminalQr` helper; `pnpm install --frozen-lockfile` stays green. — evidence: red 66c3e5e (`renderTerminalQr is not implemented`) → green d4a605d. `uqr` 0.1.3 (published 2026-04-03), exact in `apps/api/package.json`; the lockfile gained only the `uqr` entries and `pnpm install --frozen-lockfile` is green. `renderTerminalQr` lives in `apps/api/scripts/backoffice-enroll.ts`.
- [x] **Step 18:** red: `operator-enrollment-entry.test.ts`, with a fake shell and prompt:
  - non-TTY → exit 1 and no shell call;
  - production without the typed `production` → nothing runs;
  - a wrong code → no `secret put` and no D1 call;
  - success → two `secret put` calls with the values only on stdin, never in argv, and one D1 execute holding the fixed reset statement;
  - output contains the key once and never the digest.

  Then `apps/api/scripts/backoffice-enroll.ts` (the QR comes from `renderTerminalQr`) and the root scripts. — evidence: red a676cd5 (`runEnrollment is not implemented`) → green b1f056c.
- [x] **Step 19:** red: `hooks.test.sh` cases. `pnpm backoffice:enroll:production`, `pnpm backoffice:enroll:development` and `node --import tsx apps/api/scripts/backoffice-enroll.ts` are blocked (exit 2), so the colon form and the hyphen form both match. Then extend `SENSITIVE_PATTERN` in `guard-deploy.sh` (line 7) with `backoffice[:-]enroll`. — evidence: red ab56edc (`expected exit 2, got 0` for six forms) → green b88d9fc.

### G3 numbers registry and channel

- [x] **Step 20:** red: `number-registry.test.ts`:
  - register an app and a number → the sealed columns are not the plaintext and open to it;
  - a sealed token copied to another row fails to open with an error naming the row ID;
  - `findByPhoneNumberIds` with unknown IDs → `[]`;
  - `openForAccount` for an account without a number → throws `account has no number`.

  Then `numbers/number-registry.ts` and `d1-number-registry.ts`.
  - evidence: red 5a7de37 (`registerMetaApp is not implemented`, 3 of 5) → green d7b0a0c. `IdPrefix` gained `Number = 'num'` and `MetaApp = 'app'` in `libs/types` (outside the file map).
- [x] **Step 21:** red: the state transitions. Every pair in the table: allowed ones update, the others throw `transition <from> → <to> is not allowed`. `pending → active` without `verified_at` throws. Then `numbers/number-state.ts`. — evidence: red 8f7887f3 (`assertNumberTransition is not implemented` 17 unit, `transition is not implemented` 5 integration) → green f1e6507a.
- [x] **Step 22:** red: `webhook-routing-peek.test.ts` over every inbound and status fixture, each wrapped as `notificationWith({ messages: [fixture] })` or `notificationWith({ statuses: [fixture] })` from `test/fixtures/whatsapp/inbound/notification.ts` (the fixture files are bare message and status objects; the wrapper's `entry.id` is `3000000000000003`), plus a template-status payload with no metadata:
  - it returns the expected ID sets;
  - invalid JSON → `null`;
  - nothing routable → `null`.

  Then `webhook-routing-peek.ts`.
  - evidence: red b47495f2 (`peekWebhookRouting is not implemented`, 29 of 30) → green e45f6f6d.
- [x] **Step 23:** red: `whatsapp-webhook-numbers.test.ts`, with two numbers on two apps:
  - a body signed with number A's app secret and metadata of A → `200`, and the message reaches A's account;
  - metadata of A signed with B's secret → `401`;
  - an unknown `phone_number_id` → `401`, with a body identical to the bad-signature body;
  - a delivery with changes for A and B → `401`;
  - a template-status change addressed by A's WABA ID and signed with A's secret → `200`, field ignored;
  - invalid JSON → `401`.

  Then rewrite the POST in `routes/whatsapp.ts`. Update the `whatsapp-webhook.test.ts` expectations that change, naming each in the tester briefing:
  - invalid JSON `400` → `401`;
  - the `FOREIGN_PHONE_NUMBER_ID` tests (a change for a `phone_number_id` the registry does not hold) `200` → `401`.
  - evidence: red caeee131 (8 of 8 new tests fail with 500 `more than one WhatsApp number is registered`; WI-23, the entry-array case, WI-27 and WI-31 now expect 401) → green 063cd454. The `whatsapp-webhook.test.ts` changes: WI-23 `400` → `401`, the missing entry array `400` → `401`, WI-27 `200` → `401`, WI-31 `200` → `401`.
- [x] **Step 24:** red: number states on inbound. `pending` and `disabled` → `200`, nothing stored, and the operator event logged. `closed` + new owner → no account, and one `NumberClosedToNewAccounts` send from that number. Then the state checks. — evidence: red 60ce415f (pending and disabled store the message; closed creates the account) → green a900a9a1. Deviation: `routes/dev-owner.ts` passes the only number to `receiveOwnerInbound` (a compile fix outside the file map).
- [x] **Step 25:** red: account binding.
  - A new owner on A → the `accounts.number_id = A` row is written in the same batch as the account (the test kills the second write and expects no account).
  - The A account owner writing to B → no routing, one `AccountOnOtherNumber` send from B carrying A's display number.

  Then the `homeNumberId` input of `openOwnerAccount` and the `AccountDirectory.create` port in `libs/core`, `d1-account-directory.ts`, `owner-inbound.ts` and the `whatsapp-copy.ts` keys.
  - evidence: red b9dbc521 → green b9e5155d, suites that open accounts seed the registered number in 4035e3b5. Deviation: the notice text is filled with `fillCopyTokens`, because `renderCopy` takes only `InboxCopyKey`.
- [x] **Step 26:** red: outbound per number.
  - An account on A sends → the fake Graph sees `/A_phone_number_id/messages` with A's bearer token.
  - Rotating A's token between two sends → the second uses the new token.
  - Number `disabled` → the agent gets the restricted-channel error, and `channel.number_unavailable` is logged.
  - Restrictions are recorded per `phone_number_id`.

  Then `resolveNumber` in `cloud-api-message-sender.ts` and `AccountInbox.createSender`.
  - evidence: red 38de3968 (6 of 6 fail with `more than one WhatsApp number is registered`) → green 2517c98c. The sender takes `resolveNumber` and `channelOf`; `numbers/sendable-number.ts` refuses a pending, disabled or missing number.
- [x] **Step 27:** red: media download for an inbound on B uses B's token. Then thread the inbound number through `channelEntryOf`. — evidence: pin 43e143f9 (green on landing: step 23 already opens the receiving number's token per download).
- [x] **Step 28:** red: the first-number backfill. Two accounts with `number_id NULL`, then register the first number → both bound. A second registration binds nothing. Then put it in the registration batch. — evidence: red 92d4d9b3 (`expected [ null, null ] to equal [ num, num ]`; the second-number case is a pin) → green cd98d2c0.
- [ ] ~~**Step 29:**~~ moved into G1 as step 5a, so G1 merges with integration and e2e green. G3 re-runs the same proof after step 28.
- [x] **Step 29a:** red: `graph-request-error-kind.test.ts`. `GraphRequestError` status `401` → `auth`, `403` → `auth`, `404` → `not_found`, `0` → `network`, and `400`, `429`, `500`, `502` → `upstream`. Then `numbers/graph-error-kind.ts`. — evidence: red 5c00fee1 (`graphErrorKindOf is not implemented`, 8 of 8) → green 0cdba2b9.
- [x] **Step 30:** red: `backoffice-numbers.test.ts`:
  - GET `/numbers`: empty, then one, then three;
  - register with step-up → `pending`, and the page shows no credential (the response body never contains the token or the app secret);
  - verify is POST → `303` to `/numbers/:id/verification` → GET `200` from the stored `verification_snapshot`; a reload of the GET gives the same `200` and the same body;
  - verify against the fake Graph: a display number match sets `verified_at`, a mismatch shows the copy `display_number_mismatch`, a fake `401` shows kind `auth`, and a fake `500` shows kind `upstream`;
  - the template status table renders the four rows;
  - activate, close, disable and re-close;
  - rotate the token and the app secret.

  Then `backoffice/numbers/**`.
  - evidence: red 9d083703 (35 of 38 fail, the routes answer 404) → green 3191866a; pins 99501b0a (form rules, verification snapshot) and 0e2500d2 (logs).

- [x] **Step 30a (coordinator follow-up, reported):** five fixes after the lane review.
  - A missing or wrong `NUMBER_REGISTRY_KEY` makes the webhook answer `500`: `spec.md` and `test-plan.md` say so, and a pin in `whatsapp-webhook-numbers.test.ts` holds it.
  - `whatsapp_numbers.credentials_changed_at` (migration 0005) is set at registration and when the access token is replaced, never on a state change; the detail page reads it.
  - A refused state form keeps the chosen radio.
  - `INVALID_JSON_BODY` is removed from `contract/constants.ts`.
  - `design.md` asks for a `KeyValueList` and native radios and checkboxes: the shared stylesheet gained `.key-value` (stacked at 375) and `.choice`, and the views use them.
  - evidence: red fb69aef0 (unit run: `expected … to contain '.key-value'`, `.choice`; the integration cases were not run in this step because port 4012 was reserved) → green below in the commit that follows it.

### G4 metrics (PR B)

- [ ] **Step 31:** red: `activity-in-object.test.ts`:
  - an accepted owner message → `messages_in` +1;
  - a duplicate → +0;
  - a session send → `messages_out` +1;
  - a template notice → `templates_sent_notice` +1;
  - a failed send → `sends_failed` +1;
  - a woken wake → `wakes_woken` +1;
  - unreached → `wakes_unreached` +1.

  Then `v8.sql`, `activity-ledger.ts` and the `recordActivity` calls.
- [ ] **Step 32:** red: `activity-flush.test.ts`. After one hour on the fake clock the D1 `activity_daily` row equals the meter, with `number_id` equal to the account's number. A second flush is idempotent. Pruning after 7 days. Then `activity-provider.ts`, `0006_activity.sql` and `d1-activity-repository.ts`.
- [ ] **Step 33:** red: `backoffice-metrics.test.ts`:
  - seeded accounts in four states, connections active, revoked and connected, `usage_daily` at 79 % and 81 %, and activity across two numbers → each figure on the page equals the spec definition;
  - the number filter;
  - the period filter;
  - an empty database renders the zero state;
  - one `batch` call per page (a spy on the binding);
  - read-only: every statement prepared by a metrics page begins with `SELECT`, and `POST`, `PUT`, `PATCH` and `DELETE` on `/metrics` → `404`.

  Then `backoffice/metrics/**`.

### G5 deploy, smoke, runbooks and rules

- [x] **Step 34:** (the `SmokeInput` rename is in step 2) red: `smoke-checks.test.ts` expects check 5's payload to carry `metadata.phone_number_id` equal to the `SMOKE_PHONE_NUMBER_ID` input and the signature computed with `SMOKE_META_APP_SECRET`. Then edit `smoke-checks.ts`. — evidence: pin 4968aca0 (green on landing: the payload already carried the smoke inputs)
- [x] **Step 35:** red: `tools/repository-shape/src/backoffice-isolation.test.ts`:
  - no file under `apps/api/src/mcp`, `apps/api/src/routes`, `apps/api/src/account-inbox`, `apps/connector` or `libs/` imports `apps/api/src/backoffice` (the spec's directories; `index.ts`, `index.dev.ts` and `apps/api/scripts/backoffice-enroll.ts` are not scanned, so the enrollment script imports `auth/totp.ts` and the base32 helper directly and no shared helper is added);
  - no `backoffice_` table name outside `backoffice/**` and migrations;
  - `sealed_` columns appear only in `numbers/**`, `d1-number-registry.ts` and migrations. — evidence: pin 21947d9b (no offender in the scanned directories; the registry code paths `d1-number-admin.ts` and `development-number-seed.ts` are allowed owners of the sealed columns)

  Then fix any offender.
- [x] **Step 36:** red: edit `GO_LIVE_ORDER` in `tools/repository-shape/src/runbooks.test.ts` (lines 15 to 32) to the new order, so `runbooks.test.ts` fails until `deploy.md` follows it. Then the runbooks.
  - Order: secrets → migrate → enroll → deploy → register number → point the Meta webhook → smoke. `deploy-preflight.ts` (`refuseMissingSecrets`) refuses a deploy while any `WorkerSecret` is missing, and enroll executes SQL on `backoffice_operator`, which needs `0005` applied. The array keeps one entry per phase and environment, splitting 'Migrate and deploy staging' into migrate, enroll, deploy and register the staging number before 'Smoke staging', and the same for production.
  - `docs/runbooks/README.md` is capped at 20 lines (`MAX_INDEX_LINES`): the order goes in the `## Go-live order` section of `deploy.md`, and the README gains a link line only if it stays within the cap.
  - `docs/runbooks/backoffice.md`: enroll, sign in, register a number, verify, activate, rotate, re-enroll, the lockout.
  - `meta-setup.md`: the webhook URL is the same for every app; the verify token is shared; app secrets and tokens go into the backoffice, not wrangler.
  - `deploy.md`: the new secrets and the order above.
  - `dns.md`: the backoffice hosts with a `dig` check. — evidence: red 43d565c3 (`expected [ … ] to deeply equal [ … ]`, 16 go-live titles against 25) → green 448a56fe; `runbooks.test.ts` and the shape gate pass

  `runbooks.test.ts` stays green.
- [x] **Step 37:** `.claude/rules/backoffice.md` with `paths: apps/api/src/backoffice/**, apps/api/src/numbers/**`, stating the security facts of this spec; `apps/api/README.md` purpose line; `docs/scenarios/backoffice.md` (operator signs in, registers two numbers, an owner writes to each). — evidence: 448a56fe (the `docs/features/README.md` row already existed)

### G6 browser specs

- [x] **Step 38:** `apps/api/playwright.config.ts` boots `wrangler dev --env development` on a free port with the fake Graph, plus `test:walk`. Red spec `sign-in.spec.ts` as in the test plan. Green once G2 lands. — evidence: infra beca09a5, red c38ca2e8 (`403 Pedido recusado`, the form post carried `Origin: null`) → green 40d35cac (`Referrer-Policy: same-origin`) and 319e2cda; `pnpm test:walk`: 26 passed at 1280 and 375
- [ ] **Step 39:** red specs `numbers.spec.ts` (PR A) and `metrics.spec.ts` (PR B). Green once G3 and G4 land. — PR A half done: `numbers.spec.ts` and `error-pages.spec.ts` red fb50c691 → green 40d35cac and 319e2cda; `metrics.spec.ts` waits for G4

### G7 tester findings (PR A)

- [x] **Step 40:** fixes from testers B and C, each red then green:
  - 40a rejected forms are POST, `303`, GET: a failed sign-in redirects to `/sign-in?notice=SignInFailed`; a rejected numbers form redirects with a single-use flash in `backoffice_sessions.flash` (migration `0006`). — evidence: red 760841ef (`the rejected form answered 401 without a Location`) → green cb96679e
  - 40b a duplicate phone number ID answers `409`. — evidence: red e3bdb700 (`expected 422 to be 409`) → green edf0c43c
  - 40c a favicon on `/assets/favicon.svg` and `/favicon.ico`, linked by the layout. — evidence: red 7b059ceb → green 2a5fe2dc
  - 40d the mono cells of a data table wrap, and the walk checks `/audit` at 375. — evidence: red f879b997 → green ee1be832
  - 40e `X-Forwarded-Host` and `X-Forwarded-Proto` never steer host dispatch. — evidence: pin b674e1d1
  - 40f the lockout asserts the literals 9 and 10, and the session cookie asserts `Secure`. — evidence: pin 64d80c38
  - 40g a failed step-up has its own audit label. — evidence: red 266137f9 → green fa771a68

### G8 review and security findings (PR A)

- [x] **Step 41:** fixes from the reviewer and the security reviewer, each red then green:
  - 41a S1 a wrong key never counts toward the lockout (20 wrong keys leave `failed_attempts` 0 and the owner signs in). — red de8dfe61 → green 82f0a321
  - 41b S2 an unattributed delivery pays one signature check against a placeholder secret; R2 a delivery is attributed by its known IDs only (an unknown change is skipped with `inbound.foreign_number` and answered `200`; no known ID or two apps answers `401`); WI-31 reversed. — red c34496e6 → green ffbe9d7e
  - 41c S3 `guard-deploy.sh` treats `scripts/backoffice` as sensitive. — red 268cdcfa → green 49873caa
  - 41d R1 smoke check 4 signs a body naming `SMOKE_PHONE_NUMBER_ID`, now required in production too; `deploy.md` step 6 states what the check proves. — red 5764d13c → green ad1f5c00
  - 41e R3 an account without a number is dropped with `inbound.account_without_number`; the other-number check sits below the deleting branch. — red 4206adc6 → green 91a957c5
  - 41f R4 `SECOND_MS`, R5 `BackofficeAuditTargetKind` and `RETRY_AFTER_HEADER`, R6 no fallback in `conflictOf`. — pin ed19ff16, refactor 38290ad8
  - 41g R7 and R8 docs: spec sign-in status, `whatsappTestEnv`, `AGENTS.md` purpose line, the runbook's "Already registered" fields.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | removing the number bindings breaks typecheck everywhere | `pnpm typecheck` red on `read-whatsapp-env.ts` callers | land with step 5a's bridge, or revert step 2 |
| 3 | extracting the cipher changes the wake sealed format, so stored wake targets stop opening | the pinned `aes-gcm-wake-secret-box.test.ts` or `webhook-wake-secrets.test.ts` goes red | revert the extraction; the wake box keeps its own copy and a NB ADR pointer |
| 4 | `ALTER TABLE` with a foreign key fails on D1, or `0005` collides with another branch's number | `migration-0005.test.ts` red; `wrangler d1 migrations list` shows two `0005` | rename to the next free number; never edit an applied migration |
| 7 | host dispatch lets a backoffice path through on the MCP host | `backoffice-host.test.ts` red | revert the dispatch commit; the backoffice is unreachable, nothing else changes |
| 9 | `__Host-` cookie refused on `http://backoffice.localhost` | integration or Playwright sign-in never holds a session | walk on `wrangler dev --local-protocol https`; record a learning |
| 11 | lockout locks the owner out in production | the owner cannot sign in, and audit shows `sign_in.locked` | `pnpm backoffice:enroll:production` resets the lock |
| 18 | the enrollment script leaks a value into argv or the output | `operator-enrollment-entry.test.ts` red, or the secret scan in `pnpm verify` | do not merge; the owner rotates by re-enrolling if a value was ever printed outside the intended line |
| 23 | the routing peek rejects a real Meta payload shape not in the fixtures | staging smoke check 5 fails; logs show `inbound.unattributed` | `wrangler rollback` to the previous version (which needs the old secrets: see "no backout" below); add the fixture and fix |
| 25 | the `homeNumberId` port change breaks core account creation | `account-inbox-accounts.test.ts` red | revert the core commit together with `owner-inbound.ts` |
| 26 | a per-send registry read exceeds the Free plan CPU on large bursts | Worker CPU-exceeded errors on staging; error alert | cache the imported `CryptoKey` per isolate (not the token); the Workers Paid plan is the next step |
| 29 | an e2e suite still depends on the removed secrets | `pnpm test:e2e` red with `<NAME> is not set` | migrate that suite to `seedWhatsAppNumber()` |
| 31 | `recordActivity` in a `finally` throws and masks the real outcome | `account-inbox.test.ts` sees the wrong error code | move the call after the outcome, as v7 does |
| 33 | metrics queries scan large tables and exhaust D1 reads | D1 rows-read climbs in the Cloudflare dashboard | add the missing index in a new migration; the page is read-only, so disabling the route loses nothing |
| 36 | the go-live order is wrong: the Meta webhook points at production before a number is registered | Meta shows delivery failures (401) | register the number; Meta retries for 7 days, so nothing is lost |

**Steps with no backout:**
- Step 2 in a deployed environment: once the number secrets are deleted from the Worker, `wrangler rollback` to a pre-registry version serves code that needs them. The owner deletes the old secrets only after the registry version passes the staging smoke test, and keeps the values in his password manager until production has run a week.
- Step 4: D1 migrations are forward-only; a mistake is fixed by a new migration.

## Z. Prove and ship

- [x] **Tester briefing:** a developer wrote `tester-briefing.md` with every red-first commit hash and the failure text it printed. — evidence: `tester-briefing.md` tables for G6, step 40 and step 41
- [x] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence. — evidence: testers A (unit), B (integration), C (browser and security) and the delta tester at c2ad76c4, `test-results/backoffice/tester-{a,b,c,delta}.md`; PR B rows stay open
- [x] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`. — evidence: SHIP WITH RESERVATIONS, every finding fixed in c2ad76c4 (step 41)
- [x] **Security reviewer:** a fresh `security-reviewer` sub-agent returned `Security verdict: CLEAR`, or findings below IMPORTANT. — evidence: FINDINGS (one IMPORTANT, two MINOR) fixed in c2ad76c4 (step 41), re-check CLEAR
- [ ] **/check-ui:** screenshots and video of the walk recorded and uploaded to `pr-media-backoffice`.
- [ ] **/scenario backoffice:** run before merge if the owner chooses it.
- [ ] **/open-pr:** gates passed, learnings sweep stated, merge sensitivity HIGH with blast radius and human checklist, PR opened.
