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
