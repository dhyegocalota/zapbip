# Tester briefing: Agent inbox core

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## Step 0 (contract)

### What changed

- `libs/types`, `libs/core`, `apps/api`, `apps/docs`: manifests, tsconfigs, `pnpm-lock.yaml`; `tsx` 4.23.15 at the root.
- `libs/types/src`, `libs/core/src/inbox`, `apps/api/src`: every contract file of the plan, verbatim, with stubs that throw `<name> is not implemented`; `inbox-copy.ts` is complete except `renderCopy` and `buildNoticePreview`.
- Additions: `DueTimeProvider`, `McpToolName` and `TOOL_DEFINITIONS`, `generateConnectionSecret` and `logEvent` stubs, `InboxRepository.claimNotice()`, `armAlarm()` and `protected` sender and clock on `AccountInbox`.
- `apps/api/wrangler.jsonc`: as given, plus `vars` and `migrations` repeated in `env.production`.
- `tools/repository-shape/src/delivery-docs.test.ts`: the `apps` and `libs` roots and the four READMEs; `AGENTS.md` layout and Language lines.
- `docs/learnings/2026-11-06-mcp-sdk-subpath-keeps-the-js-suffix.md`.

### How to run

```bash
pnpm install
pnpm typecheck
pnpm verify all
```

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `tools/repository-shape/src/delivery-docs.test.ts::the %s package has a README` (four rows) and `the root holds only the entries the layout names` | red commit 2516967 printed six failures: the four READMEs and the `apps` and `libs` roots were missing | 33624f6 wrote the READMEs and the root entries |

### Hypotheses to attack

1. Hypothesis: `pnpm typecheck` covers `apps/api` production code and test code (two `tsc` runs). Break it by: importing a `cloudflare:test` name from `src/`.
2. Hypothesis: the `.js` suffix on `@modelcontextprotocol/sdk` subpaths is required by the bundler, not by `tsc`. Break it by: bundling a file that imports the suffix-less path with esbuild.
3. Hypothesis: no stub is reachable from `pnpm verify`. Break it by: running every `test:*` script of `apps/api` and expecting "No test files found".

### Known gaps

- `scripts/verify-gates.tsv` is unchanged; the `integration`, `e2e` and `docs` gates need `verify.sh`, which L1 owns (S1.1, S1.2).
- `wrangler deploy --dry-run --env production` was not run (its bundle test belongs to L4b).
- `@cloudflare/vitest-pool-workers` 0.23.0 is deprecated upstream in favour of `@cloudflare/vitest-plugin`; the pin follows the plan.

## Lane L3 (storage and platform)

### What changed

- `apps/api/src/signing.ts`, `src/log.ts`, `src/adapters/**`: HMAC link signing (`sig` is base64url, not hex as the contract prose says; opaque to callers), SHA-256 digest, secret generator, D1 directory, message index, owner directory, SQLite repository (raw bound SQL through `storage.sql`; Drizzle is not used), R2 media store (`signedLink` returns `exp=<ms>&sig=<sig>`), platform and durable clocks, ids, none waker, fake WhatsApp sender.
- `apps/api/src/account-inbox/**`: `AccountInbox` (migrations in the constructor, RPC wrapper that maps `InboxError` to `{ok: false, errorCode, message}`, one alarm over `DueTimeProvider`s), the set-based runner `run-migrations.ts`, `migrations/v1.sql`.
- `apps/api/migrations/0001_core.sql`, `apps/api/scripts/{dev-seed,build-directory-seed}.ts`, `apps/api/test/support/**`.
- Deviation: the fake sender exposes `listScreenEntries()` (contract said `readScreen`), so the production bundle, which holds the fake sender in slice 1, contains neither `readScreen` nor `advanceClock`. L4b's `DevAccountInbox.readScreen()` is `return this.sender.listScreenEntries()` and `advanceClock(input)` is `return this.clock.advance(input)`; `sender` and `clock` are typed `FakeWhatsAppSender` and `DurableClock`.
- Needed from files L3 does not own: `.gitleaks.toml` allowlist entry for the historical fixture string (done on the orchestrator's instruction).

### How to run

```bash
pnpm --filter @zapbip/api test:unit
pnpm --filter @zapbip/api test:integration
pnpm --filter @zapbip/api typecheck
pnpm --silent --filter @zapbip/api dev:seed --phone 5511999990000 --agents alpha,beta --json --persist-to <dir>
```

Seed needs `wrangler d1 migrations apply CONNECTIONS --local --persist-to <dir>` first. Without `--silent`, pnpm prints a banner line before the JSON.

### Red today, green after

| Test | Red text | Green |
|------|----------|-------|
| `test/unit/signing.test.ts`, `connection-secret.test.ts` (14 cases) | `signLink is not implemented`, `generateConnectionSecret is not implemented` | 90d4ff3 |
| `no-interpolated-sql.test.ts` | pin, green on landing | |
| `d1-directory`, `d1-message-index`, `sqlite-repository` (33 cases) | `D1ConnectionDirectory.resolveSecretDigest is not implemented`, `runMigrations is not implemented` (WI-4 and WI-6 are pins) | fefbc48 |
| `account-inbox.test.ts` (18 cases) | `sendText is not implemented`, `alarm is not implemented`, `no such table: schema_versions` | 88764a9 plus the L2 merge |
| `dev-seed.test.ts` (6 cases) | `findOwnerStatement is not implemented` | 1f18200 |

Counts at the last run: unit 18 passed, integration 59 passed.

### Hypotheses to attack

1. Hypothesis: a queued message, an upload, owner media, a question or a receipt each arm the alarm at its own deadline. Break it by: advancing the clock past one deadline and running the alarm.
2. Hypothesis: a provider that throws leaves the alarm armed. Break it by: a provider whose `nextDueAt` is in the past and whose `runDue` always throws (the alarm re-arms no sooner than 5 s ahead, `ALARM_MIN_DELAY_MS`).
3. Hypothesis: no log line carries text, captions, file names or secrets. Break it by: sending every kind and grepping the console.
4. Hypothesis: an account only reads its own object. Break it by: two connections with different `accountId` against one object name.
5. Hypothesis: the seed refuses a repeated phone and writes nothing. Break it by: running it twice with different agents.

### Known gaps

- `markRead` stamps `read_at` with SQLite wall time (the repository port has no clock), not the development clock.
- `armAlarm` compares due times in clock time with a real-time alarm; after `advanceClock` the real alarm is later than the clock deadline. Tests use `runDurableObjectAlarm`.
- An `ask` that holds and is evicted before it returns does not re-arm the alarm until the next call; the queued prompt's expiry waits for the next write.
- `findLastAgentWrite` uses `at >= since`; `findRecentQuestion` uses `askedAfter < askedAt`.
- The fake sender reads the prompt text of a `choice` message from the `questions` row, so `ask` must insert the question before `session`.
- The history of `eb984a0` carries a fixture string that gitleaks flags; `.gitleaks.toml` allowlists it anchored.
