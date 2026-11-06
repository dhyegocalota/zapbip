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

## Lane L1 (storage)

### What changed

- `apps/api/src/account-inbox/migrations/v3.sql` (registered in `migrations/index.ts`): `agent_wake` gains `interval_minutes`, `standby_agent`, `owner_locale`, `has_polled`, `poller_stale_notified`; `inbox_messages` gains `handed_to`, `origin_message_id` and the partial index `inbox_messages_unread`.
- `sqlite-wake-repository.ts`: `findPollState`, `recordPoll`, `listScheduledWakes`, `markStaleNotified`; `saveWake` writes the three mode-owned columns and never a poll column; the mapper throws naming the column for a scheduled row without `interval_minutes` or `owner_locale` and a standby row without `standby_agent`. `recordPoll` and `markStaleNotified` throw when the agent has no row.
- `sqlite-inbox-repository.ts`: the two message columns are written and mapped; `insertHandoff` inserts the copy and marks the primary's unread owner message read with `handed_to` in one `transactionSync`.

### How to run

```bash
pnpm --filter @zapbip/api test:integration
```

### Red today, green after

Red commit `12637d8`: 16 of 21 cases of `scheduled-wake-storage.test.ts` failed (`no such column: has_polled`, `expected [] to deeply equal [ 3 ]`, `<name> is not implemented`). Green at `699c8b8`. Pins on arrival: unique message id, zero count, read rows ignored, atomic rollback of the handoff, and the three schema checks that already held.

### Hypotheses to attack

1. A webhook row that polls keeps its mode and target (`recordPoll` touches only the poll columns and `owner_locale`).
2. `saveWake` keeps a recorded `owner_locale` when the saved wake carries none (`COALESCE(?, owner_locale)`); a non-null locale overwrites it.
3. `insertHandoff` marks only the primary's unread row whose id is `copy.originMessageId`; a copy without `originMessageId` throws.
4. An object at v1 only, or v1 and v3 without v2, upgrades with its rows intact.

### Known gaps

- `account-inbox.test.ts` (`WI-120`, `WI-121`) and `webhook-wake-secrets.test.ts` (`migration v2`) use `3` as a synthetic "later" migration version; with the real `v3` they fail (`expected [ 4 ] to deeply equal [ 3, 4 ]`, `expected [] to deeply equal [ 3 ]`, `UNIQUE constraint failed: schema_versions.version`). Not L1 files: the lead must move their synthetic versions past `ACCOUNT_INBOX_MIGRATIONS` (for example derive them from the last registered version).
- accounts-and-keys describes its own DO schema `v6`; the lead renumbers `v3.sql` when merging it, since runner order is by version.
