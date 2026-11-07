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
