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
