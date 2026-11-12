# Tester briefing: Backoffice password sign-in

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works. This file is written before the build; the developer fills the table and the "What changed" list as the steps land.

## Before you start

- The Worker stays on the Free plan: the hash is a pepper digest plus PBKDF2 at 20000 iterations (ADR 0038). The new Worker secret is `BACKOFFICE_PASSWORD_PEPPER`; the local development stack needs it in `apps/api/.dev.vars`, which the owner or the test support provides, never an agent by hand.
- Migration `0009_backoffice_password_sign_in.sql` ends every session and leaves the operator with no email and no password. Every sign-in fails until the owner runs `pnpm backoffice:enroll:<environment>`. The owner runs that command, not you.

## What changed

- `apps/api/src/backoffice/auth/password-hash.ts`, `password-policy.ts` — PBKDF2-SHA256 hash, verify and the normalisation and length rule.
- `apps/api/migrations/0009_backoffice_password_sign_in.sql` — email and password hash on `backoffice_operator`, the pending table, sessions cleared.
- `apps/api/src/backoffice/auth/pending-sign-in.ts` — the server-side second-factor state.
- `apps/api/src/backoffice/auth/sign-in.ts` — `attemptPasswordSignIn` and `attemptCodeSignIn`; the key check is gone.
- `apps/api/src/backoffice/routes/sign-in-routes.tsx` — `/sign-in` and the new `/sign-in/code`, with the `__Host-zb_bo_pending` cookie.
- `apps/api/src/backoffice/return-target.ts` — allows `/sign-in/code`.
- `apps/api/src/backoffice/views/sign-in.tsx`, `views/sign-in-code.tsx`, `backoffice-copy.ts` — the two pages and their copy, pt_BR and en_US.
- `apps/api/scripts/backoffice-enroll.ts` — email and hidden password prompts; no key; `BACKOFFICE_KEY_DIGEST` is no longer written.
- `apps/api/src/contract/env.ts`, `operations/worker-secret.ts`, `auth/require-configured.ts` — `BACKOFFICE_KEY_DIGEST` removed.
- Tests under `apps/api/test/**` rewritten to the two-step flow.
- Docs: `docs/runbooks/backoffice.md`, `docs/runbooks/deploy.md`, `.claude/rules/backoffice.md`, ADR 0038, the 0031 amendment note, both index rows.

## How to run

```bash
pnpm install
pnpm --filter @zapbip/api exec vitest run --config vitest.unit.config.mts
pnpm --filter @zapbip/api exec vitest run --config vitest.integration.config.mts backoffice
pnpm typecheck
pnpm exec prettier --check docs/features/backoffice-password-sign-in apps/api/src/backoffice
```

Local stack for the walk: `pnpm dev` (the API on port 8787). The backoffice host is `http://backoffice.localhost:8787`. The owner's real password is never typed or seen by an agent. The owner approved a local-only operator with a test email and test password, created by the test support from `apps/api/test/support/backoffice-credentials.ts` and the e2e fixtures; the values live there, never in chat or docs. Never run `pnpm backoffice:enroll:staging` or `pnpm backoffice:enroll:production`.

## Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `apps/api/test/unit/backoffice-password-hash.test.ts` | the stub throws `hashPassword is not implemented` (red run text to be pasted by the developer) | the implementation returns the format in the spec |
| `apps/api/test/integration/backoffice-password-migration.test.ts` | `0009` does not exist | the migration applies and the rows match |
| `apps/api/test/integration/backoffice-pending-sign-in.test.ts` | `pending-sign-in.ts` is a stub | the consume-once and expiry rules hold |
| `apps/api/test/integration/backoffice-auth-password.test.ts` | `attemptPasswordSignIn is not implemented` | the counters, the lock and the single hash hold |
| `apps/api/test/integration/backoffice-auth-sign-in-steps.test.ts` | the routes still expect the key | the two steps, cookies and redirects match |
| `apps/api/test/unit/operator-enrollment-entry.test.ts` | the CLI still prints a key and asks for a code first | the CLI asks for the email and password, and writes no key |
| `apps/api/test/unit/backoffice-copy.test.ts` | the new keys are missing | both locales have the keys |

Commit the failing test on its own before each implementation commit. A test that is green when it lands is a pin and says so in its commit.

## Hypotheses to attack

1. Hypothesis: an unknown email and a wrong password look identical to the caller and cost the same work. Break it by: sending both to `/sign-in` with the same body shape and comparing the status, `Location`, body and the number of `deriveBits` calls (spy on `crypto.subtle`).
2. Hypothesis: the lock counts wrong passwords, unknown emails and wrong codes, and a missing or replayed pending state counts nothing. Break it by: ten mixed failures, then read `failed_attempts` after a code POST with no cookie.
3. Hypothesis: the pending state is single-use and expires at 5 minutes. Break it by: two parallel code POSTs with the same cookie and the right code; a code at exactly `expires_at`; a code one millisecond later.
4. Hypothesis: no password and no email appears in a redirect, a log, an audit row, a flash or a process argument of the enrollment run. Break it by: grepping the Worker logs, the audit table and the `wrangler d1 execute` arguments after a full run.
5. Hypothesis: the pending cookie is `__Host-zb_bo_pending` with `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`, `Max-Age=300` and no `Domain`. Break it by: reading the `Set-Cookie` header on the password step.
6. Hypothesis: the switchers work on both pages without changing the page's path. Break it by: changing language and theme on `/sign-in/code` with a live pending cookie, and checking the cookie survives.
7. Hypothesis: the old key is no longer a way in. Break it by: typing `zb_bo_` plus 43 characters into the password field with the right email.
8. Hypothesis: the strict headers and the absence of script are unchanged. Break it by: reading the headers and the body of both pages.

## Known gaps

- The Workers CPU time of one sign-in is pinned locally only by a generous Node budget (about 2.7 ms measured at 20000 iterations). The real Workers number is for the owner to read on staging.
- The owner's terminal hidden-input behaviour is not reproducible in the test harness. The enrollment test injects answers and checks that the password is not printed; the real echo is checked by the owner by hand.
- The concurrency check runs against the local D1 harness, not production D1.
- Passwords are checked for length only. No strength rule is applied, by design.
