# Tester briefing: Install skills

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## Step 0 (959cdd4)

Contract only, no behaviour change. `InstallClient` (ten clients), `WakeMode` and `WakeRung` copied from scheduled-wake, install constants and `AGENT_RULES` are real; the install section renderers, `renderInstallPage`, `pickStandbyAgent`, `readInitializeClientName` and `createInstallPageRoute` throw `… is not implemented`. Nothing is tested yet.

## What changed

- <file or module> — <one line>

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

## L1 core page (46a9448 red, 9ad1f1c, 4375cb8)

### What changed

- `libs/core/src/install/pick-standby-agent.ts`: newest candidate whose wake mode is not `None`, `Scheduled` or `Standby`, never the agent itself, strict `>` so a tie keeps the first listed.
- `libs/core/src/install/render-install-page.ts`, `install-page-copy.ts` (now an object per locale: `ownerLanguage`, `unsupportedProduct`, `expired`, `notFound`), `install-products.ts` (name and stop-check description per client).
- `libs/core/src/install/prompts/*`: ten sections, ten copy modules, `section-format.ts` (shared step numbering, stop check, self-test, Monitor listen step) and `connector-commands.ts` (pinned `npx zapbip@0.1.0`, connect and listen commands, 20-line failure output).
- Tests: `agent-rules.test.ts`, `pick-standby-agent.test.ts`, `render-install-page.test.ts`, `prompts/{sections,claude-code,codex,editor-clients,chat-clients}.test.ts`, `snapshots.test.ts` and 22 files in `snapshots/`.

### How to run

```bash
pnpm --filter @zapbip/core test:unit
```

### Red then green

| Test | Red printed | Green after |
|------|-------------|-------------|
| `prompts/sections.test.ts`, `codex.test.ts`, `claude-code.test.ts`, `editor-clients.test.ts`, `chat-clients.test.ts`, `snapshots.test.ts` | `Error: CODEX_COPY is not implemented` (also `CLAUDE_CODE_COPY`, `CURSOR_COPY`, `GEMINI_CLI_COPY`, `GROK_BOT_COPY`, `GROK_WEB_COPY`, `CHATGPT_COPY`, `CLAUDE_AI_COPY`, `HERMES_COPY`, `OPENCLAW_COPY`) | 4375cb8 |
| `pick-standby-agent.test.ts` | `Error: pickStandbyAgent is not implemented` | 9ad1f1c |
| `render-install-page.test.ts` | `Error: renderInstallPage is not implemented` | 4375cb8 |
| `agent-rules.test.ts` | pin, green on arrival | 46a9448 |
| dispatch and copy-locale tests in `sections.test.ts` | pin | 46a9448 |

### Hypotheses to attack

1. Every section ends with the localized self-test line and starts with a stop check naming only its own product.
2. The connection secret appears only inside the connection link, in every section and in the page.
3. A standby name with quotes or a newline stays inside the JSON string of the `set_wake` call.
4. Re-running Claude Code removes the old MCP entry first; Codex removes the old table before appending.
5. Rendering the same input twice gives the same text.

### Known gaps

- `WakeMode.Local` is not in `libs/types` (not mine). `pickStandbyAgent` excludes `None`, `Scheduled` and `Standby`, so a `local` value passes; the tests cast `'local' as WakeMode`. Add `Local` when local-connector's enum lands.
- `ZAPBIP_NPM_VERSION = '0.1.0'` sits in `prompts/connector-commands.ts` because `libs/types` is not mine and `apps/connector/package.json` has no version; move it to `libs/types/src/constants.ts` and bump it to the published version.
- The Claude Code channel command is the briefed one and unverified (OR-11); Hermes and OpenClaw commands carry `(verify)`.
- The plan text says eight section tests and 14 snapshots; the lane writes 5 section test files for ten clients and 22 snapshots (A12).
