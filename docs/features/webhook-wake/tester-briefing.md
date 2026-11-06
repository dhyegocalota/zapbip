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
