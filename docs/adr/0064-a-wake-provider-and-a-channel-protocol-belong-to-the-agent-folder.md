# 0064. A wake provider and a channel protocol belong to the agent folder

- Status: Accepted
- Date: 2026-11-14
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: [ADR 0033](0033-one-folder-per-supported-agent.md), whose one-or-two-folders promise two leaks broke; [ADR 0019](0019-outbound-wake-targets-pinned-providers-and-guarded-generic-hosts.md); the owner's words of 2026-11-14: adding, changing or removing a supported agent must touch at most one or two folders, and details of different agents leaked into several apps and libraries

## Context

ADR 0033 moved every agent fact into `libs/agents/supported/<id>/`, but the spec left two kinds out: the pinned wake providers (a host, a path pattern and the headers of a routine webhook, held in `libs/core`, `libs/types` and `apps/api`) and the Claude Code channel protocol (`claude/channel`, held in `libs/types` and read by `apps/connector`). Adding a hosted agent with a routine webhook meant editing four packages, and the leak scan did not see it because it knew no host or protocol literal.

## Decision

1. `wake.ts` is a facet of an agent folder. It exports `wakeTarget`: the stored provider id, the host, an example URL, the path pattern and the header builder. `pnpm agents:generate` writes `libs/agents/src/generated/wake.ts` (`WAKE_TARGETS`) and the `WakeAgent` enum.
2. `libs/core` knows no provider. `PinnedWakeProviderRule` is a type; `WakeDependencies.pinnedProviders` carries the rules, `assertWakeTarget` and the wake use cases read them from there, and `libs/types` keeps only `GENERIC_WAKE_PROVIDER` and the `WakeProviderId` string. The Worker passes `Object.values(WAKE_TARGETS)`.
3. `channel.ts` is a facet too. It exports `channelProtocol` (the capability and the notification method). `apps/connector` takes the only protocol the registry declares and refuses zero or several, so a second channel agent forces a `--client` choice instead of a silent pick.
4. The leak scan now carries each agent's wake host and provider id and its channel capability and method as literals: naming one outside the agent's folder fails `pnpm agents:check`.
5. Core and Worker tests use neutral providers or `Object.values(WAKE_TARGETS)` with the example URL, never an agent's host.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Keep providers in `libs/core` as a security allowlist | One reviewed file | Adding an agent edits four packages | The owner asked for one or two folders |
| A generated enum of provider ids in `libs/types` | Type-checked ids | `libs/types` would name every agent's provider | The stored value is data; a string id is enough |
| One channel facet per client with a flag from day one | Ready for a second agent | A flag nobody can use today | The refusal makes the second agent a visible decision |

## Consequences

A wake provider is still a security decision: the facet's host and path pattern are reviewed like code in the agent's folder, and the generic webhook path keeps its own guard. Prose in the documentation that explains how to wake a given agent still names it; making those pages generated is separate work.

## Evidence

`wake.test.ts` of each agent folder, `leak-scan.test.ts` (wake and channel literals), `channel-protocol.test.ts`, the core wake suites on neutral providers, `fetch-wake-transport.test.ts`, and `pnpm agents:check`.

## Revisit when

A second agent exposes a channel protocol, or the documentation pages are generated from the registry.
