# Accounts and keys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the owner run the account lifecycle from WhatsApp: the first message creates the account (waitlisted or active), `novo agente`, `agentes`, `revogar`, `girar`, `ajuda` and `apagar conta` work in pt-BR and en, secrets are shown once and stored as digests, and abuse controls (blocklist, per-phone rate, per-connection and per-account outbound limits, daily cap, agent limit) protect the shared number.

**Architecture:** The core gains rule 0 (account commands) and an account-state gate in front of agent-inbox-core's routing rules 1 to 6, pure parsers and copy in `libs/core/src/accounts/`, and use cases behind ports. The Worker runs the sender guard and the account lookup before the owner's `AccountInbox` Durable Object, which applies the state gate, rule 0 or the routing rules, and keeps a tombstone after purge. D1 holds the directory and the blocklist; the Rate Limiting binding holds the counters; R2 holds media under `accounts/<accountId>/media/`.

**Tech Stack:** Node 24, TypeScript, pnpm workspaces, Vitest (`libs/core` 5.0.5, `apps/api` 4.1.12, `@cloudflare/vitest-pool-workers` 0.23.0), Drizzle (`drizzle-kit` 0.31.11, pinned by agent-inbox-core), Cloudflare Workers, D1, R2, Durable Objects, Rate Limiting binding, Mintlify (`mint` 4.2.1207). **No new dependency.**

**Spec:** `docs/features/accounts-and-keys/spec.md` (lands with the branch by the lead). Decisions in this plan's **Assumptions** are `owner delegated 2026-11-06` and bind over the spec where they differ. Binding cross-slice rules: `SCRATCH/feature-stash/cross-slice-decisions.md`.

**Build order:** branch from `main` once `agent-inbox-core` is merged, in parallel with `whatsapp-cloud-channel`. Merge coordination is in **Sequencing**.

## Global Constraints

- Migration `0002_accounts_and_keys.sql` follows the spec's **Data model**, with the rebuild marked `(contract: confirm at build)` against slice 1's merged `0001_core`. An applied migration is never edited; from the first deploy on, migrations are immutable (cross-slice).
- Secret: `zb_conn_` plus 43 base64url characters of 32 random bytes (`CONNECTION_SECRET_PATTERN`). Digest: SHA-256 hex of the full secret string (`hashConnectionSecret`, slice 1). Secrets never reach a log, a D1 row, a Durable Object row or a fixture file.
- Time constants come from `libs/types` (`SECOND_MS`, `MINUTE_MS`, `DAY_MS`). No local copies.
- Owner-facing text is copy (`account-copy.ts`, `pt_BR` and `en_US` for every key). No inline copy.
- `WAITLIST_ENABLED` is `'true'` or `'false'`, read through `isWaitlistEnabled`, which throws on any other value, including a missing one. Workers have no environment at module scope, so the check runs per request in the Worker's fetch path only (A6); the Durable Object does not read the flag.
- Rate limits are configured in `wrangler.jsonc` `ratelimits`; a unit test ties them to the constants.
- Base URL: `PUBLIC_ORIGIN` (slice 1). `PUBLIC_BASE_URL` is never used.
- Wrangler environments: the top-level block is development; `env.staging` and `env.production` repeat every binding. Tests for bundles run with `--env production`.
- Repo rules (`AGENTS.md`): no comments except `// NB ADR NNNN:`; flat `if`s; no `else`; no `??` defaults; enums over string literals; named parameters for more than one parameter; constants over literals; no `.js` import suffix; no acronyms in identifiers (`connectionLink`, not `connectionUrl` or `mcpUrl`; `waId` is kept because it is Meta's field name, A5); type everything.
- No `sleep`. Time in tests comes from the fake `Clock` (core) or `runDurableObjectAlarm` and the pool's `runInDurableObject` (Worker).
- Red-first: a red commit holds only failing tests and the stubs for new members. A test green on arrival is labelled `pin` in the test plan and in its red commit message.
- Docs ownership: the lead owns `docs/features/**`, the ADR files, both indexes and status flips. Lanes never edit them. Lanes return their tester-briefing text to the lead.
- Commits: Conventional Commits, en-US, `Co-Authored-By` trailer. Never `git add -A`, `git add .`, `--no-verify`; never on `main`.
- No test uses a real credential or a third-party network. Meta, Rate Limiting and WhatsApp are faked at their ports.

## Review Focus

1. A command word the owner quotes from an agent's message is routed to that agent, never run as a command. Owned by S1a.1 (`command.test.ts`) and S1b.1 (`receive-owner-message.test.ts`).
2. Two first messages from one phone yield one account; twenty concurrent creates for the last slot yield exactly `AGENTS_PER_ACCOUNT_LIMIT` connections. Owned by S2.1 (`d1-accounts.test.ts`, `d1-connections-lifecycle.test.ts`).
3. A failed send of part 2 of 3 of a create or rotate reply runs the compensation: the new link never works, the old one works again after a rotate, and the owner gets the `SendFailed` reply. Owned by S1b.1 and S1b.3 (`receive-owner-message.test.ts`).
4. A blocked phone, or an owner over `OWNER_MESSAGES_PER_MINUTE`, is dropped silently: no account change, no window opened, the D1 blocklist read first. Owned by S2.2 (`sender-guard.test.ts`) and S4.1 (`owner-inbound.test.ts`).
5. An interrupted deletion finishes through the next owner message or the daily sweep, and ends with no D1 row, no R2 object under the prefix, no Durable Object storage beyond the tombstone, and no `zb_conn_` value in D1. Owned by S1b.2 (`delete-account.test.ts`) and S3.1 (`account-inbox.test.ts`).

## Assumptions (decided, owner can override)

All are `owner delegated 2026-11-06`.

- **A1 Simulator keyed by owner phone.** `POST /dev/owner/:phone/messages`, `GET /dev/owner/:phone/screen`, `POST /dev/owner/:phone/clock`, mounted only by `index.dev.ts`. This follows the consistency pass (`PROGRESS.md`) and replaces the spec's `/dev/c/:secret/...` rows: a connection cannot exist before the first message, so a secret-keyed simulator cannot bootstrap. The spec's rows and its decision table are corrected in the spec by the lead.
- **A2 `dev:seed` removed.** `dev:seed` and `apps/api/scripts/create-dev-connection.ts` are deleted in S2.3. Development accounts come from the simulator's first message with `WAITLIST_ENABLED` `'false'`.
- **A3 Secret lookup.** `ConnectionDirectory.resolveSecretDigest({secretDigest})`, column `secret_digest` (slice 1). The order is fixed: (1) a value failing `CONNECTION_SECRET_PATTERN` returns `null` with no D1 read; (2) otherwise the digest is hashed and looked up by equality in D1, joined with `accounts`, returning `null` unless the account is `active` and the connection is not revoked. No `timingSafeEqual` (decision 14): the lookup is an indexed equality on a digest, and nothing compares secrets in application code.
- **A4 Agent name length.** The pattern and length are slice 1's `AGENT_NAME_PATTERN` and `AGENT_NAME_MAX_CHARS`. The spec says 32; the core review says 20. This slice never writes a length literal; confirm the value at plan refresh.
- **A5 `wa_id`.** Digits only, as Meta sends it. `owner_identities.wa_id` and `blocked_phones.wa_id` hold it. Operator commands validate it as digits only (`^[0-9]{8,15}$`) before any SQL (A24).
- **A6 Waitlist flag (review item 16).** `isWaitlistEnabled({value})` returns `true` for `'true'`, `false` for `'false'`, and throws for anything else, including `undefined`. Workers have no environment at module scope, so a bad value does not fail at import: it makes every request throw, `/health` included, until the value is fixed. The check runs per request in the Worker's fetch handler, before routing. The Durable Object constructor does not read the flag (the Worker passes the account state in).
- **A7 Deletion and resume (decision 5).** Four states are read by the Worker. The account object keeps only a tombstone after `purge()`; write methods throw `AccountTombstoned` on a tombstone. Two different resumes exist:
  - **Un-suspend (`resumeSuspendedAccount`):** operator `resume`. Sets `suspended` to `active`. Any other state is a refusal (zero rows changed, the script reports it). It never touches `deleting`.
  - **Finish deletion (`finishAccountDeletion`):** runs the deletion steps from state `deleting`: purge (idempotent; tombstone), R2 `deletePrefix`, then the D1 batch. Triggered by an owner message to a `deleting` account, by the operator's `delete`, and by the **daily sweep**, which lists every `deleting` account and finishes each one. The sweep runs in the existing daily cron handler; no hourly fan-out (cross-slice). Each step is idempotent; a completed account is absent from D1 and is not listed.
- **A8 Suspended replies each time.** Each owner message to a `suspended` account gets one `Suspended` reply; nothing is stored or routed.
- **A9 Connection link.** The use case builds `connectionLink = PUBLIC_ORIGIN + '/c/' + secret + '/mcp'`. The install prompt renderer gets `connectionLink`.
- **A10 Non-text first message (review item 18).** A first message whose kind is not text creates the account, is not stored, and gets `Unknown`. For a `waitlisted` account the `Waitlisted` reply wins. `isFirstMessage` is durable: the account object stores `first_message_id`, the channel message id of the first message it handles, in the same storage transaction that records the reply. `isFirstMessage` is true when storage holds no id or holds the id of this message, so a retry of the same delivery is still treated as the first message and is not stored or routed. Any other message after that sees `isFirstMessage: false`.
- **A11 Partial commands (decision 12; review item 17).** Names are free text, so `girar a imagem`, meant for an agent, is read as a rotate of the name `a-imagem` and gets `NotFound`. The escape is the mention form `@<agent> girar a imagem` (rule 3), which routes the text to that agent with the prefix removed. ADR 0015 records this trade-off (the lead edits the ADR), and the `commands` guide page states it with the escape example.  `novo` alone and `agente` alone are not commands; they route as messages. `novo agente` with an empty name, and `revogar` or `girar` with an empty name (alone or with spaces), reply `Usage`. A reserved name in `revogar` or `girar` replies `NotFound`.
- **A12 Menu ids (decision 6).** Exactly six list ids are commands: `zapbip:create_agent`, `zapbip:list_agents`, `zapbip:revoke_agent`, `zapbip:rotate_agent`, `zapbip:help`, `zapbip:request_deletion`. Any other `zapbip:` id, including `zapbip:confirm_deletion`, maps to `CommandKind.Unknown` and gets `Unknown`. Question ids start with `q_`, so they never collide.
- **A13 Account creation, no orphan.** `findOrCreateByWaId` is one D1 batch: (1) `INSERT INTO accounts ... SELECT ... WHERE NOT EXISTS (SELECT 1 FROM owner_identities WHERE wa_id = ?) AND (SELECT COUNT(*) FROM accounts WHERE created_at > ?) < ?`; (2) `INSERT INTO owner_identities ... ON CONFLICT(wa_id) DO NOTHING`. A second batch for the same `wa_id` sees the identity and inserts no account.
- **A14 Window.** The window opens for every accepted owner message, including commands and the first message (agent-inbox-core).
- **A15 Logs.** `logEvent({event, fields})`. `LogFields` has only ids, kinds, locales and counts: no phone, secret, digest, agent name or text. The MCP route logs `/c/:secret/mcp`.
- **A16 Limits.** Per phone: Rate Limiting `OWNER_RATE_LIMITER` keyed by `waId`, 20 per minute. Per connection: `OUTBOUND_RATE_LIMITER` keyed by `connectionId`, 30 per minute. Per account (decision 15, new): `ACCOUNT_OUTBOUND_RATE_LIMITER` keyed by `accountId`, `ACCOUNT_OUTBOUND_MESSAGES_PER_MINUTE` = 120 (the value is a decision; the owner can change it). The outbound check admits only when both the connection and the account pass. Only `send_*`, `react` and `ask` count.
- **A17 No new dependency.**
- **A18 Locale (cross-slice).** `OwnerLocale` is an account property set at creation: `pt_BR` when `wa_id` starts with `55`, `en_US` otherwise. Commands do not change it. A command's reply uses the keyword's language (spec table); other replies use the account's locale. `setLocale` is not in the port.
- **A19 Deletion request (decision 6).** `apagar conta` (or `delete account`) stores `deletion_requested_at` in the account object's storage and replies `DeletionRequest` with the phrase. The phrase `apagar conta definitivamente` (or `delete account permanently`) is accepted only while `now - deletion_requested_at <= DELETION_CONFIRM_TTL_MS` (10 minutes). Otherwise it replies `DeletionExpired` and deletes nothing. The confirmation is the phrase or nothing else; the menu row for deletion only starts a request.
- **A20 ConfirmDeletion states (decision 2).** `ConfirmDeletion` is allowed in `waitlisted` and `active`. `suspended` gets `Suspended`; `deleting` is dropped (the Worker finishes the deletion).
- **A21 Compensation and reply parts (decision 3).** `AccountCommandResult.compensation` is `{connectionId, agent, oldDigest, newDigest}` when a connection was written, else `null`. `oldDigest` is `null` for a create (the compensation revokes the row) and the previous digest for a rotate (the compensation compare-and-sets back). `receiveOwnerMessage` sends the reply parts in order; if any part fails, it runs the compensation, then sends one `SendFailed` reply on a best-effort basis. Nothing is sent after the failure.
- **A22 Revocation (decision 4, corrected by the orchestrator).** Revoke calls `ConnectionRevocations.recordRevocation({accountId, agent})`: it clears that agent's wake state (`WakeRepository.clearWake`: setting, sealed target, jobs; slices 4 and 7 implement their parts), cancels that agent's live waiters (`ReplyWaiters.cancelAgent`, a new member: a held `ask` or `wait_for_reply` ends at once with `ReplyStatus.Timeout`), and marks the agent revoked for standby selection. Rotate does **not** call `recordRevocation`: it keeps the wake setting and calls only `ConnectionRevocations.cancelWaiters({accountId, agent})`, which cancels the agent's live waiters. Both are exposed on the account object as RPCs (`recordRevocation`, `cancelWaiters`) for the Worker.
- **A23 Install prompt parts (decision 10).** The prompt splits on line boundaries. Each part has a label line `i/n` whose length is fixed by `PART_LABEL_BUDGET_CHARS` (16, counting the newline), so a part's text is at most `WHATSAPP_TEXT_MAX_CHARS - PART_LABEL_BUDGET_CHARS`. A line never splits. The link line is one line and never splits; a link line longer than the budget throws. Empty input throws.
- **A24 Operator script (decision 15).** `apps/api/scripts/operator-account.sh <command> <wa_id>` (commands: `enable`, `suspend`, `resume`, `block`, `unblock`, `delete`). It validates `wa_id` as digits only (`^[0-9]{8,15}$`), refuses otherwise, and runs one fixed SQL statement through `wrangler d1 execute` per command. The runbook says to block and suspend together for an abusive phone. `delete` sets `deleting`; the daily sweep finishes it.
- **A25 Parallel build (cross-slice).** Built in parallel with `whatsapp-cloud-channel`. `whatsapp-cloud-channel` creates `apps/api/src/adapters/d1/d1-account-directory.ts` with `findByWaId`; this slice extends that file after that slice merges (`(contract: confirm at build)`). `OwnerLocale` is in `libs/types`, created by whichever slice merges first (`(contract: confirm at build)`).
- **A26 Plan refresh (first step).** The plan is diffed against `main` and the merged slice 1 before any lane starts: paths, names, exports and migration numbers. Items marked `(contract: confirm at build)` are settled then.

## Contract (Step 0, verbatim)

Step 0 lands these signatures and stubs in one serial lane. Stubs for **new members only** are `void input;` followed by `throw new Error('<name> is not implemented');`. Existing slice-1 members are not stubbed. Every later lane builds against them. A signature change after Step 0 is a new Step 0 commit that every lane merges.

### `libs/core/src/enums.ts` (appended)

```ts
export enum AccountState {
  Waitlisted = 'waitlisted',
  Active = 'active',
  Suspended = 'suspended',
  Deleting = 'deleting',
}

export enum CommandKind {
  CreateAgent = 'create_agent',
  ListAgents = 'list_agents',
  RevokeAgent = 'revoke_agent',
  RotateAgent = 'rotate_agent',
  Help = 'help',
  RequestDeletion = 'request_deletion',
  ConfirmDeletion = 'confirm_deletion',
  Unknown = 'unknown',
}

export enum SenderVerdict {
  Admitted = 'admitted',
  Blocked = 'blocked',
  RateLimited = 'rate_limited',
}

export enum RegisterOutcome {
  Registered = 'registered',
  LimitReached = 'limit_reached',
  NameTaken = 'name_taken',
}

export enum AccountStateOutcome {
  Proceed = 'proceed',
  Reply = 'reply',
  Drop = 'drop',
}

export enum ReplyKind {
  Text = 'text',
  List = 'list',
}

export enum AccountReplyIntent {
  Waitlisted = 'waitlisted',
  Suspended = 'suspended',
  Created = 'created',
  InvalidName = 'invalid_name',
  ReservedName = 'reserved_name',
  NameTaken = 'name_taken',
  LimitReached = 'limit_reached',
  NotFound = 'not_found',
  Revoked = 'revoked',
  Rotated = 'rotated',
  Listed = 'listed',
  EmptyList = 'empty_list',
  Usage = 'usage',
  Menu = 'menu',
  DeletionRequest = 'deletion_request',
  DeletionExpired = 'deletion_expired',
  DeletionDone = 'deletion_done',
  SendFailed = 'send_failed',
  Unknown = 'unknown',
}

export enum AccountReplyParameter {
  AgentName = 'agent_name',
  Limit = 'limit',
  Usage = 'usage',
  Phrase = 'phrase',
  Agents = 'agents',
  InstallPrompt = 'install_prompt',
}
```

Additive values in existing enums: `IdPrefix.Account = 'acc'`, `IdPrefix.Connection = 'con'`, `RoutingRule.AccountCommand = 'account_command'`.

### `libs/core/src/constants.ts` (appended; time units from `@zapbip/types`)

```ts
import { DAY_MS, MINUTE_MS } from '@zapbip/types';

export const AGENTS_PER_ACCOUNT_LIMIT = 8;
export const SECRET_PREFIX = 'zb_conn_';
export const SECRET_RANDOM_BYTES = 32;
export const CONNECTION_SECRET_PATTERN = /^zb_conn_[A-Za-z0-9_-]{43}$/;
export const OWNER_MESSAGES_PER_MINUTE = 20;
export const OUTBOUND_MESSAGES_PER_MINUTE = 30;
export const ACCOUNT_OUTBOUND_MESSAGES_PER_MINUTE = 120;
export const RATE_LIMIT_PERIOD_MS = MINUTE_MS;
export const NEW_ACCOUNTS_PER_DAY_LIMIT = 50;
export const NEW_ACCOUNTS_WINDOW_MS = DAY_MS;
export const DELETION_CONFIRM_TTL_MS = 10 * MINUTE_MS;
export const PART_LABEL_BUDGET_CHARS = 16;
export const ACCOUNT_MEDIA_PREFIX = 'accounts/';
export const COMMAND_LIST_ID_PREFIX = 'zapbip:';
export const LIST_BUTTON_TEXT_MAX_CHARS = 20;
export const WAITLIST_FLAG_VALUES = { enabled: 'true', disabled: 'false' } as const;
export const BRAZIL_COUNTRY_CODE = '55';
```

`WHATSAPP_TEXT_MAX_CHARS`, `LIST_ROW_TITLE_MAX_CHARS` and `AGENT_NAME_PATTERN` / `AGENT_NAME_MAX_CHARS` are slice 1's. `ACCOUNT_MEDIA_PREFIX` is `accounts/`; the full prefix is `ACCOUNT_MEDIA_PREFIX + accountId + '/'`.

### `libs/core/src/accounts/command-words.ts` (data, written in full)

```ts
import { OwnerLocale } from '@zapbip/types';
import { CommandKind } from '../enums';

export type CommandWord = {
  kind: CommandKind;
  locale: OwnerLocale;
  words: string;
  takesName: boolean;
};

export const COMMAND_WORDS: readonly CommandWord[] = [
  { kind: CommandKind.CreateAgent, locale: OwnerLocale.PortugueseBrazil, words: 'novo agente', takesName: true },
  { kind: CommandKind.CreateAgent, locale: OwnerLocale.EnglishUs, words: 'new agent', takesName: true },
  { kind: CommandKind.ListAgents, locale: OwnerLocale.PortugueseBrazil, words: 'agentes', takesName: false },
  { kind: CommandKind.ListAgents, locale: OwnerLocale.EnglishUs, words: 'agents', takesName: false },
  { kind: CommandKind.RevokeAgent, locale: OwnerLocale.PortugueseBrazil, words: 'revogar', takesName: true },
  { kind: CommandKind.RevokeAgent, locale: OwnerLocale.EnglishUs, words: 'revoke', takesName: true },
  { kind: CommandKind.RotateAgent, locale: OwnerLocale.PortugueseBrazil, words: 'girar', takesName: true },
  { kind: CommandKind.RotateAgent, locale: OwnerLocale.EnglishUs, words: 'rotate', takesName: true },
  { kind: CommandKind.Help, locale: OwnerLocale.PortugueseBrazil, words: 'ajuda', takesName: false },
  { kind: CommandKind.Help, locale: OwnerLocale.PortugueseBrazil, words: 'menu', takesName: false },
  { kind: CommandKind.Help, locale: OwnerLocale.EnglishUs, words: 'help', takesName: false },
  { kind: CommandKind.Help, locale: OwnerLocale.EnglishUs, words: 'menu', takesName: false },
  { kind: CommandKind.RequestDeletion, locale: OwnerLocale.PortugueseBrazil, words: 'apagar conta', takesName: false },
  { kind: CommandKind.RequestDeletion, locale: OwnerLocale.EnglishUs, words: 'delete account', takesName: false },
  { kind: CommandKind.ConfirmDeletion, locale: OwnerLocale.PortugueseBrazil, words: 'apagar conta definitivamente', takesName: false },
  { kind: CommandKind.ConfirmDeletion, locale: OwnerLocale.EnglishUs, words: 'delete account permanently', takesName: false },
];

export const MENU_COMMAND_KINDS: readonly CommandKind[] = [
  CommandKind.CreateAgent,
  CommandKind.ListAgents,
  CommandKind.RevokeAgent,
  CommandKind.RotateAgent,
  CommandKind.Help,
  CommandKind.RequestDeletion,
];
```

`OwnerLocale` is `libs/types` (A25): `PortugueseBrazil` with value `pt_BR`, `EnglishUs` with value `en_US`.

### `libs/core/src/accounts/account-types.ts`

```ts
import type { OwnerLocale } from '@zapbip/types';
import type { AgentName, ConnectionIdentity } from '../connection';
import type { AccountReplyIntent, AccountReplyParameter, AccountState, AccountStateOutcome, CommandKind, ReplyKind } from '../enums';

export type AccountRecord = {
  accountId: string;
  waId: string;
  state: AccountState;
  locale: OwnerLocale;
};

export type AccountLookup = { account: AccountRecord; created: boolean };

export type ConnectionRecord = {
  connectionId: string;
  accountId: string;
  agent: AgentName;
  secretDigest: string;
  createdAt: number;
};

export type OwnerAccountContext = {
  accountId: string;
  waId: string;
  state: AccountState;
  locale: OwnerLocale;
};

export type AccountCommand = {
  kind: CommandKind;
  rawName: string | null;
  locale: OwnerLocale;
};

export type MenuRow = { id: string; title: string };

export type AccountReply = {
  intent: AccountReplyIntent;
  kind: ReplyKind;
  locale: OwnerLocale;
  parameters: Partial<Record<AccountReplyParameter, string>>;
  menuRows: MenuRow[];
};

export type AccountCompensation = {
  connectionId: string;
  agent: AgentName;
  oldDigest: string | null;
  newDigest: string;
};

export type AccountCommandResult = {
  replies: AccountReply[];
  compensation: AccountCompensation | null;
  deletionConfirmed: boolean;
};

export type IssuedSecret = { secret: string; digest: string };

export type CommandInput = {
  text: string | null;
  listReplyId: string | null;
  isQuoting: boolean;
};

export type AccountStateVerdict = {
  outcome: AccountStateOutcome;
  intent: AccountReplyIntent | null;
};
```

### `libs/core/src/ports.ts` (new members and changes)

```ts
import type { OwnerLocale } from '@zapbip/types';
import type { AccountLookup, AccountRecord, ConnectionRecord, IssuedSecret } from './accounts/account-types';
import type { AccountState, RegisterOutcome, SenderVerdict } from './enums';

export interface AccountDirectory {
  findByWaId(input: { waId: string }): Promise<AccountRecord | null>;
  findOrCreateByWaId(input: {
    waId: string;
    accountId: string;
    initialState: AccountState;
    locale: OwnerLocale;
    createdAt: number;
    newAccountsCap: { since: number; limit: number };
  }): Promise<AccountLookup | null>;
  setState(input: { accountId: string; state: AccountState }): Promise<void>;
  listByState(input: { state: AccountState }): Promise<AccountRecord[]>;
  remove(input: { accountId: string }): Promise<void>;
}

export interface ConnectionDirectory {
  resolveSecretDigest(input: { secretDigest: string }): Promise<ConnectionIdentity | null>;
  register(input: { connection: ConnectionRecord; activeLimit: number }): Promise<RegisterOutcome>;
  findActiveByAgent(input: { accountId: string; agent: AgentName }): Promise<ConnectionRecord | null>;
  listActive(input: { accountId: string }): Promise<ConnectionRecord[]>;
  revoke(input: { accountId: string; agent: AgentName; revokedAt: number }): Promise<boolean>;
  rotate(input: {
    accountId: string;
    agent: AgentName;
    fromDigest: string;
    toDigest: string;
    rotatedAt: number;
  }): Promise<boolean>;
}

export interface Digests {
  secretDigest(input: { secret: string }): Promise<string>;
}

export interface ConnectionSecrets {
  issue(): Promise<IssuedSecret>;
}

export interface RandomSource {
  bytes(input: { length: number }): Uint8Array;
}

export interface InstallPromptRenderer {
  render(input: {
    accountId: string;
    agent: AgentName;
    connectionLink: string;
    locale: OwnerLocale;
  }): Promise<string>;
}

export interface SenderGuard {
  admit(input: { waId: string }): Promise<SenderVerdict>;
}

export interface OutboundGuard {
  admit(input: { accountId: string; connectionId: string }): Promise<SenderVerdict>;
}

export interface ConnectionRevocations {
  recordRevocation(input: { accountId: string; agent: AgentName }): Promise<void>;
  cancelWaiters(input: { accountId: string; agent: AgentName }): Promise<void>;
}

export interface AccountInboxPurge {
  purge(): Promise<void>;
}

export interface MediaStore {
  put(input: { mediaId: string; body: MediaBody; mimeType: string }): Promise<void>;
  get(input: { mediaId: string }): Promise<MediaObject | null>;
  signedLink(input: { mediaId: string; purpose: LinkPurpose; ttlMs: number }): Promise<string>;
  delete(input: { mediaIds: string[] }): Promise<void>;
  deletePrefix(input: { prefix: string }): Promise<void>;
}

export interface ReplyWaiters {
  cancelAgent(input: { agent: AgentName }): void;
}

export type CoreDependencies = {
  repository: InboxRepository;
  sender: MessageSender;
  mediaStore: MediaStore;
  waker: AgentWaker;
  clock: Clock;
  ids: IdGenerator;
  waiters: ReplyWaiters;
  accounts: AccountDirectory;
  connections: ConnectionDirectory;
  digests: Digests;
  connectionSecrets: ConnectionSecrets;
  installPromptRenderer: InstallPromptRenderer;
  revocations: ConnectionRevocations;
};
```

`ReplyWaiters` is slice 1's; `cancelAgent` is the only new member. `MediaStore.deletePrefix` is the only new `MediaStore` member. The R2 key is `accounts/<accountId>/media/<mediaId>` (cross-slice), so the adapter is built per account with `accountId`. `setLocale` is not in the port (A18). `AccountInboxPurge` and `ConnectionRevocations` are implemented by the Durable Object and passed explicitly.

### `libs/core/src/accounts/*` (signatures)

```ts
export function parseAccountCommand(input: CommandInput): AccountCommand | null;             // command.ts (L1a)
export function normalizeAgentName(input: { rawName: string }): string | null;                // agent-name.ts (L1a)
export function isReservedAgentName(input: { name: string }): boolean;                        // agent-name.ts (L1a)
export function splitInstallPrompt(input: { prompt: string }): string[];                      // install-prompt-parts.ts (L1a), A23
export function renderAccountReply(input: { reply: AccountReply }): string;                   // account-copy.ts (L1a)
export function buildMenuRows(input: { locale: OwnerLocale }): MenuRow[];                     // account-copy.ts (L1a)
export function evaluateAccountState(input: {
  state: AccountState;
  command: AccountCommand | null;
  isFirstMessage: boolean;
  isText: boolean;
}): AccountStateVerdict;                                                                      // state-gate.ts (L1b)
```

### `libs/core/src/use-cases/types.ts` (additions)

```ts
export type OwnerAccountInput = {
  dependencies: CoreDependencies;
  account: OwnerAccountContext;
  publicOrigin: string;
};
export type ApplyOwnerCommandInput = OwnerAccountInput & { command: AccountCommand };
export type CreateAgentConnectionInput = OwnerAccountInput & { rawName: string };
export type RevokeAgentConnectionInput = OwnerAccountInput & { rawName: string };
export type RotateAgentConnectionInput = OwnerAccountInput & { rawName: string };
export type ListAgentConnectionsInput = OwnerAccountInput;
export type RequestAccountDeletionInput = OwnerAccountInput & { requestedAt: number };
export type ConfirmAccountDeletionInput = OwnerAccountInput & { requestedAt: number | null; now: number };
export type OpenOwnerAccountInput = {
  dependencies: CoreDependencies;
  waId: string;
  waitlistEnabled: boolean;
  createdAt: number;
};
export type FinishAccountDeletionInput = {
  dependencies: CoreDependencies;
  accountId: string;
  inboxPurge: AccountInboxPurge;
};
export type ReceiveOwnerMessageInput = {
  dependencies: CoreDependencies;
  ownerMessage: OwnerInboundMessage;
  account: OwnerAccountContext;
  isFirstMessage: boolean;
  publicOrigin: string;
};
export type ReceiveResult = {
  messageId: string | null;
  agent: AgentName | null;
  deletionConfirmed: boolean;
};
```

`requestedAt` in `ConfirmAccountDeletionInput` is read from the account object's storage by the caller; `null` means no pending request (reply `DeletionExpired`).

### `libs/core/src/use-cases/*.ts` (signatures; stubs for new members only)

```ts
export function openOwnerAccount(input: OpenOwnerAccountInput): Promise<OwnerAccountContext | null>; // null: daily cap (A7 of slice 1 is not reused)
export function applyOwnerCommand(input: ApplyOwnerCommandInput): Promise<AccountCommandResult>;
export function createAgentConnection(input: CreateAgentConnectionInput): Promise<AccountCommandResult>;
export function listAgentConnections(input: ListAgentConnectionsInput): Promise<AccountCommandResult>;
export function revokeAgentConnection(input: RevokeAgentConnectionInput): Promise<AccountCommandResult>;
export function rotateAgentConnection(input: RotateAgentConnectionInput): Promise<AccountCommandResult>;
export function requestAccountDeletion(input: RequestAccountDeletionInput): Promise<AccountCommandResult>;
export function confirmAccountDeletion(input: ConfirmAccountDeletionInput): Promise<AccountCommandResult>;
export function finishAccountDeletion(input: FinishAccountDeletionInput): Promise<void>;
export function finishDeletingAccounts(input: { dependencies: CoreDependencies; inboxPurgeFor: (input: { accountId: string }) => AccountInboxPurge }): Promise<void>;
export function resumeSuspendedAccount(input: { dependencies: CoreDependencies; accountId: string }): Promise<boolean>;
export function receiveOwnerMessage(input: ReceiveOwnerMessageInput): Promise<ReceiveResult>; // slice 1 file, body changed
```

`receiveOwnerMessage` returns `messageId` `null` for a command or a state drop; the rule 1 to 6 results are unchanged.

### `apps/api/src/contract/env.ts` (additions)

```ts
export type Bindings = {
  WAITLIST_ENABLED: string;
  PUBLIC_ORIGIN: string;
  OWNER_RATE_LIMITER: RateLimit;
  OUTBOUND_RATE_LIMITER: RateLimit;
  ACCOUNT_OUTBOUND_RATE_LIMITER: RateLimit;
};
```

`RateLimit` is from `@cloudflare/workers-types` (slice 1).

### `apps/api/src/contract/account-inbox-rpc.ts` (changes)

```ts
receiveOwnerMessage(input: {
  ownerMessage: OwnerInboundMessage;
  ownerWaId: string;
  state: AccountState;
  channelMessageId: string;
  publicOrigin: string;
}): Promise<CallOutcome<ReceiveResult>>;
requestDeletion(input: {}): Promise<void>;   // stores deletion_requested_at
recordRevocation(input: { agent: AgentName }): Promise<void>;   // revoke only: wake state, waiters, revoked flag
cancelWaiters(input: { agent: AgentName }): Promise<void>;      // rotate: waiters only, wake setting kept
purge(): Promise<void>;
setState(input: { state: AccountState }): Promise<void>;   // resume-suspended only
```

`setState` is not used for `deleting` (the Worker finishes deletion). `purge` leaves a tombstone key.

### `apps/api/src/logging/log-event.ts` (new, stub)

```ts
export enum LogEvent {
  AccountCreated = 'account.created',
  AccountStateChanged = 'account.state_changed',
  CommandReceived = 'command.received',
  ConnectionCreated = 'connection.created',
  ConnectionRevoked = 'connection.revoked',
  ConnectionRotated = 'connection.rotated',
  ConnectionCompensated = 'connection.compensated',
  SenderBlocked = 'sender.blocked',
  SenderRateLimited = 'sender.rate_limited',
  AccountDailyCap = 'account.daily_cap',
  AccountDeleted = 'account.deleted',
  ConnectionAuthFailed = 'connection.auth_failed',
}

export type LogFields = Partial<{
  accountId: string;
  connectionId: string;
  kind: string;
  locale: string;
  count: number;
  route: string;
}>;

export function logEvent(input: { event: LogEvent; fields: LogFields }): void;
```

### `apps/api/wrangler.jsonc` (changes, every environment repeats the bindings)

- `vars.WAITLIST_ENABLED`: `"true"` in `env.production`; `"false"` in `env.staging` and the top-level development block.
- `vars.PUBLIC_ORIGIN`: per environment.
- `ratelimits`: `OWNER_RATE_LIMITER` `{limit: 20, period: 60}`; `OUTBOUND_RATE_LIMITER` `{limit: 30, period: 60}`; `ACCOUNT_OUTBOUND_RATE_LIMITER` `{limit: 120, period: 60}`.

### `apps/api/src/adapters/d1/schema.ts` (new)

Drizzle `sqliteTable` for `accounts`, `owner_identities`, `connections`, `blocked_phones` matching `0002` column for column. The schema for `message_index` is slice 1's and is read here, not redefined.

## Dependencies

No new package. `libs/types` supplies `OwnerLocale`, `SECOND_MS`, `MINUTE_MS`, `DAY_MS` (slice 1 and slice 2, A25). `libs/core` has a type-only import of `@zapbip/types` (ADR 0008).

## File map (lanes)

Every path has one owner. A lane that needs a sibling's path stops and asks the lead, or notes the gap in its tester briefing text.

| Lane | Developer | Owned paths |
|---|---|---|
| L0 Contract (serial, after S0.0) | `developer-0` | `libs/core/src/{enums,constants,ports,index}.ts` (additions), `libs/core/src/accounts/{command-words,account-types,command,agent-name,install-prompt-parts,account-copy,state-gate}.ts` (data and stubs of new members), `libs/core/src/use-cases/{types,open-owner-account,apply-owner-command,create-agent-connection,list-agent-connections,revoke-agent-connection,rotate-agent-connection,request-account-deletion,confirm-account-deletion,finish-account-deletion,finish-deleting-accounts,resume-suspended-account}.ts` (stubs), `libs/core/src/use-cases/receive-owner-message.ts` (type change only), `apps/api/migrations/0002_accounts_and_keys.sql`, `apps/api/src/adapters/d1/schema.ts`, `apps/api/src/contract/{env,account-inbox-rpc}.ts`, `apps/api/src/logging/log-event.ts` (stub), `apps/api/wrangler.jsonc` |
| L1a Grammar and copy (core, pure) | `developer-1a` | bodies of `libs/core/src/accounts/{command,agent-name,install-prompt-parts,account-copy}.ts`; tests of the same four names |
| L1b Rules and use cases (core) | `developer-1b` | bodies of `libs/core/src/accounts/state-gate.ts` and the use-case files in L0's list, `receive-owner-message.ts`; their tests; `libs/core/src/testing/in-memory.ts` (extended) |
| L2 Storage, guards and secrets (apps/api) | `developer-2` | `apps/api/src/adapters/d1/d1-account-directory.ts` (extends the file whatsapp-cloud-channel creates), `apps/api/src/adapters/d1-connection-directory.ts` (slice 1 file, body changed), `apps/api/src/adapters/{sender-guard,outbound-guard,connection-secrets,random-source,generic-install-prompt}.ts`, `apps/api/src/adapters/r2-media-store.ts` (`deletePrefix`, per-account key), `apps/api/scripts/operator-account.sh` (new, A24), `apps/api/package.json` (removes `dev:seed`), `apps/api/scripts/create-dev-connection.ts` and `apps/api/test/unit/connection-secret.test.ts` (deleted), `apps/api/test/unit/{connection-secrets,generic-install-prompt,wrangler-limits,operator-script}.test.ts`, `apps/api/test/integration/{d1-accounts,d1-connections-lifecycle,sender-guard,r2-delete-prefix,migration-0002}.test.ts`, `apps/api/test/support/seed.ts` |
| L3 Durable Object, wiring, sweep (apps/api) | `developer-3` | `apps/api/src/account-inbox/**` (the RPC body, purge with tombstone, `requestDeletion`, `recordRevocation`, `setState`, dependency wiring from env and storage), `apps/api/src/scheduled.ts` (the daily sweep call; created by deploy-readiness if absent, `(contract: confirm at build)`), `apps/api/test/support/factories.ts` (test factories for accounts, connections and inbox state), `apps/api/test/integration/{account-inbox,account-inbox-purge,scheduled-sweep}.test.ts` |
| L4 Inbound path, routes, simulator, E2E (apps/api) | `developer-4` | `apps/api/src/inbound/owner-inbound.ts` (new orchestrator), `apps/api/src/config/waitlist-enabled.ts` (new), `apps/api/src/routes/webhook.ts` (slice 2 file; one change: call the orchestrator), `apps/api/src/routes/mcp.ts` (slice 1 file; digest resolution, account-state 401, log template), `apps/api/src/mcp/**` (outbound check and `rate_limited` tool error only), `apps/api/src/dev/**` (simulator phone-keyed on the production inbound path), `apps/api/src/logging/log-event.ts` (body), `apps/api/test/integration/{owner-inbound,simulator-accounts,mcp-account-states,mcp-outbound,logs-redaction,waitlist-enabled}.test.ts`, `apps/api/test/e2e/accounts.e2e.test.ts` |
| L5 Docs | `developer-5` | `apps/docs/guides/{commands,agents-and-links,account-deletion}.mdx` |

Ownership notes:

- `apps/docs/docs.json` is not in any lane. The lead adds the three guide pages to the navigation after L5 merges (decision 13 gives the lead the indexes; the navigation is an index).
- `apps/api/src/index.ts`, `index.dev.ts` and `app.ts` are not changed by this slice.
- `libs/core/src/testing/in-memory.ts` belongs to L1b only.
- `apps/api/src/account-inbox/**` belongs to L3 (decision 8). L2 never edits it.

## Sequencing and merge order

1. **S0.0 Plan refresh**, serial, before anything else (see step below).
2. **Step 0 (L0), serial.**
3. **Parallel after Step 0:** L1a, L1b (red only), L2 (red only), L3 (red only), L5.
4. **Green dependencies:** L1b green needs L1a. L2 green needs L1b (lifecycle integration) and whatsapp-cloud-channel's `d1-account-directory.ts` on the branch. L3 green needs L1b and L2. L4 needs L2 and L3.
5. **Merge order into `feat/accounts-and-keys`:** L0 → L1a → L1b → L2 → L3 → L5 → L4.
6. **Lead merges after each lane:** `pnpm typecheck`, `pnpm test:unit`, the integration and `pnpm verify` green before the next merge.
7. **Main moves:** developers merge `main` at a task boundary, never mid-step. Lanes never rebase.

## Steps

Every box is empty when authored. A sub-agent ticks its own box. A wrong step is struck through with the reason.

### Step S0.0 (lead, serial): plan refresh against main

- [ ] **S0.0 Plan refresh.** Diff this plan against `main` and the merged `agent-inbox-core` and `whatsapp-cloud-channel`: paths (`apps/api/src/adapters/`, `account-inbox/`, `routes/`), names (`resolveSecretDigest`, `PUBLIC_ORIGIN`, `OwnerLocale`, `message_index`), exports in `libs/core` and `libs/types`, migration numbers (`0001_core`, `0004` from whatsapp, `0002` ours), the existence of `scheduled.ts`, the `d1-account-directory.ts` file, and the `ReplyWaiters` interface. Correct the plan and mark each `(contract: confirm at build)` item settled or changed. No lane starts before this step is recorded. On `main` today there is no product code, so this step runs after the slice 1 merge.

### Step 0 (L0): contract

- [ ] **S0.1 Core contract.** Append the enums, constants, `command-words.ts`, `account-types.ts`, the `ports.ts` changes, the `use-cases/types.ts` additions, the stubs for new members, and the `index.ts` exports. Stub bodies are `void input;` and `throw new Error('<name> is not implemented');`. Run `pnpm typecheck`. Commit as `feat(core): add the accounts and keys contract`.
- [ ] **S0.2 Storage contract.** Write `apps/api/migrations/0002_accounts_and_keys.sql` from the spec's **Data model**, with the drop lines first and a header comment-free note in the commit message: `(contract: confirm at build)` against `0001_core`. Write `apps/api/src/adapters/d1/schema.ts`. Run `pnpm --filter @zapbip/api exec drizzle-kit check`. Commit as `feat(api): add the accounts and keys schema`.
- [ ] **S0.3 Worker contract.** Write the `env.ts` and `account-inbox-rpc.ts` changes, the `log-event.ts` stub, and the `wrangler.jsonc` changes in every environment (`ratelimits` and `vars`). Do not write ADRs or docs: the lead owns them. Run `pnpm typecheck`. Commit as `feat(api): add the accounts and keys worker contract`.
- [ ] **S0.4 Gate.** `pnpm typecheck` and `pnpm verify` green on the Step 0 tree.

Failure modes for Step 0 are in the table below. Step 0 has no backout: a broken contract is fixed forward in a new Step 0 commit that every lane merges.

### Step L1a (grammar and copy)

- [ ] **S1a.1 red: grammar, names, copy, prompt parts.** Write the four test files of the test plan's **Core unit: grammar** area. Run `pnpm --filter @zapbip/core test:unit`. Expected: each case fails with `<name> is not implemented`, except the labelled `pin` cases. Commit as `test(core): pin the account command grammar and copy`.
- [ ] **S1a.2 green: grammar, names, copy, prompt parts.** Implement `command.ts` (`parseAccountCommand`: trim, collapse inner whitespace, lowercase; exact match against `COMMAND_WORDS`; the name is the text after the words when `takesName`; list ids map through `COMMAND_LIST_ID_PREFIX` to one of the six menu kinds, else `Unknown`, A12; a quoting message returns `null`; `revogar` or `girar` alone return an empty `rawName`), `agent-name.ts` (A4), `install-prompt-parts.ts` (A23: line-based, label budget, a link line never splits, empty input throws), `account-copy.ts` (`renderAccountReply`, `buildMenuRows` from `MENU_COMMAND_KINDS`, every intent in both locales, WhatsApp limits from the test plan). Commit as `feat(core): parse account commands and render their replies`.

### Step L1b (state gate, rule 0, use cases)

- [ ] **S1b.1 red: state gate, rule 0, receive.** Write `state-gate.test.ts`, `apply-owner-command.test.ts`, and the rule 0 cases of `receive-owner-message.test.ts`: the matrix of A20, the six menu ids, `zapbip:confirm_deletion` to `Unknown`, quoted command words to the quoted agent, rule 5 unchanged, and the compensation cases of A21 with a failure on part 2 of 3 (the test plan's **Compensation** cases). Expected: `evaluateAccountState is not implemented`, `applyOwnerCommand is not implemented`, `receiveOwnerMessage` compensation case fails on its assertion. Commit as `test(core): pin the state gate, rule 0 and compensation`.
- [ ] **S1b.2 red: lifecycle, deletion, revocation.** Write the use-case test files for create, list, revoke, rotate, request and confirm deletion, finish deletion, the deleting sweep, resume, and open. Include the revocation cases (A22: revoke calls `recordRevocation` and not `cancelWaiters`; rotate calls `cancelWaiters` and not `recordRevocation`, and the wake setting is unchanged), the `message_index` first-delete case, and the TTL cases (A19). The red commit adds the in-memory extension as a stub: `createInMemoryDependencies is not implemented`. Commit as `test(core): pin the connection lifecycle, deletion and revocation`.
- [ ] **S1b.3 green: state gate, rule 0, receive, compensation.** Implement `state-gate.ts`, `apply-owner-command.ts` (dispatch record keyed by `CommandKind`), `receive-owner-message.ts` (order: flush queue and window; state gate; rule 0; rules 1 to 6; sends each reply part in order; on failure runs `compensation` and sends `SendFailed` best-effort, A21; `deletionConfirmed` after the confirmation reply). Commit as `feat(core): gate account states, apply commands and compensate failed sends`.
- [ ] **S1b.4 green: lifecycle, deletion, revocation, resume.** Implement `open-owner-account.ts` (waitlist flag; `null` at the cap), `create-agent-connection.ts`, `list-agent-connections.ts`, `revoke-agent-connection.ts` (calls `revocations.recordRevocation`) and `rotate-agent-connection.ts` (calls `revocations.cancelWaiters` only), `request-account-deletion.ts` (A19), `confirm-account-deletion.ts` (TTL check), `finish-account-deletion.ts` (A7 steps; the D1 batch order is `message_index`, `owner_identities`, `connections`, `accounts`), `finish-deleting-accounts.ts` (lists `deleting` accounts; finishes each), `resume-suspended-account.ts` (A7), and the in-memory adapters. Commit as `feat(core): create, revoke, rotate and delete accounts`.

### Step L2 (storage, guards, secrets, operator script)

- [ ] **S2.1 red: D1 and migration, with adapter stubs.** The red commit adds the new adapter members as stubs (`D1AccountDirectory.findOrCreateByWaId`, `listByState`, `remove`; `D1ConnectionDirectory.resolveSecretDigest`, `register`, `rotate`; `R2MediaStore.deletePrefix`; `ConnectionSecrets.issue`). Then write `migration-0002.test.ts`, `d1-accounts.test.ts`, `d1-connections-lifecycle.test.ts` (including the `message_index` case and the pattern-before-D1 case). Add `apps/api/test/support/seed.ts` helpers `seedAccount` and `seedConnection({accountId, agent, secretDigest})`. Expected: each case fails with `<method> is not implemented`, the migration case on its assertion. Commit as `test(api): pin the accounts and keys D1 rules`.
- [ ] **S2.2 red: secrets, guards, prompt, operator script.** Write `connection-secrets.test.ts`, `generic-install-prompt.test.ts`, `wrangler-limits.test.ts`, `operator-script.test.ts`, `sender-guard.test.ts`, `r2-delete-prefix.test.ts`. Commit as `test(api): pin the secrets, guards and operator script`.
- [ ] **S2.3 green: adapters and script.** Implement `d1-account-directory.ts` (A13 batch; `remove` as one batch in the A7 order), `d1-connection-directory.ts` (A3 order), `sender-guard.ts` (blocklist read, then the binding), `outbound-guard.ts` (both the connection and the account binding, A16), `connection-secrets.ts`, `random-source.ts`, `generic-install-prompt.ts` (async, A9 shape), `r2-media-store.ts` (`deletePrefix` pages of 1 000, key `accounts/<accountId>/media/<mediaId>`), and `operator-account.sh` (A24). Delete `create-dev-connection.ts`, its test and the `dev:seed` script. Commit as `feat(api): add the account directories, guards, secrets and operator script` and, separately, `chore(api): remove the development connection script`.

### Step L3 (Durable Object, wiring, sweep)

- [ ] **S3.1 red: Durable Object and sweep.** Write `account-inbox.test.ts`, `account-inbox-purge.test.ts` and `scheduled-sweep.test.ts` (test plan **Durable Object** area). Add `apps/api/test/support/factories.ts` (the factories the other lanes import). Expected: `not implemented`. Commit as `test(api): pin the account object, tombstone and sweep`.
- [ ] **S3.2 green: Durable Object and sweep.** Implement the `account-inbox.ts` RPC body (the `receiveOwnerMessage` input of the contract; the `requestDeletion` storage of `deletion_requested_at`; the `first_message_id` check and write in the same transaction as the reply (A10); `recordRevocation` (wake state, waiters, revoked flag), `cancelWaiters` (waiters only), `setState` for suspended to active only), `purge()` (clear storage, delete alarm, write the tombstone key; later writes throw `AccountTombstoned`; purge is idempotent), dependency wiring from env and the object's own id as the account id, and the daily sweep call in `scheduled.ts`. Commit as `feat(api): add the account object, tombstone and daily sweep`.

### Step L5 (docs)

- [ ] **S5.1 red.** The lead adds the three guide pages to the navigation after L5's red commit; here L5 writes the pages' skeletons only with links to the three names, so `mint broken-links` fails on the missing pages. Commit as `test(docs): link the account guides before their pages exist`.
- [ ] **S5.2 green.** Write the three pages: `commands` (the command table in both languages, reserved words, limit, menu), `agents-and-links` (create, list, revoke, rotate, the password warning, what WhatsApp previews show, the eight-agent limit), `account-deletion` (the phrase, the 10-minute window, consequences, Meta keeps history, Cloudflare retention, a new account after deletion). `mint broken-links` green. Commit as `docs(api): write the account guides`.

### Step L4 (inbound path, routes, simulator, E2E)

- [ ] **S4.1 red: inbound, simulator, routes, outbound, logs.** Write `owner-inbound.test.ts`, `simulator-accounts.test.ts`, `mcp-account-states.test.ts`, `mcp-outbound.test.ts` (per-connection and per-account), `logs-redaction.test.ts`, `waitlist-enabled.test.ts`. Expected: `not implemented` or a non-expected status. Commit as `test(api): pin the inbound path, simulator and account states`.
- [ ] **S4.2 green: inbound, simulator, routes.** Implement `config/waitlist-enabled.ts` (called per request from the Worker's fetch path, A6), `inbound/owner-inbound.ts` (sender guard; `openOwnerAccount`; `deleting` runs `finishAccountDeletion`; the object call; `deletionConfirmed` runs `finishAccountDeletion`), the one-line change in `routes/webhook.ts`, `routes/mcp.ts` (A3 order), the outbound check (A16), the simulator on the inbound path, and the `logEvent` body. Commit as `feat(api): route owner messages through the account gates`.
- [ ] **S4.3 red then green: E2E.** `accounts.e2e.test.ts` (`ZAPBIP_E2E=1`, `wrangler dev` on the development entry): both locales, create, MCP call, rotate, revoke, deletion. Red commit first (fails at the first create), green after every lane. Commit red and green separately.

Failure modes: see table.

### Step Z (prove and ship)

- [ ] **Z.1 Tester briefing text.** Each lane returns its section to the lead for `tester-briefing.md`, with each red run's printed failure text.
- [ ] **Z.2 Tester run.** A fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence, area by area in parallel.
- [ ] **Z.3 Reviewer.** A fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`.
- [ ] **Z.4 Security reviewer.** A fresh `security-reviewer`; the **Security checks** area is its checklist.
- [ ] **Z.5 /check-ui.** Docs pages walked with Playwright MCP at 1 280 and 375 wide through `mint dev`; the simulator's JSON screens recorded.
- [ ] **Z.6 /open-pr.** Gates passed, learnings sweep stated, PR opened with a Blast radius and a Human checklist (tier 🔴).

## Rollback

- Before the first deploy: revert the branch. Migration `0002` is unapplied, so no data exists to restore.
- After the first deploy: migrations are immutable. Roll the Worker back with `wrangler rollback` to the previous version; `0002` stays applied, and the previous version reads the same tables (the previous version of this slice does not exist, so the rollback target is slice 2's version, which reads `owner_identities` and `accounts` only and ignores the new columns).
- Kill switch for new accounts: set `WAITLIST_ENABLED` to `'true'` in `env.production` and redeploy. Existing active accounts keep working.
- Abusive phone: `operator-account.sh block <wa_id>` then `suspend <wa_id>`. Both are reversible (`unblock`, `resume`).
- A deletion that went wrong cannot be reversed: the owner is told so in `apagar conta`. The daily sweep finishes any interrupted deletion.

## Owner-run (outside the gate)

Needs a real number or a deployed environment; none runs in `pnpm verify`.

- [ ] Send `novo agente <nome>` from the owner's phone to the staging number; expect the install prompt in parts; paste the link into one client and see its first `initialize`.
- [ ] Send `girar <nome>`; confirm the old link returns `401` through the client.
- [ ] `apagar conta`, then `apagar conta definitivamente` within 10 minutes, from a test phone on staging; confirm `operator-account.sh` finds no rows for that `wa_id` except the blocklist.
- [ ] Run each operator command once against a test phone on staging: `enable`, `suspend`, `resume`, `block`, `unblock`, `delete`.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| S0.0 | Slice 1 or 2 renamed a path or name this plan uses | The diff in S0.0 lists a mismatch | Correct the plan before any lane starts |
| S0.1 | An enum, port or constant differs from the spec | `pnpm typecheck` fails in a lane | Fix forward in a new Step 0 commit |
| S0.2 | `0002` does not match the Drizzle schema, or `0001_core` names differ | `drizzle-kit check` drift, or `migration-0002` fails | Fix the schema file before merge (the migration is unapplied) |
| S1a.2 | A command word matches with trailing `?` or `.` | `command.test.ts` `agentes?` returns a command | Tighten the exact match |
| S1a.2 | A reserved first word is accepted as a name | `agent-name.test.ts` reserved case | Compare the normalised name with the reserved words |
| S1a.2 | A prompt part splits inside the link line | `install-prompt-parts.test.ts` link-line case | Split on lines only; throw for an over-budget link |
| S1b.3 | Rule 0 consumes a quoted command word | `receive-owner-message.test.ts` quoted case routes to no agent | Check `isQuoting` before parsing |
| S1b.3 | A failed part 2 of 3 leaves the new link valid | `receive-owner-message.test.ts` compensation case: `resolveSecretDigest` of the new digest is not `null` | Run `compensation` before the `SendFailed` reply; the test pins it |
| S1b.4 | Rotate overwrites a digest changed by a second rotation | `rotate-agent-connection.test.ts` lost-race case | Compare-and-set on `fromDigest` |
| S1b.4 | Rotate clears the wake setting, or calls `recordRevocation` | `rotate-agent-connection.test.ts` revocation-routing case: the fake `revocations` records `recordRevocation` or the wake setting is absent after rotate | Rotate calls `cancelWaiters` only |
| S1b.4 | Deletion removes `owner_identities` before `message_index` and a retry cannot find the wamids | `finish-account-deletion.test.ts` order case | Delete `message_index` first in the batch |
| S1b.4 | `confirmAccountDeletion` accepts a stale request | `confirm-account-deletion.test.ts` 10-minute and 10-minute-plus-1 ms cases | Compare `now - requestedAt` with `DELETION_CONFIRM_TTL_MS` |
| S2.3 | Two first messages create two accounts | `d1-accounts.test.ts` concurrency case reports two rows | The A13 batch order |
| S2.3 | Twenty concurrent creates exceed the limit | `d1-connections-lifecycle.test.ts` concurrency case returns more than 8 rows | The conditional `register` statement holds the limit |
| S2.3 | The operator script runs SQL with a non-digit `wa_id` | `operator-script.test.ts` injection cases | Validate `^[0-9]{8,15}$` before building the command |
| S2.3 | `deletePrefix` stops after one page | `r2-delete-prefix.test.ts` 2 500-key case | Loop until a listing is empty |
| S3.2 | A tombstoned object accepts a write | `account-inbox-purge.test.ts` write-after-purge case | Guard every write method with the tombstone check |
| S3.2 | The sweep finishes an account that is only `suspended` | `scheduled-sweep.test.ts` suspended case | Sweep selects `deleting` only |
| S4.2 | The webhook answers `200` before the orchestrator commits | `owner-inbound.test.ts` durability case | Await the orchestrator before responding |
| S4.2 | A `deleting` account gets a reply | `owner-inbound.test.ts` deleting case | Return before the object call for `deleting` |
| S4.2 | Logs carry a phone or agent name | `logs-redaction.test.ts` | Remove the field from `LogFields` and the call site |
| L5 | A guide link breaks | `mint broken-links` fails | Fix the link; the docs gate is the check |

**Steps with no backout:** S0.2 once merged to `main` (`0002` is forward-only after the first deploy); S1b.4 `finish-account-deletion` in production (the LGPD deletion is irreversible by design; the test plan covers it before merge).

## Z. Prove and ship

- [ ] **Tester briefing text** returned by each lane to the lead.
- [ ] **Tester run:** a fresh `tester` executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** verdict recorded; refutation of the three riskiest claims in `test-plan.md`.
- [ ] **/check-ui:** docs pages walked; simulator screens recorded.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
