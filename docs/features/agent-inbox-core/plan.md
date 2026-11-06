# Agent inbox core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build slice 1 of zapbip: the shared enums and constants (`libs/types`), the pure core (`libs/core/src/inbox`), a Cloudflare Worker with one `AccountInbox` Durable Object per account, the ten MCP tools, the 24-hour window, owner routing, media, a fake WhatsApp channel, a phone-keyed development owner simulator and a seed script, and the Mintlify skeleton. Everything is proven against the fake channel.

**Architecture:** `libs/types` holds enums and time constants, with no logic. `libs/core` holds the rules as plain TypeScript behind eight ports. `apps/api` supplies the adapters: a Durable Object with SQLite holds account state and the in-memory reply waiters, D1 holds the directory (accounts, connections, owner identities, message index), R2 holds media, and a fake sender records what the owner would have seen. The MCP server runs stateless Streamable HTTP in the Worker. Each tool call reaches the Durable Object through a typed RPC contract; a held call (at most 50 s) waits there.

**Tech Stack:** Node 24, TypeScript 7.0.2, pnpm workspaces, Vitest (`libs/core` and `libs/types` 5.0.5; `apps/api` 4.1.12), wrangler 4.158.0 on Cloudflare Workers, Hono 4.13.16, `@modelcontextprotocol/sdk` 1.32.2, zod 4.6.7, Drizzle ORM 0.45.4 for Durable Object SQLite, `@cloudflare/vitest-pool-workers` 0.23.0, Mintlify CLI `mint` 4.2.1207.

**Spec:** `docs/features/agent-inbox-core/spec.md`. The spec lands with the branch in Step 0. Its "Open questions → answers" table holds every decision taken under `owner delegated 2026-11-06`; those rows bind this plan. Slice 1 builds only what the spec assigns to slice 1. The additions file (`SCRATCH/feature-stash/core-contract-additions.md`) lists later slices' contract changes; Step 0 leaves room for them in `libs/types` but adds none of them.

## Global Constraints

- Every row of the spec's "Open questions → answers" table dated `owner delegated 2026-11-06` is binding. Where a row changes a route, a name or a limit, the row wins over the spec's older tables.
- Node `>=24`. pnpm stays at the root pin `pnpm@8.15.9`.
- Pinned dependencies are exactly the list in **Dependencies**. No other package without a new decision row.
- Repo rules (`AGENTS.md`): no comments except `// NB ADR NNNN:` pointers; flat `if`s; no `else`; no `??` defaults (zod `.default()` is the one place a default lives); enums over string literals; named parameters for any function with more than one parameter; constants over literals; no acronym in an identifier.
- `.js` on `@modelcontextprotocol/sdk` subpath imports is the one exception to the no-`.js` rule (A9). Nowhere else.
- Stub bodies written in Step 0 are exactly `void input;` followed by `throw new Error('<name> is not implemented');`. A class stub throws the same way from each method. The stubs keep `pnpm typecheck` green and make red runs fail on the assertion, or on the stub's message when the stub is reached.
- Every test-first step is two commits: the red commit contains only the failing test plus the stub it needs; the green commit contains only the implementation. A test that is green when it lands is a **pin**, labelled `pin` in its commit and in the briefing, and is never listed as a red box.
- Developers record the failure text the red run actually printed in their section of `docs/features/agent-inbox-core/tester-briefing.md`.
- No `sleep` in any file. Core tests use the fake `Clock`. Worker tests advance time through the development clock route or `runDurableObjectAlarm`.
- Commits: Conventional Commits, en-US, a `Co-Authored-By` trailer naming the model that wrote the commit. Never `git add -A`, `git add .`, `--no-verify`. Never on `main`. Lanes merge and never rebase.

## Review Focus

1. Owner text while two agents have open questions: the newest open question wins and its agent gets the answer, never the other agent. Owned by S2.1, S2.2 (`routing.test.ts`), S2.3, S2.4 (`receive-owner-message.test.ts`).
2. A button tap on a question that is already answered or has expired: routed as a message to the question's agent with `reply_to`, never a second answer, never an error. Owned by S2.3, S2.4.
3. An agent retries `ask` after the owner has answered: the retry returns the answer and sends nothing. Owned by S2.3, S2.4 (`ask.test.ts`).
4. An upload PUT whose body is shorter than declared, larger than declared, or of another Content-Type: 400, 413 or 415, nothing stored in R2. Owned by S5.1, S5.2 (`upload-route.test.ts`).
5. Text at the exact limits (4096 code points of text, 1024 of caption, 20 of a button title, 24 of a list row, one emoji grapheme, 20 characters of agent name): accepted; one more is rejected with the field named. Owned by S2.1, S2.2 (`validation.test.ts`).

## Assumptions (decided, owner can override)

- **A1 Ports.** Eight ports in `libs/core`: `InboxRepository`, `MessageSender`, `MediaStore`, `AgentWaker`, `ConnectionDirectory`, `Clock`, `IdGenerator`, `ReplyWaiters`. ADR 0008 is amended in the scratch copy to say eight.
- **A2 Names.** No acronyms in identifiers: `signedLink` (not `signedUrl`), field `link` in core. Wire fields keep the spec's spelling (`url`, `upload_url`, `message_id`, `media_id`).
- **A3 Units.** Domain times are epoch milliseconds. The MCP edge renders `at` and `expires_at` as ISO 8601 and converts `timeout_seconds` to milliseconds.
- **A4 Megabyte.** `BYTES_PER_MEGABYTE = 1_000_000`, in `libs/types`.
- **A5 Copy.** Owner-facing copy lives in `libs/core/src/inbox/inbox-copy.ts`, keyed by the `InboxCopyKey` enum, with a `pt_BR` and an `en_US` entry for every key. The owner's `OwnerLocale` comes with the connection identity. Agent-facing text (tool output, tool errors) is English.
- **A6 Transport.** Stateless Streamable HTTP, `enableJsonResponse: true`.
- **A7 Routes.** The spec's route table as amended by its decision rows. The simulator is keyed by the owner's phone (A20).
- **A8 Entries.** The top-level wrangler block is development: its `main` is `src/index.dev.ts`, which mounts the simulator and is what `wrangler dev` runs. `env.production` repeats every binding (wrangler does not inherit them) and its `main` is `src/index.ts`, which never imports the simulator. `deploy-readiness` adds `env.staging`. Production-bundle tests run with `--env production`.
- **A9 SDK subpaths.** The `@modelcontextprotocol/sdk` subpath imports keep the `.js` suffix. Decided, not verified in advance: S0.5 proves it with `tsc` and writes the learning in `docs/learnings/`.
- **A10 Vitest.** `apps/api` uses Vitest 4.1.12 with `@vitest/runner` and `@vitest/snapshot` pinned to 4.1.12, because `@cloudflare/vitest-pool-workers` 0.23.0 peers `vitest ^4.1.0`. `libs/core` and `libs/types` use 5.0.5.
- **A11 DOM lib.** `MediaBody` is `ReadableStream<Uint8Array>`. If `tsconfig.base.json` has no DOM lib, `libs/core/tsconfig.json` adds `"DOM"` to `lib`.
- **A12 Constants.** Generic constants (`SECOND_MS`, `MINUTE_MS`, `HOUR_MS`, `DAY_MS`, `BYTES_PER_MEGABYTE`, `DEFAULT_LOCALE`) live in `libs/types/src/constants.ts`. Domain constants live in `libs/core/src/inbox/constants.ts`.
- **A13 Expiry.** One Durable Object alarm. `AccountInbox` holds a list of `DueTimeProvider`s (`nextDueAt()`, `runDue({now})`); slice 1 registers the expiry provider, which wraps `findNextExpiry()` and `sweepExpired`. `armAlarm()` arms the earliest due time of all providers, and every write path calls it. `alarm()` runs each provider inside its own try/catch and always re-arms, so a throwing provider never leaves the alarm unarmed.
- **A14 Secrets.** A connection secret is looked up by its SHA-256 hex digest, through `ConnectionDirectory.resolveSecretDigest({secretDigest})` on the column `connections.secret_digest` (UNIQUE). The app never compares secrets. Signed links are checked with `crypto.subtle.verify`.
- **A15 Uploads.** Upload bytes never enter core. The Worker streams them to R2, then calls `completeUpload`.
- **A16 Owner media.** The fake channel stores owner media bytes in R2 before `receiveOwnerMessage` runs, under the key of the message's `wamid`. Core records metadata only.
- **A17 Answers.** Only text, reactions and choices answer a question. Owner media, audio, location and contacts route by rules 2, 4, 5 and 6 and never answer. The question stays open.
- **A18 Dev clock.** The development entry offsets the `Clock` by `advance_ms`, through `POST /dev/owner/:phone/clock`. The offset is stored in Durable Object storage (`clock_offset_ms`), so it survives a restart. The production entry has no such route.
- **A19 Wire sender.** Every message carries `sender` (`owner` or `agent`) and `verified` (`true` for owner messages), derived from `direction`.
- **A20 Simulator and seed.** The simulator is keyed by the owner's phone: `POST /dev/owner/:phone/messages`, `GET /dev/owner/:phone/screen`, `POST /dev/owner/:phone/clock`. The phone resolves through `owner_identities` (D1) to the account. `pnpm --filter @zapbip/api dev:seed -- --phone <digits> --agents <a,b>` runs the pure seed function (returns SQL, integration-tested) through `wrangler d1 execute --local --persist-to <dir>` under `tsx`; it creates the account, the owner identity (locale `pt_BR`) and one connection per agent name in the local D1, and prints the URLs once. Slice 3 replaces the seed with "novo agente".
- **A21 Gates.** E2E runs in the default `e2e` gate. Only the Claude Code cases (CC-*) are opt-in through `ZAPBIP_CLAUDE_E2E=1`. A change under `libs/core/**` or `libs/types/**` also runs the apps/api integration and E2E gates.
- **A22 Routing list.** Rule 6 sends one list while no held message is waiting. Its option ids are `route:<message_id>:<agent>`, where `<message_id>` is the first held message. A choice routes every held message to that agent. A later unmatched message while held messages exist joins them and sends no list.
- **A23 Signed links.** The canonical string covers purpose, account id, media id and expiry, in that order. The media link is `GET /m/<account_id>/<media_id>?exp=&sig=`; the account id sits in the path and the HMAC covers it, so a swapped account id fails. The upload link stays under the connection secret path (A7). Media is stored at `accounts/<account_id>/media/<media_id>`, so account deletion is one prefix delete.
- **A24 Object migrations.** The Durable Object migration runner records the set of applied versions in `schema_versions` and applies each missing registered version in ascending order. Reserved versions are v1 (this slice) to v7, as the cross-slice decisions list them. Slice 1 registers only v1.
- **A25 Alarms.** Expiry is per-object: each Durable Object arms its own alarm to the earliest of its expiries. No cron runs in slice 1.
- **A26 Dev-only surface.** `readScreen` and `advanceClock` exist only on `DevAccountInbox`, a subclass that `index.dev.ts` exports under the class name `AccountInbox`. The production module exports the base class, which has neither method. A bundle test proves the production bundle does not contain them (PB-2, PB-4).

## Contract (Step 0, verbatim)

Step 0 lands these files on the feature branch in one commit. Every lane builds against them. A change after Step 0 is a new Step 0 commit, which every lane merges.

### `libs/types/src/enums.ts`

```ts
export enum MessageDirection {
  ToOwner = 'to_owner',
  FromOwner = 'from_owner',
}

export enum MessageSender {
  Owner = 'owner',
  Agent = 'agent',
}

export enum MessageKind {
  Text = 'text',
  Image = 'image',
  Video = 'video',
  Audio = 'audio',
  Document = 'document',
  Sticker = 'sticker',
  Location = 'location',
  Contacts = 'contacts',
  Reaction = 'reaction',
  Choice = 'choice',
}

export enum MediaSourceKind {
  Link = 'link',
  Stored = 'stored',
}

export enum MediaOrigin {
  Upload = 'upload',
  Owner = 'owner',
}

export enum DeliveryState {
  Queued = 'queued',
  Sent = 'sent',
  Failed = 'failed',
  Expired = 'expired',
}

export enum OwnerLocale {
  PortugueseBrazil = 'pt_BR',
  EnglishUs = 'en_US',
}

export enum InboxCopyKey {
  RoutingPrompt = 'routing_prompt',
  NoAgents = 'no_agents',
  AgentNotListening = 'agent_not_listening',
  NoticeBody = 'notice_body',
  QuestionNoticeBody = 'question_notice_body',
  NoticeQuickReply = 'notice_quick_reply',
  PreviewImage = 'preview_image',
  PreviewVideo = 'preview_video',
  PreviewAudio = 'preview_audio',
  PreviewVoice = 'preview_voice',
  PreviewDocument = 'preview_document',
  PreviewSticker = 'preview_sticker',
  PreviewReaction = 'preview_reaction',
  PreviewLocation = 'preview_location',
  PreviewContacts = 'preview_contacts',
  PreviewChoice = 'preview_choice',
}

export enum OptionRender {
  Buttons = 'buttons',
  List = 'list',
}

export enum ReplyStatus {
  Answered = 'answered',
  Pending = 'pending',
  Message = 'message',
  Timeout = 'timeout',
}

export enum InboxStatus {
  Empty = 'empty',
  New = 'new',
}

export enum TemplateKind {
  Notice = 'notice',
  QuestionNotice = 'question_notice',
}

export enum WakeOutcome {
  Woken = 'woken',
  Unreached = 'unreached',
}

export enum AgentWakeReason {
  MessageWaiting = 'message_waiting',
}

export enum WakeMode {
  None = 'none',
}

export enum WakeRung {
  Inbox = 'inbox',
}

export enum ChannelErrorKind {
  DeliveryFailed = 'delivery_failed',
}

export enum LinkPurpose {
  Read = 'read',
  Upload = 'upload',
}

export enum IdPrefix {
  Message = 'msg',
  Question = 'qst',
  Media = 'med',
}

export enum RoutingRule {
  ButtonReply = 'button_reply',
  QuotedOrReaction = 'quoted_or_reaction',
  AgentMention = 'agent_mention',
  OpenQuestion = 'open_question',
  RecentAgent = 'recent_agent',
  AskOwner = 'ask_owner',
}

export enum InboxErrorCode {
  InvalidInput = 'invalid_input',
  NotFound = 'not_found',
  UploadExpired = 'upload_expired',
  UploadUnavailable = 'upload_unavailable',
}
```

### `libs/types/src/constants.ts`

```ts
import { OwnerLocale } from './enums';

export const SECOND_MS = 1_000;
export const MINUTE_MS = 60 * SECOND_MS;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
export const BYTES_PER_MEGABYTE = 1_000_000;
export const DEFAULT_LOCALE = OwnerLocale.PortugueseBrazil;
```

`libs/types/src/index.ts` re-exports both files. `libs/types` has no runtime dependency and no logic.

### `libs/core/src/inbox/constants.ts`

```ts
import { BYTES_PER_MEGABYTE, DAY_MS, HOUR_MS, MessageKind, MINUTE_MS, SECOND_MS } from '@zapbip/types';

export const ASK_MAX_WAIT_MS = 50 * SECOND_MS;
export const ASK_MAX_WAIT_SECONDS = ASK_MAX_WAIT_MS / SECOND_MS;
export const WAIT_TIMEOUT_MIN_SECONDS = 1;
export const ASK_RETRY_WINDOW_MS = 4 * MINUTE_MS;
export const WINDOW_MS = DAY_MS;
export const WINDOW_SAFETY_MARGIN_MS = 10 * MINUTE_MS;
export const HISTORY_LIMIT = 20;
export const QUESTION_RETENTION_MS = 7 * DAY_MS;
export const QUEUE_RETENTION_MS = 7 * DAY_MS;
export const RECEIPT_RETENTION_MS = 7 * DAY_MS;
export const MEDIA_RETENTION_MS = 30 * DAY_MS;
export const MEDIA_LINK_TTL_MS = HOUR_MS;
export const UPLOAD_TTL_MS = 15 * MINUTE_MS;
export const INLINE_IMAGE_MAX_BYTES = 1 * BYTES_PER_MEGABYTE;
export const NOTICE_PREVIEW_MAX_CHARS = 60;

export const WHATSAPP_TEXT_MAX_CHARS = 4096;
export const CAPTION_MAX_CHARS = 1024;
export const FILENAME_MAX_CHARS = 240;
export const MIME_TYPE_MAX_CHARS = 127;
export const QUESTION_MAX_CHARS = 1024;
export const QUESTION_MAX_OPTIONS = 10;
export const BUTTON_MAX_OPTIONS = 3;
export const BUTTON_TITLE_MAX_CHARS = 20;
export const LIST_ROW_TITLE_MAX_CHARS = 24;
export const CONTACTS_MAX_PER_MESSAGE = 10;
export const EMOJI_MAX_GRAPHEMES = 1;

export const AGENT_NAME_MAX_CHARS = 20;
export const AGENT_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,19}$/;
export const AGENT_MENTION_PATTERN = /^@([a-z0-9][a-z0-9-]{0,19}) /;

export const IMAGE_MAX_BYTES = 5 * BYTES_PER_MEGABYTE;
export const VIDEO_MAX_BYTES = 16 * BYTES_PER_MEGABYTE;
export const AUDIO_MAX_BYTES = 16 * BYTES_PER_MEGABYTE;
export const DOCUMENT_MAX_BYTES = 100 * BYTES_PER_MEGABYTE;
export const STICKER_MAX_BYTES = 100_000;
export const STICKER_MIME_TYPE = 'image/webp';

export type MediaMessageKind =
  | MessageKind.Image
  | MessageKind.Video
  | MessageKind.Audio
  | MessageKind.Document
  | MessageKind.Sticker;

export const MEDIA_MAX_BYTES: Record<MediaMessageKind, number> = {
  [MessageKind.Image]: IMAGE_MAX_BYTES,
  [MessageKind.Video]: VIDEO_MAX_BYTES,
  [MessageKind.Audio]: AUDIO_MAX_BYTES,
  [MessageKind.Document]: DOCUMENT_MAX_BYTES,
  [MessageKind.Sticker]: STICKER_MAX_BYTES,
};

export const MEDIA_MIME_PREFIX: Record<MediaMessageKind, string | null> = {
  [MessageKind.Image]: 'image/',
  [MessageKind.Video]: 'video/',
  [MessageKind.Audio]: 'audio/',
  [MessageKind.Document]: null,
  [MessageKind.Sticker]: null,
};

export const NOTICE_QUICK_REPLY_ID = 'zapbip_open_window';
export const ROUTE_OPTION_PREFIX = 'route';
```

The import line lists exactly the names the file uses. `MediaMessageKind` names `MessageKind` values directly.

### `libs/core/src/inbox/connection.ts`

```ts
import type { OwnerLocale } from '@zapbip/types';

export type AgentName = string;

export type ConnectionIdentity = {
  accountId: string;
  agent: AgentName;
  ownerLocale: OwnerLocale;
};
```

### `libs/core/src/inbox/message.ts`

```ts
import type { DeliveryState, MediaSourceKind, MessageDirection, MessageKind } from '@zapbip/types';
import type { AgentName } from './connection';

export type ContactCard = {
  name: string;
  phones: string[];
  emails: string[];
  organization: string | null;
};

export type QuestionOption = {
  optionIndex: number;
  title: string;
  description: string | null;
};

export type MediaSource =
  | { kind: MediaSourceKind.Link; link: string }
  | { kind: MediaSourceKind.Stored; mediaId: string };

export type MediaFields = {
  source: MediaSource;
  mimeType: string | null;
  sizeBytes: number | null;
  filename: string | null;
  caption: string | null;
};

export type MessageContent =
  | { kind: MessageKind.Text; text: string }
  | ({ kind: MessageKind.Image } & MediaFields)
  | ({ kind: MessageKind.Video } & MediaFields)
  | ({ kind: MessageKind.Audio; voice: boolean } & MediaFields)
  | ({ kind: MessageKind.Document } & MediaFields)
  | ({ kind: MessageKind.Sticker } & MediaFields)
  | { kind: MessageKind.Location; latitude: number; longitude: number; name: string | null; address: string | null }
  | { kind: MessageKind.Contacts; contacts: ContactCard[] }
  | { kind: MessageKind.Reaction; targetMessageId: string; emoji: string | null }
  | { kind: MessageKind.Choice; questionId: string; options: QuestionOption[]; selected: QuestionOption | null };

export type MessageEnvelope = {
  messageId: string;
  direction: MessageDirection;
  agent: AgentName | null;
  at: number;
  replyToMessageId: string | null;
  delivery: DeliveryState | null;
  readByAgent: boolean;
};

export type Message = MessageEnvelope & MessageContent;
```

`Choice` serves both directions, as in the spec's kind table: a `to_owner` Choice is a question prompt (`selected` null); a `from_owner` Choice is the owner's answer (`selected` set, `options` copied from the question).

### `libs/core/src/inbox/question.ts`

```ts
import type { AgentName } from './connection';
import type { QuestionOption } from './message';

export type QuestionAnswer = {
  optionIndex: number | null;
  text: string;
  answerMessageId: string;
  answeredAt: number;
};

export type Question = {
  questionId: string;
  agent: AgentName;
  text: string;
  options: QuestionOption[];
  normalizedKey: string;
  promptMessageId: string;
  askedAt: number;
  answer: QuestionAnswer | null;
};

export type ParsedOptionId = {
  questionId: string;
  optionIndex: number;
};

export type ParsedRouteOptionId = {
  messageId: string;
  agent: AgentName;
};
```

### `libs/core/src/inbox/inbox-records.ts`

```ts
import type { AgentName } from './connection';
import type { MediaOrigin } from '@zapbip/types';

export type AgentRecord = {
  agent: AgentName;
  lastSeenAt: number;
};

export type OwnerWindow = {
  lastOwnerMessageAt: number | null;
  noticeSentForClosedWindow: boolean;
};

export type StoredMedia = {
  mediaId: string;
  origin: MediaOrigin;
  mimeType: string;
  sizeBytes: number;
  filename: string | null;
  expiresAt: number | null;
  receivedAt: number | null;
  retentionUntil: number | null;
};
```

### `libs/core/src/inbox/ports.ts`

```ts
import type { AgentWakeReason, IdPrefix, LinkPurpose, OwnerLocale, TemplateKind, WakeOutcome, DeliveryState } from '@zapbip/types';
import type { AgentName, ConnectionIdentity } from './connection';
import type { Message } from './message';
import type { Question, QuestionAnswer } from './question';
import type { AgentRecord, OwnerWindow, StoredMedia } from './inbox-records';

export type MediaBody = ReadableStream<Uint8Array>;

export type MediaObject = {
  bytes: Uint8Array;
  mimeType: string;
};

export interface Clock {
  now(): number;
  schedule(input: { delayMs: number; run: () => void }): { cancel: () => void };
}

export interface IdGenerator {
  next(input: { prefix: IdPrefix }): string;
}

export interface InboxRepository {
  registerAgent(input: { agent: AgentName; seenAt: number }): Promise<void>;
  listAgents(): Promise<AgentRecord[]>;
  insertMessage(input: { message: Message }): Promise<void>;
  updateDelivery(input: { messageId: string; delivery: DeliveryState }): Promise<void>;
  findMessage(input: { messageId: string }): Promise<Message | null>;
  listAgentHistory(input: { agent: AgentName; limit: number }): Promise<Message[]>;
  listUnread(input: { agent: AgentName; limit: number }): Promise<Message[]>;
  countUnread(input: { agent: AgentName }): Promise<number>;
  markRead(input: { messageIds: string[] }): Promise<void>;
  listHeld(): Promise<Message[]>;
  assignAgent(input: { messageIds: string[]; agent: AgentName }): Promise<void>;
  listQueued(): Promise<Message[]>;
  findLastAgentWrite(input: { since: number }): Promise<AgentName | null>;
  insertQuestion(input: { question: Question }): Promise<void>;
  findQuestion(input: { questionId: string }): Promise<Question | null>;
  findRecentQuestion(input: { agent: AgentName; normalizedKey: string; askedAfter: number }): Promise<Question | null>;
  listOpenQuestions(): Promise<Question[]>;
  saveAnswer(input: { questionId: string; answer: QuestionAnswer }): Promise<void>;
  recordChannelReceipt(input: { wamid: string; receivedAt: number }): Promise<boolean>;
  deleteExpiredReceipts(input: { receivedBefore: number }): Promise<void>;
  deleteQuestionsAskedBefore(input: { askedBefore: number }): Promise<void>;
  findWindow(): Promise<OwnerWindow>;
  saveWindow(input: { window: OwnerWindow }): Promise<void>;
  insertMedia(input: { media: StoredMedia }): Promise<void>;
  findMedia(input: { mediaId: string }): Promise<StoredMedia | null>;
  markMediaReceived(input: { mediaId: string; receivedAt: number; retentionUntil: number }): Promise<void>;
  listExpiredMediaIds(input: { now: number }): Promise<string[]>;
  deleteMedia(input: { mediaIds: string[] }): Promise<void>;
  findNextExpiry(): Promise<number | null>;
}

export interface MessageSender {
  session(input: { message: Message }): Promise<{ channelMessageId: string }>;
  template(input: { kind: TemplateKind; locale: OwnerLocale; parameters: string[] }): Promise<{ channelMessageId: string }>;
}

export interface MediaStore {
  put(input: { accountId: string; mediaId: string; body: MediaBody; sizeBytes: number; mimeType: string }): Promise<void>;
  get(input: { accountId: string; mediaId: string }): Promise<MediaObject | null>;
  signedLink(input: { accountId: string; mediaId: string; purpose: LinkPurpose; ttlMs: number }): Promise<string>;
  delete(input: { accountId: string; mediaIds: string[] }): Promise<void>;
}

export interface AgentWaker {
  notify(input: { agent: AgentName; reason: AgentWakeReason }): Promise<WakeOutcome>;
}

export interface ConnectionDirectory {
  resolveSecretDigest(input: { secretDigest: string }): Promise<ConnectionIdentity | null>;
}

export interface ReplyWaiters {
  awaitQuestionAnswer(input: { agent: AgentName; questionId: string; timeoutMs: number }): Promise<void>;
  awaitAgentMessage(input: { agent: AgentName; timeoutMs: number }): Promise<void>;
  resolveQuestionAnswer(input: { questionId: string }): void;
  resolveAgentMessage(input: { agent: AgentName }): void;
  hasLiveWaiter(input: { agent: AgentName }): boolean;
}

export type CoreDependencies = {
  accountId: string;
  repository: InboxRepository;
  sender: MessageSender;
  mediaStore: MediaStore;
  waker: AgentWaker;
  clock: Clock;
  ids: IdGenerator;
  waiters: ReplyWaiters;
};
```

`MediaStore.signedLink` returns the query string `exp=<expiresAt>&sig=<hex>`. The caller builds the path and the origin. Its key is chosen by `purpose` (A14, Step 0 `signing.ts`).

### `libs/core/src/inbox/errors.ts`

```ts
import type { ChannelErrorKind, InboxErrorCode } from '@zapbip/types';

export class InboxError extends Error {
  readonly code: InboxErrorCode | ChannelErrorKind;

  constructor(input: { code: InboxErrorCode | ChannelErrorKind; message: string }) {
    super(input.message);
    this.code = input.code;
  }
}
```

### `libs/core/src/inbox/validation.ts`, `option-id.ts`, `question-key.ts`, `window.ts`, `routing.ts`, `waiters.ts`, `inbox-copy.ts` (signatures and stubs; `inbox-copy.ts` is written in full, see below)

```ts
import type { MediaMessageKind } from './constants';
import type { AgentName } from './connection';
import type { AgentRecord, OwnerWindow } from './inbox-records';
import type { Message, MessageContent, QuestionOption } from './message';
import type { ParsedOptionId, ParsedRouteOptionId, Question } from './question';
import type { Clock } from './ports';
import type { ReplyWaiters } from './ports';
import type { OptionRender, OwnerLocale, RoutingRule } from '@zapbip/types';

export function parseAgentName(input: { value: string }): AgentName;
export function normalizeText(input: { value: string }): string;
export function assertMaxChars(input: { field: string; value: string; maxChars: number }): void;
export function parseOptions(input: { options: string[] }): { render: OptionRender; titles: string[] };
export function parseTimeoutMs(input: { seconds: number }): number;
export function parseEmoji(input: { emoji: string }): string | null;
export function assertHttpsLink(input: { value: string }): void;
export function assertMediaFits(input: { kind: MediaMessageKind; mimeType: string | null; sizeBytes: number | null }): void;
export function assertUploadDeclaration(input: { mimeType: string; sizeBytes: number }): void;
export function parseOptionDescriptions(input: { descriptions: (string | null)[] }): (string | null)[];

export function formatOptionId(input: { questionId: string; optionIndex: number }): string;
export function parseOptionId(input: { optionId: string }): ParsedOptionId | null;
export function formatRouteOptionId(input: { messageId: string; agent: AgentName }): string;
export function parseRouteOptionId(input: { optionId: string }): ParsedRouteOptionId | null;

export function buildQuestionKey(input: { agent: AgentName; text: string; optionTitles: string[] }): string;

export function isOwnerWindowOpen(input: { window: OwnerWindow; now: number }): boolean;

export type RoutingInput = {
  text: string | null;
  referencedMessage: Message | null;
  referencedQuestion: Question | null;
  openQuestions: Question[];
  agents: AgentRecord[];
  lastAgentWrite: AgentName | null;
  routingListOpen: boolean;
};

export type RoutingDecision = {
  rule: RoutingRule;
  agent: AgentName | null;
  answersQuestionId: string | null;
  textForAgent: string | null;
  sendsRoutingList: boolean;
};

export function routeOwnerMessage(input: RoutingInput): RoutingDecision;

export function createReplyWaiters(input: { clock: Clock }): ReplyWaiters;

export function buildNoticePreview(input: { content: MessageContent; locale: OwnerLocale }): string;
```

`buildNoticePreview` needs `OwnerLocale`; its import comes from `@zapbip/types`. The signature file imports every name it uses from its real source.

`routeOwnerMessage` returns `sendsRoutingList: true` only for rule 6 when `routingListOpen` is false and at least one agent exists. The zero-agent notice is core's decision in `receiveOwnerMessage`, not a routing rule.

`inbox-copy.ts`, written in full in Step 0:

```ts
import { InboxCopyKey, OwnerLocale } from '@zapbip/types';

export const INBOX_COPY: Record<InboxCopyKey, Record<OwnerLocale, string>> = {
  [InboxCopyKey.RoutingPrompt]: {
    [OwnerLocale.PortugueseBrazil]: 'Para qual agente devo encaminhar sua mensagem?',
    [OwnerLocale.EnglishUs]: 'Which agent should I send your message to?',
  },
  [InboxCopyKey.NoAgents]: {
    [OwnerLocale.PortugueseBrazil]: 'Nenhum agente conectado. Sua mensagem ficou guardada.',
    [OwnerLocale.EnglishUs]: 'No agent is connected. Your message is saved.',
  },
  [InboxCopyKey.AgentNotListening]: {
    [OwnerLocale.PortugueseBrazil]: 'O agente {agent} não está ouvindo agora. Sua mensagem espera no inbox.',
    [OwnerLocale.EnglishUs]: 'The agent {agent} is not listening right now. Your message waits in the inbox.',
  },
  [InboxCopyKey.NoticeBody]: {
    [OwnerLocale.PortugueseBrazil]: 'O agente {agent} tem uma mensagem para você: {preview}',
    [OwnerLocale.EnglishUs]: 'The agent {agent} has a message for you: {preview}',
  },
  [InboxCopyKey.QuestionNoticeBody]: {
    [OwnerLocale.PortugueseBrazil]: 'O agente {agent} tem uma pergunta para você: {preview}',
    [OwnerLocale.EnglishUs]: 'The agent {agent} has a question for you: {preview}',
  },
  [InboxCopyKey.NoticeQuickReply]: {
    [OwnerLocale.PortugueseBrazil]: 'Abrir',
    [OwnerLocale.EnglishUs]: 'Open',
  },
  [InboxCopyKey.PreviewImage]: { [OwnerLocale.PortugueseBrazil]: '[imagem]', [OwnerLocale.EnglishUs]: '[image]' },
  [InboxCopyKey.PreviewVideo]: { [OwnerLocale.PortugueseBrazil]: '[vídeo]', [OwnerLocale.EnglishUs]: '[video]' },
  [InboxCopyKey.PreviewAudio]: { [OwnerLocale.PortugueseBrazil]: '[áudio]', [OwnerLocale.EnglishUs]: '[audio]' },
  [InboxCopyKey.PreviewVoice]: { [OwnerLocale.PortugueseBrazil]: '[mensagem de voz]', [OwnerLocale.EnglishUs]: '[voice note]' },
  [InboxCopyKey.PreviewDocument]: { [OwnerLocale.PortugueseBrazil]: '[documento]', [OwnerLocale.EnglishUs]: '[document]' },
  [InboxCopyKey.PreviewSticker]: { [OwnerLocale.PortugueseBrazil]: '[figurinha]', [OwnerLocale.EnglishUs]: '[sticker]' },
  [InboxCopyKey.PreviewReaction]: { [OwnerLocale.PortugueseBrazil]: '[reação]', [OwnerLocale.EnglishUs]: '[reaction]' },
  [InboxCopyKey.PreviewLocation]: { [OwnerLocale.PortugueseBrazil]: '[localização]', [OwnerLocale.EnglishUs]: '[location]' },
  [InboxCopyKey.PreviewContacts]: { [OwnerLocale.PortugueseBrazil]: '[contato]', [OwnerLocale.EnglishUs]: '[contact]' },
  [InboxCopyKey.PreviewChoice]: { [OwnerLocale.PortugueseBrazil]: '[resposta]', [OwnerLocale.EnglishUs]: '[answer]' },
};

export function renderCopy(input: { key: InboxCopyKey; locale: OwnerLocale; values: Record<string, string> }): string;
```

`renderCopy` replaces each `{name}` token with `values[name]` and throws `InboxError` `invalid_input` when a token has no value. Its body is in S2.2, not in Step 0; Step 0 declares it as a stub.

### `libs/core/src/inbox/use-cases/types.ts`

```ts
import type { AgentName, ConnectionIdentity } from '../connection';
import type { DeliveryState, InboxStatus, MessageKind, OwnerLocale, ReplyStatus } from '@zapbip/types';
import type { ContactCard, Message, MediaSource, QuestionOption } from '../message';
import type { MediaMessageKind } from '../constants';
import type { StoredMedia } from '../inbox-records';
import type { CoreDependencies } from '../ports';

export type CallContext = {
  dependencies: CoreDependencies;
  connection: ConnectionIdentity;
};

export type SendResult = {
  messageId: string;
  delivery: DeliveryState.Sent | DeliveryState.Queued;
};

export type SendTextInput = CallContext & { text: string; replyToMessageId: string | null };
export type SendMediaInput = CallContext & {
  mediaKind: MediaMessageKind;
  voice: boolean;
  source: MediaSource;
  caption: string | null;
  filename: string | null;
  replyToMessageId: string | null;
};
export type SendLocationInput = CallContext & {
  latitude: number;
  longitude: number;
  name: string | null;
  address: string | null;
  replyToMessageId: string | null;
};
export type SendContactsInput = CallContext & { contacts: ContactCard[]; replyToMessageId: string | null };
export type ReactInput = CallContext & { targetMessageId: string; emoji: string | null };

export type AnsweredReply = { status: ReplyStatus.Answered; answer: string; messageId: string };
export type PendingReply = { status: ReplyStatus.Pending; questionId: string };
export type MessageReply = { status: ReplyStatus.Message; messages: Message[] };
export type TimeoutReply = { status: ReplyStatus.Timeout };

export type AskInput = CallContext & { text: string; options: string[]; optionDescriptions: (string | null)[]; timeoutMs: number };
export type AskResult = AnsweredReply | PendingReply;
export type WaitForReplyInput = CallContext & { questionId: string | null; timeoutMs: number };
export type WaitForReplyResult = AnsweredReply | MessageReply | TimeoutReply;

export type CheckInboxInput = CallContext;
export type CheckInboxResult = { status: InboxStatus; messages: Message[] };
export type GetMessagesInput = CallContext & { limit: number };
export type GetMessagesResult = { unread: Message[]; history: Message[] };

export type CreateUploadInput = CallContext & { filename: string; mimeType: string; sizeBytes: number };
export type CreateUploadResult = { uploadId: string; expiresAt: number };

export type OwnerInboundContent =
  | { kind: MessageKind.Text; text: string }
  | ({ kind: MediaMessageKind; voice: boolean; mediaId: string; mimeType: string; sizeBytes: number; filename: string | null; caption: string | null })
  | { kind: MessageKind.Location; latitude: number; longitude: number; name: string | null; address: string | null }
  | { kind: MessageKind.Contacts; contacts: ContactCard[] }
  | { kind: MessageKind.Reaction; targetMessageId: string; emoji: string | null }
  | { kind: MessageKind.Choice; optionId: string; optionTitle: string; optionDescription: string | null };

export type OwnerInboundMessage = {
  at: number;
  replyToMessageId: string | null;
  content: OwnerInboundContent;
};

export type ReceiveOwnerMessageInput = {
  dependencies: CoreDependencies;
  ownerLocale: OwnerLocale;
  channelMessageId: string;
  ownerMessage: OwnerInboundMessage;
};
export type ReceiveResult = { messageId: string | null; agent: AgentName | null; duplicate: boolean };

export type DescribeUploadInput = { dependencies: CoreDependencies; mediaId: string };
export type CompleteUploadInput = { dependencies: CoreDependencies; mediaId: string };
export type SweepExpiredInput = { dependencies: CoreDependencies };
export type SweepExpiredResult = { nextDueAt: number | null };

export type DeliverToOwnerInput = {
  dependencies: CoreDependencies;
  ownerLocale: OwnerLocale;
  agent: AgentName | null;
  messageId: string;
  content: MessageContent;
  replyToMessageId: string | null;
};
export type DeliverToOwnerResult = { delivery: DeliveryState.Sent | DeliveryState.Queued };
```

The import lines list exactly the names the file uses; `MessageContent`, `Message`, `ContactCard`, `MediaSource` and `QuestionOption` come from `../message`.

The media kinds of `OwnerInboundContent` carry `voice` for every media kind, not only audio. Core rejects `voice: true` on any kind other than `audio`.

### `libs/core/src/inbox/use-cases/*.ts` signatures

```ts
export function sendText(input: SendTextInput): Promise<SendResult>;
export function sendMedia(input: SendMediaInput): Promise<SendResult>;
export function sendLocation(input: SendLocationInput): Promise<SendResult>;
export function sendContacts(input: SendContactsInput): Promise<SendResult>;
export function react(input: ReactInput): Promise<SendResult>;
export function ask(input: AskInput): Promise<AskResult>;
export function waitForReply(input: WaitForReplyInput): Promise<WaitForReplyResult>;
export function getMessages(input: GetMessagesInput): Promise<GetMessagesResult>;
export function checkInbox(input: CheckInboxInput): Promise<CheckInboxResult>;
export function createUpload(input: CreateUploadInput): Promise<CreateUploadResult>;
export function describeUpload(input: DescribeUploadInput): Promise<StoredMedia>;
export function completeUpload(input: CompleteUploadInput): Promise<StoredMedia>;
export function receiveOwnerMessage(input: ReceiveOwnerMessageInput): Promise<ReceiveResult>;
export function sweepExpired(input: SweepExpiredInput): Promise<SweepExpiredResult>;
export function deliverToOwner(input: DeliverToOwnerInput): Promise<DeliverToOwnerResult>;
export function touchAgent(input: { dependencies: CoreDependencies; agent: AgentName }): Promise<void>;
```

Files: `send-text.ts`, `send-media.ts`, `send-location.ts`, `send-contacts.ts`, `react.ts`, `ask.ts`, `wait-for-reply.ts`, `get-messages.ts`, `check-inbox.ts`, `create-upload.ts`, `describe-upload.ts`, `complete-upload.ts`, `receive-owner-message.ts`, `sweep-expired.ts`, `deliver-to-owner.ts`, `touch-agent.ts`. Each file exports its one function. `libs/core/src/inbox/index.ts` and `libs/core/src/index.ts` re-export the public surface.

### `apps/api/src/contract/constants.ts`

```ts
export const CONNECTION_SECRET_PREFIX = 'zb_conn_';
export const CONNECTION_SECRET_BYTES = 32;
export const CONNECTION_SECRET_PATTERN = /^zb_conn_[A-Za-z0-9_-]{43}$/;
export const MCP_SERVER_NAME = 'zapbip';
export const MCP_SERVER_VERSION = '0.1.0';
export const HEALTH_PATH = '/health';
export const UNAUTHORIZED_BODY = { error: 'unauthorized' } as const;
export const CLOCK_OFFSET_STORAGE_KEY = 'clock_offset_ms';
export const DEV_OWNER_PATH_PREFIX = '/dev/owner/:phone';
export const OWNER_PHONE_PATTERN = /^[0-9]{8,15}$/;
export const INLINE_IMAGE_CONTENT_TYPE = 'image';
```

### `apps/api/src/contract/env.ts`

```ts
import type { AccountInbox } from '../account-inbox/account-inbox';

export type Bindings = {
  ACCOUNT_INBOX: DurableObjectNamespace<AccountInbox>;
  CONNECTIONS: D1Database;
  MEDIA: R2Bucket;
  MEDIA_LINK_SIGNING_KEY: string;
  UPLOAD_LINK_SIGNING_KEY: string;
  PUBLIC_ORIGIN: string;
};
```

### `apps/api/src/contract/log.ts` and `apps/api/src/log.ts`

`contract/log.ts` declares the event enum and the field type. `apps/api/src/log.ts` declares `logEvent`, a Step 0 stub that L3 implements in S3.2.

```ts
export enum LogEvent {
  AuthRejected = 'auth_rejected',
  ToolCall = 'tool_call',
  ToolError = 'tool_error',
  OwnerMessage = 'owner_message',
  OwnerMessageDuplicate = 'owner_message_duplicate',
  Send = 'send',
  SendFailed = 'send_failed',
  Upload = 'upload',
  MediaRead = 'media_read',
  Sweep = 'sweep',
  ClockAdvanced = 'clock_advanced',
}

export type LogFields = {
  event: LogEvent;
  accountId?: string;
  agent?: string;
  messageId?: string;
  kind?: string;
  sizeBytes?: number;
  errorCode?: string;
};
```

```ts
import type { LogFields } from './contract/log';

export function logEvent(fields: LogFields): void {
  void fields;
  throw new Error('logEvent is not implemented');
}
```

`LogFields` has no field for text, caption, filename, phone, or secret. That absence is the contract that SEC-7 and SEC-8 test.

### `apps/api/src/contract/account-inbox-rpc.ts`

```ts
import type {
  AskInput, AskResult, CheckInboxInput, CheckInboxResult, CreateUploadInput, CreateUploadResult,
  GetMessagesInput, GetMessagesResult, ReactInput, ReceiveResult, OwnerInboundMessage,
  SendContactsInput, SendLocationInput, SendMediaInput, SendResult, SendTextInput, WaitForReplyInput,
  WaitForReplyResult, CoreDependencies, StoredMedia,
} from '@zapbip/core';
import type { InboxErrorCode, ChannelErrorKind, OwnerLocale, TemplateKind } from '@zapbip/types';

export type CallOutcome<Value> =
  | { ok: true; value: Value }
  | { ok: false; errorCode: InboxErrorCode | ChannelErrorKind; message: string };

export type AgentRequest<Input extends { dependencies: CoreDependencies }> = Omit<Input, 'dependencies'>;

export type ScreenEntry = {
  at: number;
  messageId: string | null;
  template: TemplateKind | null;
  text: string;
  options: string[];
};

export interface AccountInboxRpc {
  sendText(input: AgentRequest<SendTextInput>): Promise<CallOutcome<SendResult>>;
  sendMedia(input: AgentRequest<SendMediaInput>): Promise<CallOutcome<SendResult>>;
  sendLocation(input: AgentRequest<SendLocationInput>): Promise<CallOutcome<SendResult>>;
  sendContacts(input: AgentRequest<SendContactsInput>): Promise<CallOutcome<SendResult>>;
  react(input: AgentRequest<ReactInput>): Promise<CallOutcome<SendResult>>;
  ask(input: AgentRequest<AskInput>): Promise<CallOutcome<AskResult>>;
  waitForReply(input: AgentRequest<WaitForReplyInput>): Promise<CallOutcome<WaitForReplyResult>>;
  getMessages(input: AgentRequest<GetMessagesInput>): Promise<CallOutcome<GetMessagesResult>>;
  checkInbox(input: AgentRequest<CheckInboxInput>): Promise<CallOutcome<CheckInboxResult>>;
  createUpload(input: AgentRequest<CreateUploadInput>): Promise<CallOutcome<CreateUploadResult>>;
  describeUpload(input: { mediaId: string }): Promise<CallOutcome<StoredMedia>>;
  completeUpload(input: { mediaId: string }): Promise<CallOutcome<StoredMedia>>;
  receiveOwnerMessage(input: { ownerLocale: OwnerLocale; channelMessageId: string; ownerMessage: OwnerInboundMessage }): Promise<CallOutcome<{ messageId: string | null; agent: string | null; duplicate: boolean }>>;
}

export interface DevAccountInboxRpc extends AccountInboxRpc {
  readScreen(): Promise<ScreenEntry[]>;
  advanceClock(input: { advanceMs: number }): Promise<number>;
}
```

`AccountInbox` reads its account id from `this.ctx.id.name` (the object is created with `idFromName(accountId)`). It builds `CoreDependencies` from that id and its adapters.

### `apps/api/src/contract/mcp-schemas.ts`

Types only. Zod checks types and presence; core owns every limit and every message (Review finding 4). Optional fields are `.nullable().default(null)`, and numbers that have a default use `.default(...)`.

```ts
import { z } from 'zod';
import { ASK_MAX_WAIT_SECONDS, HISTORY_LIMIT } from '@zapbip/core';
import { DeliveryState, InboxStatus, MessageKind, MessageDirection, MessageSender, OwnerLocale, ReplyStatus } from '@zapbip/types';

const nullableString = z.string().nullable().default(null);

export const sendableMediaKind = z.enum([MessageKind.Image, MessageKind.Video, MessageKind.Audio, MessageKind.Document, MessageKind.Sticker]);

export const contactInputSchema = z.object({
  name: z.string(),
  phones: z.array(z.string()),
  emails: z.array(z.string()).default([]),
  organization: nullableString,
});

export const sendMessageInputShape = { text: z.string(), reply_to: nullableString };
export const sendMediaInputShape = {
  kind: sendableMediaKind,
  voice: z.boolean().default(false),
  url: nullableString,
  upload_id: nullableString,
  caption: nullableString,
  filename: nullableString,
  reply_to: nullableString,
};
export const sendLocationInputShape = {
  latitude: z.number(),
  longitude: z.number(),
  name: nullableString,
  address: nullableString,
  reply_to: nullableString,
};
export const sendContactInputShape = { contacts: z.array(contactInputSchema), reply_to: nullableString };
export const reactInputShape = { message_id: z.string(), emoji: z.string() };
export const askInputShape = {
  question: z.string(),
  options: z.array(z.object({ title: z.string(), description: nullableString })),
  timeout_seconds: z.number().int().default(ASK_MAX_WAIT_SECONDS),
};
export const waitForReplyInputShape = {
  question_id: nullableString,
  timeout_seconds: z.number().int().default(ASK_MAX_WAIT_SECONDS),
};
export const getMessagesInputShape = { limit: z.number().int().default(HISTORY_LIMIT) };
export const checkInboxInputShape = {};
export const createUploadInputShape = {
  filename: z.string(),
  mime_type: z.string(),
  size_bytes: z.number().int(),
};

export const wireOptionSchema = z.object({
  option_id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
});

export const wireContactSchema = z.object({
  name: z.string(),
  phones: z.array(z.string()),
  emails: z.array(z.string()),
  organization: z.string().nullable(),
});

export const messageWireSchema = z.object({
  message_id: z.string(),
  direction: z.enum(MessageDirection),
  sender: z.enum(MessageSender),
  verified: z.boolean(),
  agent: z.string().nullable(),
  at: z.iso.datetime(),
  reply_to: z.string().nullable(),
  delivery: z.enum(DeliveryState).nullable(),
  read: z.boolean(),
  kind: z.enum(MessageKind),
  text: z.string().nullable(),
  media_id: z.string().nullable(),
  url: z.string().nullable(),
  mime_type: z.string().nullable(),
  size_bytes: z.number().nullable(),
  filename: z.string().nullable(),
  caption: z.string().nullable(),
  voice: z.boolean().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  name: z.string().nullable(),
  address: z.string().nullable(),
  contacts: z.array(wireContactSchema).nullable(),
  emoji: z.string().nullable(),
  target_message_id: z.string().nullable(),
  choice: z.object({
    question_id: z.string(),
    options: z.array(wireOptionSchema),
    selected: wireOptionSchema.nullable(),
  }).nullable(),
});

export const deliveryResultOutputShape = {
  message_id: z.string(),
  delivery: z.enum([DeliveryState.Sent, DeliveryState.Queued]),
};

export const replyResultOutputShape = {
  status: z.enum(ReplyStatus),
  answer: z.string().nullable(),
  message_id: z.string().nullable(),
  question_id: z.string().nullable(),
  messages: z.array(messageWireSchema).nullable(),
};

export const getMessagesOutputShape = {
  unread: z.array(messageWireSchema),
  history: z.array(messageWireSchema),
};

export const checkInboxOutputShape = {
  status: z.enum(InboxStatus),
  messages: z.array(messageWireSchema),
};

export const createUploadOutputShape = {
  upload_id: z.string(),
  upload_url: z.string(),
  expires_at: z.iso.datetime(),
};
```

The `OwnerLocale` import is unused in this file and is removed by L4a in S4.2 if the linter flags it; the file is otherwise verbatim.

### `apps/api/src/signing.ts`

```ts
import type { LinkPurpose } from '@zapbip/types';

export function canonicalLinkString(input: { accountId: string; mediaId: string; purpose: LinkPurpose; expiresAt: number }): string {
  return [input.purpose, input.accountId, input.mediaId, String(input.expiresAt)].join('\n');
}

export function signLink(input: { key: string; accountId: string; mediaId: string; purpose: LinkPurpose; expiresAt: number }): Promise<string> {
  void input;
  throw new Error('signLink is not implemented');
}

export function verifyLink(input: {
  key: string;
  accountId: string;
  mediaId: string;
  purpose: LinkPurpose;
  expiresAt: number;
  signature: string;
  now: number;
}): Promise<boolean> {
  void input;
  throw new Error('verifyLink is not implemented');
}
```

`canonicalLinkString` is the one canonical string (Review finding 1), over purpose, account id, media id and expiry. Both `signLink` and `verifyLink` sign and check that exact string with HMAC-SHA-256. `signLink` returns lowercase hex. `verifyLink` returns `false` when `now > expiresAt`, and otherwise decodes the hex and calls `crypto.subtle.verify`. Its owner is L3.

### Adapter stubs (signatures; each file exports exactly these)

```ts
// apps/api/src/adapters/platform/hash.ts
export function hashConnectionSecret(input: { secret: string }): Promise<string>;

// apps/api/src/adapters/platform/clock.ts
export function createPlatformClock(): Clock;
export type DurableClock = Clock & { advance(input: { advanceMs: number }): Promise<number> };
export function loadDurableClock(input: { storage: DurableObjectStorage }): Promise<DurableClock>;

// apps/api/src/adapters/platform/ids.ts
export function createIdGenerator(): IdGenerator;

// apps/api/src/adapters/d1/d1-connection-directory.ts
export class D1ConnectionDirectory implements ConnectionDirectory {
  constructor(input: { database: D1Database });
  resolveSecretDigest(input: { secretDigest: string }): Promise<ConnectionIdentity | null>;
}

// apps/api/src/adapters/d1/d1-message-index.ts
export class D1MessageIndex {
  constructor(input: { database: D1Database });
  record(input: { id: string; accountId: string; at: number }): Promise<boolean>;
  find(input: { id: string }): Promise<{ accountId: string } | null>;
}

// apps/api/src/adapters/d1/d1-owner-directory.ts
export function findOwnerByPhone(input: { database: D1Database; phone: string }): Promise<{ accountId: string; ownerLocale: OwnerLocale } | null>;

// apps/api/src/adapters/r2/r2-media-store.ts
export function createR2MediaStore(input: {
  bucket: R2Bucket;
  mediaLinkSigningKey: string;
  uploadLinkSigningKey: string;
  clock: Clock;
}): MediaStore;

// apps/api/src/adapters/fake/fake-whatsapp-sender.ts
export function createFakeWhatsAppSender(input: { storage: DurableObjectStorage; clock: Clock }): MessageSender & { readScreen(): Promise<ScreenEntry[]> };

// apps/api/src/adapters/wake/none-waker.ts
export function createNoneWaker(): AgentWaker;

// apps/api/src/adapters/sqlite/sqlite-inbox-repository.ts
export function createSqliteInboxRepository(input: { storage: DurableObjectStorage }): InboxRepository;
```

`createR2MediaStore` builds the key `accounts/<accountId>/media/<mediaId>`. `signedLink` uses `mediaLinkSigningKey` for `LinkPurpose.Read` and `uploadLinkSigningKey` for `LinkPurpose.Upload`. `createFakeWhatsAppSender` and `createSqliteInboxRepository` are the only adapters that touch the Durable Object's storage.

### `apps/api/src/account-inbox/account-inbox.ts` (stub), `apps/api/src/dev/dev-account-inbox.ts` (stub)

```ts
import { DurableObject } from 'cloudflare:workers';
import type { Bindings } from '../contract/env';
import type { AccountInboxRpc } from '../contract/account-inbox-rpc';

export class AccountInbox extends DurableObject<Bindings> implements AccountInboxRpc {
  alarm(): Promise<void>;
  sendText(input: never): never;
  sendMedia(input: never): never;
  sendLocation(input: never): never;
  sendContacts(input: never): never;
  react(input: never): never;
  ask(input: never): never;
  waitForReply(input: never): never;
  getMessages(input: never): never;
  checkInbox(input: never): never;
  createUpload(input: never): never;
  describeUpload(input: never): never;
  completeUpload(input: never): never;
  receiveOwnerMessage(input: never): never;
}
```

Every method body is `void input; throw new Error('<name> is not implemented');` (`alarm` is `void 0` followed by the same throw). `input: never` is the stub's only typing. L3 replaces the signatures with the contract types when it implements the class.

### Routes, app and entries

- `apps/api/src/app.ts`: `createApp(input: { includeSimulator: boolean }): Hono<{ Bindings: Bindings }>`. It mounts `GET /health` (returns `200` with `{ok: true}`), the MCP routes from `routes/mcp.ts`, `PUT /c/:secret/u/:upload_id` from `routes/upload.ts`, `GET /m/:account_id/:media_id` from `routes/media.ts`, and, only when `includeSimulator` is true, the owner routes from `routes/dev-owner.ts`. Route modules are stubs in Step 0.
- `apps/api/src/index.ts` (production): `export default { fetch: (request, env) => createApp({ includeSimulator: false }).fetch(request, env) }` and `export { AccountInbox }` from the base module, which has no development methods (A26).
- `apps/api/src/index.dev.ts` (development, the top-level `main`): the same shape with `includeSimulator: true`, and `export { DevAccountInbox as AccountInbox }` from `src/dev/dev-account-inbox.ts`, which adds `readScreen` and `advanceClock` to the base class.

- **Deviation (owner delegated 2026-11-06):** `createApp` takes `{ extraRoutes: Hono[] }` instead of `{ includeSimulator: boolean }`, and only `index.dev.ts` imports `routes/dev-owner`. With the boolean, `app.ts` imported the simulator statically and the production bundle carried `/dev/owner/`, `advanceClock` and `readScreen` (PB-2 red).

### `apps/api/wrangler.jsonc` (exact)

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "zapbip-api",
  "main": "src/index.dev.ts",
  "compatibility_date": "2026-08-15",
  "compatibility_flags": ["nodejs_compat"],
  "durable_objects": {
    "bindings": [{ "name": "ACCOUNT_INBOX", "class_name": "AccountInbox" }]
  },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["AccountInbox"] }],
  "d1_databases": [
    {
      "binding": "CONNECTIONS",
      "database_name": "zapbip-connections",
      "database_id": "zapbip-connections-local",
      "migrations_dir": "migrations"
    }
  ],
  "r2_buckets": [{ "binding": "MEDIA", "bucket_name": "zapbip-media" }],
  "rules": [{ "type": "Text", "globs": ["**/*.sql"], "fallthrough": true }],
  "vars": { "PUBLIC_ORIGIN": "http://localhost:8787" },
  "env": {
    "production": {
      "main": "src/index.ts",
      "durable_objects": {
        "bindings": [{ "name": "ACCOUNT_INBOX", "class_name": "AccountInbox" }]
      },
      "d1_databases": [
        {
          "binding": "CONNECTIONS",
          "database_name": "zapbip-connections",
          "database_id": "zapbip-connections-local",
          "migrations_dir": "migrations"
        }
      ],
      "r2_buckets": [{ "binding": "MEDIA", "bucket_name": "zapbip-media" }],
      "rules": [{ "type": "Text", "globs": ["**/*.sql"], "fallthrough": true }]
    }
  }
}
```

- The top-level `database_id` is the placeholder `REPLACE_WITH_PRODUCTION_D1_DATABASE_ID` (final review fix); deploy preflight replaces it with the id `wrangler d1 create` returns. The development environment keeps the local identifier.
- `MEDIA_LINK_SIGNING_KEY` and `UPLOAD_LINK_SIGNING_KEY` are never in this file. Local development reads them from `apps/api/.dev.vars`, which `apps/api/.gitignore` excludes (`.dev.vars`, `.wrangler/`). Integration tests take them from `miniflare.bindings` in `vitest.integration.config.mts`. E2E passes them as `--var` to `wrangler dev`.
- The top level is development (`wrangler dev`). `env.production` repeats every binding and is the block that deploys and that the production-bundle tests use with `--env production`. Slice 1 writes that one block because its production-bundle test needs it; `deploy-readiness` adds `env.staging` and sets the production origin.
- The `Text` rule makes wrangler bundle `src/account-inbox/migrations/*.sql` as text for the Durable Object migrator.

### Vitest configs (Step 0 writes them; L3 and L4b use them)

- `vitest.unit.config.mts`: Node environment, `test/unit/**/*.test.ts`.
- `vitest.integration.config.mts`: `defineWorkersConfig` from `@cloudflare/vitest-pool-workers/config`, `poolOptions.workers.wrangler.configPath` = `./wrangler.jsonc`, `miniflare.bindings` = `{ MEDIA_LINK_SIGNING_KEY: 'test-media-key', UPLOAD_LINK_SIGNING_KEY: 'test-upload-key' }`, include `test/integration/**/*.test.ts`.
- `vitest.e2e.config.mts`: Node environment, include `test/e2e/**/*.e2e.test.ts`, `globalSetup: test/e2e/global-setup.ts`.

### Step 0 additions (review, owner delegated 2026-11-06)

- `apps/api/src/contract/due-time-provider.ts`: `DueTimeProvider { nextDueAt(): Promise<number | null>; runDue(input: { now: number }): Promise<void> }`. `AccountInbox` has `protected readonly dueTimeProviders`, `protected armAlarm()`, and `protected sender` and `clock` for `DevAccountInbox`.
- `apps/api/src/contract/tool-definitions.ts`: the `McpToolName` enum and `TOOL_DEFINITIONS: Record<McpToolName, { description, inputShape, outputShape }>`. Tests assert against `Object.keys(TOOL_DEFINITIONS)`.
- `apps/api/src/adapters/platform/connection-secret.ts`: `generateConnectionSecret(): string` stub.
- `InboxRepository.claimNotice(): Promise<boolean>`: atomic claim of the closed-window notice; `true` for exactly one caller until the window reopens.
- `wrangler.jsonc` `env.production` repeats `vars` and `migrations`.
- `tsx` 4.23.15 at the root; `apps/api` script `dev:seed` is `tsx scripts/dev-seed.ts`.

## Dependencies

Exact pins. Step 0 installs them and commits every manifest and `pnpm-lock.yaml`. No lane adds a package.

| Package | Version | Where | Why |
|---|---|---|---|
| `typescript` | 7.0.2 | root (existing) | compiler |
| `prettier` | 3.9.10 | root (existing) | format gate |
| `@types/node` | 24.19.2 | root (existing) | Node types |
| `vitest` | 5.0.5 | `libs/core`, `libs/types` devDependencies | unit tests |
| `@zapbip/types` | `workspace:*` | `libs/core` dependencies, `apps/api` dependencies | shared enums and constants |
| `@zapbip/core` | `workspace:*` | `apps/api` dependencies | the rules |
| `hono` | 4.13.16 | `apps/api` dependencies | Worker router |
| `@modelcontextprotocol/sdk` | 1.32.2 | `apps/api` dependencies | MCP server and transport |
| `zod` | 4.6.7 | `apps/api` dependencies | MCP schemas and simulator input |
| `drizzle-orm` | 0.45.4 | `apps/api` dependencies | Durable Object SQLite |
| `wrangler` | 4.158.0 | `apps/api` devDependencies | local dev, dry-run bundle |
| `@cloudflare/workers-types` | 5.20261106.1 | `apps/api` devDependencies | Worker globals |
| `@cloudflare/vitest-pool-workers` | 0.23.0 | `apps/api` devDependencies | Worker integration tests |
| `vitest` | 4.1.12 | `apps/api` devDependencies | required by the pool |
| `@vitest/runner` | 4.1.12 | `apps/api` devDependencies | pinned to the Vitest line |
| `@vitest/snapshot` | 4.1.12 | `apps/api` devDependencies | pinned to the Vitest line |
| `drizzle-kit` | 0.31.11 | `apps/api` devDependencies | generates the Durable Object migration |
| `mint` | 4.2.1207 | `apps/docs` devDependencies | `mint dev`, `mint broken-links` |

`tsconfig` types: `libs/core` and `libs/types`: `["node"]`. `apps/api` production code: `["@cloudflare/workers-types", "node"]`. Test files in `apps/api` add `@cloudflare/vitest-pool-workers` through their own `tsconfig.test.json`.

## File map (lanes)

Every path has exactly one owner. A developer that needs a sibling's path stops and asks the lead, or records the gap in its tester-briefing section.

| Lane | Developer | Owned paths |
|---|---|---|
| S0 Step 0 (serial, lead) | `developer-0` | every manifest and tsconfig; `pnpm-lock.yaml`; `libs/types/src/**`; `libs/core/src/inbox/{constants,connection,message,question,inbox-records,ports,errors,validation,option-id,question-key,window,routing,waiters,inbox-copy,index}.ts` (signatures and stubs, `inbox-copy.ts` in full); `libs/core/src/inbox/use-cases/**` (stub files); `apps/api/src/contract/**`; `apps/api/src/signing.ts`; `apps/api/src/adapters/**` (stubs); `apps/api/src/account-inbox/account-inbox.ts` (stub), `apps/api/src/dev/dev-account-inbox.ts` (stub); `apps/api/src/app.ts`, `index.ts`, `index.dev.ts`, `apps/api/src/routes/*.ts` (stubs); `apps/api/wrangler.jsonc`; `apps/api/vitest.*.config.mts`; `apps/api/.gitignore`; `tools/repository-shape/src/delivery-docs.test.ts` (S0.2 red, S0.3 green); the root list; `AGENTS.md` layout lines; the four package READMEs; `docs/learnings/2026-11-06-mcp-sdk-subpath-keeps-the-js-suffix.md` |
| L1 Gates | `developer-1` | `scripts/verify.sh`, `scripts/verify.test.sh`, `scripts/verify-gates.tsv` |
| L2 Core | `developer-2` | `libs/core/src/inbox/**` bodies (validation, option-id, question-key, window, routing, waiters, inbox-copy's `renderCopy`, every use case), `libs/core/src/inbox/testing/in-memory.ts`, `libs/core/src/**/*.test.ts`, `libs/core/src/inbox/use-cases/*.test.ts`, `libs/core/src/inbox/inbox-copy.test.ts` |
| L3 Storage and platform | `developer-3` | `apps/api/src/signing.ts` (bodies), `apps/api/src/log.ts` (body of `logEvent`; the stub is a Step 0 file), `apps/api/src/account-inbox/**` (bodies, migrations under `src/account-inbox/migrations/`, ~~`drizzle.account-inbox.config.ts`~~ (not written: raw bound SQL chosen, `v1.sql` is the schema and the runner is hand-written)), `apps/api/src/adapters/**` (bodies), `apps/api/migrations/0001_core.sql`, `apps/api/scripts/dev-seed.ts`, `apps/api/test/support/**`, `apps/api/test/unit/{signing,connection-secret,no-interpolated-sql}.test.ts`, `apps/api/test/integration/{d1-directory,d1-message-index,sqlite-repository,account-inbox,dev-seed}.test.ts` |
| L4a MCP | `developer-4a` | `apps/api/src/mcp/**`, `apps/api/src/routes/mcp.ts`, `apps/api/test/integration/{mcp-auth,mcp-tools,mcp-inline-images}.test.ts` |
| L4b Routes, media, simulator, E2E | `developer-4b` | `apps/api/src/routes/{upload,media,dev-owner}.ts` (bodies), `apps/api/src/dev/dev-account-inbox.ts` (body), `apps/api/test/integration/{upload-route,media-route,dev-owner,production-entry}.test.ts`, `apps/api/test/e2e/**` |
| L5 Docs | `developer-5` | `apps/docs/**` except its README |

Ownership notes:

- `apps/api/src/contract/**`, `signing.ts` signatures and the `app.ts` mount points are read-only after Step 0.
- `apps/api/src/log.ts` (L3) is imported by every lane; its contract is `logEvent(fields: LogFields)` and is fixed in Step 0. ~~`contract/log.ts` re-exports it~~: it does not.
- `apps/api/test/support/**` belongs to L3 and is consumed by L4a and L4b after L3 merges.
- `libs/core/src/inbox/testing/in-memory.ts` belongs to L2.
- The shape gate is green after Step 0 (S0.3 adds the root entries, the AGENTS layout lines and the READMEs).
- `docs/features/**`, the ADRs, the indexes and the status flips belong to the lead. Each lane writes only its own section of `tester-briefing.md`, under the heading `## Lane <id>`.

## Sequencing and merge order

1. **Step 0 (S0), serial.** The lead lands the contract on `feat/agent-inbox-core`, with the learning and the shape gate green. Step 0 commits every manifest and the lockfile.
2. **Parallel after Step 0:** L1, L2 and L5 branch from the Step 0 commit.
3. **Then L3**, whose integration tests need L2's bodies.
4. **Then L4a**, which needs L3's directory and index, then **L4b**, whose E2E suite needs every lane.
5. **Merge order into `feat/agent-inbox-core`:** S0 → L1 → L2 → L5 → L3 → L4a → L4b.
6. **The lead merges after each lane:** `pnpm typecheck` and `pnpm verify` green before the next merge.
7. **Main moves:** the lead tells each developer which of its files collide. A developer merges main at a task boundary, never mid-step.

## Steps

Every box is empty when authored. A sub-agent ticks its own box. A wrong step is struck through with the reason.

### Step 0 (S0): contract, serial, lead

- [x] **S0.1 Manifests and lock.** Create every `package.json` (`@zapbip/types`, `@zapbip/core`, `@zapbip/api`, `@zapbip/docs`) and tsconfig per **Dependencies**, `apps/api/wrangler.jsonc`, the three Vitest configs, `apps/api/.gitignore`. The lead runs `pnpm install` once and commits `pnpm-lock.yaml` with these files. No further install happens in Step 0. Done in a5ae6b2. ~~Pool config `defineWorkersConfig` from `@cloudflare/vitest-pool-workers/config`~~: 0.23.0 exports no `/config`; the integration config uses the `cloudflareTest` plugin from the package root (bc457d8). `tsx` 4.23.15 joins the root devDependencies (decision, owner delegated 2026-11-06) so `dev:seed` can run a TypeScript script.
- [x] **S0.2 red: root list and READMEs.** In `tools/repository-shape/src/delivery-docs.test.ts`, add `apps`, `libs` to the expected root entries and expect `libs/types/README.md`, `libs/core/README.md`, `apps/api/README.md`, `apps/docs/README.md` to exist. Run `pnpm --filter @zapbip/repository-shape test:unit`. Expected failure: the two roots and the four READMEs are missing. Commit as `test(shape): expect the apps and libs roots` (2516967).
- [x] **S0.3 green: root list and READMEs.** Add `apps` and `libs` to `ROOT_ENTRIES`. Write the four READMEs (purpose only, one paragraph, no commands, no paths except links to folders they name). Add the AGENTS.md layout lines for `apps/api`, `apps/docs`, `libs/core`, `libs/types`. Run the shape tests green. Commit as `feat(shape): add the apps and libs roots` (33624f6). AGENTS.md Language line gained the `*-copy.ts` exception.
- [x] **S0.4 contract.** Write every file of **Contract** and every stub named in it. `pnpm typecheck` green. Commit as `feat(core): add the agent inbox contract` (e7db711). Additions folded in: `DueTimeProvider`, `McpToolName` and `TOOL_DEFINITIONS`, `generateConnectionSecret` and `logEvent` stubs, `InboxRepository.claimNotice()`, `protected` sender and clock, `armAlarm()`. `buildNoticePreview` lives in `inbox-copy.ts` (no file was assigned). `use-cases/types.ts` also imports `MessageContent` from `../message`.
- [x] **S0.5 learning and A9 proof.** In a scratch worktree, check that `import '@modelcontextprotocol/sdk/server/webStandardStreamableHttp'` ~~fails under `moduleResolution: bundler` without `.js`~~ (observed: `tsc` accepts both forms; esbuild fails without `.js`, so the learning records the bundler failure), and that the same import with `.js` resolves. Write `docs/learnings/2026-11-06-mcp-sdk-subpath-keeps-the-js-suffix.md` with the observed `tsc` output in its Signal section. Commit as `docs(learnings): record the MCP SDK subpath suffix` (dc38695).

Step 0 has no backout. A broken contract is fixed forward in a new S0 commit.

### Step L1 (gates)

- [x] **S1.1 red: gate pins.** In `scripts/verify.test.sh`, pin the gates `integration`, `e2e`, `docs` and the rows: `libs/core/src/x.ts` and `libs/types/src/x.ts` → `product typecheck unit integration e2e`; `apps/api/src/x.ts` → `product typecheck unit integration e2e`; `apps/docs/docs.json` → `docs`; `apps/api/README.md` → `docs`. Run `pnpm test:verify`. Expected failure: the gate names are unknown and the rows fall through to `apps/*`. Commit as `test(verify): pin the api, core, types and docs gates`. Done in 448fb27.
- [x] **S1.2 green: gates.** In `scripts/verify-gates.tsv` put the specific rows before `apps/*` and `libs/*` (the first matching row wins; `[[ == ]]` also matches `/`). In `scripts/verify.sh` add `integration e2e docs` to `ALL_GATES` with `gate_integration` (`pnpm --filter @zapbip/api test:integration`), `gate_e2e` (`pnpm --filter @zapbip/api test:e2e`, which runs by default) and `gate_docs` (`pnpm --filter @zapbip/docs exec mint broken-links`). The CC cases are skipped inside the e2e suite unless `ZAPBIP_CLAUDE_E2E=1` (A21). Run `pnpm test:verify` green. Commit as `feat(verify): gate the api, core, types and docs packages`. Done in 50f253d. Also added the row `apps/docs/*` (docs, gate `docs`) so any docs site file runs the link check.

Failure modes: see table.

### Step L2 (core)

- [x] **S2.1 red: pure rules.** Write `libs/core/src/inbox/validation.test.ts`, `option-id.test.ts`, `question-key.test.ts`, `window.test.ts`, `routing.test.ts`, `waiters.test.ts`, `inbox-copy.test.ts` with every case of the test plan's **Core unit** rules sections. Run `pnpm --filter @zapbip/core test:unit`. Expected failure: each case fails with `<name> is not implemented`. Commit as `test(core): pin the validation, window, routing, waiter and copy rules`. Done in 7f22dea.
- [x] **S2.2 green: pure rules.** Implement those modules. `normalizeText` applies NFC, trims, collapses internal whitespace to one space. `assertMaxChars` counts code points (`[...value].length`). `parseOptions` gives `buttons` for 1 to `BUTTON_MAX_OPTIONS` titles of at most `BUTTON_TITLE_MAX_CHARS`, and `list` for up to `QUESTION_MAX_OPTIONS` titles of at most `LIST_ROW_TITLE_MAX_CHARS`. `parseEmoji` counts graphemes with `Intl.Segmenter`. `renderCopy` throws `InboxError` `invalid_input` on a missing token. `routeOwnerMessage` follows the rules of the spec's routing list and A22. Commit as `feat(core): implement validation, window, routing, waiters and copy`. Done in 8a4f715.
- [x] **S2.3 red: use cases.** Write the use-case tests of the test plan's **Core unit** use-case section against `libs/core/src/inbox/testing/in-memory.ts`, which the commit adds as a stub (`createInMemoryDependencies` throws `createInMemoryDependencies is not implemented`). Commit as `test(core): pin the inbox use cases`. Done in 70fa62c, d974ba8 corrects two expectations.
- [x] **S2.4 green: use cases.** Implement `testing/in-memory.ts`, `deliver-to-owner.ts`, `touch-agent.ts` and the fourteen public use cases. `deliverToOwner` sets the window's `noticeSentForClosedWindow` to `true` and saves the window before it calls `sender.template`; on failure it saves `false` again (Review finding 15). `receiveOwnerMessage` drops a `channelMessageId` already in `channel_receipts` (`duplicate: true`), then updates the window and flushes the queue for every owner message except a reaction and a notice quick-reply (only the window and the flush), then routes. A `route:` choice assigns every held message to the agent and resolves the waiter; a second unmatched message while held messages exist joins them with no new list (A22). Commit as `feat(core): implement the inbox use cases`. Done in 8ef26c2.

Failure modes: see table.

### Step L3 (storage and platform)

- [x] **S3.1 red: unit.** Write `apps/api/test/unit/signing.test.ts` (round trip; a changed `mediaId`, `expiresAt`, `purpose` or `key` fails; `now > expiresAt` returns `false`; a signature of the wrong length returns `false` without throwing), `connection-secret.test.ts` (the generator's output matches `CONNECTION_SECRET_PATTERN`; 1 000 generated secrets are distinct; the digest is 64 lowercase hex characters) and `no-interpolated-sql.test.ts` (scans `apps/api/src/**/*.ts`; fails on a template literal that contains `SELECT`, `INSERT`, `UPDATE`, `DELETE` or `WHERE` followed by `${`; exempts drizzle's `sql` tagged template). Run `pnpm --filter @zapbip/api test:unit`. Expected failure: `signLink is not implemented` and the generator missing. Commit as `test(api): pin signing, secrets and bound SQL`. Done in 3975fd6.
- [x] **S3.2 green: unit.** Implement `signing.ts` bodies, `adapters/platform/hash.ts`, `generateConnectionSecret` (`zb_conn_` plus 32 random bytes as base64url, in `adapters/platform/connection-secret.ts`; a Step 0 stub exists), and `logEvent` in `apps/api/src/log.ts` (a Step 0 stub exists) (`logEvent` writes one JSON line through `console.log`). Commit as `feat(api): implement signing, secrets and logging`. Done in 90d4ff3.
- [x] **S3.3 red: D1 and repository.** Write `apps/api/test/integration/d1-directory.test.ts` (cases WI-1 to WI-9 of the test plan), `d1-message-index.test.ts`, `sqlite-repository.test.ts` (round trip of each `InboxRepository` method, the seven message kinds, `findNextExpiry`, `findRecentQuestion`, `recordChannelReceipt`), and `apps/api/test/support/{seed,workers-env}.ts`, which seed rows through `0001_core.sql`. Expected failure: `not implemented`. Commit as `test(api): pin the D1 directory, message index and repository`. Done in 923243d.
- [x] **S3.4 green: D1 and repository.** Write `apps/api/migrations/0001_core.sql` exactly as the spec's `0001_core` (with `connections` UNIQUE on `(account_id, agent)`, `owner_identities.account_id` UNIQUE). Implement `d1-connection-directory.ts` (one prepared statement joining `connections` to `owner_identities` on `account_id`, `WHERE secret_digest = ?`, returning `ownerLocale`), `d1-message-index.ts` (`INSERT OR IGNORE`, returns whether a row was written; `find` by id), `d1-owner-directory.ts` (`owner_identities` by `wa_id`). Implement `sqlite-inbox-repository.ts` with the DO `v1` schema of the spec: `inbox_messages (id, agent, direction, kind, payload JSON, reply_to, delivery, read_at, at)`, `questions`, `channel_receipts (wamid PRIMARY KEY, received_at)`, `agent_wake (agent PRIMARY KEY, mode, last_polled_at, updated_at)`, `owner_window`, `agents`, `media`, `screen_entries`. Migrations live in `src/account-inbox/migrations/` as `v1.sql`. The runner `run-migrations.ts` creates `schema_versions`, reads the applied set, and applies every registered version that is missing, in ascending order (A24). Commit as `feat(api): implement the D1 directory and the SQLite repository`. Done in fefbc48.
- [x] **S3.5 red: Durable Object.** Write `apps/api/test/integration/account-inbox.test.ts` (WI-14 to WI-26, WI-118 to WI-121 for the set-based migration runner, WI-123 for the throwing provider): state survives a restart (`runInDurableObject` with a new instance over the same storage); two accounts are isolated; the alarm sweeps an expired upload and an expired queued message (`runDurableObjectAlarm`); after `createUpload` the armed alarm equals `findNextExpiry()` (Review finding 6); a provider that throws in `alarm()` still leaves the alarm armed and the other providers run; a `channel_receipts` duplicate returns `duplicate: true`; `advanceClock({advanceMs: WINDOW_MS})` survives a restart; every `logEvent` line of a session has no `text`, `caption`, `filename` or secret. Expected failure: `not implemented`. Commit as `test(api): pin the Durable Object state, alarm, clock and logs`. Done in eb984a0.
- [x] **S3.6 green: Durable Object.** Implement `account-inbox.ts` with a custom set-based migration runner (drizzle's migrator is not used) and (`accountId` is `this.ctx.id.name`; `CoreDependencies` built per instance from the adapters; each RPC maps to its use case and wraps `InboxError` into `{ok: false, errorCode, message}`; `alarm()` runs each `DueTimeProvider` in a try/catch and always calls `armAlarm()`; the expiry provider is the one registered; every write path calls `armAlarm()`; `sender` and `clock` are `protected` for `DevAccountInbox`), `adapters/platform/clock.ts` (the offset is `storage.get(CLOCK_OFFSET_STORAGE_KEY)`), `ids.ts`, `adapters/fake/fake-whatsapp-sender.ts`, `adapters/wake/none-waker.ts` (returns `Unreached`), `adapters/r2/r2-media-store.ts` (key `accounts/<accountId>/media/<mediaId>`), `adapters/sqlite/sqlite-inbox-repository.ts` (already in S3.4). Commit as `feat(api): implement the Durable Object and its adapters`. Done in 88764a9.
- [x] **S3.7 red then green: dev seed.** `apps/api/test/integration/dev-seed.test.ts` runs `scripts/dev-seed.ts --phone 5511999990000 --agents claude-code,codex --json` against local D1, then checks the connections, the owner identity (`pt_BR`), and that a second run with the same phone fails with `invalid_input` and writes nothing. Red commit first (the script throws `not implemented`), then the green commit. The seed logic is a pure function that returns SQL (integration-tested through D1); `scripts/dev-seed.ts` runs it through `wrangler d1 execute --local --persist-to <dir>` under `tsx`. The `dev:seed` script is already declared by Step 0. Commit both. Done in b4789f8, 1f18200.

Failure modes: see table.

### Step L4a (MCP)

- [x] **S4.1 red: auth.** `apps/api/test/integration/mcp-auth.test.ts`: unknown, malformed and wrong-digest secrets on `/c/:secret/mcp` and a wrong Bearer on `/mcp` return `401` with exactly `UNAUTHORIZED_BODY`, with a byte-equal body for unknown and rejected alike; a valid secret returns `200` for `tools/list`. Expected failure: `expected 401, received 500` (the route stub throws `<name> is not implemented`) and `expected 200, received 500`. Commit as `test(api): pin the MCP secret and Bearer rules`. Evidence: dacf1ae (reworked in 9861daa).
- [x] **S4.2 green: auth.** Implement `apps/api/src/routes/mcp.ts`: hash the secret with `hashConnectionSecret`, resolve through `D1ConnectionDirectory`, reject with `UNAUTHORIZED_BODY` and a `logEvent` `AuthRejected` line that carries no secret, then build a `McpServer` (`createConnectionServer` in `src/mcp/server.ts`) with zero tools and a stateless `WebStandardStreamableHTTPServerTransport` (`enableJsonResponse: true`). Import the SDK subpaths with `.js` (A9). Commit as `feat(api): implement MCP secret resolution`. Evidence: c5d29e6.
- [x] **S4.3 red: tools.** `apps/api/test/integration/mcp-tools.test.ts` (one test per tool, plus each cross-field rule of the test plan's **Worker integration** tools section) and `mcp-inline-images.test.ts` (an owner image of at most `INLINE_IMAGE_MAX_BYTES` returns an image content block; a larger one returns a link only). Expected failure (the real text, because `routes/mcp.ts` is an empty Step 0 stub and no handler is registered): the tool call fails with `tool not found` (the MCP error for an unregistered tool). Tests list tools through `Object.keys(TOOL_DEFINITIONS)`, never a count. Commit as `test(api): pin the ten MCP tools and inline images`. Evidence: 9737ac6 (reworked in 9861daa).
- [x] **S4.4 green: tools.** Implement `src/mcp/tool-definitions.ts` (a record keyed by the tool name, its input and output shapes from `mcp-schemas.ts`), `src/mcp/wire.ts` (`toWireMessage` and the async `toWireMessages`, which reads owner image bytes through `mediaStore.get` for the inline block, and builds absolute links from `PUBLIC_ORIGIN` through `signedLink`), `src/mcp/tool-error.ts` (maps `CallOutcome` errors to `isError: true` with the core message), `src/mcp/inline-images.ts`. Each handler calls its core use case and logs `ToolCall`. Commit as `feat(api): implement the ten MCP tools`. Evidence: ce75f06.

Failure modes: see table.

### Step L4b (routes, media, simulator, E2E)

- [x] **S5.1 red: upload.** `apps/api/test/integration/upload-route.test.ts`: every case of the test plan's **Worker integration** uploads rows. Expected statuses in check order: signature `403`; unknown or expired upload `404` / `410`; missing length `411`; larger `413`; smaller `400`; wrong type `415`. Expected failure: `expected 201, received 500` for the valid PUT. Commit as `test(api): pin the upload route`. Done in 654494a.
- [x] **S5.2 green: upload.** `apps/api/src/routes/upload.ts` for `PUT /c/:secret/u/:upload_id?exp=&sig=`: resolve the secret (`401` as in S4.2), `verifyLink` with `UPLOAD_LINK_SIGNING_KEY` and `LinkPurpose.Upload` (`403`), `describeUpload` (`NotFound` → `404`, `UploadExpired` → `410`, `UploadUnavailable` → `409`), `Content-Length` checks (`411`, `413`, `400`), `Content-Type` against the declared type (type and subtype compared lowercase, parameters ignored, `415`), `MEDIA.put` through `createR2MediaStore`, `completeUpload`, `201`. Commit as `feat(api): implement the upload route`. Done in 33006ec.
- [x] **S5.3 red: media.** `apps/api/test/integration/media-route.test.ts`: valid link `200` with the stored bytes and type; forged `sig` `403`; expired `exp` `403`; another media id `403`; a swapped account id in the path `403` (WI-116); unknown media id `404`. Expected failure: `expected 200, received 500`. Commit as `test(api): pin the signed media link route`. Done in 73a344d.
- [x] **S5.4 green: media.** `apps/api/src/routes/media.ts` for `GET /m/:account_id/:media_id?exp=&sig=`: `verifyLink` with `MEDIA_LINK_SIGNING_KEY` and `LinkPurpose.Read`, the account taken from the path and covered by the HMAC, `mediaStore.get`. Commit as `feat(api): implement the signed media route`. Done in 090041c.
- [x] **S5.5 red: owner simulator.** `apps/api/test/integration/dev-owner.test.ts` against `index.dev.ts`: `POST /dev/owner/:phone/messages` for each kind (text; image, video, audio with and without `voice`, document, sticker as base64 JSON; location; contacts; reaction; choice tap); a quoted reply (`reply_to` set) routes to the quoted message's agent; a duplicate `wamid` returns `200` with `duplicate: true`; an owner reaction does not flush a closed queue; `GET /dev/owner/:phone/screen`; `POST /dev/owner/:phone/clock`; an unknown phone returns `404`. Expected failure: `expected 200, received 500`. Commit as `test(api): pin the phone-keyed owner simulator`. Done in 7194fe5.
- [x] **S5.6 green: owner simulator.** Implement `src/routes/dev-owner.ts` (zod input, `findOwnerByPhone`, `D1MessageIndex.record` for the wamid, owner media bytes through `mediaStore.put`, `receiveOwnerMessage`). Commit as `feat(api): implement the phone-keyed owner simulator`. Done in dc6fac4.
- [x] **S5.7 pin: production entry (WI-117 `/health`, WI-122 base class without development methods).** `apps/api/test/integration/production-entry.test.ts`: on `index.ts`, `/dev/owner/<phone>/messages`, `/screen` and `/clock` return `404`; `/c/<secret>/mcp` returns `200`. Green when it lands, labelled `pin`. Commit as `test(api): pin the production entry without the simulator`. Done in 8be18b9.
- [x] **S5.8 pin: production bundle.** `apps/api/test/e2e/production-bundle.e2e.test.ts` runs `wrangler deploy --dry-run --env production --outdir <scratch>` and checks the bundle has no `/dev/owner/` string, no `owner-simulator` identifier, no `advanceClock` and no `readScreen`; with the top-level (development) block the same strings are present. Green when it lands, labelled `pin`. Commit as `test(api): pin the production bundle without the simulator`. Done in 26f1a96. PB-2 is red, not a pin: `app.ts` (Step 0) imports `routes/dev-owner` statically, so the production bundle carries `/dev/owner/`, `advanceClock` and `readScreen`. The fix needs `app.ts`, which L4b does not own.
- [x] **S5.9 pin: E2E.** `apps/api/test/e2e/global-setup.ts` and `mcp-client.e2e.test.ts`. `globalSetup`: pick a free port (`net` listen on port 0); run `wrangler d1 migrations apply CONNECTIONS --local --persist-to <dir>`; run `scripts/dev-seed.ts --phone 5511999990000 --agents alpha,beta --json --persist-to <dir>`; start `wrangler dev --port <port> --persist-to <dir> --var MEDIA_LINK_SIGNING_KEY:<generated> --var UPLOAD_LINK_SIGNING_KEY:<generated>`; poll `GET /health` with a 30 s bound; `provide` the port, the phone and the secrets. This commit is a `pin`, not a red box: it is green when the lanes before it have merged; if a lane is missing, the first tool call returns `tool not found`, not a startup error. Commit as `test(api): pin the MCP client E2E against wrangler dev`. Done in 01584d1, f0426b3, afd16be.
- [ ] **S5.10 green: E2E.** Once every lane has merged, the E2E cases of the test plan pass. Commit as `test(api): green the MCP client E2E`.

Failure modes: see table.

### Step L5 (docs)

- [x] **S6.1 red.** `apps/docs/docs.json` lists only `index`. `apps/docs/index.mdx` links to `mcp-reference/send-message`, which does not exist. Run `pnpm --filter @zapbip/docs exec mint broken-links`. Expected failure: one broken link, to `mcp-reference/send-message`. Commit as `test(docs): link the MCP reference before its pages exist`. Done in 27b4582.
- [x] **S6.2 green.** Add the navigation of the spec (`index`; `concepts/inbox`, `concepts/questions`, `concepts/24-hour-window`, `concepts/routing`, `concepts/wake-ladder`; `mcp-reference/` with the ten tool pages: `send-message`, `send-media`, `send-location`, `send-contact`, `react`, `ask`, `wait-for-reply`, `get-messages`, `check-inbox`, `create-upload`). Each MCP page carries the tool's input and output fields and the message-kind table.  ~~Write `apps/docs/package.json` (`@zapbip/docs`, `mint` 4.2.1207, scripts `dev` and `broken-links`).~~ Step 0 wrote the manifest; L5 adds only the `dev` and `broken-links` scripts if it needs them. `mint broken-links` green. Commit as `docs(api): write the Mintlify skeleton for slice 1`. Done in 539a484; no scripts added, `mint broken-links` runs through `pnpm exec`.

### Step Z (prove and ship)

- [ ] **Z.1 Tester briefing.** Each lane wrote its section `## Lane <id>` in `docs/features/agent-inbox-core/tester-briefing.md`. The lead owns the rest of that file.
- [ ] **Z.2 Tester run.** A fresh `tester` executed `test-plan.md` and ticked every box with evidence. The CC cases ran only after the owner's go-ahead.
- [ ] **Z.3 Reviewer.** A fresh `reviewer` returned a verdict; refutation of the three claims in `test-plan.md` is recorded.
- [ ] **Z.4 Security reviewer.** A fresh `security-reviewer` returned `Security verdict`.
- [ ] **Z.5 /check-ui.** The Mintlify pages are captured with `mint dev`.
- [ ] **Z.6 /open-pr.** Gates passed, learnings sweep stated, PR opened with a Visual explainer, a `Merge sensitivity` line, a Blast radius section and a Human checklist (sensitive: tier 🔴, account isolation, secrets).

## Failure modes

| Step | What breaks | How I notice (concrete signal) | How I back out |
|------|-------------|--------------------------------|----------------|
| S0.4 (contract) | a lane builds against a signature that changed | `pnpm typecheck` error in a lane branch naming a contract type | fix forward in a new S0 commit; never edit the contract inside a lane. No backout for the commit itself. |
| S0.4 (app entries) | the production entry imports the simulator | `production-entry.test.ts` returns `200` on `/dev/owner/...` | remove the import from `index.ts`; only `index.dev.ts` mounts the simulator |
| S0.5 (A9) | `tsc` accepts the import without `.js` | the proof output in the learning shows `moduleResolution` resolving the suffixless path | keep the suffix (A9 holds); the learning records the observed output |
| S1.2 (gates) | `apps/api/**` or `libs/types/**` matches `apps/*` before its row | `pnpm test:verify` shows `gates: typecheck unit` for an `apps/api/src/...` path | move the specific rows above `apps/*`; revert the commit |
| S1.2 (gates) | `e2e` runs without a Cloudflare login or a free port | `pnpm verify` fails on a clean checkout with a port or auth error | `globalSetup` picks a free port; `wrangler dev` and D1 run locally with no login |
| S2.4 (window) | the window flag is set after the send, so two sends can both see no notice | `deliver-to-owner` concurrency case (CU-94) sends two notices | revert S2.4; the flag is saved before `sender.template` |
| S2.4 (routing) | a rule fires out of order and an owner message goes to the wrong agent | `routing.test.ts` rule-order cases (Review Focus 1) go red | revert S2.2 routing; S2.1 red stays |
| S2.4 (ask) | a retry after an answer creates a second prompt | `ask` retry-after-answer case shows two prompts on the screen (CU-103) | revert S2.4 ask |
| S2.4 (receive) | a reaction or a notice tap opens the window or flushes the queue | `receive-owner-message` reaction case (CU-119) | revert the branch in `receiveOwnerMessage` |
| S3.2 (signing) | a link verifies with the other purpose's key | `signing.test.ts` purpose-swap case passes | revert S3.2; `canonicalLinkString` already includes the purpose |
| S3.4 (D1) | the directory returns a revoked or deleted connection | `d1-directory.test.ts` deleted-row case returns an identity | the query is a join on existing rows only; revert S3.4 |
| S3.6 (alarm) | the alarm is not armed after `createUpload`, so media stays past retention | `account-inbox.test.ts` finds the R2 object after `runDurableObjectAlarm` past its time | re-arm after every write path (A13); revert S3.6 |
| S3.6 (clock) | the development offset is lost on restart | `advanceClock` then restart returns the old `now` | keep the offset in DO storage (S3.5 test) |
| S3.6 (logs) | a message text or secret is logged | `account-inbox.test.ts` log scan finds the text (SEC-8) | `LogFields` has no text field; revert the call site |
| S4.2 (auth) | an unknown and a revoked secret return different bodies | `mcp-auth.test.ts` byte comparison | one return path for every rejection |
| S4.4 (tools) | `InboxError` codes lost across the DO RPC | `mcp-tools.test.ts` expects `invalid_input` and gets a generic error | `CallOutcome` carries the code; fix the wrapper |
| S4.4 (inline images) | the owner's image bytes returned above the limit | `mcp-inline-images.test.ts` large-image case returns an image block | the `INLINE_IMAGE_MAX_BYTES` check runs before `mediaStore.get` |
| S5.2 (upload) | checks run in the wrong order and a short body is stored | `upload-route.test.ts` finds an R2 object after a `400` | revert S5.2 to the check order in the step |
| S5.4 (media link) | a forged `sig` is accepted | `signing.test.ts` changed-signature case passes | `verifyLink` uses `crypto.subtle.verify`; revert S3.2 |
| S5.6 (simulator) | owner media bytes stored without a message index row | `dev-owner.test.ts` finds the R2 object but a reply that quotes the wamid is not routed to its account | record the index before the bytes are read; revert S5.6 |
| S5.9 (E2E setup) | migrations or the seed run against the wrong persist directory | the E2E global setup reports an empty `connections` table | pass `--persist-to` to every wrangler call |
| S5.8 (bundle) | `wrangler deploy --dry-run` needs a login | the PB-1 check reports an auth error | record PB-1 as `not run` in coverage honesty; PB-2 and PB-3 use the same entry through the bundler in wrangler |
| A10 (Vitest) | the pool fails to start under Vitest 5 | `pnpm -F @zapbip/api test:integration` reports a peer error | keep `apps/api` on 4.1.12 with the pins |
| S6.2 (docs) | a page link breaks after a rename | `mint broken-links` red | fix the link in the same commit |

**Steps with no backout:** S0.1 to S0.4 (contract): fix forward in a new S0 commit.

## Z. Prove and ship

- [ ] **Tester briefing:** each lane wrote its `## Lane <id>` section.
- [ ] **Tester run:** a fresh `tester` executed `test-plan.md`; CC cases run after the owner's go-ahead.
- [ ] **Reviewer:** a fresh `reviewer` returned a verdict; refutation of the three riskiest claims is recorded.
- [ ] **Security reviewer:** `Security verdict` returned.
- [ ] **/check-ui:** the Mintlify pages captured with `mint dev`.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
