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

## Lane l2 (core)

### What changed

- `libs/core/src/inbox`: bodies of `validation`, `option-id`, `question-key`, `window`, `routing`, `waiters`, `renderCopy` and `buildNoticePreview` (`inbox-copy.ts`), plus the sixteen use cases under `use-cases/`. Internal helpers: `inbox-error-factories.ts`, `use-cases/{send-content,media-content,hold-for-answer,take-unread,flush-queue}.ts`.
- `libs/core/src/inbox/testing/`: `in-memory.ts` (`createInMemoryDependencies`: repository, recording sender and waker, media store, counting ids, fake clock), `fake-clock.ts`, `fixtures.ts`, `capture-inbox-error.ts`. Tests sit beside the code (`*.test.ts`).
- Additions to the Step 0 contract (new exports, no signature changed): `assertVoiceNote({kind, voice})` (CU-34 and CU-35 pass a voice flag that `assertMediaFits` does not take), `formatChoiceOptionIds({questionId, options})` and `formatRoutingListQuestionId({messageId})` (a routing list is a `to_owner` Choice whose `questionId` is `route:<first held message id>` and whose option titles are agent names; its tappable ids are `route:<message id>:<agent>`).

### How to run

```bash
pnpm --filter @zapbip/core test:unit
pnpm typecheck
```

### Red today, green after

| Test | Red before because | Green after because |
|------|--------------------|---------------------|
| `validation.test.ts`, `option-id.test.ts`, `question-key.test.ts`, `window.test.ts`, `routing.test.ts`, `waiters.test.ts`, `inbox-copy.test.ts` (102 cases) | red commit 7f22dea printed `Error: <name> is not implemented` (routeOwnerMessage 17, parseOptions 10, createReplyWaiters 7, assertMediaFits 7, and so on); CU-89 is a pin | 8a4f715 |
| `use-cases/*.test.ts`, `testing/in-memory.test.ts` (110 cases) | red commit 70fa62c printed `Error: createInMemoryDependencies is not implemented` for all 110 | 8ef26c2 (d974ba8 first corrected two expectations of mine) |

### Hypotheses to attack

1. Hypothesis: owner text with two agents holding open questions goes to the newest question's agent only. Break it by: asking from `alpha`, then `beta`, then receiving a plain text.
2. Hypothesis: a tap on an answered question never records a second answer and reaches the asker with `reply_to`. Break it by: tapping twice, with different options.
3. Hypothesis: `ask` retried after the answer returns the answer and sends nothing. Break it by: retrying at exactly `ASK_RETRY_WINDOW_MS`.
4. Hypothesis: at most one closed-window notice goes out under concurrent sends. Break it by: many concurrent sends with a slow template sender.
5. Hypothesis: two concurrent `wait_for_reply` on one agent hand each unread message to only one call. Break it by: three concurrent waiters and two messages.
6. Hypothesis: an owner reaction never opens the window, never flushes the queue and never prompts a closed window with a routing list.

### Known gaps and notes for other lanes

- `to_owner` Choice messages carry no question text (the contract has only `questionId`, `options`, `selected`). The sender adapter must read the question through `findQuestion` to render the prompt; core does the same for the question notice preview. A routing list has no question; the adapter renders `INBOX_COPY[RoutingPrompt]` and builds the ids with `formatChoiceOptionIds`.
- Repository semantics core relies on (the in-memory repository is the reference): `listOpenQuestions` newest first; `listAgentHistory` the last `limit` messages of that agent in both directions, oldest first; `listUnread`, `listHeld` and `listQueued` oldest first; `findRecentQuestion` matches `askedAt >= askedAfter` and returns the newest; `deleteQuestionsAskedBefore` and `deleteExpiredReceipts` are strict; `markMediaReceived` also clears `expiresAt`; `findNextExpiry` counts pending-upload `expiresAt`, `retentionUntil`, queued `at + QUEUE_RETENTION_MS`, question `askedAt + QUESTION_RETENTION_MS` and receipt `receivedAt + RECEIPT_RETENTION_MS`; `claimNotice` is a compare-and-set on `noticeSentForClosedWindow`.
- `ask` accepts `optionDescriptions` either empty (no descriptions) or the same length as `options`; any other length is `option_descriptions: must match options`. The MCP edge should send one of the two.
- Fixed after the lane merged: a message held before the first agent is handed to the first agent on its first contact (`touchAgent`); the receive use case reads and routes first, then records the receipt and stores the message back to back, so a failure before the store is retried and a failure after it leaves the stored message unread behind a duplicate receipt; concurrent flushes claim queued ids in a per-repository set before any await and re-read the message state before sending. There is no `sending` delivery state: the claim is in memory (a Durable Object is one instance), which needs no change to `libs/types` or the repository port.
- A failure after the store (window save, flush, wake notice) is not retried: the retry is a duplicate. The message waits unread.
- `listUnread` plus `markRead` is serialised per repository object inside `takeUnread` (a module-level `WeakMap`), so it assumes one repository object per Durable Object instance.

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

## Lane L3 (storage and platform)

### What changed

- `apps/api/src/signing.ts`, `src/log.ts`, `src/adapters/**`: HMAC link signing (`sig` is base64url, not hex as the contract prose says; opaque to callers), SHA-256 digest, secret generator, D1 directory, message index, owner directory, SQLite repository (raw bound SQL through `storage.sql`; Drizzle is not used), R2 media store (`signedLink` returns `exp=<ms>&sig=<sig>`), platform and durable clocks, ids, none waker, fake WhatsApp sender.
- `apps/api/src/account-inbox/**`: `AccountInbox` (migrations in the constructor, RPC wrapper that maps `InboxError` to `{ok: false, errorCode, message}`, one alarm over `DueTimeProvider`s), the set-based runner `run-migrations.ts`, `migrations/v1.sql`.
- `apps/api/migrations/0001_core.sql`, `apps/api/scripts/{dev-seed,build-directory-seed}.ts`, `apps/api/test/support/**`.
- Deviation: the fake sender exposes `listScreenEntries()` (contract said `readScreen`), so the production bundle, which holds the fake sender in slice 1, contains neither `readScreen` nor `advanceClock`. L4b's `DevAccountInbox.readScreen()` is `return this.sender.listScreenEntries()` and `advanceClock(input)` is `return this.clock.advance(input)`; `sender` and `clock` are typed `FakeWhatsAppSender` and `DurableClock`.
- Needed from files L3 does not own: `.gitleaks.toml` allowlist entry for the historical fixture string (done on the orchestrator's instruction).

### How to run

```bash
pnpm --filter @zapbip/api test:unit
pnpm --filter @zapbip/api test:integration
pnpm --filter @zapbip/api typecheck
pnpm --silent --filter @zapbip/api dev:seed --phone 5511999990000 --agents alpha,beta --json --persist-to <dir>
```

Seed needs `wrangler d1 migrations apply CONNECTIONS --local --persist-to <dir>` first. Without `--silent`, pnpm prints a banner line before the JSON.

### Red today, green after

| Test | Red text | Green |
|------|----------|-------|
| `test/unit/signing.test.ts`, `connection-secret.test.ts` (14 cases) | `signLink is not implemented`, `generateConnectionSecret is not implemented` | 90d4ff3 |
| `no-interpolated-sql.test.ts` | pin, green on landing | |
| `d1-directory`, `d1-message-index`, `sqlite-repository` (33 cases) | `D1ConnectionDirectory.resolveSecretDigest is not implemented`, `runMigrations is not implemented` (WI-4 and WI-6 are pins) | fefbc48 |
| `account-inbox.test.ts` (18 cases) | `sendText is not implemented`, `alarm is not implemented`, `no such table: schema_versions` | 88764a9 plus the L2 merge |
| `dev-seed.test.ts` (6 cases) | `findOwnerStatement is not implemented` | 1f18200 |

Counts at the last run: unit 18 passed, integration 59 passed.

### Hypotheses to attack

1. Hypothesis: a queued message, an upload, owner media, a question or a receipt each arm the alarm at its own deadline. Break it by: advancing the clock past one deadline and running the alarm.
2. Hypothesis: a provider that throws leaves the alarm armed. Break it by: a provider whose `nextDueAt` is in the past and whose `runDue` always throws (the alarm re-arms no sooner than 5 s ahead, `ALARM_MIN_DELAY_MS`).
3. Hypothesis: no log line carries text, captions, file names or secrets. Break it by: sending every kind and grepping the console.
4. Hypothesis: an account only reads its own object. Break it by: two connections with different `accountId` against one object name.
5. Hypothesis: the seed refuses a repeated phone and writes nothing. Break it by: running it twice with different agents.

### Fixed after the first merge

- `markRead` stamps `read_at` from the injected clock; the alarm is armed at the clock deadline minus the development offset and re-armed after `advanceClock`; the object re-arms in its constructor. Tests: `stamps a read message with the injected clock`, `arms the alarm at the clock deadline after the clock advances`, `re-arms the alarm when the object is constructed again` (red text in the commit body).

### Known gaps

- `findLastAgentWrite` uses `at >= since`; `findRecentQuestion` is inclusive on `askedAfter` and `listOpenQuestions` is newest first, as in the in-memory repository.
- The fake sender reads the prompt text of a `choice` message from the `questions` row, so `ask` must insert the question before `session`.
- The history of `eb984a0` carries a fixture string that gitleaks flags; `.gitleaks.toml` allowlists it anchored.

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

### Lane L4a update

- 42 of 43 MCP cases pass against L2 and L3. WI-66 (`create_upload` with `size_bytes` 100000001) stays red: core's `assertUploadDeclaration` has no upper bound, so `create_upload` accepts it. The fix belongs in `libs/core` (L2), not in the MCP edge.
- Tests open the 24 hour window first (a queued warm-up, an owner text, a read), because a closed window returns `queued`, not `sent`.
- Core's wording for an unreceived upload is `upload_id: bytes not uploaded yet`; the test plan (WI-47) says `upload has not been received`. The test follows core.
- The screen assertions (WI-35, WI-56) read history through `get_messages`, because `readScreen` is still a stub until L4b.
- `ask` sends `optionDescriptions` empty when no option has a description.
