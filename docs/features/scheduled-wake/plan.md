# Scheduled wake and standby Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record every `check_inbox` poll, tell the owner the expected delay of a scheduled connection, notice once when its poller stops, hand an owner message to a standby connection when the primary cannot be woken, and make `check_inbox` an indexed unread count that returns no bodies when empty.

**Architecture:** The rules are pure functions in `libs/core/src/wake` (webhook-wake's folder) behind `WakeRepository`. `wakeRungFor` computes the effective rung; routing and `set_wake` both use it. Each rung has its own waker in `apps/api/src/adapters/wake`, and the dispatcher picks one by effective rung. The standby copy is written by the standby-rung waker after routing has chosen the target, so routing is unchanged.

**Tech Stack:** Node 24, TypeScript, Vitest (`libs/core` and `libs/types` 5.0.5, `apps/api` 4.1.12), `@cloudflare/vitest-pool-workers` 0.23.0, ~~Drizzle `durable-sqlite`, `drizzle-kit` 0.31.11,~~ (R1: raw `storage.sql` and numbered `.sql` migrations) zod 4.6.7, Mintlify `mint` 4.2.1207. No new dependency.

**Spec:** `docs/features/scheduled-wake/spec.md` (edited to match this plan). Its "Open questions → answers" table binds it.

**Reconciliation:** `StoredWake` is webhook-wake's record. Its `target` carries `provider`, `host`, `sealedTarget` and `keyVersion`, and its `status` is `WakeStatus`. This slice appends its fields to that record. No `AgentWake` type exists.

**Depends on:** `agent-inbox-core` (slice 1: `libs/types`, `libs/core/src/inbox/**`, `AccountInbox`, the dev clock route), `webhook-wake` (slice 4: `libs/core/src/wake/**`, `WakeRepository`, `WakeSettingInput`, `SetWakeResult`, `set_wake`, `WakerByRung`, schema `v2`), and `accounts-and-keys` (slice 3: `AccountOwnerRpc.recordRevocation`, which deletes the agent's `agent_wake` row; R4). Build order per `cross-slice-decisions.md`: after webhook-wake and accounts-and-keys.

## Global Constraints

- Every decision row of the spec's "Open questions → answers" table dated `owner delegated 2026-11-06` is binding.
- Shared constants come from `libs/types`: `MINUTE_MS`, `HOUR_MS`, `DAY_MS`. No local copy.
- Interval bounds: `SCHEDULED_MIN_INTERVAL_MINUTES` = `MINUTE_MS / MINUTE_MS` (1; was `HOUR_MS / MINUTE_MS`, owner delegated 2026-11-06), `SCHEDULED_MAX_INTERVAL_MINUTES` = `DAY_MS / MINUTE_MS`. Stale multiple: `STALE_POLL_INTERVAL_MULTIPLE` = 2. Safety-net cron: `SAFETY_NET_CRON` = `0 * * * *`.
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

- ~~**A1 Enums.** `WakeMode`, `WakeRung` and `AgentWakeReason` live in `libs/types/src/enums.ts`. Slice 1 declares `WakeMode.None`, `WakeRung.Inbox`, `AgentWakeReason.MessageWaiting`; slice 4 declares `Webhook` (and `Local`, `Scheduled`, `Standby` if its Step 0 landed them). This slice adds only what is missing: `WakeMode.Scheduled`, `WakeMode.Standby`, `WakeRung.Scheduled`, `WakeRung.Standby`, `AgentWakeReason.StandbyFor`. Step S0.1 checks each value first. (contract: confirm at build)~~ (R3, R2) **A1 Enums.** `WakeMode` is `None`, `Webhook` and `WakeRung` is `Inbox`, `Webhook` on this branch; `AgentWakeReason.MessageWaiting` exists. This slice adds `WakeMode.Scheduled`, `WakeMode.Standby`, `WakeRung.Scheduled`, `WakeRung.Standby`, `AgentWakeReason.StandbyFor` and the `WakeCopyKey` members of the Contract. `Local` is slice 6's. Confirmed against the branch.
- **A2 Copy keeps its own id.** The standby copy gets a new message id (`ids.next({prefix: IdPrefix.Message})`) and `originMessageId` = the owner message's canonical id. The primary's row keeps the owner message id. `inbox_messages.id` stays the primary key, so no table rebuild is needed. This replaces the earlier composite-key design (cross-slice decision, item 4).
- ~~**A3 Canonical owner id.** `ownerMessageIdOf(message) = message.originMessageId ?? message.messageId`. `reply_to` resolution uses it, so a copy id and the origin id resolve to the same owner message. Owner delegated 2026-11-06.~~ **A3 Canonical owner id.** `ownerMessageIdOf({message})` returns `message.messageId` when `originMessageId === null` and `originMessageId` otherwise (an explicit branch, never `??`). `reply_to` resolution in `send-content.ts` uses it (R19), so a copy id and the origin id resolve to the same owner message. Owner delegated 2026-11-06.
- **A4 Poll record.** `agent_wake` (slice 1) already has `last_polled_at`, set at creation. This slice adds `has_polled`, so "ainda não olhou a caixa" is told apart from "há N min". Owner delegated 2026-11-06.
- ~~**A5 Standby existence.** "A connection of the same account" means a `agent_wake` row exists in this account's Durable Object (written at creation by slice 1). Owner delegated 2026-11-06.~~ (R4) **A5 Standby existence.** "A connection of the same account" means an `agent_wake` row exists in this account's Durable Object (written by `registerAgent` on the connection's first call). A revoked connection has no row (slice 3 deletes it), so revoked, unknown and never-connected standbys are one case. Owner delegated 2026-11-06.
- ~~**A6 Revocation.** accounts-and-keys calls the account object's `recordRevocation` RPC when a connection is revoked (cross-slice decision). Rotation keeps the row and does not call it. The DO stores `revoked_at` on the wake row. Owner delegated 2026-11-06.~~ (R4) **A6 Revocation.** accounts-and-keys already ships `AccountOwnerRpc.recordRevocation({agent})`: it deletes the agent's `agent_wake` row and writes `revoked_agents` (DO `v6`). This slice adds no revocation method and no column; it reads the absence of the row. Rotation keeps the row. Owner delegated 2026-11-06.
- ~~**A7 Locale.** Every owner-facing wake notice uses the connection identity's `ownerLocale` (slice 1, from the account property). The scheduled wake row stores it (`owner_locale`) on `set_wake` and on each `check_inbox`, so the alarm's stale notice has a locale without a window field. A scheduled row without a locale throws in the mapper. Owner delegated 2026-11-06.~~ (R7, R20) **A7 Locale.** Every owner-facing wake notice uses the connection identity's `ownerLocale`. The wake row stores it (`owner_locale`) on `set_wake` (`saveWake`) and on each `check_inbox` (`recordPoll`), so the alarm's stale notice has a locale on a never-polled connection. A scheduled row without a locale throws in the mapper. Owner delegated 2026-11-06.
- ~~**A8 Wake call carries the message id.** `AgentWaker.notify` gains an optional `messageId`, set only for a plain delivery, and a `firstUnread` flag (A9) (not an answer to a question, and not a Choice). Only the standby waker reads it. An answer to a standby-mode primary's question is never handed off (spec, A10 of this plan). Owner delegated 2026-11-06.~~ (R5, R6) **A8 Wake call carries the message id.** `AgentWaker.notify` gains an optional `messageId`, set only for a plain delivery (not an answer to a question, not a Choice, not a routing-list assignment). Only the standby waker reads it; without it the standby waker returns `Unreached` and makes no copy. Owner delegated 2026-11-06.
- ~~**A9 Notes are waker work.** The expected-delay note is sent by the waker of the rung: `ScheduledAgentWaker` for `scheduled`, `InboxAgentWaker` for a stale `scheduled` connection (note, then `Unreached`, so core sends the inbox notice). The 0 → 1 test is read before the insert: core reads `countUnread` before storing the owner message and passes `firstUnread` (true when it was 0) to `notify`. Owner delegated 2026-11-06.~~ (R5) **A9 Notes are waker work.** The expected-delay note is sent by the waker of the rung: `ScheduledAgentWaker` for `scheduled`, `InboxAgentWaker` for a stale `scheduled` connection (note, then `Unreached`, so core sends the inbox notice). `receiveOwnerMessage` already calls `notify` only when `unreadBefore === 0` and no waiter is live, so the 0 → 1 rule needs no extra flag. Owner delegated 2026-11-06.
- **A10 Live waiter wins.** When the agent has a live waiter, core resolves the waiter and calls no waker: no note, no handoff. Owner delegated 2026-11-06.
- **A11 Standby wake.** The copy is always written when the standby is valid. The standby is woken only when its unread count was 0 before the copy. Owner delegated 2026-11-06.
- ~~**A12 Standby choice.** The core checks validity (same account, exists, not standby mode, not revoked). The install (install-skills) picks the standby: newest active connection whose `clientName` is Grok Bot, or whose wake mode is webhook or local; null if none (cross-slice decision). Core does not choose.~~ (R4) **A12 Standby choice.** The core checks validity (same account, exists, not standby mode; a revoked connection has no row). The install (install-skills) picks the standby: newest active connection whose `clientName` is Grok Bot, or whose wake mode is webhook or local; null if none (cross-slice decision). Core does not choose.
- ~~**A13 Alarm.** The Durable Object alarm runs the expiry sweep, then `evaluatePollers`, and re-arms to the earliest of their deadlines and slice 4's wake job deadline.~~ **A13 Alarm.** This slice registers one due-time provider in the Durable Object (`dueTimeProviders`, slice 1): `nextDueAt` is `nextPollerDeadline`, `runDue` is `evaluatePollers`. The Durable Object re-arms the alarm after every write path (`outcome()`) to the earliest provider, as slice 1 and webhook-wake A23 already do; the 5 s `ALARM_MIN_DELAY_MS` floor applies. Tests call `runDurableObjectAlarm`.
- **A14 Staleness boundary.** Stale when `now - lastPolledAt >= STALE_POLL_INTERVAL_MULTIPLE * intervalMinutes * MINUTE_MS`.

## Refresh log (S0.0)

Checked on 2026-11-06 against this branch (slice 1 merged, slice 4 Step 0, L1 and docs), `origin/feat/webhook-wake-l3`, and `origin/feat/accounts-and-keys` (slice 3). `origin/feat/webhook-wake-l2` is not pushed yet: the Durable Object wake wiring is read from the webhook-wake plan (A21, A23, A27, A28, A30, A32) and confirmed again when L2 lands. Every `(contract: confirm at build)` mark is resolved below.

| # | Was | Now | Reason |
|---|-----|-----|--------|
| R1 | ~~`apps/api/src/account-inbox/wake-repository.ts`, `schema.ts`, Drizzle, `drizzle-kit` generates the migration~~ | `apps/api/src/adapters/sqlite/sqlite-wake-repository.ts` (`createSqliteWakeRepository`), `apps/api/src/adapters/sqlite/sqlite-inbox-repository.ts`, a hand-written `apps/api/src/account-inbox/migrations/v3.sql` registered in `migrations/index.ts` | The code has raw `storage.sql` and numbered `.sql` files, no Drizzle and no `schema.ts`; `no-interpolated-sql.test.ts` guards the statements |
| R2 | ~~`export class ScheduledAgentWaker implements AgentWaker`~~ (and the other two) | `createScheduledAgentWaker`, `createInboxAgentWaker`, `createStandbyAgentWaker`, factories with named input | Webhook-wake A30: adapters are `create…` factories |
| R3 | ~~`WakeMode.Local` and `WakeRung.Local` in the union and the rung table~~ | Not declared here. `WakeMode` is `None`, `Webhook` today and `WakeRung` is `Inbox`, `Webhook`; this slice adds `Scheduled` and `Standby` only | Slice 6 owns `Local` |
| R4 | ~~`recordRevocation` in `WakeRepository`, in `AccountInboxRpc`, `revokedAt` on `StoredWake`, an `agent_wake.revoked_at` column, a `recordRevocation` method in lane L3~~ | None of them. Slice 3 already ships `AccountOwnerRpc.recordRevocation({agent}): Promise<void>` (`apps/api/src/contract/account-owner-rpc.ts`): it deletes the agent's `agent_wake` row and writes `revoked_agents` (DO schema `v6`). A revoked connection is therefore a connection with no `agent_wake` row: `findWake` returns `null`, the standby does not exist, and `listScheduledWakes` cannot return it | One owner for revocation state; no second copy |
| R5 | ~~`firstUnread` on `AgentWaker.notify`, `receive-owner-message.ts` reads `countUnread` and passes the flag~~ | `notify` gains `messageId?: string` only | `receiveOwnerMessage` already reads `unreadBefore` before the insert and calls `notify` only when it is 0 and no waiter is live, so every `notify` is a 0 → 1 call |
| R6 | ~~StandbyAgentWaker throws when `messageId` is absent~~ | Returns `WakeOutcome.Unreached` and makes no copy | `messageId` is absent for answers to a question and for held messages assigned by a routing-list tap (`applyRouteTarget` has no single message); a throw inside `receiveOwnerMessage` would lose the owner message after it was stored. The owner gets the core's inbox notice |
| R7 | ~~`StoredWake` carries `lastPolledAt`, `hasPolled`, `pollerStaleNotified`, `revokedAt`, `ownerLocale`~~ | `StoredWake` gains `intervalMinutes`, `standbyAgent`, `ownerLocale`. The poll columns are a separate `PollState` read by `findPollState` and `listScheduledWakes`, written only by `recordPoll` and `markStaleNotified` | Webhook-wake A27: `saveWake` writes the mode-owned columns only and never `last_polled_at`; with the poll fields on `StoredWake`, `setWake` would have to invent them when no row exists, which is a default. `ownerLocale` is written by `saveWake` and by `recordPoll` (same value from the connection identity) |
| R8 | ~~`wakeRungFor({wake, standby, now})`~~ | `wakeRungFor({wake, pollState, standby, now})`; `pollState` is `null` only when the connection has no `agent_wake` row; a scheduled wake with `pollState === null` throws | The poll state is separate (R7) |
| R9 | ~~`pollInbox` records the poll and then calls slice 1's `checkInbox`~~ | `pollInbox` runs `touchAgent`, `recordPoll` (an `UPDATE`, so the row `touchAgent` creates must exist first), then the new `readInbox` that `check-inbox.ts` exposes: count through the index, return `Empty` without the body query when 0, else `takeUnread`. `checkInbox` becomes `touchAgent` plus `readInbox` | One read path; no second `touchAgent` write on the hot path. `libs/core/src/inbox/use-cases/check-inbox.ts` is owned by L2 |
| R10 | ~~`WakeCopy` object with two methods, `WAKE_COPY: Record<OwnerLocale, WakeCopy>`~~ | `WAKE_COPY` stays `Record<WakeCopyKey, Record<OwnerLocale, string>>`; `WakeCopyKey` gains the keys below; two functions `expectedDelayNoteCopy` and `staleNoticeCopy`; the `{token}` fill of `inbox-copy.ts` is exported as `fillCopyTokens` (L2, additive) and reused | Slice 4 already shaped `WAKE_COPY` and `wakeFailedCopy`; one fill routine |
| R11 | ~~`WAKE_SETTERS` unchanged~~ | `WAKE_SETTERS` gains `saveScheduled` and `saveStandby`; Step 0 stubs throw `saveScheduled is not implemented` and `saveStandby is not implemented`. Red failure texts of S4.1 and S5.1 use them | `Record<WakeMode, …>` makes the new members a compile error until they exist |
| R12 | ~~`assertWakeSetting` checks the interval and the standby only~~ | Also: fields of another mode must be `null` (`url` and `token` for `scheduled` and `standby`; `interval_minutes` for `standby`; `standby_agent` for `scheduled`) | A silently ignored field is a default in disguise |
| R13 | ~~`set_wake` rejects unknown fields by `.strict()` in the handler~~ | The tool definition of `set_wake` registers `z.strictObject(setWakeToolInputShape)`: SDK 1.32.2 (`normalizeObjectSchema`) accepts a Zod object and strips unknown keys from a raw shape before the handler runs. `ToolDefinition.inputShape` is widened for that one tool (L4) | The handler never sees a stripped key. S4.1's unknown-field case proves it |
| R14 | `UnavailableWakeMode` of slice 4's L3 (`origin/feat/webhook-wake-l3`, `apps/api/src/mcp/set-wake.ts`) lists `Local`, `Scheduled`, `Standby` and answers `wake mode not available yet` | When L3 merges, S4.2 removes `Scheduled` and `Standby` from it, passes `intervalMinutes` and `standbyAgent` to `setWake`, and edits the tool description in `tool-definitions.ts`. Until then the merge of slice 4's L3 breaks `typecheck` on the two new required `WakeSettingInput` fields; that merge commit carries the fix | Lead merges the lanes |
| R15 | ~~docs: one English page `wake-ladder.mdx`~~ | Docs lane L6 writes `apps/docs/concepts/wake-ladder.mdx` and its twin `apps/docs/pt-br/concepts/wake-ladder.mdx`, plus the `set_wake` reference pages `apps/docs/mcp-reference/set-wake.mdx` and `apps/docs/pt-br/mcp-reference/set-wake.mdx` (en and pt-br examples written natively). The main path of the wake ladder page speaks to any AI user, not a developer; the fields table stays on the reference page. No simulator or fake WhatsApp appears in them. L6 starts after the lead merges `origin/feat/agent-inbox-core` (the bilingual tree and the twin test are not on this branch yet) | Cross-slice decisions: i18n, audience, no fake WhatsApp |
| R16 | Install prompt text for ChatGPT and claude.ai (slice 5) | Facts unchanged; slice 5 now serves them from `GET /i/<install-code>` and the WhatsApp reply is a one or two line prompt | Cross-slice decision "install prompt = one or two lines" |
| R17 | `check_inbox` empty path "never runs the body query" | Today's `checkInbox` always runs `listUnread` and `markRead`; the count-first path is new work (R9) | Verified in `check-inbox.ts` |
| R18 | Slice 1 fixtures need `handedTo`/`originMessageId`: `readByAgent:` is built in `receive-owner-message.ts`, `deliver-to-owner.ts`, `inbox/testing/in-memory.ts`, `wake/testing/wake-fixtures.ts`, `sqlite-inbox-repository.ts`, `apps/api/test/support/builders.ts` and the tests that build a `Message` | Step 0 adds `handedTo: null, originMessageId: null` to those literals and maps the two columns in the SQL repository once L1 lands the columns (Step 0 maps them as `null`) | Required envelope fields keep one shape for every message |
| R19 | ~~`send-content.ts` not listed in any lane~~ | L2 also owns `libs/core/src/inbox/use-cases/send-content.ts`: `assertMessageExists` returns the found message and the stored `replyToMessageId` is `ownerMessageIdOf` of it, so a reply to a standby copy points at the owner message the channel adapter knows | Without it `reply_to` with a copy id would reach the channel as an id the message index does not hold |
| R20 | Locale: per-row `agent_wake.owner_locale` only | Kept, beside webhook-wake A21's account-level `owner_locale` storage key | The poll record has the locale on every `check_inbox` even if the owner never wrote; A21's key exists only after an owner message |

## Contract (Step 0, verbatim)

Step 0 lands these changes first, in one commit on the feature branch. Lanes build against them. Struck-through lines of the first version are in the refresh log above.

### `libs/types/src/enums.ts` (additions)

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

export enum WakeCopyKey {
  ExpectedDelayNote = 'expected_delay_note',
  StaleNotice = 'stale_notice',
  CadenceHourly = 'cadence_hourly',
  CadenceHours = 'cadence_hours',
  CadenceMinutes = 'cadence_minutes',
  ElapsedMinutes = 'elapsed_minutes',
  ElapsedHours = 'elapsed_hours',
  NeverPolled = 'never_polled',
}
```

Each member is appended to the existing enum. `SECOND_MS`, `MINUTE_MS`, `HOUR_MS` and `DAY_MS` exist in `libs/types/src/constants.ts`; they are imported, never redeclared.

### `libs/core/src/wake/constants.ts` (additions)

```ts
import { DAY_MS, MINUTE_MS } from '@zapbip/types';

export const SCHEDULED_MIN_INTERVAL_MINUTES = MINUTE_MS / MINUTE_MS;
export const SCHEDULED_MAX_INTERVAL_MINUTES = DAY_MS / MINUTE_MS;
export const STALE_POLL_INTERVAL_MULTIPLE = 2;
export const SAFETY_NET_CRON = '0 * * * *';
```

### `libs/core/src/inbox/message.ts` (additions)

```ts
export type MessageEnvelope = {
  // existing fields, unchanged
  handedTo: AgentName | null;
  originMessageId: string | null;
};

export function ownerMessageIdOf(input: { message: Message }): string;
```

### `libs/core/src/inbox/ports.ts` (additions)

```ts
export interface InboxRepository {
  // existing methods, unchanged, including countUnread
  insertHandoff(input: { copy: Message; primaryAgent: AgentName; handedTo: AgentName }): Promise<void>;
}

export interface AgentWaker {
  notify(input: { agent: AgentName; reason: AgentWakeReason; messageId?: string }): Promise<WakeOutcome>;
}
```

`insertHandoff` writes the copy and marks the primary's unread rows of that owner message read with `handedTo`, in one transaction. The Step 0 stubs sit in `apps/api/src/adapters/sqlite/sqlite-inbox-repository.ts` and `libs/core/src/inbox/testing/in-memory.ts`.

### `libs/core/src/inbox/inbox-copy.ts` (L2, additive)

```ts
export function fillCopyTokens(input: { text: string; values: Record<string, string> }): string;
```

`renderCopy` calls it. Not in Step 0.

### `libs/core/src/wake/wake-setting.ts` (in place)

```ts
export type WakeSettingInput = {
  mode: WakeMode;
  url: string | null;
  token: string | null;
  intervalMinutes: number | null;
  standbyAgent: AgentName | null;
};

export type StoredWake = {
  // existing fields, unchanged
  intervalMinutes: number | null;
  standbyAgent: AgentName | null;
  ownerLocale: OwnerLocale | null;
};

export type PollState = {
  lastPolledAt: number;
  hasPolled: boolean;
  pollerStaleNotified: boolean;
};

export type ScheduledWake = StoredWake & PollState;

export function assertWakeSetting(input: { setting: WakeSettingInput; caller: AgentName; standby: StoredWake | null }): void;
```

`assertWakeSetting` throws `InboxError` with `InvalidInput`, naming the field and the limit. Write-time checks: interval integer in `[SCHEDULED_MIN_INTERVAL_MINUTES, SCHEDULED_MAX_INTERVAL_MINUTES]`; the interval is present for `scheduled`; the standby name is present for `standby`, is not the caller, exists (`standby !== null`, so a revoked connection is refused with the same message as an unknown one) and is not in `standby` mode; fields of another mode are `null` (R12).

### `libs/core/src/wake/wake-ports.ts` (WakeRepository additions)

```ts
export interface WakeRepository {
  // existing methods, unchanged
  findPollState(input: { agent: AgentName }): Promise<PollState | null>;
  recordPoll(input: { agent: AgentName; polledAt: number; ownerLocale: OwnerLocale }): Promise<void>;
  listScheduledWakes(): Promise<ScheduledWake[]>;
  markStaleNotified(input: { agent: AgentName }): Promise<void>;
}
```

`recordPoll` writes `last_polled_at`, `has_polled = 1`, `owner_locale`, and clears `poller_stale_notified`. `saveWake` writes the mode-owned columns, now including `interval_minutes`, `standby_agent` and `owner_locale`, and never a poll column. `listScheduledWakes` returns scheduled rows only; a revoked connection has no row (R4). The mapper throws when a scheduled row has a null `interval_minutes` or `owner_locale`, or a standby row has a null `standby_agent`.

### `libs/core/src/wake/wake-rung.ts` (widened in place)

```ts
export function wakeRungFor(input: {
  wake: StoredWake;
  pollState: PollState | null;
  standby: StoredWake | null;
  now: number;
}): WakeRung;
```

Replaces `wakeRungFor({mode})`. The only place the rung is computed; the stored mode is never rewritten (ADR 0025).

| Stored mode | Condition | Rung |
|---|---|---|
| `webhook` | — | `Webhook` |
| `scheduled` | not stale | `Scheduled` |
| `scheduled` | stale | `Inbox` |
| `standby` | standby exists and is not in `standby` mode | `Standby` |
| `standby` | otherwise | `Inbox` |
| `none` | — | `Inbox` |

### `libs/core/src/wake/poller.ts`

```ts
export function isPollerStale(input: { wake: ScheduledWake; now: number }): boolean;
export function pollerDeadline(input: { wake: ScheduledWake }): number | null;
```

`pollerDeadline` is `null` when the mode is not `scheduled` or the stale notice is already sent; otherwise `lastPolledAt + STALE_POLL_INTERVAL_MULTIPLE * intervalMinutes * MINUTE_MS`.

### `libs/core/src/wake/poll-inbox.ts`

```ts
import type { CheckInboxInput, CheckInboxResult } from '../inbox/use-cases/types';
import type { WakeContext } from './wake-ports';

export function pollInbox(input: CheckInboxInput & Pick<WakeContext, 'wake'>): Promise<CheckInboxResult>;
```

R9 gives the order. The Durable Object's `checkInbox` RPC calls it. `get_messages`, `ask` and `wait_for_reply` do not.

### `libs/core/src/wake/set-wake.ts` (in place)

`setWake` keeps its signature and result. It looks the standby up through `findWake`, calls `assertWakeSetting`, saves through `saveWake` with `ownerLocale` from `connection.ownerLocale`, and returns the rung from `wakeRungFor` (for `scheduled` and `standby` it reads `findPollState` and the standby record). `WAKE_SETTERS` gains `saveScheduled` and `saveStandby` (R11).

### `libs/core/src/wake/evaluate-pollers.ts`

```ts
export type EvaluatePollersResult = { nextDueAt: number | null };

export function evaluatePollers(input: WakeContext): Promise<EvaluatePollersResult>;
export function nextPollerDeadline(input: Pick<WakeContext, 'wake'>): Promise<number | null>;
```

For each stale scheduled wake not yet notified: `markStaleNotified`, then one stale notice through `deliverToOwner` with `agent: null`, in the wake's `ownerLocale`. `nextPollerDeadline` is the earliest `pollerDeadline`; the Durable Object's due-time provider calls it and `evaluatePollers`.

### `libs/core/src/wake/wake-copy.ts`

```ts
export function expectedDelayNoteCopy(input: {
  locale: OwnerLocale;
  agent: AgentName;
  intervalMinutes: number;
  elapsedSinceLastPollMs: number | null;
}): string;
export function staleNoticeCopy(input: { locale: OwnerLocale; agent: AgentName; elapsedSinceLastPollMs: number | null }): string;
```

`elapsedSinceLastPollMs` is `null` only when `hasPolled` is false (the copy then uses `NeverPolled`); the caller decides, the copy never reads null as a value. Step 0 declares the real strings of the new `WakeCopyKey` entries in `WAKE_COPY` and stubs the two functions.

### `apps/api/src/adapters/wake/` (stubs in Step 0, bodies in L3)

```ts
export type WakerByRung = Record<WakeRung.Webhook | WakeRung.Scheduled | WakeRung.Standby | WakeRung.Inbox, AgentWaker>;

export function createScheduledAgentWaker(input: { dependencies: CoreDependencies; wake: WakeDependencies }): AgentWaker;
export function createInboxAgentWaker(input: { dependencies: CoreDependencies; wake: WakeDependencies }): AgentWaker;
export function createStandbyAgentWaker(input: { dependencies: CoreDependencies; wake: WakeDependencies }): AgentWaker;
export function createDispatchingAgentWaker(input: { wakers: WakerByRung; repository: WakeRepository; clock: Clock }): AgentWaker;
```

The dispatcher computes the rung with `wakeRungFor` (it loads the wake, its poll state and, for `standby`, the standby wake). `createWebhookAgentWaker` is not changed. The standby waker reaches the standby's waker through `dependencies.waker`, which the Durable Object sets to the dispatcher after the dispatcher exists.

### `apps/api/src/contract/mcp-schemas.ts` (`setWakeInputShape`, in place)

`interval_minutes: z.number().nullable().default(null)` and `standby_agent: nullableString` are added; `mode` already follows `WakeMode`. The strict registration is R13 (L4).

### Dev clock

No contract change. Tests and the E2E suite advance time through slice 1's `POST /dev/owner/:phone/clock` with `advance_ms` (`apps/api/src/routes/dev-owner.ts`, mounted only by `index.dev.ts`). The owner simulator is not edited by this slice.

## Dependencies

No new package. The contract depends on slice 1 (`libs/types`, `libs/core/src/inbox/**`), slice 3 (`AccountOwnerRpc.recordRevocation`, `ownerLocale` on the identity) and slice 4 (`libs/core/src/wake/**`, `WakeRepository`, the dispatcher, `set_wake`). Every name was checked on 2026-11-06 (refresh log); the Durable Object wake wiring of slice 4's L2 is re-checked when `origin/feat/webhook-wake-l2` lands.

## File map (lanes)

Every path has one owner.

| Lane | Developer | Owned paths |
|---|---|---|
| L0 Contract (Step 0, serial) | `developer-0` | `libs/types/src/enums.ts`, `libs/core/src/wake/{constants,wake-setting,wake-ports,wake-rung,set-wake,wake-copy,poll-inbox,poller,evaluate-pollers,index}.ts` (signatures and stubs; `WAKE_COPY` values), `libs/core/src/wake/testing/{wake-doubles,wake-fixtures}.ts` (stubs for the four repository methods; literals), `libs/core/src/inbox/{message,ports}.ts`, `libs/core/src/inbox/testing/{in-memory,fixtures}.ts` and the other literals R18 lists, `apps/api/src/contract/mcp-schemas.ts`, `apps/api/src/adapters/wake/{scheduled-agent-waker,inbox-agent-waker,standby-agent-waker,dispatching-agent-waker}.ts` (stubs and widened types), `apps/api/src/adapters/sqlite/sqlite-inbox-repository.ts` (`insertHandoff` stub, `null` mapping), `apps/api/src/mcp/wire.ts` only if the typecheck needs it |
| L1 Storage | `developer-1` | `apps/api/src/adapters/sqlite/sqlite-wake-repository.ts` (the four new methods, the widened `saveWake` and the mapper), `apps/api/src/adapters/sqlite/sqlite-inbox-repository.ts` (`insertHandoff` and the two message columns), `apps/api/src/account-inbox/migrations/v3.sql` and its line in `migrations/index.ts`, `apps/api/test/integration/scheduled-wake-storage.test.ts` |
| L2 Core | `developer-2` | bodies of `libs/core/src/wake/{wake-rung,wake-setting,set-wake,poll-inbox,poller,evaluate-pollers,wake-copy}.ts` and their `*.test.ts`; `libs/core/src/inbox/message.ts` (`ownerMessageIdOf` body); `libs/core/src/inbox/inbox-copy.ts` (`fillCopyTokens`, additive); `libs/core/src/inbox/use-cases/{check-inbox,send-content,receive-owner-message}.ts` (R9, R19, and the `messageId` argument for plain deliveries only) and their tests; `libs/core/src/inbox/testing/in-memory.ts` (`insertHandoff` body) and the in-memory `WakeRepository` methods in `libs/core/src/wake/testing/wake-doubles.ts` |
| L3 Wakers and Durable Object | `developer-3` | `apps/api/src/adapters/wake/{scheduled-agent-waker,inbox-agent-waker,standby-agent-waker,dispatching-agent-waker}.ts` bodies; ``apps/api/src/account-inbox/account-inbox.ts` (`checkInbox` via `pollInbox`, the poller due-time provider, `dependencies.waker` assignment; `setWake` re-arms through `outcome()`); tests `apps/api/test/integration/{scheduled-wake-alarm,standby-handoff,standby-revocation}.test.ts` |
| L4 MCP | `developer-4` | `apps/api/src/mcp/set-wake.ts` (slice 4's handler, in place; exists only after slice 4's L3 is merged, R14), the `set_wake` entry of `apps/api/src/contract/tool-definitions.ts`, `apps/api/test/integration/mcp-scheduled-wake.test.ts` |
| L5 E2E | `developer-5` | `apps/api/test/e2e/scheduled-wake.e2e.test.ts` (default gate) |
| L6 Docs | `developer-6` | `apps/docs/{concepts/wake-ladder,mcp-reference/set-wake}.mdx` and their `apps/docs/pt-br/` twins (R15) |

Ownership notes:

- `standby-revocation.test.ts` drives accounts-and-keys' revoke flow (`AccountOwnerRpc.recordRevocation`, R4). It needs accounts-and-keys merged and is the only L3 test that does.
- `libs/core/src/inbox/use-cases/receive-owner-message.ts` is slice 1's file. This slice's edit is the `messageId` argument of `notify`, only for plain deliveries (R5, R6).

## Sequencing

1. **Step 0 (L0), serial,** after S0.0 has confirmed names against `main` and the merged slices.
2. **Parallel after Step 0:** L1 and L2 (L6 once the lead has merged `origin/feat/agent-inbox-core`, R15). L4 and L5 red-test against the stubs.
3. **Merge order:** L0 → L2 → L1 → L3 → L4 → L6 → L5.
   - L2 before L1: the rules are pure and tested in memory.
   - L3 after L1 and L2: alarm and handoff tests need the repository and the rules.
4. **Lead merges after each lane:** `pnpm typecheck` and `pnpm verify` green on the branch before the next merge.

## Steps

Every box is empty when authored.

### Step 0 (L0): plan refresh and contract

- [x] ~~**S0.0 Plan refresh against main.** On the branch cut from `main` after slices 1, 3 and 4 have merged, run `git grep` for every path and name this plan takes from them: `libs/types/src/enums.ts` (`WakeMode`, `WakeRung`, `AgentWakeReason`, `OwnerLocale`), `libs/types/src/constants.ts` (`MINUTE_MS`, `HOUR_MS`, `DAY_MS`), `libs/core/src/inbox/{connection,message,ports}.ts`, `libs/core/src/inbox/use-cases/types.ts` (`CallContext`, `CheckInboxResult`), `libs/core/src/wake/{wake-setting,wake-ports,wake-rung,set-wake}.ts`, `apps/api/src/adapters/wake/dispatching-agent-waker.ts`, `apps/api/src/account-inbox/wake-repository.ts`, `apps/api/src/mcp/set-wake.ts`, and accounts-and-keys' `recordRevocation` call. Correct this plan and the spec to what is on `main`, and commit as `docs(features): refresh the scheduled-wake plan against main`. A name that is not found stays `(contract: confirm at build)` and blocks S0.1 until resolved.~~ Done as the refresh log at the top of **Contract**, against this branch and the pushed slice 3 and slice 4 branches (`main` has none of them yet). Evidence: `dc4e77a`.
- [x] **S0.1 Contract.** Add the enum members, write every block of **Contract** with stub bodies (`void input;` then `throw new Error('<name> is not implemented');`), and add `handedTo: null, originMessageId: null` to every `Message` literal (R18) so `pnpm typecheck` and `pnpm verify` stay green. Run `pnpm typecheck` green. Commit as `feat(core): add the scheduled wake contract`. Evidence: `87041a7`; `pnpm typecheck` and `pnpm verify` (9 gates, product) green. Deviation: `wakeRungFor` implements the `none` and `webhook` rows today (slice 4's `setWake` and its tests call it) and throws `wakeRungFor is not implemented` for `scheduled` and `standby`; `WAKE_COPY` carries the real strings of the new keys.

Failure modes for Step 0 are in the table below. Step 0 has no backout: a broken contract is fixed forward in a new Step 0 commit.

### Step L1 (storage)

- [ ] **S1.1 red: storage.** Write `apps/api/test/integration/scheduled-wake-storage.test.ts` (the test plan's **C. Worker storage**) against a real Durable Object SQLite. Run `pnpm --filter @zapbip/api test:integration -- scheduled-wake-storage`. Expected failure: `<name> is not implemented`. Commit as `test(api): pin the scheduled-wake storage`.
- [ ] **S1.2 green: schema v3.** Write `migrations/v3.sql` (`ALTER TABLE`, so an object that applied `v1` upgrades): to `agent_wake` add `interval_minutes`, `standby_agent`, `owner_locale` (nullable), `has_polled` and `poller_stale_notified` (`INTEGER NOT NULL DEFAULT 0`: a connection that existed before `v3` never had a recorded poll); to `inbox_messages` add `handed_to` and `origin_message_id` (nullable). ~~`revoked_at`~~ (R4). Create `CREATE INDEX inbox_messages_unread ON inbox_messages (agent) WHERE read_at IS NULL;`. ~~Generate the migration with `drizzle-kit` (not hand-written).~~ (R1) Register `{version: 3, sql}` in `migrations/index.ts`. Implement `findPollState`, `recordPoll`, `listScheduledWakes`, `markStaleNotified`, the widened `saveWake` (mode-owned columns only), the mapper (throws when a stored mode's required column is null), and `insertHandoff` (one transaction). Commit as `feat(api): store wake settings and handoffs in schema v3`.

Failure modes: see table.

### Step L2 (core rules and use cases)

- [ ] **S2.1 red: rules and use cases.** Write the core tests of the test plan's **A** and **B** sections, and the `receive-owner-message.test.ts` cases that pass `messageId`. Add the in-memory `WakeRepository` methods as stubs (`insertHandoff` in `in-memory.ts` too). Run `pnpm --filter @zapbip/core test:unit`. Expected failure: each case fails with `<name> is not implemented`. Commit as `test(core): pin the scheduled wake and standby rules`.
- [ ] **S2.2 green: rules.** Implement `wakeRungFor` (table row by row), `assertWakeSetting`, `isPollerStale`, `pollerDeadline`, `expectedDelayNoteCopy`, `staleNoticeCopy`, `fillCopyTokens`, `ownerMessageIdOf`. Commit as `feat(core): implement the scheduled wake rules`.
- [ ] **S2.3 green: use cases.** Implement `setWake` (in place: `saveScheduled`, `saveStandby`, `assertWakeSetting`, `saveWake` with `ownerLocale` from the connection), `readInbox` in `check-inbox.ts`, `pollInbox`, `evaluatePollers`, `nextPollerDeadline`; make `send-content.ts` store `ownerMessageIdOf` of the replied-to message (R19). Edit `receive-owner-message.ts`: pass `messageId` (plain delivery only) to the waker call. ~~`firstUnread`~~ (R5). Commit as `feat(core): implement set_wake for scheduled and standby, polls and poller checks`.

Failure modes: see table.

### Step L3 (wakers and Durable Object)

- [ ] **S3.1 red: wakers, alarm, handoff.** Write `scheduled-wake-alarm.test.ts`, `standby-handoff.test.ts`, and `standby-revocation.test.ts` (this one needs accounts-and-keys merged). Expected failure: `not implemented`. Commit as `test(api): pin the scheduled and standby wakers, the alarm and the revoke flow`.
- [ ] **S3.2 green: wakers and Durable Object.** Implement `ScheduledAgentWaker`, `InboxAgentWaker` (the note, then `Unreached`), `StandbyAgentWaker` (copy with a new id and `origin_message_id`, `insertHandoff`, `dependencies.waker.notify` with `StandbyFor` (no pointer) when the standby's count was 0, returns the standby's outcome; `Woken` without a call when the count was above 0; ~~throws when `messageId` is absent~~ returns `Unreached` without a copy, R6). Widen `WakerByRung` and `createDispatchingAgentWaker` (uses `wakeRungFor`). In `account-inbox.ts`: `checkInbox` through `pollInbox`; register the poller due-time provider (A13); ~~`recordRevocation`~~ (R4); assign `dependencies.waker` to the dispatcher. Commit as `feat(api): add the scheduled and standby wakers and run the poller checks in the alarm`.

Failure modes: see table.

### Step L4 (MCP)

- [x] **S4.1 red: tools over HTTP.** Write `mcp-scheduled-wake.test.ts` (the test plan's **E. MCP over HTTP**). Expected failure: the `scheduled` call alone hits `saveScheduled is not implemented` (R11; the tool error text names it), and a case with an unknown field proves R13. The `webhook` and `none` cases pass on arrival and are labelled `pin`. Commit as `test(api): pin set_wake for scheduled and standby`. Evidence: 85144f6.
- [x] **S4.2 green: tool.** Extend `set_wake` in place: the extended zod shape registered as `z.strictObject` (R13), remove `Scheduled` and `Standby` from `UnavailableWakeMode` (R14), map `interval_minutes` and `standby_agent` to the camelCase input, update the tool description. Commit as `feat(api): accept scheduled and standby in set_wake`. Evidence: 055dbf5 (the saved-result and validation cases stay red until L2 and the slice's saveScheduled/saveStandby land).

Failure modes: see table.

### Step L5 (E2E)

- [ ] **S5.1 red: E2E walk.** Write `scheduled-wake.e2e.test.ts` (the test plan's **F**) against `wrangler dev src/index.dev.ts`, advancing time with `POST /dev/owner/:phone/clock`. Expected failure: the first walk step's `set_wake` returns the tool error `saveScheduled is not implemented`, not a 404 or a missing route. Commit as `test(api): walk the scheduled poller and the standby in the simulator`.
- [ ] **S5.2 green.** The walk passes once every lane has merged. Commit as `test(api): green the scheduled-wake walk`.

### Step L6 (docs)

- [ ] **S6.1 pin: docs gate.** Run `pnpm dlx mint@4.2.1207 broken-links` in `apps/docs` on the current pages (the Mintlify CLI is not a workspace dependency); expected: exit 0. This is a pin, recorded in the tester briefing; no commit.
- [ ] **S6.2 green: page.** Complete `wake-ladder.mdx` and its `pt-br` twin (R15): five rungs in plain words, what the person sees (the expected-delay note, the stale notice, a standby answering), the one-hop rule; and the `scheduled` and `standby` variants on the `set-wake` reference page in both languages. The page step carries the assertion: `mint broken-links` exits 0 and the twin test of the shape gate passes. Commit as `docs(api): explain the scheduled poller and the standby in the wake ladder`.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| S0.0 | A name in this plan differs from `main` | `git grep` finds no match | Correct this plan; the `(contract: confirm at build)` marks stay until fixed |
| S0.1 | New required fields `handedTo`, `originMessageId`, `intervalMinutes`, `standbyAgent` break slice 1 and slice 4 fixtures | `pnpm typecheck` lists them | Fix forward in a new Step 0 commit |
| S0.1 | An enum value is declared twice | `pnpm typecheck` reports duplicate members | Keep the first declaration |
| S1.2 | The `DEFAULT 0` of `has_polled` marks a connection as polled | A test "never polled shows the never-polled text" prints a cadence instead | `recordPoll` is the only writer of `has_polled = 1`; the default exists only so `ALTER TABLE` can add the column |
| S1.2 | Index not used by the count | `EXPLAIN QUERY PLAN` shows `SCAN inbox_messages` | Restore the literal `read_at IS NULL` in the count |
| S2.2 | `wakeRungFor` differs from the table on one row | The table test fails on that row | Fix the row; the table test is the record |
| S2.3 | `messageId` is passed for an answer or a Choice | `receive-owner-message.test.ts` asserts `messageId` undefined for an answer | Pass it only on the plain-delivery branch |
| S3.2 | Expected-delay note sent twice for one message | Waker test "note once for 0 → 1" fails | ~~Read `firstUnread` once, in one waker~~ Send the note from one waker only (R5: `notify` is already a 0 to 1 call) |
| S3.2 | Stale notice repeated on the next alarm | Alarm test "no duplicate" fails | Persist `markStaleNotified` before the notice |
| S3.2 | The standby copy shares the owner message id | `standby-handoff` asserts a new id; the storage test fails the unique id check | Generate the id with `IdGenerator`; never reuse `messageId` |
| S3.2 | Primary and standby both woken | Waker spy receives the primary under the standby rung | Skip the primary's notify on the standby rung |
| S3.2 | `dependencies.waker` not set, so the standby is never notified | Handoff test: standby waker spy not called | Assign the dispatcher after construction in the Durable Object constructor |
| S3.2 | Alarm not re-armed after eviction | Restart test: alarm does nothing after restart | Re-arm in the constructor from stored deadlines |
| S3.2 | Standby wake carries a body or pointer | `standby-handoff` asserts the wake body equals the constant signal | Send the constant signal only |
| S3.2 | Revoked standby still gets copies | `standby-revocation` finds a copy | ~~Check `revokedAt` in `wakeRungFor` and in the handoff~~ Read the standby through `findWake` at dispatch time; a deleted row is `null` (R4) |
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
