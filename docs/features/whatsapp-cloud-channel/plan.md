# WhatsApp Cloud channel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fake WhatsApp of `agent-inbox-core` with the Meta WhatsApp Cloud API adapter: a signed inbound webhook, outbound session and template sends for every kind, inbound media stored in R2, idempotent inbound handling, status updates, the channel-reported closed window, and the two owner notice templates.

**Architecture:** The core stays pure. Four additive core pieces (`closeWindow`, `openWindow`, `applyStatus`, `receiveChannelMessage`) and a `ChannelError` carry the channel facts. `apps/api/src/adapters/whatsapp/` holds the Graph client, the parsers, the builders and the error table. The Worker route verifies the signature, maps the number to an account in D1 and downloads media before any Durable Object call. `AccountInbox` commits the receipt and the message in one call, compensating the receipt when the commit throws.

**Tech Stack:** As `agent-inbox-core`, plus `zod` 4.6.7 (already pinned there) for webhook payloads. No new dependency.

**Spec:** `docs/features/whatsapp-cloud-channel/spec.md` (lands with the branch at Step W0). The spec's "Open questions → answers" table binds this plan. The decisions this plan adds on top of it are listed in **Assumptions** and must be copied into that table at Step W0.

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

## Assumptions (decided, owner can override)

Every divergence from slice 1 is marked `(contract: confirm at build)`. The first step, W-1, resolves them against `main`.

- **A1 Owner recipient and locale.** The adapter resolves `wa_id` by `AccountDirectory.findOwnerByAccountId({accountId})` (D1). The owner locale is the account's `OwnerLocale` (set by accounts-and-keys at account creation; this slice reads it, never owns it). The Durable Object's RPC wrapper reads it before each call that may send and passes it in `CoreDependencies.ownerLocale`; core passes it to `MessageSender.template({kind, parameters, locale})`. `(contract: confirm at build)`.
- **A2 Reply and reaction targets.** The core resolves `replyToChannelMessageId` and `reactionTargetChannelMessageId` (`InboxRepository.findChannelMessageId`) and passes them to `session`. The sender never reads the repository. A reaction whose target has no channel id is refused by the core with an error naming `reaction.message_id`.
- **A3 Channel-closed window.** `OwnerWindow.closedAt` is set by `closeWindow({at})` and cleared by `openWindow`. A send at or after `closedAt` sees a closed window. The arithmetic is unchanged. `openWindow({at})` stores `max(lastOwnerMessageAt, at)`, so an out-of-order timestamp never moves the window back.
- **A4 Quick-reply tap and unsupported kinds.** A `button` inbound runs `openWindow` and stores no message. An `unsupported` inbound runs `openWindow` and sends one session text with the copy `unsupportedKind` in the owner's locale.
- **A5 Media unavailable.** `MediaSourceKind.Unavailable` is added. Inbound media content carries `mediaId: string | null`; `null` means the bytes could not be stored. The agent sees `media: null` and `media_status: "unavailable"`.
- **A6 Media ids and keys.** The inbound `mediaId` is `med_` plus the SHA-256 hex of the `wamid`, so a retry writes the same key. The R2 key is `accounts/<accountId>/media/<mediaId>` (ratified). The signed link is `/m/<accountId>/<mediaId>?exp=&sig=`, whose HMAC covers purpose, account id, media id and expiry. `(contract: confirm at build)` against slice 1's media route and `MEDIA_LINK_SIGNING_KEY`.
- **A7 Atomic commit.** The Durable Object runs one `transactionSync` that inserts the `channel_receipts` row (insert-or-ignore, through the SQLite adapter's `recordChannelReceipt`), inserts the message, and saves the window. `commitChannelInbound` returns `false` when the receipt already exists, and then nothing is written. Flush, answer, waiters and wake run after the commit and never delete the receipt. A throw before the commit rolls back, so no receipt remains and the retry stores once. A throw after the commit leaves the message stored, and the retry returns `duplicate: true`. This replaces the compensation rule of the first plan; ADR 0013 is amended to match. Slice 1's `receiveOwnerMessage` order changes accordingly: window and flush move after the commit. `(contract: confirm at build)`.
- **A8 Restriction switch with TTL.** A send that returns `131048` or `368` writes a row to D1 `channel_restrictions` and logs the operator alert `channel.restricted` at error level. A row blocks sends for `RESTRICTION_TTL_MS` (24 h); after that the row is ignored. An operator clears it earlier by deleting the row (runbook: `deploy-readiness`).
- **A9 Template parameters and buttons.** `zapbip_agent_notice` and `zapbip_agent_question` are sent with a `body` component only. The quick reply has fixed text.
- **A10 Unknown error codes.** `133010` maps to `Restricted`. `131021` maps to `DeliveryFailed`. `190` and HTTP `401` map to `Auth`. Any other error on a template send maps to `TemplateRejected`; any other error maps to `Unknown`. One table in `channel-error-mapping.ts`, asserted row by row.
- **A11 Media checks on links.** MIME and size are checked only when known. An unknown size is not refused; Meta enforces its limit and the error maps to `MediaRejected` (`131053`).
- **A12 Outbound sticker.** `OUTBOUND_STICKER_MAX_BYTES` = 100 KB, from `BYTES_PER_KILOBYTE` = 1 000 in core constants. Core `STICKER_MAX_BYTES` is unchanged. Animated stickers are not detected.
- **A13 Playback status.** `played` is logged as `status.ignored` and changes nothing.
- **A14 Media hosts.** The metadata `url` is parsed with `new URL`. Only `protocol === 'https:'` and a `hostname` equal to, or ending with `.` plus, an entry of `WHATSAPP_MEDIA_HOST_SUFFIXES` (`fbcdn.net`, `fbsbx.com`, `whatsapp.net`) is fetched. Userinfo and path tricks (`lookaside.fbsbx.com@evil.com`, `evil.com/.fbsbx.com`) fail because the hostname is `evil.com`. Downloads use `redirect: 'manual'`; any 3xx is a failed download. `(contract: confirm at build)` on the suffix list.
- **A15 Media hash encoding.** The webhook `sha256` and the Graph `sha256` are compared as base64 SHA-256 of the bytes. `(contract: confirm at build)`; owner-run probe OR-5 checks the encoding on a real media.
- **A16 Signature and token comparison.** The HMAC is checked with `crypto.subtle.verify` over the raw bytes, multibyte bodies included. The verify token is compared through digests with `crypto.subtle.timingSafeEqual`. `(contract: confirm at build)`.
- **A17 Durable Object account identity.** `AccountInbox` reads its account from `ctx.id.name`; a missing name throws.
- **A18 Logs.** `logOperatorEvent({event, fields})` takes fields keyed by the enum `OperatorLogField` (`ErrorCode`, `TemplateName`, `LanguageCode`, `Reason`, `MessageKind`, `UnsupportedType`, `ChannelMessageId`). Never a phone number, a message body or a token.
- **A19 Base URL.** `WHATSAPP_GRAPH_BASE_URL` is a top-level (development) var with `http://127.0.0.1:4011`. `deploy-readiness` adds `env.staging` and `env.production` with the Graph host. A missing value throws. `(contract: confirm at build)`.
- **A20 Schema.** This slice ships D1 migration `0004_whatsapp_channel.sql` (`channel_restrictions (phone_number_id PRIMARY KEY, error_code, restricted_at)`) and DO schema `v4`: `inbox_messages.channel_message_id` (UNIQUE, nullable), `error_code`, `error_title`, `pricing_category`, `billable`, `claimed_at`; `window.closed_at`. It reuses `0001_core`'s `owner_identities` and `message_index (wamid, account_id, created_at)` unchanged, and DO `v1`'s `channel_receipts`. Nothing in `0001` or `v1` is edited. `(contract: confirm at build)`.
- **A21 Core contract additions.** Listed in the section **Core contract additions**. The orchestrator merges them into `core-contract-additions.md`.
- **A22 Flush claims.** Queued messages are claimed in one transaction: `claimQueuedMessages` sets `DeliveryState.Sending` and `claimed_at` before any Graph await. A success sets `Sent`. A `WindowClosed` returns the claimed message and the rest to `Queued` and stops. Any other error sets `Failed` and the flush continues. The alarm sweep returns `Sending` rows claimed more than `SENDING_STALE_MS` (60 s) ago to `Queued`. `(contract: confirm at build)`.
- **A23 Flush per message.** Errors are caught per message. The flush stops at the first `WindowClosed` and leaves the rest `Queued`; one notice is sent for the closed window.
- **A24 Media streaming.** The download body streams through `crypto.DigestStream` into `R2.put` wrapped in `FixedLengthStream(declaredSize)`. After the put, the digest is compared with the webhook `sha256`; a mismatch deletes the object and yields Unavailable. A body longer than the declared size errors the stream and yields Unavailable. `(contract: confirm at build)` that the Workers runtime exposes `crypto.DigestStream` and `FixedLengthStream` on the pinned `compatibility_date`.
- **A25 Media refresh and failures.** A `404` on the download URL re-requests `GET /{media-id}` once; a second `404` yields Unavailable. `131052` yields Unavailable. A `5xx` or a timeout on any media request returns `500` for the webhook. No receipt exists for that message yet, so Meta's retry is safe.
- **A26 Parse per change and per message.** The notification is parsed per `entry[].changes[]`. Each change is checked for its own `metadata.phone_number_id`: foreign changes are logged and skipped. A change whose `field` is neither `messages` nor `statuses` is logged (`notification.ignored_field`) and skipped. Each message is parsed on its own: an unknown `type` becomes `Unsupported` with that type; a missing or invalid `from` is logged as `inbound.unmapped` with no phone number and skipped. A bad entry never fails the batch. Only a body that is not JSON, or has no `entry` array, returns `400`.
- **A27 Unindexed status.** A status for an unknown `wamid` returns `503` while its `timestamp` is less than `UNINDEXED_STATUS_RETRY_WINDOW_MS` (10 min) old, so Meta retries. After that it logs `status.unindexed` and returns `200`.
- **A28 Status detail merge.** `saveChannelStatusDetail` writes only non-null values: `errorCode`, `errorTitle` (the first error's `title`), `pricingCategory`, `billable`. A null never overwrites a stored value.
- **A29 Development sender selection.** `index.dev.ts` calls `registerDevelopmentSender(factory)` at module load. `AccountInbox` uses the Cloud API sender when `WHATSAPP_ACCESS_TOKEN` is set, else the registered fake. `index.ts` never registers, so production with no WhatsApp variables throws instead of falling back. The fake is absent from the production bundle. `(contract: confirm at build)`.
- **A30 Shared time constants.** `SECOND_MS`, `MINUTE_MS`, `HOUR_MS`, `DAY_MS` come from `libs/types` (slice 1). No local copies. This plan's `ONE_*` names map to them. `(contract: confirm at build)`.
- **A31 Failure after commit.** A flush or wake failure after the commit leaves the new message stored and the queue as it was; the queue is flushed by the next owner message or by the alarm. Meta gets its `200`, so it does not retry.
- **A32 Restriction before template.** A restricted account refuses sends before the template is built; the refusal is `Restricted`, not `TemplateRejected`.

## Contract (Step W0, verbatim)

Step W0 lands these files first, on the feature branch, in one commit. Every lane builds against them. Changing a signature after W0 means a new W0 commit that every lane merges.

### `libs/types` (consumed; created by agent-inbox-core)

`OwnerLocale` is imported from `@zapbip/types`. If `libs/types/src/owner-locale.ts` is absent at W0, W0 adds exactly this file (accounts-and-keys reuses it):

```ts
export enum OwnerLocale {
  PortugueseBrazil = 'pt_BR',
  EnglishUs = 'en_US',
}
```

### `libs/core/src/constants.ts` (additions)

```ts
export const BYTES_PER_KILOBYTE = 1_000;
export const RECEIPT_RETENTION_MS = 7 * ONE_DAY_MS;
```

### `libs/core/src/enums.ts` (additions; the existing members stay)

```ts
export enum DeliveryState {
  Sent = 'sent',
  Queued = 'queued',
  Failed = 'failed',
  Expired = 'expired',
  Delivered = 'delivered',
  Read = 'read',
  Sending = 'sending',
}

export enum MediaSourceKind {
  Link = 'link',
  Stored = 'stored',
  Unavailable = 'unavailable',
}

export enum ChannelErrorKind {
  DeliveryFailed = 'delivery_failed',
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

### `libs/core/src/errors.ts` (addition)

```ts
export class ChannelError extends Error {
  readonly kind: ChannelErrorKind;
  readonly errorCode: number | null;

  constructor(input: { kind: ChannelErrorKind; message: string; errorCode: number | null }) {
    super(input.message);
    this.kind = input.kind;
    this.errorCode = input.errorCode;
  }
}
```

`message` is the English text an agent reads (the tool error); the kind is what the core stores.

### `libs/core/src/message.ts` (change)

```ts
export type MediaSource =
  | { kind: MediaSourceKind.Link; link: string }
  | { kind: MediaSourceKind.Stored; mediaId: string }
  | { kind: MediaSourceKind.Unavailable };
```

### `libs/core/src/inbox-records.ts` (changes)

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

### `libs/core/src/ports.ts` (changes)

```ts
import type { OwnerLocale } from '@zapbip/types';

export interface InboxRepository {
  commitChannelInbound(input: {
    channelMessageId: string;
    receivedAt: number;
    message: Message | null;
    window: OwnerWindow;
  }): Promise<boolean>;
  pruneChannelReceipts(input: { receivedBefore: number }): Promise<void>;
  saveChannelMessageId(input: { messageId: string; channelMessageId: string }): Promise<void>;
  findMessageByChannelMessageId(input: { channelMessageId: string }): Promise<Message | null>;
  findChannelMessageId(input: { messageId: string }): Promise<string | null>;
  saveChannelStatusDetail(input: { messageId: string; detail: ChannelStatusDetail }): Promise<void>;
  claimQueuedMessages(input: { claimedAt: number; limit: number }): Promise<Message[]>;
  releaseStaleClaims(input: { claimedBefore: number }): Promise<void>;
}

export type CoreDependencies = {
  // every slice 1 field, unchanged, plus:
  ownerLocale: OwnerLocale;
};

export interface MessageSender {
  session(input: {
    message: Message;
    question: Question | null;
    replyToChannelMessageId: string | null;
    reactionTargetChannelMessageId: string | null;
  }): Promise<{ channelMessageId: string }>;
  template(input: { kind: TemplateKind; parameters: string[]; locale: OwnerLocale }): Promise<{ channelMessageId: string }>;
}
```

`commitChannelInbound` is the one write path for an inbound message. The SQLite adapter runs it in one `transactionSync`: the private step `recordChannelReceipt` (insert-or-ignore on `channel_receipts`), the message insert and the window save. It returns `false` and writes nothing when the receipt exists. `message` is `null` for a window-only entry. `claimQueuedMessages` sets `Sending` and `claimed_at` in one transaction. `saveChannelMessageId` ignores a second write for the same message. `(contract: confirm at build)`: slice 1 declares no `recordChannelReceipt` port method; the name is kept for the adapter's private step.

### `libs/core/src/use-cases/types.ts` (additions)

```ts
export type ChannelInboundEntry =
  | {
      kind: ChannelInboundKind.Owner;
      at: number;
      content: OwnerInboundContent;
      replyToChannelMessageId: string | null;
      noticeText: string | null;
    }
  | { kind: ChannelInboundKind.WindowOnly; at: number }
  | { kind: ChannelInboundKind.Unsupported; at: number; noticeText: string };

export type ReceiveChannelInput = {
  dependencies: CoreDependencies;
  channelMessageId: string;
  entry: ChannelInboundEntry;
};
export type ReceiveChannelResult = { duplicate: boolean };

export type OpenWindowInput = { dependencies: CoreDependencies; at: number };
export type CloseWindowInput = { dependencies: CoreDependencies; at: number };

export type ApplyStatusInput = {
  dependencies: CoreDependencies;
  channelMessageId: string;
  status: DeliveryState.Sent | DeliveryState.Delivered | DeliveryState.Read | DeliveryState.Failed;
  detail: ChannelStatusDetail;
};
export type ApplyStatusResult = { applied: boolean };
```

`OwnerInboundContent`'s media variant changes its `mediaId` to `string | null` (`null` is Unavailable, A5). Its `noticeText` is sent once as a session text when the content is Unavailable media.

### Use-case signatures (one file each under `libs/core/src/use-cases/`)

```ts
export function receiveChannelMessage(input: ReceiveChannelInput): Promise<ReceiveChannelResult>; // receive-channel-message.ts
export function openWindow(input: OpenWindowInput): Promise<void>;                                  // open-window.ts
export function closeWindow(input: CloseWindowInput): Promise<void>;                                // close-window.ts
export function applyStatus(input: ApplyStatusInput): Promise<ApplyStatusResult>;                  // apply-status.ts
export function applyStatusRule(input: { current: DeliveryState; incoming: ApplyStatusInput['status'] }): { next: DeliveryState | null; logged: boolean }; // status-rule.ts (pure)
```

`libs/core/src/index.ts` and `use-cases/index.ts` re-export every new module.

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

The four `WHATSAPP_*` secrets are optional in the type so the development entry can run with the fake sender (A29). `readWhatsAppEnvironment` makes them required when the Cloud API sender is selected. `(contract: confirm at build)`.

### `apps/api/src/contract/account-inbox-rpc.ts` (additions to the interface)

```ts
receiveChannelMessage(input: AgentRequest<ReceiveChannelInput>): Promise<CallOutcome<ReceiveChannelResult>>;
applyChannelStatus(input: AgentRequest<ApplyStatusInput>): Promise<CallOutcome<ApplyStatusResult>>;
```

`AccountInbox` implements both as stubs in W0.

### `apps/api/src/contract/constants.ts` (addition)

```ts
export const WHATSAPP_WEBHOOK_PATH = '/webhooks/whatsapp';
```

### `apps/api/src/adapters/whatsapp/whatsapp-constants.ts`

```ts
import { BYTES_PER_KILOBYTE, BYTES_PER_MEGABYTE, HOUR_MS, MINUTE_MS, NOTICE_PREVIEW_MAX_CHARS, SECOND_MS } from '@zapbip/core';

export const GRAPH_API_VERSION = 'v24.0';
export const GRAPH_REQUEST_TIMEOUT_MS = 10 * SECOND_MS;
export const WEBHOOK_MAX_BYTES = 3 * BYTES_PER_MEGABYTE;
export const MEDIA_DOWNLOAD_ATTEMPTS = 2;
export const MEDIA_MAX_BYTES_INBOUND = 100 * BYTES_PER_MEGABYTE;
export const OUTBOUND_STICKER_MAX_BYTES = 100 * BYTES_PER_KILOBYTE;
export const WHATSAPP_MEDIA_HOST_SUFFIXES = ['fbcdn.net', 'fbsbx.com', 'whatsapp.net'] as const;
export const WEBHOOK_SIGNATURE_PREFIX = 'sha256=';
export const WEBHOOK_SIGNATURE_HEADER = 'X-Hub-Signature-256';
export const MEDIA_ID_PREFIX = 'med_';
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
export const OUTBOUND_BODY_MAX_CHARS = 4_096;
export const OUTBOUND_LIST_MAX_ROWS = 10;
export const OUTBOUND_BUTTON_MAX_REPLIES = 3;
export const GRAPH_UNAUTHORIZED_STATUS = 401;
export const GRAPH_SERVER_ERROR_STATUS = 500;
export const TEMPLATE_PREVIEW_MAX_CHARS = NOTICE_PREVIEW_MAX_CHARS;
export const WEBHOOK_BATCH_UNINDEXED_STATUS = 503;
```

Constants that core already declares (`TEXT_MAX_CHARS`, `BUTTON_TITLE_MAX_CHARS`, `LIST_ROW_TITLE_MAX_CHARS`, `NOTICE_PREVIEW_MAX_CHARS`, `BUTTON_MAX_OPTIONS`, `QUESTION_MAX_OPTIONS`) are imported, never redeclared. `TEMPLATE_PREVIEW_MAX_CHARS` is an alias only for readability of the sanitiser; it is the same value. `(contract: confirm at build)` for `SECOND_MS`, `MINUTE_MS`, `HOUR_MS` (A30).

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

`signature.ts`, `challenge.ts`, `inbound-parser.ts`, `status-parser.ts`, `media-download.ts`, `outbound-builders.ts`, `outbound-limits.ts`, `template-sanitiser.ts`, `channel-error-mapping.ts`, `cloud-api-message-sender.ts`, `operator-log.ts`:

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
  | { kind: 'inbound'; channelMessageId: string; fromWaId: string; at: number; replyToChannelMessageId: string | null; entry: ChannelInboundEntry; media: MediaDownloadRequest | null }
  | { kind: 'rejected'; reason: OperatorLogReason };
export type ParsedStatus = { channelMessageId: string; status: DeliveryState.Sent | DeliveryState.Delivered | DeliveryState.Read | DeliveryState.Failed | null; detail: ChannelStatusDetail; timestamp: number };
export function parseWebhookNotification(input: { rawJson: unknown }): ParsedChange[];

export type MediaDownloadRequest = { mediaId: string; channelMediaId: string; mimeType: string; sizeBytes: number; sha256Base64: string; filename: string | null; caption: string | null; mediaKind: MediaKind };
export function downloadInboundMedia(input: { graph: GraphClient; bucket: R2Bucket; accountId: string; request: MediaDownloadRequest; maxBytes: number; attempts: number }): Promise<{ stored: boolean }>;

export function buildSessionPayload(input: { recipientWaId: string; message: Message; question: Question | null; replyToChannelMessageId: string | null; reactionTargetChannelMessageId: string | null; publicOrigin: string; mediaStore: MediaStore; accountId: string }): Promise<Record<string, unknown>>;
export function buildTemplatePayload(input: { recipientWaId: string; kind: TemplateKind; locale: OwnerLocale; parameters: string[] }): Record<string, unknown>;
export function assertOutboundMedia(input: { mediaKind: MediaKind; mimeType: string | null; sizeBytes: number | null }): void;
export function assertButtonLimits(input: { bodyText: string; replies: { id: string; title: string }[] }): void;
export function assertListLimits(input: { bodyText: string; buttonLabel: string; sectionTitle: string; rows: { id: string; title: string; description: string | null }[] }): void;
export function sanitiseTemplateParameter(input: { value: string; fallback: string }): string;
export function assertTemplateBodyHasFixedWords(input: { body: string }): void;
export function mapGraphErrorToChannelError(input: { status: number; errorCode: number | null; errorTitle: string | null; message: string; isTemplateSend: boolean }): ChannelError;
export function logOperatorEvent(input: { event: OperatorEvent; fields: Partial<Record<OperatorLogField, string | number | boolean>> }): void;
export function createCloudApiMessageSender(input: { accountId: string; graph: GraphClient; owners: AccountDirectory; messageIndex: MessageIndex; restrictions: ChannelRestrictions; mediaStore: MediaStore; publicOrigin: string; phoneNumberId: string; clock: Clock }): MessageSender;
```

`parseWebhookNotification` never throws for one bad change or entry; it returns `rejected` items. `buildSessionPayload` is async because a stored media source needs a signed link (`mediaStore.signedLink`) built from `publicOrigin`. A `fallback` is required by `sanitiseTemplateParameter`; the caller passes `WHATSAPP_COPY[locale].templatePreviewFallback`, so an empty preview never becomes an empty string.

### `apps/api/src/adapters/hash.ts` (additions)

```ts
export function sha256Hex(input: { value: string }): Promise<string>;
export function sha256Base64(input: { bytes: ArrayBuffer }): Promise<string>;
```

### `apps/api/src/adapters/d1/d1-account-directory.ts`, `d1-message-index.ts`, `d1-channel-restrictions.ts` (stubs)

```ts
export type AccountDirectory = {
  findByWaId(input: { waId: string }): Promise<{ accountId: string; locale: OwnerLocale } | null>;
  findOwnerByAccountId(input: { accountId: string }): Promise<{ waId: string; locale: OwnerLocale } | null>;
};
export function createD1AccountDirectory(input: { database: D1Database }): AccountDirectory;

export type MessageIndex = {
  record(input: { channelMessageId: string; accountId: string; createdAt: number }): Promise<void>;
  findAccountId(input: { channelMessageId: string }): Promise<string | null>;
};
export function createD1MessageIndex(input: { database: D1Database }): MessageIndex;

export type ChannelRestrictions = {
  findActive(input: { now: number }): Promise<{ errorCode: number } | null>;
  record(input: { errorCode: number; restrictedAt: number }): Promise<void>;
};
export function createD1ChannelRestrictions(input: { database: D1Database }): ChannelRestrictions;
```

`findActive` ignores a row older than `RESTRICTION_TTL_MS` (A8). `AccountDirectory` is an adapter type until accounts-and-keys promotes it to a core port. An unknown stored `locale` throws. `MessageIndex` reads and writes slice 1's `message_index (wamid, account_id, created_at)`.

### `apps/api/src/account-inbox/account-inbox.ts` (stubs for W0)

`receiveChannelMessage` and `applyChannelStatus` throw `<name> is not implemented`. The constructor throws `AccountInbox must be created with idFromName` when `ctx.id.name` is absent (A17). The sender is chosen by `selectMessageSender` (A29): the Cloud API sender when `WHATSAPP_ACCESS_TOKEN` is set, else the sender registered by `registerDevelopmentSender`.

### `apps/api/src/dev/development-sender.ts` (stub, W0)

```ts
export function registerDevelopmentSender(input: { factory: DevelopmentSenderFactory }): void;
export function readDevelopmentSender(): DevelopmentSenderFactory | null;
```

Only `index.dev.ts` calls `registerDevelopmentSender`. `index.ts` does not import this file's registration, so production has no fake.

### `apps/api/test/support/` (owned by W0, stubs and shapes)

- `fake-graph.ts`: a class `FakeGraph` with `baseUrl`, `requests` (method, path, headers, body), `respondWith(input: {method, path, status, body})` and `reset()`. Routes are added by W2.
- `seed.ts`: `seedConnection`, `seedOwnerIdentity({waId, accountId, locale})`, `seedAccountLocale({accountId, locale})`. Signatures in W0; bodies in W3.
- `vitest.integration.config.mts` bindings: `WHATSAPP_ACCESS_TOKEN` = `test-access-token`, `META_APP_SECRET` = `test-app-secret`, `WHATSAPP_VERIFY_TOKEN` = `test-verify-token`, `WHATSAPP_PHONE_NUMBER_ID` = `1000000000000001`, `WHATSAPP_GRAPH_BASE_URL` = `https://graph.test`, `PUBLIC_ORIGIN` = `https://api.test`.
- `in-memory.ts` (core testing): stubs for every new `InboxRepository` method, and `createInMemoryDependencies` accepts `ownerLocale`.
- The SQLite repository (`apps/api/src/account-inbox/`): stub methods for every new port method.
- `fake-whatsapp-sender.ts` (slice 1): updated to the new `session` and `template` signatures, body unchanged.

### `apps/api/src/routes/whatsapp.ts` (stub) and `apps/api/src/app.ts`

`createApp` mounts `routes/whatsapp.ts` on `WHATSAPP_WEBHOOK_PATH` in both entries. The stub route throws `not implemented`. The body, written by W4, follows A26 and A27 and the failure table of the spec.

### `apps/api/wrangler.jsonc` (change)

Top-level `vars` (the development entry): `"WHATSAPP_GRAPH_BASE_URL": "http://127.0.0.1:4011"`. No value in any other block; `deploy-readiness` adds `env.staging` and `env.production` with the Graph host (A19).

### `apps/api/package.json` (change)

Adds `"@zapbip/types": "workspace:*"` to dependencies if absent.

### Layout and shape in W0

None. `libs/types`, its README and the root entries are agent-inbox-core's (Step 0 and gates).

## Dependencies

Nothing new is installed. Pins reused from `agent-inbox-core`: `zod` 4.6.7, `vitest` 5.0.5 (`libs/core`), `vitest` 4.1.12 and `@cloudflare/vitest-pool-workers` 0.23.0 (`apps/api`), `wrangler` 4.158.0, `@cloudflare/workers-types` 5.20261106.1, `drizzle-orm` 0.45.4. `@zapbip/types` and `@zapbip/core` are `workspace:*`. The Workers runtime APIs `crypto.DigestStream` and `FixedLengthStream` need a `compatibility_date` that supports them (A24, `(contract: confirm at build)`).

## File map (lanes)

Every path is owned by exactly one lane. A developer that needs a sibling's path stops and asks the lead, or notes the gap in its tester briefing (HARNESS §4).

| Lane | Developer | Owned paths |
|---|---|---|
| W-1 Refresh | `developer-w-1` | `docs/features/whatsapp-cloud-channel/plan.md` only (the plan on the branch) |
| W0 Contract (serial) | `developer-w0` | `libs/types/src/owner-locale.ts` (only if absent), `libs/core/src/{constants,enums,errors,message,inbox-records,ports,index}.ts`, `libs/core/src/use-cases/{types,index,receive-channel-message,open-window,close-window,apply-status,status-rule,claim-queued}.ts` (stubs), `libs/core/src/testing/in-memory.ts` (stubs), `apps/api/package.json` (if absent `@zapbip/types`), `apps/api/wrangler.jsonc` (development var), `apps/api/src/contract/{env,account-inbox-rpc,constants}.ts`, `apps/api/src/app.ts`, `apps/api/src/routes/whatsapp.ts` (stub), `apps/api/src/adapters/whatsapp/{whatsapp-constants,whatsapp-enums,whatsapp-copy,whatsapp-templates,graph-client,read-whatsapp-env,signature,challenge,inbound-parser,status-parser,media-download,outbound-builders,outbound-limits,template-sanitiser,channel-error-mapping,cloud-api-message-sender,operator-log}.ts` (stubs; the copy and the templates are constants), `apps/api/src/adapters/hash.ts` (stubs), `apps/api/src/adapters/d1/{d1-account-directory,d1-message-index,d1-channel-restrictions}.ts` (stubs), `apps/api/src/adapters/fake-whatsapp-sender.ts` (updated signatures), `apps/api/src/account-inbox/account-inbox.ts` and the SQLite repository stubs, `apps/api/src/dev/development-sender.ts` (stub), `apps/api/src/index.dev.ts` (the `registerDevelopmentSender` call), `apps/api/test/support/{fake-graph,seed}.ts`, `apps/api/vitest.integration.config.mts` (bindings) |
| W1 Core | `developer-w1` | `libs/core/src/use-cases/{receive-channel-message,open-window,close-window,apply-status,status-rule,claim-queued,deliver-to-owner,receive-owner-message,sweep-expired}.ts` (bodies), `libs/core/src/window.ts`, `libs/core/src/testing/in-memory.ts` (bodies), `libs/core/src/**/*.test.ts` for those files |
| W2 Outbound | `developer-w2` | `apps/api/src/adapters/whatsapp/{graph-client,read-whatsapp-env,outbound-builders,outbound-limits,template-sanitiser,whatsapp-templates,channel-error-mapping,cloud-api-message-sender,operator-log}.ts` (bodies), `apps/api/test/support/fake-graph.ts` (routes), `apps/api/test/fixtures/whatsapp/outbound/**`, `apps/api/test/unit/whatsapp-{graph-client,read-whatsapp-env,outbound-builders,outbound-limits,template-sanitiser,templates,channel-error-mapping,copy,operator-log}.test.ts`, `apps/api/test/integration/whatsapp-outbound.test.ts` |
| W3 Storage and Durable Object | `developer-w3` | `apps/api/src/adapters/d1/**` (bodies), `apps/api/src/adapters/hash.ts` (bodies), `apps/api/migrations/0004_whatsapp_channel.sql` (new), `apps/api/src/account-inbox/**` (schema v4, repository bodies, RPC bodies, `selectMessageSender`), `apps/api/src/dev/development-sender.ts` (body), `apps/api/test/support/seed.ts` (bodies), `apps/api/scripts/create-dev-owner.ts`, `apps/api/test/integration/{d1-account-directory,d1-message-index,d1-channel-restrictions,account-inbox-channel}.test.ts`, `apps/api/test/unit/hash.test.ts` |
| W4 Inbound | `developer-w4` | `apps/api/src/adapters/whatsapp/{signature,challenge,inbound-parser,status-parser,media-download}.ts` (bodies), `apps/api/src/routes/whatsapp.ts` (body), `apps/api/test/fixtures/whatsapp/inbound/**`, `apps/api/test/fixtures/whatsapp/status/**`, `apps/api/test/unit/whatsapp-{signature,challenge,inbound-parser,status-parser,media-download}.test.ts`, `apps/api/test/integration/{whatsapp-webhook,whatsapp-status}.test.ts` |
| W5 Docs | `developer-w5` | `apps/docs/concepts/whatsapp-channel.mdx`, `apps/docs/concepts/owner-notices.mdx`, `apps/docs/docs.json`, `tools/repository-shape/src/whatsapp-docs.test.ts` (new) |
| W6 Proof | `developer-w6` | `apps/api/test/e2e/whatsapp-channel.e2e.test.ts`, `apps/api/test/e2e/support/**` (new), `apps/api/test/integration/production-bundle.test.ts` (new) |

Ownership notes:

- W0 owns the shared test infrastructure (in-memory and SQLite stubs, the fake sender, `fake-graph.ts`, the seed helpers, the integration bindings, `index.dev.ts`), so no lane creates them later.
- `libs/core/src/use-cases/{receive-owner-message,deliver-to-owner,sweep-expired}.ts` are slice 1 files, owned by W1 from this slice on; their slice 1 tests stay green.
- `apps/api/test/fixtures/whatsapp/` is split by lane: `inbound/` and `status/` belong to W4, `outbound/` to W2.
- `apps/api/migrations/0004_whatsapp_channel.sql` is this slice's only new migration; `0001_core` and `v1` are not edited (A20).
- `env.staging` and `env.production` belong to `deploy-readiness`. W6.3 needs its production block merged.

## Sequencing and merge order

1. **W-1, plan refresh.** The first step on the branch: diff this plan against `main` and slice 1's merged code, then correct it. Every `(contract: confirm at build)` is resolved or struck with the reason before W0 starts.
2. **W0, serial.** The lead lands the contract commit. It typechecks with stubs.
3. **Parallel after W0:** W1, W2, W3, W4 and W5 start from the W0 commit in their own worktrees. Their red tests fail against the stubs. W4's route tests and W2's outbound integration test cannot go green before W3 merges, and W3's DO tests cannot go green before W1 merges.
4. **Merge order:** W0 → W1 → W2 → W3 → W4 → W5 → W6. W5 can merge at any time after W0.
5. **Lead merges after each lane:** `pnpm typecheck` and `pnpm verify` green before the next merge.
6. **Main moves:** the lead tells each developer what landed and which of its files collide. Developers merge main at a task boundary, never mid-step.

## Steps

Every box is empty when authored. A sub-agent ticks its own box. A wrong step is struck through with the reason.

### Step W-1 (plan refresh, first)

- [ ] **W-1.1 Refresh against main.** Diff this plan against `main` and slice 1's merged code: paths, exports, names (`libs/types` enums, `SECOND_MS` family, `Bindings` names, `ConnectionDirectory`, `ChannelError`), migrations (`0001_core`, DO `v1`–`v3`), the media route and its signing key. Correct the plan. Every `(contract: confirm at build)` is resolved, or struck with the reason. Commit as `docs(whatsapp): refresh the channel plan against main`.

### Step W0 (contract, serial)

- [ ] **W0.1 Contract and stubs.** Write every contract block above exactly, with stub bodies `void input;` and `throw new Error('<name> is not implemented');`. This includes the in-memory and SQLite repository stubs, the updated fake sender, `fake-graph.ts`, the seed helper signatures, the integration bindings, `index.dev.ts` with `registerDevelopmentSender`, and the W0 stubs of `development-sender.ts`. Commit as `feat(core): add the WhatsApp channel contract`.
- [ ] **W0.2 Gate.** `pnpm typecheck` and `pnpm --filter @zapbip/repository-shape test:unit` green. Commit as `chore(core): gate the channel contract`.

Failure modes for W0 are in the table below. W0 has no backout: fix forward in a new W0 commit that every lane merges.

### Lane W1 (core)

- [ ] **W1.1 red: pure rules.** Write `status-rule.test.ts` (every row of the spec's status table), `window.test.ts` (closed window, reopened by the next owner message, `openWindow` with an older `at` keeps the newer `lastOwnerMessageAt`), and the detail merge cases (CU-39 to CU-41). Expected failure: `applyStatusRule is not implemented`; the closed-window case returns `true`. Commit as `test(core): pin the status rule, the window and the detail merge`.
- [ ] **W1.2 green: pure rules.** Implement `status-rule.ts` (rank map: `Sent` 1, `Delivered` 2, `Read` 3, at the top of the file), `window.ts`, and the pure `mergeChannelStatusDetail`. Commit as `feat(core): implement the status rule, the window and the detail merge`.
- [ ] **W1.3 red: channel use cases.** Write `receive-channel-message.test.ts` (CU-16 to CU-23 and the transactional cases CU-18a and CU-18b), `open-window.test.ts` (CU-24, CU-24a to CU-24d), `claim-queued.test.ts` (CU-24c), `close-window.test.ts`, `apply-status.test.ts`, `deliver-to-owner-channel.test.ts` (CU-32 to CU-37), `sweep-expired.test.ts` (CU-38, CU-38b). Expected failure: `<name> is not implemented`. Commit as `test(core): pin the channel use cases`.
- [ ] **W1.4 green: channel use cases.** Implement the use cases with the order of A7 (transaction, then flush, answer, waiters, wake), the claim of A22, the per-message flush of A23, `deliverToOwner` (`WindowClosed` runs `closeWindow` then the closed-window path; other kinds store `Failed` and rethrow; a success stores `channelMessageId`), `sweepExpired` (receipt prune and `releaseStaleClaims`), `receiveOwnerMessage` (stores unavailable media as `Unavailable` and sends `noticeText` once). Extract `openWindow` from it; slice 1 tests stay green. Commit as `feat(core): implement the channel use cases`.

### Lane W2 (outbound)

- [ ] **W2.1 pin: copy and templates.** `whatsapp-copy.test.ts` asserts the keys, the spec's texts and the length limits of the list label and section title (pin, green on arrival). `whatsapp-templates.test.ts` asserts the template texts (pin). Commit as `test(api): pin the owner copy and the template texts`.
- [ ] **W2.2 red: builders, limits, sanitiser, error table.** Write `whatsapp-outbound-builders.test.ts`, `whatsapp-outbound-limits.test.ts`, `whatsapp-template-sanitiser.test.ts`, `whatsapp-channel-error-mapping.test.ts`. Expected failure: `<name> is not implemented`. Commit as `test(api): pin the outbound builders, limits, sanitiser and error table`.
- [ ] **W2.3 green: builders, limits, sanitiser, error table.** Implement the four modules (the sanitiser trims and returns the `fallback` when the result is empty). Commit as `feat(api): implement the outbound builders, limits, sanitiser and error table`.
- [ ] **W2.4 red: Graph client, env, log, sender.** Write `whatsapp-graph-client.test.ts` (timeout, `redirect: 'manual'`, host check), `whatsapp-read-whatsapp-env.test.ts`, `whatsapp-operator-log.test.ts` (fields keyed by `OperatorLogField`), and `whatsapp-outbound.test.ts` (integration, needs W3). Expected failure: `<name> is not implemented`. Commit as `test(api): pin the Graph client, the env reader, the log and the sender`.
- [ ] **W2.5 green: Graph client, env, log, sender.** Implement `graph-client.ts`, `read-whatsapp-env.ts`, `operator-log.ts`, `cloud-api-message-sender.ts` (recipient from `findOwnerByAccountId`, restriction check with TTL, builders, limits, stored media through `mediaStore.signedLink` and `publicOrigin`, index write on success, error mapping, a `Restricted` writes the restriction row and logs `channel.restricted`). Add the `FakeGraph` routes. Commit as `feat(api): implement the Cloud API sender`.

### Lane W3 (storage and Durable Object)

- [ ] **W3.1 red: directory, index, restrictions, repository, hash.** Write `d1-account-directory.test.ts`, `d1-message-index.test.ts`, `d1-channel-restrictions.test.ts` (TTL cases), `hash.test.ts` and `account-inbox-channel.test.ts` repository cases: `commitChannelInbound` writes receipt, message and window in one call and returns `false` on a second call; a throw inside the transaction rolls all three back; `claimQueuedMessages` returns each queued message once; `saveChannelStatusDetail` never writes null over a value. Expected failure: `<method> is not implemented`. Commit as `test(api): pin the directory, the index, the restrictions and the channel repository`.
- [ ] **W3.2 green: directory, index, restrictions, repository.** Create `apps/api/migrations/0004_whatsapp_channel.sql` (A20) and the DO schema `v4`. Implement the adapters (bound parameters only; `INSERT OR IGNORE` for `message_index`), `hash.ts`, the repository, `commitChannelInbound` in one `transactionSync`. Commit as `feat(api): implement the directory, the index, the restrictions and the channel repository`.
- [ ] **W3.3 red: Durable Object.** Write the cases of `account-inbox-channel.test.ts` (WI-8 to WI-16): commit and duplicate, the injected throw before the commit leaves nothing, the injected throw after the commit leaves the message and the retry returns `duplicate: true`, restart keeps the receipt, alarm prunes receipts and releases stale claims, sender selection (Cloud API when the token is set, the registered fake otherwise, a missing sender throws), `ctx.id.name` absent throws. Commit as `test(api): pin the Durable Object channel behaviour`.
- [ ] **W3.4 green: Durable Object.** Implement the RPC bodies, `selectMessageSender` (A29), `development-sender.ts`, the owner-locale read before each sending call, and `apps/api/scripts/create-dev-owner.ts` (prints SQL; never writes a secret to a file). Commit as `feat(api): implement the Durable Object channel behaviour`.

### Lane W4 (inbound)

- [ ] **W4.1 red: signature, challenge, parsers.** Write the unit tests of the test plan's inbound sections, including multibyte signature fixtures, per-change phone numbers, unknown types as `Unsupported`, missing `from` as rejected, ignored fields, and status timestamps. Expected failure: `<name> is not implemented`. Commit as `test(api): pin the webhook signature, challenge and parsers`.
- [ ] **W4.2 green: signature, challenge, parsers.** Implement them (A16, A26, A27). Commit as `feat(api): implement the webhook signature, challenge and parsers`.
- [ ] **W4.3 red: media download.** Write `whatsapp-media-download.test.ts` (streamed digest, deletion on mismatch, `404` refresh, `5xx` and timeout raised, `redirect: 'manual'`, the host cases, the declared size, the stream longer than declared). Commit as `test(api): pin the inbound media download`.
- [ ] **W4.4 green: media download.** Implement A14, A15, A24, A25. Commit as `feat(api): implement the inbound media download`.
- [ ] **W4.5 red: route.** Write `whatsapp-webhook.test.ts` and `whatsapp-status.test.ts` (test plan WI-17 to WI-34, the batch cases, the chunked 3 MB body, DO failure `500`, R2 failure `500`, the unindexed status `503` and `200`). Expected failure: the stub route error. Commit as `test(api): pin the webhook route over HTTP`.
- [ ] **W4.6 green: route.** Implement `routes/whatsapp.ts`: `GET` challenge; `POST`: size read with a limit (`413`, chunked included), signature (`401`), JSON (`400`), per change (`phone_number_id`, `field`), per message (directory, media, DO call), per status (index, `503` or `200`), DO failure `500`. Commit as `feat(api): implement the webhook route`.

### Lane W5 (docs)

- [ ] **W5.1 red: docs shape.** Write `tools/repository-shape/src/whatsapp-docs.test.ts`: both pages exist, are listed in the agent-inbox-core navigation group, and contain every limit of the spec's inbound and outbound tables and the 24 h restriction rule. Expected failure: the pages are missing. Commit as `test(shape): expect the channel and notice pages`.
- [ ] **W5.2 green: docs.** Write `concepts/whatsapp-channel.mdx` and `concepts/owner-notices.mdx`; list them in `docs.json`; run `mint broken-links`. Commit as `docs(api): document the WhatsApp channel and the owner notices`.

### Lane W6 (proof, after every merge and after deploy-readiness's production block)

- [ ] **W6.1 red: E2E.** Write `apps/api/test/e2e/whatsapp-channel.e2e.test.ts` and `apps/api/test/e2e/support/`: start the fake Graph on `4011`, start `wrangler dev` with the `--var` secrets and `WHATSAPP_GRAPH_BASE_URL` pointing at the fake, post signed webhooks. Expected failure: the first signed webhook does not return `200` before W3 and W4 are wired. Commit as `test(api): pin the channel end to end`.
- [ ] **W6.2 green: E2E.** Fix only the harness; a product bug goes back to its lane. Commit as `test(api): run the channel end to end`.
- [ ] **W6.3 red: production bundle.** Write `apps/api/test/integration/production-bundle.test.ts`: `wrangler deploy --dry-run --env production --outdir <scratch>` succeeds; the bundle has no `127.0.0.1:4011`, no fixture marker and no `registerDevelopmentSender` call site; with `WHATSAPP_GRAPH_BASE_URL` missing the channel throws naming it. Commit as `test(api): pin the production bundle`.
- [ ] **W6.4 green.** Only if W6.3 needed a harness change: implement it and commit as `test(api): prove the production bundle carries no fake`. Otherwise strike this box with the reason.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| W-1.1 | Plan drifts from `main` | a `(contract: confirm at build)` item is still open after W-1 | Hold W0 until the item is resolved |
| W0.1 | Contract drift between lanes | `pnpm typecheck` fails in a lane that did not change the contract | Fix forward in a new W0 commit that every lane merges |
| W1.4 | The receipt is written after the flush or wake | `receive-channel-message.test.ts` post-commit throw: the retry returns `duplicate: false` and stores a second message | Move the receipt into `commitChannelInbound`; revert the W1.4 commit |
| W1.4 | Flush claims after the Graph await | `open-window.test.ts` concurrent flush: a message is sent twice | Revert; `claim-queued.test.ts` is the proof |
| W1.4 | `openWindow` extraction changes slice 1 behaviour | slice 1 `receive-owner-message.test.ts` goes red | Revert the extraction; keep the new use case as a copy until green |
| W2.5 | Restriction not written, so sends continue | `whatsapp-outbound.test.ts` "restricted" case: a second send calls Graph | Revert the sender commit |
| W2.5 | Stored media sent without a signed link | `whatsapp-outbound.test.ts` media case: the link is not `publicOrigin` based | Revert the builder change |
| W3.2 | `0004` migration fails on a fresh database | the integration pool fails at migration apply | Revert the migration commit; `0001_core` and `v1` are untouched |
| W3.2 | `commitChannelInbound` not atomic | `account-inbox-channel.test.ts` injected throw before commit leaves a receipt | Revert; the transaction is the proof |
| W3.4 | Production selects the fake sender | `production-bundle.test.ts` finds the fake marker | Remove the registration from the production path |
| W4.2 | One bad entry fails the batch | `whatsapp-webhook.test.ts` batch case: the good message is missing | Parse per change and per message (A26) |
| W4.2 | Timestamp parsed as seconds | `inbound-parser.test.ts` "timestamp 1762430400 becomes 1762430400000" | Fix in the parser only |
| W4.4 | Bearer sent to a foreign host | `whatsapp-media-download.test.ts` host cases: an `Authorization` header reaches the fake on a foreign host | Revert the host check; the commit is blocked until green |
| W4.4 | A redirect is followed | the fake records a second request after a `302` | Restore `redirect: 'manual'` |
| W4.4 | Bytes remain in R2 after a mismatch | `whatsapp-media-download.test.ts` mismatch case: the key still exists | Add the delete on mismatch (A24) |
| W4.6 | A media `5xx` returns `200` | `whatsapp-webhook.test.ts` media `5xx` case: status `200` | Return `500` (A25) |
| W4.6 | Unindexed status returns `200` while young | `whatsapp-status.test.ts` young unknown `wamid`: status `200` | Return `503` below the 10 min window (A27) |
| W6.3 | The development URL reaches production | `production-bundle.test.ts` grep finds `127.0.0.1:4011` | Remove the var from the non-development block |

**Steps with no backout:** W0.1 (fix forward only), W-1.1 (a documentation commit, revert it).

## Z. Prove and ship

- [ ] **Tester briefing:** a developer wrote `tester-briefing.md` (per lane).
- [ ] **Tester run:** a fresh `tester` sub-agent per test-plan area executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`.
- [ ] **/check-ui:** the simulator screen walk on the development entry (owner text, voice note, quick-reply tap) recorded and uploaded.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened. The owner-run items of `test-plan.md` are listed in the PR as open.

## Core contract additions

For the orchestrator to merge into `core-contract-additions.md`. Every row is additive except the marked changes; routing rules 1 to 6, the window arithmetic, `ask` idempotency and the queue rule keep their meaning. Every row is `(contract: confirm at build)`, since slice 1 is not built yet.

| # | Addition | Kind | Lives in | Rule note |
|---|---|---|---|---|
| 1 | `DeliveryState.Delivered`, `Read`, `Sending` | enum values | `libs/core/src/enums.ts` | `Sending` is the claim of A22 |
| 2 | `MediaSourceKind.Unavailable` and the `MediaSource` variant `{kind: Unavailable}` | enum value, union member | `enums.ts`, `message.ts` | A5 |
| 3 | `ChannelErrorKind` values `WindowClosed`, `RateLimited`, `Restricted`, `ReactionRejected`, `MediaRejected`, `TemplateRejected`, `Timeout`, `Auth`, `Unknown` | enum values | `enums.ts` | `DeliveryFailed` is slice 1's |
| 4 | `ChannelInboundKind` (`Owner`, `WindowOnly`, `Unsupported`) | enum | `enums.ts` | the three inbound entry shapes |
| 5 | `ChannelError` class `{kind, errorCode: number or null, message}` | error class | `errors.ts` | `message` is the agent-facing English text |
| 6 | `OwnerWindow.closedAt: number or null` | record field | `inbox-records.ts` | A3; arithmetic unchanged |
| 7 | `ChannelStatusDetail` `{errorCode, errorTitle, pricingCategory, billable}` | record type | `inbox-records.ts` | A28 merge |
| 8 | `RECEIPT_RETENTION_MS` = 7 days; `BYTES_PER_KILOBYTE` = 1 000 | constants | `constants.ts` | `RECEIPT_RETENTION_MS` is named by the spec |
| 9 | `InboxRepository.commitChannelInbound`, `pruneChannelReceipts`, `saveChannelMessageId`, `findMessageByChannelMessageId`, `findChannelMessageId`, `saveChannelStatusDetail`, `claimQueuedMessages`, `releaseStaleClaims` | port methods | `ports.ts` | A7 and A22; `recordChannelReceipt` is the adapter's private step |
| 10 | `MessageSender.session` gains `replyToChannelMessageId` and `reactionTargetChannelMessageId` | port, additive fields | `ports.ts` | A2 |
| 11 | `MessageSender.template` gains `locale: OwnerLocale` | port, additive field | `ports.ts` | A1, "template() keeps locale" |
| 12 | `CoreDependencies.ownerLocale: OwnerLocale` | port field, additive | `ports.ts` | A1; the RPC wrapper sets it |
| 13 | `OwnerInboundContent` media variant `mediaId: string or null` | type, changed field | `use-cases/types.ts` | `null` is Unavailable (A5); slice 1 values stay valid |
| 14 | Types `ChannelInboundEntry`, `ReceiveChannelInput`, `ReceiveChannelResult`, `OpenWindowInput`, `CloseWindowInput`, `ApplyStatusInput`, `ApplyStatusResult` | types | `use-cases/types.ts` | |
| 15 | Use case `receiveChannelMessage` (one transaction, then flush, answer, waiters, wake) | use case | `receive-channel-message.ts` | A7 |
| 16 | Use case `openWindow({at})`: extracted first step of `receiveOwnerMessage`; stores `max(at)`; flushes with claims | use case | `open-window.ts` | A3, A22, A23 |
| 17 | Use case `closeWindow({at})` | use case | `close-window.ts` | A3 |
| 18 | Use case `applyStatus` and pure `applyStatusRule`, `mergeChannelStatusDetail` | use case, pure functions | `apply-status.ts`, `status-rule.ts` | status table; A28 |
| 19 | Use case `claimQueued` (the claim before any await) | use case | `claim-queued.ts` | A22 |
| 20 | `deliverToOwner` handles `ChannelError`: `WindowClosed` runs `closeWindow` then the queue and one notice; other kinds store `Failed` and rethrow; success stores `channelMessageId` | behaviour, slice 1 use case | `deliver-to-owner.ts` | window and queue rules unchanged |
| 21 | `sweepExpired` prunes receipts older than `RECEIPT_RETENTION_MS` and releases stale claims | behaviour, slice 1 use case | `sweep-expired.ts` | A22 |
| 22 | `receiveOwnerMessage` order changes: the commit comes before the window and the flush; unavailable media stored as `Unavailable` and `noticeText` sent once | behaviour, slice 1 use case | `receive-owner-message.ts` | A7, A5; the slice 1 test order changes and the W1.4 commit says so |
| 23 | DO RPC methods `receiveChannelMessage`, `applyChannelStatus` | RPC methods | `apps/api/src/contract/account-inbox-rpc.ts` | DO wraps the core |
| 24 | Adapter `AccountDirectory.findOwnerByAccountId({accountId})` (accounts-and-keys promotes it with `findByWaId`) | adapter method | `d1-account-directory.ts` | A1 |
| 25 | Env `META_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_GRAPH_BASE_URL` (optional in the type) | env type | `apps/api/src/contract/env.ts` | slice 1 names kept |
| 26 | `registerDevelopmentSender` and `readDevelopmentSender` | dev-only functions | `apps/api/src/dev/development-sender.ts` | A29; absent from production |

Not in the core: `MessageIndex` and `ChannelRestrictions` (adapters in `apps/api`), and `OwnerLocale` (owned by accounts-and-keys, read through the directory).
