# Scheduled wake and standby Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record every `check_inbox` poll, tell the owner the expected delay of a scheduled connection, notice once when its poller stops, hand an owner message to a standby connection when the primary cannot be woken, and make `check_inbox` an indexed unread count that returns no bodies when empty.

**Architecture:** The rules are pure functions in `libs/core/src/wake` (webhook-wake's folder) behind `WakeRepository`. `wakeRungFor` computes the effective rung; routing and `set_wake` both use it. Each rung has its own waker in `apps/api/src/adapters/wake`, and the dispatcher picks one by effective rung. The standby copy is written by the standby-rung waker after routing has chosen the target, so routing is unchanged.

**Tech Stack:** Node 24, TypeScript, Vitest (`libs/core` and `libs/types` 5.0.5, `apps/api` 4.1.12), `@cloudflare/vitest-pool-workers` 0.23.0, Drizzle `durable-sqlite`, `drizzle-kit` 0.31.11, zod 4.6.7, Mintlify `mint` 4.2.1207. No new dependency.

**Spec:** `docs/features/scheduled-wake/spec.md` (edited to match this plan). Its "Open questions → answers" table binds it.

**Reconciliation:** `StoredWake` is webhook-wake's record. Its `target` carries `provider`, `host`, `sealedTarget` and `keyVersion`, and its `status` is `WakeStatus`. This slice appends its fields to that record. No `AgentWake` type exists.

**Depends on:** `agent-inbox-core` (slice 1: `libs/types`, `libs/core/src/inbox/**`, `AccountInbox`, the dev clock route), `webhook-wake` (slice 4: `libs/core/src/wake/**`, `WakeRepository`, `WakeSettingInput`, `SetWakeResult`, `set_wake`, `WakerByRung`, schema `v2`), and `accounts-and-keys` (slice 3: the revoke flow that calls `recordRevocation`). Build order per `cross-slice-decisions.md`: after webhook-wake and accounts-and-keys.

## Global Constraints

- Every decision row of the spec's "Open questions → answers" table dated `owner delegated 2026-11-06` is binding.
- Shared constants come from `libs/types`: `MINUTE_MS`, `HOUR_MS`, `DAY_MS`. No local copy.
- Interval bounds: `SCHEDULED_MIN_INTERVAL_MINUTES` = `HOUR_MS / MINUTE_MS`, `SCHEDULED_MAX_INTERVAL_MINUTES` = `DAY_MS / MINUTE_MS`. Stale multiple: `STALE_POLL_INTERVAL_MULTIPLE` = 2. Safety-net cron: `SAFETY_NET_CRON` = `0 * * * *`.
- Repo rules (`AGENTS.md`): no comments except `// NB ADR NNNN:` pointers; flat `if`s; no `else`; no `??` defaults; enums over string literals; named parameters for any function with more than one parameter; no `.js` extension; no acronym in an identifier.
- Owner locale is never defaulted in code: it is the connection identity's `ownerLocale` (slice 1), which comes from the account property set by accounts-and-keys.
- Stub bodies in Step 0 are exactly `void input;` followed by `throw new Error('<name> is not implemented');`.
- Red commit first (failing test and its stub only), green commit second (implementation only). Record the printed failure text in `tester-briefing.md`.
- No `sleep`. Time comes from the fake `Clock` (core) or `runDurableObjectAlarm` and the development clock route (Worker).
- Commits: Conventional Commits, en-US, `Co-Authored-By` trailer. Never `git add -A`, `git add .`, or skip hooks. Never commit on `main`.
- Lanes merge into the feature branch; they never rebase.

## Review Focus

1. A scheduled connection whose poller stopped: exactly one stale notice per episode, the next alarm sends none, and the owner's next message gets the expected-delay note and then the inbox notice. Owned by S2.1 (`poller.test.ts`, `evaluate-pollers.test.ts`) and S3.1 (`scheduled-wake-alarm.test.ts`).
2. A standby-mode connection whose standby is missing, revoked, or in standby mode: no copy, the message stays unread with the primary, and the owner gets the inbox notice. Owned by S2.1 (`wake-rung.test.ts`) and S3.1 (`standby-handoff.test.ts`).
3. The standby copy has its own message id and `origin_message_id`; every `inbox_messages` id is unique; `reply_to` with either the copy's id or the origin id resolves to the owner message. Owned by S1.1 (`scheduled-wake-storage.test.ts`) and S3.1 (`standby-handoff.test.ts`).
4. The standby's wake is the constant wake signal with no body and no pointer; the standby reads its copy through `check_inbox`. Owned by S3.1 (`standby-handoff.test.ts`).
5. Revoking the standby through accounts-and-keys stops the handoff at read time and refuses a new standby at write time. Owned by S3.1 (`standby-revocation.test.ts`) and S2.1 (`wake-setting.test.ts`).

## Assumptions (decided, owner can override)

- **A1 Enums.** `WakeMode`, `WakeRung` and `AgentWakeReason` live in `libs/types/src/enums.ts`. Slice 1 declares `WakeMode.None`, `WakeRung.Inbox`, `AgentWakeReason.MessageWaiting`; slice 4 declares `Webhook` (and `Local`, `Scheduled`, `Standby` if its Step 0 landed them). This slice adds only what is missing: `WakeMode.Scheduled`, `WakeMode.Standby`, `WakeRung.Scheduled`, `WakeRung.Standby`, `AgentWakeReason.StandbyFor`. Step S0.1 checks each value first. (contract: confirm at build)
- **A2 Copy keeps its own id.** The standby copy gets a new message id (`ids.next({prefix: IdPrefix.Message})`) and `originMessageId` = the owner message's canonical id. The primary's row keeps the owner message id. `inbox_messages.id` stays the primary key, so no table rebuild is needed. This replaces the earlier composite-key design (cross-slice decision, item 4).
- **A3 Canonical owner id.** `ownerMessageIdOf(message) = message.originMessageId ?? message.messageId`. `reply_to` resolution uses it, so a copy id and the origin id resolve to the same owner message. Owner delegated 2026-11-06.
- **A4 Poll record.** `agent_wake` (slice 1) already has `last_polled_at`, set at creation. This slice adds `has_polled`, so "ainda não olhou a caixa" is told apart from "há N min". Owner delegated 2026-11-06.
- **A5 Standby existence.** "A connection of the same account" means a `agent_wake` row exists in this account's Durable Object (written at creation by slice 1). Owner delegated 2026-11-06.
- **A6 Revocation.** accounts-and-keys calls the account object's `recordRevocation` RPC when a connection is revoked (cross-slice decision). Rotation keeps the row and does not call it. The DO stores `revoked_at` on the wake row. Owner delegated 2026-11-06.
- **A7 Locale.** Every owner-facing wake notice uses the connection identity's `ownerLocale` (slice 1, from the account property). The scheduled wake row stores it (`owner_locale`) on `set_wake` and on each `check_inbox`, so the alarm's stale notice has a locale without a window field. A scheduled row without a locale throws in the mapper. Owner delegated 2026-11-06.
- **A8 Wake call carries the message id.** `AgentWaker.notify` gains an optional `messageId`, set only for a plain delivery, and a `firstUnread` flag (A9) (not an answer to a question, and not a Choice). Only the standby waker reads it. An answer to a standby-mode primary's question is never handed off (spec, A10 of this plan). Owner delegated 2026-11-06.
- **A9 Notes are waker work.** The expected-delay note is sent by the waker of the rung: `ScheduledAgentWaker` for `scheduled`, `InboxAgentWaker` for a stale `scheduled` connection (note, then `Unreached`, so core sends the inbox notice). The 0 → 1 test is read before the insert: core reads `countUnread` before storing the owner message and passes `firstUnread` (true when it was 0) to `notify`. Owner delegated 2026-11-06.
- **A10 Live waiter wins.** When the agent has a live waiter, core resolves the waiter and calls no waker: no note, no handoff. Owner delegated 2026-11-06.
- **A11 Standby wake.** The copy is always written when the standby is valid. The standby is woken only when its unread count was 0 before the copy. Owner delegated 2026-11-06.
- **A12 Standby choice.** The core checks validity (same account, exists, not standby mode, not revoked). The install (install-skills) picks the standby: newest active connection whose `clientName` is Grok Bot, or whose wake mode is webhook or local; null if none (cross-slice decision). Core does not choose.
- **A13 Alarm.** The Durable Object alarm runs the expiry sweep, then `evaluatePollers`, and re-arms to the earliest of their deadlines and slice 4's wake job deadline.
- **A14 Staleness boundary.** Stale when `now - lastPolledAt >= STALE_POLL_INTERVAL_MULTIPLE * intervalMinutes * MINUTE_MS`.

## Contract (Step 0, verbatim)

Step 0 lands these changes first, in one commit on the feature branch. Lanes build against them. `(contract: confirm at build)` marks an upstream name that S0.0 checks against `main`.

### `libs/types/src/enums.ts` (additions, after the check in S0.1)

```ts
export enum WakeMode {
  Scheduled = 'scheduled',
  Standby = 'standby',
}

export enum WakeRung {
  Scheduled = 'scheduled',
  Standby = 'standby',
}

export enum AgentWakeReason {
  StandbyFor = 'standby_for',
}
```

Each member is added only if slice 1 or slice 4 did not already declare it. The enums keep their existing members.

### `libs/types/src/constants.ts` (check only)

`SECOND_MS`, `MINUTE_MS`, `HOUR_MS`, `DAY_MS` exist from slice 1. This step imports them; it does not redeclare them.

### `libs/core/src/wake/constants.ts` (slice 4's file, additions)

```ts
import { DAY_MS, HOUR_MS, MINUTE_MS } from '@zapbip/types';

export const SCHEDULED_MIN_INTERVAL_MINUTES = HOUR_MS / MINUTE_MS;
export const SCHEDULED_MAX_INTERVAL_MINUTES = DAY_MS / MINUTE_MS;
export const STALE_POLL_INTERVAL_MULTIPLE = 2;
export const SAFETY_NET_CRON = '0 * * * *';
```

### `libs/core/src/inbox/message.ts` (slice 1's file, additions)

```ts
export type MessageEnvelope = {
  messageId: string;
  direction: MessageDirection;
  agent: AgentName | null;
  at: number;
  replyToMessageId: string | null;
  delivery: DeliveryState | null;
  readByAgent: boolean;
  handedTo: AgentName | null;
  originMessageId: string | null;
};

export function ownerMessageIdOf(input: { message: Message }): string;
```

### `libs/core/src/inbox/ports.ts` (slice 1's file, additions)

```ts
export interface InboxRepository {
  // existing slice 1 methods, unchanged, including countUnread
  insertHandoff(input: { copy: Message; primaryAgent: AgentName; handedTo: AgentName }): Promise<void>;
}

export interface AgentWaker {
  notify(input: {
    agent: AgentName;
    reason: AgentWakeReason;
    messageId?: string;
    firstUnread: boolean;
  }): Promise<WakeOutcome>;
}
```

`insertHandoff` writes the copy and marks the primary's row read with `handedTo`, in one transaction. `InboxRepository.saveWakeSetting` is not added (cross-slice decision, row 26).

### `libs/core/src/wake/wake-setting.ts` (slice 4's file, in place)

```ts
export type WakeSettingInput = {
  mode: WakeMode;
  url: string | null;
  token: string | null;
  intervalMinutes: number | null;
  standbyAgent: AgentName | null;
};

export type StoredWake = {
  agent: AgentName;
  mode: WakeMode;
  target: StoredWakeTarget | null;
  status: WakeStatus;
  lastDeliveredAt: number | null;
  intervalMinutes: number | null;
  standbyAgent: AgentName | null;
  lastPolledAt: number;
  hasPolled: boolean;
  pollerStaleNotified: boolean;
  revokedAt: number | null;
  ownerLocale: OwnerLocale | null;
};

export function assertWakeSetting(input: {
  setting: WakeSettingInput;
  caller: AgentName;
  standby: StoredWake | null;
}): void;
```

`WakeSettingInput` keeps slice 4's fields and adds two that are required by the mode. `assertWakeSetting` is new; it throws `InboxError` with `InvalidInput`, naming the field and the limit. Its write-time checks: interval integer in `[SCHEDULED_MIN_INTERVAL_MINUTES, SCHEDULED_MAX_INTERVAL_MINUTES]`; standby name present; standby is not the caller; standby exists (`standby !== null`); standby mode is not `standby`; standby `revokedAt` is null.

### `libs/core/src/wake/wake-ports.ts` (slice 4's file, WakeRepository additions)

```ts
export interface WakeRepository {
  // existing webhook-wake methods, unchanged
  recordPoll(input: { agent: AgentName; polledAt: number; ownerLocale: OwnerLocale }): Promise<void>;
  recordRevocation(input: { agent: AgentName; revokedAt: number }): Promise<void>;
  listScheduledWakes(): Promise<StoredWake[]>;
  markStaleNotified(input: { agent: AgentName }): Promise<void>;
}
```

`saveWake` (slice 4) saves the whole `StoredWake`, so `set_wake` saves the scheduled fields through it. `listScheduledWakes` returns scheduled, non-revoked connections only.

### `libs/core/src/wake/wake-rung.ts` (slice 4's file, widened in place)

```ts
export function wakeRungFor(input: {
  wake: StoredWake;
  standby: StoredWake | null;
  now: number;
}): WakeRung;
```

Replaces slice 4's `wakeRungFor({mode})`. Rules (the only place the rung is computed; the stored mode is never rewritten, ADR 0025):

| Stored mode | Condition | Rung |
|---|---|---|
| `local` | — | `Local` |
| `webhook` | — | `Webhook` |
| `scheduled` | not stale | `Scheduled` |
| `scheduled` | stale | `Inbox` |
| `standby` | standby valid (exists, not standby mode, not revoked) | `Standby` |
| `standby` | otherwise | `Inbox` |
| `none` | — | `Inbox` |

### `libs/core/src/wake/poller.ts`

```ts
export function isPollerStale(input: { wake: StoredWake; now: number }): boolean;
export function pollerDeadline(input: { wake: StoredWake }): number | null;
```

`pollerDeadline` is `null` when the mode is not `scheduled`, the row is revoked, or the stale notice is already sent.

### `libs/core/src/wake/poll-inbox.ts`

```ts
import type { ConnectionIdentity } from '../inbox/connection';
import type { CheckInboxResult } from '../inbox/use-cases/types';
import type { WakeContext } from './wake-ports';

export function pollInbox(input: WakeContext & { connection: ConnectionIdentity }): Promise<CheckInboxResult>;
```

Records the poll (`recordPoll`), then calls slice 1's `checkInbox`. The Durable Object's `checkInbox` RPC calls this, so slice 1's `checkInbox` stays unchanged. `get_messages`, `ask` and `wait_for_reply` do not call it.

### `libs/core/src/wake/set-wake.ts` (slice 4's file, in place)

`setWake` keeps slice 4's signature and result. Its input `setting` is the extended `WakeSettingInput`. It calls `assertWakeSetting` (with the standby record looked up through `findWake`), saves through `saveWake` with `ownerLocale` from `connection.ownerLocale`, and returns slice 4's `SetWakeResult` (`status`, `wakeMode`, `effectiveRung`, `provider` null for these modes). No second `setWake` is added.

### `libs/core/src/wake/evaluate-pollers.ts`

```ts
import type { CoreDependencies } from '../inbox/ports';

export type EvaluatePollersResult = { nextDueAt: number | null };

export function evaluatePollers(input: { dependencies: CoreDependencies; wake: WakeDependencies }): Promise<EvaluatePollersResult>;
```

For each stale scheduled wake not yet notified: `markStaleNotified`, then one stale notice through `deliverToOwner` with `agent: null`, in the wake's `ownerLocale`. Returns the earliest `pollerDeadline`.

### `libs/core/src/wake/wake-copy.ts`

```ts
import type { OwnerLocale } from '@zapbip/types';
import type { AgentName } from '../inbox/connection';

export type WakeCopy = {
  expectedDelayNote(input: { agent: AgentName; intervalMinutes: number; elapsedSinceLastPollMs: number | null }): string;
  staleNotice(input: { agent: AgentName; elapsedSinceLastPollMs: number }): string;
};

export const WAKE_COPY: Record<OwnerLocale, WakeCopy>;
```

`elapsedSinceLastPollMs` is `null` only when `hasPolled` is false. The caller decides; the copy never reads null as a value.


### `apps/api/src/adapters/wake/` (slice 4's folder; stubs in S0.1, bodies in L3)

```ts
export type WakerByRung = Record<WakeRung.Webhook | WakeRung.Scheduled | WakeRung.Standby | WakeRung.Inbox, AgentWaker>;

export class ScheduledAgentWaker implements AgentWaker {
  constructor(input: { dependencies: CoreDependencies; wake: WakeDependencies });
  notify(input: { agent: AgentName; reason: AgentWakeReason; messageId?: string; firstUnread: boolean }): Promise<WakeOutcome>;
}

export class InboxAgentWaker implements AgentWaker {
  constructor(input: { dependencies: CoreDependencies; wake: WakeDependencies });
  notify(input: { agent: AgentName; reason: AgentWakeReason; messageId?: string; firstUnread: boolean }): Promise<WakeOutcome>;
}

export class StandbyAgentWaker implements AgentWaker {
  constructor(input: { dependencies: CoreDependencies; wake: WakeDependencies });
  notify(input: { agent: AgentName; reason: AgentWakeReason; messageId?: string; firstUnread: boolean }): Promise<WakeOutcome>;
}
```

`DispatchingAgentWaker` (slice 4) takes `clock` as well, and computes the rung with `wakeRungFor`. `WebhookAgentWaker` (slice 4) is not changed: the standby's wake is its constant signal. `StandbyAgentWaker` reaches the standby's waker through `dependencies.waker`, which the Durable Object sets to the dispatcher after the dispatcher exists.

### `apps/api/src/contract/account-inbox-rpc.ts` (additions)

```ts
export interface AccountInboxRpc {
  // existing slice 1 and slice 4 methods; checkInbox now runs pollInbox; setWake takes the extended WakeSettingInput
  recordRevocation(input: { agent: AgentName; revokedAt: number }): Promise<CallOutcome<void>>;
}
```

### `apps/api/src/contract/mcp-schemas.ts` (slice 4's `setWakeInputShape`, in place)

`mode` gains `scheduled` and `standby`. `interval_minutes` (number, optional) and `standby_agent` (string, optional) are added. The set_wake handler parses with `z.object(setWakeInputShape).strict()`, so an unknown field is rejected; a raw shape alone would strip it.

### Dev clock

No contract change. Tests and the E2E suite advance time through slice 1's `POST /dev/owner/:phone/clock` with `advance_ms` (cross-slice decision, item 5). The owner simulator is not edited by this slice.

## Dependencies

No new package. The contract depends on slice 1 (`libs/types`, `libs/core/src/inbox/**`), slice 3 (`recordRevocation` call on revoke, `ownerLocale` on the identity) and slice 4 (`libs/core/src/wake/**`, `WakeRepository`, the dispatcher, `set_wake`). Each is `(contract: confirm at build)` until S0.0 checks it.

## File map (lanes)

Every path has one owner.

| Lane | Developer | Owned paths |
|---|---|---|
| L0 Contract (Step 0, serial) | `developer-0` | `libs/types/src/enums.ts` (check and add), `libs/core/src/wake/{constants,wake-setting,wake-ports,poll-inbox,poller,evaluate-pollers,wake-copy}.ts` (signatures and stubs), `libs/core/src/wake/wake-rung.ts` and `set-wake.ts` (signatures widened), `libs/core/src/inbox/{message,ports}.ts`, `apps/api/src/contract/{account-inbox-rpc,mcp-schemas}.ts`, `apps/api/src/adapters/wake/{scheduled-agent-waker,inbox-agent-waker,standby-agent-waker}.ts` (stubs), and the slice 1 fixtures that need `handedTo` and `originMessageId` |
| L1 Storage | `developer-1` | `apps/api/src/account-inbox/wake-repository.ts` (the four new methods and the mapper), `apps/api/src/account-inbox/sqlite-inbox-repository.ts` (`insertHandoff` only), schema `v3` in `apps/api/src/account-inbox/schema.ts` and `apps/api/src/account-inbox/migrations/` (generated, new columns and the `handed_to` column), `apps/api/test/integration/scheduled-wake-storage.test.ts` |
| L2 Core | `developer-2` | bodies of `libs/core/src/wake/{wake-rung,wake-setting,set-wake,poll-inbox,poller,evaluate-pollers,wake-copy}.ts` and their `*.test.ts`; `libs/core/src/inbox/use-cases/receive-owner-message.ts` (passes `messageId` for plain deliveries only, nothing else); `libs/core/src/wake/testing` doubles (the in-memory `WakeRepository` methods) |
| L3 Wakers and Durable Object | `developer-3` | `apps/api/src/adapters/wake/{scheduled-agent-waker,inbox-agent-waker,standby-agent-waker,dispatching-agent-waker}.ts`; `apps/api/src/account-inbox/account-inbox.ts` (`checkInbox` via `pollInbox`, `setWake` re-arm, `recordRevocation`, alarm, `dependencies.waker` assignment); tests `apps/api/test/integration/{scheduled-wake-alarm,standby-handoff,standby-revocation}.test.ts` |
| L4 MCP | `developer-4` | `apps/api/src/mcp/set-wake.ts` (slice 4's handler, in place); `apps/api/test/integration/mcp-scheduled-wake.test.ts` |
| L5 E2E | `developer-5` | `apps/api/test/e2e/scheduled-wake.e2e.test.ts` (default gate) |
| L6 Docs | `developer-6` | `apps/docs/concepts/wake-ladder.mdx` only |

Ownership notes:

- `standby-revocation.test.ts` drives accounts-and-keys' revoke command. It needs accounts-and-keys merged and is the only L3 test that does.
- `libs/core/src/inbox/use-cases/receive-owner-message.ts` is slice 1's file. This slice's edit is one argument, `messageId`, and only for plain deliveries.

## Sequencing

1. **Step 0 (L0), serial,** after S0.0 has confirmed names against `main` and the merged slices.
2. **Parallel after Step 0:** L1, L2 and L6. L4 and L5 red-test against the stubs.
3. **Merge order:** L0 → L2 → L1 → L3 → L4 → L6 → L5.
   - L2 before L1: the rules are pure and tested in memory.
   - L3 after L1 and L2: alarm and handoff tests need the repository and the rules.
4. **Lead merges after each lane:** `pnpm typecheck` and `pnpm verify` green on the branch before the next merge.

## Steps

Every box is empty when authored.

### Step 0 (L0): plan refresh and contract

- [ ] **S0.0 Plan refresh against main.** On the branch cut from `main` after slices 1, 3 and 4 have merged, run `git grep` for every path and name this plan takes from them: `libs/types/src/enums.ts` (`WakeMode`, `WakeRung`, `AgentWakeReason`, `OwnerLocale`), `libs/types/src/constants.ts` (`MINUTE_MS`, `HOUR_MS`, `DAY_MS`), `libs/core/src/inbox/{connection,message,ports}.ts`, `libs/core/src/inbox/use-cases/types.ts` (`CallContext`, `CheckInboxResult`), `libs/core/src/wake/{wake-setting,wake-ports,wake-rung,set-wake}.ts`, `apps/api/src/adapters/wake/dispatching-agent-waker.ts`, `apps/api/src/account-inbox/wake-repository.ts`, `apps/api/src/mcp/set-wake.ts`, and accounts-and-keys' `recordRevocation` call. Correct this plan and the spec to what is on `main`, and commit as `docs(features): refresh the scheduled-wake plan against main`. A name that is not found stays `(contract: confirm at build)` and blocks S0.1 until resolved.
- [ ] **S0.1 Contract.** Check each enum value in **Contract** against `libs/types/src/enums.ts`; add only the missing ones. Write every other block exactly, with stub bodies. Add `handedTo` and `originMessageId` to slice 1's fixtures so `pnpm typecheck` passes. Run `pnpm typecheck` green. Commit as `feat(core): add the scheduled wake contract`.

Failure modes for Step 0 are in the table below. Step 0 has no backout: a broken contract is fixed forward in a new Step 0 commit.

### Step L1 (storage)

- [ ] **S1.1 red: storage.** Write `apps/api/test/integration/scheduled-wake-storage.test.ts` (the test plan's **C. Worker storage**) against a real Durable Object SQLite. Run `pnpm --filter @zapbip/api test:integration -- scheduled-wake-storage`. Expected failure: `<name> is not implemented`. Commit as `test(api): pin the scheduled-wake storage`.
- [ ] **S1.2 green: schema v3.** Add to `agent_wake`: `interval_minutes`, `standby_agent`, `poller_stale_notified`, `has_polled`, `owner_locale`, `revoked_at`. Add `inbox_messages.handed_to` and `inbox_messages.origin_message_id`. Create `CREATE INDEX inbox_messages_unread ON inbox_messages (agent) WHERE read_at IS NULL;`. Generate the migration with `drizzle-kit` (not hand-written). Implement the four `WakeRepository` methods, the mapper (throws when a stored mode's required column is null), and `insertHandoff` (one transaction). Commit as `feat(api): store wake settings and handoffs in schema v3`.

Failure modes: see table.

### Step L2 (core rules and use cases)

- [ ] **S2.1 red: rules and use cases.** Write the core tests of the test plan's **A** and **B** sections, and the `receive-owner-message.test.ts` cases that pass `messageId`. Add the in-memory `WakeRepository` methods as stubs. Run `pnpm --filter @zapbip/core test:unit`. Expected failure: each case fails with `<name> is not implemented`. Commit as `test(core): pin the scheduled wake and standby rules`.
- [ ] **S2.2 green: rules.** Implement `wakeRungFor` (table row by row), `assertWakeSetting`, `isPollerStale`, `pollerDeadline`, `WAKE_COPY`, `ownerMessageIdOf`. Commit as `feat(core): implement the scheduled wake rules`.
- [ ] **S2.3 green: use cases.** Implement `setWake` (in place: `assertWakeSetting`, `saveWake` with `ownerLocale` from the connection), `pollInbox`, `evaluatePollers`. Edit `receive-owner-message.ts`: read `countUnread` before the insert, then pass `messageId` (plain delivery only) and `firstUnread` (true when that count was 0) to the waker call. Commit as `feat(core): implement set_wake for scheduled and standby, polls and poller checks`.

Failure modes: see table.

### Step L3 (wakers and Durable Object)

- [ ] **S3.1 red: wakers, alarm, handoff.** Write `scheduled-wake-alarm.test.ts`, `standby-handoff.test.ts`, and `standby-revocation.test.ts` (this one needs accounts-and-keys merged). Expected failure: `not implemented`. Commit as `test(api): pin the scheduled and standby wakers, the alarm and the revoke flow`.
- [ ] **S3.2 green: wakers and Durable Object.** Implement `ScheduledAgentWaker`, `InboxAgentWaker` (the note, then `Unreached`), `StandbyAgentWaker` (copy with a new id and `origin_message_id`, `insertHandoff`, `dependencies.waker.notify` with `StandbyFor` (no pointer) when the standby's count was 0, returns the standby's outcome; `Woken` without a call when the count was above 0; throws when `messageId` is absent). Widen `WakerByRung` and `DispatchingAgentWaker` (uses `wakeRungFor`). In `account-inbox.ts`: `checkInbox` through `pollInbox`; `setWake` re-arms; `recordRevocation`; the alarm runs `sweepExpired`, then `evaluatePollers`, then re-arms; assign `dependencies.waker` to the dispatcher. Commit as `feat(api): add the scheduled and standby wakers and run the poller checks in the alarm`.

Failure modes: see table.

### Step L4 (MCP)

- [ ] **S4.1 red: tools over HTTP.** Write `mcp-scheduled-wake.test.ts` (the test plan's **E. MCP over HTTP**). Expected failure: the `scheduled` call alone hits `assertWakeSetting is not implemented` (the tool error text names it). The `webhook` and `none` cases pass on arrival and are labelled `pin`. Commit as `test(api): pin set_wake for scheduled and standby`.
- [ ] **S4.2 green: tool.** Extend `set_wake` in place: the extended zod shape, `.strict()`, mapping `interval_minutes` and `standby_agent` to the camelCase input. Commit as `feat(api): accept scheduled and standby in set_wake`.

Failure modes: see table.

### Step L5 (E2E)

- [ ] **S5.1 red: E2E walk.** Write `scheduled-wake.e2e.test.ts` (the test plan's **F**) against `wrangler dev src/index.dev.ts`, advancing time with `POST /dev/owner/:phone/clock`. Expected failure: the first walk step's `set_wake` returns the tool error `assertWakeSetting is not implemented`, not a 404 or a missing route. Commit as `test(api): walk the scheduled poller and the standby in the simulator`.
- [ ] **S5.2 green.** The walk passes once every lane has merged. Commit as `test(api): green the scheduled-wake walk`.

### Step L6 (docs)

- [ ] **S6.1 pin: docs gate.** Run `pnpm --filter @zapbip/docs exec mint broken-links` on the current pages; expected: exit 0. This is a pin, recorded in the tester briefing; no commit.
- [ ] **S6.2 green: page.** Complete `wake-ladder.mdx` (five rungs, the note in both forms, the stale notice, the standby handoff section, the one-hop rule). The page step carries the assertion: `mint broken-links` exits 0 with the section link present. Commit as `docs(api): explain the scheduled poller and the standby in the wake ladder`.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| S0.0 | A name in this plan differs from `main` | `git grep` finds no match | Correct this plan; the `(contract: confirm at build)` marks stay until fixed |
| S0.1 | New required fields `handedTo`, `originMessageId`, `ownerLocale` break slice 1 and slice 4 fixtures | `pnpm typecheck` lists them | Fix forward in a new Step 0 commit |
| S0.1 | An enum value is declared twice | `pnpm typecheck` reports duplicate members | Keep the first declaration |
| S1.2 | `has_polled` or `owner_locale` default hides a never-polled row | A test "never polled shows the never-polled text" prints a cadence instead | Set the columns explicitly on write; drop the default |
| S1.2 | Index not used by the count | `EXPLAIN QUERY PLAN` shows `SCAN inbox_messages` | Restore the literal `read_at IS NULL` in the count |
| S2.2 | `wakeRungFor` differs from the table on one row | The table test fails on that row | Fix the row; the table test is the record |
| S2.3 | `messageId` is passed for an answer or a Choice | `receive-owner-message.test.ts` asserts `messageId` undefined for an answer | Pass it only on the plain-delivery branch |
| S3.2 | Expected-delay note sent twice for one message | Waker test "note once for 0 → 1" fails | Read `firstUnread` once, in one waker |
| S3.2 | Stale notice repeated on the next alarm | Alarm test "no duplicate" fails | Persist `markStaleNotified` before the notice |
| S3.2 | The standby copy shares the owner message id | `standby-handoff` asserts a new id; the storage test fails the unique id check | Generate the id with `IdGenerator`; never reuse `messageId` |
| S3.2 | Primary and standby both woken | Waker spy receives the primary under the standby rung | Skip the primary's notify on the standby rung |
| S3.2 | `dependencies.waker` not set, so the standby is never notified | Handoff test: standby waker spy not called | Assign the dispatcher after construction in the Durable Object constructor |
| S3.2 | Alarm not re-armed after eviction | Restart test: alarm does nothing after restart | Re-arm in the constructor from stored deadlines |
| S3.2 | Standby wake carries a body or pointer | `standby-handoff` asserts the wake body equals the constant signal | Send the constant signal only |
| S3.2 | Revoked standby still gets copies | `standby-revocation` finds a copy | Check `revokedAt` in `wakeRungFor` and in the handoff |
| S4.2 | `set_wake` accepts an unknown field | MCP test "unknown field rejected" gets a success | Keep `.strict()` on the parsed object |
| S5.2 | Clock route not reached | E2E step "stale notice appears once" fails | Check the `:phone` path and `advance_ms` |
| S6.2 | Broken link | `mint broken-links` exits non-zero | Fix the link or add the section |

**Steps with no backout:** S0.1 (fix forward); S1.2 after the first deploy (forward-only, per the storage rule).

## Z. Prove and ship

- [ ] **Tester briefing:** a developer from each lane wrote its section of `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` returned a verdict; refutation of the three riskiest claims is in `test-plan.md`.
- [ ] **Security reviewer:** the verdict line is in the PR body under `## Security`.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened. The PR is sensitive (schema, account isolation, webhook payload) and carries a Blast radius and a Human checklist.
