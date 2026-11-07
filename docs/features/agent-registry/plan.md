# Plan: Agent registry

**Spec:** spec.md
**Tier:** 🔴
**Seam:** `renderInstallPage` (libs/core) takes the install sections it renders as input; `apps/connector` takes its runtimes from `@zapbip/agents/connector`; the docs tooling reads `AGENT_DEFINITIONS`; `apps/docs` receives committed generated pages, snippets and nav from `libs/agents/generate`.
**Depends on (all merged, `main` at 6d32299):** `install-skills`, `docs-experience` (one agent page shape, the four `AGENT_PAGE_HEADINGS`, green parity tests), `deploy-readiness` and `hermes-wheel-hosting` (`HERMES_INSTALL_COMMAND`, the hosted wheel).

**Assumptions (decided, owner can override):**
- A1. Folder root `libs/agents/supported/<id>/`; id = folder name = docs slug = `--client` value.
- A2. Generated files are committed; one planner serves the CLI and the shape test.
- A3. `enumMember` keeps today's member names; values are unchanged.
- A4. Order everywhere: wake-ladder rung, then the English `matrixName` in lower case.
- A5. `tsx` 4.23.15 (root) runs the CLI; Prettier 3.9.10 formats the outputs; no new external dependency. `smol-toml` 1.9.1 moves with the Codex isolation code. It is already pinned in `apps/connector`; adding it to `libs/agents` is decided (owner delegated 2026-11-06).
- A7. **Where generated files live and how the gate proves them fresh.** Inside the package: `libs/agents/src/generated/{ids,definitions,install,connector,plugins}.ts` and the rendered `supported/<id>/install.<owner locale>.md`. Outside it, because Mintlify reads `apps/docs`: `apps/docs/agents/<id>.mdx`, `apps/docs/pt-br/agents/<id>.mdx`, the matrix and connector snippets, the `Agents` and `IAs` lists of `docs.json`. Freshness: `tools/repository-shape/src/agent-registry.test.ts::every generated file is fresh` calls `planGeneratedFiles` over the real folders and fails unless every planned write equals the committed bytes and `deletions` and `violations` are empty, i.e. `pnpm agents:generate` is a no-op. The `shape` gate is in `ALWAYS_GATES` of `scripts/verify.sh`, so a hand edit to a generated file, or a folder edit without regenerating, fails `pnpm verify` in every class of diff. `pnpm agents:check` runs the same planner for a fast local loop.
- A6. Generated paths are owned by the generator, not by a lane. Any lane may regenerate. A conflict on a generated path is resolved by rerunning `pnpm agents:generate`, never by hand.

## Spikes (scratch worktree, never committed; answers go into this plan and the test plan)

- [ ] **S1 Mintlify snippet table:** `mint@4.2.1207 dev --client-version 0.0.4077`, a page importing `/snippets/agents/matrix.mdx` (a Markdown table) and its pt-br twin; expected: `#content-area table tbody tr` has the rows in both languages, `mint broken-links` exits 0. Fallback recorded in spec Risk 1.
- [ ] **S2 Prettier stability:** `prettier.format(JSON.stringify(JSON.parse(docs.json), null, 2), { parser: 'json' })` equals `apps/docs/docs.json`; a generated `.ts` index run through Prettier twice is unchanged.
- [ ] **S3 Loading modules:** `tsx` imports a `definition.ts` that imports enums from `@zapbip/types`; vitest does the same; neither needs a build.
- [ ] **S4 Baseline:** `wrangler deploy --dry-run --outdir <scratchpad>` for `apps/api`; record bytes and gzip bytes; `apps/connector/dist/cli.js` bytes after `build`.

## File map

| Group | Paths owned | Developer | Runs |
|---|---|---|---|
| C0 Contract | `docs/features/README.md`, `docs/features/agent-registry/spec.md` (status), `AGENTS.md`, `scripts/verify-gates.tsv`, `scripts/verify.test.sh`, root `package.json`, `pnpm-lock.yaml`, `libs/agents/{package.json,README.md,tsconfig.json,vitest.config.ts}`, `libs/agents/src/{contract,docs,index}.ts`, `libs/agents/generate/{discover,plan,write,cli}.ts` (stubs), `libs/agents/supported/*/definition.ts` (11), `libs/agents/testing/**`, `tools/repository-shape/src/docs-experience.ts` (vocabulary import only), `apps/api/package.json`, `apps/connector/package.json`, `tools/repository-shape/package.json` | `developer-c0` | first, alone |
| L1 Registry and generators | `libs/agents/generate/**`, `libs/agents/src/{order,checks/registry,checks/boundaries,generated/ids,generated/definitions}.ts`, `tools/repository-shape/src/agent-registry.test.ts` | `developer-l1` | after C0 |
| L2 Install | `libs/agents/supported/*/{install,install-copy,install.test}.ts`, `libs/agents/supported/*/install*.md` (moved renders), `libs/agents/src/{install,checks/install-sections,checks/guide-parity}.ts`, `libs/core/src/install/**` (including `prompts/connector-commands.ts`, which hands `HERMES_INSTALL_COMMAND` and `OPENCLAW_INSTALL_COMMAND` to `libs/agents/supported/{hermes,openclaw}/plugin.ts`), `apps/api/src/routes/install-page.ts`, `apps/api/test/unit/install-set-wake-modes.test.ts`, and only the `HERMES_INSTALL_COMMAND` import line of `apps/api/test/e2e/hermes-wheel.e2e.test.ts`, `apps/docs/e2e/agents-b.spec.ts` and `tools/repository-shape/src/docs-agent-install.test.ts` | `developer-l2` | after L1, parallel with L3, L5a |
| L3 Docs pages | `libs/agents/supported/*/page.{en,pt-br}.mdx`, `apps/docs/agents/supported-agents.mdx`, `apps/docs/pt-br/agents/supported-agents.mdx` | `developer-l3` | after L1, parallel |
| L5a Connector runtimes | `libs/agents/supported/{claude-code,codex}/{connector.ts,connector.test.ts,connector.*.mdx,testing/**}`, `libs/agents/src/{connector,connector-support/**}.ts`, `apps/connector/src/**`, `apps/connector/test/**`, `libs/types/src/connector.ts`, `apps/api/test/e2e/claude-code.e2e.test.ts`, `apps/docs/developers/{local-connector,background-running}.mdx` and their pt-br twins | `developer-l5a` | after L1, parallel |
| L5b Plugins and hosted artifacts | `libs/agents/supported/{hermes,openclaw}/plugin.ts` (completes what L2 started), `libs/agents/supported/hermes/wheel.ts`, `libs/agents/src/{plugins,checks/plugins}.ts`, `libs/types/src/{channel-plugin,hermes-wheel,hermes-wheel.test}.ts`, `libs/types/src/constants.ts` (the OpenClaw and Hermes constants only), `scripts/e2e/clients/**`, `scripts/hermes-wheel/build.ts`, `apps/{hermes,openclaw}-plugin/e2e/**`, `apps/api/src/routes/package.ts`, `apps/api/src/operations/deploy-preflight.ts`, `apps/api/scripts/{deploy,docs-preflight}.ts`, `apps/api/test/e2e/{hermes-openclaw,channel-plugins,hermes-wheel,deploy-dry-run}.e2e.test.ts`, `apps/api/test/integration/package-route.test.ts`, `apps/api/test/unit/{deploy-preflight,deploy-entry,docs-preflight-entry,openclaw-plugin-version}.test.ts`, `apps/api/test/unit/fake-deploy-shell.ts`, `tools/repository-shape/src/{plugin-versions,e2e-clients-scaffolding,hermes-wheel,runbooks}.test.ts`, `docs/runbooks/{deploy,cloudflare-setup,mintlify-publish}.md` (only where a path they name moves) | `developer-l5b` | after L2 (needs the plugin install command), parallel with L3, L5a |
| L4 Facts, rungs and tests | `tools/repository-shape/src/{docs-experience.ts,docs-experience.test.ts,docs-conversations.test.ts,install-guides.test.ts,docs-agent-install.test.ts,install-e2e.test.ts}`, `apps/docs/e2e/{agents-a,agents-b,agents,from-zero}.spec.ts`, `libs/types/src/{enums,index}.ts`, `libs/types/src/constants.ts` (`CODEX_TOOL_TIMEOUT_SECONDS`, `CHATGPT_POLL_INTERVAL_MINUTES`), `tools/install-e2e/**` → `libs/agents/supported/claude-code/install-e2e.sh`, `libs/agents/src/checks/leaks.ts` | `developer-l4` | after L2, L3, L5a, L5b |

The root `package.json` lines `test:e2e:clients` and `hermes-wheel:build` are handed from C0 to L5b by the lead, which names it in L5b's prompt. Generated outputs (spec → Layout) have no lane owner (A6).

## Contract (Step 0, verbatim)

C0 lands the types in `spec.md` → Interfaces, plus these signatures and stubs, in one commit. Lanes build against them. A later change is a new C0 commit that every lane merges.

```ts
// libs/agents/generate/discover.ts
export type DiscoveredAgent = { id: string; folder: string; facets: AgentFacet[] };
export function discoverAgents(input: { roots: string[] }): DiscoveredAgent[];

// libs/agents/generate/plan.ts
export type GeneratedFile = { path: string; content: string };
export type GenerationPlan = { writes: GeneratedFile[]; deletions: string[]; violations: string[] };
export async function planGeneratedFiles(input: { agents: DiscoveredAgent[]; readSource: (path: string) => string }): Promise<GenerationPlan>;

// libs/agents/src/order.ts
export function agentOrderOf(input: { definitions: Record<string, AgentDefinition> }): string[];

// libs/agents/generate/write.ts
export function writePlan(input: { plan: GenerationPlan; mode: GenerationMode }): string[];
export enum GenerationMode { Write = 'write', Check = 'check' }
```

Each stub throws `<name> is not implemented`. `libs/agents/supported/<id>/definition.ts` exports `definition: AgentDefinition` for the eleven agents. The data comes from `CLIENT_LISTEN_FACTS`, `ALLOWED_WAKE_MODES`, the matrix rows and the per-client tokens in `agents-a.spec.ts`, `agents-b.spec.ts` and `docs-agent-install.test.ts`.

## Steps

All boxes empty when authored. A wrong step is struck through with the reason.

### C0: contract (first, one developer)

- [ ] **Step 1:** spec status `Building` and its `docs/features/README.md` row. ADR 0033 is already `Accepted` and indexed (feature docs commit).
- [ ] **Step 2:** Package skeleton. `libs/agents/package.json` (`@zapbip/agents`, exports `.`, `./install`, `./connector`, `./plugins`, `./docs`, `./generate`; scripts `typecheck`, `test:unit`). README states purpose only and links `supported/` and `generate/`. Add `tsconfig.json` and `vitest.config.ts`. Root scripts `agents:generate`, `agents:check`, `agents:new`, `agents:mentions` (each `tsx libs/agents/generate/cli.ts <mode>`). Add `libs/agents/*	product	typecheck unit integration e2e docs` above the `libs/*` row and pin it in `scripts/verify.test.sh`. Add the layout line in `AGENTS.md` and `agentOrderOf` to the shared-helper line. Add the workspace dependency to `apps/api`, `apps/connector`, `tools/repository-shape`. Install it (A5 decided, owner delegated 2026-11-06: smol-toml 1.9.1 is already pinned in the repository). Commit `chore(agents): the agents package and its gate`.
- [ ] **Step 3:** `libs/agents/src/contract.ts` verbatim and the four generator stubs. Commit `feat(agents): the agent contract and generator stubs`.
- [ ] **Step 4 (pin):** move `AgentPageSection`, `AGENT_PAGE_SECTIONS`, `AGENT_PAGE_HEADINGS`, `WAKE_RUNG_LABELS`, `LISTEN_STATEMENT_TOKENS`, `DOCS_GROUPS`, `twinPathOf` and `agentPagePathOf` into `libs/agents/src/docs.ts`; `docs-experience.ts` imports them. All existing shape tests and walks are green. Commit `refactor(agents): docs vocabulary lives with the agents`.
- [ ] **Step 5:** eleven `definition.ts`. Add `testing/fixture-agent/` (definition, install, install-copy, pages in both languages; names `Fixture Agent` / `Agente de teste`, rung `Local`, delay `null`). Add `testing/fixture-plugin-agent/` with `plugin.ts` pointing at `testing/fixture-plugin-package/package.json`. Commit `feat(agents): one definition per supported agent and the fixtures`.

### L1: registry and generators (after Step 5)

- [ ] **Step 6 (red):** `libs/agents/generate/*.test.ts`. Cases are in test plan area R. Commit `test(agents): discovery, order, ids, nav, matrix, pages and violations`. Expected red: `Error: discoverAgents is not implemented`.
- [ ] **Step 7 (red):** `tools/repository-shape/src/agent-registry.test.ts`, guard area G (G1 to G4). Commit `test(agents): a fixture folder appears everywhere and a removed agent vanishes`. Expected red: `Error: planGeneratedFiles is not implemented`.
- [ ] **Step 8:** implement `discoverAgents`, `agentOrderOf`, the renderers (`render-ids`, `render-definitions`, `render-pages`, `render-matrix`, `render-navigation`, `render-install` for the rendered sections and the install registry, `render-connector`, `render-plugins`), deletions, violations, Prettier, `writePlan`, the CLI. Facet registries are emitted from the facets present, so `InstallClient`, `ConnectorClient` and `PluginAgent` are empty until their lanes add facets. Nothing imports them yet, so an empty enum is harmless. Steps 6 and 7 green. Commit `feat(agents): the generator`.
- [ ] **Step 9:** first real run. Commit 1 `feat(agents): generated ids and definitions` (`ids.ts` with 11 `AgentId` members, `definitions.ts`, matrix snippets). Commit 2, alone: `docs(agents): agents listed by wake rung, then name` (the `docs.json` reorder). Pages are untouched: there are no page facets yet, so the run reports violations and deletes nothing.

### L2: install (after Step 9)

- [ ] **Step 10 (red):** for each of the ten install agents, `git mv libs/core/src/install/snapshots/<id>.<owner locale>.md libs/agents/supported/<id>/install.<owner locale>.md`, owner locale `en_US` or `pt_BR` (and the `grok-web.standby` pair). Add `install.ts` stubs whose `render` throws `<id> install section is not implemented`. Add `install.test.ts` with the agent's cases moved from `chat-clients`, `editor-clients`, `install-copy`, `claude-code` and `codex` tests. Commit `test(agents): each agent renders the section it rendered before`. Expected red: `Error: cursor install section is not implemented`.
- [ ] **Step 11 (red):** `libs/core/src/install/render-install-page.test.ts::renders only the sections it is given`, input two synthetic sections; red on the missing `sections` input. Commit `test(core): the install page renders the sections it is given`.
- [ ] **Step 12:** reshape the ports (`formatSection`, `renderInstallPage`, `connectCommand`). For each agent, `git mv prompts/<id>.ts → supported/<id>/install.ts` and `prompts/<id>-copy.ts → supported/<id>/install-copy.ts`, with its wake note and per-agent constants (`CODEX_TOOL_TIMEOUT_SECONDS`, `CHATGPT_POLL_INTERVAL_MINUTES`). `git mv prompts/{hermes,openclaw}-copy.ts` as above and move `HERMES_INSTALL_COMMAND` and `OPENCLAW_INSTALL_COMMAND` out of `connector-commands.ts` (which keeps `connectCommand`, `listenCommand` and the shared constants) into `supported/{hermes,openclaw}/plugin.ts` as `installCommand`, importing the version and hash constants from `@zapbip/types` for now; `@zapbip/core` stops exporting `HERMES_INSTALL_COMMAND`, and its three outside consumers (`hermes-wheel.e2e.test.ts`, `agents-b.spec.ts`, `docs-agent-install.test.ts`) import it from `@zapbip/agents/plugins`, changing only that line. `docs-agent-install.test.ts` keeps its literal OpenClaw command until Step 23. Delete `install-products.ts`, `wake-notes.ts`, `prompts/index.ts`, `snapshots/`, `snapshots.test.ts`, `testing/fixtures.ts` `CLIENTS`. Regenerate: `InstallClient` has 10 members in rung-then-name order, the rendered sections are unchanged. Commit `refactor(install): each agent owns its section; the core renders what it is given`.
- [ ] **Step 13:** move the generic section checks of `sections.test.ts` into `libs/agents/src/checks/install-sections.ts` and run them over `AGENT_INSTALLS`: stop check first, self-test last, a success line on every step, set_wake modes ⊆ `definition.listen.setWakeModes`, the secret only inside the link, rendering twice gives the same text. Move `guide-parity.test.ts` to `libs/agents/src/checks/guide-parity.ts`; it reads the set-up section by heading, not by index. Wire `apps/api/src/routes/install-page.ts` and `install-set-wake-modes.test.ts` to `@zapbip/agents/install`. Commit `refactor(agents): install checks iterate the registry`.

### L3: docs pages (after Step 9, parallel)

- [ ] **Step 14 (red):** `agent-registry.test.ts::every agent page in apps/docs is the copy of its folder page`; red lists 22 violations `<id> has no page.<lang>.mdx`. Commit `test(agents): agent pages come from their folders`.
- [ ] **Step 15:** `git mv apps/docs/agents/<id>.mdx libs/agents/supported/<id>/page.en.mdx` and the pt-br twin to `page.pt-br.mdx`, 22 moves. Regenerate. `git diff origin/main -- apps/docs/agents apps/docs/pt-br/agents ':!*supported-agents*'` is empty. Commit `refactor(docs): agent pages live in their agent folders`.
- [ ] **Step 16:** both matrix pages import `AgentMatrix` from the generated snippet and replace the table with `<AgentMatrix />`. Commit `docs(agents): the matrix table is generated`.

### L5a: connector runtimes (after Step 9, parallel)

- [ ] **Step 17 (red):** `supported/{claude-code,codex}/connector.test.ts`, the per-runtime cases moved from `apps/connector/test/unit/{session-lookup,wake-commands,wake-isolation}.test.ts` with only import changes. The stubs throw `<id> connector runtime is not implemented`. Commit `test(agents): each connector runtime keeps its session, resume and isolation rules`.
- [ ] **Step 18:** `git mv` the per-runtime functions into `connector.ts`. The shared Node helpers go to `libs/agents/src/connector-support/`. The Codex active-writer branch becomes `isNewSessionFallback`. `apps/connector` consumes `CONNECTOR_RUNTIMES`, and the `cli.ts` usage line lists `ConnectorClient` from `@zapbip/agents/connector`. Remove `ConnectorClient` and the `CLAUDE_*` and `CODEX_*` constants from `libs/types/src/connector.ts`. Fake binaries move to `supported/<id>/testing/`. `claude-code.e2e.test.ts` becomes `local-connector.e2e.test.ts` and iterates the runtimes. Regenerate. Commit `refactor(connector): each runtime lives in its agent folder`.
- [ ] **Step 19:** add `connector.{en,pt-br}.mdx`: the existing runtime paragraphs of `local-connector.mdx` and `background-running.mdx`, moved word for word. The generator emits the connector-clients snippets, and both developer pages and their twins import them. Commit `docs(connector): the runtime list is generated`.

### L5b: plugins and hosted artifacts (after Step 12, parallel with L3 and L5a)

- [ ] **Step 20 (red):** `libs/agents/src/checks/plugins.test.ts`: every `apps/*-plugin` is claimed by exactly one `plugin.ts`; every version pin matches; every hosted artifact of a plugin has a path under `/pkg/` and a 64-hex hash. `apps/api/test/unit/` cases that `publishedPackageSpecsOf` and the wheel preflight step read `AGENT_PLUGINS`. Red: `Error: hermes hosted artifacts are not implemented` (stub `hostedArtifacts`). Commit `test(agents): each plugin package is claimed by one agent`.
- [ ] **Step 21:** complete the `plugin.ts` files with package folder, registry (`Npm` for OpenClaw, `SelfHostedWheel` for Hermes), version pins and `hostedArtifacts`. `git mv libs/types/src/hermes-wheel.ts libs/agents/supported/hermes/wheel.ts` with its test, and move `ZAPBIP_HERMES_PLUGIN_VERSION`, `ZAPBIP_HERMES_WHEEL_SHA256` and `ZAPBIP_HERMES_REQUIREMENTS_SHA256` there; `OPENCLAW_PLUGIN_NPM_VERSION` and `OPENCLAW_PLUGIN_PACKAGE` go into `openclaw/plugin.ts`. `routes/package.ts` serves `AGENT_PLUGINS.flatMap(hostedArtifacts)`; `deploy-preflight.ts` (`publishedPackageSpecsOf`, the Hermes wheel step), `deploy.ts` and `docs-preflight.ts` read `AGENT_PLUGINS`, with refusal text unchanged. `scripts/hermes-wheel/build.ts` rewrites the two hashes in `supported/hermes/wheel.ts`. Delete `ChannelPluginProduct` and `CHANNEL_PLUGIN_PACKAGE_NAME`, and confirm `test_constants_parity.py` still passes. `git mv scripts/e2e/clients/{hermes-client.ts,hermes} apps/hermes-plugin/e2e/` and the same for OpenClaw; `build.ts` reads `build-requirements.txt` from its new place. Rename `hermes-openclaw.e2e.test.ts` to `channel-plugins.e2e.test.ts`, iterating `AGENT_PLUGINS` and importing each `endToEndModule`; update `test:e2e:clients` and `hermes-wheel:build`. `plugin-versions.test.ts`, `e2e-clients-scaffolding.test.ts` and `hermes-wheel.test.ts` iterate `AGENT_PLUGINS` or read the new paths. Regenerate. Commit `refactor(plugins): each plugin and its hosted files live behind its agent folder`.

### L4: facts, rungs and tests (after L2, L3, L5a, L5b)

- [ ] **Step 22 (red):** `libs/agents/src/checks/leaks.ts` and `agent-registry.test.ts::no file outside an agent folder names an agent` (enum members `AgentId.X`, `InstallClient.X`, `ConnectorClient.X`, `PluginAgent.X`, `Record<…>` keyed by them, and `supported/<id>` paths, outside `supported/<id>/**` and the generated outputs). Red lists what is left: `CLIENT_LISTEN_FACTS`, `DOCS_ONLY_PAGE_NAMES`, `SPEAKER_LABELS` in `docs-conversations.test.ts`, `PLUGIN_PAGE_CLIENTS`, `CLIENTS_A`, `AGENT_CLIENTS`, `PLUGIN_COMMAND_OF`, `MATRIX_CLIENTS`, `InstallClient` and `DocsOnlyClient` in `libs/types/src/enums.ts`. Commit `test(agents): agent knowledge stays in agent folders`.
- [ ] **Step 23:** `docs-experience.ts` and `docs-experience.test.ts` read `AGENT_DEFINITIONS`. `docs-conversations.test.ts` builds its speaker labels from the registry names plus its fixed non-agent labels (Owner, You, Agent, zapbip). Fold `install-guides.test.ts` and `docs-agent-install.test.ts` into the registry checks (`pageFacts`, headings, placeholder, pinned package, `installCommand` on the page). These are folded tests, so record a mutation check for each.
- [ ] **Step 24:** replace `agents-a.spec.ts` and `agents-b.spec.ts` with `agents.spec.ts` over `AGENT_DEFINITIONS`. Each page and language checks: status 200, the four headings in order, the rung label, the listen tokens, the delay token when there is one, every `pageFact` visible, and the self-test for install agents. `from-zero.spec.ts` reads the matrix agents from the registry.
- [ ] **Step 25:** `git mv tools/install-e2e/claude-code.sh libs/agents/supported/claude-code/install-e2e.sh` and fix its root path. `install-e2e.test.ts` iterates the agents with the `OwnerRunInstall` facet.
- [ ] **Step 26 (pin):** `agent-registry.test.ts::every generated file is fresh` and `::the plan has no violations`. Record mutations M1 to M3.
- [ ] **Step 27:** delete `InstallClient` and `DocsOnlyClient` from `libs/types`. Step 22 green.
- [ ] **Step 28:** `agents:new <id>` (copies `testing/fixture-agent`, refuses an existing or invalid id) and `agents:mentions <id>` (lists every file outside the generated set that holds the agent's names in either language), with tests.

## Merge order

1. C0, then L1, merged into `feat/agent-registry`.
2. L2 first; then L3, L5a and L5b, in any order (L5b needs the plugin install command L2 moves). After each merge the lead runs `pnpm agents:generate` and commits any regenerated output as `chore(agents): regenerate`.
3. L4.

## Failure modes

| Step | What breaks | How I notice | How I back out |
|---|---|---|---|
| 2 | lockfile or workspace link | `pnpm verify` typecheck fails on `@zapbip/agents` | revert Step 2 |
| 9 | `docs.json` reformatted beyond the Agents lists | the commit 2 diff touches other groups | S2 normalization commit first, then redo |
| 12 | install text changes | `install.<owner locale>.md` shows a diff; `install-page` integration fails | revert Step 12; the moved renders are the oracle |
| 13 | the Worker imports `node:` through a facet | `@cloudflare/vitest-pool-workers` install-page test fails to load | revert the import; boundary check B3 |
| 15 | page bytes change (Prettier, line endings) | `git diff origin/main -- apps/docs/agents` not empty | revert Step 15; run Prettier on the fragments before the move |
| 16 | Mintlify does not render the snippet table | walk W2 finds 0 rows | S1 fallback (spec Risk 1) |
| 18 | Codex isolation behaviour drifts | moved `connector.test.ts` fails; `git diff -M` similarity below 100% outside imports | revert Step 18 |
| 21 | the hosted wheel route, preflight or hash rewrite drifts | `package-route.test.ts`, `deploy-preflight.test.ts` or `hermes-wheel.test.ts` fails; `git diff` of a pure move shows content changes | revert Step 21; the hosted bytes in R2 never change |
| 21 | plugin end-to-end cannot find its client | `test:e2e:clients` fails at import | revert the move; restore `scripts/e2e/clients` |
| 22 to 27 | a test folded away loses coverage | a mutation check stays green | restore the folded test |
| any | generated conflict across lanes | `agents:check` red after a merge | rerun `agents:generate` |

**Steps with no backout:** none. Every step is a revertible commit with no data effect.

## Z. Prove and ship

- [ ] **Tester briefing:** each lane writes its part of `tester-briefing.md`, with the red text its red run actually printed.
- [ ] **Tester run:** a fresh `tester` executes `test-plan.md`, including the owner-run scratch-worktree rows O1 to O3.
- [ ] **Reviewer:** fresh `reviewer`; refutations recorded in the test plan.
- [ ] **Security reviewer:** fresh; focus on the install page route (same bytes, same headers), the connector isolation move, the `/pkg/` route and preflight reading `AGENT_PLUGINS` (same bytes, same refusals), and `apps/api` facet boundaries.
- [ ] **/check-ui:** the matrix and three agent pages in both languages at 1280 and 375; the nav before and after the reorder.
- [ ] **/open-pr:** gates passed, learnings sweep stated, merge sensitivity stated (expected MEDIUM: the install page route and the connector).
