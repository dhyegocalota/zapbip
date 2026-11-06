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
2. `saveWake` of a webhook or none setting writes `owner_locale` as given, so a webhook save with a null locale clears the locale a poll recorded; the next scheduled save or poll restores it.
3. `insertHandoff` marks only the primary's unread row whose id is `copy.originMessageId`; a copy without `originMessageId` throws.
4. An object at v1 only, or v1 and v3 without v2, upgrades with its rows intact.

### Known gaps

- `account-inbox.test.ts` (`WI-120`, `WI-121`) and `webhook-wake-secrets.test.ts` (`migration v2`) use `3` as a synthetic "later" migration version; with the real `v3` they fail (`expected [ 4 ] to deeply equal [ 3, 4 ]`, `expected [] to deeply equal [ 3 ]`, `UNIQUE constraint failed: schema_versions.version`). Not L1 files: the lead must move their synthetic versions past `ACCOUNT_INBOX_MIGRATIONS` (for example derive them from the last registered version).
- accounts-and-keys describes its own DO schema `v6`; the lead renumbers `v3.sql` when merging it, since runner order is by version.

## Lane L3 (wakers and Durable Object)

### What changed

- `apps/api/src/adapters/wake/scheduled-agent-waker.ts`: the expected-delay note (`sendExpectedDelayNote`, shared) and the `scheduled` rung waker; a `StandbyFor` wake sends no note.
- `apps/api/src/adapters/wake/inbox-agent-waker.ts`: for a stored `scheduled` connection on the inbox rung (stale) it sends the note and returns `Unreached`, so core sends the inbox notice; every other connection returns `Unreached` with no note.
- `apps/api/src/adapters/wake/standby-agent-waker.ts`: without `messageId` or without a standby name it returns `Unreached`; otherwise it writes the copy (new id, `originMessageId` = the owner message id, unread) through `insertHandoff`, wakes the standby with `StandbyFor` only when its unread count was 0 before the copy, and returns the standby's outcome (`Woken` when the count was above 0). An unknown `messageId` throws `NotFound`.
- `apps/api/src/account-inbox/account-inbox.ts`: one `CoreDependencies` object whose `waker` is assigned to the dispatcher after the dispatcher exists (the wakers hold that object, so the standby waker notifies through the dispatcher); the four rungs are real wakers; `checkInbox` runs `pollInbox`; a poller due-time provider (`nextPollerDeadline`, `evaluatePollers`) is the last provider, so the expiry sweep runs before the stale notices. `setWake` already re-arms the alarm through `outcome()`.
- `createDispatchingAgentWaker` and `WakerByRung` were already widened in Step 0 and are unchanged.

### How to run

```bash
pnpm --filter @zapbip/api test:integration -- scheduled-wake-alarm standby-handoff standby-revocation
```

### Red today, green after

Red commit `5ca8f5a`: 20 of 20 cases failed, every one with `Error: saveScheduled is not implemented` or `Error: saveStandby is not implemented` (lane L0 stubs of `set_wake`, which L2 replaces). The implementation commit is `d02a7c8`. The `scheduled-wake-alarm` and `standby-handoff` cases go green once L2's use cases (`setWake`, `pollInbox`, `evaluatePollers`, `nextPollerDeadline`, `wakeRungFor`, `ownerMessageIdOf`, `receiveOwnerMessage` passing `messageId`, `send-content` resolving `ownerMessageIdOf`) are merged.

`standby-revocation.test.ts` is waiting on slice 3 (accounts-and-keys): it calls `recordRevocation({agent})` on the account object through a local one-method type, which exists only after `origin/feat/accounts-and-keys` is merged. Its command-driven cases (`revogar grok-bot`, `girar grok-bot`, the revoked secret answering `401`) need that slice's owner commands and the directory and are not written here.

### Hypotheses to attack

1. A scheduled connection whose poller stopped gets exactly one stale notice per episode; the next alarm sends none; a `check_inbox` ends the episode.
2. The owner's first message to a fresh scheduled agent gets the cadence note and no inbox notice; to a stale one it gets the note and then the inbox notice, in that order.
3. After a standby-mode primary receives a plain owner message, the primary's `check_inbox` is empty, its history shows `handed_to`, and the standby's `check_inbox` returns a copy with a new id and `origin_message_id`; `reply_to` with either id stores the owner message id.
4. The standby is woken once with the constant signal while its unread count stays above 0; the primary is never woken.
5. A standby that is itself in standby mode, or has no `agent_wake` row, receives no copy; the owner gets the inbox notice.
6. The alarm is armed at `lastPolledAt + 2 * interval` after `set_wake` and after the object is evicted.

### Known gaps

- "Alarm order" (expiry sweep before stale notices) is not asserted as behaviour: with the window closed the stale notice is queued and invisible, and with it open nothing expires. It rests on the provider order in `account-inbox.ts`.
- Not written because they are unit-level or belong to another lane: B3 to B6 waker unit cases (no spy-based test of the wakers in `apps/api` since the plan assigns L3 only the three integration files), "Every owner kind hands off with its content", and "Answer is not handed off".
- `standby-revocation.test.ts` does not drive the owner command path (needs slice 3).
