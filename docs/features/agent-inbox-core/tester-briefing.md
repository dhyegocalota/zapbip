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

## Lane L4a

### What changed

- `apps/api/src/routes/mcp.ts`: `POST|GET|DELETE` on `/c/:secret/mcp` (path secret) and `/mcp` (Bearer). A malformed, unknown or deleted secret returns `401` with `UNAUTHORIZED_BODY` from one return path; the directory is not queried for a malformed secret. A stateless `WebStandardStreamableHTTPServerTransport` (`enableJsonResponse: true`) and a fresh `McpServer` serve each request.
- `apps/api/src/mcp/`: `resolve-connection.ts`, `server.ts` (registers every `TOOL_DEFINITIONS` entry, logs `ToolCall` and `ToolError`), `tool-handlers.ts` (one handler per `McpToolName`), `tool-error.ts` (`CallOutcome` error to `isError` with the core message), `wire.ts` (one builder per `MessageKind`), `links.ts` (`/m/...` read links and `/c/<secret>/u/<id>` upload links on `PUBLIC_ORIGIN`), `inline-images.ts` (owner images up to `INLINE_IMAGE_MAX_BYTES`, size checked before `mediaStore.get`), `constants.ts`, `types.ts`.
- Plan deviation: the plan names `src/mcp/tool-definitions.ts`; the registry already lives in the read-only `src/contract/tool-definitions.ts`, so the handlers are in `src/mcp/tool-handlers.ts`.
- Tests: `apps/api/test/integration/{mcp-auth,mcp-tools,mcp-inline-images}.test.ts`, with `mcp-fixtures.ts` and `mcp-environment.d.ts` beside them (not in the plan's file list; they only serve these three tests and reuse L3's `test/support/seed.ts`).

### How to run

```bash
pnpm install
pnpm --filter @zapbip/api test:integration
pnpm typecheck
```

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `mcp-auth.test.ts` (7 cases) | red commit dacf1ae printed `ENOENT: no such file or directory, open '../../migrations/0001_core.sql'` (the L3 migration was not on the lane base) | c5d29e6 implements the route; green needs L3's `D1ConnectionDirectory` and `hashConnectionSecret` |
| `mcp-tools.test.ts`, `mcp-inline-images.test.ts` | red commit 9737ac6: same `ENOENT`; with L3 merged and no handler registered the expected text is the MCP "tool not found" error | ce75f06 registers the ten tools; green needs L3's Durable Object and D1 bodies |

State when this was written: L2's bodies were merged; L3 had pushed only its red tests. With them merged, the run printed `D1ConnectionDirectory.resolveSecretDigest is not implemented` for 39 cases and `expected 500 to be 401` / `expected 500 to be 200` for the auth cases. Nothing in this lane has been seen green.

### Hypotheses to attack

1. Hypothesis: unknown, deleted and rejected secrets return byte-equal `401` bodies. Break it by: a revoked connection and a random secret, diffing bytes and headers.
2. Hypothesis: `/c/<secret>/mcp` ignores a wrong Bearer. Break it by: a wrong Bearer with a valid path secret.
3. Hypothesis: a malformed secret never reaches D1. Break it by: dropping `connections` and sending `zb_conn_short`.
4. Hypothesis: tool errors keep the core message and set `isError`. Break it by: every cross-field rule of WI-36 to WI-66.
5. Hypothesis: `send_media` rejects both or neither of `url` and `upload_id` with `exactly one of url and upload_id is required`.
6. Hypothesis: an owner image above `INLINE_IMAGE_MAX_BYTES` is never read from R2. Break it by: counting `MEDIA.get` calls for a 1 MB + 1 image.
7. Hypothesis: `upload_url` is `PUBLIC_ORIGIN/c/<secret>/u/<upload_id>?exp=&sig=`, signed for the upload purpose.

### Known gaps

- The `ask` held-answer test answers with owner text, not a button tap (the option id carries a question id the test cannot know before `ask` returns).
- `expires_at` is rendered from the Durable Object's time while the upload link's `exp` comes from the Worker's real clock; they differ when the development clock offset is non-zero.
- An owner image missing from R2 is returned as a link only, without an image block.
- The WI-39 to WI-42 uploads are marked received by writing to R2 and calling `completeUpload`; the PUT route belongs to L4b.
