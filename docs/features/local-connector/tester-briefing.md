# Tester briefing: Local connector

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

### Step 0 (contract, no behaviour)

- `libs/types/src/connector.ts` — connector enums (`ConnectorClient`, `ConnectorFrameType`, `ConnectorWakeOutcome`, `ConnectorSessionSource`, `ConnectorLogEvent`, `FrameRejectionReason`) and constants; exported from `libs/types/src/index.ts`.
- `libs/types/src/enums.ts` — `WakeMode.Local` and `WakeRung.Local`.
- `libs/core/src/inbox/connector-frames.ts` — `HelloFrame`, `MessagesFrame`, `DoneFrame`, `ServerFrame`.
- `libs/core/src/inbox/use-cases/acknowledge-delivery.ts` — stub, throws `acknowledgeDelivery is not implemented`.
- `apps/api/src/account-inbox/connector-sockets.ts`, `apps/api/src/adapters/wake/local-connector-waker.ts` — stubs.
- `apps/connector` — package `zapbip` (private until deploy-readiness), three Vitest configs, one stub per module of the contract; `pnpm-lock.yaml` gained the `apps/connector` importer (esbuild 0.28.2, ws 8.22.1, @types/ws 8.18.2) and the vite peer variants that esbuild adds.
- Not done, by design: the wake-side contract (`WakeRepository` restore methods, `libs/core/src/wake/local-connector.ts`, `WakerByRung` entry) waits for `feat/webhook-wake` to merge (plan step S0.2, `(contract: confirm at merge)`).

### Lane L1 (connector pure modules)

- `apps/connector/src/{owner-prompt,wake-commands,session-lookup,wake-queue,log}.ts` — bodies; tests in `apps/connector/test/unit/`; fixture `apps/connector/test/fixtures/claude-folder/-private-tmp-doctor-walk/` (three empty session files, names copied from a real install; the test sets the modification times on a copy).
- Run: `pnpm --filter zapbip test:unit` (56 passed) and `pnpm --filter zapbip typecheck`.
- Red then green (red text as printed):
  - `owner-prompt.test.ts` 5b3244c to 98d4537: 18 failed with `<name> is not implemented`.
  - `wake-commands.test.ts` 66727c3 to 98d4537: 11 failed, 1 pin (`CLIENT_BINARY_NAME`); the UUID cases failed with the stub message instead of `session id is not a UUID`.
  - `session-lookup.test.ts` fa11ac2 to 9c852f2: 14 failed with `findNewestSessionId is not implemented` or `claudeProjectFolderName is not implemented`.
  - `wake-queue.test.ts`, `log.test.ts` 37fca61 to 17c9fdb: 12 failed with `createWakeQueue is not implemented` or `logConnectorEvent is not implemented`.
- Decisions L2 must know:
  - `codexHome` is the Codex home (`~/.codex`); rollouts are read under `<codexHome>/sessions`. The defaults sit at the signature of `findNewestSessionId`; the loop passes `CLAUDE_CONFIG_DIR` and `CODEX_HOME` when set.
  - The queue acknowledges and sends `done` only when `runWake` resolves. A `runWake` that rejects leaves the message unacknowledged, sends no `done`, and does not stop the queue. For `NoSession` (message stays unread) `runWake` must reject; a resolved `runWake` means `done`.
  - Builders throw `session id is not a UUID` for a bad id.
  - Prompt text for a kind without text is the `MessageKind` value (`image`, `location`, ...).

Hypotheses:

1. Owner text containing `</channel>`, a forged opening tag or a leading `-` stays one escaped argument inside the block. Break it by: `&`-based or Unicode look-alike brackets, newlines before the closing tag.
2. The wake argv equals the spec's, with no shell. Break it by: a prompt with quotes, `$()`, backticks and newlines through the fake binary.
3. Wakes never overlap and run in arrival order. Break it by: a burst of messages with a wake that fails midway.
4. The newest Codex rollout is the one whose first line records the directory. Break it by: a large first line, a rollout with CRLF, more than 200 newer rollouts for other directories.
5. Logs carry only the fields given. Break it by: grep a full run for message text.

Gaps: the lookup trusts file modification time for Claude Code; a pre-existing symlinked project folder is followed.

## How to run

```bash
<commands to start the stack and open the feature>
```

## Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `<path>::<name>` |  |  |

## Hypotheses to attack

Every "it works" is a hypothesis the tester tries to break.

1. Hypothesis: <claim>. Break it by: <suggested attack>.

## Known gaps

- <what the developer knows is missing or untested>

## Step L5 (docs)

### What changed

- `apps/docs/guides/local-connector.mdx` and `apps/docs/guides/background-running.mdx`, with twins under `apps/docs/pt-br/guides/`. Plain-language opening first, then the command, options, wake behaviour, safety and a problem table; the background page has the launchd plist and the systemd unit, both with a `600` file.
- `apps/docs/docs.json` now uses `navigation.languages` (`en`, `pt-BR`). English keeps its groups and gains `Guides` with the two pages; `pt-BR` has only a `Guias` group with the two pages. The merge with the docs-IA branch (`feat/agent-inbox-core-docs`) must keep that branch's full tree and place these pages in it.

### How to run

```bash
pnpm --filter @zapbip/docs exec mint broken-links
```

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `mint broken-links` (3316b57, red) | `found 2 broken links in 2 files`: `/guides/background-running` and `/pt-br/guides/background-running` | the background pages exist (8c19e93) |

### Hypotheses to attack

1. Hypothesis: neither page contains a real secret. Break it by: grep both languages for the secret used in tests.
2. Hypothesis: the plist and unit start the connector on a real macOS and Linux. Break it by: following the page on each, with `which npx` for the path. Not run by the developer.
3. Hypothesis: the pt-BR pages mirror the English ones. Break it by: comparing headings and code blocks.

### Known gaps

- The pages describe the command from the spec; they were not checked against the built connector (the connector lanes are separate).
- The connection link's host is a placeholder: the real host and the install flow belong to other slices.
- No repository-shape twin test exists on this branch; it lives on `feat/agent-inbox-core-docs`.

## L3a, L4a, L6 (sockets and waker, acknowledge, verify gate)

### What changed

- `apps/api/src/account-inbox/connector-sockets.ts`: the four contract functions, plus `parseDoneFrame({data})` returning `{ok: true, frame} | {ok: false, reason: FrameRejectionReason}`. A non-string payload is `binary_frame`; a text payload over `CONNECTOR_FRAME_MAX_BYTES` UTF-8 bytes is `frame_too_large`, checked before `JSON.parse`; a non-object or a `done` without a string `messageId` is `malformed`; any other `type` is `unknown_type`. L3b's `webSocketMessage` is expected to call it and ignore a rejection.
- `apps/api/src/adapters/wake/local-connector-waker.ts`: `notify` lists up to `CONNECTOR_INBOX_LIMIT` unread messages and sends one `messages` frame; `Woken` only when a socket received it.
- `libs/core/src/inbox/use-cases/acknowledge-delivery.ts`: marks read only an existing owner message of the given agent.
- `scripts/verify-gates.tsv`, `scripts/verify.sh`, `scripts/verify.test.sh`, `AGENTS.md`: connector row `typecheck unit e2e` above `apps/*`; `gate_e2e` also runs `pnpm --filter zapbip test:e2e` then `test:packaging`.

### How to run

`pnpm --filter @zapbip/api test:unit`, `pnpm --filter @zapbip/core test:unit`, `pnpm test:verify`.

### Red then green

| Test | Red before | Green after |
|------|------------|-------------|
| `apps/api/test/unit/local-connector-waker.test.ts` (20 cases, `ee87f26`) | `createLocalConnectorWaker`, `connectorAgentOf`, `remainingSocketCount`, `acceptConnectorSocket`, `parseDoneFrame is not implemented` | `8127931` |
| `libs/core/src/inbox/use-cases/acknowledge-delivery.test.ts` (6 cases, `0bcd490`) | `acknowledgeDelivery is not implemented` | `2b39869` |
| `scripts/verify.test.sh` connector cases (`030f1e9`) | 3 checks failed: row fell through to `apps/*`, no connector e2e or packaging call | `4438217` |

### Hypotheses to attack

1. The waker never sends to a socket of another agent. Break it by: two agents with sockets, owner message for one.
2. A frame of exactly `CONNECTOR_FRAME_MAX_BYTES` bytes is accepted and one byte more is rejected, including multibyte text. Break it by: boundary payloads in `é`-style characters.
3. `acknowledgeDelivery` never marks an agent's own outbound message or another agent's message. Break it by: `done` for such ids through a real socket (L3b).
4. A connector-only change runs the connector e2e and packaging suites and not the API integration suite.

### Known gaps

- `acceptConnectorSocket` is unit tested with a stubbed `WebSocketPair` global; the real pair is covered only by L3b's integration tests.
- The connector gate runs its e2e suite for every API-side e2e run too (`gate_e2e` is not split by package).
- `parseDoneFrame` is an addition to the contract, used by L3b.

## Lane L2 (connector loop, process and CLI)

### What changed

- `apps/connector/src/connect.ts`: link derivation, backoff, probe, frame parser, `runConnection` (pre-flight, hibernatable socket client, heartbeat, reconnect, hello and messages handlers, `done` through L1's queue).
- `apps/connector/src/wake-runner.ts`: `runWake` spawns the client with no shell, times out with `SIGTERM`, falls back once for Codex's active writer.
- `apps/connector/src/cli.ts`: `parseConnectArguments`, the `connect` command, a record of commands keyed by subcommand, the link from `ZAPBIP_CONNECTION_URL` or a prompt.
- Tests and support: `test/unit/{cli,connect}.test.ts`, `test/integration/{connect,wake-runner,cli}.test.ts`, `test/support/{fake-event-server,fake-client-binary}.ts`, `test/fixtures/bin/{claude,codex}` (`codex` is a symlink to `claude`).

### Deviations from the contract (both in files this lane owns)

- `parseServerFrame` takes `isBinary`, because `{text, byteLength}` cannot express a binary frame.
- `runWake` takes an optional `signal`, so shutdown reaches the running child.
- `runWake` still returns `NoSession`; the rejection L1's queue needs (no `done` for an unread message) is thrown by the wake callback inside `runConnection` after it logs `wake_finished` with `no_session`.
- The pre-flight lives in `runConnection` (the probe link is the socket link over `http:`/`https:`), so the 401, 426 and 500 cases are testable there. It runs once, at start, not on reconnect.

### How to run

`pnpm --filter zapbip test:unit` (unit and fake-server integration, 131 tests). The CLI integration test bundles `src/cli.ts` with esbuild into a temp folder and runs it against a TLS fake server with a certificate made by `openssl` at run time; the child gets `NODE_TLS_REJECT_UNAUTHORIZED=0`.

### Red then green

| Test | Red before | Green after |
|------|------------|-------------|
| `test/unit/cli.test.ts`, `test/unit/connect.test.ts` (`588510d`) | `parseConnectArguments`, `deriveConnectorLinks`, `reconnectDelayMs`, `parseServerFrame is not implemented`; 20 failed, 8 passed (the 8 are throw-expected refusals, pins) | `be12109` |
| `test/integration/connect.test.ts`, `wake-runner.test.ts`, `cli.test.ts` (`b2fda48`) | `runConnection is not implemented`, `runWake is not implemented`, and 5 s timeouts waiting for a socket or a child run; 47 failed | `a5ee55d` (runner), `be12109` (loop, CLI) |

### Hypotheses to attack

1. A message is woken at most once per process, and a `done` lost with the socket is answered on the next connect without a wake. Break it by: dropping the socket at the instant a wake ends.
2. A replaced connector never reconnects and never sends `done`. Break it by: close code 4001 while a wake runs.
3. The secret is in no argv, log line or error text. Break it by: unusual links (userinfo, query, uppercase `/MCP`) and failing fetches.
4. Shutdown sends no `done` for a wake it killed. Break it by: `SIGTERM` at the moment the child exits.
5. `CLAUDE_CONFIG_DIR` and `CODEX_HOME` reach the lookup when set. Break it by: setting only one.

### Known gaps

- Heartbeat and reconnect timing use vitest fake timers over real sockets; if Node changes how its WebSocket or fetch schedule timers, these tests are the first to move.
- A `401` on the upgrade itself (after a `426` probe) is not distinguishable with Node's WebSocket and is handled as an ordinary close with backoff.
- The Codex rollout layout in the fake (`sessions/YYYY/MM/DD/rollout-*.jsonl`, first line `session_meta`) is copied from L1's lookup, not from a real install.
- Real `claude` and `codex` are never run.

### Lane listen (LN1 to LN8): `npx zapbip listen` and `npx zapbip channel`

- `apps/connector/src/connect.ts` — the socket loop moved into `runSocketSession` (probe, heartbeat, reconnect, frames, `done`); `runConnection` is now a thin wrapper that supplies the wake queue. Behaviour of `connect` is unchanged.
- `apps/connector/src/{listen,channel,owner-notice}.ts` — `runListen` prints `{"messageId","kind","sender":"owner","verified":true,"text"}` per owner message and sends `done` after printing; `runChannel` is a stdio MCP server declaring `experimental['claude/channel']` that sends `notifications/claude/channel` with escaped `content` and `meta {sender: "owner", verified: "true"}`. Both reuse `createWakeQueue`, so a redelivered message is relayed once and acknowledged again.
- `apps/connector/src/log.ts` — `logConnectorEventToStderr`; `listen` and `channel` log to stderr because stdout is the data stream.
- `apps/connector/src/cli.ts` — `listen` and `channel` in `COMMAND_HANDLERS`; neither takes arguments; `channel` reads only `ZAPBIP_CONNECTION_URL`.
- `libs/types/src/connector.ts` — channel constants and `ConnectorLogStream`. `apps/connector/package.json` — `@modelcontextprotocol/sdk` 1.32.2 and `zod` 4.6.7 as dev dependencies (bundled by esbuild).
- Docs: `apps/docs/guides/local-connector.mdx` and the `pt-br` twin, section "Keep an open session listening".
- Run: `pnpm --filter zapbip test:unit` (owner-notice, log, listen and channel integration included), `pnpm --filter zapbip typecheck`.
- Red then green: 793b9f0 to 10d0913. Red text as printed: 19 failed; unit cases `buildOwnerNotice|formatListenLine|buildChannelNotification is not implemented`; integration cases `Test timed out in 5000ms` and `McpError: MCP error -32000: Connection closed`. Pins (green at red): refused link exits 1, argument rejected, missing link for `channel` exits 1.

Hypotheses:

1. `listen` standard output holds only message lines. Break it by: reconnect, a `401` mid-run, a hostile message text with newlines.
2. A message is acknowledged only after it is printed or notified, and a notify failure leaves it unacknowledged. Break it by: closing the MCP client mid-relay.
3. Owner text cannot close the channel block. Break it by: `&lt;` look-alikes, newlines, a caption.
4. Neither command puts the secret in argv, stdout or stderr. Break it by: `ps`, a grep of a full run.
5. `listen` stays alive for any number of short sessions (the OpenClaw `stream` job). Break it by: many drops in a row.
6. `channel` exits when Claude Code closes its end. Break it by: closing stdin while the socket is mid-reconnect.

Gaps: LN6 (launch flag and server-name rule for a Claude Code channel) is not confirmed against the channel reference; the docs name no flag. The channel was exercised only by an SDK client, never by Claude Code. The `done` for a message arrives only if the socket is open at that moment; otherwise the next redelivery prints nothing and acknowledges.
