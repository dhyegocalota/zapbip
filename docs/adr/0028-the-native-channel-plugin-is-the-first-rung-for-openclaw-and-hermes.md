# 0028. The native channel plugin is the first rung for OpenClaw and Hermes

- Status: Accepted (owner delegated 2026-11-06)
- Date: 2026-11-06
- Deciders: Dhyego Calota (owner, delegated); Claude (advisor)
- Inspired by: [ADR 0007](0007-a-durable-inbox-and-a-wake-ladder.md) (the wake ladder), [ADR 0022](0022-a-hibernatable-websocket-for-the-local-connector.md) (the connector socket), `docs/features/hermes-openclaw/spec.md` (research of 2026-11-06, OpenClaw channel plugin SDK and Hermes platform adapters)

## Context

OpenClaw and Hermes are supported agents, and the owner must get their answers on WhatsApp with no response-time limit. Neither has a hosted routine such as Grok Bot's. Both have a plugin system for chat channels. A plugin can hold a connection open and hand each owner message to the agent, which is the mechanism the local connector already uses for Claude Code.

## Decision

1. The first rung (local) for each product is a zapbip plugin in that product's own plugin system: a TypeScript channel plugin for OpenClaw, a Python platform adapter for Hermes. Each keeps one WebSocket open to the connector socket of [ADR 0022](0022-a-hibernatable-websocket-for-the-local-connector.md) and hands owner messages to the agent.
2. The third rung (scheduled) is the fallback: a job every minute that calls `check_inbox`. It is the guarantee. The install falls back to it only after the plugin fails to attach.
3. A `zapbip listen` watcher (OpenClaw `stream` job, Hermes `watch_patterns`) may add a mid-run turn on top of the fallback. It stays only if the owner-run checks OR-13 and OR-14 pass.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Native channel plugin (chosen) | a held connection with no poll delay and no model call while idle; the product's own install command | one plugin per product to maintain; the plugin API can change between versions | — |
| Every-minute `check_inbox` job only | no code beyond the MCP config | up to one minute of delay; a model turn for each poll, even when it finds nothing | kept as the fallback, not the first rung |
| `zapbip listen` watcher only | mid-run wake without a plugin | the watcher's behaviour across a Gateway restart and without a delivery target is unconfirmed (OR-13, OR-14) | cannot be the only path yet |

## Consequences

- Each plugin pins the product version it was tested with, and the install section names that version.
- The plugin speaks the connector WebSocket protocol, so it shares the socket's rules: one socket per connection, replacement by close code `4001`, and `done` acknowledgement ([ADR 0029](0029-a-plugin-acknowledges-a-handoff-and-a-listener-does-not.md)).
- Python enters the toolchain for the Hermes plugin. It is reported by the doctor and never installed by it ([ADR 0004](0004-the-agent-repairs-its-own-machine-doctor-reports-never-installs.md)).

## Evidence

- Proof of concept of 2026-11-05 and 2026-11-06 in Docker, with a fake model: an OpenClaw channel plugin and a Hermes platform adapter each delivered an owner message to the agent and sent a reply through the MCP route. A real model was not run.
- Product documentation and source, read on 2026-11-06 (see the spec's research table).

## Revisit when

- The owner-run real-model checks V3-OC and V3-HM are recorded; this ADR moves to `Accepted` only after them.
- OR-13 or OR-14 fails, which changes the fallback described in decision 3.
- Either product removes or changes its channel plugin API.
