# 0024. A standby gets a copy of the owner's message, never its primary's inbox

- Status: Accepted
- Date: 2026-11-06
- Deciders: Dhyego Calota (owner, delegated); Claude (advisor)
- Inspired by: the client probes of 2026-11-04 to 2026-11-06 (Grok web has no wake and a 60 s call cap; Grok Bot answers through a routine webhook in ~9 s); ADR 0006 (a secret resolves to one agent).

## Context

Some agents cannot be woken at all. Grok web is one: its owner can chat with it, but zapbip has no way to start a turn there. The owner may already have a second agent on the same account that can be woken, Grok Bot in that case. When a message for the first agent waits, the second agent has to answer it as itself, and it must see the message.

The second agent's secret resolves to that agent alone (ADR 0006), so it cannot read the first agent's inbox.

## Decision

1. A standby receives a copy of the owner's message in its own inbox. The copy has its own message id and an `origin_message_id` naming the owner's message. Message ids stay unique; the standby's `reply_to` may quote either id, and both resolve to the owner's message. The standby is woken with the constant wake signal and reads the copy through `check_inbox`; the wake carries no pointer and no body.
2. The primary's copy is marked read and records `handed_to`. The primary's `get_messages` history still shows the exchange.
3. A handoff goes one hop only. A standby that is itself in standby mode, is missing or is revoked gets no copy. The message stays with the primary, unread, and the owner gets the inbox notice.
4. The standby is woken through its own rung, and only when its unread count goes from 0 to 1.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Copy into the standby's inbox and mark the primary's copy read (chosen) | the standby reads only its own inbox; the id survives, so `reply_to` works; no new entity | the body is stored twice; the primary could still answer from its history | — |
| Pointer only; the standby reads the primary's message through a tool | no copy | a tool that reads another connection's inbox breaks ADR 0006's rule that a secret resolves to one agent | breaks the boundary |
| Move the message out of the primary | a single copy | the primary's history loses the exchange, so `get_messages` has a hole | the history must stay complete |
| One shared inbox for the pair | one place for both | two agents draw from one queue and race for each answer; a new entity to maintain | more than one hop needs |

## Consequences

- Media is not copied: both copies reference the same `media_id`, and retention is unchanged.
- The standby's answer is a separate conversation from the one the owner started, as ADR 0007 already says.
- A primary that reads its history after a handoff can answer twice. The history marks `handed_to`, and the install prompt tells the primary to skip handed-off messages.

## Evidence

- Grok web: no wake, 60 s per call, and it re-sends a question on its own after a timeout (probes of 2026-11-04 and 2026-11-05).
- Grok Bot: a routine webhook woke it, and it answered through `send_message` in ~9 s (probe of 2026-11-05).

## Revisit when

- A client can read the owner's inbox under its own secret, which would make the pointer option safe.
- Handoffs are measured to produce double answers in practice.
- A standby chain is needed by a real owner.
