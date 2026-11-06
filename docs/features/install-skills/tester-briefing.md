# Tester briefing: Install skills

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## Step 0 (959cdd4)

Contract only, no behaviour change. `InstallClient` (ten clients), `WakeMode` and `WakeRung` copied from scheduled-wake, install constants and `AGENT_RULES` are real; the install section renderers, `renderInstallPage`, `pickStandbyAgent`, `readInitializeClientName` and `createInstallPageRoute` throw `… is not implemented`. Nothing is tested yet.

## Lane L2 (API) (0c65f4d red, 585b437, 3b7b292)

### What changed

- `apps/api/src/mcp/client-name.ts`: `readInitializeClientName` (zod `safeParse` inside a `try` around the JSON parse), `recordConnectionActivity` (POST only; first-call write when `firstCallAt` is `null`; name write when `clientName` is `null` and `Content-Length` is present and at most `INITIALIZE_BODY_MAX_BYTES`; both handed to `schedule`) and `createConnectionRecorders` (`UPDATE connections SET client_name = ? WHERE id = ? AND client_name IS NULL`).
- `apps/api/src/routes/mcp.ts`: after `resolveConnection`, loads the connection record with `findActiveByAgent` and calls `recordConnectionActivity` with `executionCtx.waitUntil`.
- `apps/api/src/mcp/server.ts`: `instructions: AGENT_RULES` and the `zapbip-rules` prompt.
- `apps/api/src/routes/install-page.ts` (+ `install-page-copy.ts`): `GET /i/:installCode`. Order: client address (`cf-connecting-ip`, `400` when missing), limiter (`429` + `Retry-After: 60`), `InstallCodeDirectory.resolve`, then `404` (Unknown), `410` localized (Expired, Used) or the Markdown page (Ready). Every response carries `Cache-Control: no-store` and `X-Robots-Tag: noindex`.
- `apps/api/src/install/install-page-adapter.ts`: `joinStandbyCandidates`, `createInstallCodeDirectory` and `createInstallPageDependencies`; `app.ts` mounts the route at `/i/*`, building the dependencies per request.
- `INSTALL_PAGE_LIMITER` binding (`wrangler.jsonc`, both environments, namespace `1004`, 30 per 60 s), `Bindings`, `HttpStatus.TooManyRequests`, `wrangler-limits.test.ts` ties it to `INSTALL_PAGE_REQUESTS_PER_MINUTE`.
- `index.ts` and `index.dev.ts` pass the `ExecutionContext` to `app.fetch`; `production-entry.test.ts` passes `createExecutionContext()`.

### How to run

```bash
pnpm --filter @zapbip/api test:unit
pnpm --filter @zapbip/api test:integration
```

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `test/unit/client-name.test.ts` (all) | `Error: readInitializeClientName is not implemented`, `recordConnectionActivity is not implemented` | 585b437 |
| `test/unit/install-page-adapter.test.ts` (all) | `Error: joinStandbyCandidates is not implemented` | 585b437 |
| `test/integration/mcp-install.test.ts` IS-W1 | `AssertionError: expected undefined to be 'Call check_inbox at the start of ever…'` | 585b437 |
| `test/integration/mcp-install.test.ts` IS-W2, W4, W4b, W5, W6, W8 | prompt missing; `AssertionError: expected null to be 'Claude Code'`; `expected null not to be null` | 585b437 |
| `test/integration/install-page.test.ts` (page route cases) | `Error: createInstallPageRoute is not implemented` | 3b7b292, and the cases that render the body need the core page (L1) |

Cases that stay red until L1 merges (they reach `renderInstallPage` or `pickStandbyAgent`, still stubs): IS-W3 (both locales), IS-W5b, IS-W8 (both locales, the first `200`), IS-W9b, IS-W11 (both), IS-W12, IS-W14, IS-S2. With throwaway shims for the two stubs all 27 integration cases of the two files passed; the shims were reverted and not committed.

### Hypotheses to attack

1. Hypothesis: the page is `410` right after the first POST to the MCP route, not after the first page read. Break it by: `GET` the page twice, then one `initialize`, then `GET` again.
2. Hypothesis: a second `initialize` never overwrites `clientName`, and `firstCallAt` is written once. Break it by: two `initialize` calls with different names, then read both columns.
3. Hypothesis: a body over `INITIALIZE_BODY_MAX_BYTES`, a body without `Content-Length`, a batch, text that is not JSON or a name over `CLIENT_NAME_MAX_CHARS` never fails the MCP request and never writes a name. Break it by: chunked request without a length, 4 097 byte body, 129-character name.
4. Hypothesis: a standby with quotes or a newline cannot break out of the `set_wake` line (L1 owns the escape; the route passes the name through untouched). Break it by: an agent named `a"); evil(`.
5. Hypothesis: no log line carries the install code or the secret. Break it by: capture `console.log` over a `200`, `410`, `404` and `429`.

### Known gaps

- `webhook-wake` is not in this branch: `listWakeModes` does not exist on `AccountInbox`, `AccountInboxRpc` or `WakeRepository` yet. `createInstallPageDependencies` calls `accountInboxOf<AccountInboxRpc & { listWakeModes }>(…).listWakeModes()`, so a `Ready` page served by the mounted app fails until the webhook-wake merge adds that method (a `SELECT agent, mode FROM agent_wake` returning `{agent, wakeMode}[]`). The route cases pass a fake `readWakeModes`, so the gated tests do not see it. The merge of `origin/feat/webhook-wake` into this lane conflicts in 12 files (`account-inbox.ts`, `constants.ts`, migrations, `env.ts`, `log.ts`, e2e `global-setup.ts`, `account-inbox.test.ts`, both README indexes, `receive-owner-message.ts`, `libs/core/src/index.ts`, `libs/types/src/enums.ts`), so it was aborted and left to the lead.
- The `410` text is a route-local copy (`apps/api/src/routes/install-page-copy.ts`) because the core `INSTALL_PAGE_COPY` is still a stub of unknown shape; dedupe against L1's copy when it lands.
- `readWakeModes` takes `{ accountId }` (the S0 stub took no argument, but the account is only known after the lookup).
- IS-S3 and IS-S4 (the store holds no plaintext, the seal opens only with the code) and IS-S1 are `accounts-and-keys` tests and were not rewritten here. IS-S5 asserts only that nothing is logged by the route.
- A request without `cf-connecting-ip` gets `400`; Cloudflare sets the header in production; that `wrangler dev` sets it is unverified (OR script).
- `firstCallAt` is written on the first POST that resolves a connection, whatever the tool or its outcome, per assumption A6.

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

## Lane L3 (docs, parity, owner-run script)

Commits: 60d4318 (red, `test(docs): pin the install guides`), 20f4c5b (guides), 14327ab (script).

What changed:

- `apps/docs/agents/<client>.mdx` and `apps/docs/pt-br/agents/<client>.mdx`: ten guides and ten twins; each has "What works", "Set up from zero" (Steps, the last Step is the self-test) and "How your AI listens". Generated once from a scratch script, then committed as plain MDX.
- `apps/docs/docs.json`: the ten guides in the `Agents` and `IAs` groups.
- `tools/repository-shape/src/install-guides.test.ts` (IS-D1, IS-D4 plus placeholder, pinned-version and forbidden-word checks), `libs/core/src/install/guide-parity.test.ts` (IS-D2, IS-D3), `tools/repository-shape/src/install-e2e.test.ts` (IS-D7).
- `tools/install-e2e/claude-code.sh`: owner-run; `--check-redaction` is the flag the test uses.

How to run: `pnpm --filter @zapbip/repository-shape test:unit`, `pnpm --filter @zapbip/core test:unit`, `cd apps/docs && pnpm dlx mint@4.2.1207 broken-links` (green, no broken links).

Red today, green after:

| Test | Red before because | Green after because |
|---|---|---|
| `install-guides.test.ts` (82 tests) | `ENOENT: no such file or directory, open '.../apps/docs/agents/chatgpt.mdx'` | the guides and navigation exist |
| `guide-parity.test.ts` twin and IS-D3 cases (40) | the same `ENOENT` | the guides exist |
| `install-e2e.test.ts` (3 tests) | the script does not exist | the script exists |
| `guide-parity.test.ts` IS-D2 against the section (10) | `ENOENT` | still red until L1 merges: the section renderers throw `… is not implemented` |

Hypotheses to attack:

1. The actions of each guide's "Set up from zero" (first occurrence, in order, among `claude mcp remove|add`, `gemini mcp add`, `npx zapbip@<v> connect|listen|channel`, `set_wake`, `claude -p`, `codex exec`, `gemini -p`, `check_inbox`, `send_message`) equal those of its section once L1 lands; I matched them against the plan's section table by hand. Break it by: merging L1 and running IS-D2.
2. The script never prints the connection URL: every subprocess goes through `redact`. Break it by: a run with `claude` printing the URL in an error.
3. The guides never mention a fake WhatsApp, a simulator or localhost (checked by test). Break it by: grepping the rendered docs.

Known gaps:

- IS-D2 against the real sections is red until L1 merges; if L1 words an action or orders `set_wake` modes differently (claude.ai: `none` before `webhook`; Grok web: `standby` before `none`), fix the guide, not the test.
- `npx zapbip@<version>` stays a placeholder in the guides; no exact version exists until the owner publishes the package.
- The guides state the Claude Code channel launch command from the cross-slice decisions; the section may not mention it (not in the action pattern).
- `install-guides.test.ts` imports `../../../libs/types/src/enums` by relative path because `tools/repository-shape/package.json` has no `@zapbip/types` dependency and L3 does not own it.
- `claude-code.sh` was run only through `bash -n` and `--check-redaction`; the live run needs `claude`, `wrangler dev` and the owner. It stops `pnpm` but may leave a `workerd` child to exit with its parent.
