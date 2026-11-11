# Plan: Meta onboarding

**Spec:** spec.md
**Tier:** 🔴 structural
**Seam:** `NumberRegistry` (no app), the webhook signature in `routes/whatsapp.ts`, a new `numbers/meta-onboarding.ts`, two backoffice routes and the header middleware
**Assumptions (decided, owner can override):**
- One app, one Worker secret, per-WABA webhook override (ADR 0036).
- A typed PIN, never stored; step-up before the popup, a 10-minute single-use grant (ADR 0036).
- A `'self'` script asset, not a nonce or a hash; the page policy is chosen by the route (ADR 0037).
- `META_LOGIN_CONFIGURATION_ID` holds the owner's value before step 1 is committed. If it has not arrived, the lead asks once, and the tests use a fictional value from the test support.
- Lean, by the owner's order: one tester pass, one reviewer, one security reviewer, no scenario run before the merge. `docs/scenarios/backoffice.md` is updated in step 8 for the next run.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| W (Worker and registry) | `libs/types/src/constants.ts`, `libs/types/src/enums.ts` (`IdPrefix.MetaApp` removal), `apps/api/migrations/0008_meta_onboarding.sql`, `apps/api/src/numbers/**`, `apps/api/src/adapters/d1/**`, `apps/api/src/adapters/whatsapp/**`, `apps/api/src/routes/whatsapp.ts`, `apps/api/src/contract/env.ts`, `apps/api/src/operations/**`, `apps/api/src/dev/**`, `.env.example`, `apps/api/vitest.integration.config.mts`, `apps/api/test/support/**`, `apps/api/test/fixtures/**`, `apps/api/test/e2e/**`, `apps/api/test/unit/**` except `backoffice-*`, `apps/api/test/integration/**` except `backoffice-*`, `apps/connector/test/e2e/support/stack.ts` | `developer-worker` |
| B (backoffice page) | `apps/api/src/backoffice/**`, `apps/api/e2e/backoffice/**`, `apps/api/test/unit/backoffice-*`, `apps/api/test/integration/backoffice-*`, `.claude/rules/backoffice.md`, `docs/scenarios/backoffice.md`, `docs/contributing/local-stack.md` | `developer-backoffice` |
| L (lead, last) | `docs/features/meta-onboarding/**`, `docs/features/README.md`, `apps/api/README.md` if its purpose line changes | lead |

## Sequencing

Steps 1 and 2 (W) land first, because B builds on the registry without apps and on the grant column. B starts step 4 when step 2 is merged into its lane. Step 3 (W) and steps 4 and 6 (B) then run in parallel. Step 5 needs step 3's `onboardNumber`, whose signature is fixed in the spec, so B may write step 5 against it and merge step 3 before going green. Step 7 needs steps 3 to 6. Lanes take each other by merge, never by rebase.

## Steps

Every box is empty when authored. A developer ticks its own line. A wrong step is struck through with the reason, not deleted.

### W

- [ ] **Step 1: constants and migration 0008.**
  - Red: `apps/api/test/integration/migration-0008.test.ts`, on top of `0001` to `0007`:
    - a row of `meta_apps` with `714836811568009` and its number survive, with `meta_app_ref` gone and the access token still opening;
    - a row with another app ID makes the migration fail and leaves `meta_apps` and `whatsapp_numbers` unchanged;
    - `backoffice_sessions.onboarding_grant_until` exists and is nullable;
    - `whatsapp_numbers_waba` exists;
    - `accounts.number_id` still references `whatsapp_numbers`.
  - Green: the SQL of the spec (Interfaces) and `META_APP_ID`, `META_APP_LABEL`, `META_LOGIN_CONFIGURATION_ID` and `ONBOARDING_PIN_PATTERN` in `libs/types/src/constants.ts`.
- [ ] **Step 2: one secret, no apps.**
  - Red:
    - `whatsapp-webhook-numbers.test.ts` signs with `META_APP_SECRET` and expects `200`, and a body signed with any other secret expects `401`;
    - `env-example.test.ts` expects `META_APP_SECRET`;
    - `number-registry.test.ts` registers without an app.
  - Green:
    - `Bindings.META_APP_SECRET` and `WorkerSecret.MetaAppSecret`;
    - `attributeDelivery` without the one-app check;
    - signature verification with `context.env.META_APP_SECRET`;
    - remove `registerMetaApp`, `registerNumberWithNewMetaApp`, `openAppSecret`, `appSecretAssociatedData`, `metaAppRef`, `listMetaApps` and `replaceAppSecret`, and the `meta_apps` join and insert in the dev seed and the admin list;
    - the test bindings (`vitest.integration.config.mts`, both e2e global setups, the connector stack) gain `META_APP_SECRET`;
    - sweep every fixture that names `metaAppRef` or `meta_apps`;
    - `SMOKE_META_APP_SECRET` stays a smoke input.
- [ ] **Step 3: `onboardNumber` and FakeGraph.**
  - Red: `apps/api/test/integration/meta-onboarding.test.ts` against FakeGraph:
    - happy path: four requests in order. The exchange is a form `POST` to `/v24.0/oauth/access_token` with `client_id=714836811568009`, the secret and the code, and no `Authorization` header. Subscribe carries `override_callback_uri` and `verify_token` with the business token. Register carries `messaging_product: whatsapp` and the PIN. The read is `GET /{waba}/phone_numbers`. The result has a `+`-prefixed display number;
    - each step answering `400`, `401` or `404`, and a dropped connection, throws `OnboardingError` with that step and kind, and its message holds neither the code, the secret nor the token;
    - a phone number ID missing from the list gives `Read`/`NotFound`.
  - Green:
    - `apps/api/src/numbers/meta-onboarding.ts`;
    - `OperatorEvent.BackofficeOnboardingFailed` with `OperatorLogField.OnboardingStep` and the kind;
    - FakeGraph answers the four calls by default: the token `fake-business-token`, `success: true` twice, and one phone entry that echoes the requested phone number ID, `+55 11 90000-0001` and the verified name `zapbip test`. Queued responses override them as today.

### B

- [ ] **Step 4: remove the typed registration.**
  - Red: `backoffice-numbers.test.ts` expects:
    - `GET /numbers/new` and `POST /meta-apps/x/app-secret` to answer `404`;
    - the numbers list to have no Meta app column;
    - the number page to have no "Replace app secret" block.
  - Green: delete `register-routes.tsx`, `registration-form.ts`, `app-secret-routes.tsx` and `register-number.tsx`, their copy keys and form fields, and `/meta-apps/*` from `PROTECTED_PATHS`. Keep `BackofficeAuditAction.MetaAppSecretRotated` and `BackofficeAuditTargetKind.MetaApp`, because stored audit rows keep rendering. The "Register a number" link becomes "Connect a WhatsApp number" to `/numbers/connect`.
- [ ] **Step 5: grant and connect routes.**
  - Red: `backoffice-meta-onboarding.test.ts`:
    - `POST /numbers/connect` with a good code sets the grant and answers `303` to `/numbers/connect/meta`, and a bad code answers the `401` flash;
    - `POST /numbers/connect/meta` with a grant and valid fields stores a `pending` number. Its sealed token opens to `fake-business-token`, it shows the display number from FakeGraph, and it is audited `number.registered`;
    - a second post with the same fields is refused with no Graph request;
    - a post without a grant, a bad PIN, non-digit IDs, a duplicate phone number ID (zero Graph requests) and a FakeGraph `401` on register each give the spec's answer and store nothing;
    - no log line and no flash holds the code, the PIN or the token.
  - Green:
    - `routes/connect-routes.tsx`, mounted before `numberRoutes`;
    - the grant reads and writes beside the session helpers;
    - `ONBOARDING_GRANT_TTL_MS = 10 * MINUTE_MS` in `backoffice-constants.ts`;
    - `FlashStatus` gains `BadGateway`;
    - copy in `backoffice-copy.ts` (`pt_BR` and `en_US`): page titles, field labels, step failures and the cancel and error status lines.
- [ ] **Step 6: the onboarding page and its policy.**
  - Red: `backoffice-headers-meta-onboarding.test.ts`:
    - `GET /numbers/connect/meta` with a grant answers the exact policy of ADR 0037 and `Cross-Origin-Opener-Policy: same-origin-allow-popups`;
    - `/numbers/connect`, `/numbers`, a number page, `/sign-in` and an error page keep `CONTENT_SECURITY_POLICY` and `same-origin` byte for byte;
    - `/assets/embedded-signup.js` answers JavaScript with the stylesheet's cache header.
  - Green:
    - `PagePolicy` and a record of header sets in `backoffice-constants.ts`, read by `applySecurityHeaders`;
    - `views/connect-number.tsx` and `views/connect-meta.tsx`;
    - `assets/embedded-signup.js`, served by `asset-routes.ts`. It holds the origin check, the `FINISH` gate and `requestSubmit`, as in spec, data flow 3.

### Both, then lead

- [ ] **Step 7: the browser walk (B).**
  - `apps/api/e2e/backoffice/meta-onboarding.spec.ts`, with `support/embedded-signup-stub.ts`. Playwright routes `https://connect.facebook.net/en_US/sdk.js` to a stub `FB`, whose `login` loads an iframe at `https://www.facebook.com/__stub/signup`. Playwright serves that frame, and it posts the `FINISH` message to the parent with digit IDs before the stub calls back with `{ authResponse: { code } }`.
  - Cases:
    - happy path: the number page shows Pending with `+5511900000001`;
    - the stub posting `CANCEL` shows the cancel line and makes no post;
    - a message from a non-Facebook origin is ignored;
    - opening `/numbers/connect/meta` without a grant lands on `/numbers/connect`;
    - zero console errors and zero CSP reports on the happy path, at 1280 and 375 wide.
- [ ] **Step 8: docs that move with the code (B, then lead).**
  - `.claude/rules/backoffice.md`:
    - "No script, strict headers" names the one exception and ADR 0037;
    - "Sealed credentials" drops the app secret and names `META_APP_SECRET`;
    - "Step-up on every registry change" names the onboarding grant.
  - `docs/scenarios/backoffice.md` T2 connects two numbers with the stub of step 7. `docs/contributing/local-stack.md` names `META_APP_SECRET` in `.dev.vars`.
  - The lead fills `tester-briefing.md` from the developers' notes and checks the runbooks against the built screens.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 1 | D1 refuses the rebuild because of the foreign key from `accounts` | `migration-0008.test.ts` fails on `DROP TABLE whatsapp_numbers` | keep `PRAGMA defer_foreign_keys = true` as the first statement; never edit `0005` |
| 1 | The guard runs after a change, so a refused migration leaves half a schema | the foreign-app case shows `whatsapp_numbers_next` | guard statements first in the file |
| 2 | A fixture still signs with a per-app secret | integration webhook tests answer `401` | the sweep greps `metaAppRef\|meta_apps\|openAppSecret` to zero outside migrations `0005` and `0008` and their tests |
| 2 | Preflight refuses staging because `META_APP_SECRET` is unset | `pnpm deploy:staging` names it at the secrets step | the owner runs `wrangler secret put META_APP_SECRET` (deploy.md step 3) |
| 3 | The secret leaks into an error through a URL | the step 3 assertion on the error message fails | the exchange stays a form `POST`; nothing goes in the URL |
| 5 | The grant survives a failed post and allows replay | the second-post test stores or calls Graph | consume first, in one conditional `UPDATE` |
| 6 | The onboarding headers leak to other pages | the byte-for-byte test fails | the default `PagePolicy.Strict` is set in `requestContext`, never left undefined |
| 7 | The stub frame is blocked by the real policy | the walk sees no message; the console shows a `frame-src` report | fix the stub host to one the policy lists; never widen the policy for the stub |
| deploy | The real SDK needs another host | the owner's staging connect shows a CSP report | an ADR 0037 amendment adds that host; the Worker rollback (deploy.md step 8) restores the old page meanwhile |
| deploy | The Meta exchange refuses the form `POST` | the staging connect fails at step `exchange` with `upstream` | switch to `GET` with an ADR 0036 amendment |

**Steps with no backout:** Step 1, migration `0008` once applied remotely: it drops `meta_apps`. The only way back is the D1 time-travel bookmark of deploy.md step 4, restored together with the Worker rollback. Neither environment has a number on 2026-11-11.

## Z. Prove and ship

- [ ] **Tester briefing:** the lead wrote `tester-briefing.md` from the developers' notes.
- [ ] **Tester run:** one fresh `tester` sub-agent executed `test-plan.md` once and ticked every box with evidence.
- [ ] **Reviewer:** one fresh `reviewer` sub-agent returned a verdict; the refutation of the three riskiest claims is in `test-plan.md`.
- [ ] **Security reviewer:** one fresh `security-reviewer` returned `CLEAR`, or findings fixed.
- [ ] **/check-ui:** screenshots and video of the connect flow, stubbed, uploaded.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened with the human checklist below.

Human checklist for the PR (written by the agent, ticked by the owner):

- Before migrating, count the remote rows: `SELECT meta_app_id FROM meta_apps` prints nothing or only `714836811568009` on staging and production.
- Set `META_APP_SECRET` on staging, migrate, deploy, connect the staging number, and confirm zero CSP reports in the console.
