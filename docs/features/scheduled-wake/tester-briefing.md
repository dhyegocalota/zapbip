# Tester briefing: Scheduled wake and standby

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## Step 0 (contract)

### What changed

- `libs/types/src/enums.ts`: `WakeMode.Scheduled` and `Standby`, `WakeRung.Scheduled` and `Standby`, `AgentWakeReason.StandbyFor`, and the `WakeCopyKey` members for the expected-delay note, the stale notice, the cadence phrases and the elapsed phrases.
- `libs/core/src/wake/constants.ts`: `SCHEDULED_MIN_INTERVAL_MINUTES`, `SCHEDULED_MAX_INTERVAL_MINUTES`, `STALE_POLL_INTERVAL_MULTIPLE`, `SAFETY_NET_CRON` (real values; time bounds come from `HOUR_MS`, `DAY_MS`, `MINUTE_MS`).
- `libs/core/src/wake/wake-setting.ts`: `WakeSettingInput` gains `intervalMinutes` and `standbyAgent`; `StoredWake` gains `intervalMinutes`, `standbyAgent`, `ownerLocale`; new `PollState` and `ScheduledWake`; `assertWakeSetting` stub.
- `libs/core/src/wake/wake-ports.ts`: `WakeRepository` gains `findPollState`, `recordPoll`, `listScheduledWakes`, `markStaleNotified`.
- `libs/core/src/wake/wake-rung.ts`: `wakeRungFor({wake, pollState, standby, now})`. The `none` and `webhook` rows keep slice 4's behaviour; the `scheduled` and `standby` rows throw `wakeRungFor is not implemented`.
- `libs/core/src/wake/set-wake.ts`: `WAKE_SETTERS` gains `saveScheduled` and `saveStandby` stubs; the webhook and none paths now store `intervalMinutes: null`, `standbyAgent: null` and the connection's `ownerLocale`, and ask `wakeRungFor` with the new signature.
- `libs/core/src/wake/{poller,poll-inbox,evaluate-pollers}.ts`: stubs (`isPollerStale`, `pollerDeadline`, `pollInbox`, `evaluatePollers`, `nextPollerDeadline`), exported from the wake index.
- `libs/core/src/wake/wake-copy.ts`: real pt_BR and en_US strings for the new keys; `expectedDelayNoteCopy` and `staleNoticeCopy` stubs.
- `libs/core/src/inbox/message.ts`: `handedTo` and `originMessageId` on `MessageEnvelope`; `ownerMessageIdOf` stub. Every `Message` literal (core, fixtures, builders, the SQL mapper) sets both to `null`.
- `libs/core/src/inbox/ports.ts`: `InboxRepository.insertHandoff`, `AgentWaker.notify` gains optional `messageId`. Stubs: `insertHandoff` in the in-memory repository and in `sqlite-inbox-repository.ts`; four repository stubs in `wake/testing/wake-doubles.ts`.
- `apps/api/src/adapters/wake/`: `WakerByRung` widened; `createDispatchingAgentWaker` takes `clock`; `createScheduledAgentWaker`, `createInboxAgentWaker`, `createStandbyAgentWaker` stubs.
- `apps/api/src/contract/mcp-schemas.ts`: `setWakeInputShape` gains `interval_minutes` and `standby_agent` (both nullable, default `null`).

### How to run

```bash
pnpm typecheck
pnpm verify
```

### Red today, green after

Step 0 adds no test. Every stub is reached by a red test in the lane named in `plan.md`; the failure text each red run prints is recorded in the lane's section when it lands.

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `libs/core/src/wake/wake-rung.test.ts::table` (L2) | `wakeRungFor is not implemented` for the `scheduled` and `standby` rows | S2.2 |
| `apps/api/test/integration/mcp-scheduled-wake.test.ts::scheduled set_wake` (L4) | `saveScheduled is not implemented` | S2.3 and S4.2 |

### Hypotheses to attack

1. Hypothesis: Step 0 changes no behaviour. Break it by: running the slice 1 and slice 4 suites on this branch and on `feat/webhook-wake`; the counts must match (150 integration tests and 22 e2e tests passed with 6 skipped at `87041a7`).
2. Hypothesis: `setWake` for `webhook` and `none` returns the same result as before. Break it by: the existing `set-wake.test.ts`, which still passes unchanged apart from the two new fields in its `setting` literals.
3. Hypothesis: no `Message` literal is left without the two new fields. Break it by: `pnpm typecheck` after merging `origin/feat/accounts-and-keys` and `origin/feat/webhook-wake-l3`; both add `Message` or `WakeSettingInput` literals this branch has not seen.

### Known gaps

- Merging `origin/feat/webhook-wake-l3` breaks `typecheck` until `apps/api/src/mcp/set-wake.ts` passes `intervalMinutes` and `standbyAgent` to `setWake` and drops `Scheduled` and `Standby` from `UnavailableWakeMode` (plan R14). The merge commit carries that fix; S4.2 finishes it.
- Slice 4's L2 (Durable Object wiring, `sqlite-wake-repository.ts` body) is not pushed yet. `sqlite-wake-repository.ts` still throws as a whole on this branch, so L1 adds its methods when that lands.
- The `libs/core` and `apps/api` READMEs say "the webhook wake of a sleeping agent"; they are updated with the lane that makes scheduled and standby real (L2 and L3), not in Step 0.

## Lane L4 (MCP)

### What changed

- `apps/api/src/contract/mcp-schemas.ts`: `UnavailableWakeMode` (now only `Local`), `setWakeToolInputShape` and `setWakeToolInputSchema = z.strictObject(setWakeToolInputShape)` (R13), next to `setWakeInputShape`.
- `apps/api/src/mcp/set-wake.ts`: imports them from the contract; the handler is unchanged otherwise (it already maps `interval_minutes` and `standby_agent`).
- `apps/api/src/contract/tool-definitions.ts`: `ToolDefinition.inputShape` is `ZodRawShape | ZodType`; `set_wake` registers the strict schema; the description names `scheduled`, `interval_minutes` and `standby_agent`.
- `apps/api/src/mcp/server.ts` (not in L4's list, needed by the widened type): `(toolArguments: unknown)` annotation, since the union stops the SDK from inferring the callback argument.
- Test: `apps/api/test/integration/mcp-scheduled-wake.test.ts`.

### How to run

```bash
cd apps/api && pnpm test:integration mcp-scheduled-wake set-wake mcp-tools
```

### Red then green

Red commit 85144f6: 13 failed, 5 passed. First failures: scheduled/standby `set_wake` return no `structuredContent` (the call reaches `saveScheduled is not implemented` / `saveStandby is not implemented`); `{mode: "none", account_id: "x"}` has `isError` undefined (the SDK strips the key from a raw shape); validation cases print the stub text instead of the field name. Pins: set_wake none, set_wake webhook, interval as a string, check_inbox empty, check_inbox new.

After 055dbf5: 11 failed, 51 passed across `mcp-scheduled-wake`, `set-wake`, `mcp-tools`. Green now: unknown field, agent field. Still red, waiting on L2's `assertWakeSetting` and the `saveScheduled`/`saveStandby` bodies (S2.3): scheduled/standby saved results, both interval bounds, interval 0 and 1441, fractional interval, caller as standby, malformed standby name, standby of another account, standby in standby mode.

### Hypotheses to attack

1. `set_wake` rejects any key outside `mode, url, token, interval_minutes, standby_agent` with a tool error naming the key, and saves nothing.
2. Other tools still accept their inputs unchanged (only `set_wake` became a strict object).
3. A tool error for the other-account standby never contains the other account id.

### Gaps

- The `UnavailableWakeMode` and tool-shape move follows the webhook-wake fix batch's target layout; the `invalidInput` factory is not on this branch, so the handler still builds `InboxError` directly. The merge with that batch needs a look at `set-wake.ts`.
- `standby-revocation.test.ts` is L3 and not touched here.
