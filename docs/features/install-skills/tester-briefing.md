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
