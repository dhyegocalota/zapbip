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
- The routing list is considered open while any message is held. If the owner writes before any agent has registered (zero agents), the message is held and, once an agent exists, no list is sent until the held messages are resolved: a known gap of the A22 decision.
- Receipt is recorded before routing: an error after it makes a channel retry a duplicate.
- A concurrent flush from two simultaneous owner messages may send a queued message twice.
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
