# Tester briefing: Webhook wake

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## Step 0 (contract)

### What changed

- `libs/types/src/enums.ts`: `WakeMode.Webhook`, `WakeRung.Webhook`, `WakeAttemptOutcome`, `WakeProvider`, `WakeStatus`, `SetWakeStatus`, `WakeLogEventName`, and `WakeCopyKey` (beside `InboxCopyKey`, not in `wake-copy.ts` as the plan first said).
- `libs/core/src/wake/*`: the contract of the plan, with stubs that throw `<name> is not implemented`. Real values: `constants.ts`, `PINNED_WAKE_PROVIDER_RULES`, `WAKE_COPY`. Imports reach slice 1 through `../inbox/...`.
- `libs/core/src/wake/testing/*`: factory stubs of the four doubles; `libs/core/package.json` gains `exports` with `.` and `./wake-testing`.
- `apps/api/src/contract/{env,mcp-schemas,wake-rpc}.ts`: `WAKE_SECRET_KEY`, `WAKE_METRICS`, `setWakeInputShape`, `setWakeOutputShape`, `WakeRpc`, `DevWakeRpc`.
- `apps/api/src/adapters/wake/*` and `adapters/sqlite/sqlite-wake-repository.ts`: factory stubs.
- `apps/api/wrangler.jsonc`: the `WAKE_METRICS` Analytics Engine dataset in the top-level block only. `apps/api/vitest.integration.config.mts`: `WAKE_SECRET_KEY` as 32 zero bytes computed at runtime. `apps/api/.dev.vars.example`: `WAKE_SECRET_KEY=`.
- READMEs of `libs/core` and `apps/api`: one clause each.

### Deliberately not in Step 0 (plan A31 to A33)

- `account-inbox.ts`, `dev-account-inbox.ts`, `contract/account-inbox-rpc.ts`, `routes/dev-owner.ts`, `mcp/tool-handlers.ts`, `test/e2e/global-setup.ts`: slice 1 files. L2, L3 and L5 add the wake parts.
- `McpToolName.SetWake` and its handler: L3 adds them together, because `TOOL_HANDLERS` is `satisfies Record<McpToolName, unknown>`.
- `recordRevocation`: slice 3 owns it; this slice ships `clearWake`.

### How to run

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm verify
```

### Red today, green after

Step 0 has no tests: it is signatures and stubs. The first red tests are the L1 commits of the plan.

### Hypotheses to attack

1. Hypothesis: every stub throws exactly `<name> is not implemented` and nothing else in the repository calls one yet. Break it by: grepping `libs/core/src/wake` and `apps/api/src/adapters` for stubs and for call sites in production code.
2. Hypothesis: the production bundle carries no wake test double. Break it by: `wrangler deploy --dry-run` and grep for `createScriptedWakeTransport` (nothing imports `@zapbip/core/wake-testing` in Step 0, so it should be absent).
3. Hypothesis: `@zapbip/core` still resolves for every existing import after the `exports` field. Break it by: `pnpm verify` (integration and e2e import it).

### Known gaps

- `wrangler.jsonc` `env.production` has no `WAKE_METRICS`; `deploy-readiness` repeats it per environment (cross-slice table).
- Finding for the spec: `armAlarm` floors every alarm at 5 s from the real time (`ALARM_MIN_DELAY_MS`), so a 3 s debounce wakes at 5 s at the earliest in production; tests call `runDurableObjectAlarm` directly.
- `spec.md` still names `ManualClock` and `test-account-inbox.ts`; plan A12 and the refresh log hold the real names.

## Lane L4 (docs)

### What changed

- `apps/docs/docs.json`: a `Guides` group with `guides/webhook-wake`, and `mcp-reference/set-wake` last in the MCP reference group.
- `apps/docs/guides/webhook-wake.mdx` and `apps/docs/mcp-reference/set-wake.mdx`, placeholders only.

### How to run

```bash
cd apps/docs && pnpm exec mint broken-links
```

### Red then green

- `d75873f` (red): `found 2 broken links in 1 files`, `/guides/webhook-wake` and `/mcp-reference/set-wake` in `docs.json`.
- `80d2123` (green): `success no broken links found`.

### Hypotheses for the tester

- Each page appears exactly once in the navigation.
- No `trig_` id of 6 or more characters and no `automations/webhook/` id of 8 or more characters appears in `apps/docs`.
- The verification snippet accepts a request signed within 300 s and rejects it after (needs a real signed request).

### Gaps

- The docs state the wake behaviour of the spec; if L1 to L3 change a constant or an error message, the pages need a matching edit.
- The `/fire` body risk (spec, A22) is not mentioned in the docs.

## Lane L1 (wake core)

### What changed

- `libs/core/src/wake/`: bodies of `assert-wake-target`, `sign-wake-request`, `wake-rung`, `wake-associated-data`, `set-wake`, `schedule-wake`, `run-due-wakes` and `wake-copy`; the four doubles of `testing/wake-doubles.ts`; `testing/wake-fixtures.ts` (new, shared setup of the core tests, not exported from the package).
- `assert-wake-target.ts` also exports `WakeTargetField` and `invalidWakeField` (used by `set-wake.ts`).
- The `WAKE_COPY` texts now name `set_wake` (the test plan asks the copy test to check it).

### How to run

```bash
pnpm -F @zapbip/core test:unit
```

### Red then green

- `ca02bb0` (red): `Tests 47 failed (47)`, `assertWakeTarget is not implemented` and `signWakeRequest is not implemented`. Green `3e24947`.
- `3cc023d` (red): `Tests 10 failed (10)`, `setWake is not implemented`. Green `34ddfd2`.
- A red commit for coalescing (`pin coalescing`): `Tests 6 failed (6)`, `scheduleWake is not implemented`. Green `f62bba4`.
- `fa52aaa` (red): `Tests 41 failed | 1 passed (42)`, `runDueWakes is not implemented` (38), `wakeFailedCopy is not implemented` (2), and `expected 'Não consegui acordar seu agente. Sua …' to contain 'set_wake'`. The one passing case, the `WAKE_COPY` table check, is a pin. Green `bd33255`.

### Decisions a later lane or the tester needs

- `WakeRepository.findNextDueAt` must return `min` over jobs of `max(dueAt, leaseUntil)`, so a leased job reports its lease end (the in-memory double does; L2's SQLite repository must match). `listDueJobs({now})` returns every job with `dueAt <= now`, leased or not; the core skips the leased ones.
- `clearWake` clears the target, sets `mode none` and `status active`, keeps `lastDeliveredAt` and deletes the job (the double does; L2 must match).
- `assertWakeTarget`'s `publicHost` is the bare hostname (`zapbip.example`), not an origin; the caller derives it from `PUBLIC_ORIGIN`. Errors are exactly `invalid url` and `invalid token`.
- A trailing-dot host is refused naming `url` for every host, pinned look-alikes included.
- The scripted transport throws when no response is queued, throws an error named `errorName` when scripted, and records the pinned providers' headers (generic: content type and timestamp only, no signature).
- `runDueWakes` treats a throwing transport as a retry. Any other error in a job is caught: the job gets `attempt + 1`, a backoff and `lastOutcome retry`, and is deleted when that reaches `WAKE_MAX_ATTEMPTS`.
- The owner notice goes through `deliverToOwner` with `agent: null` (as slice 1's not-listening notice does), once per `active` to `failing` episode; it is sent before the status flips, so a failed notice is retried with the job.
- The outcome table (status to outcome) exists in the scripted transport double and, separately, must exist in L2's `FetchWakeTransport`.

### Hypotheses for the tester

- Five owner messages in two seconds make one job due at the first plus 3 s; a steady stream never moves it.
- Backoff requests land at +3, +8, +18, +38, +78 s on 503, then one notice and `failing`.
- `Retry-After` is honoured on 429 and 503 only, capped at 60 s.
- A message during a lease yields one follow-up job at settle + 3 s, also after a refusal.
- No owner text reaches a request body or header; the body is always `WAKE_SIGNAL_BODY`.
- A missing owner locale writes no copy in any locale and keeps the job retrying.

### Gaps

- The `local`, `scheduled` and `standby` "wake mode not available yet" cases are not tested: `WakeMode` has only `None` and `Webhook`, so the tool layer (L3) owns that error.

## Lane L3 (MCP `set_wake`)

Status: green after the L2 merge (`90b73a5`): 11 of 11 pass.

**What changed.** `McpToolName.SetWake` and its `TOOL_DEFINITIONS` entry (`apps/api/src/contract/tool-definitions.ts`); the handler in `apps/api/src/mcp/set-wake.ts` and its line in `tool-handlers.ts`; `apps/api/test/integration/set-wake.test.ts`. The tool input shape widens `WakeMode` with `UnavailableWakeMode` (`local`, `scheduled`, `standby`) so the handler answers `wake mode not available yet` (plan A18) instead of the SDK's input validation error.

**Run.** `cd apps/api && pnpm exec vitest run --config vitest.integration.config.mts test/integration/set-wake.test.ts`.

| Test | Red today | Green after |
|---|---|---|
| `lists set_wake with the other registered tools` | pin (green on arrival) | same |
| saves Grok, Claude, generic; invalid url, short token, missing url; clear | red commit `aaed4db`: `set_wake is not implemented` (stub); error cases fail on `expected 'set_wake is not implemented' to contain 'url'` | `7eb923a` plus the L2 merge |
| `answers that the <mode> mode is not available yet` (3 cases) | `expected 'MCP error -32602: Input validation er…' to be 'wake mode not available yet'` | `7eb923a` (needs no RPC) |

**Hypotheses for the tester.**
- The result carries `status`, `wake_mode`, `effective_rung`, `provider` and never the url, token or generic host.
- Errors name `url` or `token` and never echo the value (the text comes from the core `InboxError`).
- `local`, `scheduled`, `standby` return exactly `wake mode not available yet` and call no RPC.
- A revoked secret gets the same unauthorised response as any tool (not re-tested here; slice 1 behaviour).

**Gaps.** The "`mode: none` after a webhook yields zero scripted requests" case belongs to the delivery tests of L2. The revoked-secret case of the test plan is not covered by `set-wake.test.ts`.
## Lane L2 (Durable Object and adapters)

### What changed

- `apps/api/src/adapters/wake/`: `aes-gcm-wake-secret-box.ts` (WebCrypto AES-256-GCM, `version || iv || ciphertext`, AAD from the caller), `fetch-wake-transport.ts` (pinned headers from `PINNED_WAKE_PROVIDER_RULES`, HMAC for `generic`, `redirect: "manual"`, `AbortSignal.timeout`, own status-to-outcome table), `wake-observer.ts` (one console JSON line per event; one Analytics Engine point per attempt event), `webhook-agent-waker.ts`, `dispatching-agent-waker.ts`.
- `apps/api/src/adapters/sqlite/sqlite-wake-repository.ts`: raw SQL over `agent_wake` (`UPDATE` of the wake columns only) and the new `wake_jobs` table. `createSqliteWakeRepository` now takes `{storage, clock}` (the Step 0 stub took `{storage}`): `updated_at` must be clock time.
- `apps/api/src/account-inbox/`: `migrations/v2.sql` (+ index line), `wake-dependencies.ts` (builds secret box, repository, observer; throws naming `WAKE_SECRET_KEY` or `WAKE_METRICS`), `constants.ts` (`OWNER_LOCALE_STORAGE_KEY`), `account-inbox.ts` (wake provider on the alarm, `createWakeTransport`, `setWake`, owner locale stored on `receiveOwnerMessage`, dispatching waker). `publicHost` is `new URL(PUBLIC_ORIGIN).hostname`; `setWake` calls `touchAgent` first.
- `apps/api/src/contract/account-inbox-rpc.ts`: `AccountInboxRpc extends WakeRpc`, `DevAccountInboxRpc extends DevWakeRpc`. `apps/api/src/dev/dev-account-inbox.ts`: scripted transport, `devScriptWake`, `devReadWakeRequests`, `devRunDueWakes`.
- Tests: `test/unit/{aes-gcm-wake-secret-box,fetch-wake-transport,wake-observer}.test.ts`, `test/integration/webhook-wake-{delivery,secrets,observability,revocation}.test.ts`, `test/support/wake-session.ts` (new helper file). `test/integration/account-inbox.test.ts` (slice 1) follows the registry: WI-118 compares against the registry, WI-120 uses synthetic versions 3 and 4.

### How to run

```bash
pnpm -F @zapbip/api test:unit
pnpm -F @zapbip/api test:integration
pnpm typecheck
```

### Red then green

- `17f985a` (red, adapters): `Tests 44 failed (44)`, `createAesGcmWakeSecretBox / createFetchWakeTransport / createCloudflareWakeObserver is not implemented`; the absent-dataset case printed `expected [Function] to throw error including 'WAKE_METRICS' but got 'createCloudflareWakeObserver is not i…'`. Green `0e9446a` (63 unit tests).
- `ba8483a` (red, Durable Object): `Tests 34 failed (34)`, `setWake is not implemented` (the stub in that commit), `createSqliteWakeRepository is not implemented`, and `createWakeDependencies is not implemented`. Green `f96f2d8` (184 integration tests in 16 files).
- Both red commits were corrected inside their green commits where the test was wrong: the timeout case aborted before the listener existed; the owner messages had no route until they were addressed `@alpha`.

### Decisions for the next lane and the tester

- `findNextDueAt` returns `min` over jobs of `max(dueAt, leaseUntil)`; `listDueJobs` returns every job with `dueAt <= now`, leased or not; `clearWake` clears the target, sets `none` and `active`, keeps `last_delivered_at`, deletes the job (all as the double does; pinned in `webhook-wake-revocation.test.ts`).
- The transport's table: 2xx delivered; 408, 425, 429 and 5xx except 501 retry; everything else, redirects included, refused; a thrown error, a timeout or an abort is a retry with no status. `Retry-After` is read on 429 and 503 only, integer seconds.
- `saveWake` throws when the `agent_wake` row is missing (no insert from this slice, A27).
- The owner locale read by the alarm is cast from storage so that a missing value reaches `runDueWakes` and fails inside the per-job catch (A21, as L1's test does); there is no default.
- The wake dependencies are the instance property `wake`; integration tests swap `secretBox`, `observer` and `transport` through it (`replaceWakeDependencies`).
- Owner messages route to a wake agent only when addressed (`@alpha text`), or when the agent wrote last; and a message wakes only when the agent has no unread (new batch). The tests respect both.

### Hypotheses for the tester

- The first request goes out when the clock has advanced 3 000 ms after the owner message and not at 2 000 ms.
- A job leased in the future is not attempted; after the lease it is.
- `sealed_target` shows neither the token nor the URL path; moved to another agent, opened under another key, or stored with `key_version` 2, it is refused and the owner gets exactly one notice.
- A missing `WAKE_SECRET_KEY` (absent or 31 bytes) or `WAKE_METRICS` stops the construction of the wake dependencies, naming the binding.
- The alarm never throws on a throwing transport, and the log lines carry no token, URL path, owner text or header value.
- Migration `v2` applies when `v3` is already applied, once.
- The production bundle contains no `createScriptedWakeTransport` (only `dev-account-inbox.ts` imports `@zapbip/core/wake-testing`).

### Gaps

- The status class `timeout` of the test plan is not produced: the `WakeLogEvent` and the attempt result carry no reason for a null status, so a timeout, a network error and an unopenable target all log as `network`. A fix needs a port change (a new Step 0 commit).
- Not tested at the Durable Object level: the in-flight follow-up (the scripted transport cannot hold a response; core pins it), the live `ask` waiter at the alarm (core pins it), and the object restart between lease and retry (the scripted transport lives in memory and restarts empty).
- `recordRevocation` is slice 3's (A31); only `clearWake` is tested, through the repository.
- The own-host case runs with the test `PUBLIC_ORIGIN` (`http://localhost:8787`), whose host is also a blocked name, so it cannot tell the derived host from the blocked list; a variable origin needs a binding override this lane does not have.

## Lane L5 (dev routes, E2E and bundle)

**What changed.** `apps/api/test/e2e/global-setup.ts` passes a `WAKE_SECRET_KEY` generated per run (`randomBytes`, never committed) to `wrangler dev --env development` and seeds five single-agent accounts (agent `grok`, phones `5511999990001` to `5511999990005`) exposed as `stack().wakeAccounts`. `apps/api/wrangler.jsonc` gains `WAKE_METRICS` in `env.development` (the Durable Object needs it; the environment block does not inherit the top-level binding). `apps/api/src/routes/dev-owner.ts` gains `POST /dev/owner/:phone/agents/:agent/wake/script` (204), `GET .../agents/:agent/wake/requests` (200, array) and `POST /dev/owner/:phone/wake/run` (204). An unknown or malformed phone, or an agent that is not a connection of that phone's account, answers `404` with the same body; a malformed script answers `400`. Merging slice 1 (`feat/agent-inbox-core`, local tip) needed three conflict resolutions and one fit: `hasLiveWaiter` now takes `questionId`, so `libs/core/src/wake/run-due-wakes.ts` passes `questionId: null` (the wake looks for a waiter that is not tied to a question; the tester should check that a live `ask` waiter on a question still suppresses nothing wrongly).

**Run.** `cd apps/api && pnpm exec vitest run --config vitest.integration.config.mts test/integration/dev-owner-wake.test.ts`; `pnpm exec vitest run --config vitest.e2e.config.mts test/e2e/webhook-wake.e2e.test.ts test/e2e/wake-bundle.e2e.test.ts`.

| Test | Red today | Green after |
|---|---|---|
| `dev-owner-wake.test.ts` WR-1, WR-2, WR-5 | red commit `a39a3b1`: `expected 404 to be 204`, `expected 404 to be 200`, `expected 404 to be 400` | `0972935` |
| WR-3, WR-4 | pin (an unmatched route also answers 404) | same |
| `wake-bundle.e2e.test.ts` WB-1 | pin (no wake surface in the production bundle) | same |
| `wake-bundle.e2e.test.ts` WB-2 | red by construction: `wake/script` and the other route markers exist nowhere in `src` at `a39a3b1`; the run itself happened after the routes existed | `0972935` |
| `webhook-wake.e2e.test.ts` WW-1 to WW-4 | pin: the first run printed `expected [] to have a length of 1` only because the owner text had no `@grok` mention and was not routed; with the mention all four pass on the existing implementation | `e939240` |

**Hypotheses for the tester.**
- The e2e gate runs with no environment variable and reports `WAKE_SECRET_KEY` only to the `wrangler dev` child; `git grep` finds no key literal.
- WW-1: account 0 gets exactly one request with body `WAKE_SIGNAL_BODY`; account 1, which has the same agent name and a wake set, gets none.
- WW-3: after a scripted `503` the second request needs the clock to move by `WAKE_BACKOFF_BASE_MS`; one run earlier sends nothing.
- WW-4: a `401` leaves exactly one `wakeFailed` notice in the default locale and one request.
- The production bundle (top-level `wrangler deploy --dry-run`) holds none of the dev RPC names, `ScriptedWakeTransport`, `wake/script`, `wake/requests` or the `/wake/run` route; the marker for the run route is the template literal tail `/wake/run` followed by a backtick, because the source path `libs/core/src/wake/run-due-wakes.ts` appears in the bundle as a comment.

**Gaps.**
- The test-plan case "`POST /dev/owner/<phone>/wake/run` on the production entry answers 404" is covered by the bundle test (the route is absent), not by a request against a production entry.
- `wake/script` has no body-size limit; it is a development route.
- The e2e walk for `ask` with a live waiter at the alarm is not written; core pins it.

## Fix batch

### What changed

- `libs/core/src/wake/run-due-wakes.ts`: the wake is settled (status `failing`, job finished) before the owner notice; a failing notice is observed as `wake.notice_failed` and never re-sends the wake; the gave-up path after repeated throws also sets `failing` and notifies; a wake cleared or replaced while its request is in flight is not settled; a retry clears `rewake`; the target guard runs again at delivery (`publicHost` is now part of `RunDueWakesInput`); `ownerLocale` may be `null` (no notice, status still `failing`); `Retry-After` is floored at the base backoff.
- `libs/core/src/wake/wake-due-at.ts` and `WakeRepository.findLastRequestedAt/saveLastRequestedAt`: at most one wake request per agent per `WAKE_MIN_INTERVAL_MS` (60 s, in `libs/core/src/wake/constants.ts` with the other wake constants); the value is kept in the object key-value storage, so there is no migration (v3 stays reserved for `scheduled-wake`).
- `AgentWaker.hasFailedWake`: a message that lands on unread messages wakes again when the agent's wake is `failing`.
- `assert-wake-target.ts` and `constants.ts`: blocks `zapbip.com`, `*.zapbip.com`, `*.workers.dev`, `localhost.localdomain`, the own host and its subdomains; `publicHost` accepts a host or an origin.
- `wake-copy.ts`: the notice names the agent (`{agent}`).
- `apps/api`: `wake-observer.ts` logs through `logEvent` with the account id and produces the `timeout` status class; the secret box imports its key lazily (a missing key fails only seal and open); `UnavailableWakeMode` and `setWakeToolInputShape` live in `contract/mcp-schemas.ts`; `account-inbox.ts` no longer casts the stored owner locale.
- Tests: migration versions in `account-inbox.test.ts` (WI-120, WI-121) and `webhook-wake-secrets.test.ts` derive from the registry maximum; pins for the attack specs in `libs/core/src/wake/wake-flood.test.ts`.

### Red then green

| Test | Red text | Green |
|---|---|---|
| a refused wake is sent exactly once when the notice cannot be delivered | more than one request | settle-first fix |
| a retry clears the rewake mark | `rewake` true | settle-first fix |
| names the agent in every locale | copy without the agent | copy fix |
| an agent whose wake failed is told again | 1 notification, expected 2 | `hasFailedWake` |
| a stored target is refused at delivery (4 hosts) | 1 request sent | delivery guard |
| a wake cleared while the request is in flight is neither rewritten nor announced | wake rewritten to `failing` | re-read before settling |
| an agent that never reads gets at most one request per minute | more than 11 requests | per-agent cap |
| unit: builds with a 31 byte key / without a key | threw at construction | lazy import |
| unit: `timeout` class, account id and event in the line | `network`; no `accountId` | observer rewrite |
| the own host given as an origin is refused; `localhost.localdomain`; short `Retry-After` | accepted; waited 1 s | host and delay fixes |

Pins (green on arrival): burst of 200 messages, 50 agents, no secret in observer events, five throws give up with status `failing`, pinned-host look-alikes stay generic, the constants literals.

### Hypotheses for the tester

- An agent that never reads receives at most 11 requests in 10 minutes of a message every 4 s.
- A 401 with a failing notice sends exactly one request.
- An object without `WAKE_SECRET_KEY` still serves `send_message`; `set_wake` with a webhook names the key.
- `127.0.0.1.nip.io` and `localtest.me` are accepted (name-based guard, ADR 0019).

### Mutation proofs (break the code, see red, restore)

| Mutation | Red tests |
|---|---|
| `findNextDueAt` ignores the lease end | `leaves a leased job alone until the lease passes` (it now also asserts the alarm waits for the lease end) |
| `wakeAssociatedData` drops the agent | `refuses the sealed target of another agent copied into this agent row` |
| the secret box validates the key at construction | the four `wake dependencies` cases: 31 byte key, no key, `set_wake` without a key, `send_message` from a keyless object |
| `runMigrations` skips gaps and does not sort | `WI-120`, `WI-121`, `migration v2 applies once when a later version is already applied` (it also broke the rest of the suite, so the proof is coarse) |

### Timeout class

The transport sets `timedOut` when the request fails with `TimeoutError` or `AbortError` (`isWakeTimeout`); the core does the same for a thrown scripted error. The observer maps `timedOut` to the `timeout` class and a missing status otherwise to `network`. The latency heuristic is gone.

### Gaps

- New integration tests in `webhook-wake-lifecycle.test.ts` (restart while leased, message during a delayed 200, live `wait_for_reply` waiter at the alarm) and `set-wake.test.ts` (revoked secret) were written after the code they cover, so they are pins.
- The any-waiter query is recorded under "Later" in the spec.
- The per-agent cap changes the follow-up delay from 3 s to the cap; `WAKE_FOLLOW_UP_MS` was not kept.

## Fix batch 2 (reviewer minors and retester findings)

### Red then green

| Change | Red | Green |
|---|---|---|
| `workers.dev` apex and `*.localdomain` refused | `80940b1`: `expected an InboxError, nothing was thrown` (2 rows) | `e344d14` |
| a missing `WAKE_METRICS` loses only the metrics | `d6e68b6`: `Error: WAKE_METRICS binding is missing` (1 unit, 2 integration) | `ed88557` |
| failed retry gap (`WAKE_FAILED_RETRY_MS`, 10 min), finite `Retry-After`, no second send after a throw after a 2xx, rewake kept by `recordFailure`, `wake.notice_skipped`, clear through `clearWake` | `fbed2ec`: `dueAt NaN`, 65 requests against a limit of 15, `length 2` against 1, `rewake false`, no `wake.notice_skipped` | `9f9be00` |
| `owner_locale_missing` is gone from the alarm; core reports the skipped notice | `550938a`: `expected [ Array(1) ] to deeply equal []` | `819fd18` |

### Pins (green on arrival)

- `fa1ebbf` (pin): the lifecycle integration cases and the stronger lease test.
- `581b516` (pin): the e2e wake notice names the agent.
- `21c2690`: the follow-up interval is asserted against the stored request time (the 1 ms race is gone).
- `fbed2ec`: five throws on an already failing wake send no second notice; the notice waits for the settled wake (both kill the retester's surviving mutants S1 and S2).
- `64573a6` (pin): recovery after a refusal, a replaced target in flight, a sealed target copied to another agent, own-host origin forms.

### Hypotheses for the tester

- A never-reading agent whose endpoint always answers 503, with a message every 4 s for 30 min, gets at most 15 requests and one notice.
- After a wake gave up, the next request is at least 10 min after the last one; a `2xx` returns the wake to `active` and the 60 s cap.
- A `Retry-After` of NaN or Infinity waits the base backoff.
- With the owner locale missing, a refused wake logs `wake.notice_skipped` once and a delivered wake logs nothing about the locale; `owner_locale_missing` is never logged.
- An object started without `WAKE_METRICS` logs `wake_metrics_missing` once, still serves `send_message` and still wakes.

### Gaps

- A throw after a `2xx` drops the job, so a message that arrived in flight waits for the next message to schedule a wake.
- The 60 s cap is per agent; ADR 0019 records the per-account-per-host cap as a later option.
