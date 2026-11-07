# Hermes and OpenClaw

**Status:** Building
**Tier:** 🟡
**Owner approval:** owner order 2026-11-06 ("foi isso que combinamos": every supported agent can start conversations and has no response-time limit); scope and rung delegated 2026-11-06
**ADRs:** [0028](../../adr/0028-the-native-channel-plugin-is-the-first-rung-for-openclaw-and-hermes.md) and [0029](../../adr/0029-a-plugin-acknowledges-a-handoff-and-a-listener-does-not.md), both `Proposed` in plan step 1, `Accepted` after the owner-run records (plan, Owner-run).
**Not changing:** the install page structure of `install-skills` (its sections are added there); the MCP tools; the wake ladder of ADR 0007; the connector of `local-connector`.

## Problem

Hermes and OpenClaw are supported agents, so the owner must message them from WhatsApp and have them answer with no response-time limit. Neither has a hosted routine like Grok Bot. Both have a native plugin system for chat channels, which can hold a conversation open, so the install should use it. Where it cannot be installed, the agent polls.

## Goals

1. An install page for Hermes (`agents/hermes`) and one for OpenClaw (`agents/openclaw`), in both locales, each with its own install commands, listening explanation, troubleshooting table and self-test.
2. Rung 1 (local) through the zapbip channel plugin of each product: a persistent connection to the zapbip connector that hands owner messages to the agent. Rung 3 (scheduled) as the fallback: a job every minute that calls `check_inbox`.
3. The listen rule of every client: while `ask` or `wait_for_reply` returns pending, the agent calls again until answered.

## Non-goals

- A plugin for any other product. Claude Code, Codex, Grok Bot, the web chats and Grok web keep their rungs from `install-skills`.
- Any change to the MCP tools or the wake ladder.
- Publishing the plugins to a registry. The install section uses the plugin package named in the section (`(verify)` the publish path).

## Listen modes (revised 2026-11-06, orchestrator)

- **OpenClaw:** MCP through `mcp.servers.zapbip` with `transport: "streamable-http"`. Listen by a `stream` job on `npx zapbip listen`, created by the agent with its automations tool, or an `every 1m` job calling `check_inbox`. The native channel plugin is the better option (rung 1).
- **Hermes:** MCP through `mcp_servers.zapbip` with `url` and `headers`. Listen by `terminal(background=true, watch_patterns=…)` on `npx zapbip listen`, or a `cronjob_manage` job every 1 minute calling `check_inbox`. The platform plugin (`BasePlatformAdapter`) is the better option (rung 1).
- The listen process stays long-lived (`local-connector` LN7), so a short-run watcher does not hit OpenClaw's error after five short runs.

### Unconfirmed items (verify, each with an owner-run or E2E check)

| Item | Check |
|---|---|
| OpenClaw `stream` watcher restarts after a Gateway restart (verify) | OR-13 owner-run; the E2E uses a simulated restart |
| Hermes `watch_patterns` fires in a session with no delivery target (verify) | OR-14 owner-run |
| Monitor idle token cost, Claude Code (verify) | OR-15 owner-run; figures in the PR |

## Research findings (2026-11-06)

Source: `SCRATCH/feature-stash/research-hermes-openclaw.md`. Tags: [doc] official docs read; [src] Hermes source read; [poc] run in the POC with a fake model, not a real model.

| Capability | OpenClaw | Hermes |
|---|---|---|
| Remote MCP by URL with a header | yes [doc]: `mcp.servers.<name>` with `url`, `transport: "streamable-http"` (set it, or SSE is used), `headers` | yes [src]: `mcp_servers.<name>` with `url` and `headers` in `config.yaml` |
| Agent adds the MCP server from chat | (verify) | (verify) |
| Scheduler | yes [doc]: `every` (10m, 1h, 1d), `cron`, `stream`; the agent creates jobs with the `automations` tool or `/loop` | yes [src]: schedule strings, `cronjob_manage` tool for the agent; the gateway ticks every 60 s |
| Minimum interval | no minimum stated for `every` or `cron` [doc]; the default heartbeat is 30 min (verify a 1-minute job is accepted) | about 60 s, the gateway tick [src]; no formal minimum (verify) |
| Native channel plugin that holds input | yes [doc]: `createChatChannelPlugin` in `openclaw/plugin-sdk/channel-core`, inbound through `dispatchInboundDirectDm`; installed with `openclaw plugins install` | yes [src]: a platform adapter in `~/.hermes/plugins/`, subclassing `BasePlatformAdapter`, inbound through `handle_message`; enabled in `plugins.enabled` |
| Plugin run | [poc] zapbip SSE channel worked in Docker with a fake model | [poc] SSE to `handle_message` worked with a fake model |
| Background process wakes the agent | `tools.exec.notifyOnExit` on exit; a `stream` job starts on stdout lines (mid-run); a `stream` watcher that restarts after a Gateway restart is (verify) | `terminal(background=true, watch_patterns=…)` wakes mid-run (verify in a gateway session with no delivery target) |

## Design

### Rungs

| Product | Rung 1 (local): channel plugin | Rung 3 (scheduled): fallback |
|---|---|---|
| Hermes | `pip install zapbip-platform==0.1.0`, enable it in `plugins.enabled`, set its connection URL; `set_wake({mode: "local"})` | add the MCP server; create a job `every 1m` that calls `check_inbox`; `set_wake({mode: "scheduled", interval_minutes: 1})` |
| OpenClaw | `openclaw plugins install @zapbip/openclaw-plugin@0.1.0`, set `channels.zapbip` with the connection URL; `set_wake({mode: "local"})` | add the MCP server with `transport: "streamable-http"`; create a job that calls `check_inbox` every minute (`every` with the 1-minute interval); `set_wake({mode: "scheduled", interval_minutes: 1})` |

The section tries rung 1 first. If the product refuses the plugin, or the plugin cannot connect, the section falls back to rung 3 and tells the owner which rung is in use. Both sections name only their own product, and each ends with the self-test. Self-test: a `send_message` from the chat (the plugin path sends it through the plugin's outbound, the fallback through MCP).

The fallback (rung 3) has two parts, decided 2026-11-06 (see the answers table): the every-minute job calling `check_inbox` is the guarantee; the `zapbip listen` watcher (OpenClaw `stream` job, Hermes `terminal(background=true, watch_patterns=…)`) starts a turn mid-run when a line prints. The watcher is kept only if OR-13 and OR-14 pass. The fallback is set with `set_wake({mode: "scheduled", interval_minutes: 1})` only after the plugin has failed to attach; `set_wake({mode: "local"})` is never left in place without a socket.

### Why the plugin is the first choice

The owner's order says the skill uses the native channel plugin where the product has one. Both products do, and both POCs delivered a message through the plugin path. A plugin keeps the conversation open; a poll adds up to one minute of delay and one model call per poll (a poll that finds nothing still costs a turn unless the product skips it; OpenClaw skips the final answer when a check returns `NO_REPLY` [doc]).

### Listen rule

Every client keeps waiting through the tool: `ask` and `wait_for_reply` return `pending` within the per-call cap, and the agent calls them again until the owner answers. This is the sixth line of `AGENT_RULES` in `install-skills`.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|---|---|---|---|
| Are Hermes and OpenClaw in scope now? | later feature · now | now: the pages `agents/hermes` and `agents/openclaw` (en and pt-br); this spec for what is beyond them | owner order 2026-11-06 |
| Default rung | poll every minute · channel plugin | the channel plugin first (rung 1), the every-minute job as fallback (rung 3). The owner's order names the plugin where the product has one; the research confirms both products have one | owner delegated 2026-11-06 |
| Write a zapbip channel plugin? | yes · no | yes, one plugin per product, in the product's own plugin system; no change to the product's core | owner delegated 2026-11-06 (reverses the first draft of this spec) |
| Minimum poll interval | 1 minute · longer | 1 minute, subject to `(verify)` for each product | owner delegated 2026-11-06 |
| Real-model confirmation | before build · at build | at build: a real-model run of each plugin is the gate for its rung, recorded in the PR; the POCs used a fake model | owner delegated 2026-11-06 |
| Wire protocol of the plugins | the POC's SSE endpoints · the connector WebSocket | the connector WebSocket (`/c/<secret>/connector`, frames `hello`, `messages`, `done`, `ping`); the POC's `/agents/*` endpoints do not exist in zapbip | owner delegated 2026-11-06 |
| Outbound from the plugin | an MCP client SDK per language · raw JSON-RPC to `send_message` | raw JSON-RPC (`initialize`, `notifications/initialized`, `tools/call`) on the connection's MCP URL; no new runtime dependency | owner delegated 2026-11-06 |
| Acknowledgement by the plugin | notifier, no `done` (first draft) · `done` after the agent accepts the handoff | `done` after the handoff; a notifier would re-send every unread message on each reconnect; `listen` keeps the notifier rule | owner delegated 2026-11-06 (reverses the first draft) |
| Scheduled interval floor for the fallback | keep 60 minutes · 1 minute | 1 minute in `scheduled-wake` (`SCHEDULED_MIN_INTERVAL_MINUTES`, a change to its row 22); cloud clients keep 60 through their own install prompts; needs the `scheduled-wake` owner's agreement | owner delegated 2026-11-06 |
| Fallback shape | cron only · cron plus `listen` watcher | cron `check_inbox` every minute, plus the `listen` watcher where OR-13 and OR-14 pass | owner delegated 2026-11-06 |
| Language of each plugin | one language · the product's own | OpenClaw in TypeScript (its plugin SDK), Hermes in Python (its platform API); Python adds a toolchain to the harness (plan, toolchain impact) | owner delegated 2026-11-06 |
| Versions under test | latest · the POC's versions | OpenClaw `2026.10.10` and Hermes image `v0.22.7`, as in the POC; PyPI `hermes-agent` `0.19.0` is a different build and the install path stays `(verify)` | owner delegated 2026-11-06 |
| Connector socket conflict | refused second plugin (first draft) · replaced with `4001` | replaced, as `local-connector` specifies; the older plugin stops without retrying | owner delegated 2026-11-06 (corrects risk 3) |
| `set_wake({mode: "local"})` from the install | call it before the attach · rely on the attach | the attach saves `local` and restores the previous mode on close; the install calls nothing before the socket attaches, and the fallback never leaves `local` without a socket | owner delegated 2026-11-06 |
| Names of the packages | — | npm `@zapbip/openclaw-plugin`, PyPI `zapbip-platform`; free on 2026-11-06; claimed at publish, outside this slice | owner delegated 2026-11-06 |

## Build lanes (after this spec is approved for build)

| Lane | Work |
|---|---|
| H1 | Hermes platform plugin (`zapbip-platform`): SSE to the connector, `handle_message`, outbound `send`; tests with a fake connector |
| O1 | OpenClaw channel plugin (`zapbip` channel): `createChatChannelPlugin`, SSE to `dispatchInboundDirectDm`, outbound; tests with a fake connector |
| X1 | The connector side: the `local` wake for these products uses the `local-connector` socket (`local-connector` delta owns the listen command; the plugins are a second client of the same socket) |
| V1 | Verification: the `(verify)` items above, one real-model run per product, recorded |

## Test strategy summary

- Plugins: unit tests against a fake connector socket, per product; the plugin sends `done` only after the agent accepts a handoff (decision D3 in `plan.md`; `zapbip listen` stays a notifier that never sends `done`).
- Install pages: `tools/repository-shape` `docs-agent-install` asserts the verified install commands, the configuration keys, the self-test text and the lost-reply event per locale; `mint broken-links` checks the links.
- Scheduled fallback: `set_wake({mode: "scheduled", interval_minutes: 1})` accepted once scheduled-wake merges.
- Owner-run: one real install per product with a real model, recorded in the PR; outside `pnpm verify`.

## Risks

1. The plugin API changes between product versions. Each plugin pins the version the research checked, and the section names it.
2. The product refuses a 1-minute job. Then the section reports the minimum and sets the interval to it.
3. A plugin keeps a socket open per agent. The connector allows one socket per connection (`local-connector`): a new attach closes the older one with `4001`, and the older plugin stops without retrying. A second plugin on the same connection therefore replaces the first; it is never refused.
4. `watch_patterns` and OpenClaw's `stream` need a session with a delivery target. Not used by the design; they are noted for a later rung.
