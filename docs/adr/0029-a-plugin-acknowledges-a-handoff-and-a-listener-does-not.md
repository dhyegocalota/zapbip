# 0029. A plugin acknowledges a handoff, and a listener does not

- Status: Accepted (owner delegated 2026-11-06)
- Date: 2026-11-06
- Deciders: Dhyego Calota (owner, delegated); Claude (advisor)
- Inspired by: [ADR 0022](0022-a-hibernatable-websocket-for-the-local-connector.md) (`done` frame and unread re-send), [ADR 0028](0028-the-native-channel-plugin-is-the-first-rung-for-openclaw-and-hermes.md), `docs/features/hermes-openclaw/plan.md` decision D3

## Context

The connector re-sends every unread owner message on each connect, so a message is never lost while no socket is open. Read state changes only through `done`. A channel plugin hands each message to the agent's session, and that session may answer without calling `check_inbox`. If the plugin never acknowledges, the same message is re-sent on every reconnect, and the agent answers it again.

## Decision

1. A channel plugin sends `done` with the message id after the agent accepts the handoff, and only then. A handoff that fails sends nothing, so the message is re-sent on the next connect.
2. A listener (`zapbip listen`, the Claude Code monitor) never sends `done`. Its agent reads through `check_inbox`, which owns read state.
3. A plugin skips a message id it is still handing off, and a message id that it already acknowledged, so a duplicate frame in the same connection does not reach the agent twice.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Plugin acknowledges after handoff (chosen) | the unread list shrinks as the agent receives messages; a reconnect re-sends only what the agent did not get | if the process dies between the handoff and `done`, that message is handed over again | the duplicate is the cheaper failure; the test plan's adversarial claim 1 checks it |
| Notifier only, no `done` | no ack logic in the plugin | every reconnect re-sends every unread message, and an agent that answers without `check_inbox` gets each message again | repeated replies to the owner |

## Consequences

- Delivery is at least once. A process that dies after the handoff and before `done` causes one duplicate hand-off on reconnect. The plugin's in-memory skip list covers duplicates within one connection only.
- The `done` frame carries only `type` and `messageId`, never text, so acknowledgement adds no content to the connector's logs.

## Evidence

- The connector's `done` frame and the unread re-send are in [ADR 0022](0022-a-hibernatable-websocket-for-the-local-connector.md); `acknowledgeDelivery` in `libs/core` marks only the agent's own owner messages read.
- The duplicate case is an open attack in `docs/features/hermes-openclaw/test-plan.md` (adversarial review, claim 1), to be run in V.

## Revisit when

- The owner-run real-model checks show duplicate replies to the owner.
- The connector gains a per-agent delivery cursor, which would make acknowledgement exact.
