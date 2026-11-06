# Test plan: WhatsApp Cloud channel

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

Test areas are grouped so that separate tester sub-agents can run them in parallel: **Core unit**, **API unit**, **Worker integration**, **E2E**, **Docs and shape**, **Security checks**, **Production build**, and **Owner-run** (outside the gate). A tester runs the areas it owns and never edits product code (HARNESS §5).

Notation: `CU-n` core unit, `AU-n` API unit, `WI-n` Worker integration, `E2E-n` end to end, `DOC-n` docs and shape, `SEC-n` security, `PB-n` production build, `OR-n` owner-run. Error text is the message the core or the adapter produces; field names are the wire names. Test secrets are the constants `test-app-secret`, `test-verify-token`, `test-access-token`, and the phone number id `1000000000000001` (fictional). No test reads a real credential or calls `graph.facebook.com`.

## The failing test first

Each red commit is one of the commits in `plan.md` Steps W1.1, W1.3, W2.2, W2.4, W3.1, W3.3, W4.1, W4.3, W4.5, W5.1 and W6.1. The tester checks each red commit by `git log` and by running the named test on that commit in a throwaway worktree.

- [ ] W1.1 red `libs/core/src/inbox/use-cases/status-rule.test.ts`, `libs/core/src/inbox/window.test.ts` — input: the Step W0 tree; expected: fails with `applyStatusRule is not implemented`; the closed-window case fails with `expected false, received true`.
- [ ] W1.3 red `libs/core/src/inbox/use-cases/{receive-channel-message,open-window,claim-queued,close-window,apply-status,deliver-to-owner-channel,sweep-expired}.test.ts` — expected: each fails with `<use case> is not implemented`.
- [ ] W2.2 red `apps/api/test/unit/whatsapp-{outbound-builders,outbound-limits,template-sanitiser,channel-error-mapping}.test.ts` — expected: each fails with `<name> is not implemented`.
- [ ] W2.4 red `apps/api/test/unit/whatsapp-{graph-client,read-whatsapp-env,operator-log}.test.ts` — expected: each fails with `<name> is not implemented`.
- [ ] W3.1 red `apps/api/test/integration/{d1-owner-directory-channel,d1-message-index-channel,d1-channel-restrictions,account-inbox-channel}.test.ts` and `apps/api/test/unit/hash-digests.test.ts` — expected: each fails with `<method> is not implemented`.
- [ ] W3.3 red `apps/api/test/integration/account-inbox-channel.test.ts` (DO cases) — expected: fails with `receiveChannelMessage is not implemented`.
- [ ] W4.1 red `apps/api/test/unit/whatsapp-{signature,challenge,inbound-parser,status-parser}.test.ts` — expected: each fails with `<name> is not implemented`.
- [ ] W4.3 red `apps/api/test/unit/whatsapp-media-download.test.ts` — expected: fails with `downloadInboundMedia is not implemented`.
- [ ] W4.5 red `apps/api/test/integration/{whatsapp-webhook,whatsapp-status}.test.ts` — input: a signed text webhook; expected: the response is not `200`, because the stub route throws.
- [ ] W5.1 red `tools/repository-shape/src/whatsapp-docs.test.ts` — expected: fails because the two MDX pages are missing.
- [ ] W6.1 red `apps/api/test/e2e/whatsapp-channel.e2e.test.ts` — expected: fails at the first signed webhook, not at `wrangler dev` startup.
- [ ] Pin (green on arrival, labelled `pin` in the briefing, never red-first): `whatsapp-copy.test.ts` and `whatsapp-templates.test.ts` (W2.1). They test constants that W0 writes exactly.
- [ ] Confirmed each red run failed for the right reason: the failure text recorded in `tester-briefing.md` matches the text above, not a missing module or a typo.

## Core unit

Runner: `pnpm --filter @zapbip/core test:unit` (Vitest 5.0.5). Ports are the in-memory adapters from `libs/core/src/inbox/testing/in-memory.ts`; time comes from the fake clock.

### Status rule (`status-rule.test.ts`)

- [ ] CU-1 input: current `Sent`, incoming `Delivered`; expected: next `Delivered`, logged false.
- [ ] CU-2 input: current `Sent`, incoming `Read`; expected: next `Read`.
- [ ] CU-3 input: current `Delivered`, incoming `Read`; expected: next `Read`.
- [ ] CU-4 input: current `Read`, incoming `Delivered`; expected: next `null`, logged false (lower rank).
- [ ] CU-5 input: current `Sent`, incoming `Failed`; expected: next `Failed`.
- [ ] CU-6 input: current `Delivered`, incoming `Failed`; expected: next `null`, logged true (`status.failed.ignored`).
- [ ] CU-7 input: current `Read`, incoming `Failed`; expected: next `null`, logged true.
- [ ] CU-8 input: current `Failed`, incoming `Sent`; expected: next `Sent` (the status wins).
- [ ] CU-9 input: current `Failed`, incoming `Delivered`; expected: next `Delivered`.
- [ ] CU-10 input: current `Failed`, incoming `Read`; expected: next `Read`.
- [ ] CU-11 input: current `Read`, incoming `Read`; expected: next `null` (a repeat is a no-op).
- [ ] CU-12 input: current `Queued`, incoming `Delivered`; expected: next `null` (a queued message has no wamid, so the rule is not reached in production; the pure rule says no change).

### Channel-closed window (`window.test.ts`)

- [ ] CU-13 input: `lastOwnerMessageAt` = T, `closedAt` = T + 1, `now` = T + 2; expected: `isOwnerWindowOpen` false.
- [ ] CU-14 input: `closedAt` null and the slice 1 arithmetic at its boundary (`now` = `last + WINDOW_MS - WINDOW_SAFETY_MARGIN_MS - 1`); expected: `true`, unchanged.
- [ ] CU-15 input: `closeWindow` at T + 1, then `openWindow` at T + 5; expected: open at T + 6.
- [ ] CU-41 `open-window.test.ts` — input: stored `lastOwnerMessageAt` T + 10 and `openWindow({at: T + 5})`; expected: `lastOwnerMessageAt` stays T + 10 (`max`).
- [ ] Edge: `closedAt` set and `lastOwnerMessageAt` null; input `now` = 0; expected: `false`, no exception.

### Channel use cases (`libs/core/src/inbox/use-cases/*.test.ts`)

- [ ] CU-16 `receive-channel-message.test.ts` — input: a new `wamid.A` with a text entry; expected: `{duplicate: false}`, the receipt exists, the message is stored with `readByAgent: false`, the window is open at the entry's `at`.
- [ ] CU-17 `receive-channel-message.test.ts` — input: `wamid.A` again; expected: `{duplicate: true}`, message count unchanged, no waiter resolved, the waker is not called.
- [ ] CU-18a `receive-channel-message.test.ts` — input: the in-memory `commitChannelInbound` throws before it writes (fault injected); expected: the call throws; no receipt and no message exist; a retry returns `{duplicate: false}` and stores exactly one message.
- [ ] CU-18b `receive-channel-message.test.ts` — input: the waker's `notify` rejects after the commit; expected: the call throws; the message and the receipt exist; a retry of `wamid.A` returns `{duplicate: true}`; the message count is 1; the waker is called once in total for the first attempt.
- [ ] CU-19 `receive-channel-message.test.ts` — input: a `WindowOnly` entry at `at` = T with one queued message; expected: `{duplicate: false}`, the window's `lastOwnerMessageAt` is T, the queued message is sent once, nothing is stored as a message.
- [ ] CU-20 `receive-channel-message.test.ts` — input: an `Unsupported` entry with `noticeText` `X`; expected: the window opens, one session text `X` with `agent: null` is sent, no agent message is stored.
- [ ] CU-21 `receive-channel-message.test.ts` — input: an `Owner` entry with `replyToChannelMessageId` = the wamid of an agent message `M`; expected: the stored message has `replyToMessageId` equal to `M`'s `messageId`.
- [ ] CU-22 `receive-channel-message.test.ts` — input: `replyToChannelMessageId` that no message has; expected: stored with `replyToMessageId: null`, no error.
- [ ] CU-23 `receive-channel-message.test.ts` — input: an `Owner` media entry with `mediaId: null` and `noticeText` `Y`; expected: stored with source `Unavailable`; one session text `Y` sent with `agent: null`.
- [ ] CU-24 `open-window.test.ts` — input: `openWindow({at: T})` with three queued messages and a closed window; expected: the three are sent in order, each `Sent`, `closedAt` null, `noticeSentForClosedWindow` false.
- [ ] CU-24a `open-window.test.ts` — input: three queued; the sender throws `RateLimited` on the second; expected: the call resolves; message 1 `Sent`, message 2 `Failed` with `errorCode` set, message 3 `Sent`.
- [ ] CU-24b `open-window.test.ts` — input: three queued; the sender throws `WindowClosed` on the second; expected: the call resolves; message 1 `Sent`; messages 2 and 3 `Queued`; `closedAt` set; exactly one notice template call.
- [ ] CU-24c `open-window.test.ts` — input: three queued; two `openWindow` calls run concurrently and the sender awaits a gate before answering; expected: the sender is called exactly three times in total, one per message; the second call claims none.
- [ ] CU-24d `open-window.test.ts` — input: a queued message whose expiry has passed; expected: marked `Expired`, not sent.
- [ ] CU-25 `claim-queued.test.ts` — input: three queued messages, `claimQueued({limit: 2})`; expected: two returned, each `Sending` with `claimedAt` set; the third stays `Queued`.
- [ ] CU-26 `close-window.test.ts` — input: `closeWindow({at: T})`; expected: `closedAt` = T and no message sent.
- [ ] CU-27 `apply-status.test.ts` — input: a stored outbound with `channelMessageId` `wamid.S`, status `Read`; expected: `{applied: true}`, delivery `Read`.
- [ ] CU-28 `apply-status.test.ts` — input: status `Delivered` after `Read`; expected: `{applied: true}`, delivery stays `Read`.
- [ ] CU-29 `apply-status.test.ts` — input: status `Failed` with `errorCode` 131026 and `errorTitle` `Message undeliverable` after `Sent`; expected: delivery `Failed`; both stored.
- [ ] CU-30 `apply-status.test.ts` — input: status for an unknown `channelMessageId`; expected: `{applied: false}`, no write.
- [ ] CU-31 `apply-status.test.ts` — input: the sequence `Sent`, `Read`, `Delivered`, `Failed`; expected: delivery `Read` at the end.
- [ ] CU-32 `deliver-to-owner-channel.test.ts` — input: the sender returns `{channelMessageId: 'wamid.N'}`; expected: the message is `Sent` and `findChannelMessageId` returns `wamid.N`.
- [ ] CU-33 `deliver-to-owner-channel.test.ts` — input: the sender throws `WindowClosed`; expected: `closeWindow` runs, the message is `Queued`, one notice call; a second send in the same closed window makes no second notice.
- [ ] CU-34 `deliver-to-owner-channel.test.ts` — input: the sender throws `RateLimited` with message `busy text`; expected: `Failed` with `errorCode` set; the propagated message is `busy text`.
- [ ] CU-35 `deliver-to-owner-channel.test.ts` — input: the sender throws `ReactionRejected`, message `Reaction target invalid: reaction.message_id`; expected: `Failed`; the message names `reaction.message_id`.
- [ ] CU-36 `deliver-to-owner-channel.test.ts` — input: a reply to a message whose channel id is `wamid.R`; expected: the sender receives `replyToChannelMessageId` `wamid.R`.
- [ ] CU-37 `deliver-to-owner-channel.test.ts` — input: a reaction whose target has channel id `wamid.T`; expected: the sender receives `reactionTargetChannelMessageId` `wamid.T`.
- [ ] CU-38 `sweep-expired.test.ts` — input: a receipt at T, a sweep at T + `RECEIPT_RETENTION_MS` + 1, and a receipt at T + 1; expected: the first is pruned, the second kept.
- [ ] CU-38b `sweep-expired.test.ts` — input: a `Sending` row claimed at T and a `Sending` row claimed at T + `SENDING_STALE_MS` - 1 swept at T + `SENDING_STALE_MS` + 1; expected: the first becomes `Queued`, the second stays `Sending`.
- [ ] CU-39 `status-rule.test.ts` — input: `mergeChannelStatusDetail` with stored `{errorCode: 131026}` and incoming `{errorCode: null, pricingCategory: 'service'}`; expected: `errorCode` 131026, `pricingCategory` `service`.
- [ ] CU-40 `apply-status.test.ts` — input: a stored failure detail `errorTitle` `T1`, then a `Failed` status with `errorTitle` null; expected: `errorTitle` stays `T1`.
- [ ] CU-42 `receive-channel-message.test.ts` — input: an agent reaction whose target has no channel id; expected: refused by the core with an error naming `reaction.message_id`; the sender is not called.
- ~~[ ] CU-43 `deliver-to-owner-channel.test.ts` — input: a template notice with `CoreDependencies.ownerLocale` = `en_US`; expected: the sender's `template` receives `locale` `en_US`.~~ (refresh R5: the locale is an input field)
- [ ] CU-43 `deliver-to-owner-channel.test.ts` — input: a template notice delivered with `ownerLocale` `en_US`; expected: the sender's `template` receives `locale` `en_US`.
- [ ] CU-44 `receive-channel-message.test.ts` — input: an entry whose `replyToChannelMessageId` is `wamid.X` (stored as message `M`), then one whose reply id is unknown, then a reaction on `wamid.X` and a reaction on an unknown id; expected: `replyToMessageId` is `M` for the first and `null` for the second; the first reaction's `targetMessageId` is `M`, routed by rule 2; the second keeps the channel id string as `targetMessageId` and routing sees no referenced message (R25).

## API unit

Runner: `pnpm --filter @zapbip/api test:unit` (Vitest 4.1.12, node). Fixtures are Meta's documented example bodies in `apps/api/test/fixtures/whatsapp/`.

### Signature and challenge (`whatsapp-signature.test.ts`, `whatsapp-challenge.test.ts`)

- [ ] AU-1 input: body `B`, header `sha256=` + HMAC-SHA-256 of `B` with `test-app-secret`; expected: `verifyWebhookSignature` true.
- [ ] AU-2 input: the same header over the body with its keys reordered (a re-serialised body); expected: false.
- [ ] AU-3 input: header missing; expected: false.
- [ ] AU-4 input: header with the right hex but without the `sha256=` prefix; expected: false.
- [ ] AU-5 input: a digest of another secret `other-secret`; expected: false.
- [ ] AU-6 input: a digest shorter than 64 hex characters; expected: false, no exception.
- [ ] AU-7 input: `mode` `subscribe`, `verifyToken` equal to the expected token, `challenge` `123456`; expected: status `200`, body `123456`, content type plain text.
- [ ] AU-8 input: `mode` `subscribe`, wrong token; expected: status `403`, body `null`.
- [ ] AU-9 input: `mode` `unsubscribe`, right token; expected: status `403`, body `null`.
- [ ] AU-10 input: `mode` `subscribe`, right token, `challenge` null; expected: status `403`, body `null`.
- [ ] AU-15 multibyte body `Olá 👋 — ação` signed over its UTF-8 bytes — expected: `verifyWebhookSignature` true.
- [ ] AU-16 the same digest checked against the body re-encoded through a JavaScript string with a lossy step — expected: false.
- [ ] AU-17 a digest of correct length over the body with one trailing newline added — expected: false.
- [ ] AU-18 a header with uppercase hex of the right digest — expected: false (the header format is lowercase hex).

### Inbound parser (`whatsapp-inbound-parser.test.ts`), one case per row of the inbound mapping

- [ ] AU-19 `text` fixture — expected: `Owner` entry with `kind` text and `text` as sent, `at` = `timestamp` × 1000.
- [ ] AU-20 `image` with caption fixture — expected: media content, `mediaKind` image, `mediaId` null before download, caption set, `sha256` carried in the download request.
- [ ] AU-21 `video` fixture — expected: media kind video.
- [ ] AU-22 `audio` fixture with `voice` absent — expected: media kind audio.
- [ ] AU-23 `audio` fixture with `voice: true` — expected: media kind voice.
- [ ] AU-24 `document` fixture with `filename` `relatorio.pdf` — expected: media kind document, `filename` `relatorio.pdf`.
- [ ] AU-25 `sticker` fixture with `animated: false` — expected: media kind sticker.
- [ ] AU-26 `location` fixture with floats `-23.5505` and `-46.6333` unquoted — expected: `latitude` -23.5505, `longitude` -46.6333 as numbers.
- [ ] AU-27 `contacts` fixture with one contact — expected: `contacts` with `name`, `phones`, `emails`, `organization`.
- [ ] AU-28 `reaction` fixture with emoji `👍` — expected: reaction `targetMessageId` = `context`'s wamid, `emoji` `👍`.
- [ ] AU-29 `reaction` fixture with no `emoji` key (removal) — expected: `emoji` null.
- [ ] AU-30 `interactive` `button_reply` fixture with id `q_1:0` — expected: choice with `optionId` `q_1:0`, `optionTitle` as sent.
- [ ] AU-27 `interactive` `list_reply` fixture with `description` — expected: choice with `optionId`, `optionTitle`; the description is carried (or ignored; the test asserts the field the core takes).
- [ ] AU-28 `button` quick-reply fixture with `context.id` — expected: `WindowOnly` entry with `at`; no content.
- [ ] AU-29 `unsupported` fixture with `errors[0].code` 131051 and `unsupported.type` `poll` — expected: `Unsupported` entry; `unsupportedType` `poll`.
- [ ] AU-30 any kind with `context.id` `wamid.X` — expected: `replyToChannelMessageId` `wamid.X`.
- [ ] Edge: `timestamp` `"1762430400"` — expected: `at` = `1762430400000`.
- [ ] Edge: `timestamp` absent — expected: parse throws `ZodError`, no entry produced.
- [ ] Edge: message without `from` — expected: parse throws, no entry produced.
- [ ] AU-31 Edge: `type` `order` (not in the table) — input: a message of that type; expected: parsed as `Unsupported` with `unsupportedType` `order`; nothing is thrown and nothing is dropped silently.
- [ ] AU-32 a message without `from` among two messages in one change — expected: the good message is parsed; the bad one is a rejected item with reason `inbound.unmapped`; no throw.
- [ ] AU-33 a change whose `field` is `account_alerts` — expected: no items; reason `notification.ignored_field` reported; no throw.
- [ ] AU-34 two changes, one with a foreign `phone_number_id` — expected: the foreign change is a rejected item with reason `inbound.foreign_number`; the other change is parsed (one number per change).
- [ ] AU-35 a message with `timestamp` `"abc"` next to a valid text — expected: the invalid one is rejected; the text is parsed.

### Status parser (`whatsapp-status-parser.test.ts`)

- [ ] AU-36 `sent` fixture — expected: status `Sent`, `detail` all null, `timestamp` = fixture seconds × 1000.
- [ ] AU-37 `delivered` fixture with `pricing` `{category: 'service', billable: false}` — expected: status `Delivered`, `pricingCategory` `service`, `billable` false.
- [ ] AU-38 `read` fixture — expected: status `Read`.
- [ ] AU-56 `played` fixture — expected: status null (A13), not thrown.
- [ ] AU-57 `failed` fixture with `errors[0]` code 131026 and title `Message undeliverable` — expected: status `Failed`, `errorCode` 131026, `errorTitle` `Message undeliverable`.
- [ ] AU-58 `statuses` with a `timestamp` of `"abc"` — expected: that status is a rejected item; the other statuses in the notification are parsed.
- [ ] Edge: `statuses` empty — expected: no status items.

### Media download (`whatsapp-media-download.test.ts`, fake Graph, in-memory bucket)

- [ ] AU-59 body whose base64 SHA-256 equals the webhook `sha256`, declared size equal to the body length — expected: `{stored: true}`; the bucket holds the object at `accounts/acc_a/media/<mediaId>`; the put used a fixed length stream.
- [ ] AU-60 body whose digest differs — expected: `{stored: false}`; the object written during the stream is deleted; the bucket is empty afterwards.
- [ ] AU-61 body longer than the declared size — expected: `{stored: false}`; the object is deleted.
- [ ] AU-62 `GET /{media-id}` returns `404` and the second `GET` returns metadata — expected: `{stored: true}`; the metadata was requested twice.
- [ ] AU-63 the download URL returns `404` twice after a refresh — expected: `{stored: false}`; the metadata was requested twice; no third request.
- [ ] AU-64 the download URL returns `500` — expected: the function throws a `Retriable` error that the route maps to `500` (WI-39); nothing stored.
- [ ] AU-65 the download times out after `GRAPH_REQUEST_TIMEOUT_MS` (fake timers) — expected: the function throws the same retriable error.
- [ ] AU-66 the download returns `302` to `https://evil.example.com/x` — expected: `{stored: false}`; the fake records no request to `evil.example.com`.
- [ ] AU-67 metadata `url` `https://lookaside.fbsbx.com@evil.com/x` — expected: `{stored: false}`; no request to `evil.com` carries an `Authorization` header.
- [ ] AU-68 metadata `url` `https://evil.com/.fbsbx.com/x` — expected: `{stored: false}`; no request to `evil.com` carries an `Authorization` header.
- [ ] AU-69 metadata `url` `https://media.fbsbx.com/x` — expected: allowed; the request carries the bearer header.
- [ ] AU-70 metadata `url` `http://lookaside.fbsbx.com/x` — expected: `{stored: false}`; no request made.
- [ ] AU-71 `file_size` 100 000 001 — expected: `{stored: false}`; no bytes read into the bucket.
- [ ] AU-72 Graph error `131052` on metadata — expected: `{stored: false}` (Unavailable, not a retry).
- [ ] Edge: media id — input: a `wamid` `wamid.HBg=`; expected: the mediaId is `med_` followed by 64 hex characters, and the same `wamid` yields the same id.

### Outbound builders (`whatsapp-outbound-builders.test.ts`), one case per row of the outbound mapping, body equal to the fixture

- [ ] AU-73 text `Olá` — expected: `{messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: {preview_url: false, body: 'Olá'}}` equal to `outbound/text.json`.
- [ ] AU-74 text with `https://zapbip.example/x` — expected: `preview_url` true.
- [ ] AU-75 text with reply to `wamid.R` — expected: `context: {message_id: 'wamid.R'}`.
- [ ] AU-76 buttons with three options, body 1 024 characters — expected: `interactive.type` `button`, three `reply` buttons with ids `<question_id>:<index>`, equal to `outbound/buttons.json`.
- [ ] AU-77 list with four options — expected: `interactive.type` `list`, one section, four rows with ids `<question_id>:<index>`, equal to `outbound/list.json`.
- [ ] AU-78 image with link and caption — expected: `{type: 'image', image: {link, caption}}`.
- [ ] AU-79 video, audio, document with filename — expected: the matching `{type, <type>: {...}}` each equal to its fixture.
- [ ] AU-80 sticker, static WebP 99 000 bytes — expected: `{type: 'sticker', sticker: {link}}`.
- [ ] AU-81 location with latitude 1.5 and longitude -2.25 — expected: `latitude` `"1.5"` and `longitude` `"-2.25"` (strings).
- [ ] AU-82 contacts with one card — expected: `{type: 'contacts', contacts: [{name: {formatted_name}, phones: [{phone}], emails: [{email}], org: {company}}]}`.
- [ ] AU-83 reaction on `wamid.T` with emoji `👍` — expected: `{type: 'reaction', reaction: {message_id: 'wamid.T', emoji: '👍'}}`.
- [ ] AU-84 reaction removal (emoji null) — expected: `emoji` `""`.
- [ ] AU-68 template `zapbip_agent_notice` pt_BR with parameters `Agente de teste`, `Mensagem de exemplo` — expected: `{type: 'template', template: {name, language: {code: 'pt_BR'}, components: [{type: 'body', parameters: [{type:'text', text}, {type:'text', text}]}]}}` equal to `outbound/template-notice-pt_BR.json`, and no `button` component.

### Outbound limits (`whatsapp-outbound-limits.test.ts`)

- [ ] AU-69 button title of 20 characters — expected: accepted. Title of 21 characters — expected: throws naming `interactive.action.buttons[0].reply.title`.
- [ ] AU-70 three reply buttons — expected: accepted. Four — expected: throws naming `interactive.action.buttons`.
- [ ] AU-71 button body of 1 024 characters — expected: accepted. 1 025 — expected: throws naming `interactive.body.text`.
- [ ] AU-72 list with 10 rows in total across sections — expected: accepted. 11 rows — expected: throws naming `interactive.action.sections`.
- [ ] AU-73 list row title of 24 characters — expected: accepted. 25 — expected: throws naming the row title field.
- [ ] AU-95 list section title of 25 characters — expected: throws naming `interactive.action.sections[0].title`.
- [ ] AU-96 list row description of 72 — accepted; 73 — throws naming the description.
- [ ] AU-97 list row id of 200 characters — accepted; 201 — throws naming the row id; a button id of 257 characters — throws naming the reply id.
- [ ] AU-98 text body of 4 096 characters — accepted; 4 097 — throws naming `text.body`.
- [ ] AU-99 reaction without `message_id` (empty string) — expected: throws naming `reaction.message_id`.
- [ ] AU-100 `assertOutboundMedia` table: `image/jpeg` 5 000 000 bytes accepted; `image/jpeg` 5 000 001 refused with `MediaRejected` naming the kind and MIME; `image/gif` refused naming MIME `image/gif`.
- [ ] AU-101 `video/3gpp` 16 000 000 accepted; `video/webm` refused.
- [ ] AU-102 `audio/ogg` 16 000 000 accepted; `audio/wav` refused.
- [ ] AU-103 `application/pdf` 100 000 000 accepted; 100 000 001 refused; `application/zip` refused.
- [ ] AU-104 sticker `image/webp` 100 000 bytes accepted; 100 001 refused naming the sticker limit; `image/png` sticker refused.
- [ ] AU-105 media with `mimeType` null and `sizeBytes` null — expected: accepted (A11: Meta enforces).

### Template sanitiser and definitions (`whatsapp-template-sanitiser.test.ts`, `whatsapp-templates.test.ts`)

- [ ] AU-106 input `"linha\numa"` with fallback `uma mensagem` — expected: `"linha uma"`.
- [ ] AU-107 input `"a\tb"` — expected: `"a b"`.
- [ ] AU-108 input `"  a     b  "` — expected: `"a b"` (trimmed and collapsed).
- [ ] AU-109 input `"   \n  "` (whitespace only) with fallback `a message` — expected: `"a message"`.
- [ ] AU-110 input `""` with fallback `uma mensagem` — expected: `"uma mensagem"`; the fallback is the caller's copy, never a literal in the adapter.
- [ ] AU-111 input of 61 ASCII characters — expected: the first 60 characters.
- [ ] AU-112 input `"ação 👋 ok"` — expected: no lone surrogate in the result; length at most 60 UTF-16 units.
- [ ] AU-117 every registered template body (both templates, both languages) — expected: `assertTemplateBodyHasFixedWords` does not throw.
- [ ] AU-113 `assertTemplateBodyHasFixedWords` input `'{{1}} tem uma pergunta'` — expected: throws (parameter at the start).
- [ ] AU-114 `assertTemplateBodyHasFixedWords` input `'Ola {{1}}'` — expected: throws (parameter at the end).
- [ ] AU-115 `assertTemplateBodyHasFixedWords` input `'Você tem {{1}} para ler'` — expected: accepted.
- [ ] AU-116 both template body maps — expected: each body equals the spec text exactly; each quick reply is `Abrir`, `Open`, `Responder` or `Reply`.
- [ ] AU-96 `OWNER_LOCALE_TO_LANGUAGE_CODE` — expected: `pt_BR` → `pt_BR`, `en_US` → `en_US`; the key set equals the `OwnerLocale` values.

### Error table (`whatsapp-channel-error-mapping.test.ts`), one case per row

- [ ] AU-97 status 400, code 131047, session send — expected: `ChannelErrorKind.WindowClosed`, `errorCode` 131047.
- [ ] AU-98 codes 130429, 80007, 4, 131056 — expected: each `RateLimited`; the message says the channel is busy.
- [ ] AU-123 codes 131048 and 368 — expected: each `Restricted`.
- [ ] AU-124 code 131026 — expected: `DeliveryFailed` naming the kind.
- [ ] AU-101 code 131009 — expected: `ReactionRejected`, message names `reaction.message_id`.
- [ ] AU-102 codes 131053 and 131051 — expected: `MediaRejected`, message names the kind and the MIME type.
- [ ] AU-103 code 133010 — expected: `Restricted` (A10).
- [ ] AU-104 code 131021 — expected: `DeliveryFailed` (A10).
- [ ] AU-105 code 190 with status 401 — expected: `Auth`.
- [ ] AU-106 status 500 with no code, and an abort (timeout) — expected: `Timeout`.
- [ ] AU-107 unknown code 999999 on a session send — expected: `Unknown`.
- [ ] AU-108 unknown code 132000 on a template send — expected: `TemplateRejected` (A10).
- [ ] AU-109 code 131048 on a template send — expected: `Restricted` (the table row wins over the template default).

### Graph client and env (`whatsapp-graph-client.test.ts`, `whatsapp-read-whatsapp-env.test.ts`)

- [ ] AU-110 `post({path: '/1000000000000001/messages', body})` with base `http://127.0.0.1:4011` — expected: request URL `http://127.0.0.1:4011/v24.0/1000000000000001/messages`, header `Authorization: Bearer test-access-token`, JSON body equal to the input.
- [ ] AU-111 fetcher that never resolves — expected: rejects after 10 000 ms (fake timers), the sender maps it to `Timeout` (asserted in AU-106).
- [ ] AU-112 `download({url: 'https://evil.example.com/x'})` — expected: throws naming the host, the fetcher is not called.
- [ ] AU-113 `download({url: 'https://lookaside.fbsbx.com/x'})` — expected: fetcher called with the bearer header.
- [ ] AU-114 env with every variable present — expected: `readWhatsAppEnvironment` returns the five values.
- [ ] AU-115 env without `WHATSAPP_GRAPH_BASE_URL` — expected: throws `Error` whose message contains `WHATSAPP_GRAPH_BASE_URL`; no default value is returned.
- [ ] AU-116 env without `META_APP_SECRET` — expected: throws naming `META_APP_SECRET`.
- [ ] AU-117 `download({url})` for a host in the allowlist whose response is `302` — expected: the response is returned as is; no second request is made (`redirect: 'manual'`).

### Copy and operator log (`whatsapp-copy.test.ts`, `whatsapp-operator-log.test.ts`)

- [ ] AU-118 `WHATSAPP_COPY` (pin) — expected: both locales have all five `OwnerCopyKey` values, non-empty, and the two spec texts equal the spec.
- [ ] AU-119 `ListButtonLabel` for each locale — expected: at most 20 characters (`Ver opções`, `See options`).
- [ ] AU-120 `ListSectionTitle` for each locale — expected: at most 24 characters.
- [ ] AU-121 `logOperatorEvent({event: OperatorEvent.ChannelRestricted, fields: {[OperatorLogField.ErrorCode]: 131048}})` — expected: one `console.error` line that parses as JSON with `event` `channel.restricted` and `error_code` 131048, and no other key.
- [ ] AU-122 `logOperatorEvent` with fields keyed `OperatorLogField.TemplateName` and `LanguageCode` — expected: the line has exactly those keys, with the values given.
- [ ] Edge: the field keys are enum values — expected: a compile-time check (`expectTypeOf`) rejects a free-text key such as `'phone'`.

### Owner recipients and reply targets in the sender (`whatsapp-outbound.test.ts` is integration; the unit cases here use a fake directory)
- [ ] AU-123 `createCloudApiMessageSender` with a `findOwnerByAccountId` that returns `null` for the account — expected: `session` throws `ChannelError` `DeliveryFailed` naming the owner, no Graph call.
- [ ] AU-124 `template({kind: Notice, parameters})` with owner locale `en_US` — expected: the request body's `language.code` is `en_US`.

## Worker integration

Runner: `pnpm --filter @zapbip/api test:integration` (`@cloudflare/vitest-pool-workers`, real workerd, D1, R2 and Durable Objects bound from `wrangler.jsonc`). Fake Graph is the HTTP server of `apps/api/test/support/fake-graph.ts` on port `4012` (R30; `fetchMock` no longer exists in the pool). Each test seeds its own account with slice 1's `seedConnection` and `seedOwnerIdentity({accountId, phone, ownerLocale})` (`phone` is the `wa_id`), and `idFromName(accountId)`.

### D1 and repository (`d1-owner-directory-channel.test.ts`, `d1-message-index-channel.test.ts`, `d1-channel-restrictions.test.ts`)

- ~~[ ] WI-1 input: owner row `wa_id` `5511900000001`, `account_id` `acc_a`, locale `pt_BR`; `findByWaId({waId: '5511900000001'})` — expected: `{accountId: 'acc_a', locale: 'pt_BR'}` as `OwnerLocale.PortugueseBrazil`.~~ (refresh: R11: slice 1's finder)
- [ ] WI-1 input: owner row `wa_id` `5511900000001`, `account_id` `acc_a`, locale `pt_BR`; `findOwnerByPhone({database, phone: '5511900000001'})` — expected: `{accountId: 'acc_a', ownerLocale: 'pt_BR'}` as `OwnerLocale.PortugueseBrazil`.
- ~~[ ] WI-2 input: `findByWaId({waId: '5511900000099'})` (no row) — expected: `null`.~~ (refresh: R11)
- [ ] WI-2 input: `findOwnerByPhone` for `5511900000099` (no row) — expected: `null`.
- ~~[ ] WI-3 input: `findOwnerByAccountId({accountId: 'acc_a'})` — expected: `{waId: '5511900000001', locale: 'pt_BR'}`.~~ (refresh: R11)
- [ ] WI-3 input: `findOwnerByAccountId({database, accountId: 'acc_a'})` — expected: `{waId: '5511900000001', ownerLocale: 'pt_BR'}`.
- ~~[ ] WI-4 input: an account whose stored `locale` value is not an `OwnerLocale` member (the test writes it through a raw statement on a scratch database); expected: reading it throws naming the value; no default is returned.~~ (refresh: R11: both finders)
- [ ] WI-4 input: an owner row whose stored `locale` is not an `OwnerLocale` member (written through a raw statement); expected: `findOwnerByPhone` and `findOwnerByAccountId` both throw naming the value; no default is returned.
- ~~[ ] WI-5 input: `message_index.record({channelMessageId: 'wamid.1', accountId: 'acc_a'})` then the same with `acc_b`; `findAccountId('wamid.1')` — expected: `acc_a`; the second write changed nothing.~~ (refresh: R11: slice 1's class)
- [ ] WI-5 input: `new D1MessageIndex({database}).record({id: 'wamid.1', accountId: 'acc_a', at: T})` then the same with `acc_b`; `find({id: 'wamid.1'})` — expected: the first returns `true`, the second `false`; `find` returns `{accountId: 'acc_a'}`.
- ~~[ ] WI-6 input: `findAccountId({channelMessageId: 'wamid.unknown'})` — expected: `null`.~~ (refresh: R11)
- [ ] WI-6 input: `find({id: 'wamid.unknown'})` — expected: `null`.
- ~~[ ] WI-7 input: `channelRestrictions.record({errorCode: 131048, restrictedAt: T})`, then `find()` — expected: `{errorCode: 131048}`; before any record, `find()` is `null`.~~ (refresh: R12)
- [ ] WI-7 input: `new D1ChannelRestrictions({database}).record({errorCode: 131048, restrictedAt: T})`, then `findActive({now: T})` — expected: `{errorCode: 131048}`; before any record, `findActive` is `null`; at `T + RESTRICTION_TTL_MS + 1` it is `null` again.

### Durable Object (`account-inbox-channel.test.ts`)

- [ ] WI-8 input: `receiveChannelMessage` with a text entry for `wamid.A` — expected: `{ok: true, value: {duplicate: false}}`, one message with `channel_message_id` `wamid.A`, window open at the entry's `at`.
- [ ] WI-9 input: the same call again — expected: `{ok: true, value: {duplicate: true}}`; one message.
- [ ] WI-10 input: a fault injected inside the transaction before the message insert — expected: `{ok: false}`; no receipt for `wamid.A`; the next call stores one message.
- [ ] WI-11 input: the waker throws after the commit — expected: the call fails; the message exists; a retry returns `{duplicate: true}`; the message count is 1.
- [ ] WI-12 input: restart (a new instance over the same storage) after WI-8, then the duplicate — expected: `{duplicate: true}`.
- [ ] WI-13 input: a receipt `wamid.OLD` at T, `runDurableObjectAlarm` at T + `RECEIPT_RETENTION_MS` + 1 — expected: `wamid.OLD` gone; a receipt at T + 1 kept.
- [ ] WI-14 input: a `Sending` row claimed at T, alarm at T + `SENDING_STALE_MS` + 1 — expected: the row is `Queued`.
- [ ] WI-15 input: `applyChannelStatus` for a `wamid` the account sent — expected: delivery changes per the rule; the detail is stored, nulls not written over values.
- [ ] WI-16 input: `applyChannelStatus` for a `wamid` the account never sent — expected: `{ok: true, value: {applied: false}}`, no write.
- ~~[ ] WI-17 input: the object created without a name — expected: the constructor throws `AccountInbox must be created with idFromName`.~~ (refresh: R16)
- [ ] WI-17 input: the object created without a name — expected: the constructor fails with slice 1's `AccountInbox id has no name`.
- ~~[ ] WI-17a input: `WHATSAPP_ACCESS_TOKEN` set — expected: the Cloud API sender is selected.~~ (refresh: R15)
- [ ] WI-17a input: `DevAccountInbox` with `WHATSAPP_ACCESS_TOKEN` set — expected: the Cloud API sender is selected.
- ~~[ ] WI-17b input: token absent and a fake registered by `registerDevelopmentSender` — expected: the fake is selected.~~ (refresh: R15)
- [ ] WI-17b input: `DevAccountInbox` with the token absent — expected: the fake sender is selected.
- ~~[ ] WI-17c input: token absent and no fake registered — expected: the send throws naming the missing variable; no fallback.~~ (refresh: R15)
- [ ] WI-17c input: the production `AccountInbox` with the token absent — expected: the send throws naming the missing variable; no fallback.

## Worker integration: webhook and outbound

These run through `SELF.fetch` against the real route and the Durable Object. They need W2, W3 and W4 merged. Faults are injected through the development-only test hook of the Durable Object, never a production path.

### Inbound route (`whatsapp-webhook.test.ts`)

- [ ] WI-18 input: `GET /webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=777` — expected: `200`, body `777`.
- [ ] WI-19 input: the same with `hub.verify_token=wrong` — expected: `403`, empty body.
- [ ] WI-20 input: a signed text from `5511900000001` with body `Oi` — expected: `200`; `acc_a` has one message `Oi` with `sender: 'owner'`, `verified: true`, `readByAgent` false; the window is open.
- [ ] WI-21 input: the same signed webhook twice — expected: both `200`; one message.
- [ ] WI-22 input: a body with a signature over different bytes — expected: `401`, body `{"error":"unauthorized"}`; nothing stored.
- [ ] WI-23 input: a signed body that is not JSON — expected: `400`; nothing stored.
- [ ] WI-24 input: a body of 3 145 729 bytes with `Content-Length` and a valid signature — expected: `413`; nothing parsed.
- [ ] WI-25 input: the same body sent chunked (no `Content-Length`) — expected: `413`; the stream is cut at the limit.
- [ ] WI-26 input: a signed body of exactly 3 145 728 bytes — expected: not `413`; the response is `200` (the notification is valid).
- [ ] WI-27 input: a change with `phone_number_id` `2000000000000002` — expected: `200`; nothing stored; `inbound.foreign_number` logged with no phone number.
- [ ] WI-28 input: a text from `5511900000099` (no owner row) — expected: `200`; nothing stored; `inbound.unmapped` logged with no phone number.
- [ ] WI-29 input: one change with a message of unknown type `order` and one owner text in another change — expected: `200`; the text is stored; the owner receives one session text equal to `unsupportedKind` copy; no agent message is stored for the `order`.
- [ ] WI-30 input: one message without `from` and one owner text in the same change — expected: `200`; the text is stored; `inbound.unmapped` logged once.
- [ ] WI-31 input: two changes, one with a foreign `phone_number_id` and one with ours — expected: `200`; ours stored; the foreign one logged, not stored.
- [ ] WI-32 input: a change with `field` `account_alerts` — expected: `200`; `notification.ignored_field` logged; nothing stored.
- [ ] WI-33 input: the DO commit fails with an injected error on the first attempt, then Meta retries — expected: first `500`; no receipt; the retry returns `200` and stores one message.
- [ ] WI-34 input: the R2 put fails on an image (fault) — expected: `500`; no message stored; the retry stores one message.
- [x] WI-35 input: signed image with caption `Foto`, bytes matching `sha256` — expected: `200`; the message is an image with caption `Foto` and `mediaId` `med_…`; the object is at `accounts/acc_a/media/<mediaId>` with a fixed `Content-Length` recorded by the fake. (developer: d93dc2f)
- [x] WI-36 input: the same image with bytes whose digest differs — expected: `200`; stored as Unavailable; the owner gets the `mediaUnavailable` copy in their locale; the object is absent. (developer: d93dc2f)
- [x] WI-37 input: the download URL returns `404` once, the metadata refresh succeeds, the second download matches — expected: `200`; stored with media. (developer: d93dc2f)
- [x] WI-38 input: the download URL returns `404` twice — expected: `200`; Unavailable; no `500`. (developer: d93dc2f)
- [x] WI-39 input: the download URL returns `500` — expected: `500`; nothing stored; a retry after the fake recovers stores once. (developer: d93dc2f)
- [x] WI-40 input: the download never answers within `GRAPH_REQUEST_TIMEOUT_MS` — expected: `500`; nothing stored. (developer: d93dc2f)
- [x] WI-41 input: the download returns `302` to a foreign host — expected: `200`; Unavailable; the fake records no request to the foreign host. (developer: d93dc2f)
- [x] WI-42 input: metadata `url` `https://lookaside.fbsbx.com@evil.com/x` — expected: `200`; Unavailable; no request to `evil.com`. (developer: d93dc2f)
- [x] WI-43 input: metadata `url` `https://evil.com/.fbsbx.com/x` — expected: `200`; Unavailable; no request to `evil.com`. (developer: d93dc2f)
- [ ] WI-44 input: a voice note (`audio` with `voice: true`) — expected: `200`; media kind `voice`.
- [ ] WI-45 input: a reaction `👍` on an agent message `M` while the window is closed — expected: `200`; routed to `M`'s agent; the window stays closed.
- [ ] WI-46 input: a quick-reply `button` tap with `context.id` the wamid of a sent template, with one queued message — expected: `200`; no message stored; the window opens; the queued message is sent once.
- [ ] WI-47 input: an `unsupported` message with type `poll` — expected: `200`; window open; the owner gets one session text equal to `unsupportedKind`.
- [ ] WI-48 input: a text with `context.id` of agent message `M` — expected: `200`; `replyToMessageId` is `M`'s id; routed to `M`'s agent (rule 2).
- [ ] WI-49 input: a list reply `q_1:1` to an open question — expected: `200`; answered with option index 1 (rule 1).

### Status route (`whatsapp-status.test.ts`)

- [ ] WI-50 input: a status for an unknown `wamid` whose `timestamp` is now — expected: `503`; nothing stored; Meta can retry.
- [ ] WI-51 input: a status for an unknown `wamid` whose `timestamp` is 11 minutes old — expected: `200`; `status.unindexed` logged; nothing stored.
- [x] WI-52 input: a `read` status for `wamid.S` sent by `acc_a` — expected: `200`; delivery `Read`. (developer: f5b827b)
- [x] WI-53 input: `delivered`, `read`, `delivered` for `wamid.S` — expected: final delivery `Read`. (developer: f5b827b)
- [x] WI-54 input: `failed` after `read` for `wamid.S` — expected: `200`; delivery stays `Read`; `status.failed.ignored` logged. (developer: f5b827b, fix 619aafb)
- [x] WI-55 input: `failed` with error 131026 and title `Message undeliverable` after `sent` — expected: delivery `Failed`; `error_code` 131026 and `error_title` stored. (developer: f5b827b)
- [ ] WI-56 input: a `played` status — expected: `200`; `status.ignored` logged; delivery unchanged.
- [x] WI-57 input: a `delivered` status with pricing `service`, billable false — expected: `pricing_category` and `billable` stored; a later `read` with no pricing keeps them. (developer: f5b827b)

### Outbound (`whatsapp-outbound.test.ts`)

- [ ] WI-58 input: `send_message` text `Olá` with the window open — expected: one `POST /v24.0/1000000000000001/messages` equal to `outbound/text.json`; the returned `wamid` is stored and `message_index` maps it to `acc_a`.
- [ ] WI-59 input: the fake returns `131047` for the session send — expected: the window is closed; the message is `Queued`; exactly one template request equal to `outbound/template-notice-pt_BR.json`; a second send in the same closed window produces no second notice.
- [ ] WI-60 input: the fake returns `131009` for a reaction — expected: the tool error names `reaction.message_id`; the message is `Failed`.
- [ ] WI-61 input: the fake returns `131053` for an image of `image/jpeg` — expected: `MediaRejected`; the error names `image` and `image/jpeg`.
- [ ] WI-62 input: the fake returns `130429` — expected: `Failed`; the error says the channel is busy; no retry request.
- [ ] WI-63 input: the fake returns `131048` once, then a second send — expected: the first is `Restricted` with a `channel_restrictions` row; the second is refused with `Restricted` and the fake logs zero requests for it.
- [ ] WI-64 input: a restriction row older than `RESTRICTION_TTL_MS` — expected: the next send calls the fake.
- [ ] WI-65 input: the fake returns `368` — expected: as WI-63 with `error_code` 368.
- [ ] WI-66 input: the fake returns `500` — expected: `Timeout`-kind failure; the message is `Failed`; no retry request.
- [ ] WI-67 input: the fake returns `190` with status `401` — expected: `Auth`; `channel.auth` logged at error level with no token.
- [ ] WI-68 input: template notice with owner locale `en_US` — expected: the request equals `outbound/template-notice-en_US.json`.
- [ ] WI-69 input: template with the fake returning `132000` — expected: `TemplateRejected`; `channel.template_rejected` names the template and language.
- [ ] WI-70 input: an outbound list question with four options for `q_1` — expected: the request equals `outbound/list.json`; row ids `q_1:0` to `q_1:3`; the button label and section title equal the owner's copy.
- [ ] WI-71 input: an outbound image stored in R2 — expected: the link is `https://api.test/m/acc_a/<mediaId>?exp=…&sig=…`, built from `PUBLIC_ORIGIN` and the signed link.
- [ ] WI-72 input: a template parameter whose preview is only whitespace — expected: the parameter equals the `templatePreviewFallback` copy of the locale.

### Isolation (`whatsapp-outbound.test.ts`, `account-inbox-channel.test.ts`)

- [ ] WI-73 input: owners `5511900000001` (acc_a) and `5511900000002` (acc_b) each send one text — expected: acc_a's inbox holds only its text; acc_b's only its text.
- [ ] WI-74 input: a status for `wamid.A` (sent by acc_a) delivered in a notification of acc_b's phone — expected: the index maps `wamid.A` to acc_a; acc_a's message is updated; acc_b's inbox is unchanged.

## E2E

Runner: `ZAPBIP_E2E=1 pnpm --filter @zapbip/api test:e2e`. The global setup starts the fake Graph on `127.0.0.1:4011` and `wrangler dev` (the development entry, top-level block) with `--var META_APP_SECRET:test-app-secret --var WHATSAPP_VERIFY_TOKEN:test-verify-token --var WHATSAPP_ACCESS_TOKEN:test-access-token --var WHATSAPP_PHONE_NUMBER_ID:1000000000000001`. The E2E posts signed webhooks and talks to the MCP endpoint of a connection.

- [ ] E2E-1 steps: post a signed owner text from `5511900000001`; expected: the MCP `check_inbox` of the connection returns that text with `sender` `owner` and `verified` true.
- [x] E2E-2 steps: post a signed voice note; expected: `check_inbox` returns a media item with `media_kind` `voice` and a `url` that `GET`s the bytes with `200`. (developer: 6fe1818)
- [ ] E2E-3 steps: post a signed reaction on the agent's last message; expected: the agent receives the reaction and its `emoji`.
- [ ] E2E-4 steps: post a signed list reply `q_1:1` for an open list question; expected: `wait_for_reply` returns the answer with option index 1.
- [ ] E2E-5 steps: the agent calls `ask` with four options (list); expected: the fake Graph's log holds one request whose body equals `outbound/list.json` with the question's id.
- [ ] E2E-6 steps: the agent sends a text outside the window (the test moves the clock by `advance_ms` past the window through the development route); expected: the message is `queued`, the fake Graph log holds one template request equal to `outbound/template-notice-pt_BR.json`.
- [ ] E2E-7 steps: after E2E-6, post a signed quick-reply tap; expected: the window opens, the queued message is sent to the fake Graph once, and the agent's `send_message` result is `sent` on the next check.
- [ ] E2E-8 steps: post a signed `read` status for the wamid of E2E-5's request; expected: the MCP `get_messages` shows that message with `delivery` `read`.
- [ ] Edge: the same signed webhook of E2E-1 posted twice — expected: one message in `check_inbox`.

Recorded for the PR with the simulator screen walk (`check-ui`) on the development entry.

## Docs and shape

- [ ] DOC-1 `pnpm --filter @zapbip/docs exec mint broken-links` — expected: exit code 0.
- [ ] DOC-2 `tools/repository-shape/src/whatsapp-docs.test.ts` — input: the two pages; expected: both exist and are in the `docs.json` group of agent-inbox-core.
- [ ] DOC-3 input: `concepts/whatsapp-channel.mdx` — expected: it states every media size limit, the button and list limits and the reaction rule of the spec's tables, and no line says a limit that differs from the code's constant.
- [ ] DOC-4 input: `concepts/owner-notices.mdx` — expected: it names both templates and the quick-reply texts `Abrir`, `Open`, `Responder`, `Reply`, and says the notice arrives before the real content.
- [ ] DOC-5 `pnpm --filter @zapbip/repository-shape test:unit` — expected: exit code 0 with the root entries unchanged.

## Security checks

- [ ] SEC-1 AU-2, AU-6, WI-22 — input: a digest over re-serialised JSON, and a short digest; expected: `401`, nothing parsed.
- [ ] SEC-2 the media-download host cases, WI-41 to WI-43 — input: foreign hosts, userinfo and path tricks, redirects; expected: no request with an `Authorization` header reaches any host but the allowlisted one.
- [ ] SEC-3 WI-27, WI-28 — input: unmapped and foreign-number webhooks; expected: operator log lines contain no phone number and no message body.
- [ ] SEC-4 WI-63, WI-67 — input: a restricted send and an auth error; expected: no token, secret or phone number appears in any operator log line.
- [ ] SEC-5 WI-22 — input: a missing header and a wrong digest; expected: the two response bodies are byte-identical, `{"error":"unauthorized"}`.
- [ ] SEC-6 WI-74 — input: acc_b's notification naming acc_a's `wamid`; expected: acc_b's inbox unchanged.
- [ ] SEC-7 WI-73 — input: two owners' texts; expected: no account reads the other's message.
- [ ] SEC-8 AU-115 — input: production env without `WHATSAPP_GRAPH_BASE_URL`; expected: throws naming it; no fallback host.
- [ ] SEC-9 AU-123 — input: an account with no owner row sends; expected: refused, no Graph call.
- [ ] SEC-10 AU-107, AU-109 — input: unknown codes; expected: never a success.
- [ ] SEC-11 the media-download `http` case — input: an `http` media URL; expected: refused.
- [ ] SEC-12 WI-24, WI-25 — input: a 3 MB + 1 body with and without `Content-Length`; expected: `413` before any JSON parse.
- [ ] SEC-13 WI-35 — input: a stored image; expected: the R2 key starts with `accounts/acc_a/`, so one account's prefix cannot address another's media.
- [ ] SEC-14 the media-download `http` case, the signature multibyte case — input: a multibyte body signed over its UTF-8 bytes; expected: accepted only when the digest is over the UTF-8 bytes.

## Production build

- [ ] PB-1 `wrangler deploy --dry-run --outdir <scratch dir>` (the top-level block is production since slice 1's last merge) — expected: exit code 0; the bundle contains no `127.0.0.1:4011`.
- [ ] PB-2 the same bundle — expected: no fixture marker `fixture-marker-whatsapp`.
- ~~[ ] PB-3 the same bundle — expected: no call site of `registerDevelopmentSender`; no import of `development-sender`.~~ (refresh: R15)
- [ ] PB-3 the same bundle — expected: no import of `fake-whatsapp-sender`, no `DevAccountInbox` and no `createSender` override.
- [ ] PB-4 the production entry with `WHATSAPP_GRAPH_BASE_URL` absent — expected: the first outbound send throws naming the variable.

## Owner-run (outside the gate)

These need the owner's Meta account or the live sandbox number. Agents never log in anywhere, so these stay open in the PR until the owner runs them; `deploy-readiness` holds the runbook.

- [ ] OR-1 Quick-reply button probe: submit `zapbip_agent_notice` with its quick reply, send one notice to the sandbox number, tap `Abrir` / `Open`, then send a session text. Expected: the session text is sent without `131047`, so the tap opened the window. Record the outcome in the spec's open-questions table.
- [ ] OR-2 Submit `zapbip_agent_notice` and `zapbip_agent_question` in both languages, UTILITY, with the exact body and quick-reply texts of the spec and the fictional samples (`Agente de teste`, `Mensagem de exemplo`, `Pergunta de exemplo`, `Test agent`, `Example message`, `Example question`). Expected: four approvals.
- [ ] OR-3 Reaction probe: after 24 h of owner silence, the owner reacts to an agent message. Expected: the observed effect on the window is recorded in the spec's open-questions table.
- [ ] OR-4 `131047` probe: a session send after 24 h of silence. Expected: `131047`, the `WindowClosed` path runs, and the notice reaches the phone.
- [ ] OR-5 Hash encoding probe: download a real media from the sandbox and compare Meta's `sha256` with the base64 and the hex SHA-256 of the bytes. Expected: exactly one encoding matches; A15 is confirmed or corrected in the spec.

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: a failure after the commit never loses the message and never duplicates it on retry — attack: WI-11 and CU-18b with a waker throw, then a Meta retry; result: `refuted | held`.
- [ ] Claim 2: a queued message is never sent twice when two webhooks arrive together — attack: CU-24c with two concurrent flushes and a gated sender; result: `refuted | held`.
- [ ] Claim 3: no bearer token reaches a foreign host — attack: WI-41, WI-42, WI-43 and the media-download host cases; result: `refuted | held`.

## Coverage honesty

What is not tested and why.

- Meta's live behaviour (window facts, template approval, `131047` timing, the hash encoding) — needs the owner's number; OR-1 to OR-5.
- Meta's rate limits (throughput page not fetched) — only the error codes are tested.
- Animated stickers — not detected (A12); the 100 KB limit is the only check.
- The media host allowlist against Meta's live hosts — tested against the recorded fixture host only (A14).
- Atomicity of `commitChannelInbound` is proven with injected faults inside one isolate, not against a real storage failure.
- Concurrency across isolates: CU-24c covers one isolate; two Durable Object instances never share an account, so the claim holds by construction, not by a multi-isolate test.
- The 503 retry schedule of Meta is not tested; the test proves only what the Worker returns.
- The operator clearing of a restriction before its TTL — the runbook is `deploy-readiness`.
- Policy risk of general-purpose AI providers (spec §Policy risk) — a business risk for the owner, not a test.
