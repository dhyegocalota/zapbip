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
2. Hypothesis: the production bundle carries no wake test double. Break it by: `wrangler deploy --dry-run --env production` and grep for `createScriptedWakeTransport` (nothing imports `@zapbip/core/wake-testing` in Step 0, so it should be absent).
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
