# Tester briefing: Customer web app

## What changed and where

| Area | Paths |
|------|-------|
| The `login` / `entrar` command, its port and copy | `libs/core/src/accounts/` (`command-words.ts`, `state-gate.ts`, `sign-in-link.ts`, `use-cases/issue-sign-in-link.ts`, `ports.ts`, `account-copy.ts`), `libs/types/src/` |
| Token issuance and masking | `apps/api/src/adapters/d1/d1-sign-in-links.ts`, `apps/api/src/account-inbox/install-code-redaction.ts`, `apps/api/migrations/0011_client_app.sql` |
| Web commands through the account object | `AccountInbox.applyWebCommand` in `apps/api/src/account-inbox/account-inbox.ts`, `apps/api/src/contract/account-owner-rpc.ts` |
| The app | `apps/api/src/client-app/**`, host dispatch in `apps/api/src/backoffice/host-dispatch.ts`, `APP_ORIGIN` and the two custom-domain routes in `apps/api/wrangler.jsonc`, the prune in `apps/api/src/operations/scheduled.ts`, session rows removed with the account in `d1-account-directory.ts` |
| Docs | `apps/docs/features/web-app.mdx` and its `pt-br` twin, `docs.json`, the commands pages, `docs/runbooks/dns.md`, `.claude/rules/client-app.md`, ADR 0042 |

## How to run

- Unit: `pnpm --filter @zapbip/api exec vitest run --config vitest.unit.config.mts test/unit/client-app` and `pnpm --filter @zapbip/core exec vitest run`.
- Integration: `pnpm --filter @zapbip/api exec vitest run --config vitest.integration.config.mts test/integration/client-app test/integration/migration-0011`.
- Walk: `pnpm --filter @zapbip/api run test:client-app`; set `ZAPBIP_CLIENT_APP_SCREENSHOTS=<dir>` to keep screenshots.
- Shape: `pnpm --filter @zapbip/repository-shape exec vitest run` (the docs-visual baseline test now tolerates added navigation pages; the isolation test gained the customer web app).

## Red today, green after

| Test | Red failure text | Commit |
|------|------------------|--------|
| `libs/core` command, state gate, agent name, copy, `sign-in-link`, `issue-sign-in-link` | assertions on `login` parsing; `issueSignInLink is not implemented`; `buildSignInLink is not implemented` | red `6e36fa9b`, green `9d0cf27a` |
| `client-app-login.test.ts` | `D1SignInLinks is not implemented` | red `6debe664`, green `71505d3c` |
| `client-app-web-command.test.ts` | `applyWebCommand is not implemented` | red `5659260f`, green `32f5ba68` |
| `client-app-sign-in`, `client-app-session`, `client-app-host`, `client-app-csrf`, `client-app-paths` | `createClientApp is not implemented`, `csrfTokenOf is not implemented`, `localeOfPath is not implemented`, `pathWithLocale is not implemented` | red `41fd917c`, green `32f5ba68` |

Pins: the suspended-account case of `issue-sign-in-link.test.ts` was green on landing (the stub is never reached); `client-app-prune`, `migration-0011`, `client-app-copy` and the Playwright walk were written with the code. The green commit `32f5ba68` also edits two tests of the red commit: the expired-link POST test computes its CSRF token with `csrfTokenOf`, and the session tests seed a start number so "signed out" is asserted by the sign-in button.

## Hypotheses for the tester

1. `GET /sign-in/<token>` never consumes the token; the first `POST` signs in; the second answers `410`.
2. A wrong or foreign CSRF token, or a missing or foreign `Origin`, answers `403` and leaves the token usable.
3. The session cookie is `__Host-zapbip_app`, HttpOnly, Secure, SameSite=Lax, Path=/, with no Domain.
4. Only digests of the link token and the session token are stored.
5. A session of a removed, suspended or deleting account is signed out on the next request.
6. A session never lists nor revokes another account's agent, and another session's CSRF token is refused.
7. Connect shows the install prompt once; the agent has the normalised name; it is listed after a reload; the secret is never shown.
8. Revoke asks for a confirmation first and only then revokes.
9. The sign-in rate limit answers `429` with `Retry-After`.
10. The stored WhatsApp reply of `login` has its token masked once sent.
11. English at `/`, Portuguese at `/pt-br`; after sign-in the account's language decides; no horizontal scroll at 375.
12. Light and dark follow the system; no script runs (CSP has no `script-src`).

## Gaps

- The delivery of the link is proven against the fake channel only.
- `wrangler.jsonc` adds the two custom domains; DNS and Worker routes are created by the owner's deploy, not proven here. The owner must clear any `app` or `app-staging` record first (runbook `dns.md`).
- The pt-BR language of an account is set at creation from the phone country; a customer cannot change it.
- "Last active" per agent is not shown: the data exists only as the first call, so the page shows the client name and the creation date.
- Full `pnpm verify` is left to the orchestrator.
