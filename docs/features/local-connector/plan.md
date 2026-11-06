# Local connector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `npx zapbip connect` keeps one hibernatable WebSocket per connection open and resumes the owner's local Claude Code or Codex session for each owner message, with a one-time new-session fallback when the Codex app holds the thread. The connection's wake setting is `local` while a connector is attached and the previous setting returns when the last connector closes.

**Architecture:** `AccountInbox` (Durable Object) accepts the connector socket with the hibernation API, tags it with the agent name, answers `ping` with an auto-response, pushes `messages` frames through a `LocalConnectorWaker` on the `Local` rung, marks messages read on `done`, and saves and restores the wake setting through webhook-wake's `WakeRepository`. The connector is a Node 24 program with zero runtime dependencies, bundled by esbuild into `dist/cli.js`. It probes the link over HTTPS, keeps one wake running at a time per connection, spawns `claude` or `codex` with no shell and with a restricted tool list, and never logs message text, the secret or child output.

**Tech Stack:** Node 24 (global `fetch`, `WebSocket`, `node:child_process`, `node:readline`), TypeScript 7.0.2, esbuild 0.28.2 (bundle only), `ws` 8.22.1 and `@types/ws` 8.18.2 (test fake server only), `@types/node` 24.19.2, `@zapbip/core` and `@zapbip/types` (`workspace:*`, devDependencies because esbuild bundles them), Vitest 5.0.5 (`apps/connector`), Vitest 5.0.5 (`libs/core`), Vitest 4.1.12 with `@cloudflare/vitest-pool-workers` 0.23.0 (`apps/api`), Hono 4.13.16, Drizzle ORM 0.45.4, Mintlify CLI `mint` 4.2.1207.

**Spec:** `docs/features/local-connector/spec.md`. Step L0 adds the decisions of this plan to its "Open questions → answers" table, `owner delegated 2026-11-06`.

**Tier:** 🔴

**Depends on:**
- `agent-inbox-core` (this branch is based on `feat/agent-inbox-core`; checked at S0.0): `libs/types` (`enums.ts`, `constants.ts`, `index.ts`), `libs/core/src/inbox/**` (`ports.ts`, `message.ts`, `connection.ts`, `use-cases/**`, `testing/in-memory.ts`, `index.ts`), the Durable Object `AccountInbox`, `apps/api/src/mcp/resolve-connection.ts` and `routes/account-inbox-stub.ts` (the connection resolution used by `/c/:secret/mcp`), `apps/api/wrangler.jsonc`, `contract/env.ts`, `app.ts`, `index.ts`, `index.dev.ts`, and the `agent_wake` table of `migrations/v1.sql`.
- `webhook-wake` (`origin/feat/webhook-wake`, Step 0 contract read at S0.0, **not merged yet**): `libs/core/src/wake/**` (`wake-ports.ts` with `WakeRepository` and `WakeContext`, `wake-setting.ts` with `StoredWake`), `libs/core/src/wake/testing/wake-doubles.ts` (`createInMemoryWakeRepository`, exported as `@zapbip/core/wake-testing`), `apps/api/src/adapters/sqlite/sqlite-wake-repository.ts` (`createSqliteWakeRepository`), `apps/api/src/adapters/wake/dispatching-agent-waker.ts` (`WakerByRung`, `createDispatchingAgentWaker`), `apps/api/src/contract/wake-rpc.ts`. Every item that needs one of these is marked `(contract: confirm at merge)` and lands only in Step L0b, after `feat/webhook-wake` is merged into this branch.

Cross-slice decisions (`SCRATCH/feature-stash/cross-slice-decisions.md`) bind this plan. Names that exist only on `feat/webhook-wake` are marked `(contract: confirm at merge)`; the rest were checked against this branch at S0.0.

## Global Constraints

- `HEARTBEAT_INTERVAL_MS` = `25_000`; `HEARTBEAT_TIMEOUT_MS` = `10_000`; `RECONNECT_BASE_MS` = `1_000`; `RECONNECT_MAX_MS` = `30_000`; `CONNECTOR_WAKE_TIMEOUT_MS` = `900_000`; `REPLACED_CLOSE_CODE` = `4001`. Reconnect delay is `min(RECONNECT_MAX_MS, RECONNECT_BASE_MS × 2^attempt)`.
- Wake argv, verbatim from the spec: Claude Code `claude -p --resume <sessionId> --allowedTools=mcp__zapbip__send_message <prompt>`; Codex `codex exec --skip-git-repo-check -s read-only -c mcp_servers.zapbip.default_tools_approval_mode="approve" -c mcp_servers.zapbip.enabled_tools=["send_message"] resume <sessionId> <prompt>`.
- The prompt is the last argument and starts with `<`. The session id matches `UUID_PATTERN` before it reaches argv.
- No `shell: true`. No secret, connection link or phone number in argv, logs or error text.
- Enums come from `@zapbip/types` (`WakeMode`, `WakeRung`, `AgentWakeReason`, `MessageKind`, `DeliveryState`, `ConnectorClient`, and the others of this slice). No string literal stands in for an enum.
- The connector has no runtime dependencies. `@zapbip/core` and `@zapbip/types` are devDependencies (`workspace:*`) because esbuild bundles `@zapbip/types` and `@zapbip/core` is type-only. `apps/connector/package.json` sets `"private": true` until `deploy-readiness` publishes.
- The E2E suite runs by default in the gate (local `wrangler dev`, fake client binaries, no third-party network). Only real-client cases (real Claude Code, real Codex, the Codex app) are owner-run and stay outside the gate.
- Repo rules (`AGENTS.md`): no comments except `// NB ADR NNNN:` pointers; flat `if`s; no `else`; no `??` defaults (optional parameters with defaults at the signature are the only allowed defaults); named parameters for any function with more than one parameter; constants over literals; no `.js` extension on relative imports; no acronym in an identifier (`connectionLink`, `signedLink`).
- Stub bodies are exactly `void input;` followed by `throw new Error('<name> is not implemented');`. Every adapter or class this slice changes gets its new methods stubbed in Step L0, so `pnpm typecheck` stays green at every commit.
- Red commit first: each behaviour step commits its failing test alone (plus the stub it needs). Contract steps carry no behaviour and are proven by `pnpm typecheck`.
- No `sleep` anywhere. Timing tests use a fake clock (connector) or `runDurableObjectAlarm` / `runInDurableObject` (Worker). The fake WebSocket server uses real sockets on `127.0.0.1` with ephemeral ports.
- Commits: Conventional Commits, en-US, `Co-Authored-By` trailer naming the model that wrote the commit. Never `git add -A`, `git add .`, `--no-verify`. Never commit on `main`.
- Each lane branches from the Step L0 commit and merges (never rebases) the lanes it depends on.

## Review Focus

1. A message re-sent after a reconnect, or delivered twice in one frame: its wake runs once per process lifetime, and its `done` is sent again when the server re-sends it (see Assumption A6). Owned by L1 (`wake-queue.test.ts`) and L2 (`connect.test.ts`, reconnect cases).
2. Owner text containing `</channel>`, a leading `-`, or a UUID-looking string: it stays inside the channel block and never becomes a flag. Owned by L1 (`owner-prompt.test.ts`, `wake-commands.test.ts`).
3. Two owner messages arriving together, or while a wake runs: wakes never overlap and run in arrival order. Owned by L1 (`wake-queue.test.ts`) and L2 (`connect.test.ts`, three-message case).
4. A second connector for the same connection starts: the older one exits with code 1 and does not reconnect, and the newer one keeps running. Closing the last connector restores the previous wake setting. Owned by L3 (`connector-socket.test.ts`, `local-connector.test.ts`) and L2 (`connect.test.ts`, replacement case).
5. A `done` frame naming another agent's message, an unknown id, a binary or oversized frame, or a `ping` reaching the object: no state changes and no wake starts. Owned by L4 (`acknowledge-delivery.test.ts`), L2 (`connect.test.ts`, frame limits) and L3 (`connector-socket.test.ts`, auto-response case).

## Assumptions (decided, owner can override; `owner delegated 2026-11-06`)

- **A1 Hello frame.** The Durable Object sends `{type: ConnectorFrameType.Hello, agent, previousWakeMode}` first on every attach, before the inbox re-read. `connector_connected` is logged when `hello` arrives. The spec's frame table gains this row (recorded in L0).
- **A2 Wake persistence (cross-slice decision).** This slice adds no port method to `InboxRepository`. Wake persistence goes through webhook-wake's `WakeRepository`: the attach saves the connection's stored wake with `mode: WakeMode.Local` (`saveWake({wake})`), and the restore saves the remembered previous record. `StoredWake` is `{agent, mode, target, status, lastDeliveredAt}` with no `updatedAt`, and this slice does not add one; scheduled-wake's `WakeSetting` owns that field. The restore record is one `local_restore TEXT` column on `agent_wake` (JSON of the previous `StoredWake`, whose target is already sealed), added by Durable Object schema `v5`; `saveWake` writes only the wake columns, so it never touches `local_restore`. `(contract: confirm at merge)`: shapes read from `origin/feat/webhook-wake` Step 0.
- **A3 Restore on last close.** Attach remembers the connection's previous stored wake in `WakeRepository` (`saveLocalRestore`) only when no restore is stored yet, so a second attach never overwrites the true previous setting. Detach runs when the Durable Object reports a closed connector socket. If sockets remain for the agent, nothing changes. If none remain, the stored restore is saved back and cleared, but only when the current mode is still `WakeMode.Local`. A user who changed the setting meanwhile keeps their change, and the restore is cleared.
- **A4 Outcomes.** `Answered` is exit code 0 of the wake process. `Failed` is any other exit, a spawn error, or a timeout. The new-session fallback reports `FallbackNewThread` when it exits 0 and `Failed` otherwise. `Answered` does not prove that `send_message` ran.
- **A5 Done scope.** `acknowledgeDelivery` marks a message read only when the message exists and belongs to the given agent and is an owner message (`MessageDirection.FromOwner`). Any other case returns without effect and without an error.
- **A6 Acknowledged ids and reconnect.** The connector keeps `acknowledgedIds` (a `Set<string>`) for the process lifetime. The reconnect expectation, exact:
  - a message is woken at most once per process lifetime;
  - a message whose wake is still running when the socket drops is not enqueued again when the server re-sends it; its `done` is sent when the wake ends, on the current socket if one is open;
  - a message whose `done` was not delivered (socket down when the wake ended) is re-sent by the server on the next connect, and the connector answers that re-send with `done` again, with no wake;
  - a process restart clears the set, so an unacknowledged message is woken again by the new process, which is the at-least-once rule of the spec.
- **A7 Limits.** `CONNECTOR_INBOX_LIMIT` = `50` (unread messages sent per attach or per notify). `SESSION_LOOKUP_LIMIT` = `200` (files read per lookup). `CONNECTOR_FRAME_MAX_BYTES` = `65_536` (larger text frames are rejected). All in `libs/types/src/connector.ts`.
- **A8 Frame types.** `ConnectorFrameType` and the ping and pong texts (`CONNECTOR_PING_TEXT`, `CONNECTOR_PONG_TEXT`, built with `JSON.stringify` from the enum) live in `libs/types`, so the Durable Object's auto-response and the connector send identical bytes. The frame object types carry core `Message`, so they live in `libs/core/src/inbox/connector-frames.ts`. The connector imports them type-only.
- **A9 Agent name in the socket.** The Worker resolves the connection and calls the object with `https://account-inbox/connector?agent=<encoded agent>`. The object reads the agent from that URL only. The client never supplies it.
- **A10 Connection link and pre-flight.** `ZAPBIP_CONNECTION_URL` or a terminal prompt. The link must end with `MCP_PATH_SUFFIX`. The socket link replaces that suffix with `/connector` and `https:` with `wss:`. The probe link is the same URL over `https:`. Before opening the socket, the connector sends a `GET` to the probe link without `Upgrade` (`redirect: 'error'`):
  - `401`: the secret is unknown or revoked; the connector exits 1;
  - `426`: the secret is valid; the connector continues;
  - any other status, or a network error: the connector exits 1 with a message that names the status and never the link.
- **A11 Prompt text by kind.** Text: its text. Media: the kind label, then the caption on a second line when the caption is present (an explicit branch on `null`). Choice: the title of its `selected` option, or the kind label when `selected` is `null` (explicit branch). Reaction: its `emoji`, or the kind label when it is `null` (explicit branch). Location and Contacts: the kind label only. The kinds an owner message can have are the `MessageKind` values; there is no Question kind. Dispatch is a record keyed by `MessageKind`.
- **A12 Session lookup.** Claude Code: the project folder of `--cwd` under the Claude config directory, with the name rule `[^A-Za-z0-9]` → `-`; the newest `*.jsonl` by mtime. Codex: rollout files under `CODEX_HOME`, newest directories first, the first line's `session_meta.cwd` equal to `--cwd`. Both config directories are optional parameters with the defaults from the spec.
- **A13 Package.** npm `zapbip` returned 404 on 2026-11-06, so the name is free. The bin is `dist/cli.js` with a `#!/usr/bin/env node` banner added by esbuild. `files` is `["dist"]`.
- **A14 Test runners and gates.** `apps/connector` has three named Vitest configs: `vitest.config.mts` (unit and fake-server integration, gate `unit`), `vitest.e2e.config.mts` (gate `e2e`, runs by default), `vitest.packaging.config.mts` (packaging). `pretest:e2e` and `pretest:packaging` run the build, so no test runs against a stale bundle. `scripts/verify-gates.tsv` gets a row `apps/connector/*  product  typecheck unit e2e` above `apps/*`, so connector changes run the E2E gate; the fake-server integration tests run inside `test:unit`, because the `integration` gate runs only the API package. `scripts/verify.sh` `gate_e2e` runs `pnpm --filter zapbip test:e2e` and `pnpm --filter zapbip test:packaging` next to the API suite.
- **A15 Fake clients.** Tests put `claude` and `codex` Node scripts first on `PATH`. They record argv and timestamps as JSON lines to a file named by an environment variable. They never touch a real session or network.
- **A16 Waker record.** `WakerByRung` (webhook-wake) gains `WakeRung.Local`. This is a one-line type edit plus one record entry in `apps/api/src/adapters/wake/dispatching-agent-waker.ts` (today `Record<WakeRung.Webhook | WakeRung.Inbox, AgentWaker>` on `feat/webhook-wake`), made by L3b after webhook-wake has merged. `wakeRungFor({mode})` (webhook-wake's `libs/core/src/wake/wake-rung.ts`) must map `WakeMode.Local` to `WakeRung.Local`: L4b adds that case and its test after the merge `(contract: confirm at merge)`.

## Core contract additions

For the orchestrator to merge into `core-contract-additions.md`. Every row is additive.

| # | Slice | Addition | Kind | Lives in | Rule note |
|---|---|---|---|---|---|
| 19 | local-connector | `acknowledgeDelivery({dependencies, agent, messageId})` | use case | `libs/core/src/inbox/use-cases/acknowledge-delivery.ts` | marks the message read; the `done` frame; replaces the row's `acknowledgeDelivery` location |
| 20 | local-connector | `LocalConnectorWaker` (`createLocalConnectorWaker`), registered for `WakeRung.Local` | adapter | `apps/api/src/adapters/wake/local-connector-waker.ts` | a live MCP waiter still wins (core routing) |
| 21 | local-connector | `ConnectorClient`, `ConnectorFrameType`, `ConnectorWakeOutcome`, `ConnectorSessionSource`, `ConnectorLogEvent` enums; connector constants | enums, constants | `libs/types/src/connector.ts` (new file) | connector-only values |
| 29 | local-connector | `WakeMode.Local = 'local'` and `WakeRung.Local = 'local'`, if absent (checked in L0) | enum values | `libs/types/src/enums.ts` | webhook-wake and scheduled-wake use the same values |
| 30 | local-connector | `WakeRepository.findLocalRestore({agent})`, `saveLocalRestore({agent, previous})`, `deleteLocalRestore({agent})` | port methods | `libs/core/src/wake/wake-ports.ts` | the restore record of A3; stubs in `createSqliteWakeRepository` and `createInMemoryWakeRepository` `(contract: confirm at merge)` |
| 31 | local-connector | `attachLocalConnector({...WakeContext, agent, limit})`, `detachLocalConnector({...WakeContext, agent, remainingSockets})` | use cases | `libs/core/src/wake/local-connector.ts` | the wake setting saves `Local` and restores on last close |
| 32 | local-connector | connector frame types `HelloFrame`, `MessagesFrame`, `DoneFrame`, `ServerFrame` | types | `libs/core/src/inbox/connector-frames.ts` | A1 and A8 |

Not additions: `InboxRepository.saveWakeSetting` and `findWakeMode` (the earlier plan's A2) are dropped. `scheduled-wake` row 26 needs no change from this slice.

## File map (lanes)

| Lane | Developer sub-agent | Owned paths |
|------|---------------------|-------------|
| L0a Contract (serial, first, no webhook-wake dependency) | `developer-0` | `libs/types/src/connector.ts` (new), `libs/types/src/enums.ts` (`WakeMode.Local`, `WakeRung.Local`: absent today), `libs/types/src/index.ts` (one line), `libs/core/src/inbox/connector-frames.ts` (new), `libs/core/src/inbox/index.ts` (one export line for the frames and one for the use case), `libs/core/src/inbox/use-cases/acknowledge-delivery.ts` (stub), `apps/api/src/account-inbox/connector-sockets.ts` (stubs), `apps/api/src/adapters/wake/local-connector-waker.ts` (stub), `apps/connector/{package.json,tsconfig.json,vitest.config.mts,vitest.e2e.config.mts,vitest.packaging.config.mts,README.md}`, `apps/connector/src/*.ts` (stubs for every module in the contract), `docs/features/local-connector/spec.md` (answers table rows and the frame row), `pnpm-lock.yaml` |
| L0b Wake-side contract (serial, after `feat/webhook-wake` is merged into this branch) | `developer-0` | `libs/core/src/wake/wake-ports.ts` (three methods), `libs/core/src/wake/local-connector.ts` (new, stubs), `libs/core/src/wake/index.ts` (one export line), `libs/core/src/wake/testing/wake-doubles.ts` (stubs of the three methods inside `createInMemoryWakeRepository`), `apps/api/src/adapters/sqlite/sqlite-wake-repository.ts` (stubs inside `createSqliteWakeRepository`), `apps/api/src/adapters/wake/dispatching-agent-waker.ts` (`WakeRung.Local` in the type) |
| L1 Connector pure modules | `developer-1` | `apps/connector/src/{owner-prompt,wake-commands,session-lookup,wake-queue,log}.ts`, `apps/connector/test/unit/{owner-prompt,wake-commands,session-lookup,wake-queue,log}.test.ts`, `apps/connector/test/fixtures/claude-folder/**` (names and mtimes copied from a real install, no content) |
| L2 Connector loop, process and CLI | `developer-2` | `apps/connector/src/{connect,wake-runner,cli}.ts`, `apps/connector/test/unit/{connect,cli}.test.ts`, `apps/connector/test/integration/{connect,wake-runner,cli}.test.ts`, `apps/connector/test/support/{fake-event-server,fake-client-binary}.ts`, `apps/connector/test/fixtures/bin/{claude,codex}` |
| L3a Sockets and waker (no webhook-wake dependency) | `developer-3` | `apps/api/src/account-inbox/connector-sockets.ts` (bodies), `apps/api/src/adapters/wake/local-connector-waker.ts` (bodies), `apps/api/test/unit/local-connector-waker.test.ts` |
| L3b Route, object and restore record (after the webhook-wake merge and L4b) | `developer-3` | `apps/api/src/routes/connector.ts` (new), `apps/api/src/routes/http-status.ts` (`UpgradeRequired = 426`), `apps/api/src/app.ts` (one route line), `apps/api/src/account-inbox/account-inbox.ts` (`fetch`, `webSocketMessage`, `webSocketClose`, the `WakeRung.Local` waker registration `(contract: confirm at merge)`), `apps/api/src/account-inbox/migrations/{v5.sql,index.ts}` (`ALTER TABLE agent_wake ADD COLUMN local_restore TEXT`, one entry), `apps/api/src/adapters/sqlite/sqlite-wake-repository.ts` (the three restore method bodies; webhook-wake's file), `apps/api/src/adapters/wake/dispatching-agent-waker.ts` (one `WakeRung.Local` record entry, A16), `apps/api/test/integration/{connector-route,connector-socket,connector-wake-setting}.test.ts` |
| L4a Core: acknowledge | `developer-4` | `libs/core/src/inbox/use-cases/acknowledge-delivery.ts` (body), `libs/core/src/inbox/use-cases/acknowledge-delivery.test.ts` |
| L4b Core: wake setting (after the webhook-wake merge and L0b) | `developer-4` | `libs/core/src/wake/local-connector.ts` (bodies), `libs/core/src/wake/local-connector.test.ts`, `libs/core/src/wake/wake-rung.ts` (the `WakeMode.Local` case and its test), `libs/core/src/wake/testing/wake-doubles.ts` (bodies of the three restore methods) |
| L5 Docs | `developer-5` | `apps/docs/guides/local-connector.mdx`, `apps/docs/guides/background-running.mdx`, `apps/docs/docs.json` (two page entries in the `Guides` group that `feat/webhook-wake` creates; until it merges, the group is created here and the merge keeps one) |
| L6 Shape and gates | `developer-6` | `scripts/verify-gates.tsv` (the connector row, above `apps/*`), `scripts/verify.sh` (`gate_e2e` adds the connector e2e and packaging suites), `scripts/verify.test.sh` (pins the row and the call), `AGENTS.md` (layout line for `apps/connector`), `tools/repository-shape/src/**` only where a test pins the package list |
| L7 E2E and packaging | `developer-7` | `apps/connector/test/e2e/{connector-wake.e2e.test.ts,support/stack.ts}`, `apps/connector/test/packaging/packaging.test.ts` |

Lane L0a and L0b own every shared file. A lane that needs one of them stops and asks the lead.

## Lane readiness (S0.0)

| Lane | Starts | Blocker |
|------|--------|---------|
| L0a | now | none |
| L1, L2 | after L0a | none; they use only slice 1 and the L0a frame types |
| L3a | after L0a | none; it uses slice 1's `AgentWaker`, `InboxRepository` and `DurableObjectState` |
| L4a | after L0a | none |
| L5 | after L0a | the `Guides` group in `docs.json` is shared with webhook-wake (additive merge) |
| L6 | after L0a | none |
| L7 packaging | after L2 | none |
| L0b, L4b, L3b | after `feat/webhook-wake` merges | `WakeRepository`, `StoredWake`, `WakeContext`, `createInMemoryWakeRepository`, `createSqliteWakeRepository`, `WakerByRung`, the Durable Object waker wiring |
| L7 end to end | after L3b | needs the socket route |

## Plan refresh (S0.0)

Each line struck through was wrong against the code; the line in the body is corrected.

| Was | Now | Reason |
|-----|-----|--------|
| ~~`libs/core/src/testing/in-memory.ts`~~ | `libs/core/src/inbox/testing/in-memory.ts` (`createInMemoryDependencies`) | slice 1 keeps test doubles beside the inbox |
| ~~`libs/core/src/testing/wake-doubles.ts`, `InMemoryWakeRepository`~~ | `libs/core/src/wake/testing/wake-doubles.ts`, `createInMemoryWakeRepository()`, imported as `@zapbip/core/wake-testing` | slice 4's Step 0 |
| ~~`DurableObjectWakeRepository` in `apps/api/src/account-inbox/wake-repository.ts`~~ | `createSqliteWakeRepository` in `apps/api/src/adapters/sqlite/sqlite-wake-repository.ts` | slice 4's Step 0 |
| ~~`apps/api/src/adapters/local-connector-waker.ts`~~ | `apps/api/src/adapters/wake/local-connector-waker.ts` | beside the other wakers |
| ~~`WakeReason`~~ | `AgentWakeReason` | slice 1's enum name |
| ~~`libs/core/src/connection`, `../connection`~~ | `libs/core/src/inbox/connection`, `../inbox/connection` | wake files live in `src/wake` |
| ~~Question kind, Choice `optionTitle`~~ | no Question kind; Choice uses `selected` | `MessageKind` has no Question; `Choice` carries `selected: QuestionOption | null` |
| ~~`libs/core/src/wake/local-connector.ts` and the port methods in Step L0~~ | Step L0b, after the webhook-wake merge | the files they extend are not on this branch |
| ~~`libs/core/src/index.ts` export line~~ | `libs/core/src/inbox/index.ts` for the frames and the use case; `libs/core/src/wake/index.ts` for the wake use cases | `src/index.ts` re-exports `./inbox` (and `./wake` on webhook-wake) |
| ~~`apps/docs/connect/*`~~ | `apps/docs/guides/*` | webhook-wake created the `Guides` group |
| ~~gate row `typecheck unit integration e2e`~~ | `typecheck unit e2e` | the `integration` gate runs only `@zapbip/api` |
| ~~`UNAUTHORIZED_STATUS` and `MCP_PATH_SUFFIX` may move to `libs/types/src/constants.ts`~~ | they stay in `connector.ts`; the Worker uses `HttpStatus.Unauthorized` and gains `HttpStatus.UpgradeRequired` | `libs/types` declares neither; the API already has `HttpStatus` |
| ~~development-only seed route~~ | `apps/api/scripts/dev-seed.ts --phone --agents --json --persist-to` after `wrangler d1 migrations apply`, as `apps/api/test/e2e/global-setup.ts` does | resolved `(contract: confirm at build)` |
| A5 only checked the agent | also requires `direction === MessageDirection.FromOwner` | a `done` must never mark an agent's own outbound row |
| ~~`MCP_PATH_SUFFIX = '/mcp'` only~~ | unchanged; the Worker's `CONNECTION_PATH_PREFIX` is `/c` | confirmed |

## Contract (Step L0, verbatim)

Step L0 lands these files first, on the feature branch, in one commit. Every lane builds against them.

### `libs/types/src/connector.ts`

```ts
export enum ConnectorClient {
  ClaudeCode = 'claude-code',
  Codex = 'codex',
}

export enum ConnectorFrameType {
  Hello = 'hello',
  Messages = 'messages',
  Done = 'done',
  Ping = 'ping',
  Pong = 'pong',
}

export enum ConnectorWakeOutcome {
  Answered = 'answered',
  Failed = 'failed',
  NoSession = 'no_session',
  FallbackNewThread = 'fallback_new_thread',
}

export enum ConnectorSessionSource {
  Pinned = 'pinned',
  Newest = 'newest',
}

export enum ConnectorLogEvent {
  ConnectorConnected = 'connector_connected',
  ConnectorReconnecting = 'connector_reconnecting',
  ConnectorClosed = 'connector_closed',
  ConnectorReplaced = 'connector_replaced',
  MessagesReceived = 'messages_received',
  WakeStarted = 'wake_started',
  WakeFinished = 'wake_finished',
  DoneSent = 'done_sent',
  FrameRejected = 'frame_rejected',
}

export enum FrameRejectionReason {
  BinaryFrame = 'binary_frame',
  FrameTooLarge = 'frame_too_large',
  Malformed = 'malformed',
  UnknownType = 'unknown_type',
}

export const HEARTBEAT_INTERVAL_MS = 25_000;
export const HEARTBEAT_TIMEOUT_MS = 10_000;
export const RECONNECT_BASE_MS = 1_000;
export const RECONNECT_MAX_MS = 30_000;
export const CONNECTOR_WAKE_TIMEOUT_MS = 900_000;
export const REPLACED_CLOSE_CODE = 4001;
export const UPGRADE_REQUIRED_STATUS = 426;
export const UNAUTHORIZED_STATUS = 401;
export const CONNECTOR_PATH_SUFFIX = '/connector';
export const CONNECTOR_PING_TEXT = JSON.stringify({ type: ConnectorFrameType.Ping });
export const CONNECTOR_PONG_TEXT = JSON.stringify({ type: ConnectorFrameType.Pong });
export const CONNECTOR_INBOX_LIMIT = 50;
export const CONNECTOR_FRAME_MAX_BYTES = 65_536;
export const SESSION_LOOKUP_LIMIT = 200;
export const WAKE_ALLOWED_TOOL = 'mcp__zapbip__send_message';
export const CODEX_ZAPBIP_SERVER_NAME = 'zapbip';
export const CODEX_ALLOWED_TOOL_NAME = 'send_message';
export const CODEX_APPROVAL_MODE = 'approve';
export const CODEX_ACTIVE_WRITER_MESSAGE = 'thread already has an active writer';
export const WAKE_INSTRUCTION = 'Reply to the owner with send_message, briefly, as one WhatsApp message.';
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MCP_PATH_SUFFIX = '/mcp';
```

`libs/types/src/constants.ts` declares neither `MCP_PATH_SUFFIX` nor `UNAUTHORIZED_STATUS`, so both stay in `connector.ts`.

`libs/types/src/enums.ts` (additive; both absent on this branch, `feat/webhook-wake` adds `Webhook` beside them, so the merge keeps both lines): `WakeMode.Local = 'local'`, `WakeRung.Local = 'local'`.

### `libs/core/src/inbox/connector-frames.ts`

```ts
import type { ConnectorFrameType, WakeMode } from '@zapbip/types';
import type { AgentName } from './connection';
import type { Message } from './message';

export type HelloFrame = {
  type: ConnectorFrameType.Hello;
  agent: AgentName;
  previousWakeMode: WakeMode;
};

export type MessagesFrame = {
  type: ConnectorFrameType.Messages;
  messages: Message[];
};

export type DoneFrame = {
  type: ConnectorFrameType.Done;
  messageId: string;
};

export type ServerFrame = HelloFrame | MessagesFrame;
```

### `libs/core/src/inbox/use-cases/acknowledge-delivery.ts`

```ts
import type { AgentName } from '../connection';
import type { CoreDependencies } from '../ports';

export type AcknowledgeDeliveryInput = {
  dependencies: CoreDependencies;
  agent: AgentName;
  messageId: string;
};

export async function acknowledgeDelivery(input: AcknowledgeDeliveryInput): Promise<void> {
  void input;
  throw new Error('acknowledgeDelivery is not implemented');
}
```

### `libs/core/src/wake/wake-ports.ts` (three methods added to `WakeRepository`; Step L0b, `(contract: confirm at merge)`)

```ts
findLocalRestore(input: { agent: AgentName }): Promise<StoredWake | null>;
saveLocalRestore(input: { agent: AgentName; previous: StoredWake }): Promise<void>;
deleteLocalRestore(input: { agent: AgentName }): Promise<void>;
```

### `libs/core/src/wake/local-connector.ts` (Step L0b, `(contract: confirm at merge)`)

```ts
import type { WakeMode } from '@zapbip/types';
import type { AgentName } from '../inbox/connection';
import type { Message } from '../inbox/message';
import type { WakeContext } from './wake-ports';

export type AttachLocalConnectorInput = WakeContext & {
  agent: AgentName;
  limit: number;
};

export type AttachLocalConnectorResult = {
  previousWakeMode: WakeMode;
  unread: Message[];
};

export type DetachLocalConnectorInput = WakeContext & {
  agent: AgentName;
  remainingSockets: number;
};

export async function attachLocalConnector(input: AttachLocalConnectorInput): Promise<AttachLocalConnectorResult> {
  void input;
  throw new Error('attachLocalConnector is not implemented');
}

export async function detachLocalConnector(input: DetachLocalConnectorInput): Promise<void> {
  void input;
  throw new Error('detachLocalConnector is not implemented');
}
```

`attachLocalConnector`: `wake.repository.findWake({agent})` (a `null` result throws), `findLocalRestore`, `saveLocalRestore` only when no restore is stored (A3), `saveWake` with the current record and `mode: WakeMode.Local`, then `dependencies.repository.listUnread({agent, limit})`. `detachLocalConnector`: returns when `remainingSockets > 0`; otherwise restores or clears per A3.

### `apps/connector/src/owner-prompt.ts`

```ts
import type { Message } from '@zapbip/core';

export function escapeChannelText(input: { text: string }): string;
export function ownerMessageText(input: { message: Message }): string;
export function buildOwnerPrompt(input: { message: Message }): string;
```

`buildOwnerPrompt` returns `<channel source="zapbip" sender="owner" verified="true">{escaped text}</channel>` followed by a newline and `WAKE_INSTRUCTION`.

### `apps/connector/src/wake-commands.ts`

```ts
import type { ConnectorClient } from '@zapbip/types';

export const CLIENT_BINARY_NAME: Record<ConnectorClient, string>;
export const RESUME_ARGUMENT_BUILDERS: Record<ConnectorClient, (input: { sessionId: string; prompt: string }) => string[]>;
export function buildCodexNewSessionArguments(input: { prompt: string }): string[];
export function isActiveWriterRefusal(input: { stderrText: string }): boolean;
```

`CLIENT_BINARY_NAME` is `claude` and `codex`. Claude's builder returns `['-p', '--resume', sessionId, '--allowedTools=mcp__zapbip__send_message', prompt]`. Codex's returns the safety flags, then `resume`, `sessionId`, `prompt`. `buildCodexNewSessionArguments` returns the same safety flags, then `prompt`.

### `apps/connector/src/session-lookup.ts`

```ts
import type { ConnectorClient } from '@zapbip/types';

export function claudeProjectFolderName(input: { workingDirectory: string }): string;
export async function findNewestSessionId(input: {
  client: ConnectorClient;
  workingDirectory: string;
  claudeConfigDirectory?: string;
  codexHome?: string;
}): Promise<string | null>;
```

### `apps/connector/src/wake-queue.ts`

```ts
import type { Message } from '@zapbip/core';

export function createWakeQueue(input: {
  runWake: (input: { message: Message }) => Promise<void>;
  sendDone: (input: { messageId: string }) => void;
}): { enqueue: (input: { message: Message }) => void };
```

Messages run one at a time, first in first out. A message whose id is queued or running is ignored. A message whose id is in `acknowledgedIds` is not woken; `sendDone` is called for it (A6). When a wake ends, its id joins `acknowledgedIds` and `sendDone` is called.

### `apps/connector/src/log.ts`

```ts
import type { ConnectorLogEvent } from '@zapbip/types';

export function logConnectorEvent(input: {
  event: ConnectorLogEvent;
  fields: Record<string, string | number | boolean | null>;
}): void;
```

### `apps/connector/src/connect.ts`

```ts
import type { ConnectorClient } from '@zapbip/types';

export function deriveConnectorLinks(input: { connectionLink: string }): { probeLink: string; socketLink: string };
export function reconnectDelayMs(input: { attempt: number }): number;
export async function probeConnectorLink(input: { probeLink: string }): Promise<number>;
export function parseServerFrame(input: { text: string; byteLength: number }): ServerFrameParse;
export type ServerFrameParse = { ok: true; frame: ServerFrame } | { ok: false; reason: FrameRejectionReason };
export async function runConnection(input: {
  socketLink: string;
  client: ConnectorClient;
  workingDirectory: string;
  pinnedSessionId: string | null;
  signal: AbortSignal;
}): Promise<number>;
```

`probeConnectorLink` returns the HTTP status of the probe `GET`. `parseServerFrame` returns a discriminated result `{ok: true, frame: ServerFrame} | {ok: false, reason: FrameRejectionReason}` (the `FrameRejectionReason` enum of `libs/types/src/connector.ts`: `binary_frame`, `frame_too_large`, `malformed`, `unknown_type`). `runConnection` resolves with the process exit code: `0` on the signal, `1` when replaced or unauthorized.

### `apps/connector/src/wake-runner.ts`

```ts
import type { Message } from '@zapbip/core';
import type { ConnectorClient, ConnectorSessionSource, ConnectorWakeOutcome } from '@zapbip/types';

export async function runWake(input: {
  client: ConnectorClient;
  sessionSource: ConnectorSessionSource;
  sessionId: string | null;
  message: Message;
  workingDirectory: string;
}): Promise<{ outcome: ConnectorWakeOutcome; exitCode: number | null }>;
```

`sessionId: null` gives `NoSession` without a process. `runWake` owns the timeout (`CONNECTOR_WAKE_TIMEOUT_MS`, `SIGTERM`) and the active-writer fallback.

### `apps/connector/src/cli.ts`

```ts
import type { ConnectorClient } from '@zapbip/types';

export type ConnectArguments = {
  client: ConnectorClient;
  workingDirectory: string;
  pinnedSessionId: string | null;
};

export function parseConnectArguments(input: { argv: string[] }): ConnectArguments;
```

### `apps/api/src/account-inbox/connector-sockets.ts`

```ts
import type { AgentName, ServerFrame } from '@zapbip/core';

export function acceptConnectorSocket(input: { context: DurableObjectState; agent: AgentName }): WebSocket;
export function sendFrameToAgent(input: { context: DurableObjectState; agent: AgentName; frame: ServerFrame }): number;
export function connectorAgentOf(input: { context: DurableObjectState; socket: WebSocket }): AgentName;
export function remainingSocketCount(input: { context: DurableObjectState; agent: AgentName; closing: WebSocket }): number;
```

`acceptConnectorSocket` closes every socket tagged with the agent using `REPLACED_CLOSE_CODE`, accepts the new one with the agent as its tag, and returns the client end. `sendFrameToAgent` returns the number of sockets sent to.

### `apps/api/src/adapters/wake/local-connector-waker.ts`

```ts
import type { AgentWaker, InboxRepository } from '@zapbip/core';

export function createLocalConnectorWaker(input: {
  context: DurableObjectState;
  repository: InboxRepository;
}): AgentWaker;
```

`notify` reads `repository.listUnread({agent, limit: CONNECTOR_INBOX_LIMIT})`, sends one `messages` frame through `sendFrameToAgent`, and returns `WakeOutcome.Woken` when a socket received it, else `WakeOutcome.Unreached`.

## Dependencies

| Package | Version | Where | Why |
|---------|---------|-------|-----|
| `esbuild` | 0.28.2 | `apps/connector` devDependencies | bundles `src/cli.ts` into `dist/cli.js` |
| `ws` | 8.22.1 | `apps/connector` devDependencies | fake event server in tests only |
| `@types/ws` | 8.18.2 | `apps/connector` devDependencies | types for the fake server |
| `@types/node` | 24.19.2 | `apps/connector` devDependencies | Node 24 types |
| `vitest` | 5.0.5 | `apps/connector` devDependencies | connector tests |
| `@zapbip/core` | `workspace:*` | `apps/connector` devDependencies | connector types (type-only imports) |
| `@zapbip/types` | `workspace:*` | `apps/connector` devDependencies | enums and constants, bundled |
| `typescript` | 7.0.2 | root, already pinned | typecheck |

Versions were checked with `npm view` on 2026-11-06. The Worker side uses packages already pinned by agent-inbox-core and webhook-wake. `dependencies` is absent, so npm pack reports no runtime dependency.

## Sequencing

1. **S0.0 plan refresh** (below) against the code, before any lane starts.
2. **L0a (serial).** Developer 0 writes the contract, runs `pnpm typecheck`, and merges into `feat/local-connector`. **L0b** follows the webhook-wake merge.
3. **In parallel from the L0 commit:**
   - L4a writes the acknowledge test (red), then the body (green); L4b waits for L0b.
   - L1 writes the pure-module tests (red), then the modules (green).
   - L2 writes the connector loop tests (red) and waits for L1 to go green.
   - L3a writes the waker test (red), then the bodies (green); L3b waits for L0b and L4b.
   - L5 writes the docs and the navigation lines.
   - L6 writes the gate rows and their pins.
4. **Merge order:** L0a → L4a → L1 → L3a → L2 → L5 → L6 → (webhook-wake merge) → L0b → L4b → L3b → L7.
5. **L7** starts after L2 and L3 merge.
6. **Z** after L7.

## Steps

### Step L0 (contract)

- [x] **S0.0 plan refresh against the code.** Diffed against `feat/agent-inbox-core` and `origin/feat/webhook-wake`; corrections are in **Plan refresh (S0.0)**. Commit `docs(local-connector): refresh the plan against slice 1's code`.
- [ ] **S0.1 contract (L0a): enums, constants, frames, stubs.** Write the L0a files of the contract: `libs/types/src/connector.ts`, `WakeMode.Local` and `WakeRung.Local`, the frame types, the `acknowledgeDelivery` stub, the stubs of `connector-sockets.ts` and `local-connector-waker.ts`, the `apps/connector` package skeleton (`"private": true`, `"bin": {"zapbip": "dist/cli.js"}`, `"files": ["dist"]`, `"engines": {"node": ">=24"}`, the devDependencies from **Dependencies**, and the scripts below) and every connector stub. Scripts: `"build": "esbuild src/cli.ts --bundle --platform=node --format=esm --target=node24 --outfile=dist/cli.js --banner:js=\"#!/usr/bin/env node\""`, `"typecheck": "tsc --noEmit"`, `"pretest:e2e": "pnpm run build"`, `"pretest:packaging": "pnpm run build"`, `"test:unit": "vitest run --passWithNoTests --config vitest.config.mts"`, `"test:e2e": "vitest run --passWithNoTests --config vitest.e2e.config.mts"`, `"test:packaging": "vitest run --passWithNoTests --config vitest.packaging.config.mts"`. Write `apps/connector/README.md` with purpose only. Add the frame row and the answers rows to the spec. Run `pnpm install`. Commit `feat(types): declare the connector contract`. Proof: `pnpm typecheck` green.
- [ ] **S0.2 wake-side contract (L0b), after the webhook-wake merge.** The three `WakeRepository` methods, the stubs in `createInMemoryWakeRepository` and `createSqliteWakeRepository`, `libs/core/src/wake/local-connector.ts`, the export line, `WakeRung.Local` in `WakerByRung`. Commit `feat(wake): declare the local connector wake contract`. Proof: `pnpm typecheck` green. Not done in Step 0 of this branch because `feat/webhook-wake` is not merged.
- [ ] **S0.3 contract review.** A `reviewer` sub-agent checks the contract against the spec's frame table and against the core additions table above. Result recorded in `tester-briefing.md`.

### Step L4 (core)

- [ ] **S4.1 red: acknowledge (L4a).** `libs/core/src/inbox/use-cases/acknowledge-delivery.test.ts` against `createInMemoryDependencies`. Commit `test(core): pin acknowledgeDelivery`.
- [ ] **S4.2 red: local connector wake setting.** `libs/core/src/wake/local-connector.test.ts` against `createInMemoryWakeRepository()` (L4b, after the merge). Commit `test(core): pin the local connector wake setting`.
- [ ] **S4.3 green: acknowledge.** Implement: `findMessage`; return when it is `null`, its `agent` is not the input agent or its `direction` is not `MessageDirection.FromOwner`; `markRead({messageIds: [messageId]})`. Commit `feat(core): acknowledge delivery of an owner message`.
- [ ] **S4.4 green: wake setting.** Implement `attachLocalConnector`, `detachLocalConnector` and the in-memory bodies of the three restore methods. Commit `feat(core): set the local wake while a connector is attached`.

### Step L1 (connector pure modules)

- [ ] **S1.1 red: owner prompt.** `test/unit/owner-prompt.test.ts`. Commit `test(connector): pin the owner prompt block`.
- [ ] **S1.2 red: wake commands.** `test/unit/wake-commands.test.ts`. Commit `test(connector): pin the wake argv`.
- [ ] **S1.3 red: session lookup.** `test/unit/session-lookup.test.ts` with the fixture. Commit `test(connector): pin the session lookup`.
- [ ] **S1.4 red: wake queue and log.** `test/unit/wake-queue.test.ts` (including the acknowledged-id cases of A6) and `test/unit/log.test.ts`. Commit `test(connector): pin the wake queue and the log`.
- [ ] **S1.5 green: owner prompt and wake commands.** Commit `feat(connector): build the owner prompt and the wake argv`.
- [ ] **S1.6 green: session lookup.** Commit `feat(connector): resolve the newest local session`.
- [ ] **S1.7 green: queue and log.** Commit `feat(connector): queue wakes one at a time`.

### Step L2 (connector loop, process and CLI)

- [ ] **S2.1 red: arguments and links.** `test/unit/cli.test.ts` and `test/unit/connect.test.ts` (`deriveConnectorLinks`, `reconnectDelayMs`). Commit `test(connector): pin the arguments and the links`.
- [ ] **S2.2 red: frame limits.** `test/unit/connect.test.ts` gains `parseServerFrame` cases: a binary frame is `binary_frame`; a text frame of `CONNECTOR_FRAME_MAX_BYTES + 1` bytes is `frame_too_large`, and of exactly `CONNECTOR_FRAME_MAX_BYTES` is accepted; malformed JSON is `malformed`; an unknown type is `unknown_type`. Run `pnpm --filter zapbip test:unit`. Expected failure: `parseServerFrame is not implemented`. Commit `test(connector): pin the frame limits and binary rejection`.
- [ ] **S2.3 red: connection loop.** `test/integration/connect.test.ts` against `fake-event-server.ts`, including the pre-flight cases: probe `401` exits 1 with no socket opened; probe `426` continues; probe `500` exits 1. Commit `test(connector): pin the connection loop and the pre-flight`.
- [ ] **S2.4 red: wake runner.** `test/integration/wake-runner.test.ts` with the fake `claude` and `codex`. Commit `test(connector): pin the wake process`.
- [ ] **S2.5 green: arguments and links.** Commit `feat(connector): parse the connect command`.
- [ ] **S2.6 green: frame limits.** Implement `parseServerFrame` and the byte check before `JSON.parse`. Commit `feat(connector): reject binary and oversized frames`.
- [ ] **S2.7 green: wake runner.** Commit `feat(connector): run one wake as a child process`.
- [ ] **S2.8 green: connection loop.** Implement `probeConnectorLink`, `runConnection`: heartbeat, reconnect, frames in, `done` out, `acknowledgedIds` through L1's queue, the `hello` log. Commit `feat(connector): keep the local channel open`.
- [ ] **S2.9 pin: exit on signals.** Passes on arrival. Commit `test(connector): pin shutdown on signals`, labelled `pin` in the briefing.

### Step L3 (Worker and Durable Object)

- [ ] **S3.1 red: route.** `apps/api/test/integration/connector-route.test.ts`. Commit `test(api): pin the connector route`.
- [ ] **S3.2 red: socket.** `apps/api/test/integration/connector-socket.test.ts`, including binary frames and the close-restore case of A3. Commit `test(api): pin the connector socket`.
- [ ] **S3.3 red: waker and wake setting.** `apps/api/test/unit/local-connector-waker.test.ts` (L3a, now) and `apps/api/test/integration/connector-wake-setting.test.ts` (L3b, the three restore methods on SQLite). Commit `test(api): pin the local waker and the restore record`.
- [ ] **S3.4 green: restore record.** The v5 migration and the bodies of the three methods in `apps/api/src/adapters/sqlite/sqlite-wake-repository.ts`. Commit `feat(api): store the wake setting to restore`.
- [ ] **S3.5 green: sockets and waker.** Commit `feat(api): push owner messages to connector sockets`.
- [ ] **S3.6 green: object and route.** `fetch` (upgrade and attach), `webSocketMessage` (`done` only), `webSocketClose` (`detachLocalConnector` with `remainingSocketCount`), `WakeRung.Local` in `dispatching-agent-waker.ts`, `routes/connector.ts`, the `app.ts` line. Commit `feat(api): accept the local connector socket`.

### Step L5 (docs)

- [ ] **S5.1 red.** `connect/local-connector.mdx` links to `connect/background-running` before it exists. Run `pnpm --filter @zapbip/docs exec mint broken-links`. Expected failure: a broken link. Commit `test(docs): link the connector pages before they exist`.
- [ ] **S5.2 green.** Write `connect/background-running.mdx` (launchd and systemd, mode `600`, not installed by the package) and finish the page. Commit `docs(connect): explain the local connector`.

### Step L6 (shape and gates)

- [ ] **S6.1 red: gate pins.** `scripts/verify.test.sh` expects the row `apps/connector/src/x.ts` → `product typecheck unit e2e`, and `gate_e2e` to call `pnpm --filter zapbip test:e2e`. Run `pnpm test:verify`. Expected failure: the row falls through to `apps/*`. Commit `test(verify): gate the connector end to end`.
- [ ] **S6.2 green.** Add the row above `apps/*` and the `gate_e2e` call. Add the layout line to `AGENTS.md`. Run `pnpm --filter @zapbip/repository-shape test:unit`. Commit `feat(verify): run the connector suite in the e2e gate`.

### Step L7 (E2E and packaging)

- [ ] **S7.1 red: packaging.** `test/packaging/packaging.test.ts`: `npm pack --dry-run --json` lists only `dist/cli.js`, `README.md`, `package.json`. Commit `test(connector): pin the package contents`.
- [ ] **S7.2 red: end to end.** `test/e2e/connector-wake.e2e.test.ts` runs by default, through the harness `test/e2e/support/stack.ts` (the stack, ports, secret and fake MCP client are specified in **Test plan → E2E (gate)**). It runs `node dist/cli.js connect` with fake binaries on `PATH`. Commit `test(connector): pin the local wake end to end`.
- [ ] **S7.3 green.** Make both pass. Commit `feat(connector): bundle the connector for npm`.

## Z. Prove and ship

- [ ] **Tester briefing:** a developer wrote `docs/features/local-connector/tester-briefing.md`, with every red run's printed failure text.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence, except the owner-run section.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`.
- [ ] **/check-ui:** not applicable (no UI).
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| S0.1 contract | a lane builds against a signature that changed later | `pnpm typecheck` error naming a contract symbol in another lane's branch | fix forward in a new Step L0 commit, which every lane merges. The commit has no backout. |
| S0.1 contract | `WakeRepository` gains methods and an adapter lacks them | typecheck error naming `createSqliteWakeRepository` or `createInMemoryWakeRepository` | the stubs in L0b prevent this; if missed, add the stub in a new L0b commit |
| S0.1 contract | `libs/types/src/enums.ts` already has `WakeMode.Local` with another value | L0 check shows a different string | keep the existing value; the connector uses the enum, never the literal |
| S3.4 restore record | restore overwritten by a second attach | the test attaches twice then closes once and expects the original previous mode | keep `saveLocalRestore` behind `findLocalRestore` being null; revert |
| S3.6 close | last socket close does not restore | `connector-socket.test.ts` close case expects the restored mode | check `remainingSocketCount` excludes the closing socket; revert |
| S3.6 close | restore overwrites a user change | the test changes the mode to `webhook` before the close and expects `webhook` | the current-mode check in `detachLocalConnector`; revert |
| S1.6 session lookup | Claude folder name rule wrong | fixture test for `.` and `_` paths fails | fix the rule; revert if the fixture does not match a real install |
| S1.5 wake commands | prompt lands before a flag, or `--allowedTools` swallows the prompt | exact argv test; the fake `claude` records the flag list | restore the `=` form and prompt-last order; revert |
| S1.4 queue | an acknowledged id is woken again | queue test after a finished wake expects `runWake` once | check `acknowledgedIds` before enqueue; revert |
| S2.6 frame limits | a binary frame is parsed as text | the binary test expects `binary_frame` and no `JSON.parse` call | reject before parsing; revert |
| S2.8 pre-flight | probe error lets the socket open | `401` test expects no socket and exit 1 | run the probe first; revert |
| S2.7 wake runner | timeout does not kill the child | fake `claude` that sleeps stays alive past `CONNECTOR_WAKE_TIMEOUT_MS` | `SIGTERM` then `SIGKILL` after a grace; revert |
| S2.7 wake runner | child output reaches the log | log test greps for the fake child's marker | keep pipes internal; revert |
| S2.5 CLI | the secret appears in argv | integration test reads `ps -o args=` and asserts the secret is absent | environment or prompt only; revert |
| S2.8 connection loop | reconnect spins with zero delay | fake-clock test counts attempts | fix `reconnectDelayMs` use; revert |
| S3.6 Durable Object | `ping` reaches `webSocketMessage` | the test counts calls after a ping and expects zero | confirm the auto-response pair; revert |
| S3.5 sockets | a replaced socket stays open | `getWebSockets(agent)` expects length 1 | close with `REPLACED_CLOSE_CODE` before accept; revert |
| S3.6 route | an unknown secret reaches the object | route test expects `401` and no object call | move resolution before `getByName`; revert |
| L4 acknowledge | another agent's message is marked read | unit test expects the other message unchanged | add the agent check; revert |
| S6.2 gates | the connector falls under `apps/*` and skips E2E | `verify.test.sh` row pin fails | move the row above `apps/*`; revert |
| S7.1 packaging | source or test files ship | `npm pack --dry-run --json` lists `src/` or `test/` | fix `files`; revert |
| S5.1 docs | a navigation entry points at a missing page | `mint broken-links` names it | create the page or remove the link; revert |
| S7.2 end to end | a fixed port collides | `wrangler dev` fails to bind | ephemeral port from the harness; revert |

**Steps with no backout:** S0.1 (contract): fix forward through a new Step L0 commit.
