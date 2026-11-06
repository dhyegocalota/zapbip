# Local connector

**Status:** Building
**Tier:** 🔴
**Owner approval:** approved 2026-11-06 (owner delegated)
**ADRs:** [0006](../../adr/0006-one-secret-per-connection-in-the-mcp-url.md), [0007](../../adr/0007-a-durable-inbox-and-a-wake-ladder.md), [0009](../../adr/0009-cloudflare-workers-with-one-durable-object-per-account.md), [0022](../../adr/0022-a-hibernatable-websocket-for-the-local-connector.md), [0023](../../adr/0023-the-local-session-is-the-newest-one-in-the-working-directory.md)
**Not changing:** the ten MCP tools and their contract, except that `set_wake` now accepts `mode: local`; the WhatsApp adapters; the connection directory schema in D1 (the wake mode lives in the Durable Object); the install prompts of `install-skills`. Nothing outside `apps/connector`, `libs/types`, the connector route and Durable Object code in `apps/api`, `apps/docs`, `scripts/verify-gates.tsv`, the repository-shape root list and the indexes.

## Problem

Claude Code and Codex sit on the owner's machine. A message from the owner should reach them while they are idle, not only when they poll. The first wake rung ([ADR 0007](../../adr/0007-a-durable-inbox-and-a-wake-ladder.md)) is a small program on the owner's machine: it keeps a channel to zapbip open, and for each owner message it resumes the local session with the message as the prompt. The POC measured ~7 s for Claude Code and ~6 s for Codex. This slice makes that program a product: the npm package `zapbip`, a server channel that holds up for days, and safe, testable wakes.

## Goals

1. An npm package `zapbip` with three commands: `npx zapbip connect`, which keeps a connection's channel open and wakes a local session for each owner message, `listen`, which prints one JSON line per owner message, and `channel`, a Claude Code channel server that puts each owner message into an open session.
2. A server channel from the `AccountInbox` Durable Object to the connector: a hibernatable WebSocket ([ADR 0022](../../adr/0022-a-hibernatable-websocket-for-the-local-connector.md)), with heartbeat, reconnect and an inbox re-read on every connect.
3. The connection registers the `local` wake mode when a connector attaches.
4. Session binding: the newest local session in the working directory by default, or a pinned id ([ADR 0023](../../adr/0023-the-local-session-is-the-newest-one-in-the-working-directory.md)).
5. One wake at a time per connection; further messages queue.
6. Restricted tools in every wake: the agent can only send a message back.
7. A fallback when the Codex app holds the thread.
8. Logs that carry ids, kinds, outcomes and timings, never message text, the secret or the agent's output.
9. Optional background running under launchd or systemd, documented and not installed by the package.
10. A Mintlify page for the owner.

## Non-goals

- Installing the connector automatically, or installing a background service. Documented only.
- Scheduled tasks, webhooks and the standby agent ([ADR 0007](../../adr/0007-a-durable-inbox-and-a-wake-ladder.md) rungs 2 to 4). They belong to `webhook-wake` and `scheduled-wake`.
- Clients other than Claude Code and Codex. Desktop apps that hold a thread are handled only by the fallback.
- Wake replies other than `send_message`. `ask`, `send_media` and the other tools wait for a later slice.
- The install prompt that tells the owner to run the command. It belongs to `install-skills`.
- Publishing the npm package. `deploy-readiness` owns the first publish and its provenance.

## Design

### Layout

```
apps/connector              npm package `zapbip`, bin `zapbip`, bundled with esbuild into dist/cli.js
  README.md                 purpose only
  src/cli.ts                arguments, environment, the `connect`, `listen` and `channel` commands
  src/hidden-prompt.ts      the connection link read from the terminal without echo
  src/connect.ts            socket loop: heartbeat, reconnect, frames, acknowledgement
  src/listen.ts             the `listen` command: one JSON line per owner message
  src/channel.ts            the `channel` command: a Claude Code channel server
  src/owner-notice.ts       the verified and forwarded fields shared by `listen` and `channel`
  src/timers.ts             the timer port the socket loop and the tests share
  src/wake-queue.ts         one wake at a time per connection, first in first out
  src/wake-runner.ts        spawns the client, the timeout, the active-writer fallback
  src/wake-commands.ts      per-client argv builders
  src/wake-isolation.ts     the per-wake MCP isolation: a private config for Claude Code, disabled servers for Codex
  src/session-lookup.ts     newest Claude Code or Codex session in a working directory
  src/owner-prompt.ts       the channel block around the owner's text, with escaping
  src/log.ts                JSON lines without message text
libs/types                  enums and timing constants shared by the connector and the Worker
apps/api/src/routes         GET /c/:secret/connector, the WebSocket upgrade
apps/api/src/account-inbox  connector sockets (hibernation API), LocalConnectorWaker
apps/docs/developers         local-connector.mdx, and its pt-br twin
```

`package.json` lists no runtime dependencies: the connector uses Node 24's global `fetch`, global `WebSocket`, `node:child_process` and `node:readline`. esbuild inlines `libs/types` and the MCP SDK (used only by `channel`, a development dependency) into `dist/cli.js`. Type-only imports from `libs/core` are erased.

### Command

```
npx zapbip connect --client claude-code|codex [--cwd <directory>] [--session <uuid>]
```

- The connection's MCP URL (`https://<host>/c/<secret>/mcp`) is read from `ZAPBIP_CONNECTION_URL`, or asked on the terminal when the variable is absent. The connector opens its socket at the same host and secret under `/connector`. It is never a positional argument, because arguments show up in `ps` and in shell history.
- `--cwd` defaults to the directory the command runs in and must exist.
- `--session` pins one session and skips the lookup.
- The command runs in the foreground, prints one JSON line per event, and exits on `SIGINT` or `SIGTERM`.

### Enums and constants (`libs/types`)

| Name | Values |
|---|---|
| `ConnectorClient` | `ClaudeCode = 'claude-code'`, `Codex = 'codex'` |
| `WakeMode` | declared by agent-inbox-core; this slice saves `Local = 'local'` |
| `ConnectorFrameType` | `Messages = 'messages'`, `Done = 'done'`, `Ping = 'ping'`, `Pong = 'pong'` |
| `ConnectorWakeOutcome` | `Answered`, `Failed`, `NoSession`, `FallbackNewThread` |

| Constant | Value |
|---|---|
| `HEARTBEAT_INTERVAL_MS` | 25 000 (below the idle limit of Cloudflare's proxy, to re-check) |
| `HEARTBEAT_TIMEOUT_MS` | 10 000 |
| `RECONNECT_BASE_MS` | 1 000 |
| `RECONNECT_MAX_MS` | 30 000 |
| `CONNECTOR_WAKE_TIMEOUT_MS` | 900 000 |
| `REPLACED_CLOSE_CODE` | 4001 |
| `WAKE_ALLOWED_TOOLS` | `mcp__zapbip__send_message` |
| `CODEX_ZAPBIP_SERVER_NAME` | `zapbip` |
| `CODEX_ACTIVE_WRITER_MESSAGE` | `thread already has an active writer` |
| `WAKE_INSTRUCTION` | the English instruction after the owner block (see Wake prompt) |
| `UUID_PATTERN` | the canonical UUID shape, for `--session` and for resolved ids |

### Server side

**Route.** `GET /c/:secret/connector` with `Upgrade: websocket`. The Worker resolves the secret through `ConnectionDirectory` as for MCP. An unknown or revoked secret gets the same `401` as MCP. A request without the upgrade header gets `426`.

**Durable Object.** `AccountInbox` accepts the socket with the hibernation API:
- `ctx.acceptWebSocket(socket, [agent])`, so the agent name is the socket's tag;
- `ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING frame, PONG frame))`, so heartbeat never wakes the object;
- the attach saves the wake mode `Local` through webhook-wake's `WakeRepository.saveWake`, remembering the previous record so the last close restores it;
- the attach first sends `hello` (`{type, agent, previousWakeMode}`), then `messages` with every unread owner message for that agent, which is the inbox re-read.

A new attach for an agent closes the previous socket of that tag with `REPLACED_CLOSE_CODE`. One connector runs per connection. A replaced connector exits and does not reconnect.

**Waker.** `LocalConnectorWaker` implements `AgentWaker.notify({agent, reason})` and is registered for the `Local` rung. It reads the agent's unread owner messages and sends them as one `messages` frame to the agent's sockets. With no socket, it returns, and the message waits in the inbox. A live MCP waiter for that agent still wins, as the core routing rule says: the agent is already in a conversation.

**Acknowledgement.** A `done` frame carries one `messageId`. The object calls the core use case `acknowledgeDelivery` (an addition of this slice, listed in `core-contract-additions.md`), which marks the message read. A message is re-sent until it is acknowledged or read through an MCP tool.

### Frames

| Direction | Frame | Shape |
|---|---|---|
| Worker → connector | `hello` | `{type, agent, previousWakeMode}`, first on every attach, before the inbox re-read |
| Worker → connector | `messages` | `{type, messages: Message[]}`, where `Message` is the core type of owner messages |
| connector → Worker | `done` | `{type, messageId}` |
| connector → Worker | `ping` | answered by the Durable Object with `pong`, no wake |

All frames are JSON text. A frame that does not parse, or whose type is unknown, is dropped with a `frame_rejected` log event that carries no body.

### Connector behaviour

**Connect and heartbeat.**
- The connector opens `wss://<host>/c/<secret>/connector`. Node's WebSocket cannot set headers, so the secret travels in the path, as [ADR 0006](../../adr/0006-one-secret-per-connection-in-the-mcp-url.md) already requires.
- Every `HEARTBEAT_INTERVAL_MS` it sends `ping`. If no frame arrives within `HEARTBEAT_TIMEOUT_MS` of a ping, it closes and reconnects. Any inbound frame counts as proof of life.

**Reconnect.** On any close other than `REPLACED_CLOSE_CODE` or the user's signal, the connector waits `min(RECONNECT_MAX_MS, RECONNECT_BASE_MS × 2^attempt)` and connects again. A successful open resets the attempt count. Each open triggers the inbox re-read, so owner messages sent while the connector was offline are woken on reconnect.

**Frames in.** A `messages` frame enqueues each message whose id is not already queued or running. Ids seen again are skipped, so a re-read never wakes a message twice in one process.

**Wake.** The wake queue runs one wake at a time, first in first out.
1. Resolve the session: the pinned `--session`, else the newest session for `--cwd`. No session gives `NoSession`, no process starts, and the message stays unread.
2. Build the argv for the client (see Wake commands) and spawn it with `child_process.spawn`, no shell, `stdio` piped and `cwd` set to `--cwd`.
3. Wait for exit, or kill with `SIGTERM` after `CONNECTOR_WAKE_TIMEOUT_MS`.
4. Send `done` for the message on any outcome that ran a process, including `Failed`, so a wake that fails is not retried forever. A crash of the connector before `done` leaves the message unread, and the next connect wakes it again. That is at-least-once delivery.

**Shutdown.** On `SIGINT` or `SIGTERM` the connector closes the socket, sends `SIGTERM` to a running wake and exits. Unacknowledged messages come back on the next connect.

### Wake commands

The argv is built per client from a record keyed by `ConnectorClient`. Each builder takes named parameters `{sessionId, isolationArguments}`. The prompt never reaches argv: it goes to the child on standard input (`-` for Codex).

| Client | Command |
|---|---|
| `claude-code` | `claude -p --resume <sessionId> --permission-mode dontAsk --tools= --strict-mcp-config --mcp-config=<private file> --setting-sources= --allowedTools=mcp__zapbip__send_message` |
| `codex` | `codex exec --skip-git-repo-check -s read-only -c mcp_servers.zapbip.default_tools_approval_mode="approve" -c mcp_servers.zapbip.enabled_tools=["send_message"] [-c mcp_servers.<name>.enabled=false ...] resume <sessionId> -` |

- **Claude Code.** `--allowedTools` is variadic, so the `=` form keeps it from swallowing the next flag. `--tools=` removes every built-in tool. `--allowedTools` only adds to the `permissions.allow` rules of the owner's settings, so the connector also passes `--setting-sources=` (no user, project or local settings) and `--strict-mcp-config` with a `0600` file in a private temporary directory that holds only the zapbip server (`{"mcpServers":{"zapbip":{"type":"http","url":<connection link>}}}`). No other MCP server is loaded, so no other tool is listed or callable. The file is deleted when the child exits. Managed (policy) settings still apply; that is an accepted residual, as is the macOS managed preferences domain `com.openai.codex` on the Codex side.
- **Codex.** The read-only sandbox blocks file writes; zapbip's MCP calls still run. `default_tools_approval_mode="approve"` stops Codex refusing an MCP tool in headless mode (POC). `enabled_tools` limits the server to `send_message`. Every layer Codex reads is parsed with a real TOML parser: `/etc/codex/config.toml`, `/etc/codex/managed_config.toml`, `$CODEX_HOME/config.toml`, `$CODEX_HOME/managed_config.toml` and every `.codex/config.toml` from the working directory up to `/`. Only bare TOML keys are accepted as server or profile names; any other name refuses the wake. The parser is `smol-toml`, bundled. Every other server, whether written as a table, a dotted key or an inline table, is switched off with `-c mcp_servers.<name>.enabled=false`, and every server a `[profiles.<profile>]` declares with `-c profiles.<profile>.mcp_servers.<name>.enabled=false`; no file of the owner is touched. Managed layers outrank `-c`, so the wake is refused when either managed file sets any key outside a small allowlist (`model`, `model_reasoning_effort`, `model_reasoning_summary`, `file_opener`, `hide_agent_reasoning`; anything else, known or not, refuses), and when `mcp_servers.zapbip` is defined anywhere but `$CODEX_HOME/config.toml` (in another layer or inside a profile) or is not a URL server. `-c web_search="disabled"` switches Codex's web search off (the key is in Codex's published configuration schema), and `-c profiles.<profile>.web_search="disabled"` does the same for every profile any layer declares. A profile may set only the same harmless keys plus `web_search` and `mcp_servers`; any other key (`sandbox_mode`, `approval_policy`, `tools`, `features`, `model_provider`, unknown keys) refuses the wake, because it cannot be overridden safely. Any layer that sets a legacy web search switch (`features.*web_search*`, `tools.web_search`, `tools_web_search`) refuses the wake too. The wake fails closed: when a file is not valid TOML or a server cannot be identified, Codex is not woken, the connector logs `wake_refused_isolation`, sends no `done` and the message stays unread, so the owner gets the not-listening notice.
- The session id is checked against `UUID_PATTERN` before it reaches argv.

### Session binding

Resolution happens at each wake, so a session started after the connector began is picked up.

| Client | Where the lookup reads | Newest means |
|---|---|---|
| `claude-code` | the project folder of `--cwd` under `CLAUDE_CONFIG_DIR` (default `~/.claude`) | the `*.jsonl` file with the latest modification time; its name without `.jsonl` is the id |
| `codex` | rollout files under `CODEX_HOME` (default `~/.codex/sessions`) | the latest rollout whose first line, `session_meta`, records `cwd` equal to `--cwd` |

- The config directories come from optional parameters with those defaults, not `??`.
- Claude's project folder name is the working directory with every character that is not a letter or digit replaced by `-`. A fixture from a real install pins this rule in a test.
- The Codex lookup reads the first line of each rollout, newest directories first, and stops at `SESSION_LOOKUP_LIMIT` files.

### Codex active writer

When the Codex app holds the thread, `codex exec resume` fails with `CODEX_ACTIVE_WRITER_MESSAGE` on stderr.

- The connector runs `codex exec` once more as a new session in the same `--cwd`, with the same prompt, and logs `FallbackNewThread`.
- The new session is then the newest rollout for that directory, so later wakes resume it.
- It never loops: one fallback per wake.
- The new thread starts without the earlier context. The wake allows only `send_message`, so the agent sees the owner's new message and nothing before it. Accepted for this slice.

The check is on the message, not on the exit code, because the exit code of a refused resume is not documented.

### Wake prompt

```
<channel source="zapbip" sender="owner" verified="true">{escaped owner text}</channel>
{WAKE_INSTRUCTION}
```

- The owner text is escaped before it is placed in the block: `&`, `<` and `>` become `&amp;`, `&lt;` and `&gt;`, the ampersand first so an entity cannot be forged. A message containing `</channel>` therefore cannot close the block.
- `WAKE_INSTRUCTION` tells the agent to reply with `send_message`, briefly, as a WhatsApp message.
- Media messages carry their kind and caption only. A signed media link is passed as text; the connector never downloads it.
- The prompt is English, because repo text is English; the agent answers the owner in the owner's language.

### Logs

JSON lines on stdout, always with `at` and `event`.

| Event | Fields |
|---|---|
| `connector_connected` | `agent`, `client`, `previousWakeMode` |
| `connector_reconnecting` | `attempt`, `delayMs` |
| `connector_closed` | `code` |
| `connector_replaced` | `agent` |
| `messages_received` | `count` |
| `wake_started` | `messageId`, `kind`, `sessionKind` |
| `wake_finished` | `messageId`, `outcome`, `exitCode`, `elapsedMs` |
| `done_sent` | `messageId` |
| `frame_rejected` | `reason` |

Never logged: message text, captions, file names, the connection URL or its secret, the owner's phone number, and the child process's stdout or stderr. `ConnectorWakeOutcome` carries the classification of a failure instead of its output.

### Failure handling

| Failure | Behaviour |
|---|---|
| Unknown or revoked secret | `401` on the upgrade; the connector logs `connector_closed` and exits with code 1 |
| Socket drops | reconnect with backoff; inbox re-read on open |
| No pong within the timeout | the socket is closed and the connector reconnects |
| Another connector attaches | the older socket gets `4001` and exits |
| `claude` or `codex` not on PATH | `wake_finished` with `Failed`, `done` sent; the owner gets nothing, which is the risk listed below |
| No session for the directory | `NoSession`, no process, the message stays unread, retried on each wake or reconnect |
| Wake exceeds `CONNECTOR_WAKE_TIMEOUT_MS` | `SIGTERM`, `Failed`, `done` sent |
| Codex active writer | one fallback as a new session, `FallbackNewThread` |
| Connector killed mid-wake | the message is re-sent on the next connect |
| Malformed frame | dropped, `frame_rejected` |

### Risks to verify before build

- **Cloudflare billing.** The ADR 0022 claims (hibernated sockets bill no duration, auto-response pings are not billed as requests, WebSocket messages count at a reduced ratio) come from the documentation and are not measured. Re-check the pricing page and measure a day of idle connectors on staging.
- **Heartbeat interval.** 25 s is chosen below the idle limit of Cloudflare's proxy for WebSockets. Confirm that limit.
- **Codex keys.** `enabled_tools` is taken from the Codex config reference; confirm it on the pinned CLI version, and confirm that `-s` and `-c` are accepted before `resume` as in the POC.
- **Claude Code refusals.** Confirm that `-p` refuses a tool outside `--allowedTools` without hanging, in a real run.
- **Claude folder name.** Confirm the encoding rule against a real install (the fixture test pins it).
- **Shared sessions.** A wake may append to a session open in another terminal. Documented; `--session` avoids it.
- **Silent wakes.** With no session, or a failed wake, the owner receives no reply. A notice to the owner is a later slice.
- **Docs go live last.** The owner connects Mintlify only after the npm publish and `pnpm docs:preflight` of the deploy-readiness runbook; the docs on `main` are not live before that.
- **npm name.** Confirm that `zapbip` is free on npm before the first publish. The docs pin `npx zapbip@0.1.0`, so they must not go live before `zapbip@0.1.0` is published: a gate that `deploy-readiness` enforces in its docs and Worker preflight, because anyone could otherwise claim the name and serve code to the people who follow the docs.
- **Secret at rest.** The launchd and systemd files hold the secret. They are documented with mode `600`; Keychain storage is a later option.

### Security

- **Commands.** No `shell: true`. No argv or path comes from server data. Only the owner's text reaches the child process, and only as one argument inside the channel block.
- **Restricted tools.** Claude Code runs with a config that holds only the zapbip server, no settings files, no built-in tools, and `mcp__zapbip__send_message` as the only allowed tool. Codex's zapbip server exposes `send_message` only, with its approval mode set, and every other server found in the Codex configuration files is switched off.
- **Sandbox.** Codex runs read-only. Residual: a woken Codex can use `send_message` and a read-only shell; Codex's apps and connectors tied to the owner's account are not switched off, because their `-c` keys are not stable across Codex releases, and macOS managed preferences (`com.openai.codex`) outrank `-c`.
- **Owner text.** The block marks sender `owner` and `verified="true"` only for messages the owner wrote. A message WhatsApp marks as forwarded (or frequently forwarded) arrives with `verified="false"` and a `forwarded="true"` label, and the channel instructions grant it no authority. Escaping (`&`, `<`, `>`) prevents a breakout. A message that arrives without a boolean `forwarded` flag or with an unknown kind is rejected as malformed, and only `forwarded === false` counts as verified. Claude refuses instructions from unverified senders (POC finding).
- **Least privilege.** The resumed Claude Code session runs in `dontAsk` permission mode with every built-in tool off (`--tools=`) and only `send_message` allowed, the MCP isolation above; the owner prompt goes to the child on standard input; the child never sees `ZAPBIP_CONNECTION_URL`.
- **Leftover folders.** On start the connector removes `zapbip-wake-*` temporary folders it owns that are older than a wake can run, so a crash never leaves a config file behind.
- **Half-open sockets.** The object stamps each socket with its attach time. A socket whose last ping answer, or its attach time when it never answered, is older than `HEARTBEAT_INTERVAL_MS + HEARTBEAT_TIMEOUT_MS` is not live, and a socket without a stamp is not live.
- **Revocation.** Revoking a connection must close every socket the agent holds: the object exposes `closeAgentSockets({agent})`, which closes them with `REVOKED_CLOSE_CODE`. Slice 3's revoke flow calls it when the slices merge (a cross-slice task); until then a revoked connector is stopped by the 401 of its next reconnect pre-flight.
- **Secret.** Read from the environment or a prompt. Never logged, never in argv. The connector keeps it in memory only.
- **Supply chain.** `package.json` lists no runtime dependencies. The bundle is built in the gate and checked with `npm pack --dry-run`. Docs and skills pin `npx zapbip@<exact version>`, the `version` in `apps/connector/package.json`. Publishing that version to npm is an owner step of `deploy-readiness`; the package is not marked `private`, so the owner can publish it, and its `files` allowlist keeps the tarball to `dist`.
- **Local files.** Session lookup reads file names and modification times. Codex rollouts are read only for their first line.

### Background running (documented, not installed)

The docs page explains two optional services:
- **macOS:** a LaunchAgent that runs `npx zapbip connect` with `ZAPBIP_CONNECTION_URL` in `EnvironmentVariables`; the plist is created with mode `600`, because it holds the secret.
- **Linux:** a user systemd unit with `EnvironmentFile=` pointing to a file with mode `600`, and `Restart=always`.

No command writes either file. A reboot restarts the connector; a reconnect re-reads the inbox.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Channel from the Durable Object to the connector | SSE · hibernatable WebSocket · long-poll | hibernatable WebSocket ([ADR 0022](../../adr/0022-a-hibernatable-websocket-for-the-local-connector.md)) | owner delegated 2026-11-06 |
| Which local session to resume | newest in cwd · explicit flag only · hook records the id | newest in cwd, pinned with `--session` ([ADR 0023](../../adr/0023-the-local-session-is-the-newest-one-in-the-working-directory.md)) | owner delegated 2026-11-06 |
| Connection URL input | argv · environment or prompt | environment `ZAPBIP_CONNECTION_URL`, else prompt | owner delegated 2026-11-06 |
| Concurrency of wakes | parallel · one at a time, queued | one at a time per connection, first in first out | owner delegated 2026-11-06 |
| Claude Code tools in a wake | all · `send_message` only | `send_message` only, via `--allowedTools=`, with a strict MCP config and no setting sources | owner delegated 2026-11-06 |
| Codex tools and sandbox in a wake | default · restricted | read-only sandbox, approval mode `approve`, `enabled_tools = ["send_message"]` | owner delegated 2026-11-06 |
| Codex app holds the thread | fail · retry · new session once | one new session in the same directory; later wakes resume it | owner delegated 2026-11-06 |
| Acknowledgement | at-most-once · at-least-once | `done` after the wake ends; unacknowledged messages re-sent on connect | owner delegated 2026-11-06 |
| Background running | installer command · documented services | documented launchd and systemd, not installed | owner delegated 2026-11-06 |
| Wake prompt language | Portuguese · English | English, because repo text is English | owner delegated 2026-11-06 |
| Attach and wake mode | keep the previous mode · set `local` | attach sets `local` and logs the previous mode | owner delegated 2026-11-06 |
| Wake replies beyond `send_message` | all tools · send only | send only, in this slice | owner delegated 2026-11-06 |
| Server hello | none · a `hello` frame first | a `hello` frame with the agent and the previous wake mode; the connector logs `connector_connected` when it arrives | owner delegated 2026-11-06 |
| Wake persistence | new port methods on the inbox repository · slice 4's `WakeRepository` | `WakeRepository`; three restore methods, a `local_restore` column on `agent_wake` in Durable Object schema `v5`; the last close restores the previous setting unless the owner changed it meanwhile | owner delegated 2026-11-06 |
| Done scope | any message · owner messages of the same agent | only an owner message of the same agent is marked read | owner delegated 2026-11-06 |
| Connector pre-flight | open the socket directly · a plain HTTPS request first | `GET` the link without `Upgrade`: 401 exits 1, 426 continues, anything else exits 1 | owner delegated 2026-11-06 |
| `set_wake` with `mode: local` | rejected as unavailable · accepted | accepted: it saves the local mode, drops any stored restore record (the choice becomes the baseline) and reports `effective_rung: inbox` while no connector socket is live, `local` otherwise | owner delegated 2026-11-06 |
| Forwarded messages | verified like the rest · unverified with a label | `verified="false"` and a forwarded label, carried from the inbound message flag through the inbox | owner delegated 2026-11-06 |
| Push scope of the local rung | first message of a batch · every owner message | every owner message while a socket is live, and the remaining unread after each `done`; the connector queue dedupes by id | owner delegated 2026-11-06 |
| Package location | `apps/connector` · `libs/connector` | `apps/connector`, bundled with esbuild, no runtime dependencies in `package.json` | owner delegated 2026-11-06 |

## Test strategy summary

- **Connector unit (Vitest, fake clock where timing matters):**
  - `owner-prompt`: the channel block, escaping of `</channel>`, a text starting with `-` still starts with `<`;
  - `wake-commands`: exact argv for both clients, the `=` form, the read-only sandbox, `enabled_tools`, the active-writer fallback;
  - `session-lookup`: Claude folder encoding from a real-install fixture; newest by mtime; Codex by `session_meta.cwd`; no session;
  - backoff sequence and reset on open;
  - `log`: no secret, no message text, no stderr in any event;
  - `wake-queue`: order and one at a time.
- **Connector integration with a fake event server** (a local `ws` server in the test, speaking the frames above):
  - the fake `claude` and `codex` binaries on `PATH` record argv and start/end times as JSON lines;
  - one owner message: argv recorded, `done` received, the outcome is `Answered`;
  - three messages sent at once: no two wakes overlap;
  - heartbeat: the fake server withholds `pong`, and the connector reconnects within the timeout;
  - **reconnect:** the fake server drops the socket while a wake runs; the connector reconnects, the server re-sends unacknowledged messages, and the wake runs again only for them, with each `done` received once per run;
  - replacement: a second connector for the same agent makes the first exit with code 1 and no reconnect;
  - the Codex fallback: the fake `codex` refuses `resume` with the active-writer message; the second run is `exec` in the same `--cwd`.
- **Worker integration (`@cloudflare/vitest-pool-workers`, in `apps/api`):**
  - the upgrade is accepted with a valid secret and returns `401` for an unknown one;
  - the attach saves the wake mode `local` and remembers the previous one;
  - the attach re-sends unread messages;
  - `done` marks the message read;
  - the auto-response answers `ping` without a message event reaching the object.
- **E2E:** the real `npx zapbip connect` against `wrangler dev` with the owner simulator, one real Claude Code session and one Codex session, each waking and replying through `send_message`. Recorded for the PR.
- **Docs:** `mint broken-links` green for `apps/docs/developers/local-connector.mdx`.
- **Packaging:** `npm pack --dry-run` lists only `dist/`, the README and the package metadata.
