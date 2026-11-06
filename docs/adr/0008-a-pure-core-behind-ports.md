# 0008. A pure core behind ports

- Status: Accepted
- Date: 2026-11-06
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: the owner's request for dependency inversion; [ADR 0007](0007-a-durable-inbox-and-a-wake-ladder.md), whose wake rungs, channels and hosting arrive one feature at a time

## Context

The channel will change from a fake to the WhatsApp Cloud API, the wake rungs arrive one by one, and the hosting may move off Cloudflare if its free tier tightens. The rules that matter must not change when those pieces do. Those rules are:

- routing;
- the 24-hour window;
- `ask` idempotency;
- answers bound to a question;
- validation.

## Decision

1. `libs/core` holds the domain, the use cases and the ports, in plain TypeScript with no runtime dependency, no network and no storage.
2. Ports:
   - `InboxRepository`
   - `MessageSender`
   - `MediaStore`
   - `AgentWaker`
   - `ConnectionDirectory`
   - `Clock`
   - `IdGenerator`
   - `ReplyWaiters`

   Eight ports in all. `Clock` also provides `schedule` for timers. (Amended 2026-11-06 by agent-inbox-core: `IdGenerator` and `ReplyWaiters` were added; the spec's decision row "Ports beyond the six" records it.)
3. Adapters live in the app that runs them (`apps/api/src/adapters`) and are wired at the edge. A new client, channel or store is a new adapter, registered in a record keyed by its kind.
4. Core tests use in-memory adapters and a fake clock.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Pure core behind ports (chosen) | rules testable without network; adapters swap without touching rules | an extra layer to wire | — |
| One service calling Cloudflare and Meta directly | less code at first | rules entangled with the platform; tests need the runtime; moving host rewrites the rules | the pieces change feature by feature |

## Consequences

- Every feature after `agent-inbox-core` adds adapters and leaves the core's rules alone, unless its spec says otherwise.
- Hosting is replaceable by writing `InboxRepository` and `AgentWaker` adapters for the new platform.

## Evidence

- The probes changed channel, client and wake mechanism many times. The rules stayed the same.

## Revisit when

- An adapter needs a rule the core cannot express without knowing the platform.
