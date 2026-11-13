# Plan: Customer web app

**Spec:** spec.md
**Tier:** 🔴
**Seam:** the command table in `libs/core/src/accounts`, `fetchByHost`, the account Durable Object RPC, D1.
**Assumptions (decided, owner can override):**
- One developer, one lane; the app lives in `apps/api/src/client-app/`.

## File map

| Group | Paths owned | Developer |
|-------|-------------|-----------|
| G1 | `libs/types`, `libs/core/src/accounts`, `apps/api/src/account-inbox`, `apps/api/src/adapters/d1`, `apps/api/migrations/0011*` | developer |
| G2 | `apps/api/src/client-app/**`, `apps/api/src/backoffice/host-dispatch.ts`, `apps/api/wrangler.jsonc`, `apps/api/src/operations/scheduled.ts` | developer |
| G3 | `apps/api/test`, `apps/api/e2e/client-app`, `apps/docs`, `docs`, `.claude/rules` | developer |

## Sequencing

G1 (command and tokens) then G2 (routes and views) then G3 (docs, e2e).

## Steps

### G1

- [ ] **Step 1:** red: `login` / `entrar` parse, gate and reply tests in `libs/core`; then the command, the port and the reply copy.
- [ ] **Step 2:** red: integration for the token row, replacement, expiry and masking of the stored reply; then migration `0011`, `D1SignInLinks`, the redaction pattern, `APP_ORIGIN`.
- [ ] **Step 3:** red: the account RPC `applyWebCommand`; then the Durable Object method.

### G2

- [ ] **Step 4:** red: token and session unit rules (digest, CSRF); then `client-app` token, session and CSRF modules.
- [ ] **Step 5:** red: host dispatch and route integration (GET does not consume, POST consumes once, expiry, CSRF, Origin, rate limit, isolation, revoked session); then the app, views, copy and stylesheet.
- [ ] **Step 6:** wrangler routes and vars, the scheduled prune, the account-removal statements.

### G3

- [ ] **Step 7:** Playwright e2e `apps/api/e2e/client-app` in both locales at 1440 and 375.
- [ ] **Step 8:** docs pages, navigation, commands page, rules file, features index.

## Failure modes

| Step | What breaks | How I notice | How I back out |
|------|-------------|--------------|----------------|
| 2 | migration `0011` | `d1 migrations apply` fails | additive; drop the two tables |
| 5 | session accepted for a removed account | the revoked-session test | the join on `accounts` is the guard |
| 6 | custom domain routes | deploy reports the host in use | remove the two routes |

**Steps with no backout:** none.

## Z. Prove and ship

- [ ] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md`.
- [ ] **Reviewer:** a fresh `reviewer` returned a verdict.
- [ ] **/check-ui:** screenshots and video recorded.
- [ ] **/open-pr:** gates passed, PR opened.
