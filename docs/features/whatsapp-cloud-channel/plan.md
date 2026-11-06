# WhatsApp Cloud channel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fake WhatsApp of `agent-inbox-core` with the Meta WhatsApp Cloud API adapter: a signed inbound webhook, outbound session and template sends for every kind, inbound media stored in R2, idempotent inbound handling, status updates, the channel-reported closed window, and the two owner notice templates.

**Architecture:** The core stays pure. Four additive core pieces (`closeWindow`, `openWindow`, `applyStatus`, `receiveChannelMessage`) and a `ChannelError` carry the channel facts. `apps/api/src/adapters/whatsapp/` holds the Graph client, the parsers, the builders and the error table. The Worker route verifies the signature, maps the number to an account in D1 and downloads media before any Durable Object call. `AccountInbox` commits the receipt and the message in one call, compensating the receipt when the commit throws.

**Tech Stack:** As `agent-inbox-core`, plus `zod` 4.6.7 (already pinned there) for webhook payloads. No new dependency.

**Spec:** `docs/features/whatsapp-cloud-channel/spec.md` (landed with the branch by the docs import). The spec's "Open questions → answers" table binds this plan. The decisions this plan adds on top of it are listed in **Assumptions** and must be copied into that table at Step W0.

## Global Constraints

- Every decision row of the spec's "Open questions → answers" table dated `owner delegated 2026-11-06` is binding. Where a row supersedes a spec route, name, or limit, the row wins.
- Node `>=24` (`.nvmrc`). pnpm stays at the root `packageManager` pin.
- No new dependency. `zod` 4.6.7 is reused from `agent-inbox-core`; `vitest` 5.0.5 and 4.1.12, `@cloudflare/vitest-pool-workers` 0.23.0 are reused as pinned there.
- Repo rules (`AGENTS.md`): no comments except `// NB ADR NNNN:` pointers; flat `if`s; no `else`; no `??` defaults; enums over string literals; named parameters for any function with more than one parameter; constants over literals; no `.js` extension on relative imports; no acronym in an identifier (wire field names keep Meta's spelling).
- Stub bodies written in Step W0 are exactly `void input;` followed by `throw new Error('<name> is not implemented');`.
- The red commit of every test-first step contains only the failing test (plus the stub it needs). The green commit contains only the implementation. The failure text the red run actually printed goes into `tester-briefing.md`.
- No `sleep` anywhere. Time in core tests comes from the fake `Clock`; in Worker tests from `runDurableObjectAlarm` and `runInDurableObject`.
- No real credential and no call to a third party in any test. Test secrets are the constants `test-app-secret`, `test-verify-token`, `test-access-token`, passed to `wrangler dev` as `--var` flags, never written to a file.
- Commits: Conventional Commits, en-US, `Co-Authored-By` trailer naming the model that wrote the commit. Never `git add -A`, `git add .`, `--no-verify`. Never commit on `main`.
- Each lane branches from the Step W0 commit and merges (never rebases) the lanes it depends on.
- Owner-facing copy: `pt_BR` and `en_US` only, from `whatsapp-copy.ts`. Agent-facing errors: English.

## Review Focus

1. A failure after the receipt and message are committed: the retry returns `duplicate: true` and stores nothing twice. Owned by W1 (`receive-channel-message.test.ts`) and W3 (`account-inbox-channel.test.ts`).
2. A batch where one entry is malformed, unknown or unmapped: the other entries are stored and the webhook returns `200`. Owned by W4 (`whatsapp-webhook.test.ts`, batch cases).
3. Concurrent flushes of the queue: each queued message is sent once, because it is claimed as `Sending` before any Graph await. Owned by W1 (`open-window.test.ts`).
4. A media download whose bytes do not match the webhook `sha256`, whose host is outside the allowlist, or that redirects: the object is deleted or never written, and no bearer token reaches a foreign host. Owned by W4 (`whatsapp-media-download.test.ts`).
5. A signed body with the same digest over re-serialised JSON, a multibyte body, or a chunked body over 3 MB: `401` or `413`, nothing parsed. Owned by W4 (`whatsapp-signature.test.ts`, `whatsapp-webhook.test.ts`).

## Plan refresh (W-1.1)

Diffed on 2026-11-06 against two trees: the Step 0 contract on this branch's base (`ce30912`, slice 1 stubs), and `origin/feat/agent-inbox-core-l4b`, the tip that already merges slice 1's lanes L2, L3 and L4a (bodies, migrations, `apps/api/test/**`). Lane bodies are not on this branch yet; where a fact comes from a lane body it is marked `lane`. Every row is `owner delegated 2026-11-06`.

| # | Plan said | Real code | Decision |
|---|---|---|---|
| R1 | `libs/core/src/{constants,errors,message,inbox-records,ports,window}.ts`, `use-cases/`, `testing/in-memory.ts` | `libs/core/src/inbox/...` (all of them); `libs/core/src/index.ts` re-exports `./inbox` | every core path moves under `libs/core/src/inbox/`; the barrel is `libs/core/src/inbox/index.ts` |
| R2 | `libs/core/src/enums.ts` holds `DeliveryState`, `MediaSourceKind`, `ChannelErrorKind` | the enums live in `libs/types/src/enums.ts` | the additions go to `libs/types/src/enums.ts`; `ChannelInboundKind` is a new enum there |
| R3 | `ONE_DAY_MS`, `BYTES_PER_KILOBYTE` in core constants; `TEXT_MAX_CHARS` | `SECOND_MS`..`DAY_MS`, `BYTES_PER_MEGABYTE` in `libs/types/src/constants.ts`; `WHATSAPP_TEXT_MAX_CHARS` in core; `RECEIPT_RETENTION_MS` already declared in core | `BYTES_PER_KILOBYTE` is added to `libs/types/src/constants.ts`; `RECEIPT_RETENTION_MS` is not an addition; every name is imported, none redeclared |
| R4 | `OwnerLocale` may be absent; W0 adds `owner-locale.ts` | `OwnerLocale` and `DEFAULT_LOCALE` exist in `libs/types/src/enums.ts` and `constants.ts` | no file added |
| R5 | `CoreDependencies.ownerLocale`; the RPC wrapper reads the locale before each send (A1) | `receiveOwnerMessage` and `deliverToOwner` take `ownerLocale` as an input field; `ConnectionIdentity.ownerLocale` carries it for agent calls | `ownerLocale` is an input field of `ReceiveChannelInput` and `OpenWindowInput`; `CoreDependencies` gains no field; no wrapper read |
| R6 | `ChannelError` is a new class with its own `kind` | `InboxError` carries `code: InboxErrorCode or ChannelErrorKind`; the Durable Object `outcome()` catches `InboxError` and returns `{ok: false, errorCode}` | `ChannelError extends InboxError`; its `code` is the kind; it adds `errorCode: number or null` (Meta's code). The tool error path needs no change |
| R7 | `recordChannelReceipt` is an adapter-private step; `pruneChannelReceipts` is new (A7) | `recordChannelReceipt` and `deleteExpiredReceipts` are public `InboxRepository` methods; `sweepExpired` already prunes receipts with `RECEIPT_RETENTION_MS`; `receiveOwnerMessage` records the receipt first | `pruneChannelReceipts` is dropped (`deleteExpiredReceipts` serves); `commitChannelInbound` is added beside `recordChannelReceipt`, which stays the simulator path of `receiveOwnerMessage`; `receiveOwnerMessage`'s order is not changed. `commitChannelInbound` also takes the answer and the stored media, so the receipt, message, answer, media record and window are one transaction |
| R8 | W1 changes `receiveOwnerMessage`'s order and handles unavailable media there | `receive-owner-message.ts` holds the routing placement, answer and wake helpers as module functions | W1 extracts the placement, answer and wake helpers into modules both use; `receiveChannelMessage` builds on them; slice 1's tests stay green |
| R9 | `flush` is new | `flush-queue.ts` (`flushQueue`, `isQueuedMessageExpired`) with `listQueued`; `deliverToOwner` catches every sender error as `DeliveryFailed` | W1 changes `flushQueue` (claim, per message, stop at `WindowClosed`) and `deliverToOwner` (reads `ChannelError`); `claimQueued` is a new use case file |
| R10 | `MessageSender.session({message, question, replyTo..., reactionTarget...})` | `session({message})`; the fake sender reads `questions` by SQL | the new fields are added to the port; slice 1 callers (`deliver-to-owner.ts`, `flush-queue.ts`) and `fake-whatsapp-sender.ts` are updated in the post-merge step W0b |
| R11 | `AccountDirectory` (`d1-account-directory.ts`) with `findByWaId`, `findOwnerByAccountId`; `MessageIndex` (`createD1MessageIndex`) with `record({channelMessageId...})`, `findAccountId` | `d1-owner-directory.ts` exports `findOwnerByPhone({database, phone})` returning `{accountId, ownerLocale}`; `D1MessageIndex` is a class with `record({id, accountId, at}): boolean` (INSERT OR IGNORE) and `find({id})` | reuse both; no new directory or index type. W3 adds `findOwnerByAccountId({database, accountId})` to `d1-owner-directory.ts` and validates the stored locale in both finders (an unknown value throws). Accounts-and-keys promotes them later |
| R12 | `d1-channel-restrictions.ts` as a factory | D1 adapters are classes (`D1MessageIndex`, `D1ConnectionDirectory`) | `D1ChannelRestrictions` is a class with `findActive` and `record` |
| R13 | `adapters/hash.ts` | `adapters/platform/hash.ts` (`hashConnectionSecret`) and `platform/encoding.ts` (`encodeHex`) | `sha256Hex` and `sha256Base64` are added to `adapters/platform/hash.ts` |
| R14 | `adapters/fake-whatsapp-sender.ts` | `adapters/fake/fake-whatsapp-sender.ts` (`createFakeWhatsAppSender`, type `FakeWhatsAppSender`) | path fixed |
| R15 | `registerDevelopmentSender`, `readDevelopmentSender`, `dev/development-sender.ts`, a call in `index.dev.ts` (A29) | `DevAccountInbox extends AccountInbox` is the development entry's class (`index.dev.ts` exports it as `AccountInbox`); production exports `AccountInbox`; the production bundle test greps for development markers | no registry. `AccountInbox` gets a protected `createSender()`: the production class builds the Cloud API sender (a missing variable throws naming it); `DevAccountInbox` overrides it to pick the Cloud API sender when `WHATSAPP_ACCESS_TOKEN` is set and the fake otherwise. `AccountInbox` stops importing the fake, so the production bundle carries no fake. Done in W3 after slice 1's lanes merge |
| R16 | AccountInbox constructor error `AccountInbox must be created with idFromName` (A17) | lane L3 throws `AccountInbox id has no name` from `initialize()` | A17 is slice 1's; the text is slice 1's; WI-17 asserts it |
| R17 | `mediaId` of the unavailable inbound media is `string or null` on `OwnerInboundContent` | `OwnerInboundContent` media variant has `mediaId: string`; `receiveOwnerMessage` and `dev-owner.ts` build on it | `OwnerInboundContent` stays; the channel entry carries `content: OwnerInboundContent or UnavailableOwnerMedia`, a new additive type `{kind: MediaMessageKind, voice, filename, caption}` |
| R18 | `window` table, `closed_at` | DO table `owner_window (id, last_owner_message_at, notice_sent_for_closed_window)`; messages are `inbox_messages (id, agent, direction, kind, payload JSON, reply_to, delivery, read_at, at)` | DO `v4` is `ALTER TABLE owner_window ADD COLUMN closed_at`, `ALTER TABLE inbox_messages ADD COLUMN` for the channel columns, and `CREATE UNIQUE INDEX` on `channel_message_id` (SQLite cannot add a UNIQUE column). Registered in `src/account-inbox/migrations/index.ts` with `v4.sql`. The runner records the set of applied versions (`run-migrations.ts`, lane) so merge order is free |
| R19 | `MEDIA_ID_PREFIX`; the media is put in the bucket directly; the sender builds the link from `signedLink` | `IdPrefix.Media = 'med'`; `createIdGenerator` formats `prefix_value`; `MediaStore.put({accountId, mediaId, body, sizeBytes, mimeType})` already wraps `FixedLengthStream` and writes `accounts/<accountId>/media/<mediaId>`; `signedLink` returns the query `exp=...&sig=...` | the media id is `med_` plus the SHA-256 hex of the `wamid`; `MEDIA_ID_PREFIX` is dropped; `downloadInboundMedia` takes a `MediaStore`, tees the body to a `DigestStream` and to `put`, and deletes through `MediaStore.delete` on a mismatch; the sender links with `${publicOrigin}/m/${accountId}/${mediaId}?${query}` |
| R20 | `ERROR_STATUS`, the MCP wire mapper and the screen read are not mentioned | `routes/http-status.ts` holds `ERROR_STATUS: Record<InboxErrorCode or ChannelErrorKind, HttpStatus>` (lane L4b); `mcp/wire.ts` serialises `MediaSource` (lane L4a) | W0b extends `ERROR_STATUS` for the new kinds; W3 teaches `wire.ts` the `Unavailable` source (`media: null`, `media_status: "unavailable"`) |
| R21 | tests under `apps/api/test/{unit,integration,e2e,support}`; `seedAccountLocale`; `applyDirectoryMigration` | those directories exist (lane L3, L4a, L4b); `seed.ts` has `seedAccount`, `seedOwnerIdentity({accountId, phone, ownerLocale})`, `seedConnection`, `applyDirectoryMigration` (runs `0001_core.sql` only); `route-fixtures.ts` has its own `seedAccount({agent})` | no `seedAccountLocale` (the locale is a column of `owner_identities`); W3 extends `applyDirectoryMigration` to run `0004`; the `phone` parameter is the `wa_id` |
| R22 | one `logOperatorEvent` | `logEvent(LogFields)` writes `console.log` with a fixed field set; the operator alert needs error level and Meta's numeric code | `operator-log.ts` stays, with its own enums; it is the one place that logs at error level; it shares no code with `logEvent` on purpose |
| R23 | the template texts duplicate nothing | core `INBOX_COPY` already holds `NoticeBody`, `QuestionNoticeBody` and `NoticeQuickReply` texts, rendered by the fake sender | the texts in `whatsapp-templates.ts` are the Meta-registered artifacts and win; the core copy remains the simulator's rendering. Aligning them is a later decision |
| R24 | `OperatorLogField` and `OperatorLogReason` are used but never declared | | W0 declares both in `whatsapp-enums.ts` |
| R25 | an inbound reply or reaction target is a core message id | the parser only knows channel ids (`context.id`) | `receiveChannelMessage` resolves reply and reaction targets with `findMessageByChannelMessageId`; an unknown reply target becomes `null`; an unknown reaction target keeps the channel id string as the reaction's `targetMessageId` and routing sees no referenced message. Test CU-44 |
| R26 | `ReceiveChannelResult` | `ReceiveResult {messageId, agent, duplicate}` exists | reuse `ReceiveResult`; `ReceiveChannelResult` is dropped |
| R27 | `OpenWindowInput {dependencies, at}` | a closed window met during a flush needs one notice, which needs the locale | `OpenWindowInput` is `{dependencies, ownerLocale, at}` |
| R28 | `createApp({includeSimulator})` mounts the route | lane L4b changes it to `createApp({extraRoutes})` | the webhook route is mounted unconditionally in `createApp` with one added line; the merge with L4b's signature change is trivial |
| R29 | `DigestStream`, `timingSafeEqual` and `FixedLengthStream` need confirming | `@cloudflare/workers-types` declares `DigestStream` and `timingSafeEqual`; `r2-media-store.ts` (lane) uses `FixedLengthStream` on `compatibility_date` `2026-08-15` | A16 and A24 confirmed |
| R30 | Fake Graph is `fetchMock` in the integration pool | `@cloudflare/vitest-pool-workers` 0.23.0 no longer exports `fetchMock` (grep of its `dist` and `types` finds none) | the fake Graph is a real HTTP server (see the `fake-graph.ts` block); the integration binding points at it; no `fetchMock` anywhere |
| R31 | W6 setup decision: slice 1's `vitest.e2e.config.mts` runs `test/e2e/global-setup.ts` (ephemeral port, seeded phone, `wrangler dev` without WhatsApp variables) for every `*.e2e.test.ts` | the channel E2E needs the fake Graph on 4011 and `wrangler dev` started with the `--var` secrets | W6 adds `vitest.e2e-whatsapp.config.mts` (include `test/e2e/whatsapp-channel.e2e.test.ts`, `globalSetup` `test/e2e/whatsapp-support/global-setup.ts`, which starts the fake Graph and its own `wrangler dev`) and the `test:e2e` script runs both configs one after the other. Slice 1's config only gains an `exclude` of that one file (done in W0b); `whatsapp-bundle.e2e.test.ts` needs no stack and stays under slice 1's config |

## Assumptions (decided, owner can override)

The W-1.1 refresh above resolved every `(contract: confirm at build)` mark; a struck assumption is followed by its replacement.

- ~~**A1 Owner recipient and locale.** The adapter resolves `wa_id` by `AccountDirectory.findOwnerByAccountId({accountId})` (D1). The owner locale is the account's `OwnerLocale` (set by accounts-and-keys at account creation; this slice reads it, never owns it). The Durable Object's RPC wrapper reads it before each call that may send and passes it in `CoreDependencies.ownerLocale`; core passes it to `MessageSender.template({kind, parameters, locale})`. `(contract: confirm at build)`.~~ (refresh: R5, R11)
- **A1 Owner recipient and locale.** The adapter resolves `wa_id` with `findOwnerByAccountId({database, accountId})` in `d1-owner-directory.ts` (D1, `owner_identities`, one row per account). The owner locale is an `ownerLocale` input field of the use cases, as slice 1 already does; agent calls get it from `ConnectionIdentity.ownerLocale`, webhook calls from the directory row. `CoreDependencies` gains no field.
- **A2 Reply and reaction targets.** The core resolves `replyToChannelMessageId` and `reactionTargetChannelMessageId` (`InboxRepository.findChannelMessageId`) and passes them to `session`. The sender never reads the repository. A reaction whose target has no channel id is refused by the core with an error naming `reaction.message_id`.
- **A3 Channel-closed window.** `OwnerWindow.closedAt` is set by `closeWindow({at})` and cleared by `openWindow`. A send at or after `closedAt` sees a closed window. The arithmetic is unchanged. `openWindow({at})` stores `max(lastOwnerMessageAt, at)`, so an out-of-order timestamp never moves the window back.
- **A4 Quick-reply tap and unsupported kinds.** A `button` inbound runs `openWindow` and stores no message. An `unsupported` inbound runs `openWindow` and sends one session text with the copy `unsupportedKind` in the owner's locale.
- **A5 Media unavailable.** `MediaSourceKind.Unavailable` is added. Inbound media content carries `mediaId: string | null`; `null` means the bytes could not be stored. The agent sees `media: null` and `media_status: "unavailable"`.
- ~~**A6 Media ids and keys.** The inbound `mediaId` is `med_` plus the SHA-256 hex of the `wamid`, so a retry writes the same key. The R2 key is `accounts/<accountId>/media/<mediaId>` (ratified). The signed link is `/m/<accountId>/<mediaId>?exp=&sig=`, whose HMAC covers purpose, account id, media id and expiry. `(contract: confirm at build)` against slice 1's media route and `MEDIA_LINK_SIGNING_KEY`.~~ (refresh: R19)
- **A6 Media ids and keys.** The inbound `mediaId` is `med_` plus the SHA-256 hex of the `wamid`, so a retry writes the same key. The R2 key is `accounts/<accountId>/media/<mediaId>` (slice 1's `r2-media-store.ts`). The signed link is `${PUBLIC_ORIGIN}/m/<accountId>/<mediaId>?<query>`, where `<query>` is what `MediaStore.signedLink` returns; the HMAC covers purpose, account id, media id and expiry.
- ~~**A7 Atomic commit.** The Durable Object runs one `transactionSync` that inserts the `channel_receipts` row (insert-or-ignore, through the SQLite adapter's `recordChannelReceipt`), inserts the message, and saves the window. `commitChannelInbound` returns `false` when the receipt already exists, and then nothing is written. Flush, answer, waiters and wake run after the commit and never delete the receipt. A throw before the commit rolls back, so no receipt remains and the retry stores once. A throw after the commit leaves the message stored, and the retry returns `duplicate: true`. This replaces the compensation rule of the first plan; ADR 0013 is amended to match. Slice 1's `receiveOwnerMessage` order changes accordingly: window and flush move after the commit. `(contract: confirm at build)`.~~ (refresh: R7, R8)
- **A7 Atomic commit.** The Durable Object runs one `transactionSync` that inserts the `channel_receipts` row (insert-or-ignore), the message, the answer to a question, the media record and the window. `commitChannelInbound` returns `false` when the receipt already exists, and then nothing is written. Flush, waiters and wake run after the commit and never delete the receipt. A throw before the commit rolls back, so no receipt remains and the retry stores once. A throw after the commit leaves the message stored, and the retry returns `duplicate: true`. Slice 1's `receiveOwnerMessage` keeps its receipt-first order for the simulator. ADR 0013 is amended to match.
- **A8 Restriction switch with TTL.** A send that returns `131048` or `368` writes a row to D1 `channel_restrictions` and logs the operator alert `channel.restricted` at error level. A row blocks sends for `RESTRICTION_TTL_MS` (24 h); after that the row is ignored. An operator clears it earlier by deleting the row (runbook: `deploy-readiness`).
- **A9 Template parameters and buttons.** `zapbip_agent_notice` and `zapbip_agent_question` are sent with a `body` component only. The quick reply has fixed text.
- **A10 Unknown error codes.** `133010` maps to `Restricted`. `131021` maps to `DeliveryFailed`. `190` and HTTP `401` map to `Auth`. Any other error on a template send maps to `TemplateRejected`; any other error maps to `Unknown`. One table in `channel-error-mapping.ts`, asserted row by row.
- **A11 Media checks on links.** MIME and size are checked only when known. An unknown size is not refused; Meta enforces its limit and the error maps to `MediaRejected` (`131053`).
- **A12 Outbound sticker.** `OUTBOUND_STICKER_MAX_BYTES` = 100 KB, from `BYTES_PER_KILOBYTE` = 1 000 in `libs/types` constants. Core `STICKER_MAX_BYTES` is unchanged. Animated stickers are not detected.
- **A13 Playback status.** `played` is logged as `status.ignored` and changes nothing.
- **A14 Media hosts.** The metadata `url` is parsed with `new URL`. Only `protocol === 'https:'` and a `hostname` equal to, or ending with `.` plus, an entry of `WHATSAPP_MEDIA_HOST_SUFFIXES` (`fbcdn.net`, `fbsbx.com`, `whatsapp.net`) is fetched. Userinfo and path tricks (`lookaside.fbsbx.com@evil.com`, `evil.com/.fbsbx.com`) fail because the hostname is `evil.com`. Downloads use `redirect: 'manual'`; any 3xx is a failed download. ~~`(contract: confirm at build)`~~ the suffix list stays; owner-run probe OR-5 checks it on a real media.
- **A15 Media hash encoding.** The webhook `sha256` and the Graph `sha256` are compared as base64 SHA-256 of the bytes. ~~`(contract: confirm at build)`~~ the encoding stays base64; owner-run probe OR-5 checks it on a real media.
- **A16 Signature and token comparison.** The HMAC is checked with `crypto.subtle.verify` over the raw bytes, multibyte bodies included. The verify token is compared through digests with `crypto.subtle.timingSafeEqual`. ~~`(contract: confirm at build)`~~ resolved: `@cloudflare/workers-types` declares `timingSafeEqual` and `DigestStream` (R29).
- ~~**A17 Durable Object account identity.** `AccountInbox` reads its account from `ctx.id.name`; a missing name throws.~~ (refresh: R16)
- **A17 Durable Object account identity.** `AccountInbox` reads its account from `ctx.id.name`; slice 1's `initialize()` already throws `AccountInbox id has no name` when it is missing. This slice adds nothing.
- **A18 Logs.** `logOperatorEvent({event, fields})` takes fields keyed by the enum `OperatorLogField` (`ErrorCode`, `TemplateName`, `LanguageCode`, `Reason`, `MessageKind`, `UnsupportedType`, `ChannelMessageId`). Never a phone number, a message body or a token.
- **A19 Base URL.** `WHATSAPP_GRAPH_BASE_URL` is a top-level (development) var with `http://127.0.0.1:4011`. `deploy-readiness` adds `env.staging` and `env.production` with the Graph host. A missing value throws. ~~`(contract: confirm at build)`~~ resolved: the base `wrangler.jsonc` has a top-level `vars` block and a fully repeated `env.production`.
- ~~**A20 Schema.** This slice ships D1 migration `0004_whatsapp_channel.sql` (`channel_restrictions (phone_number_id PRIMARY KEY, error_code, restricted_at)`) and DO schema `v4`: `inbox_messages.channel_message_id` (UNIQUE, nullable), `error_code`, `error_title`, `pricing_category`, `billable`, `claimed_at`; `window.closed_at`. It reuses `0001_core`'s `owner_identities` and `message_index (wamid, account_id, created_at)` unchanged, and DO `v1`'s `channel_receipts`. Nothing in `0001` or `v1` is edited. `(contract: confirm at build)`.~~ (refresh: R18)
- **A20 Schema.** This slice ships D1 migration `0004_whatsapp_channel.sql` (`channel_restrictions (phone_number_id PRIMARY KEY, error_code, restricted_at)`) and DO schema `v4` (`src/account-inbox/migrations/v4.sql`, registered in `migrations/index.ts`): `ALTER TABLE inbox_messages ADD COLUMN` for `channel_message_id`, `error_code`, `error_title`, `pricing_category`, `billable`, `claimed_at`; `CREATE UNIQUE INDEX` on `channel_message_id`; `ALTER TABLE owner_window ADD COLUMN closed_at`. It reuses `0001_core`'s `owner_identities` and `message_index (wamid, account_id, created_at)` unchanged, and DO `v1`'s `channel_receipts`. Nothing in `0001` or `v1` is edited.
- **A21 Core contract additions.** Listed in the section **Core contract additions**. The orchestrator merges them into `core-contract-additions.md`.
- **A22 Flush claims.** Queued messages are claimed in one transaction: `claimQueuedMessages` sets `DeliveryState.Sending` and `claimed_at` before any Graph await. A success sets `Sent`. A `WindowClosed` returns the claimed message and the rest to `Queued` and stops. Any other error sets `Failed` and the flush continues. The alarm sweep returns `Sending` rows claimed more than `SENDING_STALE_MS` (60 s) ago to `Queued`. ~~`(contract: confirm at build)`~~ resolved: `flush-queue.ts` and `listQueued` exist; `claimQueuedMessages` is new (R9).
- **A23 Flush per message.** Errors are caught per message. The flush stops at the first `WindowClosed` and leaves the rest `Queued`; one notice is sent for the closed window.
- ~~**A24 Media streaming.** The download body streams through `crypto.DigestStream` into `R2.put` wrapped in `FixedLengthStream(declaredSize)`. After the put, the digest is compared with the webhook `sha256`; a mismatch deletes the object and yields Unavailable. A body longer than the declared size errors the stream and yields Unavailable. `(contract: confirm at build)` that the Workers runtime exposes `crypto.DigestStream` and `FixedLengthStream` on the pinned `compatibility_date`.~~ (refresh: R19, R29)
- **A24 Media streaming.** The download body is `tee()`d: one branch streams through `crypto.DigestStream`, the other into `MediaStore.put({accountId, mediaId, body, sizeBytes, mimeType})`, which already wraps the stream in `FixedLengthStream(sizeBytes)`. After the put, the digest is compared with the webhook `sha256`; a mismatch calls `MediaStore.delete` and yields Unavailable. A body longer than the declared size errors the stream and yields Unavailable.
- **A25 Media refresh and failures.** A `404` on the download URL re-requests `GET /{media-id}` once; a second `404` yields Unavailable. `131052` yields Unavailable. A `5xx` or a timeout on any media request returns `500` for the webhook. No receipt exists for that message yet, so Meta's retry is safe.
- **A26 Parse per change and per message.** The notification is parsed per `entry[].changes[]`. Each change is checked for its own `metadata.phone_number_id`: foreign changes are logged and skipped. A change whose `field` is neither `messages` nor `statuses` is logged (`notification.ignored_field`) and skipped. Each message is parsed on its own: an unknown `type` becomes `Unsupported` with that type; a missing or invalid `from` is logged as `inbound.unmapped` with no phone number and skipped. A bad entry never fails the batch. Only a body that is not JSON, or has no `entry` array, returns `400`.
- **A27 Unindexed status.** A status for an unknown `wamid` returns `503` while its `timestamp` is less than `UNINDEXED_STATUS_RETRY_WINDOW_MS` (10 min) old, so Meta retries. After that it logs `status.unindexed` and returns `200`.
- **A28 Status detail merge.** `saveChannelStatusDetail` writes only non-null values: `errorCode`, `errorTitle` (the first error's `title`), `pricingCategory`, `billable`. A null never overwrites a stored value.
- ~~**A29 Development sender selection.** `index.dev.ts` calls `registerDevelopmentSender(factory)` at module load. `AccountInbox` uses the Cloud API sender when `WHATSAPP_ACCESS_TOKEN` is set, else the registered fake. `index.ts` never registers, so production with no WhatsApp variables throws instead of falling back. The fake is absent from the production bundle. `(contract: confirm at build)`.~~ (refresh: R15)
- **A29 Sender selection.** `AccountInbox` has a protected `createSender()`. The production class builds the Cloud API sender, so a missing WhatsApp variable throws naming it. `DevAccountInbox` overrides it: the Cloud API sender when `WHATSAPP_ACCESS_TOKEN` is set, else the fake. `AccountInbox` no longer imports the fake, so the production bundle carries none.
- **A30 Shared time constants.** `SECOND_MS`, `MINUTE_MS`, `HOUR_MS`, `DAY_MS` come from `libs/types` (slice 1). No local copies; no `ONE_*` name remains in this plan. ~~`(contract: confirm at build)`~~ resolved: they exist in `libs/types/src/constants.ts`.
- **A31 Failure after commit.** A flush or wake failure after the commit leaves the new message stored and the queue as it was; the queue is flushed by the next owner message or by the alarm. Meta gets its `200`, so it does not retry.
- **A32 Restriction before template.** A restricted account refuses sends before the template is built; the refusal is `Restricted`, not `TemplateRejected`.

## Contract (Step W0, verbatim)

Step W0 lands these files first, on the feature branch, in one commit. Every lane builds against them. Changing a signature after W0 means a new W0 commit that every lane merges. Paths and names were refreshed at W-1.1 (table above); a name slice 1 already owns is imported, never redeclared. Files that exist only on slice 1's lane branches (in-memory ports, the SQLite repository body, the fake sender body, `apps/api/test/support/*`, `http-status.ts`, `wire.ts`) are updated in step W0b, after the lead merges those lanes into `feat/agent-inbox-core`.

### `libs/types/src/enums.ts` (additive) and `libs/types/src/constants.ts` (additive)

`OwnerLocale`, `DEFAULT_LOCALE`, `IdPrefix.Media`, `SECOND_MS`..`DAY_MS` and `BYTES_PER_MEGABYTE` already exist. Added members, the existing ones stay:

```ts
export enum DeliveryState {
  Delivered = 'delivered',
  Read = 'read',
  Sending = 'sending',
}

export enum MediaSourceKind {
  Unavailable = 'unavailable',
}

export enum ChannelErrorKind {
  WindowClosed = 'window_closed',
  RateLimited = 'rate_limited',
  Restricted = 'restricted',
  ReactionRejected = 'reaction_rejected',
  MediaRejected = 'media_rejected',
  TemplateRejected = 'template_rejected',
  Timeout = 'timeout',
  Auth = 'auth',
  Unknown = 'unknown',
}

export enum ChannelInboundKind {
  Owner = 'owner',
  WindowOnly = 'window_only',
  Unsupported = 'unsupported',
}
```

```ts
export const BYTES_PER_KILOBYTE = 1_000;
```

### `libs/core/src/inbox/errors.ts` (addition)

```ts
export class ChannelError extends InboxError {
  readonly errorCode: number | null;

  constructor(input: { kind: ChannelErrorKind; message: string; errorCode: number | null }) {
    super({ code: input.kind, message: input.message });
    this.errorCode = input.errorCode;
  }
}
```

`message` is the English text an agent reads (the tool error); `code` is the kind the core stores. `code` stays typed `InboxErrorCode | ChannelErrorKind`; a use case reads `errorCode` after `error instanceof ChannelError`.

### `libs/core/src/inbox/message.ts` (change)

```ts
export type MediaSource =
  | { kind: MediaSourceKind.Link; link: string }
  | { kind: MediaSourceKind.Stored; mediaId: string }
  | { kind: MediaSourceKind.Unavailable };
```

### `libs/core/src/inbox/inbox-records.ts` (changes)

```ts
export type OwnerWindow = {
  lastOwnerMessageAt: number | null;
  noticeSentForClosedWindow: boolean;
  closedAt: number | null;
};

export type ChannelStatusDetail = {
  errorCode: number | null;
  errorTitle: string | null;
  pricingCategory: string | null;
  billable: boolean | null;
};
```

### `libs/core/src/inbox/ports.ts` (changes)

```ts
export interface InboxRepository {
  // every slice 1 method, unchanged (recordChannelReceipt and deleteExpiredReceipts included), plus:
  commitChannelInbound(input: {
    channelMessageId: string;
    receivedAt: number;
    message: Message | null;
    answer: { questionId: string; answer: QuestionAnswer } | null;
    media: StoredMedia | null;
    window: OwnerWindow;
  }): Promise<boolean>;
  saveChannelMessageId(input: { messageId: string; channelMessageId: string }): Promise<void>;
  findMessageByChannelMessageId(input: { channelMessageId: string }): Promise<Message | null>;
  findChannelMessageId(input: { messageId: string }): Promise<string | null>;
  saveChannelStatusDetail(input: { messageId: string; detail: ChannelStatusDetail }): Promise<void>;
  claimQueuedMessages(input: { claimedAt: number; limit: number }): Promise<Message[]>;
  releaseStaleClaims(input: { claimedBefore: number }): Promise<void>;
}

export interface MessageSender {
  session(input: {
    message: Message;
    question: Question | null;
    replyToChannelMessageId: string | null;
    reactionTargetChannelMessageId: string | null;
  }): Promise<{ channelMessageId: string }>;
  template(input: { kind: TemplateKind; locale: OwnerLocale; parameters: string[] }): Promise<{ channelMessageId: string }>;
}
```

`CoreDependencies` is unchanged (R5). `commitChannelInbound` is the one write path for an inbound channel message. The SQLite adapter runs it in one `transactionSync`: the receipt (insert-or-ignore on `channel_receipts`), the message insert, the question answer, the media record and the window save. It returns `false` and writes nothing when the receipt exists. `message` is `null` for a window-only entry. `claimQueuedMessages` sets `Sending` and `claimed_at` in one transaction. `saveChannelMessageId` ignores a second write for the same message. `template` keeps slice 1's signature. Expired receipts are pruned by slice 1's `deleteExpiredReceipts`.

### `libs/core/src/inbox/use-cases/types.ts` (additions)

```ts
export type UnavailableOwnerMedia = {
  kind: MediaMessageKind;
  voice: boolean;
  filename: string | null;
  caption: string | null;
};

export type ChannelInboundEntry =
  | {
      kind: ChannelInboundKind.Owner;
      at: number;
      content: OwnerInboundContent | UnavailableOwnerMedia;
      replyToChannelMessageId: string | null;
      noticeText: string | null;
    }
  | { kind: ChannelInboundKind.WindowOnly; at: number }
  | { kind: ChannelInboundKind.Unsupported; at: number; noticeText: string };

export type ReceiveChannelInput = {
  dependencies: CoreDependencies;
  ownerLocale: OwnerLocale;
  channelMessageId: string;
  entry: ChannelInboundEntry;
};

export type OpenWindowInput = { dependencies: CoreDependencies; ownerLocale: OwnerLocale; at: number };
export type CloseWindowInput = { dependencies: CoreDependencies; at: number };

export type ApplyStatusInput = {
  dependencies: CoreDependencies;
  channelMessageId: string;
  status: DeliveryState.Sent | DeliveryState.Delivered | DeliveryState.Read | DeliveryState.Failed;
  detail: ChannelStatusDetail;
};
export type ApplyStatusResult = { applied: boolean };
```

`OwnerInboundContent` is unchanged (R17). `receiveChannelMessage` returns slice 1's `ReceiveResult` (R26). `noticeText` is sent once as a session text (a media entry that could not be stored, or an unsupported kind). An inbound reaction's `targetMessageId`, and the entry's `replyToChannelMessageId`, are channel ids that the use case resolves (R25).

### Use-case signatures (one file each under `libs/core/src/inbox/use-cases/`)

```ts
export function receiveChannelMessage(input: ReceiveChannelInput): Promise<ReceiveResult>;           // receive-channel-message.ts
export function openWindow(input: OpenWindowInput): Promise<void>;                                  // open-window.ts
export function closeWindow(input: CloseWindowInput): Promise<void>;                                // close-window.ts
export function applyStatus(input: ApplyStatusInput): Promise<ApplyStatusResult>;                  // apply-status.ts
export function applyStatusRule(input: { current: DeliveryState; incoming: ApplyStatusInput['status'] }): { next: DeliveryState | null; logged: boolean }; // status-rule.ts (pure)
export function mergeChannelStatusDetail(input: { stored: ChannelStatusDetail; incoming: ChannelStatusDetail }): ChannelStatusDetail; // status-rule.ts (pure)
export function claimQueued(input: { dependencies: CoreDependencies }): Promise<Message[]>;         // claim-queued.ts
```

`libs/core/src/inbox/index.ts` re-exports every new module.

### `apps/api/src/contract/env.ts` (change)

Slice 1's names stay: `ACCOUNT_INBOX`, `CONNECTIONS`, `MEDIA`, `MEDIA_LINK_SIGNING_KEY`, `UPLOAD_LINK_SIGNING_KEY`, `PUBLIC_ORIGIN`. This slice adds:

```ts
export type Bindings = {
  // slice 1 bindings, unchanged, plus:
  META_APP_SECRET?: string;
  WHATSAPP_VERIFY_TOKEN?: string;
  WHATSAPP_ACCESS_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_GRAPH_BASE_URL?: string;
};
```

The five variables are optional in the type so the development entry can run with the fake sender (R15). `readWhatsAppEnvironment` makes them required when the Cloud API sender is built.

### `apps/api/src/contract/account-inbox-rpc.ts` (additions to the interface)

```ts
receiveChannelMessage(input: AgentRequest<ReceiveChannelInput>): Promise<CallOutcome<ReceiveResult>>;
applyChannelStatus(input: AgentRequest<ApplyStatusInput>): Promise<CallOutcome<ApplyStatusResult>>;
```

`AccountInbox` implements both as stubs in W0.

### `apps/api/src/contract/constants.ts` (addition)

```ts
export const WHATSAPP_WEBHOOK_PATH = '/webhooks/whatsapp';
```

### `apps/api/src/adapters/whatsapp/whatsapp-constants.ts`

```ts
import { NOTICE_PREVIEW_MAX_CHARS } from '@zapbip/core';
import { BYTES_PER_KILOBYTE, BYTES_PER_MEGABYTE, HOUR_MS, MINUTE_MS, SECOND_MS } from '@zapbip/types';

export const GRAPH_API_VERSION = 'v24.0';
export const GRAPH_REQUEST_TIMEOUT_MS = 10 * SECOND_MS;
export const WEBHOOK_MAX_BYTES = 3 * BYTES_PER_MEGABYTE;
export const MEDIA_DOWNLOAD_ATTEMPTS = 2;
export const MEDIA_MAX_BYTES_INBOUND = 100 * BYTES_PER_MEGABYTE;
export const OUTBOUND_STICKER_MAX_BYTES = 100 * BYTES_PER_KILOBYTE;
export const WHATSAPP_MEDIA_HOST_SUFFIXES = ['fbcdn.net', 'fbsbx.com', 'whatsapp.net'] as const;
export const WEBHOOK_SIGNATURE_PREFIX = 'sha256=';
export const WEBHOOK_SIGNATURE_HEADER = 'X-Hub-Signature-256';
export const UNINDEXED_STATUS_RETRY_WINDOW_MS = 10 * MINUTE_MS;
export const RESTRICTION_TTL_MS = 24 * HOUR_MS;
export const SENDING_STALE_MS = 60 * SECOND_MS;
export const FLUSH_CLAIM_LIMIT = 20;
export const OUTBOUND_BUTTON_BODY_MAX_CHARS = 1_024;
export const OUTBOUND_LIST_BUTTON_LABEL_MAX_CHARS = 20;
export const OUTBOUND_LIST_HEADER_MAX_CHARS = 60;
export const OUTBOUND_LIST_FOOTER_MAX_CHARS = 60;
export const OUTBOUND_LIST_SECTION_TITLE_MAX_CHARS = 24;
export const OUTBOUND_LIST_ROW_ID_MAX_CHARS = 200;
export const OUTBOUND_LIST_ROW_DESCRIPTION_MAX_CHARS = 72;
export const OUTBOUND_BUTTON_ID_MAX_CHARS = 256;
export const OUTBOUND_LIST_MAX_ROWS = 10;
export const OUTBOUND_BUTTON_MAX_REPLIES = 3;
export const GRAPH_UNAUTHORIZED_STATUS = 401;
export const GRAPH_SERVER_ERROR_STATUS = 500;
export const TEMPLATE_PREVIEW_MAX_CHARS = NOTICE_PREVIEW_MAX_CHARS;
export const WEBHOOK_BATCH_UNINDEXED_STATUS = 503;
```

Constants that core already declares (`WHATSAPP_TEXT_MAX_CHARS`, `BUTTON_TITLE_MAX_CHARS`, `LIST_ROW_TITLE_MAX_CHARS`, `NOTICE_PREVIEW_MAX_CHARS`, `BUTTON_MAX_OPTIONS`, `QUESTION_MAX_OPTIONS`, `MEDIA_LINK_TTL_MS`) are imported, never redeclared. `TEMPLATE_PREVIEW_MAX_CHARS` is an alias only for readability of the sanitiser.

### `apps/api/src/adapters/whatsapp/whatsapp-enums.ts`

```ts
export enum WebhookHubMode {
  Subscribe = 'subscribe',
}

export enum WhatsAppMessageType {
  Text = 'text',
  Image = 'image',
  Video = 'video',
  Audio = 'audio',
  Document = 'document',
  Sticker = 'sticker',
  Location = 'location',
  Contacts = 'contacts',
  Reaction = 'reaction',
  Interactive = 'interactive',
  Button = 'button',
  Unsupported = 'unsupported',
}

export enum WhatsAppInteractiveType {
  ButtonReply = 'button_reply',
  ListReply = 'list_reply',
}

export enum WhatsAppStatusValue {
  Sent = 'sent',
  Delivered = 'delivered',
  Read = 'read',
  Played = 'played',
  Failed = 'failed',
}

export enum WhatsAppErrorCode {
  WindowClosed = 131047,
  ReactionTargetInvalid = 131009,
  DeliveryFailed = 131026,
  MediaUploadNotAccepted = 131053,
  UnsupportedType = 131051,
  InboundMediaTooLarge = 131052,
  RateLimitedThroughput = 130429,
  RateLimitedTier = 80007,
  RateLimitedApp = 4,
  RateLimitedUser = 131056,
  NumberRestricted = 131048,
  AccountDisabled = 368,
  RecipientIsSender = 131021,
  PhoneNumberNotRegistered = 133010,
  AuthOAuth = 190,
}

export enum WhatsAppTemplateName {
  AgentNotice = 'zapbip_agent_notice',
  AgentQuestion = 'zapbip_agent_question',
}

export enum WhatsAppLanguageCode {
  PortugueseBrazil = 'pt_BR',
  EnglishUs = 'en_US',
}

export enum OperatorEvent {
  InboundForeignNumber = 'inbound.foreign_number',
  InboundUnmapped = 'inbound.unmapped',
  InboundUnsupported = 'inbound.unsupported',
  InboundMediaUnavailable = 'inbound.media_unavailable',
  StatusUnindexed = 'status.unindexed',
  StatusIgnored = 'status.ignored',
  StatusFailedIgnored = 'status.failed.ignored',
  ChannelRestricted = 'channel.restricted',
  ChannelTemplateRejected = 'channel.template_rejected',
  ChannelAuth = 'channel.auth',
  ChannelTimeout = 'channel.timeout',
}

export enum OperatorLogField {
  ErrorCode = 'error_code',
  TemplateName = 'template_name',
  LanguageCode = 'language_code',
  Reason = 'reason',
  MessageKind = 'message_kind',
  UnsupportedType = 'unsupported_type',
  ChannelMessageId = 'channel_message_id',
}

export enum OperatorLogReason {
  MissingSender = 'missing_sender',
  InvalidSender = 'invalid_sender',
  MalformedEntry = 'malformed_entry',
}
```

`WhatsAppErrorCode` is the Meta error table of the spec, one member per code the adapter reads. A code not in it is `Unknown` (A10).

### `apps/api/src/adapters/whatsapp/whatsapp-copy.ts`

```ts
import { OwnerLocale } from '@zapbip/types';

export enum OwnerCopyKey {
  UnsupportedKind = 'unsupported_kind',
  MediaUnavailable = 'media_unavailable',
  ListButtonLabel = 'list_button_label',
  ListSectionTitle = 'list_section_title',
  TemplatePreviewFallback = 'template_preview_fallback',
}

export const WHATSAPP_COPY: Record<OwnerLocale, Record<OwnerCopyKey, string>> = {
  [OwnerLocale.PortugueseBrazil]: {
    [OwnerCopyKey.UnsupportedKind]: 'Este tipo de mensagem ainda não é suportado. Envie como texto ou foto.',
    [OwnerCopyKey.MediaUnavailable]: 'Não consegui baixar o arquivo. Envie de novo, por favor.',
    [OwnerCopyKey.ListButtonLabel]: 'Ver opções',
    [OwnerCopyKey.ListSectionTitle]: 'Opções',
    [OwnerCopyKey.TemplatePreviewFallback]: 'uma mensagem',
  },
  [OwnerLocale.EnglishUs]: {
    [OwnerCopyKey.UnsupportedKind]: 'This kind of message is not supported yet. Send it as text or a photo.',
    [OwnerCopyKey.MediaUnavailable]: 'I could not download the file. Please send it again.',
    [OwnerCopyKey.ListButtonLabel]: 'See options',
    [OwnerCopyKey.ListSectionTitle]: 'Options',
    [OwnerCopyKey.TemplatePreviewFallback]: 'a message',
  },
};
```

`ListButtonLabel` must be at most 20 characters and `ListSectionTitle` at most 24; a unit test asserts both for each locale. `TemplatePreviewFallback` replaces an empty template preview after sanitising (AU rule in the test plan). The unit `pin` label applies to this file: it is a constant, so its test is green on arrival.

### `apps/api/src/adapters/whatsapp/whatsapp-templates.ts` (names and texts, exact)

```ts
export const WHATSAPP_TEMPLATE_BODIES: Record<WhatsAppTemplateName, Record<WhatsAppLanguageCode, string>> = {
  [WhatsAppTemplateName.AgentNotice]: {
    [WhatsAppLanguageCode.PortugueseBrazil]: 'Você tem uma mensagem de {{1}}: {{2}}. Toque em Abrir para ler.',
    [WhatsAppLanguageCode.EnglishUs]: 'You have a message from {{1}}: {{2}}. Tap Open to read it.',
  },
  [WhatsAppTemplateName.AgentQuestion]: {
    [WhatsAppLanguageCode.PortugueseBrazil]: '{{1}} tem uma pergunta para você: {{2}}. Toque em Responder para ver as opções.',
    [WhatsAppLanguageCode.EnglishUs]: '{{1}} has a question for you: {{2}}. Tap Reply to see the options.',
  },
};
export const WHATSAPP_TEMPLATE_QUICK_REPLIES: Record<WhatsAppTemplateName, Record<WhatsAppLanguageCode, string>> = {
  [WhatsAppTemplateName.AgentNotice]: { [WhatsAppLanguageCode.PortugueseBrazil]: 'Abrir', [WhatsAppLanguageCode.EnglishUs]: 'Open' },
  [WhatsAppTemplateName.AgentQuestion]: { [WhatsAppLanguageCode.PortugueseBrazil]: 'Responder', [WhatsAppLanguageCode.EnglishUs]: 'Reply' },
};
export const OWNER_LOCALE_TO_LANGUAGE_CODE: Record<OwnerLocale, WhatsAppLanguageCode> = {
  [OwnerLocale.PortugueseBrazil]: WhatsAppLanguageCode.PortugueseBrazil,
  [OwnerLocale.EnglishUs]: WhatsAppLanguageCode.EnglishUs,
};
```

### `apps/api/src/adapters/whatsapp/graph-client.ts`

```ts
export type GraphClient = {
  post(input: { path: string; body: unknown }): Promise<unknown>;
  get(input: { path: string }): Promise<unknown>;
  download(input: { url: string }): Promise<Response>;
};

export function createGraphClient(input: {
  baseUrl: string;
  accessToken: string;
  fetcher: typeof fetch;
}): GraphClient;
```

`post` and `get` build `${baseUrl}/${GRAPH_API_VERSION}${path}` and abort after `GRAPH_REQUEST_TIMEOUT_MS`. `download` sends the bearer token only after the host check of A14, uses `redirect: 'manual'`, and never follows a redirect.

### `apps/api/src/adapters/whatsapp/read-whatsapp-env.ts`

```ts
export type WhatsAppEnvironment = {
  graphBaseUrl: string;
  accessToken: string;
  phoneNumberId: string;
  verifyToken: string;
  appSecret: string;
};

export function readWhatsAppEnvironment(input: { env: Bindings }): WhatsAppEnvironment;
```

Throws `Error` naming the variable when one is missing.

### Adapter signatures (stub bodies in W0)

`signature.ts`, `challenge.ts`, `inbound-parser.ts`, `status-parser.ts`, `media-download.ts`, `outbound-builders.ts`, `outbound-limits.ts`, `template-sanitiser.ts`, `channel-error-mapping.ts`, `cloud-api-message-sender.ts`, `operator-log.ts`, all under `apps/api/src/adapters/whatsapp/`:

```ts
export function verifyWebhookSignature(input: { appSecret: string; rawBody: ArrayBuffer; signatureHeader: string | null }): Promise<boolean>;
export function answerWebhookChallenge(input: { mode: string | null; token: string | null; challenge: string | null; expectedToken: string }): Promise<{ status: number; body: string | null }>;

export type ParsedChange = {
  phoneNumberId: string;
  field: string;
  entries: ParsedEntry[];
  statuses: ParsedStatus[];
};
export type ParsedEntry =
  | { kind: 'inbound'; channelMessageId: string; fromWaId: string; at: number; entry: ChannelInboundEntry; media: MediaDownloadRequest | null }
  | { kind: 'rejected'; reason: OperatorLogReason };
export type ParsedStatus = { channelMessageId: string; status: DeliveryState.Sent | DeliveryState.Delivered | DeliveryState.Read | DeliveryState.Failed | null; detail: ChannelStatusDetail; timestamp: number };
export function parseWebhookNotification(input: { rawJson: unknown }): ParsedChange[];

export type MediaDownloadRequest = { mediaId: string; channelMediaId: string; mimeType: string; sizeBytes: number; sha256Base64: string; filename: string | null; caption: string | null; mediaKind: MediaMessageKind };
export function downloadInboundMedia(input: { graph: GraphClient; mediaStore: MediaStore; accountId: string; request: MediaDownloadRequest; maxBytes: number; attempts: number }): Promise<{ stored: boolean }>;

export function buildSessionPayload(input: { recipientWaId: string; message: Message; question: Question | null; replyToChannelMessageId: string | null; reactionTargetChannelMessageId: string | null; publicOrigin: string; mediaStore: MediaStore; accountId: string }): Promise<Record<string, unknown>>;
export function buildTemplatePayload(input: { recipientWaId: string; kind: TemplateKind; locale: OwnerLocale; parameters: string[] }): Record<string, unknown>;
export function assertOutboundMedia(input: { mediaKind: MediaMessageKind; mimeType: string | null; sizeBytes: number | null }): void;
export function assertButtonLimits(input: { bodyText: string; replies: { id: string; title: string }[] }): void;
export function assertListLimits(input: { bodyText: string; buttonLabel: string; sectionTitle: string; rows: { id: string; title: string; description: string | null }[] }): void;
export function sanitiseTemplateParameter(input: { value: string; fallback: string }): string;
export function assertTemplateBodyHasFixedWords(input: { body: string }): void;
export function mapGraphErrorToChannelError(input: { status: number; errorCode: number | null; errorTitle: string | null; message: string; isTemplateSend: boolean }): ChannelError;
export function logOperatorEvent(input: { event: OperatorEvent; fields: Partial<Record<OperatorLogField, string | number | boolean>> }): void;
export function createCloudApiMessageSender(input: { accountId: string; graph: GraphClient; findOwnerByAccountId: (input: { accountId: string }) => Promise<OwnerRecipient | null>; messageIndex: D1MessageIndex; restrictions: ChannelRestrictions; mediaStore: MediaStore; publicOrigin: string; phoneNumberId: string; clock: Clock }): MessageSender;
```

`parseWebhookNotification` never throws for one bad change or entry; it returns `rejected` items. The entry carries `replyToChannelMessageId` inside `entry` (the `ChannelInboundEntry` shape). `buildSessionPayload` is async because a stored media source needs a signed link: `${publicOrigin}/m/${accountId}/${mediaId}?${query}` with `query` from `mediaStore.signedLink({accountId, mediaId, purpose: LinkPurpose.Read, ttlMs: MEDIA_LINK_TTL_MS})`. `sanitiseTemplateParameter` requires a `fallback`; the caller passes `WHATSAPP_COPY[locale][OwnerCopyKey.TemplatePreviewFallback]`, so an empty preview never becomes an empty string. `MediaMessageKind` is core's.

### `apps/api/src/adapters/platform/hash.ts` (additions)

```ts
export function sha256Hex(input: { value: string }): Promise<string>;
export function sha256Base64(input: { bytes: ArrayBuffer }): Promise<string>;
```

### `apps/api/src/adapters/d1/` (additions and one new file)

```ts
// d1-owner-directory.ts (addition; findOwnerByPhone stays)
export type OwnerRecipient = { waId: string; ownerLocale: OwnerLocale };
export function findOwnerByAccountId(input: { database: D1Database; accountId: string }): Promise<OwnerRecipient | null>;

// d1-channel-restrictions.ts (new)
export type ChannelRestrictions = {
  findActive(input: { now: number }): Promise<{ errorCode: number } | null>;
  record(input: { errorCode: number; restrictedAt: number }): Promise<void>;
};
export class D1ChannelRestrictions implements ChannelRestrictions {
  constructor(input: { database: D1Database });
}
```

`findActive` ignores a row older than `RESTRICTION_TTL_MS` (A8). `D1MessageIndex` is slice 1's class, used as it is: `record({id, accountId, at})` returns whether the row was new, `find({id})` returns `{accountId}` or `null` (R11). Both finders throw naming the value when the stored `locale` is not an `OwnerLocale` member (W3).

### `apps/api/src/account-inbox/account-inbox.ts` (stubs for W0)

`receiveChannelMessage` and `applyChannelStatus` throw `<name> is not implemented`. The sender selection (`createSender`, R15) and the schema `v4` are W3.

### `apps/api/test/support/fake-graph.ts` (new, W0)

A Node HTTP server (`startFakeGraph({port})`) and a client class `FakeGraph` with `baseUrl`, `requests(): Promise<RecordedRequest[]>` (method, path, headers, body), `respondWith(input: {method, path, status, body}): Promise<void>` and `reset(): Promise<void>`; the client talks to the server's control routes, because the Durable Object runs in workerd and the test runs beside it. The same server serves the integration pool (started by a global setup, port `4012`) and the E2E run (port `4011`). Routes are added by W2. Seed, in-memory and SQLite updates wait for W0b.

### `apps/api/src/routes/whatsapp.ts` (stub) and `apps/api/src/app.ts`

`createApp` mounts `whatsappRoutes` (`routes/whatsapp.ts`) on `WHATSAPP_WEBHOOK_PATH` in both entries, with one added line (R28). The stub handlers throw `<name> is not implemented`. The body, written by W4, follows A26, A27 and the failure table of the spec.

### `apps/api/wrangler.jsonc` and `apps/api/vitest.integration.config.mts` (change)

Top-level `vars` (the development entry): `"WHATSAPP_GRAPH_BASE_URL": "http://127.0.0.1:4011"`. No value in any other block; `deploy-readiness` adds `env.staging` and `env.production` with the Graph host (A19). The integration bindings gain `WHATSAPP_ACCESS_TOKEN` = `test-access-token`, `META_APP_SECRET` = `test-app-secret`, `WHATSAPP_VERIFY_TOKEN` = `test-verify-token`, `WHATSAPP_PHONE_NUMBER_ID` = `1000000000000001`, `WHATSAPP_GRAPH_BASE_URL` = `http://127.0.0.1:4012`.

### `apps/api/package.json`

No change: `@zapbip/types` is already a dependency.

### W0b (after the lead merges slice 1's lanes into `feat/agent-inbox-core`)

An added step (reported to the lead). Stubs only, bodies stay for the lanes:

- `libs/core/src/inbox/testing/in-memory.ts`: stub methods for the new `InboxRepository` members; `RecordingSender` takes the widened `session` input.
- `apps/api/src/adapters/sqlite/sqlite-inbox-repository.ts`: stub methods for the new members.
- `apps/api/src/adapters/fake/fake-whatsapp-sender.ts`: the widened `session` input, body unchanged.
- `libs/core/src/inbox/use-cases/{deliver-to-owner,flush-queue}.ts`: callers of `session` pass the new fields (`null` until W1).
- `apps/api/src/routes/http-status.ts`: `ERROR_STATUS` gains the new kinds.
- `apps/api/test/support/seed.ts`: signatures only.

## Dependencies

Nothing new is installed. Pins reused from `agent-inbox-core`: `zod` 4.6.7, `vitest` 5.0.5 (`libs/core`), `vitest` 4.1.12 and `@cloudflare/vitest-pool-workers` 0.23.0 (`apps/api`), `wrangler` 4.158.0, `@cloudflare/workers-types` 5.20261106.1, `drizzle-orm` 0.45.4. `@zapbip/types` and `@zapbip/core` are `workspace:*`. The Workers runtime APIs `crypto.DigestStream` and `FixedLengthStream` need a `compatibility_date` that supports them (A24, resolved: R29).

## File map (lanes)

Every path is owned by exactly one lane. A developer that needs a sibling's path stops and asks the lead, or notes the gap in its tester briefing (HARNESS §4). Paths refreshed at W-1.1.

| Lane | Developer | Owned paths |
|---|---|---|
| W-1 Refresh | `developer-w-1` | `docs/features/whatsapp-cloud-channel/plan.md` and `test-plan.md` (this refresh) |
| W0 Contract (serial) | `developer-w0` | `libs/types/src/{enums,constants}.ts` (additions), `libs/core/src/inbox/{errors,message,inbox-records,ports,index}.ts`, `libs/core/src/inbox/use-cases/{types,receive-channel-message,open-window,close-window,apply-status,status-rule,claim-queued}.ts` (stubs), `apps/api/src/contract/{env,account-inbox-rpc,constants}.ts`, `apps/api/src/app.ts`, `apps/api/src/routes/whatsapp.ts` (stub), `apps/api/src/adapters/whatsapp/{whatsapp-constants,whatsapp-enums,whatsapp-copy,whatsapp-templates,graph-client,read-whatsapp-env,signature,challenge,inbound-parser,status-parser,media-download,outbound-builders,outbound-limits,template-sanitiser,channel-error-mapping,cloud-api-message-sender,operator-log}.ts` (stubs; the copy and the templates are constants), `apps/api/src/adapters/platform/hash.ts` (stubs), `apps/api/src/adapters/d1/{d1-owner-directory,d1-channel-restrictions}.ts` (stubs), `apps/api/src/account-inbox/account-inbox.ts` (the two RPC stubs), `apps/api/test/support/fake-graph.ts`, `apps/api/wrangler.jsonc` (development var), `apps/api/vitest.integration.config.mts` (bindings) |
| W0b Contract after slice 1 merges (serial) | `developer-w0` | `libs/core/src/inbox/testing/in-memory.ts`, `apps/api/src/adapters/sqlite/sqlite-inbox-repository.ts`, `apps/api/src/adapters/fake/fake-whatsapp-sender.ts`, `libs/core/src/inbox/use-cases/{deliver-to-owner,flush-queue}.ts` (call sites only), `apps/api/src/routes/http-status.ts`, `apps/api/test/support/seed.ts` (stub signatures) |
| W1 Core | `developer-w1` | `libs/core/src/inbox/use-cases/{receive-channel-message,open-window,close-window,apply-status,status-rule,claim-queued,deliver-to-owner,receive-owner-message,flush-queue,sweep-expired}.ts` (bodies; helper modules extracted from `receive-owner-message.ts` live beside it), `libs/core/src/inbox/window.ts`, `libs/core/src/inbox/testing/in-memory.ts` (bodies), `libs/core/src/inbox/**/*.test.ts` for those files |
| W2 Outbound | `developer-w2` | `apps/api/src/adapters/whatsapp/{graph-client,read-whatsapp-env,outbound-builders,outbound-limits,template-sanitiser,whatsapp-templates,channel-error-mapping,cloud-api-message-sender,operator-log}.ts` (bodies), `apps/api/test/support/fake-graph.ts` (routes), `apps/api/test/fixtures/whatsapp/outbound/**`, `apps/api/test/unit/whatsapp-{graph-client,read-whatsapp-env,outbound-builders,outbound-limits,template-sanitiser,templates,channel-error-mapping,copy,operator-log}.test.ts`, `apps/api/test/integration/whatsapp-outbound.test.ts` |
| W3 Storage and Durable Object | `developer-w3` | `apps/api/src/adapters/d1/{d1-owner-directory,d1-channel-restrictions}.ts` (bodies), `apps/api/src/adapters/platform/hash.ts` (bodies), `apps/api/migrations/0004_whatsapp_channel.sql` (new), `apps/api/src/account-inbox/**` (`migrations/v4.sql`, `migrations/index.ts`, RPC bodies, `createSender`), `apps/api/src/adapters/sqlite/sqlite-inbox-repository.ts` (bodies), `apps/api/src/dev/dev-account-inbox.ts` (the `createSender` override), `apps/api/src/mcp/wire.ts` (the `Unavailable` source), `apps/api/test/support/seed.ts` (bodies; `applyDirectoryMigration` runs `0004`), `apps/api/test/integration/{d1-owner-directory-channel,d1-message-index-channel,d1-channel-restrictions,account-inbox-channel}.test.ts`, `apps/api/test/unit/hash-digests.test.ts` |
| W4 Inbound | `developer-w4` | `apps/api/src/adapters/whatsapp/{signature,challenge,inbound-parser,status-parser,media-download}.ts` (bodies), `apps/api/src/routes/whatsapp.ts` (body), `apps/api/test/fixtures/whatsapp/inbound/**`, `apps/api/test/fixtures/whatsapp/status/**`, `apps/api/test/unit/whatsapp-{signature,challenge,inbound-parser,status-parser,media-download}.test.ts`, `apps/api/test/integration/{whatsapp-webhook,whatsapp-status}.test.ts` |
| W5 Docs | `developer-w5` | `apps/docs/concepts/whatsapp-channel.mdx`, `apps/docs/concepts/owner-notices.mdx`, `apps/docs/docs.json` (the `Concepts` group), `tools/repository-shape/src/whatsapp-docs.test.ts` (new) |
| W6 Proof | `developer-w6` | `apps/api/test/e2e/whatsapp-channel.e2e.test.ts`, `apps/api/test/e2e/whatsapp-support/**` (new; slice 1's `stack.ts` and `global-setup.ts` stay untouched), `apps/api/test/e2e/whatsapp-bundle.e2e.test.ts` (new) |

Ownership notes:

- W0 owns the shared test infrastructure that exists on this branch (`fake-graph.ts`, the integration bindings); W0b owns the rest once slice 1's lanes are merged, so no lane creates them later.
- `receive-owner-message.ts`, `deliver-to-owner.ts`, `flush-queue.ts` and `sweep-expired.ts` are slice 1 files, owned by W1 from this slice on; their slice 1 tests stay green. `sqlite-inbox-repository.ts`, `dev-account-inbox.ts`, `mcp/wire.ts` and `seed.ts` are slice 1 files, owned by W3 from this slice on.
- `apps/api/test/fixtures/whatsapp/` is split by lane: `inbound/` and `status/` belong to W4, `outbound/` to W2.
- `apps/api/migrations/0004_whatsapp_channel.sql` is this slice's only new D1 migration; `0001_core` and DO `v1` are not edited (A20).
- `env.staging` and `env.production` belong to `deploy-readiness`. W6.3 needs its production block merged.
- W6 wires its own setup beside slice 1's (R31); no refresh item is open.

## Sequencing and merge order

1. **W-1, plan refresh.** Done: the plan and test plan are diffed against slice 1's Step 0 tree and its lane tip, and every `(contract: confirm at build)` is resolved or struck with the reason.
2. **W0, serial.** The lead lands the contract commit. It typechecks with stubs.
2b. **W0b, serial, after the lead merges slice 1's lanes** into `feat/agent-inbox-core` and this branch takes that merge. It lands the stubs that need the lane files.
3. **Parallel after W0 and W0b:** W1, W2, W3, W4 and W5 start from the W0b commit in their own worktrees. Their red tests fail against the stubs. W4's route tests and W2's outbound integration test cannot go green before W3 merges, and W3's DO tests cannot go green before W1 merges.
4. **Merge order:** W0 → W0b → W1 → W2 → W3 → W4 → W5 → W6. W5 can merge at any time after W0.
5. **Lead merges after each lane:** `pnpm typecheck` and `pnpm verify` green before the next merge.
6. **Main moves:** the lead tells each developer what landed and which of its files collide. Developers merge main at a task boundary, never mid-step.

## Steps

Every box is empty when authored. A sub-agent ticks its own box. A wrong step is struck through with the reason.

### Step W-1 (plan refresh, first)

- [x] **W-1.1 Refresh against main.** Diff this plan against `main` and slice 1's merged code: paths, exports, names (`libs/types` enums, `SECOND_MS` family, `Bindings` names, `ConnectionDirectory`, `ChannelError`), migrations (`0001_core`, DO `v1`–`v3`), the media route and its signing key. Correct the plan. Every `(contract: confirm at build)` is resolved, or struck with the reason. Commit as `docs(whatsapp): refresh the channel plan against main`. Evidence: 59d0adc (the refresh table R1 to R30; the commit message is `docs(whatsapp-cloud-channel): refresh the plan against slice 1's code`).

### Step W0 (contract, serial)

- [x] **W0.1 Contract and stubs.** Write every contract block above that touches a file present on this branch, with stub bodies `void input;` and `throw new Error('<name> is not implemented');`. This includes `fake-graph.ts`, the integration bindings and the development variable. ~~The in-memory and SQLite repository stubs, the updated fake sender, the seed helper signatures, `index.dev.ts` with `registerDevelopmentSender` and `development-sender.ts`~~ (refresh: those files exist only on slice 1's lane branches, or are dropped by R15; the first four move to W0b). Commit as `feat(core): add the WhatsApp channel contract`. Evidence: 659e505.
- [x] **W0.2 Gate.** `pnpm typecheck` and `pnpm --filter @zapbip/repository-shape test:unit` green. ~~Commit as `chore(core): gate the channel contract`.~~ (refresh: the gate changes no file, so there is no commit.) Evidence: at 659e505 `pnpm typecheck` green in four packages, `pnpm --filter @zapbip/repository-shape test:unit` 54 passed, `pnpm test:unit` and `pnpm format:check` green; `pnpm verify` stops at its `secrets` gate, see the tester briefing.

- [x] **W0b.1 Contract after slice 1 merges.** Added by the refresh. Once the lead has merged slice 1's lanes, write the W0b block of the contract (in-memory, SQLite and fake-sender stubs, the `session` call sites, `ERROR_STATUS`, the seed signatures) and run `pnpm typecheck` and `pnpm verify`. Evidence: the merge-and-W0b commit on this branch. Commit as `feat(core): extend slice 1's ports with the channel contract`.

Failure modes for W0 are in the table below. W0 has no backout: fix forward in a new W0 commit that every lane merges.

### Lane W1 (core)

- [ ] **W1.1 red: pure rules.** Write `status-rule.test.ts` (every row of the spec's status table), `window.test.ts` (closed window, reopened by the next owner message, `openWindow` with an older `at` keeps the newer `lastOwnerMessageAt`), and the detail merge cases (CU-39 to CU-41). Expected failure: `applyStatusRule is not implemented`; the closed-window case returns `true`. Commit as `test(core): pin the status rule, the window and the detail merge`.
- [ ] **W1.2 green: pure rules.** Implement `status-rule.ts` (rank map: `Sent` 1, `Delivered` 2, `Read` 3, at the top of the file), `window.ts`, and the pure `mergeChannelStatusDetail`. Commit as `feat(core): implement the status rule, the window and the detail merge`.
- [ ] **W1.3 red: channel use cases.** Write `receive-channel-message.test.ts` (CU-16 to CU-23 and the transactional cases CU-18a and CU-18b), `open-window.test.ts` (CU-24, CU-24a to CU-24d), `claim-queued.test.ts` (CU-24c), `close-window.test.ts`, `apply-status.test.ts`, `deliver-to-owner-channel.test.ts` (CU-32 to CU-37), `sweep-expired.test.ts` (CU-38, CU-38b). Expected failure: `<name> is not implemented`. Commit as `test(core): pin the channel use cases`.
- [ ] **W1.4 green: channel use cases.** Implement the use cases with the order of A7 (transaction, then flush, waiters, wake), the claim of A22, the per-message flush of A23 in `flushQueue`, `deliverToOwner` (`WindowClosed` runs `closeWindow` then the closed-window path; other kinds store `Failed` and rethrow; a success stores `channelMessageId` through `saveChannelMessageId`), `sweepExpired` (adds `releaseStaleClaims`; receipts are already pruned). Extract the placement, answer and wake helpers from `receive-owner-message.ts` and `openWindow` from its window step (R8); `receiveChannelMessage` stores unavailable media as `Unavailable`, resolves channel ids (R25) and sends `noticeText` once; slice 1 tests stay green. Commit as `feat(core): implement the channel use cases`.

### Lane W2 (outbound)

- [ ] **W2.1 pin: copy and templates.** `whatsapp-copy.test.ts` asserts the keys, the spec's texts and the length limits of the list label and section title (pin, green on arrival). `whatsapp-templates.test.ts` asserts the template texts (pin). Commit as `test(api): pin the owner copy and the template texts`.
- [ ] **W2.2 red: builders, limits, sanitiser, error table.** Write `whatsapp-outbound-builders.test.ts`, `whatsapp-outbound-limits.test.ts`, `whatsapp-template-sanitiser.test.ts`, `whatsapp-channel-error-mapping.test.ts`. Expected failure: `<name> is not implemented`. Commit as `test(api): pin the outbound builders, limits, sanitiser and error table`.
- [ ] **W2.3 green: builders, limits, sanitiser, error table.** Implement the four modules (the sanitiser trims and returns the `fallback` when the result is empty). Commit as `feat(api): implement the outbound builders, limits, sanitiser and error table`.
- [ ] **W2.4 red: Graph client, env, log, sender.** Write `whatsapp-graph-client.test.ts` (timeout, `redirect: 'manual'`, host check), `whatsapp-read-whatsapp-env.test.ts`, `whatsapp-operator-log.test.ts` (fields keyed by `OperatorLogField`), and `whatsapp-outbound.test.ts` (integration, needs W3). Expected failure: `<name> is not implemented`. Commit as `test(api): pin the Graph client, the env reader, the log and the sender`.
- [ ] **W2.5 green: Graph client, env, log, sender.** Implement `graph-client.ts`, `read-whatsapp-env.ts`, `operator-log.ts`, `cloud-api-message-sender.ts` (recipient from `findOwnerByAccountId`, restriction check with TTL, builders, limits, stored media through `mediaStore.signedLink` and `publicOrigin`, index write on success, error mapping, a `Restricted` writes the restriction row and logs `channel.restricted`). Add the `FakeGraph` routes. Commit as `feat(api): implement the Cloud API sender`.

### Lane W3 (storage and Durable Object)

- [ ] **W3.1 red: directory, index, restrictions, repository, hash.** Write `d1-owner-directory-channel.test.ts`, `d1-message-index-channel.test.ts`, `d1-channel-restrictions.test.ts` (TTL cases), `hash-digests.test.ts` and `account-inbox-channel.test.ts` repository cases: `commitChannelInbound` writes receipt, message and window in one call and returns `false` on a second call; a throw inside the transaction rolls all three back; `claimQueuedMessages` returns each queued message once; `saveChannelStatusDetail` never writes null over a value. Expected failure: `<method> is not implemented`. Commit as `test(api): pin the directory, the index, the restrictions and the channel repository`.
- [ ] **W3.2 green: directory, index, restrictions, repository.** Create `apps/api/migrations/0004_whatsapp_channel.sql` (A20) and the DO schema `v4`. Implement `findOwnerByAccountId` and `D1ChannelRestrictions` (bound parameters only), the locale validation in both owner finders, `platform/hash.ts`, the repository, `commitChannelInbound` in one `transactionSync`. Commit as `feat(api): implement the directory, the index, the restrictions and the channel repository`.
- [ ] **W3.3 red: Durable Object.** Write the cases of `account-inbox-channel.test.ts` (WI-8 to WI-16): commit and duplicate, the injected throw before the commit leaves nothing, the injected throw after the commit leaves the message and the retry returns `duplicate: true`, restart keeps the receipt, alarm prunes receipts and releases stale claims, sender selection (`DevAccountInbox` picks the Cloud API sender when the token is set and the fake otherwise; the production class with no token throws naming the variable), `ctx.id.name` absent throws. Commit as `test(api): pin the Durable Object channel behaviour`.
- [ ] **W3.4 green: Durable Object.** Implement the RPC bodies, `createSender` and the `DevAccountInbox` override (A29), and the `Unavailable` source in `mcp/wire.ts`. The dev owner for the Cloud API sender comes from slice 1's `scripts/dev-seed.ts`; nothing new is written. Commit as `feat(api): implement the Durable Object channel behaviour`.

### Lane W4 (inbound)

- [x] **W4.1 red: signature, challenge, parsers.** Write the unit tests of the test plan's inbound sections, including multibyte signature fixtures, per-change phone numbers, unknown types as `Unsupported`, missing `from` as rejected, ignored fields, and status timestamps. Expected failure: `<name> is not implemented`. Commit as `test(api): pin the webhook signature, challenge and parsers`. (`3785271`)
- [x] **W4.2 green: signature, challenge, parsers.** Implement them (A16, A26, A27). Commit as `feat(api): implement the webhook signature, challenge and parsers`. (`04d7efe`)
- [x] **W4.3 red: media download.** Write `whatsapp-media-download.test.ts` (streamed digest, deletion on mismatch, `404` refresh, `5xx` and timeout raised, `redirect: 'manual'`, the host cases, the declared size, the stream longer than declared). Commit as `test(api): pin the inbound media download`. (`eba15a7`)
- [x] **W4.4 green: media download.** Implement A14, A15, A24, A25. Commit as `feat(api): implement the inbound media download`. (`62aefb4`)
- [x] **W4.5 red: route.** Write `whatsapp-webhook.test.ts` and `whatsapp-status.test.ts` (test plan WI-17 to WI-34, the batch cases, the chunked 3 MB body, DO failure `500`, R2 failure `500`, the unindexed status `503` and `200`). Expected failure: the stub route error. Commit as `test(api): pin the webhook route over HTTP`. (`33c454f`)
- [x] **W4.6 green: route.** Implement `routes/whatsapp.ts`: `GET` challenge; `POST`: size read with a limit (`413`, chunked included), signature (`401`), JSON (`400`), per change (`phone_number_id`, `field`), per message (directory, media, DO call), per status (index, `503` or `200`), DO failure `500`. Commit as `feat(api): implement the webhook route`. (`4372271`)

### Lane W5 (docs)

- [x] **W5.1 red: docs shape.** Write `tools/repository-shape/src/whatsapp-docs.test.ts`: both pages exist, are listed in the agent-inbox-core navigation group, and contain every limit of the spec's inbound and outbound tables and the 24 h restriction rule. Expected failure: the pages are missing. Commit as `test(shape): expect the channel and notice pages`. (`c74ef84`)
- [x] **W5.2 green: docs.** Write `concepts/whatsapp-channel.mdx` and `concepts/owner-notices.mdx`; list them in `docs.json`; run `mint broken-links`. Commit as `docs(api): document the WhatsApp channel and the owner notices`. (`7cdf859`)

### Lane W6 (proof, after every merge and after deploy-readiness's production block)

- [ ] **W6.1 red: E2E.** Write `apps/api/test/e2e/whatsapp-channel.e2e.test.ts` and `apps/api/test/e2e/whatsapp-support/`: start the fake Graph on `4011`, start `wrangler dev` with the `--var` secrets and `WHATSAPP_GRAPH_BASE_URL` pointing at the fake, post signed webhooks. Expected failure: the first signed webhook does not return `200` before W3 and W4 are wired. Commit as `test(api): pin the channel end to end`.
- [ ] **W6.2 green: E2E.** Fix only the harness; a product bug goes back to its lane. Commit as `test(api): run the channel end to end`.
- [ ] **W6.3 red: production bundle.** Write `apps/api/test/e2e/whatsapp-bundle.e2e.test.ts` beside slice 1's bundle test, using the same dry-run helper pattern: `wrangler deploy --dry-run --env production --outdir <scratch>` succeeds; the bundle has no `127.0.0.1:4011`, no fixture marker and no `fake-whatsapp-sender` import; with `WHATSAPP_GRAPH_BASE_URL` missing the channel throws naming it. Commit as `test(api): pin the production bundle`.
- [ ] **W6.4 green.** Only if W6.3 needed a harness change: implement it and commit as `test(api): prove the production bundle carries no fake`. Otherwise strike this box with the reason.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| W-1.1 | Plan drifts from slice 1 as its lanes merge | a W0b stub does not typecheck against the merged lane files | Fix forward in the W0b commit; correct the plan row |
| W0.1 | Contract drift between lanes | `pnpm typecheck` fails in a lane that did not change the contract | Fix forward in a new W0 commit that every lane merges |
| W1.4 | The receipt is written after the flush or wake | `receive-channel-message.test.ts` post-commit throw: the retry returns `duplicate: false` and stores a second message | Move the receipt into `commitChannelInbound`; revert the W1.4 commit |
| W1.4 | Flush claims after the Graph await | `open-window.test.ts` concurrent flush: a message is sent twice | Revert; `claim-queued.test.ts` is the proof |
| W1.4 | The helper extraction changes slice 1 behaviour | slice 1 `receive-owner-message.test.ts` goes red | Revert the extraction; keep the new use case as a copy until green |
| W2.5 | Restriction not written, so sends continue | `whatsapp-outbound.test.ts` "restricted" case: a second send calls Graph | Revert the sender commit |
| W2.5 | Stored media sent without a signed link | `whatsapp-outbound.test.ts` media case: the link is not `publicOrigin` based | Revert the builder change |
| W3.2 | `0004` migration fails on a fresh database | the integration pool fails at migration apply | Revert the migration commit; `0001_core` and `v1` are untouched |
| W3.2 | `commitChannelInbound` not atomic | `account-inbox-channel.test.ts` injected throw before commit leaves a receipt | Revert; the transaction is the proof |
| W3.4 | Production selects the fake sender | `whatsapp-bundle.e2e.test.ts` finds the fake sender | Move the fake back behind the `DevAccountInbox` override |
| W4.2 | One bad entry fails the batch | `whatsapp-webhook.test.ts` batch case: the good message is missing | Parse per change and per message (A26) |
| W4.2 | Timestamp parsed as seconds | `inbound-parser.test.ts` "timestamp 1762430400 becomes 1762430400000" | Fix in the parser only |
| W4.4 | Bearer sent to a foreign host | `whatsapp-media-download.test.ts` host cases: an `Authorization` header reaches the fake on a foreign host | Revert the host check; the commit is blocked until green |
| W4.4 | A redirect is followed | the fake records a second request after a `302` | Restore `redirect: 'manual'` |
| W4.4 | Bytes remain in R2 after a mismatch | `whatsapp-media-download.test.ts` mismatch case: the key still exists | Add the delete on mismatch (A24) |
| W4.6 | A media `5xx` returns `200` | `whatsapp-webhook.test.ts` media `5xx` case: status `200` | Return `500` (A25) |
| W4.6 | Unindexed status returns `200` while young | `whatsapp-status.test.ts` young unknown `wamid`: status `200` | Return `503` below the 10 min window (A27) |
| W6.3 | The development URL reaches production | `whatsapp-bundle.e2e.test.ts` grep finds `127.0.0.1:4011` | Remove the var from the non-development block |

**Steps with no backout:** W0.1 (fix forward only), W-1.1 (a documentation commit, revert it).

## Z. Prove and ship

- [ ] **Tester briefing:** a developer wrote `tester-briefing.md` (per lane).
- [ ] **Tester run:** a fresh `tester` sub-agent per test-plan area executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`.
- [ ] **/check-ui:** the simulator screen walk on the development entry (owner text, voice note, quick-reply tap) recorded and uploaded.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened. The owner-run items of `test-plan.md` are listed in the PR as open.

## Core contract additions

For the orchestrator to merge into `core-contract-additions.md`. Every row is additive except the marked changes; routing rules 1 to 6, the window arithmetic, `ask` idempotency and the queue rule keep their meaning. Refreshed at W-1.1 against slice 1's Step 0 tree.

| # | Addition | Kind | Lives in | Rule note |
|---|---|---|---|---|
| 1 | `DeliveryState.Delivered`, `Read`, `Sending` | enum values | `libs/types/src/enums.ts` | `Sending` is the claim of A22 |
| 2 | `MediaSourceKind.Unavailable` and the `MediaSource` variant `{kind: Unavailable}` | enum value, union member | `libs/types/src/enums.ts`, `libs/core/src/inbox/message.ts` | A5 |
| 3 | `ChannelErrorKind` values `WindowClosed`, `RateLimited`, `Restricted`, `ReactionRejected`, `MediaRejected`, `TemplateRejected`, `Timeout`, `Auth`, `Unknown` | enum values | `libs/types/src/enums.ts` | `DeliveryFailed` is slice 1's; `ERROR_STATUS` gains the keys in W0b |
| 4 | `ChannelInboundKind` (`Owner`, `WindowOnly`, `Unsupported`) | enum | `libs/types/src/enums.ts` | the three inbound entry shapes |
| 5 | `ChannelError extends InboxError`, adds `errorCode: number or null` | error class | `libs/core/src/inbox/errors.ts` | `message` is the agent-facing English text; `code` is the kind (R6) |
| 6 | `OwnerWindow.closedAt: number or null` | record field | `libs/core/src/inbox/inbox-records.ts` | A3; arithmetic unchanged |
| 7 | `ChannelStatusDetail` `{errorCode, errorTitle, pricingCategory, billable}` | record type | `inbox-records.ts` | A28 merge |
| 8 | `BYTES_PER_KILOBYTE` = 1 000 | constant | `libs/types/src/constants.ts` | `RECEIPT_RETENTION_MS` is slice 1's, not an addition |
| 9 | `InboxRepository.commitChannelInbound`, `saveChannelMessageId`, `findMessageByChannelMessageId`, `findChannelMessageId`, `saveChannelStatusDetail`, `claimQueuedMessages`, `releaseStaleClaims` | port methods | `libs/core/src/inbox/ports.ts` | A7 and A22; `recordChannelReceipt` and `deleteExpiredReceipts` stay slice 1's |
| 10 | `MessageSender.session` gains `question`, `replyToChannelMessageId` and `reactionTargetChannelMessageId` | port, widened input (call sites updated in W0b) | `ports.ts` | A2 |
| 11 | `UnavailableOwnerMedia`, `ChannelInboundEntry`, `ReceiveChannelInput`, `OpenWindowInput`, `CloseWindowInput`, `ApplyStatusInput`, `ApplyStatusResult` | types | `libs/core/src/inbox/use-cases/types.ts` | `OwnerInboundContent` and `ReceiveResult` unchanged (R17, R26) |
| 12 | Use case `receiveChannelMessage` (one transaction, then flush, waiters, wake) | use case | `receive-channel-message.ts` | A7; reuses the helpers extracted from `receive-owner-message.ts` |
| 13 | Use case `openWindow({at, ownerLocale})`: the window step of channel arrival; stores `max(at)`; flushes with claims | use case | `open-window.ts` | A3, A22, A23 |
| 14 | Use case `closeWindow({at})` | use case | `close-window.ts` | A3 |
| 15 | Use case `applyStatus` and pure `applyStatusRule`, `mergeChannelStatusDetail` | use case, pure functions | `apply-status.ts`, `status-rule.ts` | status table; A28 |
| 16 | Use case `claimQueued` (the claim before any await) | use case | `claim-queued.ts` | A22 |
| 17 | `deliverToOwner` reads `ChannelError`: `WindowClosed` runs `closeWindow` then the queue and one notice; other kinds store `Failed` and rethrow `DeliveryFailed`; success stores `channelMessageId` | behaviour, slice 1 use case | `deliver-to-owner.ts` | window and queue rules unchanged |
| 18 | `flushQueue` claims, sends per message, stops at the first `WindowClosed` | behaviour, slice 1 use case | `flush-queue.ts` | A22, A23 |
| 19 | `sweepExpired` releases stale `Sending` claims | behaviour, slice 1 use case | `sweep-expired.ts` | A22; receipts are already pruned |
| 20 | DO RPC methods `receiveChannelMessage`, `applyChannelStatus` | RPC methods | `apps/api/src/contract/account-inbox-rpc.ts` | DO wraps the core |
| 21 | `findOwnerByAccountId({database, accountId})` and `OwnerRecipient`; locale validation in both owner finders | adapter function, hardening | `apps/api/src/adapters/d1/d1-owner-directory.ts` | A1; accounts-and-keys promotes the directory to a core port |
| 22 | Env `META_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_GRAPH_BASE_URL` (optional in the type) | env type | `apps/api/src/contract/env.ts` | slice 1 names kept |
| 23 | `AccountInbox.createSender()` (protected) and the `DevAccountInbox` override | class seam | `account-inbox.ts`, `dev-account-inbox.ts` | A29; the fake leaves the production bundle |
| 24 | DO schema `v4` and D1 migration `0004_whatsapp_channel` | storage | `apps/api/src/account-inbox/migrations/v4.sql`, `apps/api/migrations/0004_whatsapp_channel.sql` | A20 |

Not in the core: `D1ChannelRestrictions` (adapter in `apps/api`) and `OwnerLocale` (slice 1's enum; the account's value is set by accounts-and-keys).
