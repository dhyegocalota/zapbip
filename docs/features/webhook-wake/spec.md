# Webhook wake

**Status:** Building
**Tier:** 🔴
**Owner approval:** approved 2026-11-06 (owner delegated)
**ADRs:** [0018](../../adr/0018-webhook-wake-carries-no-message-content.md), [0019](../../adr/0019-outbound-wake-targets-pinned-providers-and-guarded-generic-hosts.md); builds on [0006](../../adr/0006-one-secret-per-connection-in-the-mcp-url.md), [0007](../../adr/0007-a-durable-inbox-and-a-wake-ladder.md), [0008](../../adr/0008-a-pure-core-behind-ports.md), [0009](../../adr/0009-cloudflare-workers-with-one-durable-object-per-account.md), [0011](../../adr/0011-the-24-hour-window-queues-and-sends-one-notice.md)
**Not changing:** the ten MCP tools of `agent-inbox-core` and their behaviour; the `AgentWaker` port keeps its `notify` signature; the message kinds; the 24-hour window rules. Nothing outside the webhook rung, `set_wake`, its ports and adapters, the Mintlify pages and the indexes.

## Problem

An owner's agent that is not running cannot answer a WhatsApp message until something starts it. Two of the clients the owner uses can be started by an HTTP call: a Grok Bot routine with a webhook trigger (measured ~9 s from POST to reply) and a claude.ai scheduled task with an API trigger (measured ~16 s). ADR 0007 makes this the second rung of the wake ladder. Without it the owner waits for the next time the agent opens.

This slice builds the webhook rung: the `AgentWaker` adapter, the `set_wake` tool that configures it, retries, coalescing, the fallback to the owner, token encryption, observability and the docs. It runs against a scripted transport in tests, so no real provider is called in CI.

## Goals

1. `set_wake` MCP tool (the eleventh tool of the surface; the ten of `agent-inbox-core` are unchanged). It saves a connection's `WakeSetting`, the union of scheduled-wake shared with [install-skills](../install-skills/spec.md): the `webhook` variant with `url` and `token`, or `none` to clear it.
2. Three webhook providers, identified by the pinned host of the URL, never by a request field:
   - `grok_routine` on `api2.cursor.sh`, bearer token;
   - `claude_routine` on `api.anthropic.com`, bearer token and the routine beta headers;
   - `generic`, any guarded `https` host, HMAC-signed with the owner's key, no secret sent.
3. A payload-less wake: the constant body `WAKE_SIGNAL_BODY` (ADR 0018).
4. Coalescing: one wake per burst of owner messages for an agent, within a fixed debounce window.
5. Retries with exponential backoff, `Retry-After` honoured, a cap on delay and on attempts, all driven by Durable Object alarms.
6. Fallback: when a wake is refused or gives up, the owner gets the `NoneWaker` notice through the normal outbound rules.
7. Stored targets (URL and token) encrypted at rest with AES-256-GCM under a Worker secret, bound to the connection.
8. Metrics and logs that never carry a URL, path, token, header value or owner content.
9. Mintlify pages for the rung, the two providers and the generic signature.

## Non-goals

- The local connector, scheduled tasks and the standby agent rungs. Their `WakeSetting` variants are validated by their own slices; until those land, `set_wake` returns the tool error "wake mode not available yet".
- Installing the webhook in a client. The prompts and the owner's clicks belong to [install-skills](../install-skills/spec.md). This slice provides the call they make.
- Verifying a token with the provider before saving. There is no documented check endpoint, and a probe would start a real routine run. Decision in the answers table.
- Reading unread state after a successful delivery. If a delivered wake is never followed by a read, the owner waits (risk, below).
- Key rotation tooling for `WAKE_SECRET_KEY`. The sealed value carries a key version so rotation can be added later.
- Deploy wiring of the secret. It belongs to `deploy-readiness`.

## Design

### Data flow

```
owner msg ─► core.receive ─► no live waiter for agent, unread > 0 ─► AgentWaker.notify(agent)
                                              │ (WebhookWaker)
                                              ▼
                          WakeScheduler: upsert wake_jobs(agent) due = now + WAKE_DEBOUNCE_MS
                                              │
            one alarm slot per DO ──► AccountInbox.alarm()
                                              │ core.runDueWakes(now)
                                              ├─ no unread, or a live waiter exists → drop job
                                              ├─ lease the job (in flight until now + WAKE_LEASE_MS)
                                              ├─ WakeTransport.send(target, WAKE_SIGNAL_BODY)   (fetch, redirect: manual)
                                              │     delivered ─► job done, status active
                                              │     retry     ─► attempt + 1, due = now + delay
                                              │     refused or attempts spent
                                              │               ─► job done, status failing,
                                              │                  deliverToOwner (wakeFailed copy)
                                              └─ re-arm the single alarm to min(due_at)
```

### Wake configuration and `set_wake`

`set_wake` takes one `WakeSetting` (scheduled-wake); this slice defines the `webhook` and `none` variants. The call for a webhook is `set_wake({mode: "webhook", url, token})`:

| Input | Rule |
|---|---|
| `mode` | `WakeMode`. `webhook` requires `url` and `token`; `none` clears the wake and requires neither; `local`, `scheduled` and `standby` return "wake mode not available yet" until their slices land |
| `url` | `https`, no userinfo, no fragment, port `443` or absent, at most `WAKE_URL_MAX_CHARS` (512). Its host selects the provider (table below) and the provider's path pattern must match |
| `token` | printable, no whitespace, 16 to 512 characters for pinned providers; at least 32 characters for `generic`, where it is the HMAC key |

Provider by host:

| Provider (`WakeProvider` enum) | Host | Path | Auth sent | Notes |
|---|---|---|---|---|
| `GrokRoutine` | `api2.cursor.sh` | `^/automations/webhook/[A-Za-z0-9_-]{8,64}$` | `Authorization: Bearer <token>` | Grok Bot routine webhook trigger |
| `ClaudeRoutine` | `api.anthropic.com` | `^/v1/claude_code/routines/trig_[A-Za-z0-9]+/fire$` | `Authorization: Bearer <token>`, `anthropic-beta: experimental-cc-routine-2026-04-01`, `anthropic-version: 2023-06-01` | claude.ai scheduled task, API trigger (the public `/fire` endpoint) |
| `GenericWebhook` | any host passing the name guard (ADR 0019) | any | none; `X-Zapbip-Timestamp` and `X-Zapbip-Signature` | the owner's service |

Any other host with `mode: webhook` and no matching pattern returns a validation error that names the field (`url`). Errors never echo the URL or the token.

`set_wake` does not call the provider. A wrong token shows on the first wake, as a refused attempt and the owner's fallback notice. The response is `{status: "saved", wake_mode, effective_rung, provider}`, with `provider` for `webhook` only; it never returns the URL, the token or the host of a generic target beyond the `provider` name.

### Generic signing

Each generic wake request carries:

- `X-Zapbip-Timestamp`: Unix seconds, the wire format (converted from milliseconds at the edge);
- `X-Zapbip-Signature`: `sha256=` followed by the lowercase hex HMAC-SHA256 of `<timestamp>.<body>`, keyed with the owner's `token`.

The receiver rejects a timestamp more than `WAKE_SIGNATURE_TOLERANCE_S` (300) seconds old. The example in the docs verifies with `crypto.timingSafeEqual`. No bearer token is sent to a generic target.

### Coalescing

- One `wake_jobs` row per agent (primary key `agent`). A message that lands while a row is pending keeps its `due_at`. The window is fixed from the first message, so a steady stream cannot postpone the wake forever.
- A message that lands while the row is in flight sets `rewake = true`. When the attempt settles, the scheduler schedules one follow-up wake. A retry clears `rewake`, because the retry already covers the new message. No message is left without a wake.
- Per-agent cap: at most one wake request per agent per `WAKE_MIN_INTERVAL_MS` (60 s). A new job is due at the later of `now + WAKE_DEBOUNCE_MS` and the last request time plus the cap, so messages inside the cap coalesce into the next allowed request and an agent that never reads gets about one request a minute. The follow-up wake obeys the same cap, which also keeps it longer than a provider's start time (about 16 s for claude.ai). The last request time lives in the object's key-value storage, not in a table.
- After a wake gives up (`failing`), the next owner message schedules a new wake even when earlier messages are still unread; in the `active` state a message that lands on unread messages schedules none.
- At fire time the job is dropped without a request when the agent has no unread owner messages or a live waiter. The agent already read them or is answering.

### Retries and the alarm

- Durable Object storage holds one alarm per object. `AccountInbox.alarm()` runs every due job, then sets the alarm to the earliest `due_at` among the remaining jobs. Only the object's alarm handler arms alarms.
- `alarm()` catches every error and never throws. A thrown alarm is retried by the platform with its own backoff, which would bypass the cap below. Failures are recorded on the job instead.
- A job is leased while in flight (`lease_until = now + WAKE_LEASE_MS`). A retried alarm skips a leased job, so an evicted object cannot send the same wake twice in parallel.
- Retry: after attempt `n` fails with a retryable outcome, the next attempt is due after `min(WAKE_BACKOFF_BASE_MS × 2^(n−1), WAKE_BACKOFF_CAP_MS)`, or after the response's `Retry-After` when present, also capped. With the constants below: 5 s, 10 s, 20 s, 40 s between attempts.
- No jitter. Each connection has one target, so jitter buys nothing and makes the fake-clock tests less exact.

### Outcomes

| Response or error | Outcome | Next step |
|---|---|---|
| `2xx` | `delivered` | job done; status `active`; `last_delivered_at` set |
| `408`, `425`, `429`, `500`–`599` except `501` | `retry` | backoff above; `429` and `503` honour `Retry-After` |
| network error, or timeout after `WAKE_REQUEST_TIMEOUT_MS` (10 s) | `retry` | backoff; the metrics status class is `timeout` when the attempt lasted at least the timeout, `network` otherwise |
| `3xx` (redirects are not followed), `400`–`499` except `408`, `425`, `429` | `refused` | fallback now; no retry |
| `501`, or a sealed target that cannot be opened | `refused` | fallback now |
| attempt `WAKE_MAX_ATTEMPTS` (5) fails | `gave_up` | fallback |

Fallback: `deliverToOwner` with the `wakeFailed` text, which sends the owner the `wakeFailed` notice (`libs/core/src/wake/wake-copy.ts`, `pt_BR` and `en_US`: the message waits in the inbox and the wake must be set again) through the normal outbound path, so the 24-hour window and "one notice per closed window" still hold. The wake is settled first (status `failing`, job finished) and the notice is sent afterwards; a notice that fails is logged as `wake.notice_failed` and never re-sends the wake. A wake cleared or replaced while its request is in flight is not settled and gets no notice. Status becomes `failing`. The next `delivered` returns it to `active`. Status is stored on the connection and never repeated as more notices.

### Request shape

- Method `POST`, body `WAKE_SIGNAL_BODY` (`{"event":"inbox_has_messages"}`), `content-type: application/json`, no owner text, no counts.
- Every target, including `ClaudeRoutine`, receives `WAKE_SIGNAL_BODY` unchanged. The `/fire` endpoint takes an optional `text` field that the routine would read as untrusted data, so this slice never sends it (ADR 0018). Risk: `/fire` may reject the unknown `event` field with `400`; that shows as a refusal and the owner-run check in the test plan catches it before release.
- `redirect: "manual"`; `signal` with `WAKE_REQUEST_TIMEOUT_MS`.
- The provider's headers are constants in `libs/core`; the token is read from the opened target at send time and never stored in memory beyond the request.

### Storage

In the `AccountInbox` SQLite database (ADR 0009):

| Table | Columns |
|---|---|
| `agent_wake` | the row of agent-inbox-core (`agent`, `mode`, `last_polled_at`, `updated_at`), plus `provider`, `host`, `sealed_target`, `key_version`, `status` (`active`, `failing`) and `last_delivered_at`, in DO schema `v2` |
| `wake_jobs` | `agent` (PK), `due_at`, `attempt`, `lease_until`, `rewake`, `last_outcome`, in DO schema `v2` |

`sealed_target` is the base64 of `version (1 byte) ‖ iv (12 bytes) ‖ AES-256-GCM ciphertext and tag` of the JSON `{url, token}`. The additional authenticated data is `${accountId}:${agent}`, so a sealed value cannot be moved to another connection. A new IV is drawn on every seal.

### Token encryption

- Key: `WAKE_SECRET_KEY`, a Worker secret holding 32 random bytes in base64, read at start. A missing or wrong-length key stops the Worker at start; there is no default key.
- Implementation: WebCrypto `AES-GCM`, 256-bit, in `apps/api/src/adapters/wake/aes-gcm-wake-secret-box.ts`, behind the `WakeSecretBox` port.
- Failure to open (wrong key version, tampered value, wrong binding): the target is refused, the fallback runs and the connection is `failing`. The owner is told to set the wake again.

### Interfaces

Core ports (`libs/core`); the existing `AgentWaker` keeps its `notify` signature:

| Port | Responsibility | Adapter in this slice | Test double |
|---|---|---|---|
| `AgentWaker` (existing) | `notify({agent, reason})` schedules a wake for an agent with no live waiter; the reason enum is unchanged (`AgentWakeReason.MessageWaiting`) | `WebhookWaker` (schedules a `wake_jobs` row) and `NoneWaker`, chosen per effective rung | `RecordingAgentWaker` |
| `WakeTransport` (new) | `send({target, body}) → WakeAttemptResult` (`{outcome, statusCode?, retryAfterMs?}`) | `FetchWakeTransport` (`fetch`, `redirect: "manual"`, timeout) | `ScriptedWakeTransport` (records each request and replays scripted responses or errors) |
| `WakeSecretBox` (new) | `seal({plain, associatedData})`, `open({sealed, associatedData})` | `AesGcmWakeSecretBox` | `InMemoryWakeSecretBox` |
| `Clock` (existing) | now | `PlatformClock` in production; `ManualClock` in tests | — |

Use cases in `libs/core/src/wake/`: `setWake`, `scheduleWake` (debounce and `rewake`), `runDueWakes` (lease, attempt, outcome, fallback, re-arm), `assertWakeTarget` (the guard of ADR 0019, pure), `signWakeRequest` (canonical string; the HMAC itself runs in the adapter), and the provider record keyed by `WakeProvider`.

Constants in `libs/core/src/wake/constants.ts`, named and never inline:

| Constant | Value |
|---|---|
| `WAKE_DEBOUNCE_MS` | 3 000 |
| `WAKE_REQUEST_TIMEOUT_MS` | 10 000 |
| `WAKE_LEASE_MS` | 15 000 |
| `WAKE_BACKOFF_BASE_MS` | 5 000 |
| `WAKE_BACKOFF_CAP_MS` | 60 000 |
| `WAKE_MAX_ATTEMPTS` | 5 |
| `WAKE_SIGNAL_BODY` | `{"event":"inbox_has_messages"}` |
| `WAKE_URL_MAX_CHARS` | 512 |
| `WAKE_TOKEN_MIN_CHARS` | 16 |
| `WAKE_GENERIC_TOKEN_MIN_CHARS` | 32 |
| `WAKE_SIGNATURE_TOLERANCE_S` | 300 |
| `PUBLIC_ORIGIN` | the one base-URL binding (agent-inbox-core); the guard's own host is the bare hostname derived from it, never a literal |

Provider constants (host, path pattern, headers) sit beside the `WakeProvider` record. Enums: `WakeProvider` (`GrokRoutine`, `ClaudeRoutine`, `GenericWebhook`) in `libs/core`; `WakeAttemptOutcome` (`Delivered`, `Retry`, `Refused`) in `libs/types`. `WakeMode` and `WakeRung` come from `libs/types` (agent-inbox-core; this slice adds `Webhook`); the fallback is `deliverToOwner` with the `wakeFailed` text, selected by `OwnerLocale`.

### Observability

- Structured logs through one typed logger. Its event type is a union of `WakeLogEvent` (`wake.scheduled`, `wake.dropped`, `wake.delivered`, `wake.retry`, `wake.refused`, `wake.gave_up`) with fields `provider`, `agent`, `attempt`, `statusCode`, `latencyMs`, `outcome`. It has no `url`, `token`, `host` or `headers` fields, so a secret cannot be passed to it without a type error.
- Metrics: one Analytics Engine datapoint per attempt (dataset binding `WAKE_METRICS`). Blobs: `provider`, `outcome`, `status class` (`2xx`, `4xx`, `5xx`, `timeout`, `network`). Doubles: `attempt`, `latencyMs`. No host, path or token.
- Error objects from `fetch` are reduced to their class name before logging; a message string could contain the URL.

### Docs (Mintlify, `apps/docs`)

- `guides/webhook-wake.mdx`: what the rung does; the Grok Bot routine setup and the claude.ai API-trigger setup, each with placeholder values only; the generic signature with a verification snippet; the failure behaviour (owner notice, `failing` status, set the wake again).
- `mcp-reference/set-wake.mdx`: the input table, the provider table and the errors.
- Both pages are in the single `docs.json` navigation of agent-inbox-core → Docs. `mint broken-links` runs for `apps/docs/**`.

## Failure handling

| Failure | Behaviour |
|---|---|
| `set_wake` URL or token invalid | tool error naming the field; nothing stored; the previous wake stays |
| Provider refuses (`4xx`, `3xx`, `501`) | no retry; owner notice; `failing` |
| Provider down (`5xx`, timeout, network) | retry up to `WAKE_MAX_ATTEMPTS`, then owner notice; `failing` |
| Owner messages keep arriving during retries | they join the pending job; no extra requests while leased |
| Object evicted during an attempt | the lease expires after `WAKE_LEASE_MS`; the platform re-runs the alarm; at most one extra send |
| Sealed target cannot be opened | refused; owner notice; `failing`; the agent sets the wake again |
| Agent reads the messages before the alarm | the job is dropped without a request |
| Wake delivered, agent never reads | no further action (risk) |
| Alarm handler throws | caught; the job records `last_outcome`; the alarm is re-armed |

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Payload in the webhook? | message text · counts and ids · constant signal | constant signal (ADR 0018) | owner delegated 2026-11-06 |
| Which targets? | pinned providers only · pinned providers and guarded generic hosts · resolve DNS per send | pinned providers and guarded generic hosts (ADR 0019) | owner delegated 2026-11-06 |
| Provider from the host or a field? | a `provider` input · derived from the pinned host | derived from the host; `set_wake` keeps the install-skills input | owner delegated 2026-11-06 |
| Verify the token at `set_wake`? | probe the provider · format checks only | format checks only; no probe, since a probe starts a real run and no check endpoint is documented; the first owner message proves the wake | owner delegated 2026-11-06 |
| Retry policy | none · fixed · exponential with cap | 5 attempts, 5 s doubling, 60 s cap, `Retry-After` honoured, no jitter | owner delegated 2026-11-06 |
| Coalescing | none · trailing debounce that extends · fixed window from first message | fixed 3 s window from first message, one follow-up for a message during flight | owner delegated 2026-11-06 |
| Token storage | plain in SQLite · AES-GCM with a Worker secret · a secrets store per connection | AES-GCM with `WAKE_SECRET_KEY`, bound to account and agent | owner delegated 2026-11-06 |
| Generic signing | none · bearer · HMAC-SHA256 with timestamp | HMAC-SHA256 with timestamp; no secret sent | owner delegated 2026-11-06 |
| Fallback | silent · owner notice | owner notice through the normal outbound rules | owner delegated 2026-11-06 |
| Claude endpoint | the POC's internal `/v1/code/triggers/{id}/run` · public `/fire` | public `/fire` with the `experimental-cc-routine-2026-04-01` header; the POC path is not public | owner delegated 2026-11-06 |
| Test ping on `set_wake` | yes · no | no (see the token row) | owner delegated 2026-11-06 |
| Wake vocabulary | `rung` input · `WakeMode` and the `WakeSetting` union on `mode` | the union on `mode`; `set_wake` takes it (scheduled-wake) | owner delegated 2026-11-06 |
| Owner notice on failure | the existing inbox notice · its own notice | its own `wakeFailed` notice in `wake-copy.ts`, `pt_BR` and `en_US` | owner delegated 2026-11-06 |
| Own host for the origin guard | a config constant · `PUBLIC_ORIGIN` | `PUBLIC_ORIGIN` only; the bare hostname derived from it (cross-slice decisions) | owner delegated 2026-11-06 |
| Fallback notice path | `NoneWaker` sends it · `deliverToOwner` sends it | `deliverToOwner`, the normal outbound path; `NoneWaker` has no outbound port (plan A5) | owner delegated 2026-11-06 |
| Notice repetition | one per failed job · one per `active` to `failing` episode | one per episode, cleared by the next delivery (plan A6) | owner delegated 2026-11-06 |
| Wake ports placement | extend `CoreDependencies` and `InboxRepository` · a separate wake context | `WakeContext` with `WakeDependencies` and its own `WakeRepository`; core signatures unchanged (plan A3) | owner delegated 2026-11-06 |
| Retry-After form | HTTP date and seconds · seconds only | integer seconds only, honoured on `429` and `503` (plan A8) | owner delegated 2026-11-06 |
| Scripted provider for E2E | no test hook · a dev mode | `WAKE_TRANSPORT_MODE=scripted` selects the core double and enables dev-only RPCs; absent or `fetch` is production (plan A10) | owner delegated 2026-11-06 |
| Re-setting a wake after a failure | keep `failing` · reset to `active` | a successful `set_wake` resets to `active` (plan A7) | owner delegated 2026-11-06 |

## Test strategy summary

- **`libs/core` unit (Vitest, `ManualClock`, `ScriptedWakeTransport`, in-memory ports):**
  - coalescing: five messages in 2 s give one job due at the first message plus 3 s; a message in flight gives exactly one follow-up;
  - drop at fire time when no unread messages or a live waiter exists;
  - backoff sequence 5, 10, 20, 40 s; `Retry-After` honoured and capped; attempt five gives up;
  - outcome table: every status class and timeout;
  - `Refused` and `3xx` never retry; fallback runs once per failure;
  - leasing: an alarm inside the lease sends nothing;
  - `assertWakeTarget`: https only, userinfo, ports, fragments, length, every pinned path pattern, IP literals of both families, `localhost`, `.local`, `.internal`, `.lan`, `.arpa`, own host;
  - `signWakeRequest` canonical string and timestamp tolerance;
  - `WAKE_SIGNAL_BODY` is the only body ever sent (asserted on the transport record);
  - `setWake` clears on `none`, rejects unavailable modes with "wake mode not available yet".
- **`apps/api` integration (`@cloudflare/vitest-pool-workers`, real workerd, D1, R2, Durable Objects):**
  - `set_wake` over MCP HTTP: valid grok, claude and generic configurations, each invalid field, `none` clearing;
  - alarms driven by a fake clock: `apps/api/test/support/test-account-inbox.ts` extends `AccountInbox` with a `ManualClock` through the same constructor seam the production class uses, so the test advances time with `runInDurableObject` and fires the alarm with `runDurableObjectAlarm` from `cloudflare:test`. Production code has no test hooks;
  - fake webhook target: `ScriptedWakeTransport` bound through the adapter seam. It asserts the Grok bearer header, the Claude beta and version headers, the generic HMAC against an independent computation, and that the body is `WAKE_SIGNAL_BODY`;
  - full path: owner message, one request, retry after 5 s on the fake clock, `delivered`, read clears the job;
  - burst of ten messages gives one request; the drop rules; give-up after five attempts gives one owner notice and the `failing` status; recovery to `active` on the next delivery;
  - sealed target: round trip, a tampered byte fails, moving the value to another agent fails (AAD), a wrong key version refuses;
  - no secret in logs or metrics: the console and the Analytics Engine spy are checked for the token, the URL path and the owner text;
  - the alarm handler never throws when the transport throws.
- **E2E:** `wrangler dev` with the scripted transport switched on by test configuration. Two accounts, one connection each, one owner message, one wake, one `check_inbox`, one reply, in the simulator. The live smoke against the owner's own Grok routine and claude.ai scheduled task is an owner-run manual step in the test plan, with the measured times recorded in the PR (expected ~9 s and ~16 s to reply).
- **Docs:** `mint broken-links` green.

## Risks

- **Silent non-read.** A delivered wake the agent never acts on leaves the owner waiting with no notice. Mitigation: the `failing` status is not set; a future rule could notify when a delivered wake leaves messages unread after a grace period. Not built here.
- **Token in chat history.** The owner pastes the provider token into the agent chat so `set_wake` can store it. Mitigation: the owner can rotate it at the provider; the token is never echoed back.
- **Routine quota.** Each wake starts a provider run that may count against the owner's plan. Coalescing and the drop rule limit the count, not the cost per run.
- **Provider contracts.** The `/fire` endpoint is in beta and the Grok path is observed, not documented. A change breaks the wake and shows up as a refusal.
- **Generic targets.** A generic host can still be any public machine the owner names. ADR 0019 accepts this; no secret is sent to it. The guard runs at `set_wake` and again at delivery, and blocks `zapbip.com`, `*.workers.dev`, the own host and its subdomains.
- **Name-based guard.** The guard judges the host name, not the address it resolves to. A name such as `127.0.0.1.nip.io` or `localtest.me` that resolves to loopback is accepted (DNS-rebinding residual risk); Workers egress does not reach the account's private network, and ADR 0019 records it.
- **Alarm floor.** `ALARM_MIN_DELAY_MS` is 5 s in production, so a wake is sent 5 s after the owner message at the earliest, not 3 s.
- **Install-skills expectation.** `install-skills` expects `set_wake` to reject a bad token before the self-test. Only the format is checked here. Decision recorded above; the self-test still proves the outbound path.

## Later

- A wake is dropped when the agent has a live waiter. The check looks at any waiter of the agent, including one waiting for a different question; a waiter query scoped to messages from the owner would drop fewer wakes.
