# WhatsApp Cloud channel

**Status:** In review
**Tier:** 🔴
**Owner approval:** approved 2026-11-06 (owner delegated)
**ADRs:** [0012](../../adr/0012-owner-identity-by-wa-id-on-the-shared-number.md), [0013](../../adr/0013-webhook-acknowledged-after-a-durable-commit-and-deduplicated-by-message-id.md), [0014](../../adr/0014-inbound-media-stored-in-r2-at-webhook-time.md); builds on [0006](../../adr/0006-one-secret-per-connection-in-the-mcp-url.md), [0007](../../adr/0007-a-durable-inbox-and-a-wake-ladder.md), [0008](../../adr/0008-a-pure-core-behind-ports.md), [0009](../../adr/0009-cloudflare-workers-with-one-durable-object-per-account.md), [0010](../../adr/0010-public-docs-on-mintlify.md), [0011](../../adr/0011-the-24-hour-window-queues-and-sends-one-notice.md)
**Not changing:** the core's rules: routing, the 24-hour window arithmetic, `ask` idempotency, answers bound to `question_id`, validation limits, the queue and the one-notice rule. The core gains only the additions this slice lists in its plan (section Core contract additions, merged into `core-contract-additions.md` by the orchestrator): one additive fact input (a channel-reported closed window, see Interfaces), two outbound delivery states (`Delivered`, `Read`), the status use case, `openWindow`, `receiveChannelMessage`, the unavailable media source and the release of stale send claims in the sweep. Nothing outside `apps/api`, `libs/core` and `libs/types` (those additions only), `apps/docs`, the root gate list and the indexes changes.

## Problem

`agent-inbox-core` runs against a fake WhatsApp. This slice replaces the fake with the Meta WhatsApp Cloud API, so an owner's real phone can send and receive every kind the core defines, and so the owner's agents reach the owner's real WhatsApp through one shared official number.

Three facts from the research shape the slice:

- Meta's inbound webhooks are unauthenticated except for an HMAC signature, and Meta retries them. Duplicates and out-of-order statuses are normal, not exceptional.
- Media download URLs expire after 5 minutes, so inbound bytes must be stored when the webhook arrives.
- Outside the 24-hour window only approved templates may be sent, and Meta's error `131047` is the signal that the window is closed on Meta's side. The core must be able to learn that fact.

## Goals

1. An inbound webhook route that verifies the GET challenge and the `X-Hub-Signature-256` HMAC, and maps every inbound kind in the table below to the core's `Message`.
2. `CloudApiMessageSender` implementing the core's `MessageSender` port: `session` for every outbound kind, `template` for the two owner notices.
3. The inbound media download into R2 (`MediaStore`), with the integrity check and the retry rule.
4. Idempotent inbound handling and a status handler that updates `delivery` for outbound messages.
5. Two approved-for-submission WhatsApp templates, one for a message notice and one for a question notice, each in `pt_BR` and `en_US`.
6. A failure table that maps every Meta error this slice meets to one core outcome.
7. The owner's window fact reported from the channel: a `131047` closes the window and the message queues.
8. Mintlify pages for the channel, its limits and the owner's notices.
9. Tests built on a recorded-fixture fake Graph API. No real credentials appear in any test.

## Non-goals

- Account creation, the owner's phone proof and the `owner_identities` writes. Those belong to `accounts-and-keys`. This slice reads the table and seeds it for development.
- The Meta setup runbook, `.env.example` entries, `wrangler` environments and a live smoke test against Meta. They belong to `deploy-readiness`.
- Webhook wake, the local connector and scheduled wake. They belong to later slices.
- Meta's Resumable Upload API, media templates with headers, flows, calls and Click-to-WhatsApp referrals.
- Automatic retry of failed outbound sends. A failed send is recorded and reported; retry policy is a later decision.
- Animated stickers outbound.

## Design

### Platform facts (cited)

| Fact | Source |
|---|---|
| Webhook GET: `hub.mode=subscribe`, `hub.verify_token`, `hub.challenge`; respond with the challenge | [Webhooks getting started](https://developers.facebook.com/docs/graph-api/webhooks/getting-started) |
| `X-Hub-Signature-256: sha256=<digest>` over the payload with the app secret; "you should" validate it | [Webhooks getting started](https://developers.facebook.com/docs/graph-api/webhooks/getting-started) |
| Respond `200` to every notification; duplicates happen; retries for up to 7 days; payloads up to 3 MB | [Webhooks overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview). The [payload page](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples) says 36 hours. This spec designs for 7 days. |
| Envelope: `entry[].changes[].value` with `metadata.phone_number_id`, `contacts[]`, `messages[]` or `statuses[]` | [Payload examples](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples) |
| Status values: `sent`, `delivered`, `read`, `played`, `failed`; failed carries `errors[]` with `code`, `title`, `message`, `error_data.details`, `href`; a message is `read` only after `delivered`, and `delivered` may be skipped | [Status reference](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/status) |
| `pricing` appears on `sent` or on `delivered`/`read`, not both; `conversation` only on `sent` and `delivered`/`read`, and from v24.0 only for free entry-point conversations | [Status reference](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/status) |
| Inbound `messages[]` common fields: `from`, `from_user_id`, `id`, `timestamp` (Unix seconds as a string), `type`, `context` | [Payload examples](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples), [Image](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/image) |
| Inbound shapes: text `text.body`; image `image{id,mime_type,sha256,caption}`; document adds `filename`; audio `audio{id,mime_type,sha256,voice}`; sticker `sticker{id,mime_type,sha256,animated}`; location `location{latitude,longitude,name,address,url}` with unquoted floats; contacts `contacts[]` with `name`, `phones`, `emails`, `org`; reaction `reaction{message_id,emoji}`, emoji omitted on removal; interactive `interactive.button_reply{id,title}` and `interactive.list_reply{id,title,description}`; quick-reply tap `type: "button"` with `button{payload,text}` and `context.id` = the template message id; unsupported `errors[]` code `131051` and `unsupported.type` | [Document](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/document), [Audio](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/audio), [Sticker](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/sticker), [Location](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/location), [Contacts](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/contacts), [Reaction](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/reaction), [Button](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/button), [Unsupported](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/unsupported), [Interactive reply buttons](https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-reply-buttons-messages), [Interactive list](https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-list-messages) |
| Outbound text: `{messaging_product, recipient_type, to, type: "text", text: {preview_url, body}}`; body up to 4,096 characters | [Text messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/text-messages) |
| Outbound reply buttons: `interactive.type: "button"`, `body.text` up to 1,024 characters, up to 3 `reply` buttons, title up to 20 characters, id up to 256 | [Interactive reply buttons](https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-reply-buttons-messages) |
| Outbound list: `interactive.type: "list"`, `action.button` up to 20 characters, `body.text` up to 4,096, `header` text and `footer` text up to 60, sections up to 10 with `title` up to 24, rows up to 10 in total with `id` up to 200, `title` up to 24, `description` up to 72 | [Interactive list](https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-list-messages) |
| Outbound reaction: `{type: "reaction", reaction: {message_id, emoji}}`; an empty emoji removes it; reacting fails with `131009` for messages older than 30 days, from another thread, deleted, or reactions | [Reaction messages](https://developers.facebook.com/docs/whatsapp/cloud-api/messages/reaction-messages) |
| Outbound location: `location{latitude, longitude, name?, address?}` with string coordinates | [Location messages](https://developers.facebook.com/docs/whatsapp/cloud-api/messages/location-messages) |
| Media upload `POST /{phone-number-id}/media`, persists 30 days; download `GET /{media-id}` returns `url`, `mime_type`, `sha256`, `file_size`; the URL needs the bearer token and expires after 5 minutes; a `404` means request a new URL | [Media reference](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media) |
| Media limits: audio AAC/AMR/MP3/M4A/OGG(Opus) 16 MB; document 100 MB; image JPEG/PNG/static WebP 5 MB, at most 4,096 px per edge; sticker static WebP 100 KB, animated 500 KB; video 3GP/MP4 H.264+AAC 16 MB; inbound media from customers 100 MB, larger returns `131052` | [Media reference](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media) |
| Template components: one body up to 1,024 characters with `{{1}}`-style positional parameters in order; header text up to 60; footer up to 60; up to 10 buttons; quick-reply button text up to 25; quick replies grouped together | [Template components](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components) |
| Template parameters are sent in `components`: `{type: "body", parameters: [{type: "text", text}]}` and `{type: "button", sub_type: "quick_reply", index, parameters: [{type: "payload", payload}]}` | [Template fundamentals](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview) (the send example is not in the text fetched; the shape is the documented component format) |
| Customer service window: opened or reset when "a WhatsApp user messages you or calls you"; the page names no other action; service messages allowed inside it include `reaction`, `interactive` reply buttons and lists, and media; outside it only approved templates | [Send messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages) |
| Error `131047`: re-engagement, more than 24 h since the recipient last replied; send a template | [Error codes](https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes) |
| Errors `131009`, `131051`, `131052`, `131053`, `131026`, `131056`, `130429`, `131048`, `80007`, `4`, `368`, `131021`, `133010` with their meanings | [Error codes](https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes) |
| Categories: marketing, utility, authentication for templates; service, Meta Business Agent for non-template messages. Per-message pricing since 2025-07-01. Service messages past 1,000 free per month and utility messages inside an open window are charged from 2026-10-01. Meta may change prices only on the first day of a quarter | [Pricing](https://developers.facebook.com/docs/whatsapp/pricing) |

Two facts stay unverified and are tested by probe in `deploy-readiness`, not assumed here:

- whether a reaction opens the window (the send docs name only messages and calls);
- whether a template quick-reply tap opens the window (its inbound shape is a user message, so this spec assumes yes and checks it live).

Throughput limits could not be fetched (the throughput page returned 404). Outbound rate handling uses the error codes only.

### Policy risk: general-purpose AI on the Business Platform

Secondary sources report that, from 2026-01-15, Meta's WhatsApp Business Solution terms bar "AI providers" (large language models and general-purpose AI assistants) from distributing their assistants on the platform, with business uses such as support, sales and notifications still allowed; the sources also report exceptions for users in Italy and Brazil. Sources: [TechCrunch, 2025-10-18](https://techcrunch.com/2025/10/18/whatssapp-changes-its-terms-to-bar-general-purpose-chatbots-from-its-platform), [respond.io](https://respond.io/blog/whatsapp-general-purpose-chatbots-ban). The official terms text was not reachable in this research. Treat the rule as reported, not confirmed.

Risk: zapbip lets an owner's third-party AI agents message the owner through the Business API, so Meta could classify the number as an AI assistant distribution. The fit with the policy as reported:

- every conversation is between one verified owner and that owner's own agents, not a public assistant anyone can add;
- the agents notify and answer the owner only; no third party gets a reply path, and no agent is offered to strangers;
- the owner's agents are notification and question channels, a business use case, not a general chatbot.

Mitigations in this spec: recipients are only verified owners (ADR 0012); the template set has no open-ended conversation; a `368` or `131048` from Meta stops sends and raises an operator log event; the terms are re-read against the reported rule before `deploy-readiness` runs. This is a business risk the owner must accept before production; it is recorded in the risks of the summary and does not block this slice's build.

### Data flow

```
owner's phone ─► WhatsApp ─► Meta ─POST /webhooks/whatsapp─► Worker
    1 verify X-Hub-Signature-256 over the raw body (≤ 3 MB)
    2 metadata.phone_number_id is ours? else 200, log, stop
    3 messages[] → from → account_id via `findOwnerByPhone` (D1, `d1-owner-directory.ts`); no row → 200, log, stop
    4 download media (media only) into R2, integrity-checked
    5 AccountInbox(account_id).receive(entries)   one SQLite transaction holds the receipt, the message and the window; flush, answer and wake run after it (ADR 0013):
         channel_receipts insert-or-ignore wamid → already seen? no-op
         window opens at the message's timestamp (except reactions)
         flush queue, route (core rules), store message, wake waiters
    6 200

agent ─MCP─► core ─► MessageSender (CloudApiMessageSender)
    session(message)  → POST /{phone-number-id}/messages   → wamid → store index wamid→account (D1)
    template(notice)  → POST /{phone-number-id}/messages   type template, named language

Meta ─POST /webhooks/whatsapp (statuses[])─► Worker
    1 verify, 2 phone_number_id check
    3 wamid → account via D1 index; not indexed → 200, log, stop
    4 AccountInbox(account_id).applyStatus(wamid, status, pricing, errors)
```

Outbound failure with `131047` goes back into the core as a channel fact: `AccountInbox.closeWindow(at)` (below), then the message is queued and the core sends its notice as usual.

### Inbound mapping

| Meta `type` | Core message | Window opens | Routed as |
|---|---|---|---|
| `text` | text | yes | rules 2–6 |
| `image`, `video`, `audio`, `document`, `sticker` | media kind, `media{media_id, mime_type, size_bytes, filename?, caption?, url}` | yes | rules 2–6 |
| `audio` with `voice: true` | audio kind with `voice: true` | yes | rules 2–6 |
| `location` | location | yes | rules 2–6 |
| `contacts` | contacts | yes | rules 2–6 |
| `reaction` | reaction `{message_id, emoji}`; an absent `emoji` is a removal | no | rule 2: the agent that sent the reacted message; a reaction to a question message answers it |
| `interactive` `button_reply` | `choice` `{option_id, title}` | yes | rule 1 |
| `interactive` `list_reply` | `choice` `{option_id, title, description?}`; ids starting `zapbip:` are rule 0 (accounts-and-keys) | yes | rule 1 |
| `button` (template quick reply) | no agent message; the notice's `context.id` is the notice's `wamid` | yes | none: it only opens the window and flushes the queue |
| any kind with `context.id` | `reply_to` set from `context.id`; `context` may carry no `id` | as the kind | rule 2 |
| any kind with `context.forwarded` or `context.frequently_forwarded` | `forwarded: forwarded \| frequently_forwarded` on the stored message, `none` otherwise; `frequently_forwarded` wins when both are set | as the kind | as the kind |
| `unsupported` | not delivered to agents | yes | none; the owner gets one session text, copy `unsupportedKind` |

The window opens at the message's own `timestamp` (Unix seconds, converted to milliseconds at the edge). Reactions do not open the window; a `131047` on a later send corrects any mistaken opening.

Owner messages keep the core's `sender: "owner"`, and `verified: true` on every kind except a forwarded one: a forwarded message is content the owner relayed, not their own words, so it carries `verified: false` and the `forwarded` kind on the wire (owner delegated 2026-11-06).

An entry whose `timestamp` is older than `RECEIPT_RETENTION_MS` is acknowledged with `200`, not processed and logged as `inbound.stale`: its receipt may already be pruned, so a captured replay could not be told from a new message. A message whose receipt already exists is acknowledged with `200` before any media is downloaded, so a redelivery never touches a stored object.

The media download origin of the development stack is passed to the webhook route and the Graph client by the development entry only; the production entry passes none and never reads `WHATSAPP_MEDIA_DOWNLOAD_ORIGIN`.

### Outbound mapping

| Core kind | Meta payload |
|---|---|
| text | `type: "text"`, `text.body`, `preview_url: true` when the body has a URL |
| text with `reply_to` | `context: {message_id}` |
| buttons (≤ 3 options) | `type: "interactive"`, `interactive.type: "button"`, buttons with `reply.id = <question_id>:<index>` |
| list (4–10 options) | `type: "interactive"`, `interactive.type: "list"`, one section, rows with `id = <question_id>:<index>` |
| image, video, audio, document | `{type, <type>: {link, caption?, filename?}}`, `link` = https URL or R2 signed link |
| sticker | `{type: "sticker", sticker: {link}}`; static WebP only |
| location | `{type: "location", location: {latitude, longitude, name?, address?}}` with string coordinates |
| contacts | `{type: "contacts", contacts: [...]}` with the card fields the core validates |
| reaction | `{type: "reaction", reaction: {message_id, emoji}}`; an empty emoji sends `""` |
| notice (template) | `{type: "template", template: {name, language: {code}, components}}` |

Button titles, list rows and sections are validated by the core before the adapter sees them. The adapter checks the Meta limits again at build time and throws a typed error naming the field if one breaks, so a limit change in Meta fails loudly.

Media size and type limits are checked by the adapter before the upload or link is handed to Meta:

| Kind | Allowed MIME types | Max bytes |
|---|---|---|
| image | `image/jpeg`, `image/png`, `image/webp` | 5 MB |
| video | `video/3gpp`, `video/mp4` | 16 MB |
| audio | `audio/aac`, `audio/amr`, `audio/mpeg`, `audio/mp4`, `audio/ogg` | 16 MB |
| document | `application/pdf`, the Word, Excel and PowerPoint types, `text/plain` | 100 MB |
| sticker | `image/webp`, static only | 100 KB |

Sticker is limited to 100 KB for every sticker: the adapter does not parse WebP, so animated stickers are refused outbound and the limit is the stricter static one. Inbound, Meta's limits apply and the owner's content is stored as received.

### Templates

Both templates are category **UTILITY**. Submit each language as its own template with the same name. Parameter samples are fictional and must be given when submitting.

Names and language codes live in an enum in `apps/api/src/adapters/whatsapp/whatsapp-templates.ts`:

- `WhatsAppTemplateName.AgentNotice = "zapbip_agent_notice"`
- `WhatsAppTemplateName.AgentQuestion = "zapbip_agent_question"`
- `WhatsAppLanguageCode.PortugueseBrazil = "pt_BR"`, `WhatsAppLanguageCode.EnglishUs = "en_US"`

The owner's language is the account's `locale`, an account property set by `accounts-and-keys` at account creation (`pt_BR` for +55 numbers, `en_US` otherwise). It is a required `OwnerLocale` enum with two values that map one-to-one to the language codes. This slice reads it and does not own it.

**`zapbip_agent_notice`**

| Language | Body (submit exactly) | Parameters | Quick reply (submit exactly) |
|---|---|---|---|
| pt_BR | `Mensagem de {{1}}: {{2}} — toque em Abrir para ler.` | `{{1}}` agent name, sample `Agente de teste`; `{{2}}` preview, sample `Mensagem de exemplo`, at most 60 characters, no line break | `Abrir` |
| en_US | `Message from {{1}}: {{2}} — tap Open to read it.` | `{{1}}` agent name, sample `Test agent`; `{{2}}` preview, sample `Example message`, at most 60 characters, no line break | `Open` |

**`zapbip_agent_question`**

| Language | Body (submit exactly) | Parameters | Quick reply (submit exactly) |
|---|---|---|---|
| pt_BR | `Pergunta de {{1}}: {{2}} — toque em Responder para ver as opções.` | `{{1}}` agent name, sample `Agente de teste`; `{{2}}` question preview, sample `Pergunta de exemplo`, at most 60 characters, no line break | `Responder` |
| en_US | `Question from {{1}}: {{2}} — tap Reply to see the options.` | `{{1}}` agent name, sample `Test agent`; `{{2}}` question preview, sample `Example question`, at most 60 characters, no line break | `Reply` |

Rules that the adapter enforces:

- the body always has fixed words before and after the parameters, so no parameter starts or ends the body (Meta's review rejects such a body; a unit test runs `assertTemplateBodyHasFixedWords` over every registered body, so a new text that breaks it fails the build);
- a parameter is cut at `NOTICE_PREVIEW_MAX_CHARS` (60, a core constant), has line breaks and tabs replaced by spaces, and has runs of spaces collapsed. These sanitising rules are a conservative local choice; the fetched Meta pages did not state the parameter rules;
- the quick reply tap is the only action a notice offers.

After a notice, the core's flush delivers the real content: the message itself, or the question with its real buttons or list.

### Idempotency

- **Inbound:** `channel_receipts(wamid PRIMARY KEY, received_at)` in `AccountInbox` (table owned by agent-inbox-core, DO schema `v1`). Insert-or-ignore runs in the same SQLite transaction as the message insert. A throw before the commit leaves no receipt, so the retry stores once; a throw after it keeps the message and the receipt, so the retry returns `200` with no effect. A second delivery of a `wamid` changes nothing and returns `200`.
- **Receipts are kept for `RECEIPT_RETENTION_MS` (7 days)**, the longer of Meta's two stated retry windows, and then pruned by the object's alarm.
- **Statuses:** applied by the rule below. Applying the same status twice is a no-op.
- **Outbound:** no automatic retry, so a send is never duplicated by the adapter. The core's `ask` idempotency is unchanged.
- **Routing index:** `wamid → account_id` is written once; a second write of the same `wamid` is ignored.

### Status handling (updates `delivery`)

The core's outbound `delivery` gains `delivered` and `read`. Rule, applied to the message whose `wamid` matches:

| Current `delivery` | Incoming status | Result |
|---|---|---|
| `sent` | `delivered` | `delivered` |
| `sent` or `delivered` | `read` | `read` |
| `sent` | `failed` | `failed` |
| `delivered` or `read` | `failed` | unchanged; log `status.failed.ignored` |
| `failed` | `sent`, `delivered` or `read` | the status wins (Meta has the truth; a failed send may still arrive) |
| any | a status of lower rank than current | unchanged |

Ranks: `sent` 1, `delivered` 2, `read` 3. `failed` is handled by the rule row, not by rank. A `failed` status stores its `errors[0].code` and `errors[0].title`. `pricing.category` and `pricing.billable` are stored on the message for cost checks.

### Failure handling

| Failure | Behaviour |
|---|---|
| `GET` with a wrong `hub.verify_token` or `hub.mode` | `403`, no body |
| `POST` without `X-Hub-Signature-256`, or with a digest that does not match the raw body | `401`, same body for every reason; nothing parsed or stored |
| `POST` body over 3 MB, signed or not | `413`, answered before the signature check (intended: the cap is public in the documentation); the cap is applied to the streamed bytes, so a `Content-Length` of `abc` or `-1` is accepted |
| Entry `timestamp` more than `MAX_FUTURE_SKEW_MS` in the future | `200`, log `inbound.future`, not processed |
| Signed body that is not JSON | `400` |
| `phone_number_id` is not this number | `200`, log `inbound.foreign_number`, nothing stored |
| Inbound with no `from`, or a `from` with no `owner_identities` row | `200`, log `inbound.unmapped` with no phone number; nothing sent back. From accounts-and-keys on, a first message from an unknown `from` creates the account instead (ADR 0016) |
| Duplicate `wamid` | `200`, no effect |
| Commit to `AccountInbox` fails | `500`, so Meta retries; the receipt keeps the retry safe |
| Media download: `404` on the download URL | the metadata is requested again once; a second `404`, or Meta error `131052`, stores the message with media status `unavailable`; the agent gets `media: null` and a status; the owner gets one session text, copy `mediaUnavailable` |
| Media download: `5xx` or timeout | `500` for the webhook, nothing stored; Meta retries, and no receipt exists for that message yet |
| Media metadata answers a permanent `4xx` other than `401` and rate limits (for example `400` or `404` with an unknown error code), or has an unexpected shape | the message is stored with media status `unavailable` and the owner gets the `mediaUnavailable` copy; `401` and rate limits return `500` so Meta retries |
| Media body longer than the declared size | the stream errors, the object is deleted, the message is stored as unavailable |
| Media bytes do not match the webhook `sha256` | the streamed object is deleted; the message is stored as unavailable; the owner gets the `mediaUnavailable` copy |
| R2 write fails | `500`; the key `accounts/<account_id>/media/<mediaId>` is deterministic (`mediaId` is `med_` plus the SHA-256 hex of the `wamid`), so a retry overwrites |
| Inbound `type` is `unsupported` (Meta `131051`) | not delivered to agents; log `inbound.unsupported` with the `unsupported.type`; the owner gets one session text, copy `unsupportedKind` |
| Status for an unindexed `wamid` | `503` while the status timestamp is under 10 minutes old, so Meta retries; after that, `200` and log `status.unindexed` |
| Send returns `131047` (window closed on Meta) | the core's `closeWindow(at)` runs, then the message queues and the core sends its notice |
| Send returns `130429`, `80007`, `4` or `131056` (throughput or rate) | `delivery: "failed"`; the tool returns an error saying the channel is busy; no automatic retry |
| Send returns `131048` or `368` (number restricted or WABA disabled) | `delivery: "failed"`; log `channel.restricted` at error level (the operator alert); sends stop for 24 hours (`RESTRICTION_TTL_MS`), then the restriction row is ignored; an operator may delete it earlier |
| Send returns `131026` (delivery failed for the recipient) | `delivery: "failed"`, error names the kind |
| Send returns `131009` (invalid reaction target) | on a reaction send the tool returns an error naming `reaction.message_id`; on any other send the error is the unexpected-error kind and never mentions a reaction |
| Send returns `131053` (media upload not accepted) or `131051` | the tool returns an error naming the kind and the MIME type |
| Template rejected by Meta (not approved, parameter count or value wrong) | `delivery: "failed"`; log `channel.template_rejected` with the template name and language |
| Graph request times out or returns a 5xx | `delivery: "failed"` with reason `timeout`; the message may still have been delivered, and a later status webhook overrides it under the status rule |
| Graph returns an access-token error | `delivery: "failed"`; log `channel.auth` at error level for the operator |

### Interfaces

Ports stay as the core defines them. Additions in this slice are listed in the plan's Core contract additions section; the orchestrator merges them into `core-contract-additions.md`.

| Name | Where | Shape |
|---|---|---|
| `MessageSender` | core port, implemented by `CloudApiMessageSender` | `session({message})` and `template({notice})` return `{channelMessageId}` (the `wamid`) or throw a typed `ChannelError` with a kind from `ChannelErrorKind` |
| `ChannelErrorKind` | `libs/core` (enum; `DeliveryFailed` comes from agent-inbox-core, the rest from this slice) | `WindowClosed`, `RateLimited`, `Restricted`, `DeliveryFailed`, `ReactionRejected`, `MediaRejected`, `TemplateRejected`, `Timeout`, `Auth`, `Unknown` |
| `AccountInbox.closeWindow({at})` | core use case | sets the window closed for messages sent after `at`, until the next owner message; an additive fact, the arithmetic is unchanged |
| `AccountInbox.applyStatus({wamid, status, errorCode?, pricingCategory?, billable?})` | core use case | the status table above |
| `DeliveryState` | `libs/core` (enum, from agent-inbox-core) | `Queued`, `Sent`, `Delivered`, `Read`, `Failed`, `Expired`; this slice adds `Delivered` and `Read` |
| `OwnerLocale` | `libs/types` (enum; accounts-and-keys sets the account's locale, this slice reads it) | `PortugueseBrazil`, `EnglishUs` |
| `GraphClient` | `apps/api/src/adapters/whatsapp/graph-client.ts` | `post({path, body})`, `get({path})`, `download({url})`; base URL, version and token from the environment; the base URL is a named parameter so tests point it at the fake |
| `MediaStore` | core port, implemented by `R2MediaStore` | `put`, `get`, `signedLink`, `delete`; the webhook download uses `put` with a `Content-Length` |
| Owner directory | `apps/api/src/adapters/d1/d1-owner-directory.ts`, slice 1's finder plus one function in this slice; accounts-and-keys promotes it to a core port | `findOwnerByPhone({database, phone})` returns `{accountId, ownerLocale}` or `null`; `findOwnerByAccountId({database, accountId})` returns `{waId, ownerLocale}` or `null` (plan refresh R11) |
| `D1MessageIndex` | `apps/api/src/adapters/d1/d1-message-index.ts`, slice 1's class over `message_index (wamid, account_id, created_at)`, used as it is | `record({id, accountId, at})` returns whether the row was new; `find({id})` returns `{accountId}` or `null` (plan refresh R11) |

The account directory and the message index are D1 adapter lookups, so the core's ports stay as they are. The route, not the core, resolves the account before calling the `AccountInbox`.

Constants (named in `apps/api/src/adapters/whatsapp/whatsapp-constants.ts` or `libs/core`):

| Constant | Value | Home |
|---|---|---|
| `GRAPH_API_VERSION` | `v24.0` | adapter |
| `GRAPH_REQUEST_TIMEOUT_MS` | 10 000 | adapter |
| `WEBHOOK_MAX_BYTES` | 3 MB | adapter |
| `MAX_FUTURE_SKEW_MS` | 5 minutes | adapter |
| `RECEIPT_RETENTION_MS` | 7 days | core, agent-inbox-core |
| `MEDIA_DOWNLOAD_ATTEMPTS` | 2 | adapter |
| `MEDIA_MAX_BYTES_INBOUND` | 100 MB | adapter |
| `STICKER_MAX_BYTES` | 100 KB | adapter |
| `WHATSAPP_MEDIA_HOST_SUFFIXES` | the allowlist for Meta-issued download hosts | adapter |
| `NOTICE_PREVIEW_MAX_CHARS` | 60 | core, existing |
| `WHATSAPP_TEXT_MAX_CHARS` | 4 096 | core, agent-inbox-core |
| `MEDIA_LINK_TTL_MS` | 1 h | core, existing |

Secret names, read at the edge and never logged: `META_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`. `WHATSAPP_GRAPH_BASE_URL` is a `wrangler` var of the development block only (the fake URL); the staging and production blocks, added by `deploy-readiness`, set the Graph host, and a missing value throws: the fake's URL in development, `https://graph.facebook.com` in staging and production. Their entries in `.env.example` are added by `deploy-readiness`.

### HTTP routes

| Route | Purpose |
|---|---|
| `GET /webhooks/whatsapp` | verify challenge: on match, `200` with `hub.challenge` as plain text |
| `POST /webhooks/whatsapp` | notifications: messages and statuses |

No account id is ever in these paths.

### Copy

`apps/api/src/adapters/whatsapp/whatsapp-copy.ts` holds the owner-facing texts in `pt_BR` and `en_US`, keyed by an enum (agent-inbox-core → Language):

| Key | pt_BR | en_US |
|---|---|---|
| `unsupportedKind` | Este tipo de mensagem ainda não é suportado. Envie como texto ou foto. | This kind of message is not supported yet. Send it as text or a photo. |
| `mediaUnavailable` | Não consegui baixar o arquivo. Envie de novo, por favor. | I could not download the file. Please send it again. |

### Docs (Mintlify, `apps/docs`, per [ADR 0010](../../adr/0010-public-docs-on-mintlify.md))

- **`concepts/whatsapp-channel.mdx`:** how an owner's message reaches an agent and back; the 24-hour window and what opens it; the inbound and outbound kinds with their limits (media sizes and types, button and list limits, reaction rules); the status values an agent can see in `delivery`.
- **`concepts/owner-notices.mdx`:** the two notices the owner receives, what the quick reply does, and why a notice arrives before the real content.
- **Navigation:** both pages are in the single `docs.json` navigation of agent-inbox-core → Docs. `mint broken-links` runs green.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| How does the owner's phone map to an account on the shared number? | `wa_id` · BSUID · one number per account | `wa_id` now, BSUID stored alongside ([ADR 0012](../../adr/0012-owner-identity-by-wa-id-on-the-shared-number.md)) | owner delegated 2026-11-06 |
| Acknowledge the webhook before or after processing? | queue · inline commit with dedupe | inline commit, dedupe by `wamid` ([ADR 0013](../../adr/0013-webhook-acknowledged-after-a-durable-commit-and-deduplicated-by-message-id.md)) | owner delegated 2026-11-06 |
| Download inbound media now or on demand? | at webhook time · on demand | at webhook time into R2 ([ADR 0014](../../adr/0014-inbound-media-stored-in-r2-at-webhook-time.md)) | owner delegated 2026-11-06 |
| Does a reaction open the 24-hour window? | yes · no | no (conservative; a wrong opening is corrected by `131047`) | owner delegated 2026-11-06 |
| Does a template quick-reply tap open the window? | yes · no | yes, assumed as a user message; checked live in `deploy-readiness` | owner delegated 2026-11-06 |
| Outbound media: Meta fetches a link, or the adapter uploads? | `link` · upload to `/media` | `link`, which matches the core's signed-link contract | owner delegated 2026-11-06 |
| Template language codes | `pt_BR`/`en_US` · `pt`/`en` | `pt_BR` and `en_US`, one template per language | owner delegated 2026-11-06 |
| Retry an outbound send that failed on throughput? | automatic · report | report now; a retry policy is a later decision | owner delegated 2026-11-06 |
| Animated stickers outbound? | support · refuse | refuse; static stickers only, 100 KB | owner delegated 2026-11-06 |
| Is the AI-providers policy a blocker? | block · build and flag | build and flag as a business risk for the owner to accept before production | owner delegated 2026-11-06 |
| Where does the owner locale enum live? | `apps/api` · `libs/types` | `libs/types`; the account's locale is set by accounts-and-keys and read by this slice | owner delegated 2026-11-06 |
| Which owner-directory lookup comes first? | core port now · adapter now | adapter now (`findOwnerByPhone` and `findOwnerByAccountId` in `d1-owner-directory.ts`); accounts-and-keys promotes it to a core port | owner delegated 2026-11-06 |
| Secret name for the Meta app secret | `WHATSAPP_APP_SECRET` · `META_APP_SECRET` | `META_APP_SECRET`, the name `deploy-readiness` uses | owner delegated 2026-11-06 |
| Enum member names | UPPER_CASE · PascalCase | PascalCase members with lowercase wire values, across all slices | owner delegated 2026-11-06 |
| Owner recipient and locale for outbound sends | Lookup in D1 · in the core port | Adapter resolves `wa_id` by `findOwnerByAccountId`; locale is the account's property, read through the directory; the core port carries no recipient | owner delegated 2026-11-06 |
| Reply and reaction targets | Core resolves channel ids · sender reads the repository | Core resolves `replyToChannelMessageId` and `reactionTargetChannelMessageId` and passes them to the sender | owner delegated 2026-11-06 |
| Window closed by the channel | Flag · closed-at timestamp | `closedAt` on the window; a send at or after it sees a closed window; `openWindow` clears it; arithmetic unchanged | owner delegated 2026-11-06 |
| Quick-reply tap and unsupported kinds | Store a message · window only | Window only through `openWindow`; `unsupported` also sends one session text in the owner's locale | owner delegated 2026-11-06 |
| Media that cannot be stored | Drop · store as unavailable | Stored with `MediaSourceKind.Unavailable`; the agent sees `media: null` and `media_status: unavailable` | owner delegated 2026-11-06 |
| Inbound media ids and R2 keys | Random · deterministic; account prefix | Deterministic `med_` plus SHA-256 hex of the `wamid`; R2 key `accounts/<accountId>/media/<mediaId>`; signed link `/m/<accountId>/<mediaId>` (ratified by cross-slice decisions) | owner delegated 2026-11-06 |
| Receipt and message atomicity | One SQL transaction · compensation | One SQLite transaction holds the receipt, the message and the window; flush and wake run after it (ADR 0013 amended) | owner delegated 2026-11-06 |
| Restriction on `131048` and `368` | Retry · block sends until cleared | A `channel_restrictions` row in D1 (migration `0004`) blocks sends until an operator deletes it | owner delegated 2026-11-06 |
| Template parameters and buttons | Body and button components · body only | Body component only; the quick reply has fixed text | owner delegated 2026-11-06 |
| Unknown and unlisted Meta error codes | Fail loudly · map | `133010` Restricted, `131021` DeliveryFailed, `190` and 401 Auth; other template errors TemplateRejected; others Unknown | owner delegated 2026-11-06 |
| Outbound media without known size or MIME | Refuse · check what is known | Check MIME and size only when known; Meta enforces the rest (`131053` maps to MediaRejected) | owner delegated 2026-11-06 |
| Outbound stickers limit | 500 KB core limit · 100 KB | 100 KB (`OUTBOUND_STICKER_MAX_BYTES`); animated stickers not detected | owner delegated 2026-11-06 |
| Status `played` | Store · ignore and log | Logged as `status.ignored`, no change | owner delegated 2026-11-06 |
| Inbound media host and hash | Any host · allowlist; hash base64 | Only `https` hosts ending in `.fbcdn.net`, `.fbsbx.com`, `.whatsapp.net` (confirm at build); base64 SHA-256 compare (confirm at build) | owner delegated 2026-11-06 |
| Signature and token comparison | String compare · constant time | `crypto.subtle.verify` for the HMAC; digest compare with `crypto.subtle.timingSafeEqual` (confirm at build) | owner delegated 2026-11-06 |
| Durable Object account identity | Argument · `ctx.id.name` | `AccountInbox` reads its account from `ctx.id.name`; a missing name throws | owner delegated 2026-11-06 |
| Operator log content | Free text · fixed fields | One JSON line per event; never a phone number, body or token | owner delegated 2026-11-06 |
| Development Graph URL | Top-level · development block only | `WHATSAPP_GRAPH_BASE_URL` in the top-level (development) vars only; production has no value and throws | owner delegated 2026-11-06 |
| Schema versions for this slice | Edit slice 1 · own migration and version | Migration `0004_whatsapp_channel.sql` and DO schema `v4`; `0001_core` and `v1` are reused, not edited | owner delegated 2026-11-06 |
| Core additions | Silent · listed | Listed in the plan's Core contract additions section for the orchestrator to merge | owner delegated 2026-11-06 |
| Plan refresh at build | Skip · diff against main | Diff the plan against `main` before W0; mark contract-dependent items (contract: confirm at build) | owner delegated 2026-11-06 |
| Shared time constants | Local copies · libs/types | Time constants come from the shared `libs/types` set when slice 1 provides them; no local copies | owner delegated 2026-11-06 |
| Are queued messages claimed before the Graph call? | no claim · claim as `Sending` | claim as `Sending` before any await, so concurrent webhooks never double-send (A22) | owner delegated 2026-11-06 |
| Does a flush stop at a closed window, and do other errors stop it? | stop on any error · per message | per message; stop at the first `WindowClosed`, leave the rest queued (A23) | owner delegated 2026-11-06 |
| Is the receipt committed with the message? | one transaction · compensation | one SQLite transaction with the message and the window; flush and wake run after it (A7, ADR 0013 amended) | owner delegated 2026-11-06 |
| Restriction duration | until cleared · 24 h | 24 h (`RESTRICTION_TTL_MS`), with an operator alert `channel.restricted` on every write; a row older than that is ignored (A8) | owner delegated 2026-11-06 |
| How is a status for an unknown `wamid` handled? | `200` always · `503` while young | `503` while the status timestamp is under 10 minutes old, then `200` and log (A27) | owner delegated 2026-11-06 |
| Media download: streamed or buffered? | buffer · stream | streamed through `DigestStream` into `FixedLengthStream`; a mismatch deletes the object (A24) | owner delegated 2026-11-06 |
| Media download failures: unavailable or retry? | unavailable for all · `404` refresh, `5xx` retry by Meta | `404` refreshes the metadata once; `5xx` or timeout returns `500` so Meta retries; `131052` is unavailable (A25) | owner delegated 2026-11-06 |
| Redirects on media download | follow · manual | `redirect: 'manual'`; a redirect is a failed download (A14) | owner delegated 2026-11-06 |
| Media host check | substring · parsed hostname | the parsed hostname must equal or end with an allowlisted suffix; userinfo and path tricks are refused (A14) | owner delegated 2026-11-06 |
| Batch with a bad entry | fail the batch · per message | parse per change and per message; a bad entry never fails the batch (A26) | owner delegated 2026-11-06 |
| Webhook changes for another number | fail · per change | one `phone_number_id` per change, checked for each change (A26) | owner delegated 2026-11-06 |
| Status detail on update | overwrite with nulls · merge | only non-null values are written; `errorTitle` is stored (A28) | owner delegated 2026-11-06 |
| Window timestamp for out-of-order owner messages | last write · `max` | `openWindow` stores `max(lastOwnerMessageAt, at)` (A3) | owner delegated 2026-11-06 |
| Which sender does the development entry use? | fake always · Cloud API when configured | Cloud API when `WHATSAPP_ACCESS_TOKEN` is set, else the fake, chosen by `DevAccountInbox` overriding `createSender`; the production class builds the Cloud API sender only and never imports the fake (A29, plan refresh R15) | owner delegated 2026-11-06 |
| Owner locale source | D1 directory · account property | an account property set by accounts-and-keys, carried by `ConnectionIdentity` for agent calls and read from the directory row for webhook calls, passed to the use cases as `ownerLocale` and to `template({locale})` (A1, plan refresh R5) | owner delegated 2026-11-06 |
| Flush failure after the commit | roll back the message · keep it | the message is kept; the queue flushes on the next owner message or the alarm (A31) | owner delegated 2026-11-06 |

| Entry timestamped in the future | process · reject | acknowledged `200`, logged `inbound.future`, not processed when more than `MAX_FUTURE_SKEW_MS` (5 minutes) ahead; the development entry allows `DEVELOPMENT_MAX_FUTURE_SKEW_MS` (2 days) because its simulated clock advances a day at a time | owner delegated 2026-11-06 |
| `Content-Length` of `abc` or `-1` | reject · accept | accepted; the streaming cap applies | owner delegated 2026-11-06 |
| Unsigned body above the cap | `401` · `413` | `413` before the signature check | owner delegated 2026-11-06 |
| Plan refresh decisions R1 to R30 | silent · listed | every difference between the plan and slice 1's code, with its decision, is the table "Plan refresh (W-1.1)" in `plan.md`; the notable ones: `ChannelError extends InboxError`, `commitChannelInbound` beside the public `recordChannelReceipt`, slice 1's owner finder and message index reused, no development-sender registry, the fake Graph is an HTTP server | owner delegated 2026-11-06 |

## Test strategy summary

Tests use a fake Graph API, an HTTP server, built from recorded fixtures: the JSON bodies of Meta's documented examples, kept in `apps/api/test/fixtures/whatsapp/` one file per kind and endpoint, with the request bodies the adapter must produce kept beside them. Test secrets are constants in the test setup (`test-app-secret`, `test-verify-token`, `test-access-token`); no real credential is read, and no test calls `graph.facebook.com`.

- **Unit (Vitest, node):**
  - HMAC verification: valid, wrong digest, missing header, digest over a re-serialised body;
  - the GET challenge: match and mismatch;
  - inbound parser, one test per row of the inbound mapping, including a voice audio, a removed reaction, a quick-reply tap and `unsupported`;
  - outbound builders, one test per row of the outbound mapping, asserting the exact fixture body;
  - Meta limit checks: button titles, list rows and sections, body length, reaction target;
  - media MIME and size table;
  - template sanitiser: line breaks, tabs, runs of spaces, the 60-character cut, and a body with a parameter at either end is refused;
  - status rule table, every row;
  - `131047` maps to `WindowClosed` and the rest of the error table maps as the failure table says;
  - copy keys cover both languages.
- **Integration (`@cloudflare/vitest-pool-workers`, real workerd, D1, R2, Durable Objects, `fetchMock` for Graph):**
  - a signed text webhook opens the window and the owner's message is routed and stored;
  - the same webhook delivered twice stores one message;
  - a webhook with a broken signature stores nothing;
  - an unmapped `from` and a foreign `phone_number_id` store nothing and return `200`;
  - two accounts with different owners never see each other's messages or statuses;
  - an inbound image with a matching `sha256` lands in R2 with `Content-Length`; a mismatch stores nothing and sends the media copy;
  - a status sequence `sent → read → delivered` ends `read`; `failed` after `read` is ignored;
  - a `131047` on a session send closes the window, queues the message and sends one notice;
  - the notice template body matches the fixture for both languages;
  - a Durable Object restart between a webhook and its status keeps the index and the receipt.
- **E2E (`wrangler dev`, development environment, fake Graph server on a local port, signed webhook posts from the test script):**
  - an owner text, a voice note, a reaction and a list reply each reach an MCP agent;
  - an agent's list question goes out as the fixture's list body and its answer comes back by `question_id`;
  - a send is refused outside the window and the notice reaches the fake Graph.
  - The run is recorded for the PR with the simulator screen walk (`check-ui`).
- **Production build:** the fake Graph base URL and fixtures are absent from the production bundle; a test proves `WHATSAPP_GRAPH_BASE_URL` is required in production and not defaulted.
- **Live probes:** not in CI. `deploy-readiness` runs a smoke test against Meta's sandbox number to confirm the two unverified window facts and the template approvals.
