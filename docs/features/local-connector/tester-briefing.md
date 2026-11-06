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
