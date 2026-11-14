# WhatsApp support scope

**Status:** Shipped 2026-11-14
**Tier:** 🟡 medium
**Owner approval:** approved 2026-11-14 (owner asked in pt-BR: say which WhatsApp message types are supported and which are not, and say in the docs and the FAQ that unofficial WhatsApp tools are not supported)
**ADRs:** none; the official-API choice is already recorded in [0036](../../adr/0036-one-fixed-meta-app-and-numbers-join-through-embedded-signup.md)
**Not changing:** the code paths that accept, reject or send message kinds; the mcp-reference pages and the message-kinds snippet, which stay the developer view

## Problem

The docs and the landing FAQ never listed which WhatsApp message kinds work in each direction, and one features sentence said an AI can send "anything WhatsApp can carry", which the code does not do. Nothing said that unofficial WhatsApp tools are not supported.

## Goals

- A user-facing page under Features that lists, per direction, the kinds that work, the kinds that are ignored or refused, and the limits, in all ten docs languages.
- A short "official WhatsApp Cloud API only" section on that page, with the same claim in the docs FAQ and in the landing FAQ, in all ten locales.
- A shape test that pins the page's kinds to `MessageKind`, so a new kind cannot ship without a row.

## Non-goals

- No change to behaviour. Reactions, stickers, locations and contacts are accepted today and stay accepted.
- No developer detail on the feature page (the features pages may not link to `mcp-reference`, `concepts` or `developers`).

## Ground truth (code)

- Inbound kinds parsed by `apps/api/src/adapters/whatsapp/inbound-parser.ts`: text, image, video, audio, document, sticker, location, contacts, reaction, interactive `button_reply` and `list_reply` (as `choice`), and `button` (window only, no message).
- Any other WhatsApp type, or an interactive subtype, becomes `ChannelInboundKind.Unsupported`; `apps/api/src/routes/whatsapp.ts` sends the owner the `UnsupportedKind` notice and nothing reaches the agent (`libs/core/src/inbox/use-cases/receive-channel-message.ts`).
- A webhook field other than `messages` or `statuses` (for example `calls`) is ignored: `processChange` in `apps/api/src/routes/whatsapp.ts`.
- Outbound kinds from `apps/api/src/adapters/whatsapp/outbound-builders.ts` and `outbound-limits.ts`: text, image, video, audio (or voice note), document, sticker, location, contacts, reaction, choice. Templates are sent only by the notice path.
- Limits: `libs/core/src/inbox/constants.ts`, `apps/api/src/adapters/whatsapp/whatsapp-constants.ts`, and the existing channel page.

## Acceptance

- Each of the ten `apps/docs/<folder>/features/supported-messages.mdx` pages exists, is in that language's Features group in `apps/docs/docs.json`, and has every `MessageKind` in a table row.
- `help/faq` in each language answers "which messages" and "unofficial tools".
- The landing FAQ has four new keys in all ten `SITE_COPY` locales and appears in the FAQ list and the FAQPage JSON-LD.
- No new prose names an agent (`prose-leaks.test.ts` stays at or below its baseline).

## Failure modes

| Step | What breaks | Signal | Back out |
|---|---|---|---|
| Page added to Features | a language misses the navigation entry | `docs-navigation.test.ts` | add the entry in that language |
| New FAQ key | a locale copy is missing | `site-copy.test.ts` (every key, none empty) | add the copy |
| Prose | an agent name slips into public prose | `prose-leaks.test.ts` grows | rewrite with "your AI" |
