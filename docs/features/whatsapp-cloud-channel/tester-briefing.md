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
pnpm --filter @zapbip/core test:unit
pnpm typecheck
```

### Red today, green after

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

- Resolved at integration: the registered bodies of both templates now start and end with fixed words (AU-117 runs `assertTemplateBodyHasFixedWords` over every body).
- Resolved at integration: the integration pool starts the fake Graph on port 4012 (`test/support/fake-graph-global-setup.ts`), and the test builds `D1ChannelRestrictions` with `phoneNumberId` and the sender environment with the access token (`whatsappTestEnv`).
- Deferred to W3 and W6 (DO paths): WI-58 through the tool, WI-59 queueing, WI-62 and WI-66 failure state on the stored message, WI-60 as a tool error. The integration file proves the sender against D1, R2 and the fake Graph only.
- Inbound media download, metadata and `404` refresh routes are not in the fake Graph; `respondWith` serves any method and path once, which W4's tests can use.
- Stored media of an unknown MIME type or size passes `assertOutboundMedia` (A11); animated stickers are not detected (A12).

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
### How to run

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm --filter @zapbip/api test:unit
pnpm --filter @zapbip/api test:integration
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

## Lane W4 (inbound)

### What changed

- `apps/api/src/adapters/whatsapp/{signature,challenge,inbound-parser,status-parser,media-download}.ts` and `apps/api/src/routes/whatsapp.ts`: bodies.
- `apps/api/test/fixtures/whatsapp/{inbound,status}/**`: Meta-shaped JSON messages and statuses, plus `inbound/notification.ts` (notification builders) and `inbound/signed-webhook.ts` (HMAC computed at runtime).
- `apps/api/test/unit/whatsapp-{signature,challenge,inbound-parser,status-parser,media-download}.test.ts` (78 cases) and `apps/api/test/integration/whatsapp-{webhook,status}.test.ts` (20 cases).
- Contract deviations, all inside W4 files (the lead should copy them into the contract text):
  - `parseWebhookNotification` is async, because the media id is a SHA-256 of the wamid and Web Crypto is async.
  - `ParsedChange.phoneNumberId` is `string | null`; a change with an unhandled `field` is returned with no entries so the route can skip it.
  - `ParsedEntry.entry` is `ParsedInboundEntry`: it has no `noticeText` (the route adds the owner copy by locale); an unsupported entry carries `unsupportedType`; a media entry carries `UnavailableOwnerMedia` content plus a download request.
  - `MediaDownloadRequest` has no `sizeBytes` (the webhook does not carry it); `downloadInboundMedia` returns `{stored: true, sizeBytes}` or `{stored: false}` and throws `RetriableMediaError` for a `5xx`, a download that fails to answer, or a Graph timeout.
  - `verifyWebhookSignature` and the token check use `node:crypto` `timingSafeEqual` over digests (works in Workers with `nodejs_compat` and in the node unit run), not `crypto.subtle.timingSafeEqual`.
  - Integration: the media id uses W3's `sha256Hex`.

### How to run

```bash
pnpm --filter @zapbip/api exec vitest run --config vitest.unit.config.mts test/unit/whatsapp-
pnpm --filter @zapbip/api exec vitest run --config vitest.integration.config.mts test/integration/whatsapp-webhook.test.ts test/integration/whatsapp-status.test.ts
```

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| signature, challenge, inbound-parser, status-parser unit (55) | `3785271`: 55 failed, `<name> is not implemented` | `04d7efe` |
| media-download unit (23 including `it.each` rows) | `eba15a7`: 23 failed, `downloadInboundMedia is not implemented` | `62aefb4`: all unit files 78 passed |
| webhook and status integration (20) | `33c454f`: 20 failed, `whatsapp webhook route is not implemented` / `whatsapp challenge route is not implemented`, responses `500` | `4372271`: only the cases that do not need W1, W2 and W3 can go green on this branch (see gaps) |

### Hypotheses to attack

1. Hypothesis: one bad message, change or status never fails the batch (missing `from`, invalid timestamp, malformed payload, unknown type, foreign number, unhandled field). Break it by posting a batch mixing them with one good text and counting stored messages.
2. Hypothesis: no bearer token reaches a host outside `fbcdn.net`, `fbsbx.com`, `whatsapp.net`, and no redirect is followed. Break it with userinfo, path, suffix-without-dot and `http` URLs; also read `graph-client.ts` (W2) for the same guard.
3. Hypothesis: a body over `WEBHOOK_MAX_BYTES` (3,000,000) is `413` before any parse, with or without `Content-Length`, and exactly the cap is accepted. Break it by chunked bodies one byte over and at the cap.
4. Hypothesis: the signature is checked over raw bytes (multibyte bodies included) before JSON is read. Break it with re-serialised, trailing-newline and uppercase-hex headers.
5. Hypothesis: an unindexed status younger than 10 minutes returns `503`, older returns `200`. Break it at 9:59 and 10:01.
6. Hypothesis: a media `5xx` or timeout returns `500` and leaves no receipt; the retry stores once.

### Known gaps

- Integration cases cannot be run green here: every route path reads `readWhatsAppEnvironment` and `logOperatorEvent` (W2 stubs), stored-message assertions need W1 and W3 bodies. Waiting on lanes W1, W2 and W3.
- Closed by the gap lane (section below): WI-35 to WI-43, WI-52 to WI-55 and WI-57 are written. Review focus 4 is also covered at unit level (`whatsapp-media-download.test.ts`).
- Resolved at integration: `OperatorEvent.NotificationIgnoredField` is logged for a change with another field (WI-32).
- Statuses that fail to parse are dropped without a log (`parseStatusItems` returns only parsed items); a malformed change is dropped the same way.
- Resolved at integration: `HttpStatus` has `InternalServerError` and `ServiceUnavailable`; the route answers `HttpStatus.ServiceUnavailable` and `WEBHOOK_BATCH_UNINDEXED_STATUS` is gone.
- The `Content-Type` of the `GET` answer is set for the refusal too.
- Test plan AU-62 reads as a metadata `404`; implemented per A25 (download URL `404` re-requests metadata once).

## Lane W6 (proof)

### What changed

- `apps/api/test/integration/whatsapp-webhook.test.ts`: WI-33 (the Durable Object commit fails once: `500`, no receipt, the retry stores one message) and WI-34 (the R2 put fails on an image: `500`, nothing stored, the retry stores one image). WI-34 posts through `createApp(...).fetch` with `whatsappTestEnv`, because the integration bindings carry no access token and the Graph is replaced with a `fetch` spy that serves the metadata and the bytes.
- `apps/api/test/integration/whatsapp-outbound.test.ts`, new `send tools over the Cloud API sender` block (in W2's file because every case shares the one fake Graph on `4012`; a second file runs in parallel and its `reset` and queued answers collide): the MCP tools `send_message` and `react` through the real Durable Object, with the Cloud API sender built by `AccountInbox.createSender` against the fake Graph on `4012`. WI-58 (text, wamid mapped to the account), WI-59 (`131047` queues, one notice template, no second notice), WI-60 (`131009` on a reaction: the tool error names `reaction.message_id`, the reaction is `Failed`), WI-62 (`130429`: busy, `Failed`, one request), WI-66 (`500`: timeout text, `Failed`, one request).
- `apps/api/vitest.e2e-whatsapp.config.mts`, `apps/api/test/e2e/whatsapp-support/{constants,global-setup,webhook}.ts`, `apps/api/test/e2e/whatsapp-channel.e2e.test.ts` (new): R31. The setup starts the fake Graph on `4011` and its own `wrangler dev` with the four WhatsApp variables and `WHATSAPP_GRAPH_BASE_URL`. `apps/api/package.json` `test:e2e` runs the slice 1 config and then this one.
- `apps/api/test/e2e/whatsapp-bundle.e2e.test.ts` (new): the production dry-run bundle.

### How to run

```bash
pnpm --filter @zapbip/api exec vitest run --config vitest.integration.config.mts test/integration/whatsapp-webhook.test.ts test/integration/whatsapp-outbound.test.ts
pnpm --filter @zapbip/api exec vitest run --config vitest.e2e-whatsapp.config.mts
pnpm --filter @zapbip/api exec vitest run --config vitest.e2e.config.mts test/e2e/whatsapp-bundle.e2e.test.ts
```

Port `4011` must be free.

### Red today, green after

Every test of this lane is a pin: W3 and W4 are merged, so none was red on landing (`68d71d4`, `623d78e`, `e293138`). The drafts failed only on harness mistakes before they were committed:

| Draft | Failure printed | Cause |
|-------|-----------------|-------|
| WI-33, WI-34 | `expected [] to deeply equal [ 'Oi' ]`; `WHATSAPP_ACCESS_TOKEN is not set` | the history read registered the agent; the route bindings have no token |
| WI-58 | two `message_index` rows; an extra image request | opening the window sent the "agent is not listening" notice through the Cloud API sender; a separate test file shared the fake Graph in parallel |
| E2E-1 | `status: 'empty'` | an owner text routes only to an agent that wrote recently |

### Hypotheses to attack

1. Hypothesis: a Durable Object failure while committing returns `500` and leaves no receipt, so Meta's retry stores once. Break it by failing the commit after the receipt insert.
2. Hypothesis: an R2 failure returns `500` with no message stored. Break it with a failure on the second image of a batch.
3. Hypothesis: no Graph error is retried by the sender (`130429`, `500`). Count the fake's requests for the same message.
4. Hypothesis: production sends only through the Cloud API sender. Break it by adding `WHATSAPP_GRAPH_BASE_URL` or `WHATSAPP_MEDIA_DOWNLOAD_ORIGIN` with the fake address to the top-level block of `wrangler.jsonc`, or by importing `fake-whatsapp-sender` from `index.ts`.
5. Hypothesis: the E2E wamids are deterministic (`wamid.fake.<n>` counts the sends the fake answered). Break it by adding a send to an earlier E2E case.

### Known gaps

- Closed by the gap lane (section below): E2E-2 asserts the stored voice note and the dedupe is done.
- The WhatsApp E2E reuses slice 1's `stack.ts` helpers through the same `stack` provided key.

## Gap lane (developer, after W6)

Branch `feat/whatsapp-cloud-channel`. It merged `feat/whatsapp-cloud-channel-w6` (no conflicts) and `feat/agent-inbox-core` (`a041617`). Slice 1 moved the routing list into `owner-placement.ts` and `owner-arrival.ts` here, made `env.development` the local block and the top level production, gave `createFakeWhatsAppSender` the media store, and added `closed_at` to the repository test. `wrangler.jsonc` top level now holds production vars (`PUBLIC_ORIGIN`, `WHATSAPP_GRAPH_BASE_URL` `https://graph.facebook.com`); the development block holds the fake Graph address and the media origin. `whatsapp-bundle.e2e.test.ts` and the WhatsApp E2E setup follow the new names (no `--env production`; `--env development`).

### What changed

- `apps/api/test/integration/whatsapp-webhook.test.ts`: WI-35 to WI-43 (the Graph is a `fetch` spy that records every `https` call with its `Authorization`; WI-40 uses fake timers for `GRAPH_REQUEST_TIMEOUT_MS`; WI-36 reads the unavailable notice from the fake sender's screen, with an owner message timestamped now so the window is open).
- `apps/api/test/integration/whatsapp-status.test.ts`: WI-52 to WI-55 and WI-57 against an outbound message seeded with a channel id and a `message_index` row.
- `libs/core/src/inbox/use-cases/apply-status.ts`: `applied` is `false` for a failure that arrives after a settled state. Reason: the route logs `status.failed.ignored` from `applied: false`, and the log never fired.
- `apps/api/src/adapters/whatsapp/media-url-policy.ts` (new), used by `graph-client.ts` and `media-download.ts`; `read-whatsapp-env.ts` reads the optional `WHATSAPP_MEDIA_DOWNLOAD_ORIGIN` as `developmentMediaOrigin` (`null` when unset or empty); `createGraphClient` and `downloadInboundMedia` take it.
- `apps/api/test/e2e/support/stack-process.ts` (new): `freePort`, `waitForHealth`, `LOOPBACK_HOST`, `HEALTH_TIMEOUT_MS`, used by both global setups.
- `apps/api/test/e2e/whatsapp-channel.e2e.test.ts`: E2E-2 stored voice note (the fake Graph serves the bytes at `/media/voice`; the bytes are the JSON encoding of a string because the fake replies JSON), beside the refused-host case.

### How to run

```bash
pnpm --filter @zapbip/api exec vitest run --config vitest.integration.config.mts test/integration/whatsapp-webhook.test.ts test/integration/whatsapp-status.test.ts
pnpm --filter @zapbip/api exec vitest run --config vitest.unit.config.mts
ZAPBIP_E2E=1 pnpm --filter @zapbip/api exec vitest run --config vitest.e2e-whatsapp.config.mts
pnpm --filter @zapbip/core exec vitest run
```

### Red today, green after

| Test | Failure printed on the red commit | Red | Green |
|------|-----------------------------------|-----|-------|
| WI-54 and the core case "a failure that arrives after a settled state reports that it was not applied" | `expected '[]' to contain 'status.failed.ignored'`; `expected { applied: true } to deeply equal { applied: false }` | `f5b827b` | `619aafb` |
| `whatsapp-media-url-policy.test.ts`, the environment, graph-client and wrangler cases | `isAllowedMediaUrl is not implemented`; `expected null to be 'http://127.0.0.1:4011'`; `expected undefined to be 'https://graph.facebook.com'` | `8dc2e68` | `6a5e306` |

Pins (green on landing): WI-35 to WI-43 (`d93dc2f`), WI-52, WI-53, WI-55, WI-57 (`f5b827b`), E2E-2 stored (`6fe1818`). The graph-client and media-download unit cases for the development origin landed with `6a5e306` because their signature changed there.

### Hypotheses to attack

1. Hypothesis: production accepts a media URL only on `https` and a Meta suffix. Break it by setting `WHATSAPP_MEDIA_DOWNLOAD_ORIGIN` in the top-level vars and confirm `wrangler-config.test.ts` goes red; also try `http://127.0.0.1:4011@evil.com/x` with the variable set.
2. Hypothesis: no `Authorization` header reaches a foreign host. Break it by making the download redirect (`302`) and by setting the metadata URL to the lookalikes in WI-42 and WI-43.
3. Hypothesis: a failure after `read` is ignored and logged exactly once. Break it by posting `failed` twice.
4. Hypothesis: a media `5xx` or timeout returns `500`, and the retry after recovery stores once (WI-39, WI-40).

### Known gaps

- WI-35 asserts the stored object's size equals the bytes, not a recorded `Content-Length` header: the R2 binding is real in the pool and exposes no request header; `FixedLengthStream` in `r2-media-store.ts` is what fixes the length.
- The fake Graph replies JSON only, so E2E-2 serves a JSON string and the stored bytes include its quotes.
- Production's `WHATSAPP_GRAPH_BASE_URL` is now `https://graph.facebook.com`; the deploy slice owns the secrets and the final value.

## Fix batch (developer, after the review and the first test round)

### What changed

- `media-download.ts` maps `GraphRequestError` to a channel error before branching, so 131052 is unavailable and a server error or no response is retriable in production.
- `routes/whatsapp.ts` is `createWhatsappRoutes({ developmentMediaOrigin })`: a stale entry (older than `RECEIPT_RETENTION_MS`) answers `200` and logs `inbound.stale`; a committed message (`hasChannelReceipt` on the account object) answers `200` before any download and logs `inbound.duplicate`; a young status for a message the account has not saved answers `503`.
- `index.dev.ts` is the only reader of `WHATSAPP_MEDIA_DOWNLOAD_ORIGIN` (`dev/read-development-media-origin.ts`).
- Forwarded: parser, `ForwardedKind`, DO schema `v5` column `forwarded`, wire field `forwarded`, `verified: false` when forwarded.
- `graph-client.ts` keeps the abort armed until the body is consumed (`GRAPH_MEDIA_BODY_DEADLINE_MS` for downloads).
- `channel-error-mapping.ts` takes `isReactionSend`; 131009 on any other send is the unexpected-error kind.
- A reaction on a wamid nobody has is stored with `targetMessageId: null`.
- Docs: list questions are 1,024 characters; unavailable media is `media_id: null` with `media_status: "unavailable"`.

### Red today, green after

| Test | Red | Green |
|------|-----|-------|
| media download through the real Graph client (4 cases) | `23f714e`: rejects with `GraphRequestError` instead of `{ stored: false }` / `RetriableMediaError` | `b2bdb3e` |
| env and development origin (3) | `7dc5600`: `readDevelopmentMediaOrigin is not implemented`, `toEqual` on the old shape | `94c4caa` |
| parser forwarded, graph-client body deadline, unsupported without a type (10) | `455480a`: forwarded messages parse as rejected; stalled bodies time out at 5 s | `5e87016`, `fef0cd2` |
| forwarded storage and wire, stale, redelivery, receipt, status 503, schema v5 (14 integration, 5 core) | `41d8ddb` | the fix-batch implementation commit |
| 131009 kind, reaction target null, nosniff (3) | `382df1d` | the same commit |

Pins (green on landing, labelled `pin` in their titles or commits): WI-17, WI-44 to WI-49, the R2 batch cases, WI-29/30/31 assertions, the just-inside-retention entry, the signature variants, the 22 lookalike urls, W4 (`sha512=`), W5 (empty emoji), the development origin cases of `94c4caa`. Commits `3785271` and `7f0481f` mix pins with fixes; no history rewrite.

### Hypotheses to attack

1. A replay of a captured delivery after seven days never answers `500` and never rewrites a stored object.
2. A forwarded message never reaches an agent as `verified: true`.
3. The production bundle never contains `WHATSAPP_MEDIA_DOWNLOAD_ORIGIN`.
4. A stalled download body is aborted at the body deadline.

### Known gaps

- A forwarded `reaction` or `interactive` message carries the flag only when Meta sends `context.forwarded`; no fixture exists for those.
- The body deadline of a download is 2 minutes for up to 100 MB; a slower link than 6.7 MB/s on a large file is retried by Meta, not completed.
