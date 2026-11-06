# 0025. Pollers are recorded per connection, and a stale poller degrades the effective rung

- Status: Accepted
- Date: 2026-11-06
- Deciders: Dhyego Calota (owner, delegated); Claude (advisor)
- Inspired by: the round of 2026-11-06 on scheduled tasks (claude.ai, ChatGPT and their minimums and setup quirks); ADR 0007 (a scheduled task wakes the agent and calls `check_inbox`).

## Context

A client with no outbound wake (ChatGPT, or claude.ai without a trigger) reaches the owner only when its schedule runs. Two things go wrong silently: the schedule stops, and the owner keeps writing into a box nobody reads. The owner also needs to know how late a reply will be. Some clients add a second schedule beside their webhook: claude.ai runs an hourly safety-net task next to its API trigger.

Stopping the schedule should not destroy the owner's setting. A poll that comes back should restore the behaviour without the owner doing anything.

## Decision

1. Every `check_inbox` records the calling connection's `last_polled_at`, whatever its wake mode. `get_messages`, `ask` and `wait_for_reply` do not record a poll.
2. zapbip never rewrites the owner's stored wake mode, which `set_wake` saves as a `WakeMode`. The effective rung, a `WakeRung`, is computed from it. A `scheduled` connection with no poll for `STALE_POLL_INTERVAL_MULTIPLE` times its interval has the effective rung `inbox`.
3. The owner gets one stale notice per stale episode. The next poll ends the episode without a message.
4. A safety-net schedule beside a webhook is a poller, not a mode. It records polls and leaves the mode as it is.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Record polls, keep the stored mode, compute the effective rung (chosen) | the owner's setting survives a stale spell; a poll restores it with no action | the rung is derived, so every reader must use the same function | — |
| Rewrite the stored mode to `none` when stale | the stored value always matches behaviour | the owner's choice is lost; restoring needs the owner or zapbip remembering the old mode | loses state |
| Combined modes such as `webhook+scheduled` | the safety net is explicit in the setting | the mode set multiplies with each pair; the shared `set_wake` schema grows | combinatorial |
| Check staleness only when an owner message arrives | no alarm needed | the owner learns late, and only if they write; a silent poller goes unnoticed | the notice must not depend on the owner writing |

## Consequences

- One timestamp is written on every `check_inbox`, and it stays cheap (ADR 0007 requires it to be).
- The `AccountInbox` alarm also carries the earliest stale deadline, next to the queue expiry from ADR 0011.
- One function computes the effective rung, and routing and `set_wake` both call it.

## Evidence

- claude.ai scheduled tasks: 1 h minimum on a cron. Editing an existing cron to `0 * * * *` was saved as "current minute", so the install creates the task instead.
- ChatGPT "Run on this computer": a minute interval was accepted on screen and saved as Hourly. A fixed daily time ran; it fired at 07:25 for a 07:30 setting.
- ChatGPT cloud tasks need the Plus plan; the schedule was refused on the free plan.
- claude.ai API trigger: ~16 s from the owner's message to the reply.

## Revisit when

- A client exposes its run history, so zapbip can read the last run instead of guessing from polls.
- MCP Tasks or a server-initiated wake lands (ADR 0007's revisit condition).
- A client changes its scheduled-task minimum.
