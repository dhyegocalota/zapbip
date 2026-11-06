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

## Lane L2: core rules and use cases

### What changed

- `libs/core/src/wake/wake-setting.ts`: `assertWakeSetting` (interval 1..1440 whole minutes, standby checks, foreign fields refused).
- `libs/core/src/wake/{poller,wake-rung,set-wake,poll-inbox,evaluate-pollers,wake-copy}.ts`: bodies. `setWake` saves `scheduled` and `standby` through one `saveWithoutTarget`.
- `libs/core/src/inbox/inbox-copy.ts` (`fillCopyTokens`), `message.ts` (`ownerMessageIdOf`), `use-cases/check-inbox.ts` (`readInbox`: count first, no body query when 0), `use-cases/send-content.ts` (reply to a copy stores the owner message id), `use-cases/receive-owner-message.ts` and `use-cases/wake-agent.ts` (`messageId` reaches `notify` for plain deliveries only).
- Test doubles: in-memory `WakeRepository` poll methods (a scheduled `saveWake` seeds the poll state at the fake clock), `createInMemoryWakeRepository({ clock })`, in-memory `insertHandoff`, the recording waker keeps `messageId`.

### How to run

`pnpm --filter @zapbip/core test:unit` (462 passed). `pnpm verify` green at 9f53772.

### Red then green

| Test | Red text | Commit |
|------|----------|--------|
| `wake-setting.test.ts` (18 cases) | `assertWakeSetting is not implemented` | 43da3db red, 4c32cc4 green |
| `poller.test.ts`, `wake-rung.test.ts`, `wake-copy.test.ts`, `message.test.ts`, `inbox-copy.test.ts` (`fillCopyTokens`) | `<name> is not implemented` | 24923bd red, 9459cac green |
| `set-wake.test.ts`, `poll-inbox.test.ts`, `evaluate-pollers.test.ts` | `saveScheduled`, `saveStandby`, `pollInbox`, `evaluatePollers`, `nextPollerDeadline is not implemented` | 24923bd red, 9f53772 green |
| `check-inbox.test.ts` (empty reads no body), `receive-owner-message.test.ts` (id handed to the waker), `send-content.test.ts` | `expected "listUnread" to not be called at all`; notification without `messageId`; reply id not rewritten | 24923bd red, 9f53772 green |
| `constants.test.ts`, WakeMode values, `none` mode, `getMessages` records no poll | pin: green on arrival | 24923bd |

### Hypotheses to attack

1. An interval of 1 and 1440 is accepted; 0, 1441, 90.5, -60 and null are refused naming `interval_minutes`. Try the MCP schema's `number` with `NaN` and `Infinity`.
2. A revoked or unknown standby is refused with the same text (`not connected to this account`).
3. A poll through `pollInbox` clears `pollerStaleNotified`; `getMessages`, `ask` and `waitForReply` never record a poll (pins in `poll-inbox.test.ts`).
4. `messageId` reaches `notify` only when the owner message is not an answer and not a held-message assignment.
5. `setWake` for `scheduled` deletes a pending webhook job.

### Gaps

- The never-polled text is `Ainda não olhou a caixa.` (test plan and spec aligned).
- Interval 1 reads `a cada minuto` / `every minute` through the new `WakeCopyKey.CadenceMinute` (added to `libs/types/src/enums.ts`).
- Files outside the lane's list that were touched: `libs/core/src/inbox/use-cases/wake-agent.ts` (needed to carry `messageId`) and `libs/types/src/enums.ts` (the `CadenceMinute` member) and `libs/core/src/wake/testing/wake-fixtures.ts` (one line: the in-memory wake repository needs the fake clock).
