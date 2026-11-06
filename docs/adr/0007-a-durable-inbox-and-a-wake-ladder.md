# 0007. A durable inbox and a wake ladder

- Status: Accepted
- Date: 2026-11-06
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: the client probes of 2026-11-04 to 2026-11-06. Per-call caps: Grok web 60 s, claude.ai ~240 s with self-retries, ChatGPT 299.5 s, Codex 300 s (900 s configurable), Claude Code unlimited. Waking measured on Claude Code (~7 s), Codex (~6 s), Grok Bot webhook (~9 s), a claude.ai scheduled task with an API trigger (~16 s), ChatGPT and claude.ai scheduled tasks (1 h minimum).

## Context

An agent can always call zapbip. The owner can only reach an agent that is listening. No client declares MCP Tasks, and holding a call open is capped differently by every client. The wake paths that exist differ by client:

- resuming a local session;
- a webhook;
- a scheduled task;
- nothing at all.

## Decision

1. **Every owner message lands first in a durable inbox per agent.** Agents pull from it with MCP tools: `ask`, `wait_for_reply`, `get_messages`, `check_inbox`. A call never waits more than 50 s.
2. **zapbip wakes the agent through the highest rung its connection supports:**
   1. local connector;
   2. webhook;
   3. scheduled task calling `check_inbox`;
   4. an optional standby agent of the same provider;
   5. the inbox alone, with a notice to the owner that the message waits.
3. **The wake mode belongs to the connection.** An install prompt per client sets up the highest rung available.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Inbox and wake ladder (chosen) | two-way where the client allows it; every client still works through the inbox | one adapter per rung; the install prompt grows per client | — |
| MCP only, the agent pulls | the simplest | the owner can never start a conversation | fails the product's core promise |
| Plugins first (OpenClaw, Hermes) | native channels | a small audience; two plugins to maintain | later phase |

## Consequences

- Each rung is an `AgentWaker` adapter ([ADR 0008](0008-a-pure-core-behind-ports.md)), shipped in its own feature.
- A scheduled task wakes the agent even when nothing is new. `check_inbox` must answer "empty" at once and cheaply.
- A standby or scheduled run answers in a separate conversation from the one the owner started. The history kept by zapbip keeps the WhatsApp side continuous.

## Evidence

- Claude Code (`claude -p --resume`) answered in ~7 s.
- Codex (`codex exec resume`) answered in ~6 s.
- The Grok Bot routine webhook answered in ~9 s.
- A claude.ai scheduled task with an API trigger answered in ~16 s, using the connector without an approval prompt.
- ChatGPT and claude.ai scheduled tasks ran unattended, with a 1 h minimum interval. ChatGPT's cloud tasks need the Plus plan.

## Revisit when

- A client declares MCP Tasks or another server-initiated wake.
- A client lowers its scheduled-task minimum below 1 h, or adds an API trigger.
