# Agent inbox core

**Status:** Building
**Tier:** 🔴
**Owner approval:** approved 2026-11-06 (owner delegated)
**ADRs:** [0006](../../adr/0006-one-secret-per-connection-in-the-mcp-url.md), [0007](../../adr/0007-a-durable-inbox-and-a-wake-ladder.md), [0008](../../adr/0008-a-pure-core-behind-ports.md), [0009](../../adr/0009-cloudflare-workers-with-one-durable-object-per-account.md), [0010](../../adr/0010-public-docs-on-mintlify.md), [0011](../../adr/0011-the-24-hour-window-queues-and-sends-one-notice.md)
**Not changing:** the harness gates other than the ones this feature adds; nothing outside `libs/core`, `libs/types`, `apps/api`, `apps/docs`, `scripts/verify-gates.tsv`, the repository-shape root list, the AGENTS.md layout lines and the indexes.

## Problem

An owner's own AI agents (Claude Code, Codex, claude.ai, ChatGPT, Grok Bot and any MCP client) need one channel to the owner's WhatsApp. Through it they send anything WhatsApp carries, ask questions and get the answers back. The owner can also start the conversation. The client probes of 2026-11-04 to 2026-11-06 fixed the rules this channel must obey: per-call timeouts between 60 s and unlimited, clients that retry a call on their own, no client declaring MCP Tasks, and wake paths that differ per client.

This feature builds the part every later feature plugs into:

- the domain;
- the durable inbox;
- the MCP contract;
- the 24-hour window policy;
- message routing;
- media handling.

It runs against a fake WhatsApp, so the contract is proven end to end before Meta, signup or wake adapters exist.

## Goals

1. `libs/core`: the domain, its use cases and its ports, in plain TypeScript with no runtime dependency ([ADR 0008](../../adr/0008-a-pure-core-behind-ports.md)).
2. `apps/api`: a Cloudflare Worker (Hono) serving the MCP server at `https://<host>/c/<connection-secret>/mcp`. The same server answers at `/mcp` with `Authorization: Bearer <connection-secret>` ([ADR 0006](../../adr/0006-one-secret-per-connection-in-the-mcp-url.md)).
3. One `AccountInbox` Durable Object per account, SQLite-backed, holding:
   - every agent's inbox;
   - open questions;
   - message history;
   - the owner's 24-hour window;
   - the outbound queue ([ADR 0009](../../adr/0009-cloudflare-workers-with-one-durable-object-per-account.md)).
4. The ten MCP tools below, with the rules the probes proved: the 50 s ceiling, idempotent `ask`, answers bound to a `question_id`, verified owner sender.
5. Every WhatsApp message kind in both directions: text with emoji, image, video, audio and voice, document, sticker, location, contacts, reaction, buttons and lists, quoted replies. Media is stored in R2 and served through signed links.
6. The 24-hour customer-service window ([ADR 0011](../../adr/0011-the-24-hour-window-queues-and-sends-one-notice.md)):
   - inside it, messages go out as session messages;
   - outside it, they queue and the owner gets one template notice per closed window;
   - the owner's next message flushes the queue.
7. Routing of every owner message, reaction and button reply to the right agent of the account.
8. A fake WhatsApp channel and a development-only owner simulator, so the whole flow runs locally under `wrangler dev`.
9. Connection secrets stored as hashes in D1, created by a development script until `accounts-and-keys` replaces it.
10. `apps/docs`: the Mintlify site skeleton with Introduction, Concepts and the MCP reference ([ADR 0010](../../adr/0010-public-docs-on-mintlify.md)).

## Non-goals

- The real WhatsApp Cloud API adapter, template approval, webhook signature checks and Meta media download. These belong to `whatsapp-cloud-channel`.
- Signup, account creation through WhatsApp, the owner's phone link, the install prompt and connection management. These belong to `accounts-and-keys`.
- Wake adapters other than `NoneWaker`. Webhook wake belongs to `webhook-wake`, the local connector to `local-connector`, scheduled tasks and the standby agent to `scheduled-wake`.
- Per-client install skills and guides, which belong to `install-skills`.
- OAuth, MCP Apps, MCP Tasks, billing, rate limits and abuse controls.
- Publishing the docs site. Publishing waits for the owner's Mintlify account.

## Design

### Layout

```
libs/core                domain, use cases, ports; no runtime dependency
libs/types               enums and constants shared by the libs and the apps
apps/api                 Cloudflare Worker
  src/routes             Hono routes: MCP, media links, uploads, dev simulator
  src/mcp                tool definitions mapping MCP calls to core use cases
  src/account-inbox      the Durable Object: waiters, alarm, due-time providers and a custom set-based migration runner (`schema_versions`; drizzle's migrator is not used)
  src/adapters           grouped by kind: d1 (D1ConnectionDirectory), r2 (R2MediaStore), fake (FakeWhatsAppSender), wake (NoneWaker), platform (clock, ids, hash, connection secret), sqlite (the repository)
apps/docs                Mintlify site (docs.json + MDX)
```

### Domain

| Concept | Meaning |
|---|---|
| Account | One owner, one WhatsApp phone, many agents. The isolation boundary. |
| Connection | One agent of one account, reachable through one secret. The agent name comes from the connection, never from the request. |
| Message | A tagged union of every kind in the table below, with `direction` (`to_owner` / `from_owner`), `id`, `at`, `agent`, an optional `reply_to` and a `delivery` state for outbound ones (`DeliveryState`). The kinds are the enum `MessageKind`. |
| Question | Asked by one agent. Holds its options and its answer once it arrives. |
| Owner window | `last_owner_message_at` per account, set by every owner message except a reaction. Open while `now < last + WINDOW_MS - WINDOW_SAFETY_MARGIN_MS`. |
| Outbound queue | Messages to the owner held while the window is closed, plus whether the closed window's notice was sent. |
| Delivery state | `DeliveryState` enum: `Queued`, `Sent`, `Failed`, `Expired`. `whatsapp-cloud-channel` adds `Delivered` and `Read`. |

### Message kinds

| Kind | Agent → owner | Owner → agent |
|---|---|---|
| text (emoji, WhatsApp formatting) | `send_message` | text |
| image | `send_media` image, ≤ 5 MB | image; inline image content when ≤ `INLINE_IMAGE_MAX_BYTES`, else a signed link |
| video | `send_media` video, ≤ 16 MB | signed link |
| audio, voice note (`voice: boolean`) | `send_media` audio, ≤ 16 MB | signed link |
| document | `send_media` document, ≤ 100 MB | signed link, file name, MIME type |
| sticker | `send_media` sticker | signed link |
| location | `send_location` | latitude, longitude, name, address |
| contacts | `send_contact` | the contact cards |
| reaction | `react` | `{message_id, emoji}`, routed to the agent that sent the reacted message |
| buttons, list | `ask` (≤ 3 options as buttons, 4–10 as a list) | `choice` `{option_id, title, description?}`, from either |
| quoted reply | `reply_to` on every send | `reply_to`, routed to the quoted message's agent |

The kinds are the enum `MessageKind`: `Text`, `Image`, `Video`, `Audio`, `Document`, `Sticker`, `Location`, `Contacts`, `Reaction`, `Choice`. Inbound media is `{media_id, mime_type, size_bytes, filename?, caption?, url}`.

Every message from the owner reaches the agent as `sender: "owner", verified: true`. The probes showed Claude refuses instructions from an unverified sender.

### MCP tools

| Tool | Input | Output |
|---|---|---|
| `send_message` | `text`, `reply_to?` | `{message_id, delivery: "sent" \| "queued"}` |
| `send_media` | `kind`, one of `url` (https) or `upload_id`, `caption?`, `filename?`, `reply_to?` | same |
| `send_location` | `latitude`, `longitude`, `name?`, `address?`, `reply_to?` | same |
| `send_contact` | `contacts[]` (name, phones, emails?, organization?) | same |
| `react` | `message_id`, `emoji` (empty removes) | same |
| `ask` | `question`, `options` (1–10), `timeout_seconds?` (≤ 50) | `{status: "answered", answer, message_id}` or `{status: "pending", question_id}` |
| `wait_for_reply` | `question_id?`, `timeout_seconds?` (≤ 50) | `answered` for a question; `{status: "message", messages}` without one; `{status: "timeout"}` |
| `get_messages` | `limit?` | unread owner messages, which become read, plus the last `HISTORY_LIMIT` exchanged messages |
| `check_inbox` | — | `{status: "empty"}` immediately, or `{status: "new", messages}`, which become read |
| `create_upload` | `filename`, `mime_type`, `size_bytes` | `{upload_id, upload_url, expires_at}`; the agent `PUT`s the bytes to `upload_url` |

Rules:

- **Wait ceiling.** `ask` and `wait_for_reply` never hold a call longer than `ASK_MAX_WAIT_MS` (50 s). Grok web cuts calls at 60 s; claude.ai retries by itself at about 240 s.
- **Idempotent `ask`.** An `ask` with the same agent, normalised question and options as an open or answered question asked within `ASK_RETRY_WINDOW_MS` returns that question's id and sends nothing. Clients repeat calls on their own.
- **Answers bound to a question.** An answer belongs to its `question_id`. `wait_for_reply(question_id)` returns it every time it is called while the question is retained. A call the client abandoned therefore loses nothing, and correctness never depends on detecting the abort.
- **Option ids.** Button and list ids carry `<question_id>:<option_index>`, so a tap resolves the exact question even when several are open.
- **Validation.** WhatsApp's limits are validated before anything is sent (button title ≤ 20 characters, list row ≤ 24, at most 10 rows), and an error names the field that broke the rule.

### Data flow

```
agent ─MCP─► Worker ─► AccountInbox(account) ─► core use case
                                              ├─ window open  → MessageSender.session(message) → owner
                                              └─ window closed → queue; first one → MessageSender.template(notice)

owner ─► channel (fake now, Cloud API later) ─► Worker ─► AccountInbox ─► core.receive
        ├─ opens the window, flushes the queue in order
        ├─ routes (rules below)
        ├─ a live waiter for that agent → resolve its call
        └─ no waiter → unread inbox + AgentWaker.notify(agent)   (NoneWaker: tells the owner the message waits)
```

Routing of an owner message, first match wins. Rule 0, the account commands, sits in front of these; `accounts-and-keys` writes it and holds the complete order:

1. A button or list reply: the question in the option id (`<question_id>:<index>`), or the agent choice of rule 6 (`route:<message_id>:<agent>`).
2. A quoted reply or a reaction: the agent that sent the quoted or reacted message. A reaction to a question message answers that question with the emoji.
3. A text starting with `@<agent> `: that agent, prefix removed.
4. Exactly one agent with an open question: that agent. With several open questions, the newest wins.
5. The last agent that wrote to the owner within the window; failing that, the only agent when the account has exactly one (`single_agent`: no list is sent).
6. None: zapbip sends the owner a list of the 10 most recently seen agents, with ids `route:<message_id>:<agent>`, and holds the message until the choice arrives; the choice routes every held message to that agent. With no agents at all, the owner gets one text notice (`noAgents`) and the message is held.

A routing list is pending for `ROUTING_LIST_TTL_MS` (10 minutes). Its message id and opening time live in the `owner_window` row, so finding the open list is one primary-key read.

- **While it is pending**, a new message that matches none of rules 1 to 4 joins the held batch and sends no new list. The owner gets one reminder per batch, a reply to the list ("Pick the agent in the list above"). A message that matches a rule from 1 to 4 is routed and never held.
- **On expiry** the alarm runs it as a due-time provider. If an agent wrote within the window (rule 5), the held batch is delivered to it in order. Otherwise the list is sent once more. After a second expiry the batch stays unread for the last agent seen.
- **An expiry assignment tells the owner which agent got the batch** ("You did not pick an agent, so your message went to beta"); the "not listening" notice is only for an agent the owner picked. A resend that fails to send keeps the list's resend flag and moves its due time forward, so the alarm never fires in a loop. An unknown-agent tap resends the list but keeps its opening time, reminder and resend flag.
- **A tap** on a list whose batch was already routed is answered with "That list was already used." A tap naming an unknown agent while the batch is still held sends the current list again.

Media:

- **Outbound with a `url`:** the URL is passed to the channel, so the channel fetches it.
- **Outbound with an `upload_id`:** the bytes uploaded through `create_upload` live in R2, and the channel gets a signed link to them.
- **Inbound:** the channel adapter stores the bytes in R2 at once (Meta's media URL expires after 5 minutes). The agent receives `{media_id, mime_type, size_bytes, filename?, caption?, url}`, where `url` is a signed link valid for `MEDIA_LINK_TTL_MS`. Keys are `accounts/<account_id>/media/<media_id>`; an inbound `media_id` is the message's `wamid`.
- **Retention:** objects are deleted after `MEDIA_RETENTION_MS`.

### Interfaces

Ports in `libs/core`. Signatures are indicative; the plan fixes them. MCP wire fields are snake_case; TypeScript names are camelCase, mapped at the MCP edge.

| Port | Responsibility | This feature's adapter |
|---|---|---|
| `InboxRepository` | persist agents, messages, questions, window, queue | SQLite inside `AccountInbox`; an in-memory one for core tests |
| `MessageSender` | `session(message)` and `template(notice)` to the owner, returning `{channelMessageId}` | `FakeWhatsAppSender`, which records to the simulator screen |
| `MediaStore` | `put`, `get`, `signedLink`, `delete` | `R2MediaStore` |
| `AgentWaker` | `notify({agent, reason})` when an owner message lands with no live waiter; `reason` is the `AgentWakeReason` enum (`MessageWaiting` here) | `NoneWaker` |
| `ConnectionDirectory` | `resolveSecretDigest({secretDigest})` returns `{account_id, agent, owner locale}`, or nothing | `D1ConnectionDirectory` |
| `Clock` | now and timers (`schedule({delayMs, run})`) | the platform clock; a fake clock in tests |
| `IdGenerator` | ids for messages, questions and uploads | the platform's random source; a counter in tests |
| `ReplyWaiters` | the live waiters of `ask` and `wait_for_reply` | in-memory per Durable Object; an in-memory map in tests |

HTTP routes on the Worker:

| Route | Purpose |
|---|---|
| `POST\|GET\|DELETE /c/:secret/mcp` and `/mcp` with Bearer | MCP Streamable HTTP |
| `PUT /u/:account_id/:upload_id?exp=&sig=` | upload bytes for a `create_upload`; the account id is in the path and the HMAC covers purpose, account id, upload id and expiry |
| `GET /m/:account_id/:media_id?exp=&sig=` | signed media link; the HMAC covers purpose, account id, media id and expiry |
| `POST /dev/owner/:phone/messages`, `GET /dev/owner/:phone/screen`, `POST /dev/owner/:phone/clock` | owner simulator, keyed by the owner's phone as WhatsApp keys it. Mounted only by the development entry `src/index.dev.ts`; absent from the production build. |

Constants (in `libs/core`, named, never inline):

| Constant | Value |
|---|---|
| `ASK_MAX_WAIT_MS` | 50 000 |
| `ASK_RETRY_WINDOW_MS` | 4 min (the claude.ai retry cap) |
| `WINDOW_MS` | 24 h |
| `WINDOW_SAFETY_MARGIN_MS` | 10 min |
| `HISTORY_LIMIT` | 20 |
| `QUESTION_RETENTION_MS` | 7 days |
| `QUEUE_RETENTION_MS` | 7 days |
| `MEDIA_RETENTION_MS` | 30 days |
| `MEDIA_LINK_TTL_MS` | 1 h |
| `UPLOAD_TTL_MS` | 15 min |
| `INLINE_IMAGE_MAX_BYTES` | 1 MB |
| `NOTICE_PREVIEW_MAX_CHARS` | 60 |
| `NOTICE_RETRY_MS` | 5 min, doubled per failed attempt (`NOTICE_RETRY_BACKOFF_FACTOR`) up to `NOTICE_RETRY_MAX_MS` (6 h) |
| `WHATSAPP_TEXT_MAX_CHARS` | 4 096 |
| `RECEIPT_RETENTION_MS` | 7 days (the longer of Meta's two stated retry windows) |
| `SECOND_MS`, `MINUTE_MS`, `HOUR_MS`, `DAY_MS` | 1 000, 60 000, 3 600 000, 86 400 000; in `libs/types/src/constants.ts`, used by every slice |
| Agent name pattern | `^[a-z0-9][a-z0-9-]{0,19}$` (at most 20 characters) |

### Failure handling

| Failure | Behaviour |
|---|---|
| Unknown or revoked secret | `401`, the same body for both; no hint which |
| Channel send fails | The tool returns an error naming the kind; the message is stored with `delivery: "failed"` and is not reported as sent |
| Window closed | `delivery: "queued"`; one notice per closed window; queued items older than `QUEUE_RETENTION_MS` become `expired` |
| Notice send fails | The send that owns the notice claim raises a delivery failure that says the message is queued and will be delivered (the tool returns the error) and the message stays `queued`, so a later flush still delivers it; `owner_notice_failed` is logged with the kind and the account only; concurrent sends that lost the claim stay `queued` without error; while queued owner-bound messages exist in a closed window with no notice sent, the alarm retries the notice at the stored `notice_retry_at`, with the spacing doubling per attempt from `NOTICE_RETRY_MS` (5 minutes) up to `NOTICE_RETRY_MAX_MS` (6 hours); the attempts reset on success or when the owner reopens the window |
| Client abandons `ask` or `wait_for_reply` (the Worker cannot see it, per the spike) | The answer stays bound to its `question_id` and the next `wait_for_reply(question_id)` returns it; a plain message handed to a dead call stays in the history `get_messages` returns |
| Durable Object evicted mid-wait | The client's call ends; state is in SQLite; the retry recovers through `question_id` |
| Upload without `Content-Length`, larger than declared, wrong type or after expiry | `411` / `413` / `415` / `410`; nothing stored |
| Upload with a `Content-Length` that is not an integer | `400`; nothing stored |
| Two concurrent PUTs of one upload | the first claims it in the Durable Object; the second answers `409` and never writes to R2; the claim lasts the whole life of the upload (`UPLOAD_CLAIM_TTL_MS` = `UPLOAD_TTL_MS`) and completion and release only count with the matching `claimedAt`; a failed write releases the claim: an R2 failure answers `5xx`, a client abort `400` |
| Expired or forged media link | `403` |
| Invalid tool input | an MCP tool error naming the field and the WhatsApp limit |
| Owner message matches no agent | rule 6: the agent list; with no agents, one text notice and the message is held; an unanswered list expires after `ROUTING_LIST_TTL_MS` |

### Security

- **Secrets.** Connection secrets are 32 random bytes with a `zb_conn_` prefix, stored only as their SHA-256 digest (`connections.secret_digest`, UNIQUE) and looked up by that digest. There is no comparison of secrets across rows. They are never logged. A request's account comes from the secret alone.
- **Account isolation.** The `AccountInbox` id derives from the account id. No route takes an account id from the request, except the media link path, whose account id the HMAC covers.
- **Signed links.** Media links and upload URLs are HMAC-signed with an expiry. Each kind has its own Worker secret: `MEDIA_LINK_SIGNING_KEY` and `UPLOAD_LINK_SIGNING_KEY`. Media links carry the account id in the path; the HMAC covers purpose, account id, media id and expiry. They carry no connection secret.
- **Logs.** Logs carry event names, ids, kinds and sizes. They never carry message text, captions, file names, phone numbers or secrets.
- **Simulator.** The development simulator is not routed in production. A test proves the production build returns 404 for it.

### Language

Repository text is English: code, identifiers, logs, docs, ADRs and specs. Owner-facing text (WhatsApp notices, command replies, template bodies, the install prompt body, the expected-delay and stale notices) is copy: every key has a `pt_BR` and an `en_US` entry in a `*-copy.ts` module, keyed by an enum. The copy modules are `libs/core/src/inbox/inbox-copy.ts`, `apps/api/src/adapters/whatsapp/whatsapp-copy.ts`, `libs/core/src/accounts/account-copy.ts`, `libs/core/src/wake/wake-copy.ts` and `libs/core/src/install/prompts/<client>-copy.ts`. The owner's `OwnerLocale` (`libs/types`) picks the language; `DEFAULT_LOCALE` is `pt_BR`. Agent-facing text (the MCP rules, the wake instruction, the standby pointer, the scheduled task prompt) is English constants in code.

### Storage and migrations

Per-account data lives in the `AccountInbox` Durable Object's SQLite. D1 holds only what resolves a request before the account is known: accounts, connection digests, owner identities, the message index, the blocklist and the daily usage meter.

- D1 migrations, in this order, forward-only once deployed:
  - `0001_core` (this slice): `accounts (id, created_at)`, `connections (id, account_id, agent, secret_digest UNIQUE, created_at)`, `owner_identities (wa_id, account_id, from_user_id, locale, created_at)` and `message_index (wamid, account_id, created_at)`. The channel reads the last two from its first commit.
  - `0002_accounts_and_keys` (`accounts-and-keys`): rebuilds `accounts`, `owner_identities` and `connections` in their final shape, and adds `blocked_phones`.
  - `0003_usage` (`deploy-readiness`): `usage_daily`.
  - Wake and scheduled state add no D1 migration.
- `AccountInbox` SQLite schema versions, applied when the object starts by a runner that records the set of applied versions and applies each missing one in ascending order (reserved: v1 to v7 across slices):
  - `v1` (this slice): `inbox_messages (id, agent, direction, kind, payload, reply_to, delivery, read_at, at)`, `questions`, `channel_receipts (wamid PRIMARY KEY, received_at)`, `agent_wake (agent PRIMARY KEY, mode, last_polled_at, updated_at)`, the window and the queue.
  - `v2` (`webhook-wake`): `agent_wake` gains `provider`, `host`, `sealed_target`, `key_version`, `status`, `last_delivered_at`; table `wake_jobs`.
  - `v3` (`scheduled-wake`): `agent_wake` gains `interval_minutes`, `standby_agent`, `poller_stale_notified`; `inbox_messages` gains `handed_to`; index `inbox_messages_unread`.
- The `agent_wake` row (mode `None`, `last_polled_at` set to now) is written on the agent's first contact, in the same call that registers the agent in its inbox.
- One alarm per object. `alarm()` catches every error, runs the due work of the expiry sweep, wake jobs and poller checks in that order, and re-arms the alarm to the earliest deadline any of them reports. The alarm is never moved later: a tool call re-arms it at the earliest due time, but an alarm already armed earlier stays, so an agent polling faster than the five-second minimum delay cannot postpone a due expiry.
- `sweepExpired({now})` expires media, questions and queued messages. The alarm runs it; no cron runs in slice 1.

### Docs (Mintlify, `apps/docs`)

- **Pages:** the single navigation of `apps/docs/docs.json`, which every slice adds its pages to. Paths are unique across the site:
  - Introduction: `index`
  - Concepts: `concepts/inbox`, `concepts/questions`, `concepts/24-hour-window`, `concepts/routing`, `concepts/wake-ladder` (this slice), `concepts/whatsapp-channel` and `concepts/owner-notices` (whatsapp-cloud-channel)
  - Guides: `guides/commands`, `guides/agents-and-links`, `guides/account-deletion` (accounts-and-keys), `guides/webhook-wake` (webhook-wake)
  - Connect: `connect/local-connector` (local-connector)
  - Install: `install/claude-code`, `install/codex`, `install/grok-bot`, `install/claude-ai`, `install/chatgpt`, `install/grok-web` (install-skills)
  - MCP reference, one page per tool with the message-kind table: `mcp-reference/send-message`, `send-media`, `send-location`, `send-contact`, `react`, `ask`, `wait-for-reply`, `get-messages`, `check-inbox`, `create-upload` (this slice) and `set-wake` (webhook-wake)
- **Gate:** `pnpm dlx mint@4.2.1207 broken-links` joins `pnpm verify` for `apps/docs/**`.
- **Preview:** the site runs locally with `pnpm --filter @zapbip/docs dev`.

### Gates this feature adds

`scripts/verify-gates.tsv` gets rules for:

- `libs/types/**`: unit, typecheck, and the `apps/api` Workers integration and E2E gates (A21), because an enum reaches the Worker;
- `libs/core/**`: unit, typecheck, and the `apps/api` Workers integration and E2E gates, because a core rule reaches the Worker;
- `apps/api/**`: unit, Workers integration, typecheck, E2E (E2E runs by default; only the Claude Code cases are opt-in, through `ZAPBIP_CLAUDE_E2E=1`);
- `apps/docs/**`: docs links.

The E2E gate that [ADR 0005](../../adr/0005-the-local-gate-runs-what-the-diff-can-break.md) deferred until the first app arrives comes back here. Each new package gets a README stating its purpose, and its root entry is added to `delivery-docs.test.ts`.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| How do agents reach the owner and the owner reach them? | A only MCP · B inbox + wake · C plugins first | B | 2026-11-06 |
| Two-way for clients without a native wake? | standby agent · scheduled task · inbox only | a wake ladder (local, webhook, scheduled, standby, inbox), set up by an install skill | 2026-11-06 |
| Identity | key per account + agent in URL · secret per connection in the URL | one secret per connection in the URL, header optional | 2026-11-06 |
| Code structure | one service · core behind ports | core behind ports | 2026-11-06 |
| Hosting | Railway · Vercel · Cloudflare | Cloudflare, free tier first | 2026-11-06 |
| Public docs | Mintlify · none yet | Mintlify | 2026-11-06 |
| WhatsApp 24-hour window | model it now · leave to the channel feature | model it now | 2026-11-06 |
| Message kinds | text only first · all kinds both ways | all kinds both ways | 2026-11-06 |
| End-user install | per-client guides · paste one prompt into the AI | paste one prompt; web chats still need the owner to paste the URL | 2026-11-06 |
| First slice | `agent-inbox-core` with a fake WhatsApp | approved | 2026-11-06 |
| Where does per-account data live? | D1 · Durable Object SQLite | Durable Object SQLite; D1 holds the directory only (see Storage and migrations) | owner delegated 2026-11-06 |
| Migration order | one migration per slice · by what holds D1 data | `0001_core`, `0002_accounts_and_keys`, `0003_usage`; wake and scheduled state add none | owner delegated 2026-11-06 |
| Wake vocabulary | `rung` input · `WakeMode` and `WakeSetting` union on `mode` | `WakeMode` (stored) and `WakeRung` (effective) enums; `set_wake` takes the union on `mode` | owner delegated 2026-11-06 |
| Language of owner-facing copy | English only · pt_BR and en_US | `pt_BR` and `en_US` in `*-copy.ts` keyed by an enum; agent-facing text is English | owner delegated 2026-11-06 |
| Package and path names | free per slice · one list | `apps/api`, `apps/connector`, `apps/docs`, `libs/core`, `libs/types`; one `docs.json` navigation | owner delegated 2026-11-06 |
| Ports beyond the six | add ports · keep six | `IdGenerator` and `ReplyWaiters` join the core ports; `Clock` gains `schedule({delayMs, run})` for timers | owner delegated 2026-11-06 |
| Names in code | keep spec names · rename | `signedUrl` is `signedLink` and the core field is `link` (no acronyms in identifiers); wire fields `url`, `upload_url` keep the spec's spelling | owner delegated 2026-11-06 |
| Simulator routes | keyed by secret · keyed by owner phone | owner phone, as WhatsApp keys it: `POST /dev/owner/:phone/messages`, `GET /dev/owner/:phone/screen`, `POST /dev/owner/:phone/clock`; mounted only by the development entry | owner delegated 2026-11-06 |
| Development owner seed | — | `pnpm --filter @zapbip/api dev:seed -- --phone <digits> --agents <a,b>` creates the account, the owner identity (`pt_BR`) and one connection per agent in the local D1; it prints the URLs once; slice 3 replaces it with "novo agente" | owner delegated 2026-11-06 |
| Agent name cap | 32 characters · 20 | at most 20 characters, pattern `^[a-z0-9][a-z0-9-]{0,19}$`; fits the button title and list row limits | owner delegated 2026-11-06 |
| E2E in the gate | E2E opt-in · E2E default | the E2E suite runs by default in the `e2e` gate; only the Claude Code cases (CC-*) are opt-in through `ZAPBIP_CLAUDE_E2E=1` | owner delegated 2026-11-06 |
| Second unmatched message while a routing list is open | a new list · joins the held messages | it joins the held messages and sends no new list, and the owner gets one reminder per batch; a choice routes every held message to the chosen agent | owner delegated 2026-11-06 |
| Routing list lifetime | no expiry · expiry with a fallback | the list is pending for `ROUTING_LIST_TTL_MS` (10 minutes); on expiry the batch goes to the rule 5 agent, else the list is sent once more, and after a second expiry the batch stays unread for the last agent seen | owner delegated 2026-11-06 |
| Open list lookup | scan the messages · a column | the open list's message id is recorded in the `owner_window` row (v1 is not deployed, so `v1.sql` is edited) | owner delegated 2026-11-06 |
| Used-list copy | "expired" · "already used" | `RoutingListExpired` reads "Essa lista já foi usada." / "That list was already used."; a tap naming an unknown agent while the batch is held sends the current list again | owner delegated 2026-11-06 |
| Concurrent upload PUTs | claim in the route · claim in the object | the object claims the upload atomically (`claimed_at`) before the R2 write; the loser answers `409`; the claim lasts the whole life of the upload (`UPLOAD_CLAIM_TTL_MS` = `UPLOAD_TTL_MS`); completion and release only count with the matching `claimedAt`; an R2 failure answers `5xx` and a client abort answers `400`, both release the claim | owner delegated 2026-11-06 |
| Media types | compare as sent · normalise | lowercase and drop parameters before every check; `image/SVG+XML` and `image/svg+xml;x=1` are not images; the normalised type must also be a `type/subtype` token (RFC 6838 characters only), so `image/svg+xml,image/png` is invalid input; the type as sent is printable ASCII with no surrounding whitespace, so `' Application/PDF'` is invalid input | owner delegated 2026-11-06 |
| Production D1 id | local id · placeholder | the top-level `database_id` is `REPLACE_WITH_PRODUCTION_D1_DATABASE_ID`; `wrangler deploy` rejects it until the owner replaces it with the created database id | owner delegated 2026-11-06 |
| Notice quick reply | routed to an agent · window only | a tap on the notice's quick reply only opens the window and flushes the queue; it is never delivered to an agent | owner delegated 2026-11-06 |
| Development clock offset | in memory · in Durable Object storage | the offset is stored in Durable Object storage, so it survives a restart | owner delegated 2026-11-06 |
| Media port | remove `put` · keep, with a known length | `put` has two callers at the edge (the upload route and the simulator); it takes `sizeBytes` because R2 needs a known length | owner delegated 2026-11-06 |
| Buttons and lists | two kinds · one kind `choice` | one kind, `choice`, in both directions (the spec's kind table has one row); a prompt has `selected` null | owner delegated 2026-11-06 |
| Owner locale | — | `OwnerLocale` (`pt_BR`, `en_US`) is declared by slice 1 in `libs/types` and carried on the connection identity; the additions file's row 5 adds no values | owner delegated 2026-11-06 |
| Where media and agents live in the object | not in the v1 list · in the object | the v1 schema adds an `agents` table (routing rule 6 needs last-seen times) and a `media` table (upload deadlines and retention); agent wake rows are created on first contact, not by the connection write | owner delegated 2026-11-06 |
| Media keys and the message index | — | media is stored at `accounts/<account_id>/media/<media_id>`; `message_index` maps a media id (an inbound `wamid` or an upload id) to its account, the media path carries the account id and the HMAC covers it (A23); the index serves reply routing, not the media route | owner delegated 2026-11-06 |
| Repository and ownership of this spec | — | the lead owns `docs/features/**`, the ADRs, the indexes and the status flips; each lane writes its own section of `tester-briefing.md` | owner delegated 2026-11-06 |
| ADR amendments | — | ADR 0008 names eight ports; ADR 0006 looks secrets up by digest (no constant-time comparison across rows) | owner delegated 2026-11-06 |
| Upload and media routes | `PUT /u/:id?token=` · under the secret, media by unguessable id | upload `PUT /u/:account_id/:upload_id?exp=&sig=` (the connection secret never appears in a tool result; the account id is in the path and the HMAC covers it); media `GET /m/:account_id/:media_id?exp=&sig=` carries no secret; the account id is in the path and the HMAC covers it | owner delegated 2026-11-06 |
| Production entry | — | `src/index.ts` never imports the simulator; `src/index.dev.ts` is the only entry that mounts it, and it is the `env.development` block that `wrangler dev --env development` runs | owner delegated 2026-11-06 |
| Idempotent `ask` | unanswered only · open or answered within a retry window | a repeat matches a question of the same agent, normalized text and options asked within 4 min (`ASK_RETRY_WINDOW_MS`, the claude.ai retry cap), open or answered; a matched retry holds like a fresh `ask` | owner delegated 2026-11-06 |
| Owner text that answers | — | text routed to an agent with an open question answers that agent's newest open question; a tap on an answered or expired question is routed as a message with `reply_to`; a tap on an unknown question is routed as text | owner delegated 2026-11-06 |
| Owner media, location, contacts | answer · route only | they route by rules 2, 4, 5 and 6 and never answer a question | owner delegated 2026-11-06 |
| Rule 5 window | — | "within the window" means the 24 h (`WINDOW_MS`) before the owner's message | owner delegated 2026-11-06 |
| Rule 6 | — | the routing question lists the 10 most recently seen agents; with zero agents the owner gets one text notice and the message is held | owner delegated 2026-11-06 |
| Account with exactly one agent | list of one option · deliver to it | rule 5 falls back to the only agent, so an unaddressed owner message reaches it and no routing list is sent; an account with several agents is unchanged | owner delegated 2026-11-06 |
| Present-tense docs for later slices | hedge every claim · describe the shipped MVP | the docs describe the shipped MVP in the present tense; nothing deploys until every slice is on `main` and docs-experience verifies every claim (reviewer finding 3 rejected) | owner order 2026-11-06 |
| Read limits | — | `limit` 1 to 20 bounds the unread messages returned and the history; `check_inbox` returns up to 20 unread; the rest stay unread | owner delegated 2026-11-06 |
| `wait_for_reply` without a question | — | returns unread messages at once; otherwise waits for the agent's next owner message, re-waits if another call took it, and times out at its deadline; an answer read through `wait_for_reply(question_id)` is marked read | owner delegated 2026-11-06 |
| Waking notice | a notice per message · per unread batch | `NoneWaker` returns `unreached`; core sends one waiting notice (`inbox-copy.ts`, `pt_BR` and `en_US`) when the agent's unread count goes from 0 to 1 | owner delegated 2026-11-06 |
| Secret comparison | byte comparison in app · lookup by digest | a secret is looked up by its SHA-256 digest in D1 (`secret_digest`, UNIQUE); the app never compares secrets; signed links are checked with `crypto.subtle.verify` | owner delegated 2026-11-06 |
| Media limits | — | image 5 MB, video 16 MB, audio and voice 16 MB, document 100 MB, sticker 100 KB as static `image/webp`; MB is 1 000 000 bytes; `create_upload` checks size and a non-empty MIME, the kind is checked at send; the upload PUT needs `Content-Length` equal to the declared size (larger 413, smaller 400) and a matching `Content-Type` (415) | owner delegated 2026-11-06 |
| Timeouts | — | `timeout_seconds` is an integer from 1 to 50, default 50 for `ask` and `wait_for_reply` | owner delegated 2026-11-06 |
| Expiry | — | the Durable Object alarm runs `sweepExpired` for media, questions and queued messages; queued messages are also checked before each flush | owner delegated 2026-11-06 |
| MCP transport | SSE · JSON | stateless Streamable HTTP with JSON responses | owner delegated 2026-11-06 |
| Test runner versions | one Vitest · one per package | `apps/api` on Vitest 4.1.12, because `@cloudflare/vitest-pool-workers` 0.23.0 peers `vitest ^4.1.0`; `libs/core` on Vitest 5.0.5 | owner delegated 2026-11-06 |
| Text, caption and emoji limits | — | text 4096 and question 1024 and caption 1024 characters, counted by code point; button titles 20 and list rows 24 characters; one emoji grapheme; `whatsapp-cloud-channel` confirms the channel's exact limits | owner delegated 2026-11-06 |
| Copy language | — | owner-facing copy in `pt_BR` and `en_US` (Language); agent tool output and errors in English | owner delegated 2026-11-06 |
| Message sender fields | — | every message carries `sender` (`owner` or `agent`) and `verified` (`true` for owner messages) | owner delegated 2026-11-06 |
| Development clock | — | `POST /dev/owner/:phone/clock` with `advance_ms` offsets the clock in the development entry only, so the E2E suite can walk the closed window | owner delegated 2026-11-06 |
| Claude Code session runs | in CI · after owner go-ahead | the six Claude Code cases call the model, so they run only after the owner's go-ahead at tester time | owner delegated 2026-11-06 |
| Secret lookup naming | — | `ConnectionDirectory.resolveSecretDigest({secretDigest})`; column `connections.secret_digest` (`0001_core`) | owner delegated 2026-11-06 |
| Base URL binding | `PUBLIC_BASE_URL` · `PUBLIC_ORIGIN` | `PUBLIC_ORIGIN` only; every link is built from it | owner delegated 2026-11-06 |
| Health route | — | `/health` returns `{ok: true}`; later slices add fields to the same body | owner delegated 2026-11-06 |
| Wrangler environments | — | the top-level block is production (`src/index.ts`, `PUBLIC_ORIGIN` `https://mcp.zapbip.com`); `env.development` (`src/index.dev.ts`, localhost origin) repeats every binding and every `wrangler dev` passes `--env development`; the production-bundle test checks the top-level block; `deploy-readiness` adds `env.staging` | owner delegated 2026-11-06 |
| Development-only methods | in the base class · in a development subclass | `readScreen` and `advanceClock` exist only on `DevAccountInbox`, which the development entry exports as `AccountInbox`; a test proves the production bundle lacks them | owner delegated 2026-11-06 |
| Object migrations | — | the runner records the set of applied versions and applies each missing one in ascending order; reserved versions v1 to v7 | owner delegated 2026-11-06 |
| Expiry | — | per-object alarms; no cron in slice 1 | owner delegated 2026-11-06 |
| Wake reason name | `WakeReason` · `AgentWakeReason` | `AgentWakeReason`, slice 1's merged name, is kept; later slices adapt | owner delegated 2026-11-06 |
| Seed runner | node script · `tsx` | the seed is a pure function that returns SQL; `dev:seed` runs it through `wrangler d1 execute --local --persist-to <dir>` under `tsx` 4.23.15, a root devDependency | owner delegated 2026-11-06 |
| Shared time constants | — | `SECOND_MS`, `MINUTE_MS`, `HOUR_MS` and `DAY_MS` live in `libs/types`; core constants import them | owner delegated 2026-11-06 |
| Owner locale source | — | slice 1 reads `owner_identities.locale` through the connection identity; `accounts-and-keys` later sets it at account creation | owner delegated 2026-11-06 |

Spike of 2026-11-06 (throwaway; results in [ADR 0009](../../adr/0009-cloudflare-workers-with-one-durable-object-per-account.md#evidence)):

| Question | Answer | What it changed |
|---|---|---|
| Can a Worker hold a 50 s MCP call? | yes, in JSON and SSE modes | nothing |
| Does the Worker see a client abort? | no, locally | answers stay retrievable by `question_id`; messages stay in history |
| Does a 50 MB upload reach R2? | yes, only with `Content-Length` | the upload route requires `Content-Length` (`411` without it) |
| How many held calls fit the Durable Object free allowance? | about 2 080 holds of 50 s a day | recorded; a paid plan is the first scaling step |

## Test strategy summary

- **`libs/core` unit (Vitest, fake clock, in-memory ports):**
  - every routing rule;
  - opening, closing and the safety margin of the window;
  - one notice per closed window;
  - queue flush order;
  - `ask` idempotency;
  - answer retrieval by `question_id` after an abandoned call;
  - option ids;
  - every validation limit;
  - every message kind's shape;
  - every copy key in `pt_BR` and `en_US`;
  - the zero-agent case of rule 6 and the `route:` choice.
- **`apps/api` integration (`@cloudflare/vitest-pool-workers`, real workerd, D1, R2, Durable Objects):**
  - MCP over HTTP for all ten tools;
  - `401` for unknown and revoked secrets;
  - isolation between two accounts;
  - state surviving a Durable Object restart;
  - uploads with their limits;
  - signed links;
  - the simulator absent from the production build.
- **E2E:** an MCP client from the SDK and a real Claude Code session against `wrangler dev`, with the owner simulator answering, in both directions and for every kind. The run is recorded for the PR.
- **Docs:** `mint broken-links` green.
