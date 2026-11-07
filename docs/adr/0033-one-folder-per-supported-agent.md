# 0033. One folder per supported agent; everything else is generated from it

- Status: Accepted (owner delegated 2026-11-06)
- Date: 2026-11-07
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: owner order 2026-11-07 ("if I need to add a new AI agent or remove one, how many files do I have to change? The answer should be at most one or two folders at most … so that dependency inversion becomes truly functional"); `docs/features/agent-registry/spec.md` (inventory on `main` at 6d32299: 16 files in 9 folders to add one agent); [ADR 0008](0008-a-pure-core-behind-ports.md); [ADR 0010](0010-public-docs-on-mintlify.md); [ADR 0030](0030-the-docs-speak-to-any-ai-user-in-two-languages-and-the-switcher-picks-the-language.md); [ADR 0034](0034-the-hermes-wheel-is-self-hosted-and-installed-by-a-pinned-hash.md)

## Context

A supported agent is described today in four packages. Its enum member is in `libs/types`. Its install section, copy, wake note and product name are in `libs/core/src/install`, and the core lists every agent by name. Its rung and delay are in `tools/repository-shape`. Its two pages, its matrix row and its nav entries are in `apps/docs`. Its walk tokens are in two Playwright specs. A connector runtime adds four records in `apps/connector`; a plugin adds about eighteen more files. Exhaustive records force some of these edits. Others are hand lists that silently skip a new agent. Mintlify serves only static MDX from `apps/docs`, and Cloudflare Workers has no filesystem, so neither can discover agents at runtime.

## Decision

1. Every supported agent is one folder, `libs/agents/supported/<id>/`. The folder name is the id, the docs slug and the `--client` value. It holds:
   - its definition: enum member, docs names, page facts, listen facts;
   - its two hand-written pages;
   - its install section and owner copy, with their tests;
   - when it has them, its connector runtime, a pointer to its plugin package, and its owner-run install script.
2. A plugin package stays in `apps/<id>-plugin/`, with its own end-to-end client. The agent folder points at it, and holds its install command and the files it hosts (the Hermes wheel, [ADR 0034](0034-the-hermes-wheel-is-self-hosted-and-installed-by-a-pinned-hash.md)); the Worker serves and the preflight checks whatever the plugins declare. A plugin agent is two folders.
3. `pnpm agents:generate` writes every derived file: the enums `AgentId`, `InstallClient`, `ConnectorClient` and `PluginAgent` (in `libs/agents/src/generated/ids.ts`), the facet registries, the rendered install sections, the agent pages under `apps/docs`, the matrix and connector snippets, and the `Agents` and `IAs` page lists of `docs.json`. Generated files are committed. A shape test runs the same planner and fails on any stale file, so a hand edit fails in every gate class.
4. `libs/core` and `libs/types` know no agent id. The core exposes ports (`InstallSection`, `InstallPageSection`). The composition roots inject the registry: `apps/api`, `apps/connector`, the docs tooling. The Worker imports only the install and plugin facets, and those import no `node:` module.
5. Pages and copy are moved, never generated or translated (ADR 0030 stands). One order is used everywhere: wake-ladder rung, then name.
6. Pinned wake providers are not agents. They stay in `libs/core/src/wake` under [ADR 0019](0019-outbound-wake-targets-pinned-providers-and-guarded-generic-hosts.md).

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| One folder per agent, generated files committed (chosen) | add or remove = one folder plus one command; reviewers see every generated diff; works with static Mintlify and with Workers | generated copies in the repository; a planner to maintain | — |
| One central typed table in `libs/types` | one file for the facts | copy, pages, tests and runtimes still live elsewhere; one file holds eleven agents' copy; the core still lists agents | does not reach the one-folder target |
| `import.meta.glob` discovery | no generated index | Vite and vitest only; wrangler's and the connector's esbuild do not support it | breaks the Worker and the npm package |
| Runtime directory scan | no generated index | Workers has no filesystem; Mintlify needs files under `apps/docs` | impossible on the Worker and in the docs |
| Generate at build, do not commit | no copies in git | Mintlify reads the repository; GitHub Actions does not run here (ADR 0005); no reviewable diff | the docs would be missing |
| Symlinks from `apps/docs` into agent folders | no copies | the hosted Mintlify build is not proved to follow links outside its root | unprovable today |
| Hand-written enum beside the folders | familiar | a second hand-edited place per agent | the problem this decision removes |

## Consequences

- Adding an agent edits no file outside its folder. Removing one deletes its folder, and the generator deletes its pages and entries.
- `libs/types` loses `InstallClient`, `DocsOnlyClient`, `ConnectorClient`, `ChannelPluginProduct` and the per-agent constants. Agent ids exist only in `@zapbip/agents`.
- A merge conflict on a generated path is resolved by rerunning the generator, never by hand.
- Removing a connector runtime reaches an owner only when they upgrade `zapbip`; a pinned old version keeps it.
- Brand names in illustrative prose are reviewed with `pnpm agents:mentions <id>`, not gated.
- The generated `.ts` files carry one `// NB ADR 0033:` line pointing here.

## Evidence

- Inventory and counts in `docs/features/agent-registry/spec.md`, taken from `origin/main` at 6d32299 on 2026-11-07, after install-skills, docs-experience, deploy-readiness and hermes-wheel-hosting merged.
- Spikes S1 (Mintlify renders an imported snippet table), S2 (Prettier is stable on `docs.json`), S3 (tsx and vitest load the agent modules), S4 (bundle baseline), recorded in the feature's plan before Step 0.

## Revisit when

- Mintlify supports virtual or data-driven pages, so committed copies are no longer needed.
- An agent needs a new pinned wake provider. That is a separate decision under ADR 0019.
- The Worker's install bundle grows past its budget as agents are added, which would call for lazy sections.
