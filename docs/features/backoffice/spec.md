# Backoffice

**Status:** Approved
**Tier:** 🔴
**Owner approval:** owner order 2026-11-07; open questions answered by the owner, or by the recommended option under the owner's delegation of 2026-11-06; approved 2026-11-07
**ADRs:** [0031](../../adr/0031-the-backoffice-is-a-separate-host-signed-in-with-a-key-and-totp-enrolled-from-the-owners-terminal.md); [0032](../../adr/0032-whatsapp-numbers-are-rows-in-a-sealed-registry-not-worker-secrets.md) numbers registry (accepted with this spec); builds on [0005](../../adr/0005-the-local-gate-runs-what-the-diff-can-break.md), [0006](../../adr/0006-one-secret-per-connection-in-the-mcp-url.md), [0008](../../adr/0008-a-pure-core-behind-ports.md), [0009](../../adr/0009-cloudflare-workers-with-one-durable-object-per-account.md), [0012](../../adr/0012-owner-identity-by-wa-id-on-the-shared-number.md), [0013](../../adr/0013-webhook-acknowledged-after-a-durable-commit-and-deduplicated-by-message-id.md), [0017](../../adr/0017-connection-secrets-are-shown-once-and-stored-as-digests.md), [0027](../../adr/0027-deploys-run-from-the-owners-machine-not-from-ci.md)
**Not changing:** the MCP contract and its tools, the connector protocol, the wake ladder, the 24-hour window rules, the routing order inside an account, the R2 media path, and account lifecycle commands. No agent, MCP tool or connector frame gains any read or write to the backoffice or the numbers registry.

## Problem

Owner order, 2026-11-07, verbatim: "subir um painel admin com 2fa, metricas e adicoes de numeros de whatsapp". Correction the same day: the feature is the **backoffice**, served at `backoffice.zapbip.com`, and WhatsApp numbers are not configuration.

Today:

- One official number is hard-wired through three Worker secrets: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` and `META_APP_SECRET`.
- The operator (Logic Bit) has no view of the service apart from Workers Logs and `wrangler d1 execute`.
- `apps/api/scripts/operator-account.sh` is the only operator tool.

Adding a second number means a redeploy with new secrets. Seeing how many accounts, agents or messages exist means writing SQL by hand.

## Goals

Phase 1. Production go-live depends on phase 1, because the channel reads its numbers from the registry.

1. **Sign-in with two factors, for the operator only.** The backoffice runs on its own host. The operator signs in with a high-entropy backoffice key plus a TOTP code. Both are enrolled from the owner's own terminal and never by an agent.
2. **Numbers registry.** The operator registers WhatsApp numbers dynamically: phone number ID, WABA ID, display number, label, access token, and the Meta app (Meta app ID plus app secret). Credentials are sealed at rest with AES-256-GCM under a Worker master key. The channel resolves the number for each account and each webhook delivery from the registry.
3. **One webhook endpoint for every number.** `POST /webhooks/whatsapp` identifies the number by `metadata.phone_number_id` (or by `entry.id` as WABA ID when a change carries no metadata) and verifies `X-Hub-Signature-256` with that number's app secret.
4. **Accounts belong to a number.** An account is bound to the number its owner first wrote to. A message to another number never crosses accounts.
5. **Read-only metrics.** Accounts, agents, messages in and out, template sends, send failures, wake success, and Durable Object budget. Each metric has one documented source.
6. **Strict web security.** Separate host, strict CSP with no script, CSRF defence, rate limits and lockout, an audit log, nothing secret in logs or responses.

Phase 2 (not built here, listed so phase 1 does not block it):

- Moving an account between numbers.
- Submitting templates and automating the webhook subscription (`POST /{waba-id}/subscribed_apps`) from the backoffice.
- An Analytics Engine `WAKE_METRICS` panel (latency, status classes) through the SQL API.
- Account actions that replace `operator-account.sh`, and a per-account drill-down with masked phone numbers.
- Passkeys as an extra factor.
- Rotating the registry master key with re-sealing.
- Quality and status webhooks (`phone_number_quality_update`, `message_template_status_update`) stored per number.

## Non-goals

- More than one operator, roles or invitations. There is one operator identity.
- Any third-party auth SaaS, account creation or identity provider, including Cloudflare Access ([ADR 0031](../../adr/0031-the-backoffice-is-a-separate-host-signed-in-with-a-key-and-totp-enrolled-from-the-owners-terminal.md)).
- Reading owners' message text, media or full phone numbers. Phase 1 shows aggregates only.
- Meta conversation billing. The operator keeps reading it in WhatsApp Manager.
- New infrastructure. Everything uses the existing Worker, D1, Durable Objects, R2 and Analytics Engine bindings, plus one rate-limit namespace and one custom domain.
- Creating Meta apps, numbers or templates. The owner does that in Meta; the backoffice records the result.

## Design

### Phases and pull requests

| PR | Contents | Why together |
|---|---|---|
| Phase 1, PR A | backoffice host and sign-in, audit log, numbers registry, channel reading the registry, number secrets removed | the number secrets can only go once the operator can register a number |
| Phase 1, PR B | activity meter (Durable Object v8), `activity_daily`, metrics pages | read-only and separable; it can ship the same day or right after PR A |
| Phase 2 | the list under Goals | each item gets its own spec section and approval |

The lane branches from `main` at `273e1a2`, which already holds `feat/deploy-readiness` (it edits `WorkerSecret`, `wrangler.jsonc`, the preflight and the smoke test) and `feat/install-skills` (it provides `clientRateKey` and the private headers).

### Topology: one Worker, two hosts

The backoffice is a second custom domain on the existing Worker `zapbip-api`, dispatched by host before any route is matched:

- `apps/api/src/index.ts` (and `index.dev.ts`) reads the request host.
  - When its host and port equal those of `BACKOFFICE_ORIGIN`, compared case-insensitively (RFC 3986 hosts are case-insensitive), the request goes to `createBackofficeApp()`. `BACKOFFICE.LOCALHOST:8787` is served; `backoffice.localhost:8788` is not the backoffice.
  - The backoffice host with a trailing dot (`backoffice.zapbip.com.`) is rejected: the Worker answers `404` on every path from `fetch` itself, with the backoffice headers, and neither app sees the request.
  - Every other host goes to `createApp()`, unchanged.
- `createApp()` never mounts a backoffice route, and `createBackofficeApp()` mounts no MCP, connector, media, upload, webhook or install route. A test proves each host answers `404` for the other's paths.

| | development | staging | production |
|---|---|---|---|
| `BACKOFFICE_ORIGIN` | `http://backoffice.localhost:8787` | `https://backoffice-staging.zapbip.com` | `https://backoffice.zapbip.com` |
| route | none (`wrangler dev`) | `{ "pattern": "backoffice-staging.zapbip.com", "custom_domain": true }` | `{ "pattern": "backoffice.zapbip.com", "custom_domain": true }` |
| `BACKOFFICE_RATE_LIMITER` namespace | `3005` | `2005` | `1005` |

Why one Worker and not a separate `apps/backoffice` Worker is in ADR 0031. In short:

- The channel already needs the registry master key in this Worker, so a second Worker would hold the same key and add nothing.
- Direct D1 and Durable Object bindings, one deploy and one preflight.

### Operator identity

**Factors.**

- Knowledge: the backoffice key, `zb_bo_` followed by 32 random bytes in base64url. It is generated by the enrollment script and kept in the owner's password manager.
- Possession: a TOTP code (RFC 6238, HMAC-SHA-1, 6 digits, 30-second period, accepted at the current step and one step either side).
- The key has 256 bits of entropy, so it is stored as a SHA-256 digest and needs no slow password hash. A PBKDF2 or Argon2 hash would not fit the Workers Free 10 ms CPU budget, and a generated key does not need one ([ADR 0017](../../adr/0017-connection-secrets-are-shown-once-and-stored-as-digests.md) uses the same reasoning).

**Storage.**

- `BACKOFFICE_KEY_DIGEST` (hex SHA-256 of the key) and `BACKOFFICE_TOTP_SECRET` (base32) are Worker secrets, encrypted at rest by Cloudflare and never readable back through the API.
- Mutable state lives in the D1 row `backoffice_operator` (id `1`):
  - `last_totp_step`, which refuses replay;
  - `failed_attempts`;
  - `locked_until`.

**Enrollment, from the owner's terminal only.** `pnpm backoffice:enroll:<environment>` runs `apps/api/scripts/backoffice-enroll.ts --environment <environment>`:

1. It refuses unless stdin and stdout are a TTY. It reuses `terminal-shell.ts` and `hidden-prompt.ts` from deploy-readiness.
2. Production only: the owner types `production`.
3. It generates the key and a 20-byte TOTP secret with `crypto.getRandomValues`.
4. It prints the key once and the `otpauth://totp/zapbip%20backoffice%20(<environment>):operator?secret=<base32>&issuer=zapbip&algorithm=SHA1&digits=6&period=30` URI as a QR code in the terminal. It also prints the base32 text for authenticators that cannot scan.
5. The owner types the current code. The script verifies it locally. On a mismatch it stops, and nothing is written anywhere.
6. It pipes `BACKOFFICE_KEY_DIGEST` and `BACKOFFICE_TOTP_SECRET` through stdin to `wrangler secret put <NAME> --env <environment>`. The values never appear on a command line.
7. It runs `wrangler d1 execute <database> --env <environment> --remote` with a fixed statement. The statement deletes every `backoffice_sessions` row, resets the `backoffice_operator` row and inserts an `operator.enrolled` audit row.
8. It waits for Enter ("store the key, then press Enter"). Then it clears the screen and the scrollback (`ESC[2J ESC[3J ESC[H`).

Development prints the two `NAME=value` lines for the owner to paste into `apps/api/.dev.vars` (agents never edit dotenv files) and resets the local D1 with `--local`.

Re-running enrollment is the only recovery: lost authenticator, lost key, lockout or suspected compromise. It invalidates both factors and every session. There are no recovery codes, because the root of trust is the owner's terminal holding the scoped Cloudflare token ([ADR 0027](../../adr/0027-deploys-run-from-the-owners-machine-not-from-ci.md)).

`guard-deploy.sh` adds `backoffice:enroll` to its sensitive pattern, so an agent can never run it. The script's TTY refusal is the second layer.

**Sign-in.** `GET /sign-in` renders one form with two fields, the key and the code. `POST /sign-in`:

1. Origin check, then the pre-session CSRF double-submit cookie (below).
2. `BACKOFFICE_RATE_LIMITER.limit({ key: clientRateKey(address) })`, 5 per 60 s. Over the limit: `429` with `Retry-After`.
3. If `locked_until > now`, answer the generic failure without touching `failed_attempts`. The lockout is checked before the factors, so a locked operator learns nothing. When `locked_until <= now`, one `UPDATE` sets `failed_attempts = 0` and `locked_until = NULL` before the factors are checked, so an expired lock starts a fresh count.
4. Constant-time compare of the SHA-256 of the submitted key with `BACKOFFICE_KEY_DIGEST`. TOTP check for steps `current-1..current+1`, accepted only when `step > last_totp_step`. Both checks always run; there is no short-circuit.
5. Failure:
   - one atomic statement, `UPDATE backoffice_operator SET failed_attempts = failed_attempts + 1, locked_until = CASE WHEN failed_attempts + 1 >= ? THEN ? ELSE locked_until END WHERE id = 1 RETURNING failed_attempts, locked_until`, so concurrent failures lose no increment;
   - the 10th consecutive failure (`BACKOFFICE_LOCKOUT_THRESHOLD`) sets `locked_until = now + BACKOFFICE_LOCKOUT_MS` (15 min);
   - audit `sign_in.failed`, and `sign_in.locked` once, only on the failure whose `RETURNING` shows the lock was just set (never again while it holds);
   - one generic message ("Sign-in failed") with status `401`, whichever factor was wrong.
6. Success:
   - `last_totp_step = step` and `failed_attempts = 0` (a success resets the consecutive count), in one conditional `UPDATE … WHERE last_totp_step < ?`, so two concurrent uses of one code cannot both win;
   - a new session;
   - audit `sign_in.succeeded`;
   - `303` to `/`.

**Sessions.**

- The token is 32 random bytes in cookie `__Host-zb_bo_session`: `Secure; HttpOnly; SameSite=Strict; Path=/`, with no `Domain`.
- D1 `backoffice_sessions(token_digest, created_at, last_seen_at, expires_at)` stores only the SHA-256 digest.
- Idle timeout `BACKOFFICE_SESSION_IDLE_MS` is 30 min. Absolute lifetime `BACKOFFICE_SESSION_MAX_MS` is 8 h.
- `last_seen_at` is written at most once a minute, to spare D1 writes.
- Sign-out (`POST /sign-out`) deletes the row and expires the cookie. An expired or unknown session redirects every page to `/sign-in` and answers `401` to every POST.

**Step-up.** Every state-changing number action needs a fresh TOTP code in the same form, under the same replay rule:

- register;
- verify;
- rotate the access token;
- rotate the app secret;
- change state.

A stolen session cookie alone cannot change the registry.

A step-up code that is wrong or reused is a failed attempt like a sign-in failure:

- it runs the same atomic `failed_attempts` increment and shares the lockout, so a stolen session cannot guess codes without locking everything (the cost is that it can also lock the operator out for 15 minutes: Known risk 2);
- while `locked_until > now`, every step-up answers `401` without consuming a code, whatever its value;
- it takes `BACKOFFICE_RATE_LIMITER` with the key `step-up:` plus `clientRateKey(address)`, so step-ups and sign-ins have separate counters in the same namespace; over the limit: `429` with `Retry-After: 60`, no code consumed, no state change;
- audit `step_up.failed`, with the number as `target_id`;
- a successful step-up resets `failed_attempts` to 0 in the same conditional `UPDATE` that records `last_totp_step`.

**CSRF.** Two defences, both required on every non-GET request:

1. The `Origin` header equals `BACKOFFICE_ORIGIN`. A missing `Origin` is refused.
2. A hidden form field `csrf`:
   - Signed in: it carries `HMAC-SHA256(session token, "zapbip backoffice csrf")`, compared in constant time.
   - Signed out (the sign-in form): it is a random value that must equal the `__Host-zb_bo_csrf` cookie set by `GET /sign-in`.

`SameSite=Strict` is the third, passive layer.

**Response headers, on every backoffice response, including 404, 429 and 500:**

```
Content-Security-Policy: default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'
Strict-Transport-Security: max-age=63072000; includeSubDomains   (staging and production)
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: same-origin
Cache-Control: no-store   (except GET /assets/backoffice.css: public, max-age=31536000, immutable)
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
X-Robots-Tag: noindex, nofollow
```

**Audit log.** D1 `backoffice_audit(id, at, action, target_kind, target_id, outcome, client_address)`.

- Actions are an enum `BackofficeAuditAction`: `operator.enrolled`, `sign_in.succeeded`, `sign_in.failed`, `sign_in.locked`, `step_up.failed`, `sign_out`, `number.registered`, `number.verified`, `number.access_token_rotated`, `meta_app.app_secret_rotated`, `number.state_changed`.
- It never stores a submitted value. `target_id` is an internal ID.
- `client_address` is `cf-connecting-ip`, kept `BACKOFFICE_AUDIT_RETENTION_MS` (365 days) and pruned by the daily scheduled job.
- `GET /audit` lists the newest 200 rows, newest first, and nothing else.

**Stylesheet.** `GET /assets/backoffice.css` is public (the sign-in page needs it) and serves `apps/api/src/backoffice/assets/backoffice.css` as `text/css; charset=utf-8` with `Cache-Control: public, max-age=31536000, immutable`; the pages link it as `/assets/backoffice.css?v=<content hash>`, so a change is a new URL. It carries every other header above. It is CSP-compatible: no `@import`, no `url(` to another origin, no `data:` URI.

### Numbers registry

**Model.** New D1 migration `apps/api/migrations/0005_backoffice.sql`:

```sql
CREATE TABLE meta_apps (
  id TEXT PRIMARY KEY,
  meta_app_id TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sealed_app_secret TEXT NOT NULL,
  seal_key_version INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE whatsapp_numbers (
  id TEXT PRIMARY KEY,
  meta_app_ref TEXT NOT NULL REFERENCES meta_apps (id),
  phone_number_id TEXT NOT NULL UNIQUE,
  waba_id TEXT NOT NULL,
  display_number TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sealed_access_token TEXT NOT NULL,
  seal_key_version INTEGER NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('pending', 'active', 'closed', 'disabled')),
  verified_at INTEGER,
  verification_snapshot TEXT,
  credentials_changed_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX whatsapp_numbers_waba ON whatsapp_numbers (waba_id);

ALTER TABLE accounts ADD COLUMN number_id TEXT REFERENCES whatsapp_numbers (id);
CREATE INDEX accounts_number ON accounts (number_id);

CREATE TABLE backoffice_operator (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_totp_step INTEGER NOT NULL,
  failed_attempts INTEGER NOT NULL,
  locked_until INTEGER
);
INSERT INTO backoffice_operator (id, last_totp_step, failed_attempts, locked_until) VALUES (1, 0, 0, NULL);

CREATE TABLE backoffice_sessions (
  token_digest TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE backoffice_audit (
  id TEXT PRIMARY KEY,
  at INTEGER NOT NULL,
  action TEXT NOT NULL,
  target_kind TEXT,
  target_id TEXT,
  outcome TEXT NOT NULL,
  client_address TEXT
);
CREATE INDEX backoffice_audit_at ON backoffice_audit (at);
```

PR B adds `0006_activity.sql` (Metrics, below).

**Number states:**

| State | Webhook inbound | Outbound | New accounts |
|---|---|---|---|
| `pending` (just registered, not yet verified) | ignored, logged `inbound.number_pending` | refused | no |
| `active` | processed | sent | yes |
| `closed` | processed | sent | no; a new owner gets `NumberClosedToNewAccounts` |
| `disabled` | ignored after the signature check, `200` | refused with the restricted-channel error the agent already gets | no |

Allowed transitions:

- `pending → active` requires `verified_at` set.
- `active ↔ closed`.
- `active | closed → disabled`.
- `disabled → closed`.

**Sealing.**

- `NUMBER_REGISTRY_KEY` is a Worker secret: 32 bytes, base64.
- Values are sealed with AES-256-GCM in the existing sealed format (version byte `1`, 12-byte IV, ciphertext).
- The associated data is `whatsapp_numbers:<id>:access_token` or `meta_apps:<id>:app_secret`, so a sealed value copied into another row or field fails to open.
- The cipher lives in one shared helper, `apps/api/src/adapters/platform/aes-gcm-secret-box.ts`, extracted from `aes-gcm-wake-secret-box.ts`. The wake box becomes a wrapper with its tests unchanged. The repository rule is to search before adding a local copy.
- `seal_key_version` is `1`. A value that does not open is a hard error naming the row ID, never a silent skip.

**Registration** (`/numbers/new`, step-up required):

1. The operator picks an existing Meta app or adds one (Meta app ID, label, app secret). The app secret is sealed on save.
2. The operator enters the phone number ID, WABA ID, display number (E.164) and label, and pastes the access token (`type=password`, `autocomplete=off`).
3. The row is created as `pending`, and audit `number.registered` is written.
4. The first registered number also binds every account whose `number_id IS NULL`, in the same D1 batch. Only pre-launch development or staging data can have such accounts.
5. The response never echoes a credential. The page shows "set, last changed <date>".

**Verify** (step-up). It calls the Graph API through `createGraphClient` with that number's token:

- `GET /{phone_number_id}?fields=display_phone_number,verified_name,quality_rating`: the display number must match the registered display number, digits only;
- `GET /{waba_id}/message_templates?fields=name,language,status&limit=100`: shows the approval status of `zapbip_agent_notice` and `zapbip_agent_question` in `pt_BR` and `en_US`.

On success it sets `verified_at` and audits `number.verified`. Template status is shown and not required: a number whose templates are not approved can be activated, with the warning "out-of-window notices will fail".

The flow is POST, `303`, GET. `POST /numbers/:numberId/verify` stores the outcome in `verification_snapshot` (JSON: the outcome kind, the digits of both display numbers, the verified name, the quality rating, the four template statuses and `checked_at`; never a credential or a response body) and redirects to `GET /numbers/:numberId/verification`, which renders the snapshot. Reload repeats a GET, never a POST.

A Graph error shows its kind, mapped from `GraphRequestError` by status: `401` and `403` → `auth`; `404` → `not_found`; status `0` (no response) → `network`; every other status → `upstream`.

**Credential dates.** `credentials_changed_at` is set when a number is registered and when its access token is replaced, and by nothing else: a state change moves `updated_at` only. The page's "set, last changed" line for the token reads it; the app secret line reads `meta_apps.updated_at`, which only a secret replacement moves.

**Rotate.** "Replace access token" and "Replace app secret" each seal the new value, update `updated_at` and audit the action. In-flight requests finish with the old value; the next resolution reads the new one.

### WhatsApp channel resolution

`read-whatsapp-env.ts` keeps only environment facts:

- `WHATSAPP_GRAPH_BASE_URL`;
- `WHATSAPP_VERIFY_TOKEN` (the endpoint's token, typed into every Meta app's webhook settings);
- `WHATSAPP_MEDIA_DOWNLOAD_ORIGIN` in development.

Everything per number comes from the `NumberRegistry` port in `apps/api/src/numbers/number-registry.ts`, implemented by `apps/api/src/adapters/d1/d1-number-registry.ts`:

```ts
export type RegisteredNumber = { numberId: string; phoneNumberId: string; wabaId: string; state: WhatsAppNumberState; metaAppRef: string };
export type OutboundNumber = RegisteredNumber & { accessToken: string };
export interface NumberRegistry {
  findByPhoneNumberIds(input: { phoneNumberIds: string[] }): Promise<RegisteredNumber[]>;
  findByWabaIds(input: { wabaIds: string[] }): Promise<RegisteredNumber[]>;
  openAppSecret(input: { metaAppRef: string }): Promise<string>;
  openForAccount(input: { accountId: string }): Promise<OutboundNumber>;
  openForInbound(input: { numberId: string }): Promise<OutboundNumber>;
}
```

**Webhook `GET`.** Unchanged apart from the token's source: the Meta subscription challenge against `WHATSAPP_VERIFY_TOKEN`.

**Webhook `POST`**, in order:

1. The body limit `WEBHOOK_MAX_BYTES`, unchanged.
2. **Routing peek.** `JSON.parse`, then a permissive zod schema in `apps/api/src/adapters/whatsapp/webhook-routing-peek.ts` collects:
   - the distinct `entry[].changes[].value.metadata.phone_number_id`;
   - for changes without metadata, `entry[].id` (WABA ID).
   - Unparseable JSON, or nothing to route on, is answered `401 unauthorized`, because it cannot be attributed to a number. This replaces today's `400 invalid_json` for unsigned bodies.
3. **Attribution.** Resolve the IDs. The delivery must map to exactly one Meta app, because Meta signs each delivery with one app's secret.
   - Any unknown ID, or two apps in one delivery: `401` and an `inbound.unattributed` operator event.
   - The response is the same as for a bad signature, so registration cannot be probed.
4. **Signature.** `verifyWebhookSignature` with that app's opened secret. A mismatch is `401`.
5. The full parse and processing as today. The `change.phoneNumberId !== environment.phoneNumberId` check becomes a check on the number's state from the table above.
6. **Inbound to an owner.** `receiveOwnerInbound` gains `numberId`:
   - A new owner on an `active` number: core `openOwnerAccount` receives `homeNumberId`, an opaque string, and the D1 account directory writes it in the same insert as the account. The core never learns what a number is ([ADR 0008](../../adr/0008-a-pure-core-behind-ports.md)).
   - A new owner on a `closed` number: no account is created. The owner gets `OwnerCopyKey.NumberClosedToNewAccounts`, sent from that number.
   - An existing owner whose account is bound to another number: the message is not routed. The owner gets `OwnerCopyKey.AccountOnOtherNumber` with that number's display number, rendered by `renderCopy` and sent from the receiving number. The owner rate limiter bounds the replies.
   - The owner's own number: unchanged.
   - `owner_identities.wa_id` stays globally unique, so one person has one account ([ADR 0012](../../adr/0012-owner-identity-by-wa-id-on-the-shared-number.md), refined by ADR 0032 to "on the account's number").
7. Media download uses the receiving number's token. Statuses resolve the account by `message_index` as today.

**Outbound.** `createCloudApiMessageSender` takes `resolveNumber: () => Promise<OutboundNumber>` instead of fixed `phoneNumberId` and `graph`.

- `AccountInbox.createSender` passes `() => registry.openForAccount({ accountId })`.
- Each send resolves the number: one D1 read joined with the number row, and one AES-GCM open. It builds the Graph client and `D1ChannelRestrictions` for that `phone_number_id`.
- No plaintext token is kept between requests.
- A `pending` or `disabled` number, or an account without a number, fails the send with the existing restricted-channel error and logs `channel.number_unavailable`.

**Development and tests.**

- `apps/api/src/dev/build-directory-seed.ts` and `/dev/seed` register a fake number (phone number ID `1000000000000001`, fake Graph) sealed with the development `NUMBER_REGISTRY_KEY`. Development `WHATSAPP_GRAPH_BASE_URL` points at the local fake Graph, so the real sender runs against the seeded number. `dev-account-inbox.ts` loses its `WHATSAPP_ACCESS_TOKEN` fake-or-real `createSender` switch.
- Integration and e2e suites call `seedWhatsAppNumber()` from `apps/api/test/support/whatsapp-numbers.ts`.
- `whatsappTestEnv` and the `META_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` test bindings are deleted.

### Metrics (read-only, PR B)

**New counters.**

- Durable Object migration `v8.sql` adds `activity_meter(day, metric, count, flushed_count, recorded_at, last_flushed_at)`. It is written synchronously in the account's Durable Object, in the same place the event happens.
- `createActivityProvider` flushes it hourly to D1 `activity_daily(day, account_id, number_id, metric, count, PRIMARY KEY (day, account_id, metric))`. It is a `DueTimeProvider`, the same pattern as v7's `usage_meter` → `usage_daily`.
- No metric adds a D1 write per message.

`ActivityMetric` enum (`apps/api/src/contract/activity-metric.ts`): `messages_in`, `messages_out`, `templates_sent_notice`, `templates_sent_question`, `sends_failed`, `wakes_woken`, `wakes_unreached`.

| Metric on the page | Definition | Source | Freshness |
|---|---|---|---|
| Accounts by state | rows of `accounts` per `state` | D1 `accounts` | live |
| New accounts per day | `accounts.created_at` by UTC day, last 30 days | D1 `accounts` | live |
| Accounts per number | `accounts` grouped by `number_id`, joined to `label` | D1 `accounts`, `whatsapp_numbers` | live |
| Agents active | `connections` with `revoked_at IS NULL` | D1 `connections` | live |
| Agents connected | active and `first_call_at IS NOT NULL` | D1 `connections` | live |
| Agents by client | active grouped by `client_name`; `NULL` is shown as the copy "Not reported" | D1 `connections` | live |
| Agents created and revoked per day | `created_at`, `revoked_at` by UTC day, 30 days | D1 `connections` | live |
| Messages in | owner messages the inbox accepted (not duplicates, not dropped) | `activity_daily.messages_in` | up to 1 h |
| Messages out | session sends the Graph API accepted | `activity_daily.messages_out` | up to 1 h |
| Template sends | out-of-window notices sent, by kind | `templates_sent_notice`, `templates_sent_question` | up to 1 h |
| Send failures | sends that ended `failed` at send time | `sends_failed` | up to 1 h |
| Wake success | `woken / (woken + unreached)` per day, by rung outcome | `wakes_woken`, `wakes_unreached` | up to 1 h |
| Durable Object budget | `SUM(gigabyte_seconds)` per day from v7 against `DURABLE_OBJECT_DAILY_GIGABYTE_SECONDS` (13 000), with the `DAILY_BUDGET_WARNING_RATIO` (0.8) line; `isBudgetWarning` decides the colour | D1 `usage_daily` (deploy-readiness) | up to 1 h |
| Blocked phones | rows of `blocked_phones` | D1 | live |
| Restricted numbers | `channel_restrictions` within `RESTRICTION_TTL_MS`, per number | D1 | live |
| Wake attempt latency and status class | phase 2 | Analytics Engine `WAKE_METRICS` through the SQL API, which needs a read-only analytics token | none in phase 1 |

**Page layout.**

- Figures are filtered by number (all, or one) and by period (7, 30 days).
- Charts are server-rendered inline SVG bars with no script, styled by classes from `backoffice.css`, because `style-src 'self'` forbids inline styles.
- All queries for a page run in one `D1Database.batch`.
- The metrics pages are read-only: only `GET` is routed for them, and every statement in the batch is a `SELECT`.
- Today's row carries the copy "updates hourly".

### UI stack and copy

Server-rendered **Hono JSX** (`hono/jsx`, part of `hono@4.13.16`, already a dependency) with no client-side JavaScript:

- No new runtime dependency and no build step. The Worker already serves its own pages (`routes/install-page.ts`).
- Zero script makes `script-src` unnecessary, so the CSP is `default-src 'none'`. Plain HTML forms with `303` redirects (POST, redirect, GET) cover every action.
- The repository rule "copy strings never sit inline in JSX" already anticipates this.

`apps/api/tsconfig.json` gains `"jsx": "react-jsx", "jsxImportSource": "hono/jsx"`.

**Copy.**

- Backoffice copy lives in `apps/api/src/backoffice/backoffice-copy.ts` as `BACKOFFICE_COPY: Record<OwnerLocale, Record<BackofficeCopyKey, string>>`, with `pt_BR` and `en_US`.
- The locale comes from cookie `__Host-zb_bo_locale`, which a POST language switch sets. Without the cookie it follows `Accept-Language` when it starts with `en`; otherwise `DEFAULT_LOCALE`.
- Owner-facing WhatsApp replies go to `whatsapp-copy.ts`:
  - `AccountOnOtherNumber`: pt_BR "Sua conta zapbip está no número {number}. Escreva para ele." / en_US "Your zapbip account is on {number}. Please write to that number."
  - `NumberClosedToNewAccounts`: pt_BR "Este número não está aceitando novas contas agora." / en_US "This number is not accepting new accounts right now."

Visual design (layout, tokens, chart style) is the owner's choice and goes in `design.md` through a `frontend-designer` sub-agent before the plan is approved.

### Configuration changes

| Name | Change | Kind |
|---|---|---|
| `META_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | **removed** from `Bindings`, `WorkerSecret`, `.env.example`, the test bindings and the preflight | were Worker secrets |
| `WHATSAPP_VERIFY_TOKEN` | kept (endpoint-owned) | Worker secret |
| `NUMBER_REGISTRY_KEY` | added, `openssl rand -base64 32`; not rotated in phase 1 (rotation means re-entering every credential) | Worker secret |
| `BACKOFFICE_KEY_DIGEST`, `BACKOFFICE_TOTP_SECRET` | added; written only by `backoffice:enroll` | Worker secrets |
| `BACKOFFICE_ORIGIN` | added per block | var |
| `BACKOFFICE_RATE_LIMITER` | added, `simple: { limit: 5, period: 60 }` | rate limit binding |
| `SMOKE_META_APP_SECRET`, `SMOKE_PHONE_NUMBER_ID` | added to the owner's `.env` only, replacing the smoke script's reads of the removed names; never deployed | smoke inputs |

**Go-live order:** secrets → migrate → enroll → deploy → register number → point the Meta webhook → smoke. `deploy-preflight.ts` refuses a deploy while any `WorkerSecret` is missing, and enroll needs migration `0005` applied. The order lives in `GO_LIVE_ORDER` of `tools/repository-shape/src/runbooks.test.ts` and in `docs/runbooks/deploy.md`.

The deploy preflight gets the new `WorkerSecret` names for free, because step 9 lists the enum. `OFFICIAL_WHATSAPP_NUMBER` in `libs/types` stays, as the front-door number the docs publish (see Open questions).

### Isolation from agents

- No file under `apps/api/src/mcp`, `apps/api/src/routes`, `apps/api/src/account-inbox`, `apps/connector` or `libs/` imports from `apps/api/src/backoffice` or names a `backoffice_` table. The test scans exactly those directories: `apps/api/src/index.ts`, `index.dev.ts` and `apps/api/scripts/backoffice-enroll.ts` are outside them, so the enrollment script imports `auth/totp.ts` and the base32 helper directly and no shared helper is needed.
- Only `apps/api/src/numbers`, `apps/api/src/adapters/d1/d1-number-registry.ts` and `apps/api/src/backoffice/numbers` read the sealed columns.
- A repository test pins both rules.
- The MCP host answers `404` to every backoffice path.
- No MCP tool result, connector frame or error message carries a phone number ID, WABA ID, display number, token or app secret.
- `guard-deploy.sh` blocks `backoffice:enroll` for agents.

### Logs

New `LogEvent` values:

- `backoffice.sign_in_failed`
- `backoffice.sign_in_succeeded`
- `backoffice.locked`
- `backoffice.csrf_rejected`
- `backoffice.number_changed`
- `backoffice.error`

New `OperatorEvent` values:

- `inbound.unattributed`
- `inbound.number_pending`
- `inbound.number_disabled`
- `inbound.account_on_other_number`
- `inbound.number_closed`
- `channel.number_unavailable`

Fields are event names, internal IDs (`numberId`), kinds and outcomes. Logs never carry:

- the key, the code or the TOTP secret;
- tokens or app secrets;
- display numbers, phone number IDs or WABA IDs;
- form bodies or client addresses.

The backoffice `onError` logs `backoffice.error` with the error's class name only.

### Data flow

```
owner terminal ── pnpm backoffice:enroll:<env> ──► wrangler secret put (key digest, TOTP secret)
                                                └► wrangler d1 execute (reset operator, drop sessions, audit)

operator browser ── https://backoffice.zapbip.com ──► Worker fetch ── host = BACKOFFICE_ORIGIN ──► createBackofficeApp
     sign-in (key + TOTP) ─► D1 backoffice_operator / backoffice_sessions / backoffice_audit
     numbers (step-up)    ─► seal(NUMBER_REGISTRY_KEY) ─► D1 meta_apps / whatsapp_numbers ─► Graph API (verify)
     metrics              ─► D1 accounts, connections, usage_daily, activity_daily (one batch)

Meta ── POST /webhooks/whatsapp (mcp host) ──► peek phone_number_id | WABA id ─► registry ─► open app secret ─► verify signature
                                            └► receiveOwnerInbound(numberId) ─► AccountInbox ─► activity_meter (v8)
AccountInbox send ─► registry.openForAccount ─► open access token ─► Graph /{phone_number_id}/messages
AccountInbox alarm ─► flush usage_meter → usage_daily, activity_meter → activity_daily (hourly)
```

### Interfaces

| Surface | Contract |
|---|---|
| `apps/api/src/index.ts`, `index.dev.ts` | host dispatch: `isBackofficeRequest({ url, backofficeOrigin })` → `createBackofficeApp()`; else `createApp()` |
| `apps/api/src/backoffice/app.ts` | `createBackofficeApp(): Hono<{ Bindings: Bindings }>`; routes `GET /`, `GET/POST /sign-in`, `POST /sign-out`, `POST /locale`, `GET /metrics`, `GET /numbers`, `GET/POST /numbers/new`, `GET /numbers/:numberId`, `POST /numbers/:numberId/verify`, `GET /numbers/:numberId/verification`, `POST /numbers/:numberId/access-token`, `POST /numbers/:numberId/state`, `POST /meta-apps/:metaAppId/app-secret`, `GET /audit`, `GET /assets/backoffice.css` |
| `apps/api/src/backoffice/auth/totp.ts` | `totpCodeAt({ secretBase32, step })`, `matchTotpStep({ secretBase32, code, now, lastStep }): number \| null` |
| `apps/api/src/numbers/number-registry.ts` | the port above; `WhatsAppNumberState` enum |
| `libs/core` `openOwnerAccount` | input gains `homeNumberId: string`; the `AccountDirectory.create` port carries it |
| `apps/api/scripts/backoffice-enroll.ts` | `--environment development \| staging \| production`; shell and prompt as named parameters, so tests replace them |
| root scripts | `backoffice:enroll:development`, `backoffice:enroll:staging`, `backoffice:enroll:production` |
| `apps/api/migrations/` | `0005_backoffice.sql` (PR A), `0006_activity.sql` (PR B) |
| `apps/api/src/account-inbox/migrations/v8.sql` | `activity_meter` (PR B) |

### Failure handling

| Failure | Behaviour |
|---|---|
| Wrong key, wrong code, reused code or expired code | `401` and the same generic copy; `failed_attempts + 1`; audit row |
| Wrong or reused step-up code | `401`, re-rendered form, no state change; the same `failed_attempts` and lockout; audit `step_up.failed` |
| 10 consecutive failures | locked for 15 min, even with correct factors; audit `sign_in.locked`; the owner re-enrolls to unlock at once |
| More than 5 sign-in POSTs a minute from one address | `429` with `Retry-After: 60` |
| Missing or foreign `Origin`, or a bad `csrf` field | `403`, `backoffice.csrf_rejected`, no state change |
| Session idle more than 30 min or older than 8 h | redirect to `/sign-in`; the row is deleted on the next prune |
| `BACKOFFICE_*` secret missing | every backoffice request answers `503`; the preflight refuses the deploy first |
| `NUMBER_REGISTRY_KEY` missing or wrong | sends fail with the restricted-channel error; webhooks answer `500`, because it is a server misconfiguration (Meta retries for up to 7 days); `channel.number_unavailable`; the preflight refuses a missing key |
| A sealed value does not open (swapped row, corrupted value) | hard error naming the internal row ID; that number is unavailable, the others work |
| Webhook for an unregistered number, or a delivery spanning two apps | `401`, `inbound.unattributed` |
| Number `pending` or `disabled` | inbound ignored after the signature check, `200`; outbound refused |
| Graph verify fails | the error kind is shown; `verified_at` stays null; state stays `pending` |
| No registered number in a fresh environment | webhooks `401`, sends refused; the go-live runbook registers the number before the Meta webhook is pointed at the host |
| D1 batch fails during registration | nothing is written (one batch); the operator sees an error and retries |

### Known risks

1. **TOTP is phishable by a real-time relay.** Mitigations: a separate unlisted host, HSTS, step-up on every change, the audit log, re-enrollment. Passkeys in phase 2 remove the risk.
2. **Lockout can be triggered by anyone who reaches the host.** This is deliberate: it trades a 15-minute denial of service for bounded guessing. Recovery is re-enrollment.
3. **The Workers rate limiter is per location and eventually consistent.** The D1 lockout counter is the hard bound.
4. **One Worker holds every secret.** A code-execution bug in any route reaches the registry key. Mitigations: the isolation tests and review. A split Worker would not remove the key from this Worker (ADR 0031).
5. **`backoffice.localhost` cookies in development.** `__Host-` with `Secure` over `http` depends on Chromium treating `*.localhost` as a secure context. The first integration test and the walk prove it; the fallback is `wrangler dev --local-protocol https`.
6. **Template status is a snapshot at verify time.** Phase 2 subscribes to status webhooks.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Name and host | admin panel at `admin.zapbip.com` · backoffice at `backoffice.zapbip.com` | backoffice, `backoffice.zapbip.com` | 2026-11-07 |
| Are numbers configuration? | Worker secrets per number · registry in the backoffice | registry, sealed with a Worker master key; no number ID, token or app secret as Worker secret or constant | 2026-11-07 |
| Phase 1 scope | auth + metrics, numbers later · auth + numbers + read-only metrics | auth + numbers registry + read-only metrics; everything else phase 2 | 2026-11-07 |
| Webhook routing | one endpoint per number · one endpoint, number by `metadata.phone_number_id`, that number's app secret | one endpoint | 2026-11-07 |
| Second factor | TOTP + key · passkeys · both · Cloudflare Access | recommended: TOTP + generated key now, passkeys as an added factor in phase 2 (ADR 0031) (owner delegated 2026-11-06) | 2026-11-07 |
| Where the backoffice runs | same Worker, second host · separate `apps/backoffice` Worker | recommended: same Worker (ADR 0031) (owner delegated 2026-11-06) | 2026-11-07 |
| UI stack | Hono JSX server-rendered, no script · static SPA | recommended: Hono JSX (owner delegated 2026-11-06) | 2026-11-07 |
| Verify token | one Worker secret for the endpoint · per Meta app in the registry | recommended: one Worker secret: it belongs to the endpoint, and the operator types it into each Meta app (owner delegated 2026-11-06) | 2026-11-07 |
| Owner who writes to a number other than their account's | route anyway · reply with the account's number and drop · a second account per number | recommended: reply and drop (wa_id stays unique, ADR 0012 amended by ADR 0032) (owner delegated 2026-11-06) | 2026-11-07 |
| Template approval before activation | required · warning only | recommended: warning, so Meta test numbers can be activated in staging (owner delegated 2026-11-06) | 2026-11-07 |
| QR in the terminal | add `uqr` (zero dependencies) as a script devDependency · print only the `otpauth://` URI and base32 | answer: `uqr` as a script devDependency (owner delegated 2026-11-06) | 2026-11-07 |
| Playwright for the walk in `apps/api` | add `@playwright/test`, pinned exactly when G6 adds it (not in the lockfile today; only `playwright-core@1.63.0` is) · reuse `apps/docs` | recommended: add to `apps/api` (owner delegated 2026-11-06) | 2026-11-07 |
| `OFFICIAL_WHATSAPP_NUMBER` | keep as the docs' front-door number · remove | recommended: keep as a published fact (the docs are static), with a phase 2 preflight check that the registry holds it as `active` (owner delegated 2026-11-06) | 2026-11-07 |
| `Referrer-Policy` on the backoffice | `no-referrer` · `same-origin` | `same-origin`: `no-referrer` makes browsers send `Origin: null` on every form post, which the CSRF check refuses; nothing leaves the site either way (found by the G6 walk; owner delegated 2026-11-06) | 2026-11-07 |
| Development routes | inherit the deployed custom domains · `"routes": []` | `"routes": []` in `env.development`, so `wrangler dev` keeps the request host and `backoffice.localhost` reaches the backoffice (found by the G6 walk) | 2026-11-07 |
| Audit retention and client address | 365 days with address · no address | recommended: 365 days with address (owner delegated 2026-11-06) | 2026-11-07 |
| Second ADR | one ADR for access, ADR 0032 for the registry · one combined | two: 0031 for access and 0032 for the numbers registry, both accepted with this spec (owner delegated 2026-11-06) | 2026-11-07 |

## Test strategy summary

- **Unit (Vitest):**
  - TOTP against the RFC 6238 SHA-1 vectors, the step window and replay;
  - key digest and constant-time compare;
  - CSRF token derivation;
  - the header set;
  - the routing peek on every fixture;
  - the number-state transition table;
  - sealed associated data;
  - activity meter arithmetic;
  - the enrollment script with a fake shell and prompt (TTY refusal, code mismatch writes nothing, values only on stdin, the production confirmation);
  - `guard-deploy.sh` blocking `backoffice:enroll`.
- **Workers integration (`@cloudflare/vitest-pool-workers`):**
  - host isolation;
  - sign-in, lockout, sessions, step-up, CSRF and headers on every status;
  - registry seal, open and rotate;
  - webhook attribution and signatures per number;
  - account binding and wrong-number replies;
  - outbound per number;
  - the first-number backfill;
  - the activity flush and metrics queries;
  - log redaction across the whole flow.
- **E2E:** the existing WhatsApp e2e suites seed a registry row instead of number secrets. New Playwright specs under `apps/api/e2e/backoffice/` cover sign-in, numbers and metrics against `wrangler dev` with the fake Graph.
- **Playwright MCP walk:** sign-in through register, verify, activate and metrics, at 1280 and 375, plus the unhappy paths.
- **Repository shape:** the isolation import rule and the new rule file.
