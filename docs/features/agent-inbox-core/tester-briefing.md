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

## Lane L4b

### What changed

- `apps/api/src/routes/{upload,media,dev-owner}.ts`, `routes/http-status.ts` (status enum and the error-code map), `routes/account-inbox-stub.ts` (typed stub lookup). `upload.ts` uses L4a's `mcp/resolve-connection.ts`.
- `apps/api/src/dev/dev-account-inbox.ts`: `readScreen` and `advanceClock`. They assume the base class assigns the fake sender to `sender` and a `DurableClock` to `clock`.
- `apps/api/test/integration/{upload-route,media-route,dev-owner,production-entry}.test.ts` and `route-fixtures.ts` (builds on L3's `test/support`).
- `apps/api/test/e2e/{global-setup,stack,mcp-client.e2e,production-bundle.e2e,claude-code.e2e}.test.ts` and `global-setup.ts`.

### How to run

```bash
pnpm --filter @zapbip/api test:integration
pnpm --filter @zapbip/api test:e2e
ZAPBIP_CLAUDE_E2E=1 pnpm --filter @zapbip/api test:e2e
```

### Red today, green after

| Test | Red before the change because | Green after because |
|------|-------------------------------|---------------------|
| `upload-route.test.ts` (14) | red 654494a: all 14 failed with `hashConnectionSecret is not implemented` (Step 0 stub in the seed) | 33006ec, once L3's Durable Object and clock land |
| `media-route.test.ts` (7) | red 73a344d: `createPlatformClock is not implemented`, `signLink is not implemented` | 090041c, once L3's clock, R2 store and signing land |
| `dev-owner.test.ts` (16 cases) | red 7194fe5: `hashConnectionSecret is not implemented`; WI-106 and WI-107 passed (pins, an unmounted route is already a 404) | dc6fac4, once L3's Durable Object lands |
| `production-entry.test.ts` | pin 8be18b9: WI-117 and WI-122 green at once | the other cases need L3 and L4a |
| `production-bundle.e2e.test.ts` PB-2 | red 26f1a96: `expected [ "/dev/owner/", "advanceClock", …(1) ] to deeply equal []` | the entry-split commit: `createApp` takes `extraRoutes`; PB-2 and PB-3 pass. |

State when this was written: L2, L3 (D1 directory, repository) and L4a were merged. The Durable Object and `adapters/platform/clock.ts` were still stubs, so 76 of 121 integration cases failed with `createPlatformClock is not implemented`, `sendText is not implemented` and `createUpload is not implemented`. The E2E suite was not run: it needs L3's `scripts/dev-seed.ts`.

### Hypotheses to attack

1. Hypothesis: the upload checks run in the order 401, 403, 404/410/409, 411, 413, 400, 415, and no failing PUT leaves an R2 object. Break it by: each failing case followed by `MEDIA.head`.
2. Hypothesis: a media link is bound to its account id, so swapping the path account id gives 403. Break it by: reusing `exp` and `sig` with another account id.
3. Hypothesis: the read and upload keys are not interchangeable. Break it by: signing with the other key.
4. Hypothesis: the simulator stamps owner messages with the Durable Object's offset time, so the window reopens after the clock moves. Break it by: advancing the clock, posting owner text, sending as an agent and expecting `sent`.
5. Hypothesis: a duplicate `wamid` stores one message. Break it by: posting twice, concurrently.
6. Hypothesis: the simulator routes are absent from the production entry (WI-109 to WI-111). Break it by: all three on `index.ts`.

### Known gaps

- **Fixed in the entry-split commit (was a blocker):** `src/app.ts`: `createApp` imports `routes/dev-owner` statically, so the production bundle contains the simulator (PB-2 is red). The change: `createApp` takes the simulator routes as a parameter, and only `index.dev.ts` imports `routes/dev-owner`.
- The E2E assertions about the screen text of media (a link matching `/m/`) and about `ScreenEntry.options` holding option ids are guesses about L3's fake sender. Check them when it lands.
- `global-setup.ts` expects the dev seed to print `{"connections":[{"agent","secret"}]}`.
- A rejected owner media type (WI-108) leaves its bytes in R2: the simulator stores them before core validates.
- CC-4 and CC-5 are not written; only CC-1, CC-2, CC-3 and CC-6 are.
- `advanceClock({advanceMs: 0})` is how the simulator reads the Durable Object's offset; it logs nothing.
