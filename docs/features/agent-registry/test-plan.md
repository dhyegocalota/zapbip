# Test plan: Agent registry

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

Areas: **R** generator, **G** guard (add and remove), **I** install, **D** docs pages, **C** connector, **P** plugins, **B** boundaries, **F** facts and folded tests, **M** mutations, **W** Playwright walks, **O** owner-run.

## The failing test first

- [ ] `libs/agents/generate/discover.test.ts::lists the folders under supported in name order` — input: roots `[libs/agents/testing/fixture-agent, libs/agents/testing/fixture-plugin-agent]`; expected: ids `fixture-agent`, `fixture-plugin-agent`. Red: `Error: discoverAgents is not implemented`.
- [ ] `tools/repository-shape/src/agent-registry.test.ts::a fixture agent folder appears everywhere` — red: `Error: planGeneratedFiles is not implemented`.
- [ ] `libs/agents/supported/cursor/install.test.ts::renders the section it rendered before` — red: `Error: cursor install section is not implemented`.
- [ ] `agent-registry.test.ts::every agent page in apps/docs is the copy of its folder page` — red: 22 violations `<id> has no page.<lang>.mdx`.
- [ ] `libs/agents/supported/codex/connector.test.ts` — red: `Error: codex connector runtime is not implemented`.
- [ ] `libs/agents/src/checks/plugins.test.ts` — red: `Error: hermes plugin facet is not implemented`.
- [ ] `agent-registry.test.ts::no file outside an agent folder names an agent` — red: the list in plan Step 22, each with file and line.
- [ ] Confirmed: each red run fails on the stub or the named assertion, never on a broken import. The printed text is pasted into `tester-briefing.md`.

## R. Generator (`libs/agents/generate/*.test.ts`)

- [ ] Folder name `Cursor` (uppercase) — expected: violation `supported/Cursor: the folder name must match ^[a-z][a-z0-9-]*$`.
- [ ] Folder named `supported-agents` — expected: violation `supported-agents is the matrix page`.
- [ ] Folder without `definition.ts` — expected: violation naming the folder; no output for it, no deletion.
- [ ] Two definitions with `enumMember: 'Codex'` — expected: violation naming both folders.
- [ ] `enumMember: 'chat_gpt'` — expected: violation `enumMember must be PascalCase`.
- [ ] Order — input: the eleven definitions; expected: `claude-code, codex, cursor, gemini-cli, hermes, openclaw, claude-ai, grok-bot, chatgpt, grok-web, any-mcp-client`.
- [ ] `ids.ts` — expected: `AgentId` has 11 members with today's names and values; `InstallClient` 10; `ConnectorClient` `ClaudeCode`, `Codex`; `PluginAgent` `Hermes`, `OpenClaw`; the first line is the `// NB ADR 0033:` pointer.
- [ ] Matrix en — input: delay `7`, `3600`, `null`; expected cells: `7 seconds`, `1 hour`, `Not measured`; pt-BR: `7 segundos`, `1 hora`, `Não medido`; rung cells from `WAKE_RUNG_LABELS`.
- [ ] `expectedDelaySeconds: 0` or `-1` — expected: violation `expected delay must be positive or null`.
- [ ] Nav — expected: `Agents` = `['agents/supported-agents', …11 in order]`, `IAs` = the `pt-br/` twins in the same order; every other group byte-identical.
- [ ] Nav with a foreign page `guides/webhook-wake` in `Agents` — expected: violation naming it.
- [ ] Page with headings out of order (pt-BR) — expected: violation `<id> page.pt-br.mdx: expected O que funciona | Como ela escuta | Configure do zero | Confira se funciona but found …`.
- [ ] A page missing one of its `pageFacts` — expected: violation naming the agent, the language and the string.
- [ ] Orphan `apps/docs/agents/ghost.mdx` with no folder — expected: deletion planned for that path and its pt-br twin, nothing else.
- [ ] Idempotence — run `agents:generate` twice; expected: the second run writes 0 files.
- [ ] Working directory — run the CLI from `apps/docs`; expected: the same plan as from the root.
- [ ] `agents:check` on a fresh tree — expected: exit 0, prints `0 stale, 0 deletions, 0 violations`.

## G. Guard (`tools/repository-shape/src/agent-registry.test.ts`)

- [ ] **G1 Add:** plan(real agents + `testing/fixture-agent`) compared with plan(real agents). Expected: the changed paths are exactly `libs/agents/src/generated/ids.ts`, `libs/agents/src/generated/definitions.ts`, `libs/agents/src/generated/install.ts`, `libs/agents/testing/fixture-agent/install.en_US.md`, `libs/agents/testing/fixture-agent/install.pt_BR.md`, `apps/docs/agents/fixture-agent.mdx`, `apps/docs/pt-br/agents/fixture-agent.mdx`, `apps/docs/snippets/agents/matrix.mdx`, `apps/docs/snippets/pt-br/agents/matrix.mdx`, `apps/docs/docs.json`. No other path.
- [ ] **G1 content:** `ids.ts` holds `FixtureAgent = 'fixture-agent'` in `AgentId` and `InstallClient`; both matrices have one `[Fixture Agent](/agents/fixture-agent)` / `[Agente de teste](/pt-br/agents/fixture-agent)` row; `Agents` and `IAs` list the page; `renderInstallPage` given the planned sections holds `## Fixture Agent` once and names `Fixture Agent` in "Identify your product"; guide parity, the install-section checks, the heading checks and the listen-token checks each list `fixture-agent` among the agents they checked, with 0 violations.
- [ ] **G2 Confinement:** a spy on `readSource` while planning the fixture. Expected: every path read for `fixture-agent` starts with `libs/agents/testing/fixture-agent/`.
- [ ] **G2b Plugin fixture:** plan + `testing/fixture-plugin-agent`. Expected: the G1 set plus `libs/agents/src/generated/plugins.ts`; the plugin check lists `fixture-plugin-agent`.
- [ ] **G3 Remove:** plan(real agents − `supported/cursor`). Expected: deletions exactly `apps/docs/agents/cursor.mdx`, `apps/docs/pt-br/agents/cursor.mdx`. No planned file contains `agents/cursor`, `Cursor = 'cursor'` or `[Cursor](`. Each matrix has 10 rows. The install page has no `## Cursor`. Every check passes. Note: `api2.cursor.sh` in the Grok Bot page is not a match, so the assertion uses the tokens above, not the word.
- [ ] **G4 No leak, every agent:** for each of the 11 ids, no file outside `libs/agents/supported/<id>/**` and the generated outputs references its enum members or `supported/<id>`. Expected: 0 hits ×11.

## I. Install

- [ ] Each of the 22 moved renders (10 agents × 2 locales, 2 of them the Grok web standby pair; named `<id>.en_US.md`, `<id>.pt_BR.md`): `git diff -M origin/main` shows a 100% rename from `libs/core/src/install/snapshots/` and 0 content lines changed.
- [ ] `apps/api` integration `GET /i/:code` (valid) — expected: body byte-identical to the body on `origin/main` for a seeded code, except the section order (rung then name); same `Cache-Control: no-store`, `X-Robots-Tag: noindex`.
- [ ] `libs/core/src/install/render-install-page.test.ts::renders only the sections it is given` — input: two synthetic sections `Alpha`, `Beta`; expected: `## Alpha`, `## Beta`, "Identify your product" names exactly `Alpha, Beta`.
- [ ] `libs/core` imports no `InstallClient`. Expected: `git grep -n InstallClient -- libs/core` returns 0 lines.
- [ ] Install-section checks over `AGENT_INSTALLS`. Expected for each of 10 × 2 locales: first step is the stop check, last step is the localized self-test, every step ends with `Success:`, set_wake modes ⊆ `setWakeModes`, `zb_conn_` only inside the link, two renders identical.
- [ ] `install-set-wake-modes.test.ts` — expected: every mode named by any section is accepted by the server schema, for 10 agents.
- [ ] Guide parity — expected: for each step-guide agent, the actions in the page's set-up section (found by heading) equal the section's actions in order.

## D. Docs pages

- [ ] `git diff origin/main -- apps/docs/agents apps/docs/pt-br/agents ':!*supported-agents*'` — expected: empty.
- [ ] `git diff -M --stat` for Step 15 — expected: 22 renames at 100% into `libs/agents/supported/*/page.*.mdx`.
- [ ] Matrix pages — expected: the table is gone from both hand-written pages; each imports `/snippets/agents/matrix.mdx` or `/snippets/pt-br/agents/matrix.mdx` once.
- [ ] `mint broken-links` (gate `docs`) — expected: exit 0.

## C. Connector

- [ ] `git diff -M origin/main` for Step 18 — expected: the moved functions are identical except imports. The security reviewer confirms with `git diff -M -w`.
- [ ] Moved `connector.test.ts` for both runtimes — expected: the same case count as the source tests had for that runtime (record the counts).
- [ ] `apps/connector` `test:unit`, `test:e2e`, `test:packaging` — expected: green; the usage line reads `--client claude-code|codex`.
- [ ] `local-connector.e2e.test.ts` — expected: runs once per `ConnectorClient` (2).
- [ ] Developer pages en and pt-br — expected: the runtime paragraphs render through the snippet; their text equals the text on `origin/main`.

## P. Plugins

- [ ] Every `apps/*-plugin` is claimed by exactly one `plugin.ts` — input: today's tree; expected: `hermes-plugin` → hermes, `openclaw-plugin` → openclaw.
- [ ] Version pins — expected: every pin in both `plugin.ts` files matches `ZAPBIP_NPM_VERSION` (OpenClaw) or `ZAPBIP_HERMES_PLUGIN_VERSION` (Hermes), the same lines `plugin-versions.test.ts` checks today.
- [ ] `apps/hermes-plugin` pytest including `test_constants_parity.py` — expected: green after removing `ChannelPluginProduct`.
- [ ] `test:e2e:clients` with Docker (opt-in) — expected: the same cases pass as on `origin/main`, now under `channel-plugins.e2e.test.ts`, once per plugin.
- [ ] Deploy preflight — expected: the published package specs equal `zapbip@<v>` and `@zapbip/openclaw-plugin@<v>`, read from `AGENT_PLUGINS` (every `PluginRegistry.Npm` entry); Hermes is not in them (ADR 0034).
- [ ] Hosted artifacts — expected: `GET /pkg/<wheel>` and `GET /pkg/<requirements>` return the same bytes, `content-type` and 404s as on `origin/main` (`package-route.test.ts`, import changes only); the preflight wheel step refuses with the same text; `HERMES_INSTALL_COMMAND` is read from `supported/hermes` and `hermes-wheel.e2e.test.ts` passes unchanged; the hash rewrite of `scripts/hermes-wheel/build.ts` lands in `supported/hermes/wheel.ts`.
- [ ] `@zapbip/core` no longer exports `HERMES_INSTALL_COMMAND`. Expected: `git grep -n HERMES_INSTALL_COMMAND -- libs/core apps/docs tools` returns 0 lines outside `libs/agents`.

## B. Boundaries

- [ ] B1 `libs/core` and `libs/types` import no `@zapbip/agents`. Expected: 0 hits.
- [ ] B2 An agent folder imports no other agent folder and no `apps/*`. Expected: 0 hits.
- [ ] B3 `definition.ts`, `install.ts`, `install-copy.ts`, `plugin.ts` import no `node:` module. Expected: 0 hits.
- [ ] B4 `apps/api/src` imports only `@zapbip/agents/install` and `@zapbip/agents/plugins`. Expected: 0 other subpaths.
- [ ] B5 Worker bundle: `wrangler deploy --dry-run --outdir <scratchpad>`. Expected: gzip size within +1% of S4; the bundle contains none of `Set up from zero`, `Configure do zero`, `How it listens`.
- [ ] B6 `apps/connector/dist/cli.js` contains none of the page headings, and its size is within +2% of S4.
- [ ] B7 `libs/types/src` declares no agent enum. Expected: no `AgentId`, `InstallClient`, `ConnectorClient`, `DocsOnlyClient`, `ChannelPluginProduct`.

## F. Facts and folded tests

- [ ] The rung and delay checks of `docs-experience.test.ts` read `AGENT_DEFINITIONS`. Expected: no `CLIENT_LISTEN_FACTS` left (`git grep` 0).
- [ ] The background-running link is allowed exactly on the pages of agents with a connector facet (claude-code, codex), in both languages.
- [ ] `install-e2e.test.ts` iterates the agents with `install-e2e.sh`. Expected: 1 (claude-code); every existing assertion holds at the new path.

## M. Mutations (break it, see red, restore)

- [ ] M1 Add a word to `apps/docs/agents/cursor.mdx`. Expected: `every generated file is fresh` fails naming the path and `run pnpm agents:generate`.
- [ ] M2 Delete `apps/docs/pt-br/agents/cursor.mdx`. Expected: the same test fails with `missing generated file`.
- [ ] M3 Add `apps/docs/agents/ghost.mdx`. Expected: fails with `pending deletion apps/docs/agents/ghost.mdx`.
- [ ] M4 Swap two headings in `supported/codex/page.pt-br.mdx`. Expected: violation with the expected order.
- [ ] M5 Set codex `rung: WakeRung.Webhook` and regenerate. Expected: the matrix row changes and the listen check fails (`page says Local`).
- [ ] M6 Add `const X: Record<InstallClient, string>` in `libs/core/src/install/render-install-page.ts`. Expected: the leak test names the file.
- [ ] M7 Import `@zapbip/agents/docs` in `apps/api/src/routes/install-page.ts`. Expected: B4 fails.
- [ ] M8 Add `import { readFileSync } from 'node:fs'` to `supported/cursor/install.ts`. Expected: B3 fails.
- [ ] M9 Remove the terminal-listen step from the Cursor section. Expected: guide parity fails naming cursor.
- [ ] M10 Make the nav renderer skip pt-BR. Expected: G1 fails naming `docs.json` `IAs`.
- [ ] M11 Delete `supported/hermes/plugin.ts`, keep `apps/hermes-plugin`. Expected: the plugin claim check fails naming `apps/hermes-plugin`.
- [ ] M12 For each folded test (`install-guides.test.ts` IS-D1, IS-D4; `docs-agent-install.test.ts` chmod 600, one-listener sentence): remove the guarded text from one page. Expected: a surviving registry check goes red. Record each mutation and the catching test.

## W. Playwright MCP (from the owner's seat; `mint dev` on a free port)

- [ ] W1 Nav en and pt-BR at 1280: `Agents` and `IAs` list the matrix first, then the 11 agents in the planned order; every link opens a 200 page.
- [ ] W2 Supported agents en and pt-BR: 11 rows; Claude Code `Local · 7 seconds`; ChatGPT `Scheduled · 1 hour` / `Agendada · 1 hora`; Grok na web `Em espera · Não medido`; each page link works.
- [ ] W3 Claude Code, Hermes and Grok on the web pages in both languages: the four headings, the rung label, the self-test chat; text identical to `origin/main` screenshots.
- [ ] W4 Narrow width 375: the matrix scrolls horizontally, no overflow off the page; nav opens.
- [ ] W5 Console and network clean on all of the above: zero errors, zero failed requests.
- [ ] W6 Install page on `wrangler dev`: `GET /i/<seeded code>` shows the ten sections; the Claude Code section text equals `supported/claude-code/install.en_US.md`.
- [ ] Screenshots at `.pr-media/agent-registry/`; video of W1 to W3.

## O. Owner-run (scratch worktree, outside the gate)

- [ ] O1 Add: `pnpm agents:new demo-agent`, edit the names, `pnpm agents:generate`. Expected: `git status --porcelain` shows only `libs/agents/supported/demo-agent/` and the generated set of G1 (with `demo-agent`); `pnpm verify all` green; `mint dev` shows the page in both languages, in the nav and in the matrix; the install page names Demo Agent.
- [ ] O2 Remove: `rm -r libs/agents/supported/demo-agent`, `pnpm agents:generate`. Expected: `git status --porcelain` empty.
- [ ] O3 Remove a real agent (cursor) in a throwaway worktree, regenerate. Expected: typecheck green, `pnpm verify all` green, `mint broken-links` exit 0; `pnpm agents:mentions cursor` lists only illustrative mentions (if any), each with its path.

## Edge cases found during execution

Empty on purpose.

## Adversarial review

- [ ] Claim 1: "the install page is byte-identical apart from section order" — attack: render on `origin/main` and on the head for both locales, with and without a standby, and diff after sorting the sections; result: <refuted | held>
- [ ] Claim 2: "removing a folder needs no other edit" — attack: O3 for the agent with the most cross-references (claude-code: connector runtime, install-e2e, background running); result: <refuted | held>
- [ ] Claim 3: "the Worker never bundles docs content" — attack: B5 grep plus a dependency trace from `install-page.ts` with `esbuild --metafile`; result: <refuted | held>

## Coverage honesty

- The hosted Mintlify build is not exercised, only `mint dev` (as in ADR 0030).
- No real AI install is rerun. The section bytes are proved identical instead.
- The Docker plugin end to end is opt-in.
- The real `claude` and `codex` binaries are not run; the fakes are.
- Illustrative mentions are reported, not gated.
- An agent that needs a new pinned wake provider is out of scope (ADR 0019).
