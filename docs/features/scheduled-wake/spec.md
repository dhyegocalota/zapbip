# Scheduled wake and standby

**Status:** Building
**Tier:** 🟡
**Owner approval:** approved 2026-11-06 (owner delegated)
**ADRs:** [0007](../../adr/0007-a-durable-inbox-and-a-wake-ladder.md), [0024](../../adr/0024-a-standby-gets-a-copy-of-the-owner-message.md), [0025](../../adr/0025-a-stale-poller-degrades-the-effective-rung.md)
**Not changing:** the rung order of ADR 0007; the `ask`, `wait_for_reply` and `get_messages` contracts and the 50 s ceiling; the routing rules of `agent-inbox-core`; the webhook and local rungs, except the shared `set_wake` schema below; nothing outside these: `libs/core/src/wake` (slice 4's files, extended in place: `wake-setting.ts`, `wake-ports.ts`, `wake-rung.ts`, `set-wake.ts`, `constants.ts`, plus new poller and copy modules); `libs/core/src/inbox/message.ts` and `ports.ts` (the copy fields, `insertHandoff`, and the optional `messageId` plus `firstUnread` on `AgentWaker.notify`); `libs/core/src/inbox/use-cases/receive-owner-message.ts` (reads the unread count before the insert and passes `messageId` and `firstUnread`, nothing else); `libs/types/src/enums.ts` (the values listed under Storage); the `set_wake` handler in `apps/api/src/mcp/set-wake.ts`; `apps/api/src/adapters/wake/` (the scheduled, inbox and standby wakers and the dispatcher's rung table; `webhook-agent-waker.ts` and its constant wake signal are not changed); the `AccountInbox` Durable Object's schema `v3` and its `checkInbox`, `setWake` and `recordRevocation` methods; the concept page `apps/docs/concepts/wake-ladder.mdx` and the gate files. `check_inbox` and the routing rules are unchanged.

## Problem

Some clients have no outbound wake. ChatGPT, claude.ai without a trigger and Grok web reach the owner only when their own schedule or their own turn runs. Three things go wrong today:

- the owner cannot tell how late a reply will be;
- when the schedule stops, nothing notices, and the owner keeps writing into a box nobody reads;
- an agent with no wake at all (Grok web) has no way to answer, although the same owner may have a wakeable agent on the same account (Grok Bot).

`check_inbox` is the call scheduled pollers make most often, so it must stay cheap.

### Measured facts this design relies on

| Client | Measured fact | Consequence in this design |
|---|---|---|
| claude.ai scheduled task | cron minimum 1 h; editing a cron to `0 * * * *` was saved as "current minute" | the install creates the hourly task and never edits it |
| claude.ai API trigger | ~16 s from the owner's message to the reply | the webhook rung stays the primary for claude.ai |
| claude.ai empty run | ~22 s of sandbox, 3 turns | the hourly safety net costs about 24 short runs a day |
| ChatGPT cloud task | 1 h minimum; refused on the free plan ("upgrade to Plus") | the cloud task is offered only when the plan allows it |
| ChatGPT "Run on this computer" | minute interval accepted on screen, saved as Hourly; a fixed daily time ran (fired at 07:25 for 07:30); needs the Mac awake and the app open; "Always allow" once per tool; posts into the chat where it was created | the install picks Hourly, asks for one dedicated chat, and states the Mac and app requirement |
| Grok web | no wake; 60 s per call; re-sends a question after a timeout | needs a standby to be answered |

## Goals

1. Scheduled connections: record every poll, tell the owner the expected delay, notice once when the poller stops, and fall back to the inbox rung.
2. The standby rung: a connection names a standby connection of the same account; when the primary cannot be woken, the standby is woken with the same constant wake signal and reads its copy with `check_inbox`; it answers as itself.
3. `check_inbox` is an indexed unread count, and returns no message bodies when the inbox is empty.
4. The `set_wake` input and result of slice 4 are extended in place (`WakeSettingInput`, `SetWakeResult`, the zod union): one tool, one input shape.
5. The facts the install prompts of slice 5 need for ChatGPT and claude.ai.
6. The Mintlify concept page "the wake ladder" completed.
7. Automated tests for every rule above.

## Non-goals

- Install prompt text and per-client sections. They belong to `install-skills` (slice 5), which consumes the facts above.
- The webhook and local wake adapters and their `set_wake` fields. They belong to `webhook-wake` (slice 4) and `local-connector` (slice 6).
- Failover from a failing webhook or local rung to a standby. A standby is used only when the connection's own mode is `standby`.
- Changing wake settings from WhatsApp. The owner sets them through the install.
- Running the client's schedule. zapbip never starts a client's cron; the client owns it.
- Standby chains, and enforcement of "same provider". The install offers same-provider standbys; the core enforces same account only.
- Metering or cost controls for claude.ai runs.

## Design

### Data flow

```
poll:    agent ─check_inbox─► AccountInbox
                              ├─ record last_polled_at (every call, any mode)
                              ├─ count unread (partial index)
                              ├─ 0 → {status: "empty"}, no bodies read
                              └─ n → read bodies, mark read, {status: "new", messages}

owner:   owner message ─► routing (ADR 0007, unchanged) ─► target connection T
         ├─ T is scheduled and T's unread count goes 0 → 1 → expected-delay note to the owner
         ├─ T's effective rung is standby → copy into S's inbox (own message id, `origin_message_id` = the owner message id),
         │    T's copy marked read with handed_to = S,
         │    S's unread count goes 0 → 1 → AgentWaker.notify(S, standby_for)
         └─ otherwise → the core path, unchanged

alarm:   earliest of {queue expiry (ADR 0011), scheduled deadline}
         └─ scheduled, now - last_polled_at ≥ 2 × interval, not yet notified
              → mark notified, one stale notice to the owner
```

### Interfaces

**Wake settings.** `WakeSettingInput` (slice 4, `libs/core/src/wake/wake-setting.ts`) gains `intervalMinutes` and `standbyAgent` in place (nullable, required by the mode, checked in `assertWakeSetting`). The wire schema is slice 4's `setWakeInputShape`, extended with the `scheduled` and `standby` modes. The union below is the wire view:

```ts
type WakeSetting =
  | { mode: WakeMode.None }
  | { mode: WakeMode.Local } /* ~~declared here~~ slice 6 declares and saves it (plan R3) */
  | { mode: WakeMode.Webhook /* fields defined by webhook-wake, slice 4 */ }
  | { mode: WakeMode.Scheduled; interval_minutes: number }
  | { mode: WakeMode.Standby; standby_agent: string };
```

- `WakeMode` (stored) and `WakeRung` (effective) are enums in `libs/types`. Slice 1 and slice 4 declare their values; this slice adds only `Scheduled` and `Standby`, after checking they are not already there. `WakeMode` on this branch: `None`, `Webhook`, plus this slice's `Scheduled` and `Standby` (wire values `scheduled`, `standby`); slice 6 adds `Local`. `WakeRung`: `Inbox`, `Webhook`, plus `Scheduled` and `Standby` (and `Local` from slice 6). Mode `None` gives rung `Inbox`.
- `set_wake` acts on the calling connection only. The input never names an account or an agent, and unknown fields are rejected. Slice 4 registers the tool; this slice adds the `scheduled` and `standby` variants and the validation. The `local` variant is saved by the connector attach (local-connector).
- Output: `{status: "saved", wake_mode, effective_rung}`.
- Validation (in core, with the message naming the field and the limit):
  - `interval_minutes` is an integer from `SCHEDULED_MIN_INTERVAL_MINUTES` (60) to `SCHEDULED_MAX_INTERVAL_MINUTES` (1440);
  - `standby_agent` matches the agent name pattern, names a connection of the same account (a revoked or unknown name gets the same refusal), is not the caller, and is not itself in standby mode;
  - fields of another mode must be absent (plan R12).
- Storage: wake state lives in `WakeRepository` (webhook-wake, Durable Object SQLite), not in D1. The alarm and routing run inside the Durable Object. `interval_minutes`, `standby_agent` and `poller_stale_notified` are `agent_wake` columns added by DO schema `v3`. The v3 additions to `agent_wake` are `interval_minutes`, `standby_agent`, `poller_stale_notified`, `has_polled` and `owner_locale` (~~`revoked_at`~~: slice 3 deletes the row of a revoked connection, plan R4); to `inbox_messages`, `handed_to` and `origin_message_id`. The migration is a hand-written `v3.sql` (plan R1). Variant columns are nullable in SQLite; the core maps them to the union, and a null is never read as a default.

**Poll record.** Each connection has a required `last_polled_at`, set when the connection is created and on every `check_inbox`. `set_wake` does not reset it, so a schedule that never started goes stale from the creation of the connection.

**Staleness.** `isPollerStale({wake, now})` is true when the mode is `scheduled` and `now - last_polled_at ≥ STALE_POLL_INTERVAL_MULTIPLE × interval`. The connection also stores `poller_stale_notified` (boolean), which is set when the stale notice is sent and cleared by the next poll.

**Effective rung.** `wakeRungFor({wake, standby, now})` (webhook-wake's `wake-rung.ts`, widened in place) is the only place the rung is computed:

| Stored mode | Condition | Effective rung |
|---|---|---|
| `local` | — | `local` |
| `webhook` | — | `webhook` |
| `scheduled` | not stale | `scheduled` |
| `scheduled` | stale | `inbox` |
| `standby` | standby exists, same account, not in standby mode, not revoked | `standby` |
| `standby` | otherwise | `inbox` |
| `none` | — | `inbox` |

**Core operations** (`libs/core/src/wake`), each taking named parameters:

- `setWake({connection, setting})` (webhook-wake's use case, extended in place): validates, saves, re-arms the alarm, returns the effective rung.
- `WakeRepository.recordPoll({agent, polledAt, ownerLocale})`: writes `last_polled_at`, `has_polled` and `owner_locale`, clears `poller_stale_notified`; called by `checkInbox`.
- `pollInbox({connection, …})`: registers the agent, records the poll, counts unread through the index, and reads bodies only when the count is above zero (plan R9).
- `evaluatePollers({dependencies})`: run by the alarm. It sends one stale notice per stale episode and returns the next deadline.
- `StandbyAgentWaker.notify` (rung `standby`): runs the handoff (copy, primary's copy marked read with `handed_to`, standby woken on 0 → 1).

**Ports.** `WakeRepository` (webhook-wake) gains `findPollState`, `recordPoll`, `listScheduledWakes` and `markStaleNotified` (~~`recordRevocation`~~, plan R4); `saveWake` writes the new mode-owned fields (`interval_minutes`, `standby_agent`, `owner_locale`) and never a poll column. `StoredWake` (webhook-wake's record) gains those three fields; the poll fields are a `PollState` (plan R7). `InboxRepository` gains `insertHandoff` only; `countUnread` already exists in slice 1. `AgentWaker.notify` gains `messageId` (set for a plain delivery; ~~`firstUnread`~~: `receiveOwnerMessage` already calls `notify` only on a 0 to 1 arrival, plan R5), and `AgentWakeReason` (slice 1's enum name) gains `StandbyFor`. The standby's wake carries no pointer: the standby reads its copy through `check_inbox`. Wakers per rung: `ScheduledAgentWaker` (expected-delay note), `InboxAgentWaker` (a stale scheduled connection gets the note, then the inbox notice), `StandbyAgentWaker` (handoff). No new port is needed.

**`check_inbox` index.** A partial index on `inbox_messages`, added as DO schema `v3` (agent-inbox-core → Storage and migrations):

```sql
CREATE INDEX inbox_messages_unread ON inbox_messages (agent) WHERE read_at IS NULL;
```

The count query must repeat the literal `read_at IS NULL` so the planner uses it.

**Constants** (in `libs/core`, declared once; `MINUTE_MS` and `HOUR_MS` come from `libs/types`, declared by agent-inbox-core):

| Constant | Value |
|---|---|
| `SCHEDULED_MIN_INTERVAL_MINUTES` | 60 |
| `SCHEDULED_MAX_INTERVAL_MINUTES` | 1440 |
| `STALE_POLL_INTERVAL_MULTIPLE` | 2 |
| `SAFETY_NET_CRON` | `0 * * * *` |

**Copy.** Owner-facing text is in `libs/core/src/wake/wake-copy.ts`, with `pt_BR` and `en_US` entries keyed by `OwnerLocale` (`libs/types`, slice 1). The locale is the connection's `ownerLocale`, which comes from the account property that accounts-and-keys sets at creation; no slice stores a second copy except `agent_wake.owner_locale`, written from that identity on `set_wake` and on every poll. The copy table is `WAKE_COPY` keyed by `WakeCopyKey` and `OwnerLocale`, rendered through the shared token fill (plan R10). The standby pointer and the scheduled task prompt are agent-facing and English.

- Expected-delay note: the cadence reads "de hora em hora" for 60 minutes, "a cada N horas" for multiples of 60, and "a cada N minutos" otherwise. The last poll reads "há N min" below an hour and "há N h" from an hour (rounded down), or "ainda não olhou a caixa" for a connection that has never polled. (`en_US`: "every hour", "every N hours", "every N minutes"; "N min ago", "N h ago", "has not checked the inbox yet".)
- Stale notice: names the agent, the elapsed time since the last poll, and says the messages wait in the box until the agent returns.
- The standby's first reply names itself. That instruction belongs to the install prompt (`install-skills`), not to the wake signal.

**Docs.** `apps/docs/concepts/wake-ladder.mdx` and its twin `apps/docs/pt-br/concepts/wake-ladder.mdx`, and the `scheduled` and `standby` variants on the `set-wake` reference page in both languages (plan R15). The wake-ladder pages speak to anyone who uses AI: what a person sees when an agent is slow, silent or replaced by a standby, with examples written natively per language; the field table stays on the reference page. They never mention the simulator or a fake WhatsApp. `mint broken-links` and the twin test must pass.

**Owner notices.** Every notice of this slice (the expected-delay note, the stale notice) goes through the core's outbound path (ADR 0011): when the window is closed it queues like any other message.

### Client setups (facts for slice 5)

- **claude.ai:** mode `webhook` (API trigger, slice 4), plus a scheduled task with `SAFETY_NET_CRON` that calls `check_inbox`. The owner creates the cron task (the chat cannot), and the install never edits it. The cron's polls keep `last_polled_at` fresh; mode stays `webhook`, so no staleness applies (ADR 0025).
- **ChatGPT:** mode `scheduled` with `interval_minutes: 60`. The default is "Run on this computer", which needs the Mac awake and the ChatGPT app open, and "Always allow" once for `check_inbox` and `send_message`. A cloud task is offered only when the plan allows it. The install picks Hourly in the picker, never a minute value, and asks the owner for one dedicated chat, because each run posts into the chat where it was created.
- **Grok web:** mode `standby` with `standby_agent` set to the Grok Bot connection, which is on the `webhook` rung.

The task prompt for scheduled polls is one rule: call `check_inbox`; if the result is empty, reply with one short line; otherwise answer each message through `send_message` with `reply_to` set to its id. Slice 5 embeds the text.

### Failure handling

| Failure | Behaviour |
|---|---|
| A scheduled client stops polling | After 2 × interval, one stale notice. The effective rung becomes `inbox`, so messages wait. The next `check_inbox` ends the episode silently. |
| The owner writes to a stale scheduled connection | The expected-delay note goes out (it shows the last poll, for example "há 3 h") and the core's inbox notice applies. |
| The standby is missing, revoked (its `agent_wake` row is gone), or itself in standby mode | No copy is made. The message stays unread with the primary, the effective rung is `inbox`, and the owner gets the inbox notice. |
| The owner message reaches a standby-mode primary without a single message id (an answer to a question, or held messages assigned by a routing-list tap) | No copy is made and the waker returns `Unreached`: the message stays with the primary and the owner gets the inbox notice (plan R6). |
| The standby's own wake fails | The copy stays in the standby's inbox and is read on its next poll. The owner gets the inbox notice. |
| The primary also answers after a handoff | Its copy is already read, so `check_inbox` does not return it. Its `get_messages` history shows `handed_to`, and the install prompt tells it to skip such messages (ADR 0024). |
| Durable Object evicted with an alarm pending | The alarm is re-armed from the stored deadlines when the object starts again. |
| Interval set below 60 or above 1440, or a standby that fails the rules | `set_wake` returns a tool error naming the field and the limit; nothing is saved. |
| The client's real cadence is slower than its declared interval | A false stale notice. Mitigation: the install sets the cadence the owner's picker actually saved; the owner can run `set_wake` again. |

### Risks

1. **Declared versus real cadence.** Minute entries were saved as Hourly on ChatGPT, and cron edits were rewritten on claude.ai. A mismatch produces false stale notices or a wrong "de hora em hora". The install uses the picker's Hourly value and creates tasks rather than editing them.
2. **Safety-net cost.** Hourly claude.ai runs add about 24 short runs a day to the owner's usage. The install states this, and the owner can delete the cron.
3. **Mac-dependent ChatGPT.** Local runs stop when the Mac sleeps or the app closes. The stale notice is the only signal, so the notice must name the requirement.
4. **Chat noise.** ChatGPT posts every run into its chat, so empty runs add a line each hour. The one-line rule keeps that small.
5. **Double answer.** A primary that reads its history after a handoff may answer again (ADR 0024).
6. **Unlabelled replies.** WhatsApp shows no agent name on an outbound message, so the owner may not know which agent answered. The standby's first reply must name itself.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Is "scheduled" a stored mode or derived from poll history? | stored mode · derived only | stored mode; the effective rung is computed; a stale poller degrades the effective rung, not the stored mode (ADR 0025) | owner delegated 2026-11-06 |
| What counts as a poll? | `check_inbox` only · every MCP call | `check_inbox` only; `get_messages`, `ask` and `wait_for_reply` do not count | owner delegated 2026-11-06 |
| When is a poller stale? | 1× · 2× · 3× the interval | 2× the interval, from the last poll or from creation | owner delegated 2026-11-06 |
| How often does the owner get a stale notice? | every check · once per episode | once per stale episode; the next poll ends it silently | owner delegated 2026-11-06 |
| Interval bounds | any · 60 to 1440 min | 60 to 1440 minutes (the platform minimum is 1 h) | owner delegated 2026-11-06 |
| When does a standby take over? | on any failure · only when the mode is `standby` | only when the mode is `standby`; a failing webhook or local rung does not fall over to it | owner delegated 2026-11-06 |
| What does the standby receive? | pointer only · copy · move · shared inbox | a copy in its own inbox with its own message id and `origin_message_id` = the owner message id; ids stay unique; the primary's copy is marked read (ADR 0024) | owner delegated 2026-11-06 |
| Can a standby be a standby? | yes · no | no; one hop only | owner delegated 2026-11-06 |
| Does the standby have to be the same provider? | enforced in core · offered by the install | the install offers only same-provider standbys; the core checks same account only (ADR 0007 says "same provider"; the install carries that rule) | owner delegated 2026-11-06 |
| When does the expected-delay note go out? | every owner message · first message of a batch | when the connection's unread count goes from 0 to 1 | owner delegated 2026-11-06 |
| When is the standby woken? | every message · first message of a batch | the same 0 to 1 rule as the note | owner delegated 2026-11-06 |
| ChatGPT interval | typed minutes · Hourly picker | Hourly picker; minute values are not used | owner delegated 2026-11-06 |
| ChatGPT local or cloud | cloud first · local first | local by default (no plan needed); cloud only when the plan allows it | owner delegated 2026-11-06 |
| claude.ai safety net | a mode · a second schedule | a second hourly schedule beside the webhook; the mode stays `webhook` (ADR 0025) | owner delegated 2026-11-06 |
| Where do wake settings live? | D1 · the Durable Object | the Durable Object SQLite (DO schema `v3`, no D1 migration), because the alarm and routing run there | owner delegated 2026-11-06 |
| Who may call `set_wake`? | the owner by WhatsApp · the calling connection | the calling connection only; the owner's change goes through the install | owner delegated 2026-11-06 |
| Which owner notices use the outbound rules? | all · only the inbox notice | all of them (ADR 0011), so a closed window queues them | owner delegated 2026-11-06 |

## Test strategy summary

- **`libs/core` unit (Vitest, fake clock, in-memory ports):**
  - every `WakeSetting` variant, with each limit: 59, 60, 1440, 1441, a non-integer, a missing or self standby, a standby in standby mode, a standby of another account;
  - the staleness boundary: just below 2 × interval is not stale, exactly 2 × is stale; never-polled counts from creation;
  - `checkInbox` records a poll on empty and on new; `get_messages`, `ask` and `wait_for_reply` record none;
  - one stale notice per episode, a poll clears it, a second stale episode notifies again;
  - `evaluatePollers` returns the earliest deadline among non-notified scheduled connections;
  - the full effective-rung table;
  - the expected-delay note fires on 0 → 1 only, and never for non-scheduled connections;
  - cadence text for 60, 90 and 120 minutes; elapsed text for 0, 12, 59, 60 and 125 minutes;
  - the standby handoff: the copy has its own id and `origin_message_id`, and `reply_to` with either id resolves to the owner message, the primary's copy is read with `handed_to`, the wake fires once per 0 → 1 batch, a revoked or standby-mode standby leaves the message with the primary, and every message kind hands off with the same media id.
- **`apps/api` integration (`@cloudflare/vitest-pool-workers`, real workerd, the `AccountInbox` Durable Object):**
  - `set_wake` over MCP for all five variants; unknown fields and account or agent names in the input are rejected;
  - `check_inbox` on an empty box never runs the body query (a spy on the repository), and `EXPLAIN QUERY PLAN` shows the partial index in use;
  - the alarm, driven with `runDurableObjectAlarm` after advancing time: one stale notice on the simulator screen, no duplicate on the next run;
  - poll records, stale flags and the next alarm survive an object restart;
  - a standby name from another account is refused, and one account's standby is never reachable from another account's secret.
- **E2E (`wrangler dev`, the owner simulator, the MCP SDK client):**
  - a scheduled client polls on a cadence; the simulator shows the expected-delay note with the last-poll time;
  - the simulator's dev-only clock advance, `POST /dev/owner/:phone/clock` (mounted only by the development entry, the same gating as the simulator) moves the clock past 2 × interval; the stale notice appears once, and the owner's next message is held with the inbox notice;
  - a second SDK client plays the standby: it answers the handed-off message, and the simulator shows the reply from that connection, with `reply_to` set to the owner's message id.
- **Manual, recorded in the PR (not automated):** one live claude.ai hourly task with an API trigger and one live ChatGPT "Run on this computer" task, each answering an owner message through WhatsApp; the evidence is the screenshot and the `check_inbox` log.
- **Docs:** `mint broken-links` green for the wake-ladder page.
