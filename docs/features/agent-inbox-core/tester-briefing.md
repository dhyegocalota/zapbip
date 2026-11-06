# Tester briefing: Agent inbox core

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## Step 0 (contract)

### What changed

- `libs/types`, `libs/core`, `apps/api`, `apps/docs`: manifests, tsconfigs, `pnpm-lock.yaml`; `tsx` 4.23.15 at the root.
- `libs/types/src`, `libs/core/src/inbox`, `apps/api/src`: every contract file of the plan, verbatim, with stubs that throw `<name> is not implemented`; `inbox-copy.ts` is complete except `renderCopy` and `buildNoticePreview`.
- Additions: `DueTimeProvider`, `McpToolName` and `TOOL_DEFINITIONS`, `generateConnectionSecret` and `logEvent` stubs, `InboxRepository.claimNotice()`, `armAlarm()` and `protected` sender and clock on `AccountInbox`.
- `apps/api/wrangler.jsonc`: as given, plus `vars` and `migrations` repeated in `env.production`.
- `tools/repository-shape/src/delivery-docs.test.ts`: the `apps` and `libs` roots and the four READMEs; `AGENTS.md` layout and Language lines.
- `docs/learnings/2026-11-06-mcp-sdk-subpath-keeps-the-js-suffix.md`.

### How to run

```bash
pnpm install
pnpm typecheck
pnpm verify all
```

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `tools/repository-shape/src/delivery-docs.test.ts::the %s package has a README` (four rows) and `the root holds only the entries the layout names` | red commit 2516967 printed six failures: the four READMEs and the `apps` and `libs` roots were missing | 33624f6 wrote the READMEs and the root entries |

### Hypotheses to attack

1. Hypothesis: `pnpm typecheck` covers `apps/api` production code and test code (two `tsc` runs). Break it by: importing a `cloudflare:test` name from `src/`.
2. Hypothesis: the `.js` suffix on `@modelcontextprotocol/sdk` subpaths is required by the bundler, not by `tsc`. Break it by: bundling a file that imports the suffix-less path with esbuild.
3. Hypothesis: no stub is reachable from `pnpm verify`. Break it by: running every `test:*` script of `apps/api` and expecting "No test files found".

### Known gaps

- `scripts/verify-gates.tsv` is unchanged; the `integration`, `e2e` and `docs` gates need `verify.sh`, which L1 owns (S1.1, S1.2).
- `wrangler deploy --dry-run --env production` was not run (its bundle test belongs to L4b).
- `@cloudflare/vitest-pool-workers` 0.23.0 is deprecated upstream in favour of `@cloudflare/vitest-plugin`; the pin follows the plan.

## Lane l5

**Changed:** `apps/docs` only. `docs.json` navigation (Get started, Concepts, MCP reference), `index.mdx`, five `concepts/*.mdx`, ten `mcp-reference/*.mdx`, and `snippets/message-kinds.mdx` imported by the concept inbox page and every tool page.

**Run:** `pnpm --filter @zapbip/docs exec mint broken-links`.

**Red then green:** 27b4582 red, printed `found 1 broken links in 1 files` for `index.mdx -> /mcp-reference/send-message`. 539a484 green: `success no broken links found`.

**Hypotheses:**
- Every page in `docs.json` exists and every internal link resolves.
- The limits on the tool pages match `libs/core/src/inbox/constants.ts` (text 4096, caption 1024, filename 240, media 5/16/16/100 MB, sticker 100 KB, 3 buttons of 20 characters, 10 rows of 24, 50 s wait, 4 min ask retry, 15 min upload, 7 day retention, history 20).
- `mint dev` renders the snippet import on each tool page.

**Gaps:** `mint validate` needs a login and was not run. Navigation lists only this slice's pages (spec "Docs" assigns the rest to later slices; a nav entry without a file would not be honest). `send_media` documents `voice` and `get_messages` documents `limit`; the spec table does not name them in `send_media` input, take them from the spec message-kind table and the tool table. Pages describe the contract before the Worker (L3/L4) lands.

## Lane l1

### What changed

- `scripts/verify-gates.tsv`: rows for `apps/api/*`, `libs/core/*`, `libs/types/*` (gates `typecheck unit integration e2e`) and `apps/docs/*` (class docs, gate `docs`), all before `apps/*`.
- `scripts/verify.sh`: gates `integration`, `e2e` and `docs` in `ALL_GATES`, each running the `@zapbip/api` or `@zapbip/docs` script.
- `scripts/verify.test.sh`: fixture gains `apps/api` and `apps/docs` packages; new classification and run cases.

### How to run

`pnpm test:verify`, and `pnpm verify --plan` after touching a path of each kind.

### Tests

| Test | Red before because | Green after because |
|------|--------------------|---------------------|
| `verify.test.sh` core, types, api, docs site rows and runs | 448fb27 printed 14 FAIL lines, for example `a core file: gates: expected '... unit integration e2e', got '... unit'` and `a docs site file: class: expected 'class: docs', got 'class: product'` | 50f253d |
| `the api README` row | pin: `apps/*/README.md` already classified it as docs | n/a |

### Hypotheses to attack

1. A change under `libs/core/**` or `libs/types/**` plans `integration e2e`. Break it by: `pnpm verify --plan` with a touched `libs/types/src` file.
2. An `apps/docs/*` file plans only `docs`, not typecheck or unit. Break it by: touching `apps/docs/docs.json`; `apps/docs/package.json` must still plan everything.
3. `verify all` runs the three new gates last, in order.

### Known gaps

- The Claude Code opt-in (`ZAPBIP_CLAUDE_E2E=1`) lives inside the e2e suite (L4b), not in `verify.sh`.
- The gate commands were exercised only through stubs; the real `test:e2e` and `mint broken-links` need the other lanes.
