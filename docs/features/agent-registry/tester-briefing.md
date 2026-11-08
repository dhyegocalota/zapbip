# Tester briefing: agent-registry

## C0 contract (developer-c0)

### What changed and where

- `libs/agents` is a new workspace package (`@zapbip/agents`): `package.json`, `tsconfig.json`, `vitest.config.mts`, `README.md`. Root scripts `agents:generate|check|new|mentions` point at `libs/agents/generate/cli.ts`. `scripts/verify-gates.tsv` maps `libs/agents/*` to `typecheck unit integration e2e docs`; `scripts/verify.test.sh` pins it.
- `libs/agents/src/contract.ts` holds the contract types; `generate/{discover,plan,write,cli}.ts` and `src/order.ts` are stubs that throw `<name> is not implemented`.
- `libs/agents/src/docs.ts` holds the docs vocabulary moved from `tools/repository-shape/src/docs-experience.ts`, which re-exports it.
- `libs/agents/supported/<id>/definition.ts` for all eleven agents; `supported/hermes/plugin.ts` re-exports `HERMES_INSTALL_COMMAND` from `@zapbip/core` and `src/plugins.ts` re-exports it.
- `libs/agents/testing/`: `golden/` and `golden.test.ts` (pins), `definitions.test.ts`, three fixtures (`fixture-agent`, `fixture-connector-agent`, `fixture-plugin-agent`, with `fixture-plugin-package`) and `fixtures.test.ts`.

### How to run

`pnpm --filter @zapbip/agents test:unit` and `pnpm --filter @zapbip/agents typecheck`.

### Red then green

| Test | Red commit | Printed | Green commit |
|---|---|---|---|
| `testing/definitions.test.ts` | 99478700 | `AssertionError: expected [] to deeply equal [ 'any-mcp-client', 'chatgpt', ...(9) ]` on the first test; the other 77 fail with `AssertionError` or `TypeError: Cannot read properties of undefined (reading 'enumMember')` or `'docs'` | e84d79b7 |

Pins (green on landing): `testing/golden.test.ts` (feb42340), the docs vocabulary move (ae40e183).

### Hypotheses for the tester

- H1. Goldens equal the output on `origin/main` (1d11a4c): render the install page there for both locales, with and without a standby (`agent` Ana, standby Lia, link `https://golden.example/c/zb_conn_GOLDEN/mcp`) and diff against `golden/install-page.*.md` after sorting sections by heading.
- H2. The install-page goldens are canonical: sections sorted by heading and the "Identify your product" list sorted, so only `golden/order.json` depends on order (Step 13b).
- H3. Each `definition.ts` reproduces its matrix row in both languages byte for byte (cell-normalised) and its `setWakeModes` agree with the rendered sections.

### Gaps and deviations

- Order of work: Step 4a landed before Steps 3 and 4, as the owner asked (goldens first).
- Lane hand-offs the other lanes must know: `golden-sources.ts` reads the matrix from `apps/docs/agents/supported-agents.mdx` (L3 Step 16 moves the rows into the snippet, so `matrixRowsOf` changes there) and renders the page through `renderInstallPage({ agent, connectionLink, locale, standbyAgent })` (L2 Step 12 changes the signature, so `installPageOf` changes there). `definitions.test.ts` reads `INSTALL_SECTIONS` from `@zapbip/core` for the set_wake check (L2 deletes it; Step 13 moves the check to the registry).
- `supported/openclaw/plugin.ts` was not created: `OPENCLAW_INSTALL_COMMAND` is not exported by `@zapbip/core` and `libs/core/src/install/index.ts` is not a C0 file. L2 creates it with the command.
- `apps/docs/e2e/agents-b.spec.ts` imports `HERMES_INSTALL_COMMAND` through the relative path `../../../libs/agents/src/plugins`: `apps/docs/package.json` is not a C0 file, so it cannot depend on `@zapbip/agents`.
- Added `src/plugins.ts`, `src/install.ts`, `src/connector.ts` (empty facet entry points) and `src/index.ts` so the package exports resolve.
- Fixture install sections are hand-written: `formatSection` still needs an `InstallClient` until L2.

## L1 registry and generators (developer-l1)

### What changed and where

- `libs/agents/generate/`: `discover`, `load`, `plan`, `write`, `cli`, `format`, `source`, `repository`, `paths`, and the renderers `render-{ids,definitions,install,connector,plugins,registry,matrix,navigation,pages}`. `src/order.ts` (`OrderSurface`, `agentOrderOf`) and `src/checks/registry.ts` (`registryViolationsOf`).
- Generated and committed: `libs/agents/src/generated/{ids,definitions,install,connector,plugins}.ts`, `apps/docs/snippets/{,pt-br/}agents/matrix.mdx`. `docs.json` and every golden are byte-identical.
- `tools/repository-shape/src/agent-registry.test.ts`: G1, G2, G2b, G2c, the freshness pin and the violations pin.

### How to run

The `test:unit` script of `@zapbip/agents` and of `@zapbip/repository-shape`, then `agents:check` and `agents:generate` from the root scripts.

### Red then green

| Test | Red commit | Printed | Green commit |
|---|---|---|---|
| `generate/*.test.ts`, `src/checks/registry.test.ts` (47 tests) | 5baa1088 | `Error: discoverAgents is not implemented`, and the same for `agentOrderOf`, `renderIds`, `renderMatrix`, `renderNavigation`, `orphanPagePathsOf`, `planPages`, `registryViolationsOf`; 47 failed | c3cdf0c0 |
| `agent-registry.test.ts` G1, G2, G2b, G2c (5 tests) | 0a9d4de6 | `Error: discoverAgents is not implemented` (discovery is still a stub in this commit, so the run stops before `planGeneratedFiles`) | c3cdf0c0 |

Pins (green on landing): the freshness test and the violations test (3a2efcb6). Mutations, each run and restored: M1 (extra line in `matrix.mdx`) printed `stale apps/docs/snippets/agents/matrix.mdx: run pnpm agents:generate`; M2 (deleted pt-br snippet) printed `missing generated file ...`; M3 (`apps/docs/agents/ghost.mdx`) printed `pending deletion apps/docs/agents/ghost.mdx: run pnpm agents:generate`. M1 and M2 use the matrix snippets because no agent page is generated before Step 15.

### Hypotheses for the tester

- H1. The generated matrix tables equal the tables in the two hand-written matrix pages, row for row (checked by `diff` at Step 9).
- H2. Running the generator twice writes nothing the second time, from the root and from `apps/docs`.
- H3. `docs.json` outside the two agent lists is untouched: the generator rewrites only the `pages` arrays of `Agents` and `IAs`.

### Gaps and deviations

- Contract: `planGeneratedFiles` takes a third input, `listSource`, because orphan pages (M3) can only be found by listing `apps/docs/agents`. `agentOrderOf` takes `surface` (`OrderSurface`): the three legacy orders differ until Step 13b makes them one.
- `discoverAgents` treats a root holding `definition.ts` as one agent folder, otherwise as a container of agent folders. `libs/agents/package.json` `./generate` now points at `generate/index.ts`.
- A `plugin.ts` that exports no `plugin` (today's Hermes re-export) is not a registry entry; `PluginAgent` is empty until L5b. `InstallClient` and `ConnectorClient` are empty until L2 and L5a.
- The violations pin ignores `<id> has no page.<lang>.mdx` (22 today); Step 15 removes that exception and ticks G3.
- G1 asserts the rendered `## Fixture Agent` sections in the planned `install.<locale>.md` and in `generated/install.ts`; the `renderInstallPage` leg, the guide-parity, install-section and listen-token legs belong to L2 and L4.
- `src/checks/boundaries.ts` (B1 to B4) has no step in L1 and is not written. The generated `verify.yml` regions are L5b. `agents:new` and `agents:mentions` are Step 28 (L4) and throw `is not implemented`.
- Connector snippets are written only while a connector agent exists; removing the last one leaves the snippet files in place.

## L2 install (developer-l2)

### What changed and where

- `libs/agents/supported/<id>/{install,install-copy,install.test}.ts` and `install.<locale>.md` for the ten install agents (`install.standby.<locale>.md` for grok-web). `install.ts` exports `install: AgentInstall`; `install-copy.ts` exports `<ID>_PRODUCT`, `<ID>_COPY` and, for codex and chatgpt, the per-agent constants `CODEX_TOOL_TIMEOUT_SECONDS` and `CHATGPT_POLL_INTERVAL_MINUTES` (copied; L5b deletes the originals in `libs/types`).
- `supported/{hermes,openclaw}/plugin.ts` export `installCommand` (no `plugin` object yet, L5b completes it); `src/plugins.ts` exports `HERMES_INSTALL_COMMAND` and `OPENCLAW_INSTALL_COMMAND` from them; `@zapbip/core` no longer exports either.
- `libs/core/src/install`: `renderInstallPage` requires `sections: InstallPageSection[]`; `formatSection` takes `{ productName, productDescription, wakeNote, steps }`; the index exports `connector-commands` and `section-format` for the agent folders. Removed: `install-products.ts`, `prompts/index.ts`, `wake-notes.ts`, `snapshots/`, the per-agent section modules and their tests.
- `libs/agents/src/checks/{install-sections,guide-parity}.ts` (+ tests) iterate `AGENT_INSTALLS`; `src/install.ts` exports `AGENT_INSTALLS` and `INSTALL_PAGE_SECTIONS`; `apps/api/src/routes/install-page.ts` passes `INSTALL_PAGE_SECTIONS`.
- Step 13b: `legacy-order.ts` and `OrderSurface` are gone; `agentOrderOf({ definitions })` is rung then lower-case English name. `golden/order.json` is the only change under `golden/`.

### How to run

`pnpm --filter @zapbip/agents test:unit`, `pnpm --filter @zapbip/core test:unit`, `pnpm --filter @zapbip/repository-shape test:unit`, the api unit `install-set-wake-modes.test.ts`, the api integration `install-page.test.ts`.

### Red then green

| Test | Red commit | Printed | Green commit |
|---|---|---|---|
| `supported/<id>/install.test.ts` (10 files) | f2308751 | `Error: cursor install section is not implemented` (and the same for hermes, grok-web, openclaw, gemini-cli, chatgpt, grok-bot, codex, claude-code, claude-ai) | 9c5fc651 |
| `render-install-page.test.ts::renders only the sections it is given` | b41ec9b4 | `AssertionError: expected ... to contain 'Find which product you run in: First ...'` | 9c5fc651 |
| `checks/install-sections.test.ts`, `checks/guide-parity.test.ts` (22 tests) | 418ae776 | `Error: installSectionViolationsOf is not implemented`, `Error: guideParityViolationsOf is not implemented` | a47b5018 |
| `generate/order.test.ts`, `render-ids.test.ts`, `render-navigation.test.ts` (11 tests) | 2ab0a2b9 | `AssertionError` on the order lists | 8239e732 |

### Hypotheses for the tester

- H1. The raw install page (not only the canonical one) is byte-identical to `main` for both locales, with and without a standby, until Step 13b; compared by rendering `main` and this branch (`installCommand` text, wake notes and copy moved word for word).
- H2. After 13b the only differences are the order of the install sections and of the "Identify your product" list, the Grok Bot and claude.ai rows of the matrix snippets, and the `Agents` and `IAs` lists of `docs.json`.
- H3. Removing the folder of an install agent removes its section from the page, its enum members and its generated import; adding `testing/fixture-agent` does the same in reverse (G1 test).

### Gaps and deviations

- Steps 12 and 13 have no red of their own in the plan. Step 13 got one (the checks are new files); between 9c5fc651 and a47b5018 the old `sections.test.ts` and `guide-parity.test.ts` are gone and the registry checks are not there yet.
- Step 10 copies the snapshots into the agent folders, so `install.test.ts` uses `toMatchFileSnapshot` on the generated `install.<locale>.md`; the freshness pin is red between f2308751 and 9c5fc651 because the stubs throw when the planner renders them.
- The plan names `libs/agents/testing/golden/render.ts`; the file is `golden-sources.ts` (its `installPageOf` passes `INSTALL_PAGE_SECTIONS`). In 13b it reads the matrix from the generated snippets instead of the hand-written matrix pages, so the order golden does not depend on L3 Step 16.
- Touched files outside the L2 row: `generate/discover.test.ts` (cursor now also has `install.ts`), `generate/{agent,render-*}.ts` and their tests (the `surface` parameter is gone), `src/checks/registry.ts` (`violationIf` exported), `testing/fixture-agent/install-copy.ts` (Portuguese stop check in English, like every real section), `testing/definitions.test.ts`, new `testing/install-fixtures.ts`.
- `connectCommand` still takes `InstallClient` from `@zapbip/types` until L5a.
- Wake notes are repeated as literals in each `install.test.ts` (the test oracle), so a note edit needs two edits on purpose.

## L5a connector runtimes (developer-l5a)

### What changed and where

- `libs/agents/supported/{claude-code,codex}/connector.ts` export `runtime` (session finder, binary, resume and new-session arguments, isolation, `isNewSessionFallback`); moved from `apps/connector/src/{session-lookup,wake-commands,wake-isolation}.ts`. The Codex active-writer branch is `isNewSessionFallback`, and `newSessionArguments` is `null` for Claude Code.
- `libs/agents/src/connector-support/`: `list-directory`, `missing-entry`, `session-id`, `wake-directory`, `wake-isolation-refused-error`, and `testing/fake-client.mjs` (the shared fake binary; `supported/<id>/testing/{claude,codex}` are shims). `libs/agents/src/connector.ts` exports `CONNECTOR_RUNTIMES`, `ConnectorClient`, `isMissingEntry`, `WAKE_DIRECTORY_PREFIX`, `WakeIsolationRefusedError`.
- `apps/connector` reads `CONNECTOR_RUNTIMES`; `removeStaleWakeDirectories` stays there. `libs/types/src/connector.ts` lost `ConnectorClient` and the `CLAUDE_*`/`CODEX_*` constants (`CODEX_ZAPBIP_SERVER_NAME` became `ZAPBIP_SERVER_NAME`).
- `connectCommand` moved to `libs/agents/src/connect-command.ts` and takes `ConnectorClient`.
- `connector.{en,pt-br}.mdx` per runtime, the generated `connector-clients.mdx` snippets, and both `local-connector` pages import the snippet.

### How to run

`pnpm --filter @zapbip/agents test:unit`, `pnpm --filter zapbip test:unit` (includes the integration cases), `test:packaging`, `test:e2e`, and the `repository-shape` suite.

### Red then green

| Test | Red commit | Printed | Green commit |
|---|---|---|---|
| `supported/claude-code/connector.test.ts`, `supported/codex/connector.test.ts` | e2164965 | `Error: claude-code connector runtime is not implemented`, `Error: codex connector runtime is not implemented` (the module throws on import, so both files report no tests) | 76774b34 |

Case counts: the moved tests are the old `session-lookup`, `wake-commands` and `wake-isolation` runtime cases; `connect-command.test.ts` and the three new `cli.test.ts` cases (undeclared client and missing client throw the exact usage line; each runtime is accepted) are pins, green on landing (76774b34).

### Hypotheses for the tester

- H1. `git diff -M e2164965^ 76774b34` shows the Codex isolation code moved with only import and constant-name changes.
- H2. The usage line reads `--client claude-code|codex`; `--client nope` and a missing `--client` throw it.
- H3. The bundled connector resumes, falls back to a new Codex thread on the active-writer refusal and never falls back for Claude Code (`wake-runner` integration).
- H4. Adding `testing/fixture-connector-agent` adds only `FixtureConnectorAgent` to `ConnectorClient` (G2c).

### Gaps and deviations

- `apps/api/test/e2e/claude-code.e2e.test.ts` is not renamed or iterated: it runs the real `claude`, not the runtimes.
- `background-running` pages are unchanged (no per-runtime paragraph).
- `session-lookup.ts` still holds the `.claude` and `.codex` default home folders, and `wake-runner.ts` reads `CODEX_HOME`: the contract's `SessionLookupInput` and `WakeIsolationInput` name both agents (L1), so L4's leak check will list them.
- `connectCommand` left `libs/core` (cycle), which touches `libs/core/src/install/prompts/connector-commands.ts` and the two `install-copy.ts` files, outside the L5a row.
- `tools/repository-shape/src/agent-registry.test.ts` G2c now asserts the fixture member is contained, since real connector agents exist.

## L3 docs pages (developer-l3)

Changed: the 22 agent pages live in `libs/agents/supported/<id>/page.{en,pt-br}.mdx` and the generator writes the identical copies into `apps/docs`; both `supported-agents.mdx` pages import the generated matrix snippet as `AgentMatrix`; `agent-registry.test.ts` lost the page exception and gained the G3 removal cases for all 11 ids and the matrix import case; `docs-experience.test.ts` reads matrix rows from the snippet; `docs-visual.test.ts` compares the navigation page lists in any order.

Run: `pnpm --filter @zapbip/repository-shape test:unit`, `pnpm agents:check`.

| Test | Red | Failure printed | Green |
|---|---|---|---|
| `agent-registry.test.ts::every agent page in apps/docs is the copy of its folder page` | a81002b7 | `AssertionError: expected [ ...(22) ] to deeply equal []` | 24e50764 |
| `agent-registry.test.ts::the matrix page ... shows the generated snippet and holds no table` | 86630738 | `expected '---\ntitle: Supported agents...' to contain 'import AgentMatrix from ...'` | e275f55d |
| `agent-registry.test.ts::G3: <id> vanishes from every planned file` (11) | pin | none | 24e50764 |

Hypotheses: the rendered agent pages are byte-identical to `origin/main`; Mintlify renders the `<AgentMatrix />` table with 11 rows (walk W2); the Agents nav order is the registry order.

Gaps: the docs walk and broken-links were not run by the developer; the G3 assertions use id tokens (`agents/<id>)`, `'<id>'`), not the display name.

## L5b: plugins and hosted artifacts

### What changed

- `supported/{hermes,openclaw}/plugin.ts` export the full `plugin` (package folder, registry, version, install command, hosted artifacts, workflow, build requirements, version pins, end-to-end module). `hermes/wheel.ts` (moved from `libs/types/src/hermes-wheel.ts`) holds the version, the two hashes and the filename helpers.
- `libs/agents/src/checks/plugins.ts` (`pluginViolationsOf`): claim, version pins, `/pkg/` path, 64-hex hash, release file hash, install command embeds the flagged hash, the embedded file holds the other artifacts' hashes, allowlist equals the hosted filenames.
- `routes/package.ts` builds `SERVED_PACKAGES` from `AGENT_PLUGINS`; `deploy-preflight.ts`, `deploy.ts` and `docs-preflight.ts` take `plugins: AgentPlugin[]` in place of the version and hash fields. Refusal text is unchanged, with the release folder read from the artifact.
- `scripts/plugin-wheel/build.ts [id]` iterates the `SelfHostedWheel` plugins; `pnpm plugin-wheel:build <id>` replaces `hermes-wheel:build`. The Docker fixtures moved to `apps/{hermes,openclaw}-plugin/e2e`; `channel-plugins.e2e.test.ts` imports each `endToEndModule` (`buildPluginImage`, `startPluginClient`).
- `verify.yml` carries two generated regions (`# NB ADR 0033` markers); `render-workflow.ts` fills them.
- The runbooks name no agent; `runbooks.test.ts` asserts it.

### How to run

`pnpm --filter @zapbip/agents test:unit`, `pnpm --filter @zapbip/api test:unit`, `pnpm --filter @zapbip/api test:integration`, `pnpm --filter @zapbip/repository-shape test:unit`, the hermes-wheel and deploy-dry-run e2e, and `pnpm test:e2e:clients` with Docker.

### Red then green

| Test | Red commit | Printed | Green commit |
|---|---|---|---|
| `checks/plugins.test.ts` real registry, `package-allowlist.test.ts`, the new `deploy-preflight.test.ts` case | 0e095566 | `Error: hermes hosted artifacts are not implemented` | 2fa6571b |
| `checks/plugins.test.ts` synthetic cases (13) | 0e095566 | `Error: pluginViolationsOf is not implemented` | 2fa6571b |

Pins, green on landing: `render-workflow.test.ts`, the new runbook "names no agent" cases, the `plugin-versions.test.ts` registry cases.

### Hypotheses for the tester

- H1. `pnpm plugin-wheel:build hermes` leaves `apps/hermes-plugin/release` byte-identical and prints the committed hashes (the developer ran it).
- H2. `pnpm agents:check` reports 0 stale and no violation for the workflow.
- H3. The `/pkg/` route answers the same bytes, headers and 404s as before (`package-route.test.ts` unchanged apart from imports).
- H4. The deploy preflight refusals read the same as before for a missing or mismatched hosted file.
- H5. Adding the fixture plugin agent adds only its folder, `generated/plugins.ts`, the workflow and the docs files (G2b).

### Gaps and deviations

- The Docker clients e2e and the pip e2e were not run by the developer; `pnpm verify all` covers the pip e2e.
- `test:e2e:clients` takes no agent id; `plugin-wheel:build` prints the hash lines and does not rewrite `wheel.ts`.
- The workflow gains an `openclaw-plugin` unit row.
- `global-setup.ts` and `agent-registry.test.ts` (G2b) were edited outside the L5b row because the deleted constants and the plugin registry reach them.
