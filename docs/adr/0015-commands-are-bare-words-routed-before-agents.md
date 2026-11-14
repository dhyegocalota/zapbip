# 0015. Commands are bare words, routed before agents

- Status: Accepted
- Date: 2026-11-06
- Deciders: Dhyego Calota (owner, delegated); Claude (advisor)
- Inspired by: the owner's approved wording "novo agente <nome>" ([agent-inbox-core](../features/agent-inbox-core/spec.md)); the routing rules of agent-inbox-core, rules 1 to 6

## Context

The owner manages agents from WhatsApp: create, list, revoke, rotate, help and delete. Every other text message from the owner is meant for an agent, so the owner's commands and the owner's conversation share one channel. The core's routing already decides the target of each message, and a command must be decided before that routing runs, or it would reach an agent.

## Decision

1. Commands are bare words in pt-BR and en: `novo agente`, `agentes`, `revogar`, `renovar`, `ajuda`, `apagar conta`, with their English forms.
2. A command is matched exactly, after normalising case and whitespace. A message that is not an exact match is routed to an agent.
3. The first word of every command is a reserved agent name.
4. A new rule 0 runs before the core's rules 1 to 6: an exact command, or a list reply with an id starting `zapbip:`. A command never changes the last-agent rule and never answers a question.
5. A forwarded or frequently forwarded message is never a command, so a forwarded `revogar alpha` reaches the agent routing as ordinary text. A quoted reply to an agent's message is never a command. A text starting `@<agent> ` routes to that agent (core rule 3) and is never a command.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Bare words, exact match, reserved names (chosen) | the approved wording; no extra syntax; agents keep every other message | a common word such as `ajuda` can collide with the owner's own text | the collision is limited to exact matches, and `@<agent>` is the escape |
| Reserved prefix such as `/` | no collisions with ordinary text | not the approved wording; an extra character on every command | the owner chose the bare words |
| Interactive menu only | no typed grammar | a list is cumbersome for names; it cannot carry `novo agente <nome>` | kept as the discovery aid, not the only path |
| Natural-language intent by a model | no grammar to learn | cost on every message; a misread can create or revoke a key; prompt injection through the owner's messages | creating and revoking keys must be deterministic |

## Consequences

- Commands that take a free name (`novo agente`, `revogar`, `renovar`) can swallow a message meant for an agent: "renovar a imagem" gets a `NotFound` reply. The owner writes `@<agent> …` to reach the agent; the docs page says so.

- The core gains rule 0. Its tests prove that commands leave rules 1 to 6 untouched.
- Reserved agent names are a visible limit: an agent cannot be named `ajuda`.
- An owner who sends `ajuda` meaning to an agent must use `@<agent> ajuda`.

## Evidence

- The owner's approved wording of 2026-11-06 in `agent-inbox-core`.

## Revisit when

- Owners report routine collisions between commands and their own messages.
- A client needs a command namespace of its own.
