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
