# Tester briefing: WhatsApp Cloud channel

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## Step 0 (contract, W-1 and W0)

### What changed

- `docs/features/whatsapp-cloud-channel/{spec,plan,test-plan}.md`, ADRs 0012 to 0014 and both indexes — imported (5521e87).
- `plan.md`, `test-plan.md`, `spec.md` — refreshed against slice 1's Step 0 tree and its lane tip; 30 differences listed in the plan's "Plan refresh (W-1.1)" table (59d0adc).
- `libs/types/src/enums.ts`, `constants.ts` — `DeliveryState.Delivered|Read|Sending`, `MediaSourceKind.Unavailable`, nine `ChannelErrorKind` members, `ChannelInboundKind`, `BYTES_PER_KILOBYTE` (659e505).
- `libs/core/src/inbox/{errors,message,inbox-records,ports,index}.ts`, `use-cases/types.ts` — `ChannelError extends InboxError`, the `Unavailable` source, `closedAt`, `ChannelStatusDetail`, seven new `InboxRepository` methods, the widened `MessageSender.session`, the channel types.
- `libs/core/src/inbox/use-cases/{receive-channel-message,open-window,close-window,apply-status,status-rule,claim-queued}.ts` — stubs throwing `<name> is not implemented`.
- `apps/api/src/adapters/whatsapp/*` — constants, enums, copy and templates as real constants; every other module a stub.
- `apps/api/src/adapters/d1/{d1-owner-directory,d1-channel-restrictions}.ts`, `adapters/platform/hash.ts` — new stub functions and the `D1ChannelRestrictions` stub class.
- `apps/api/src/contract/{env,account-inbox-rpc,constants}.ts`, `account-inbox/account-inbox.ts`, `routes/whatsapp.ts`, `app.ts` — optional WhatsApp bindings, two RPC stubs, the webhook path, the stub route mounted.
- `apps/api/wrangler.jsonc`, `vitest.integration.config.mts`, `test/support/fake-graph.ts` — the development Graph URL var, the test bindings, the stub fake Graph.

### How to run

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test:unit
pnpm --filter @zapbip/repository-shape test:unit
```

### Red today, green after

No test exists yet in Step 0. Every red test arrives with its lane (W1 to W6); each red run must print `<name> is not implemented` (or the stub route's `not implemented` for W4.5).

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| (none in Step 0) | | |

### Hypotheses to attack

1. Hypothesis: the contract typechecks and nothing at runtime changed. Break it by: `git diff 59d0adc..659e505 --stat` and `pnpm typecheck`; start `wrangler dev` and `GET /health` still answers `{ok: true}` (the stub webhook route only throws when its own path is called).
2. Hypothesis: no value hides behind a default. Break it by: grep the diff for `??` and `?:` defaults; the five WhatsApp bindings are optional only in the type.
3. Hypothesis: `ChannelError` flows through slice 1's tool error path unchanged. Break it by: after W1, throw one from a fake sender in a send test and read the MCP error; `code` must be the kind.

### Known gaps

- `pnpm verify` stops at the `secrets` gate in this repository: gitleaks finds `LOG_SECRET_FILENAME` in `apps/api/test/integration/account-inbox.test.ts` in commit `eb984a0`, which sits on slice 1's lane branches that share this object store. The allowlist that silences it (`79eb7b4`) is on `feat/agent-inbox-core` locally but not in this branch's base. Typecheck, unit, shape, format and audit gates were run by hand and are green. The lead merges the allowlist (a one-line `.gitleaks.toml` change this lane does not own).
- W0b is not done: it needs slice 1's lanes merged (in-memory ports, the SQLite repository, the fake sender, `session` call sites, `ERROR_STATUS`, the seed signatures). The plan gained that step (reported).
- The signature of `parseStatusItems` (`status-parser.ts`) is this developer's choice; the plan named the file but no function. W4 may change it before its red test.
- The `status-parser.ts` choice, the fake Graph as an HTTP server (R30) and the sender seam (R15) change the plan's earlier text; the owner-delegated rows are in the spec's answers table.
- Slice 1's lane bodies for `deliver-to-owner.ts` and `flush-queue.ts` call `session({message})`; they stop typechecking when merged until W0b adds the new fields.

## Lane W5 (docs)

### What changed

- `apps/docs/concepts/whatsapp-channel.mdx` and `apps/docs/concepts/owner-notices.mdx`, listed in the `Concepts` group of `apps/docs/docs.json`.
- `tools/repository-shape/src/whatsapp-docs.test.ts`: both pages exist, are in the `Concepts` group, and state each limit and notice term it names.
- Merging `origin/feat/agent-inbox-core` conflicted in `apps/api/src/app.ts` and `apps/api/src/adapters/d1/d1-owner-directory.ts` (files this lane does not own). Resolved by keeping both sides: `whatsappRoutes` plus slice 1's `extraRoutes`, and slice 1's `findOwnerByPhone` body beside the `OwnerRecipient` type and the `findOwnerByAccountId` stub. The lead should expect the same conflicts when merging W0b.

### How to run

```bash
pnpm --filter @zapbip/repository-shape exec vitest run src/whatsapp-docs.test.ts
pnpm --filter @zapbip/docs exec mint broken-links
```

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `whatsapp-docs.test.ts` (22 cases) | `c74ef84`: 22 failed; `ENOENT ... apps/docs/concepts/whatsapp-channel.mdx` and the pages absent from the Concepts group | the pages and the navigation entries exist |

### Hypotheses to attack

1. Hypothesis: every limit on the channel page equals the constant the adapter uses (4,096 text, 1,024 button body, 3 buttons, 20 title, 10 rows, 24 row title, 72 description, 5/16/16/100 MB, 100 KB sticker, 30 days reaction age, 24 hours restriction). Break it by diffing each against `apps/api/src/adapters/whatsapp` constants once W2 lands.
2. Hypothesis: the page text matches the spec's tables. Break it by reading the page against the spec's inbound and outbound mapping.
3. Hypothesis: `mint broken-links` passes. Break it by running it.

### Known gaps

- The shape test checks substrings, not that a number sits beside the right kind.

## Lane W3 (storage and Durable Object)

### What changed

- `apps/api/migrations/0004_whatsapp_channel.sql`: `channel_restrictions (phone_number_id PRIMARY KEY, error_code, restricted_at)`.
- `apps/api/src/account-inbox/migrations/{v4.sql,index.ts}`: DO schema `v4` (six `inbox_messages` columns, a unique index on `channel_message_id`, `owner_window.closed_at`), registered beside `v1` in the set-based runner.
- `apps/api/src/adapters/d1/d1-owner-directory.ts`: `findOwnerByAccountId`; both finders throw naming the stored locale when it is not an `OwnerLocale` member.
- `apps/api/src/adapters/d1/d1-channel-restrictions.ts`: `D1ChannelRestrictions` (bound parameters, upsert, TTL read). The constructor takes `phoneNumberId` as well as `database`, because the table is keyed by it and `findActive` / `record` carry no id.
- `apps/api/src/adapters/platform/hash.ts`: `sha256Hex`, `sha256Base64`; `hashConnectionSecret` reuses `sha256Hex`.
- `apps/api/src/adapters/sqlite/sqlite-inbox-repository.ts`: the seven channel methods and `closedAt`; `commitChannelInbound` is one `transactionSync`. `findNextExpiry` also covers stale `Sending` claims, folded into the queue term because Durable Object SQLite allows at most five compound terms.
- `apps/api/src/account-inbox/account-inbox.ts`: protected `createSender` (production: Cloud API sender, a missing variable throws naming it), the two channel RPC bodies, `sender` typed `MessageSender`; `apps/api/src/dev/dev-account-inbox.ts` overrides `createSender` (Cloud API when `WHATSAPP_ACCESS_TOKEN` is set, else the fake).
- `apps/api/src/mcp/wire.ts` and `contract/mcp-schemas.ts`: `media_status` (`"unavailable"` or `null`) on every message wire.
- `apps/api/test/support/seed.ts`: `applyDirectoryMigration` runs `0001` and `0004`.
## Lane W1 (core)

### What changed

- `libs/core/src/inbox/use-cases/{status-rule,close-window,open-window,apply-status,claim-queued,receive-channel-message,flush-queue,deliver-to-owner,sweep-expired}.ts` — bodies. `window.ts` honours `closedAt`.
- New helper modules beside them: `owner-placement.ts` (placement, plan, builders), `owner-arrival.ts` (wake, route, prompt, `finishArrival`), `session-delivery.ts` (one session attempt, classified; sent and failure records), `notice-owner.ts` (the closed-window notice). `receive-owner-message.ts` now builds on them; slice 1's tests are unchanged and green.
- `libs/core/src/inbox/claim-constants.ts` (new) — `FLUSH_CLAIM_LIMIT` and `SENDING_STALE_MS`. The core cannot import the copies in `apps/api/.../whatsapp-constants.ts`, and `constants.ts` is not this lane's, so the core owns these two names. The `apps/api` copies are redundant and can import them once `index.ts` exports the file.
- `libs/core/src/inbox/testing/in-memory.ts` — the channel port bodies, `findStatusDetail` and `findClaimedAt` read helpers, and a recording sender that keeps `sessionRequests`, takes an `error` for `failSessionCalls` and `failTemplateCalls`, and gates sessions. `testing/channel-fixtures.ts` is new test support.
- Behaviour: one `transaction` is the in-memory `commitChannelInbound` (receipt, message, answer, media record and window). A duplicate returns the original `messageId` and `agent` (looked up by channel id). `deliverToOwner` with an open window goes through `flushQueue` (slice 1's serializer, so a send cannot overtake the queue) and reads the outcome. Every flush claims its messages as `Sending` first, sends one by one, records `Failed` per message with Meta's `errorCode`, and stops at the first `WindowClosed` (rest back to `Queued`, `closeWindow`, one notice).
- The merge of `origin/feat/agent-inbox-core` (rule 6, queue order, `hasLiveWaiter`, original id on duplicate, `RoutingListExpired`) is reconciled in 25e7e1b. `apps/docs/docs.json` was a conflict in a file this lane does not own: it took slice 1's bilingual structure and added `concepts/whatsapp-channel` and `concepts/owner-notices` to the English Concepts group. The Portuguese twins slice 1's docs test requires do not exist; W5 or the lead owns that.

### How to run

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm --filter @zapbip/api test:unit
pnpm --filter @zapbip/api test:integration
pnpm --filter @zapbip/core test:unit
pnpm typecheck
```

### Red today, green after

| Test | Red (commit 4c41f71) printed | Green after |
|------|------------------------------|-------------|
| `hash-digests.test.ts` | `sha256Hex is not implemented`, `sha256Base64 is not implemented` | 34860c8 |
| `mcp-wire.test.ts` | `expected { ... } to match object { media_status: ... }` | 07780a1 |
| `d1-channel-restrictions.test.ts` | `D1ChannelRestrictions.findActive is not implemented` | 34860c8 |
| `d1-owner-directory-channel.test.ts` | `findOwnerByAccountId is not implemented`; the locale cases resolved instead of rejecting | 34860c8 |
| `d1-message-index-channel.test.ts` | pin: green when it landed | n/a |
| `account-inbox-channel.test.ts` repository cases and `DO schema v4` | `commitChannelInbound`, `saveChannelMessageId`, `saveChannelStatusDetail`, `claimQueuedMessages is not implemented`; v4 columns missing | 34860c8 |
| `account-inbox-channel.test.ts` WI-8 to WI-16 | `receiveChannelMessage is not implemented` | 07780a1 plus lane W1 (core bodies) and lane W2 (`readWhatsAppEnvironment`, `createGraphClient`, `createCloudApiMessageSender`) |

### Needed from outside this lane

- Done (owner delegated 2026-11-06): `WHATSAPP_ACCESS_TOKEN` is removed from `vitest.integration.config.mts`. For W2: the pool no longer binds the token, so `whatsapp-outbound.test.ts` must select the Cloud API sender with the instance `env` override, as `account-inbox-channel.test.ts` does (`Object.create(instance, {env})` with the token added). Original problem: the file bound `WHATSAPP_ACCESS_TOKEN`. With W3 merged, `DevAccountInbox` picks the Cloud API sender when that variable is set, so every slice 1 integration test that reads the simulator screen (`account-inbox`, `dev-owner`, `mcp-tools`, `sqlite-repository`, `upload-route`, `mcp-inline-images`) fails. With the binding removed, 192 of 192 pass once W1 and W2 are merged. The file is W0's: remove the `WHATSAPP_ACCESS_TOKEN` line, and let tests that need the Cloud API sender select it as `account-inbox-channel.test.ts` does (`Object.create(instance, {env})`).
- `apps/api/test/integration/account-inbox.test.ts` WI-118 now expects `[1, 4]` (the new migration changes that slice 1 assertion; edited in 34860c8).
- `contract/mcp-schemas.ts` (not on W3's list) gained `media_status`; without it `wire.ts` cannot type the field.

### Hypotheses to attack

1. Hypothesis: a retry after a throw before the commit stores once, after the commit returns `duplicate: true`. Break it by: throw inside `commitChannelInbound`, then inside the waker; count `channel_receipts` and owner messages.
2. Hypothesis: `claimQueuedMessages` never hands the same message to two callers. Break it by: two concurrent `flush` calls against one queue.
3. Hypothesis: a stale restriction is ignored exactly at the TTL. Break it by: `findActive` at `restricted_at + RESTRICTION_TTL_MS - 1` and `+ RESTRICTION_TTL_MS`.
4. Hypothesis: the production bundle carries no fake sender. Break it by: grep the production bundle for `createFakeWhatsAppSender`.
5. Hypothesis: `migrations/0004` applies cleanly on a database that already has `0001`. Break it by: `wrangler d1 migrations apply` against a copy.

### Known gaps

- WI-8 to WI-16 cannot go green until W1's and W2's bodies are merged here; verified in a throwaway merge of both local branches (see the report).
- The Cloud API sender path is exercised only through the selection tests; real sends belong to W2's `whatsapp-outbound.test.ts`.
| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `status-rule.test.ts` (16) | `d359dc6`: `applyStatusRule is not implemented` (14), `mergeChannelStatusDetail is not implemented` (2) | `1d9d18e` |
| `window.test.ts` CU-13 | `d359dc6`: `expected true to be false` | `1d9d18e` |
| `in-memory.test.ts` channel ports (8) | `60d128b`: `commitChannelInbound`, `claimQueuedMessages`, `saveChannelMessageId`, `saveChannelStatusDetail` `is not implemented` | `2c2c4a2` |
| `receive-channel-message`, `open-window`, `claim-queued`, `close-window`, `apply-status` tests | `9ade281`: `receiveChannelMessage` (16), `openWindow` (10), `applyStatus` (8), `claimQueued` (4), `closeWindow` (3) `is not implemented` | `737f60a` |
| `deliver-to-owner-channel.test.ts` CU-32, 34, 36, 37, 42 | `9ade281`: sender errors all became `delivery_failed`, no channel ids reached the sender, e.g. `expected null to be 'wamid.session.1'` | `737f60a` |
| `sweep-expired.test.ts` CU-38b and the due-time case | `9ade281`: stale claims never released | `737f60a` |
| `receive-channel-message.test.ts` CU-17 | `93821ec`: `expected { messageId: null, agent: null, duplicate: true } to deeply equal { messageId: 'msg_1', agent: 'alpha', duplicate: true }` | `5fe44ee` |
| `status-rule` impl typecheck | n/a | `94375a2` fixed a TS2531 in `1d9d18e` |

Pins: the window-only repeat case in `receive-channel-message.test.ts` was green on landing (`93821ec`). Four setup mistakes in my own red tests (CU-31, CU-35, CU-37, CU-23: a `Queued` start for a status sequence, sender call numbers consumed by owner-side replies) were corrected in `737f60a`.

### Hypotheses to attack

1. Hypothesis: two concurrent flushes never send one message twice, and a new session send never overtakes a running flush. Break it by: CU-24c with the gate, plus a third `deliverToOwner` started while the gate is closed; read `sessionRequests` order.
2. Hypothesis: a throw before `commitChannelInbound` leaves nothing and the retry stores once; a throw after it leaves one message and the retry is `duplicate: true` with the original ids. Break it by: make the repository or waker throw at each await of `receiveChannelMessage`.
3. Hypothesis: the status rule table of the spec holds for every pair, including `Sending` and `Expired` as current states (the rule answers "no change"). Break it by: feeding `Sending` then `Sent` through `applyStatus` while a flush is mid-send.
4. Hypothesis: `WindowClosed` during a flush leaves every unsent message `Queued`, the window closed at `clock.now()`, and exactly one template call, even when the first queued message has `agent: null`. Break it by: a queue whose first message is a routing list.
5. Hypothesis: an unknown reaction target keeps the channel id as `targetMessageId` and routing then finds no referenced message. Break it by: CU-44 variants with a channel id equal to a core message id.

### Known gaps

- `applyStatus` cannot log `status.failed.ignored`: the core has no logger, and `ApplyStatusResult` is `{applied}` only (contract). `applyStatusRule` still returns `logged`; W3 or W4 cannot see it. A later contract change could carry it.
- `claimQueued` takes only `dependencies` (contract), so CU-25 claims `FLUSH_CLAIM_LIMIT` of `FLUSH_CLAIM_LIMIT` + 3 instead of `limit: 2`.
- A status that arrives while a message is `Sending` (wamid saved, `Sent` not yet written) is ignored by the rule, and `recordSent` then writes `Sent` over nothing. The window is one await wide and only the Graph path can reach it.
- A notice that fails inside a flush is swallowed after the notice is released, so the next flush retries; the message that triggered a `deliverToOwner` flush gets the failure, a flush started by `openWindow` or `receiveChannelMessage` does not report it.
- The SQLite adapter (W3) must mirror the in-memory bodies: `commitChannelInbound` stores `channelMessageId` on the message so `findMessageByChannelMessageId` finds it; `claimQueuedMessages` orders like `listQueued`; `findNextExpiry` includes `claimed_at + SENDING_STALE_MS`; `saveChannelMessageId` keeps the first write. Until then the API integration tests that send through the SQLite repository stop at its W0b stubs.
- `receiveOwnerMessage` (the simulator path) now calls `saveChannelMessageId` so a reaction to an owner message has a channel id to target.

## Lane W2 (outbound)

### What changed

- `apps/api/src/adapters/whatsapp/{outbound-builders,outbound-limits,template-sanitiser,channel-error-mapping,graph-client,read-whatsapp-env,operator-log,cloud-api-message-sender}.ts`: bodies. `whatsapp-templates.ts` gains `TEMPLATE_NAME_BY_KIND`.
- `apps/api/test/support/fake-graph.ts`: the server (`startFakeGraph`, now also returns its `port`), the send route, one-shot registered responses, request recording, control routes under `/__fake`.
- `apps/api/test/fixtures/whatsapp/outbound/*.json` and eleven test files: `whatsapp-{copy,templates,outbound-builders,outbound-limits,template-sanitiser,channel-error-mapping,graph-client,read-whatsapp-env,operator-log,cloud-api-message-sender,fake-graph}.test.ts` (unit) and `integration/whatsapp-outbound.test.ts`.
- Contract deviations, all inside W2-owned files: `buildSessionPayload` takes `locale` (the list copy needs the owner locale); `outbound-limits.ts` also exports `assertTextBody`, `assertReactionTarget`, `REACTION_TARGET_FIELD`; `graph-client.ts` also exports `GraphRequestError` (status, Graph code, title) and `GRAPH_NO_RESPONSE_STATUS` (0: timeout or network failure); the sender's `messageIndex` is `Pick<D1MessageIndex, 'record'>`; the `message` field of `mapGraphErrorToChannelError` is the subject the agent reads (`image image/jpeg`, `reaction.message_id`, the kind).

### How to run

```bash
pnpm --filter @zapbip/api typecheck
pnpm --filter @zapbip/api test:unit
pnpm --filter @zapbip/api exec vitest run --config vitest.integration.config.mts whatsapp-outbound
```

The integration file needs W3's bodies and the fake Graph listening on port 4012 (see the gaps).

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `whatsapp-copy.test.ts`, `whatsapp-templates.test.ts` | pin: green on arrival (fb03bb2) | |
| `whatsapp-outbound-builders`, `-outbound-limits`, `-template-sanitiser`, `-channel-error-mapping` (7f0481f) | 87 failed: `buildSessionPayload is not implemented`, `buildTemplatePayload is not implemented`, `assert* is not implemented`, `sanitiseTemplateParameter is not implemented`, `mapGraphErrorToChannelError is not implemented` | 6c1bef0: 96 passed |
| `whatsapp-graph-client`, `-read-whatsapp-env`, `-operator-log`, `-cloud-api-message-sender`, `-fake-graph` (1e7aebf) | `createGraphClient is not implemented`, `readWhatsAppEnvironment is not implemented`, `logOperatorEvent is not implemented`, `createCloudApiMessageSender is not implemented`, `startFakeGraph is not implemented` | dc62dba and 4aeace4: 14 unit files, 168 passed |
| `whatsapp-outbound.test.ts` (integration) | the file fails to load: `readWhatsAppEnvironment is not implemented` (no tests collected) | needs W3 and the Graph global setup; run in a throwaway merge of W3 with `startFakeGraph({port: 4012})` as a global setup: 14 passed |

### Hypotheses to attack

1. Hypothesis: no bearer token reaches a host outside `fbcdn.net`, `fbsbx.com`, `whatsapp.net`. Break it by: `download` with `https://lookaside.fbsbx.com@evil.com/x`, `https://evil.com/.fbsbx.com/x`, `https://evilfbsbx.com/x`, `http://` and a 302 to a foreign host; the fetcher must not be called, or be called once without following.
2. Hypothesis: a restricted account never reaches Graph. Break it by: make the fake return `131048` once, send twice, read `fakeGraph.requests()` (one send request); then record a row older than 24 h and send again (one more request).
3. Hypothesis: an empty or whitespace template preview never reaches Meta empty. Break it by: a `template` call with `['alpha', '   ']`, `['alpha', '']`, a 200 character value, a value cut inside an emoji.
4. Hypothesis: a limit change fails loudly. Break it by: a 21 character button title, a fourth button, an eleventh list row, a 4,097 character text: each throws naming the Graph field path.
5. Hypothesis: the operator log never carries a token, phone number or body. Break it by: provoke `190`, `131048`, a timeout and a rejected template, and read every `console.error` line.
6. Hypothesis: a session send and a template send map the same code differently only where the plan says. Break it by: `131048` on a template (must stay `Restricted`), `132000` on a template (`TemplateRejected`) and on a session (`Unknown`).

### Known gaps

- Finding for the lead: the registered body of `zapbip_agent_question` (both languages) starts with `{{1}}`. Meta's template review rejects a body that starts or ends with a parameter; `assertTemplateBodyHasFixedWords` exists and refuses it, but is not wired to the registered bodies because the spec fixes their text. Decide the wording before the owner registers the templates (owner-run probe).
- `whatsapp-outbound.test.ts` cannot be green on this branch: `findOwnerByAccountId` and `D1ChannelRestrictions` are W3 stubs, and nothing starts the fake Graph on port 4012 for the integration pool. The lead needs a `globalSetup` entry in `vitest.integration.config.mts` (W0-owned) that calls `startFakeGraph({port: 4012})`. W3's `D1ChannelRestrictions` constructor takes `phoneNumberId`; the test will need that argument after the merge.
- Deferred to W3 and W6 (DO paths): WI-58 through the tool, WI-59 queueing, WI-62 and WI-66 failure state on the stored message, WI-60 as a tool error. The integration file proves the sender against D1, R2 and the fake Graph only.
- Inbound media download, metadata and `404` refresh routes are not in the fake Graph; `respondWith` serves any method and path once, which W4's tests can use.
- Stored media of an unknown MIME type or size passes `assertOutboundMedia` (A11); animated stickers are not detected (A12).
