# Plan: Webhook wake

**Spec:** spec.md
**Tier:** 🔴
**Seam:** the `AgentWaker` port that `receiveOwnerMessage` calls when an owner message finds no live waiter (`libs/core`); the `AccountInbox` Durable Object alarm, which gains a due-time provider for wake jobs; the `AccountInboxRpc` contract, which gains `setWake` and the wake part of `recordRevocation`; the MCP tool registry, which gains the eleventh tool; the development subclass `DevAccountInbox` and the development routes of `routes/dev-owner.ts`.
**Depends on:** `agent-inbox-core` merged to `main` (Step 0 contract, `libs/types`, `AccountInbox`, `DevAccountInbox`, `NoneWaker`, `deliverToOwner`, the due-time mechanism). `accounts-and-keys` supplies `recordRevocation` and the account locale (slice 3); this slice builds its wake part. No new dependency: `fetch`, `AbortSignal.timeout`, WebCrypto and the Durable Object alarm are platform APIs.

~~**Refresh status:** this plan is written against agent-inbox-core's plan and spec as they stand in the feature stash, because `main` has no slice 1 code yet. The first build step (W0.0) repeats the diff against `main` and records the result in the plan.~~ (done at W0.0, see the Refresh log below) **Refresh status:** refreshed 2026-11-06 against `feat/agent-inbox-core` (contract) and the lane branches `origin/feat/agent-inbox-core-l1` to `-l5` (bodies not merged yet). Slice 1 files whose bodies are still landing (`account-inbox.ts`, `dev-account-inbox.ts`, `routes/dev-owner.ts`, `mcp/tool-handlers.ts`, `test/e2e/global-setup.ts`) are not touched by Step 0; their wake additions move to the lane that owns them, after slice 1 merges.

**Assumptions (decided, owner can override):**

- **A1 Reason enum.** The `AgentWaker` port keeps slice 1's `notify({agent, reason: AgentWakeReason})`, with `AgentWakeReason.MessageWaiting`. No value is added, because the fallback goes through `deliverToOwner` (A5). Confirmed at W0.0: `AgentWakeReason.MessageWaiting` and `WakeOutcome.{Woken, Unreached}` exist in `libs/types/src/enums.ts`.
- **A2 Mode and rung enums.** `WakeMode` and `WakeRung` live in `libs/types/src/enums.ts` (agent-inbox-core creates the package). This slice adds `WakeMode.Webhook` and `WakeRung.Webhook`. `None` and `Inbox` come from slice 1. Confirmed at W0.0: `WakeMode.None` and `WakeRung.Inbox` exist.
- **A3 Wake dependencies.** Wake use cases take `WakeContext = { dependencies: CoreDependencies; wake: WakeDependencies }`. `CoreDependencies` and `InboxRepository` keep their signatures. Wake persistence is a new `WakeRepository` port over the Durable Object SQLite. `scheduled-wake` and `local-connector` extend it; no slice adds `saveWakeSetting` to `InboxRepository`.
- **A4 Scheduling outcome.** `WebhookAgentWaker.notify` returns `WakeOutcome.Woken` when a job is scheduled and `WakeOutcome.Unreached` when the connection has no webhook. `Unreached` makes core send the waiting notice.
- **A5 Fallback path.** The owner notice for a failed wake goes through `deliverToOwner` as text with the `wakeFailed` copy. The window rules and one-notice-per-closed-window apply (ADR 0011). `NoneWaker` has no outbound port and does not send it.
- **A6 One notice per episode.** The notice is sent when `agent_wake.status` changes from `active` to `failing`. Further failed jobs while `failing` send nothing. The next delivery returns the status to `active`.
- **A7 Re-setting clears failure.** A successful `set_wake` sets the status to `active`.
- **A8 Retry-After.** Integer seconds only. HTTP-date values are treated as absent. Honoured on `429` and `503` only, capped at `WAKE_BACKOFF_CAP_MS`.
- **A9 Thrown errors.** An exception inside one job is caught per job. The job row is kept with `lastOutcome = WakeAttemptOutcome.Retry` and retried after the base backoff. The alarm never throws. A sealed target that cannot be opened is `Refused`.
- **A10 Development-only transport and RPCs.** The production class `AccountInbox` builds `FetchWakeTransport` through the protected method `createWakeTransport()`. `DevAccountInbox` (slice 1, `apps/api/src/dev/dev-account-inbox.ts`, exported as `AccountInbox` only by `index.dev.ts`) overrides that method to return a `ScriptedWakeTransport` and adds `devScriptWake`, `devReadWakeRequests` and `devRunDueWakes`. The production class has none of them. There is no environment variable for the mode and no `WAKE_TRANSPORT_MODE` binding.
- **A11 Test double placement.** ~~`ScriptedWakeTransport`, `InMemoryWakeSecretBox`, `InMemoryWakeRepository` and `RecordingWakeObserver` live in `libs/core/src/testing/wake-doubles.ts`. They are exported from `libs/core/src/testing/index.ts` and reached from `apps/api` as `@zapbip/core/testing` (a new `exports` entry in `libs/core/package.json`, added by W0.2).~~ (slice 1 keeps its doubles under `libs/core/src/inbox/testing/` and builds them with `create…` factories, and `@zapbip/core/testing` would collide with the next slice that needs one) The doubles are factories (`createScriptedWakeTransport`, `createInMemoryWakeSecretBox`, `createInMemoryWakeRepository`, `createRecordingWakeObserver`) in `libs/core/src/wake/testing/wake-doubles.ts`, exported from `libs/core/src/wake/testing/index.ts` and reached from `apps/api` as `@zapbip/core/wake-testing` (a new `exports` entry in `libs/core/package.json`, added by W0.2, that keeps `.` and adds `./wake-testing`). They are not re-exported from the core root index, so the production bundle does not carry them.
- **A12 Integration tests use the development entry.** The integration pool's `main` is `src/index.dev.ts`, so Worker tests reach `DevAccountInbox`. Time is moved with `advanceClock` (slice 1: `DevAccountInbox.advanceClock`, backed by `DurableClock.advance`) and alarms fire with `runDurableObjectAlarm`, which calls `alarm()` whatever the stored alarm time is. Confirmed at W0.0. No `ManualClock` subclass exists in this slice.
- **A13 Key.** `WAKE_SECRET_KEY` is a Worker secret. The `Bindings` type gains `WAKE_SECRET_KEY: string`. The Durable Object constructor builds the secret box and throws when the key is missing or does not decode to 32 bytes. Tests get a fixed test-only key (32 zero bytes, base64) from `vitest.integration.config.mts` and `vitest.e2e.config.mts`. `apps/api/.dev.vars.example` documents the name with an empty value. At W0.0: the e2e key is passed as a `--var` in `apps/api/test/e2e/global-setup.ts` (slice 1's file, not on this branch yet), so the e2e half of this assumption lands in L5; `vitest.e2e.config.mts` has no bindings.
- **A14 Sealed format.** `sealed_target` is base64 of `version (1 byte) ‖ iv (12 bytes) ‖ AES-256-GCM ciphertext and tag` over the JSON `{url, token}`. The version byte is `WAKE_SEALED_KEY_VERSION` (1). Additional authenticated data is `wakeAssociatedData({connection})` = `${accountId}:${agent}`.
- **A15 Provider values.** `WakeProvider` values are the stored and returned strings: `grok_routine`, `claude_routine`, `generic`.
- **A16 Log shape.** One typed `WakeLogEvent` object. Its `name` is a `WakeLogEventName` enum with the six spec names. It has no field for url, token, host or headers. Core emits through the `WakeObserver` port. The apps/api adapter writes one console JSON line and one Analytics Engine datapoint per attempt.
- **A17 Signing.** HMAC-SHA256 over `${timestampSeconds}.${body}`, keyed by the owner's token, lowercase hex, prefixed `sha256=`. Timestamp is Unix seconds, computed from `nowMs` in the transport.
- **A18 Mode errors.** `local`, `scheduled` and `standby` return `InboxError(InboxErrorCode.InvalidInput)` with the message `wake mode not available yet`.
- **A19 Clear.** `mode: none` stores `mode: none`, `target: null`, and deletes the job. `recordRevocation({agent})` calls `WakeRepository.clearWake({agent})`, which does the same and also sets status to `active`.
- **A20 Docs navigation.** The two `docs.json` entries are added by the docs lane, which owns `docs.json` for this slice.
- **A21 Locale.** The owner's locale is the account property `ownerLocale` (slice 3). `ConnectionIdentity` and `receiveOwnerMessage` carry it. The Durable Object stores the last value it received in its storage key `owner_locale`. The alarm reads that key and passes it to `runDueWakes`. At W0.0: slice 1's `DueTimeProvider.runDue({now})` carries no locale, so the wake provider's `runDue` reads `owner_locale` from storage itself. A missing value throws inside the per-job catch, so the job retries. There is no default locale.
- **A22 Wire body.** Every target, `ClaudeRoutine` included, receives `WAKE_SIGNAL_BODY`. Risk recorded in the spec: `/fire` may reject the unknown `event` field.
- **A23 Due-time providers.** ~~The Durable Object re-arms its alarm after every write path to the earliest of all registered due-time providers (slice 1 mechanism, `(contract: confirm at build)`).~~ (confirmed, with a floor) The Durable Object re-arms its alarm in `outcome()`'s `finally` through `armAlarm()` to the earliest `nextDueAt()` of `dueTimeProviders`, and `alarm()` calls `runDue({now})` on each provider in order. Confirmed at W0.0. `armAlarm` never schedules sooner than `ALARM_MIN_DELAY_MS` (5 s) from the real time, so the 3 s debounce is a floor on the wake time, not the delay: the real alarm fires 5 s after the owner message at the earliest. Tests call `runDurableObjectAlarm`, which ignores the stored time. Recorded as a finding for the spec. This slice registers one provider: `WakeRepository.findNextDueAt`. It never arms the alarm itself.
- **A24 Public host.** `publicHost` is `new URL(PUBLIC_ORIGIN).hostname`, computed in the Durable Object. The guard also accepts an origin and reduces it to its hostname, so passing the origin cannot disable the own-host check. `PUBLIC_BASE_URL` is not used.
- **A25 Shared enums and constants.** All wake enums are in `libs/types/src/enums.ts`. Time constants use `SECOND_MS` from `libs/types/src/constants.ts`. No local `ONE_SECOND_MS`.
- **A27 Shared `agent_wake` row.** Slice 1 owns `agent_wake (agent, mode, last_polled_at, updated_at)`. This slice adds wake columns in schema `v2`; `scheduled-wake` adds its columns in `v3` and `local-connector` writes `mode` too. `WakeRepository.saveWake` is an `UPDATE` of the wake columns only (the row exists because `touchAgent` ran `INSERT OR IGNORE INTO agent_wake (agent, mode, last_polled_at, updated_at)` with `WakeMode.None`, and `setWake` calls `touchAgent` first; `last_polled_at` is `NOT NULL`, so an insert from this slice would have to invent a value). `saveWake` writes only the wake columns (`mode`, `provider`, `host`, `sealed_target`, `key_version`, `status`, `last_delivered_at`, `updated_at`) and never `last_polled_at`, so a parallel poll write cannot be overwritten by a wake write, and the reverse holds for `recordPoll` in `scheduled-wake`. A test pins this (test plan, integration group).
- **A28 Migration order.** The DO migration runner (slice 1) records the set of applied versions and applies every missing one in ascending order, so `v2` (this slice) applies whether or not `v3` or `v5` is present first. No migration edits a version already deployed.
- **A26 Owner locale in copy.** The `wakeFailed` copy follows slice 1's enum-keyed pattern (`inbox-copy.ts`): a `WakeCopyKey` enum, and a `Record<WakeCopyKey, Record<OwnerLocale, string>>` with `pt_BR` and `en_US` entries, selected by the locale that `runDueWakes` receives.
- **A30 Factories.** Slice 1's adapters are `create…` factory functions over a `{storage}` or `{bucket}` object, not classes (`createNoneWaker`, `createSqliteInboxRepository`, `createR2MediaStore`). This slice follows: `createFetchWakeTransport`, `createAesGcmWakeSecretBox`, `createCloudflareWakeObserver`, `createWebhookAgentWaker`, `createDispatchingAgentWaker`, `createSqliteWakeRepository` (file `apps/api/src/adapters/sqlite/sqlite-wake-repository.ts`, raw `storage.sql` like the inbox repository, no Drizzle). The `~~class …~~` blocks of the Contract below are superseded by the signatures in the Refresh log.
- **A31 `recordRevocation` is slice 3's.** The cross-slice table gives `recordRevocation({agent})` to `accounts-and-keys`. This slice ships `WakeRepository.clearWake` and tests it through `runInDurableObject`; the call from `recordRevocation` is wired by slice 3. The wake part of the RPC is struck from W2.4.
- **A32 Wake RPC is a separate interface.** `AccountInbox implements AccountInboxRpc`; adding `setWake` to `AccountInboxRpc` in Step 0 would break the typecheck of the stub class in a file slice 1 is still rewriting. Step 0 adds `WakeRpc` and `DevWakeRpc` in `apps/api/src/contract/wake-rpc.ts`. L2 changes `AccountInboxRpc` to extend `WakeRpc` and `DevAccountInboxRpc` to extend `DevWakeRpc` in the same commit that adds the methods to the class.
- **A33 `set_wake` registration.** `TOOL_DEFINITIONS` is a `Record<McpToolName, …>` in `apps/api/src/contract/tool-definitions.ts` and `TOOL_HANDLERS` in `apps/api/src/mcp/tool-handlers.ts` is `satisfies Record<McpToolName, unknown>`. Adding `McpToolName.SetWake` in Step 0 would break slice 1's handler map when its lanes merge, so L3 adds the enum member, the definition (using the Step 0 shapes) and the handler together, after slice 1 merges. Step 0 ships only `setWakeInputShape` and `setWakeOutputShape`.
- **A29 Temporary rung function.** `wakeRungFor` is temporary. It maps `mode` to `WakeRung` for this slice only. `scheduled-wake` replaces it with `effectiveWakeRung({connection, now, inbox})` (cross-slice row 23) and deletes it in the same change.

## Contract (Step 0, verbatim)

Step 0 lands on the feature branch first, in one commit. Every lane builds against these signatures. A change after Step 0 means a new Step 0 commit that every lane then merges. Stub bodies are exactly `void input;` followed by `throw new Error('<name> is not implemented');`.

### `libs/types/src/enums.ts` (additions; slice 1 owns the file)

```ts
// Extends the slice 1 enums of the same name; values added here, nothing removed.
export enum WakeMode {
  Webhook = 'webhook',
}

export enum WakeRung {
  Webhook = 'webhook',
}

export enum WakeAttemptOutcome {
  Delivered = 'delivered',
  Retry = 'retry',
  Refused = 'refused',
}

export enum WakeProvider {
  GrokRoutine = 'grok_routine',
  ClaudeRoutine = 'claude_routine',
  GenericWebhook = 'generic',
}

export enum WakeStatus {
  Active = 'active',
  Failing = 'failing',
}

export enum SetWakeStatus {
  Saved = 'saved',
}

export enum WakeLogEventName {
  Scheduled = 'wake.scheduled',
  Dropped = 'wake.dropped',
  Delivered = 'wake.delivered',
  Retry = 'wake.retry',
  Refused = 'wake.refused',
  GaveUp = 'wake.gave_up',
}
```

### `libs/core/src/wake/constants.ts`

```ts
import { SECOND_MS } from '@zapbip/types';

export const WAKE_DEBOUNCE_MS = 3 * SECOND_MS;
export const WAKE_REQUEST_TIMEOUT_MS = 10 * SECOND_MS;
export const WAKE_LEASE_MS = 15 * SECOND_MS;
export const WAKE_BACKOFF_BASE_MS = 5 * SECOND_MS;
export const WAKE_BACKOFF_CAP_MS = 60 * SECOND_MS;
export const WAKE_MAX_ATTEMPTS = 5;
export const WAKE_SIGNAL_BODY = '{"event":"inbox_has_messages"}';
export const WAKE_URL_MAX_CHARS = 512;
export const WAKE_TOKEN_MIN_CHARS = 16;
export const WAKE_TOKEN_MAX_CHARS = 512;
export const WAKE_GENERIC_TOKEN_MIN_CHARS = 32;
export const WAKE_TOKEN_PATTERN = /^[\x21-\x7E]+$/;
export const WAKE_SIGNATURE_TOLERANCE_S = 300;
export const WAKE_SEALED_KEY_VERSION = 1;
export const WAKE_SECRET_KEY_BYTES = 32;
export const WAKE_IV_BYTES = 12;
export const WAKE_BLOCKED_HOSTS: readonly string[] = ['localhost'];
export const WAKE_BLOCKED_HOST_SUFFIXES: readonly string[] = ['.localhost', '.local', '.internal', '.lan', '.arpa'];
export const WAKE_RETRY_AFTER_STATUSES: readonly number[] = [429, 503];
export const WAKE_CONTENT_TYPE = 'application/json';
export const WAKE_AUTHORIZATION_PREFIX = 'Bearer ';
export const WAKE_TIMESTAMP_HEADER = 'X-Zapbip-Timestamp';
export const WAKE_SIGNATURE_HEADER = 'X-Zapbip-Signature';
export const WAKE_SIGNATURE_PREFIX = 'sha256=';
export const CLAUDE_ROUTINE_BETA_HEADER = 'anthropic-beta';
export const CLAUDE_ROUTINE_BETA_VALUE = 'experimental-cc-routine-2026-04-01';
export const CLAUDE_ROUTINE_VERSION_HEADER = 'anthropic-version';
export const CLAUDE_ROUTINE_VERSION_VALUE = '2023-06-01';
```

### `libs/core/src/wake/wake-provider.ts`

```ts
import { WakeProvider } from '@zapbip/types';
import {
  CLAUDE_ROUTINE_BETA_HEADER,
  CLAUDE_ROUTINE_BETA_VALUE,
  CLAUDE_ROUTINE_VERSION_HEADER,
  CLAUDE_ROUTINE_VERSION_VALUE,
  WAKE_AUTHORIZATION_PREFIX,
  WAKE_CONTENT_TYPE,
} from './constants';

export type PinnedWakeProvider = WakeProvider.GrokRoutine | WakeProvider.ClaudeRoutine;

export type PinnedWakeProviderRule = {
  host: string;
  pathPattern: RegExp;
  buildHeaders: (input: { token: string }) => Record<string, string>;
};

export const PINNED_WAKE_PROVIDER_RULES: Record<PinnedWakeProvider, PinnedWakeProviderRule> = {
  [WakeProvider.GrokRoutine]: {
    host: 'api2.cursor.sh',
    pathPattern: /^\/automations\/webhook\/[A-Za-z0-9_-]{8,64}$/,
    buildHeaders: ({ token }) => ({
      authorization: `${WAKE_AUTHORIZATION_PREFIX}${token}`,
      'content-type': WAKE_CONTENT_TYPE,
    }),
  },
  [WakeProvider.ClaudeRoutine]: {
    host: 'api.anthropic.com',
    pathPattern: /^\/v1\/claude_code\/routines\/trig_[A-Za-z0-9]+\/fire$/,
    buildHeaders: ({ token }) => ({
      authorization: `${WAKE_AUTHORIZATION_PREFIX}${token}`,
      'content-type': WAKE_CONTENT_TYPE,
      [CLAUDE_ROUTINE_BETA_HEADER]: CLAUDE_ROUTINE_BETA_VALUE,
      [CLAUDE_ROUTINE_VERSION_HEADER]: CLAUDE_ROUTINE_VERSION_VALUE,
    }),
  },
};
```

### `libs/core/src/wake/wake-setting.ts`

```ts
import type { WakeMode, WakeProvider, WakeStatus, WakeAttemptOutcome } from '@zapbip/types';
import type { AgentName } from '../inbox/connection';

export type WakeSettingInput = { mode: WakeMode; url: string | null; token: string | null };

export type WakeTarget = { provider: WakeProvider; url: string; token: string };

export type StoredWakeTarget = { provider: WakeProvider; host: string; sealedTarget: string; keyVersion: number };

export type StoredWake = {
  agent: AgentName;
  mode: WakeMode;
  target: StoredWakeTarget | null;
  status: WakeStatus;
  lastDeliveredAt: number | null;
};

export type WakeJob = {
  agent: AgentName;
  dueAt: number;
  attempt: number;
  leaseUntil: number | null;
  rewake: boolean;
  lastOutcome: WakeAttemptOutcome | null;
};
```

### `libs/core/src/wake/wake-ports.ts`

(W0.0: the imports are `'../inbox/connection'` and `'../inbox/ports'`; the same change applies to `wake-setting.ts` and every other import of slice 1 types in this section.)

```ts
import type { AgentName, ConnectionIdentity } from '../inbox/connection';
import type { CoreDependencies } from '../inbox/ports';
import type { OwnerLocale, WakeAttemptOutcome, WakeLogEventName, WakeMode, WakeProvider, WakeRung, SetWakeStatus } from '@zapbip/types';
import type { StoredWake, WakeJob, WakeSettingInput, WakeTarget } from './wake-setting';

export type WakeAttemptRequest = { agent: AgentName; target: WakeTarget; body: string; nowMs: number };

export type WakeAttemptResult = {
  outcome: WakeAttemptOutcome;
  statusCode: number | null;
  retryAfterMs: number | null;
};

export interface WakeTransport {
  send(input: WakeAttemptRequest): Promise<WakeAttemptResult>;
}

export interface WakeSecretBox {
  seal(input: { plain: string; associatedData: string }): Promise<string>;
  open(input: { sealed: string; associatedData: string }): Promise<string | null>;
}

export interface WakeRepository {
  findWake(input: { agent: AgentName }): Promise<StoredWake | null>;
  saveWake(input: { wake: StoredWake }): Promise<void>; // writes wake columns only, never last_polled_at (A27)
  clearWake(input: { agent: AgentName }): Promise<void>;
  findJob(input: { agent: AgentName }): Promise<WakeJob | null>;
  saveJob(input: { job: WakeJob }): Promise<void>;
  deleteJob(input: { agent: AgentName }): Promise<void>;
  listDueJobs(input: { now: number }): Promise<WakeJob[]>;
  findNextDueAt(): Promise<number | null>;
}

export type WakeLogEvent = {
  name: WakeLogEventName;
  provider: WakeProvider | null;
  agent: AgentName;
  attempt: number;
  statusCode: number | null;
  latencyMs: number | null;
  outcome: WakeAttemptOutcome | null;
};

export interface WakeObserver {
  observe(input: { event: WakeLogEvent }): void;
}

export type WakeDependencies = {
  transport: WakeTransport;
  secretBox: WakeSecretBox;
  repository: WakeRepository;
  observer: WakeObserver;
};

export type WakeContext = {
  dependencies: CoreDependencies;
  wake: WakeDependencies;
};

export type SetWakeInput = WakeContext & {
  connection: ConnectionIdentity;
  setting: WakeSettingInput;
  publicHost: string;
};

export type SetWakeResult = {
  status: SetWakeStatus;
  wakeMode: WakeMode;
  effectiveRung: WakeRung;
  provider: WakeProvider | null;
};

export type ScheduleWakeInput = WakeContext & { agent: AgentName };

export type RunDueWakesInput = WakeContext & { ownerLocale: OwnerLocale };
export type RunDueWakesResult = { nextDueAt: number | null };

export type ScriptedWakeResponse = {
  statusCode: number | null;
  errorName: string | null;
  retryAfterMs: number | null;
};

export type RecordedWakeRequest = {
  agent: AgentName;
  url: string;
  headers: Record<string, string>;
  body: string;
  atMs: number;
};
```
`ClearWakeInput` is `{ agent }` (the port method above). `ConnectionIdentity` (slice 1) carries `ownerLocale`; `WakeOutcome` is slice 1's enum. `libs/core/src/wake/wake-ports.ts` imports `WakeOutcome` from `libs/types` where it is used.

### `libs/core/src/wake/wake-rung.ts`, `wake-associated-data.ts`, `assert-wake-target.ts`, `sign-wake-request.ts`, `set-wake.ts`, `schedule-wake.ts`, `run-due-wakes.ts` (signatures)

```ts
export function wakeRungFor(input: { mode: WakeMode }): WakeRung; // TEMPORARY (A29): scheduled-wake replaces it with effectiveWakeRung and deletes it
export function wakeAssociatedData(input: ConnectionIdentity): string;

export type AssertWakeTargetInput = { url: string; token: string; publicHost: string };
export function assertWakeTarget(input: AssertWakeTargetInput): WakeTarget;

export type SignWakeRequestInput = { timestampSeconds: number; body: string };
export function signWakeRequest(input: SignWakeRequestInput): string;

export function setWake(input: SetWakeInput): Promise<SetWakeResult>;
export function scheduleWake(input: ScheduleWakeInput): Promise<WakeOutcome>;
export function runDueWakes(input: RunDueWakesInput): Promise<RunDueWakesResult>;
```

`libs/core/src/wake/wake-copy.ts` (slice 1's enum-keyed copy pattern, A26):

```ts
export enum WakeCopyKey {
  WakeFailed = 'wake_failed',
}
export const WAKE_COPY: Record<WakeCopyKey, Record<OwnerLocale, string>>;
export function wakeFailedCopy(input: { locale: OwnerLocale }): string; // returns WAKE_COPY[WakeCopyKey.WakeFailed][input.locale]
```

No default locale: the lookup is by the required `OwnerLocale`.

`libs/core/src/wake/index.ts` re-exports the module above. `libs/core/src/index.ts` gets one line, `export * from './wake';`.

### ~~`libs/core/src/testing/wake-doubles.ts` and `libs/core/src/testing/index.ts`~~ superseded: factories under `libs/core/src/wake/testing/` (A11, A30)

```ts
export type ScriptedWakeTransport = WakeTransport & {
  enqueue(input: { agent: AgentName; responses: ScriptedWakeResponse[] }): void;
  readonly requests: RecordedWakeRequest[];
  requestsFor(input: { agent: AgentName }): RecordedWakeRequest[];
};
export type RecordingWakeObserver = WakeObserver & { readonly events: WakeLogEvent[] };

export function createScriptedWakeTransport(): ScriptedWakeTransport;
export function createInMemoryWakeSecretBox(): WakeSecretBox;
export function createInMemoryWakeRepository(): WakeRepository;
export function createRecordingWakeObserver(): RecordingWakeObserver;
```

### ~~`libs/core/package.json` (one `exports` entry, W0.2)~~ superseded

```json
"exports": { ".": "./src/index.ts", "./wake-testing": "./src/wake/testing/index.ts" }
```

### ~~`apps/api/src/contract/env.ts`~~ unchanged except the two additions (`WAKE_TRANSPORT_MODE` is not added)

```ts
// Bindings gains:
//   WAKE_SECRET_KEY: string;
//   WAKE_METRICS: AnalyticsEngineDataset;
```

### ~~`apps/api/src/contract/account-inbox-rpc.ts` (additions to `AccountInboxRpc`)~~ superseded: `apps/api/src/contract/wake-rpc.ts` (A31, A32)

```ts
export interface WakeRpc {
  setWake(input: { connection: ConnectionIdentity; setting: WakeSettingInput }): Promise<CallOutcome<SetWakeResult>>;
}

export interface DevWakeRpc {
  devScriptWake(input: { agent: AgentName; responses: ScriptedWakeResponse[] }): Promise<void>;
  devReadWakeRequests(input: { agent: AgentName }): Promise<RecordedWakeRequest[]>;
  devRunDueWakes(): Promise<void>;
}
```

### `apps/api/src/contract/mcp-schemas.ts` (additions)

```ts
export const setWakeInputShape: ZodRawShape;   // mode: z.enum([...WakeMode values]), url, token: nullable strings defaulting to null (the file's nullableString)
export const setWakeOutputShape: ZodRawShape;  // status, wake_mode, effective_rung, provider (nullable)
```

### ~~`apps/api/src/dev/dev-account-inbox.ts`, `account-inbox.ts` and `due-time.ts`~~ moved to L2 (A32, A10)

Step 0 does not edit `account-inbox.ts`, `dev-account-inbox.ts` or `contract/due-time-provider.ts`. The shapes L2 builds, confirmed against slice 1's lane code:

```ts
// AccountInbox (production, protected)
protected createWakeTransport(): WakeTransport;   // returns createFetchWakeTransport()
// DevAccountInbox (development entry only)
protected createWakeTransport(): WakeTransport;   // returns createScriptedWakeTransport()
// slice 1's DueTimeProvider, already on the branch
interface DueTimeProvider { nextDueAt(): Promise<number | null>; runDue(input: { now: number }): Promise<void> }
// the wake provider: nextDueAt = repository.findNextDueAt(); runDue = runDueWakes with the stored owner_locale
```

### ~~`apps/api/src/routes/dev-owner.ts`~~ moved to L5

The routes are added to `devOwnerRoutes` by L5 after slice 1 merges. `DEV_OWNER_PATH_PREFIX` is `/dev/owner/:phone` and `findOwner` resolves `:phone`; the route table below is unchanged.

| Route | Body | Response |
|---|---|---|
| `POST /dev/owner/:phone/agents/:agent/wake/script` | `{responses: ScriptedWakeResponse[]}` | `204` |
| `GET /dev/owner/:phone/agents/:agent/wake/requests` | none | `200` with `RecordedWakeRequest[]` |
| `POST /dev/owner/:phone/wake/run` | none | `204` |

### Adapters (stubs in L0, bodies in L2), as factories (A30)

```ts
// apps/api/src/adapters/wake/fetch-wake-transport.ts
export function createFetchWakeTransport(): WakeTransport;

// apps/api/src/adapters/wake/aes-gcm-wake-secret-box.ts
export function createAesGcmWakeSecretBox(input: { base64Key: string }): WakeSecretBox;   // throws when not 32 bytes

// apps/api/src/adapters/wake/wake-observer.ts
export function createCloudflareWakeObserver(input: { dataset: AnalyticsEngineDataset }): WakeObserver;

// apps/api/src/adapters/wake/webhook-agent-waker.ts
export function createWebhookAgentWaker(input: { dependencies: CoreDependencies; wake: WakeDependencies }): AgentWaker;

// apps/api/src/adapters/wake/dispatching-agent-waker.ts
export type WakerByRung = Record<WakeRung.Webhook | WakeRung.Inbox, AgentWaker>;
export function createDispatchingAgentWaker(input: { wakers: WakerByRung; repository: WakeRepository }): AgentWaker;

// apps/api/src/adapters/sqlite/sqlite-wake-repository.ts
export function createSqliteWakeRepository(input: { storage: DurableObjectStorage }): WakeRepository;
```

### Shared test configuration (owned by L0)

- `apps/api/vitest.integration.config.mts`: the pool reads `wrangler.jsonc`, whose top-level `main` is already `src/index.dev.ts`; this slice adds the miniflare binding `WAKE_SECRET_KEY` (test-only fixed key, A13) next to slice 1's two signing keys. The `WAKE_METRICS` dataset comes from `wrangler.jsonc`.
- ~~`apps/api/vitest.e2e.config.mts`: the same test key passed to `wrangler dev`~~ (W0.0: the key is a `--var` in `test/e2e/global-setup.ts`, edited by L5).
- `apps/api/.dev.vars.example`: `WAKE_SECRET_KEY=` (empty, documented). No `.env*` file is edited.

## File map (lanes)

Every path is owned by one lane. A developer that needs a sibling's path stops and asks the lead, or notes the gap in its tester briefing (HARNESS §4).

| Lane | Developer | Owned paths |
|------|-----------|-------------|
~~| L0 Contract (Step 0, serial) | `developer-0` | `libs/types/src/enums.ts` (wake additions only); `libs/core/src/wake/{constants,wake-provider,wake-setting,wake-ports,wake-rung,wake-associated-data,wake-copy,assert-wake-target,sign-wake-request,set-wake,schedule-wake,run-due-wakes,index}.ts` (signatures, stubs, and the `PINNED_WAKE_PROVIDER_RULES` values); `libs/core/src/index.ts` (one line); `libs/core/src/testing/{wake-doubles,index}.ts` (signatures); `libs/core/package.json` (`exports`, W0.2); `apps/api/src/contract/{env,account-inbox-rpc,mcp-schemas}.ts` (additions); `apps/api/src/mcp/set-wake.ts`, `apps/api/src/adapters/wake/*.ts`, `apps/api/src/account-inbox/wake-repository.ts` (stubs); `apps/api/vitest.integration.config.mts`, `apps/api/vitest.e2e.config.mts`, `apps/api/.dev.vars.example` |~~ (W0.0: superseded)
| L0 Contract (Step 0, serial) | `developer-0` | `libs/types/src/enums.ts` (wake additions only); `libs/core/src/wake/{constants,wake-provider,wake-setting,wake-ports,wake-rung,wake-associated-data,wake-copy,assert-wake-target,sign-wake-request,set-wake,schedule-wake,run-due-wakes,index}.ts` (signatures, stubs, and the `PINNED_WAKE_PROVIDER_RULES` values); `libs/core/src/index.ts` (one line); `libs/core/src/wake/testing/{wake-doubles,index}.ts` (signatures); `libs/core/package.json` (`exports`, W0.2); `apps/api/src/contract/{env,mcp-schemas,wake-rpc}.ts` (additions and the new file); `apps/api/src/adapters/wake/*.ts`, `apps/api/src/adapters/sqlite/sqlite-wake-repository.ts` (stubs); `apps/api/wrangler.jsonc` (the dataset); `apps/api/vitest.integration.config.mts`, `apps/api/.dev.vars.example` |
~~| L1 Wake core | `developer-1` | `libs/core/src/wake/*.test.ts`; bodies of `wake-provider.ts`, `wake-rung.ts`, `wake-associated-data.ts`, `assert-wake-target.ts`, `sign-wake-request.ts`, `set-wake.ts`, `schedule-wake.ts`, `run-due-wakes.ts`, `wake-copy.ts`; the bodies of `libs/core/src/testing/wake-doubles.ts` |~~ (W0.0: superseded)
| L1 Wake core | `developer-1` | `libs/core/src/wake/*.test.ts`; bodies of `wake-provider.ts`, `wake-rung.ts`, `wake-associated-data.ts`, `assert-wake-target.ts`, `sign-wake-request.ts`, `set-wake.ts`, `schedule-wake.ts`, `run-due-wakes.ts`, `wake-copy.ts`; the bodies of `libs/core/src/wake/testing/wake-doubles.ts` |
~~| L2 Durable Object and adapters | `developer-2` | `apps/api/src/account-inbox/**` (the wake repository body, the `createWakeTransport` base method, due-time registration, `alarm()`, `recordRevocation`'s wake part, the `owner_locale` storage key, the migration to schema `v2`); `apps/api/src/dev/dev-account-inbox.ts` (the three dev RPCs and `createWakeTransport`); `apps/api/src/adapters/wake/**` bodies; `apps/api/test/unit/{aes-gcm-wake-secret-box,fetch-wake-transport,wake-observer}.test.ts`; `apps/api/test/integration/{webhook-wake-delivery,webhook-wake-secrets,webhook-wake-observability,webhook-wake-revocation}.test.ts` |~~ (W0.0: superseded)
| L2 Durable Object and adapters | `developer-2` | `apps/api/src/account-inbox/**` (the `createWakeTransport` base method, due-time registration, `alarm()` wiring, the `owner_locale` storage key, `migrations/v2.sql` and its line in `migrations/index.ts`, the `AccountInbox` methods of `WakeRpc`); `apps/api/src/contract/account-inbox-rpc.ts` (`AccountInboxRpc extends WakeRpc`, `DevAccountInboxRpc extends DevWakeRpc`, A32); `apps/api/src/dev/dev-account-inbox.ts` (the three dev RPCs and `createWakeTransport`); `apps/api/src/adapters/wake/**` and `apps/api/src/adapters/sqlite/sqlite-wake-repository.ts` bodies; `apps/api/test/unit/{aes-gcm-wake-secret-box,fetch-wake-transport,wake-observer}.test.ts`; `apps/api/test/integration/{webhook-wake-delivery,webhook-wake-secrets,webhook-wake-observability,webhook-wake-revocation}.test.ts` (the revocation file tests `clearWake` through `runInDurableObject`, A31) |
~~| L3 MCP `set_wake` | `developer-3` | `apps/api/src/mcp/set-wake.ts` (body); the one registration line in `apps/api/src/mcp/tool-definitions.ts`; `apps/api/test/integration/set-wake.test.ts`; `apps/api/test/integration/mcp-tools.test.ts` only if it hard-codes the tool count (it should use the registry constant, so the change is usually none) |~~ (W0.0: superseded)
| L3 MCP `set_wake` | `developer-3` | `apps/api/src/mcp/set-wake.ts` (new file, the handler); `McpToolName.SetWake` and its definition in `apps/api/src/contract/tool-definitions.ts` and the handler line in `apps/api/src/mcp/tool-handlers.ts` (A33); `apps/api/test/integration/set-wake.test.ts`; `apps/api/test/integration/mcp-tools.test.ts` only if it hard-codes the tool count (it asserts against the registry, so the change is usually none) |
| L4 Docs | `developer-4` | `apps/docs/docs.json` (two entries); `apps/docs/guides/webhook-wake.mdx`; `apps/docs/mcp-reference/set-wake.mdx` |
~~| L5 Dev routes, E2E and bundle | `developer-5` | `apps/api/src/routes/dev-owner.ts` (the three wake routes, additions only); `apps/api/test/integration/dev-owner-wake.test.ts`; `apps/api/test/e2e/webhook-wake.e2e.test.ts`; `apps/api/test/e2e/wake-bundle.e2e.test.ts` |~~ (W0.0: superseded)
| L5 Dev routes, E2E and bundle | `developer-5` | `apps/api/src/routes/dev-owner.ts` (the three wake routes, additions only); `apps/api/test/e2e/global-setup.ts` (the `WAKE_SECRET_KEY` `--var`, additive); `apps/api/test/integration/dev-owner-wake.test.ts`; `apps/api/test/e2e/webhook-wake.e2e.test.ts`; `apps/api/test/e2e/wake-bundle.e2e.test.ts` (beside slice 1's `production-bundle.e2e.test.ts`, which pins `DEV_METHODS = ['advanceClock', 'readScreen']`) |

Ownership notes:

- `apps/api/src/app.ts`, `index.ts`, `index.dev.ts` are not edited by this slice. `index.dev.ts` already exports `DevAccountInbox` as `AccountInbox`.
- `wrangler.jsonc` is not edited by this slice, except that the `WAKE_METRICS` dataset is declared in the top-level block. `deploy-readiness` repeats it in `env.staging` and `env.production`. This is the one `wrangler.jsonc` change, and it lands in L0.
- `libs/core/src/wake/wake-ports.ts` is read-only after L0. A port change is a new Step 0 commit.

## Sequencing

1. **Step 0 (L0), serial.** W0.0 refresh first, then the contract. The lead merges it on `feat/webhook-wake`.
2. **After Step 0, in parallel:** L1 (core bodies); L4 (docs, from the spec); L2 writes red tests against the core stubs and goes green after L1 merges.
3. **After L1 merges:** L2 goes green, then L3 (it needs the `setWake` RPC).
4. **After L2 and L3:** L5 (dev routes, E2E and bundle test).
5. **Merge order:** L0 → L1 → L2 → L3 → L5 → L4. L4 may merge at any point after L0.

Lanes never rebase. Each lane branches from the Step 0 commit and merges the lanes it depends on.

## Steps

Every box is empty when authored. A developer ticks its own box. A wrong step is struck through with the reason.

### Step 0 (L0): contract

- [x] **W0.0 Plan refresh against `main`.** Done in `fbb4fc1`; the log is the section at the end of this plan. Diff this plan against `main` and against the merged agent-inbox-core branch: paths, names, exports, the due-time mechanism, `ConnectionIdentity.ownerLocale`, `recordRevocation`, `DevAccountInbox`, `routes/dev-owner.ts`, the `libs/types` enum file. Write the result in the plan's refresh log and mark each unconfirmed contract name `(contract: confirm at build)`. Commit as `docs(wake): refresh the webhook wake plan against main`.
- [x] **W0.1 Shared types and config.** Add the wake enums to `libs/types/src/enums.ts` and the `WakeMode`/`WakeRung` additions. Add `WAKE_METRICS` to the top-level block of `wrangler.jsonc`. Write the integration Vitest binding and `.dev.vars.example` (A13); the e2e key moves to L5 (A13). Commit as `chore(wake): declare the wake enums, the metrics binding and the test configs`. Evidence: `fa6e819`.
- [x] **W0.2 Core signatures.** Write every `libs/core` file of the **Contract**, including the `PINNED_WAKE_PROVIDER_RULES` values and every import. Add the `exports` entry in `libs/core/package.json`. Run `pnpm typecheck`. Commit as `chore(wake): fix the webhook wake core contract`. Evidence: `4d6cc62`; `pnpm typecheck` green.
- [x] **W0.3 API signatures.** Write the `apps/api/src/contract` additions (`env.ts`, `mcp-schemas.ts` shapes, `wake-rpc.ts`) and the adapter and repository stubs. ~~The `createWakeTransport` base method stub, the `DevAccountInbox` dev-method stubs and the route table stub~~ (A32: those files are slice 1's and still being rewritten; L2 and L5 add them). Commit as `chore(api): fix the webhook wake API contract`. Evidence: `db89856`; `pnpm verify` green at `0959ceb` after merging `origin/feat/agent-inbox-core`.

### Lane L1: wake core

- [x] **W1.1 red: guard and signing.** Write `assert-wake-target.test.ts` and `sign-wake-request.test.ts` (test plan cases) and the test double bodies. Run `pnpm -F @zapbip/core test:unit`. Expected failure: `assertWakeTarget is not implemented`. Commit as `test(wake): pin the target guard and the signing string`. Evidence: `ca02bb0`.
- [x] **W1.2 green: guard and signing.** Implement `assert-wake-target.ts`, `sign-wake-request.ts`, `wake-rung.ts`, `wake-associated-data.ts`. Commit as `feat(wake): implement the target guard and the signing string`. Evidence: `3e24947`.
- [x] **W1.3 red: set_wake.** Write `set-wake.test.ts`. Expected failure: `setWake is not implemented`. Commit as `test(wake): pin set_wake`. Evidence: `3cc023d`.
- [x] **W1.4 green: set_wake.** Validate through `assertWakeTarget`, seal with `wakeAssociatedData`, save `active`, delete the job on `none`, never call the transport. Commit as `feat(wake): implement set_wake`. Evidence: `34ddfd2`.
- [x] **W1.5 red: scheduling.** Write `schedule-wake.test.ts`. Expected failure: `scheduleWake is not implemented`. Commit as `test(wake): pin coalescing`. Evidence: `142f761`.
- [x] **W1.6 green: scheduling.** Commit as `feat(wake): implement coalescing`. Evidence: `f62bba4`.
- [x] **W1.7 red: due wakes.** Write `run-due-wakes.test.ts` (including the throwing repository, at unit level) and `wake-copy.test.ts`. Expected failure: `runDueWakes is not implemented`. Commit as `test(wake): pin the wake outcomes, retries and fallback`. Evidence: `fa52aaa`.
- [x] **W1.8 green: due wakes.** Implement `run-due-wakes.ts` and `wake-copy.ts`. Commit as `feat(wake): implement due wakes, retries and the owner notice`. Evidence: `bd33255`.

### Lane L2: Durable Object and adapters

- [x] **W2.1 red: adapters.** Write `aes-gcm-wake-secret-box.test.ts`, `fetch-wake-transport.test.ts` (global `fetch` stubbed) and `wake-observer.test.ts`. Expected failure: `... is not implemented`. Commit as `test(api): pin the wake adapters`. Evidence: `17f985a`.
- [x] **W2.2 green: adapters.** Implement the secret box (WebCrypto, A14), the transport (rules from `PINNED_WAKE_PROVIDER_RULES`, the generic signature, `redirect: "manual"`, `AbortSignal.timeout(WAKE_REQUEST_TIMEOUT_MS)`, the outcome table, A8, class-name-only errors), the observer. Commit as `feat(api): implement the wake adapters`. Evidence: `0e9446a`.
- [x] **W2.3 red: Durable Object.** Write `webhook-wake-delivery.test.ts`, `webhook-wake-secrets.test.ts`, `webhook-wake-observability.test.ts`, `webhook-wake-revocation.test.ts`. Use `advanceClock` and `runDurableObjectAlarm`. Expected failure: `setWake is not implemented`. Commit as `test(api): pin the webhook wake on the Durable Object`. Evidence: `ba8483a`.
- [x] **W2.4 green: Durable Object.** Migration to schema `v2`; `DurableObjectWakeRepository` (including `clearWake`); constructor wiring (secret box from `WAKE_SECRET_KEY`, `createWakeTransport()`, observer, repository); `WebhookAgentWaker`; `DispatchingAgentWaker`; the RPC bodies; registration of `findNextDueAt` as a due-time provider; `owner_locale` storage; `alarm()` (A9, A21); ~~`recordRevocation` clears the wake (A19)~~ (A31: slice 3 wires the call; this lane ships and tests `clearWake`). `DevAccountInbox` gains its three dev RPCs and `createWakeTransport`. Commit as `feat(api): run webhook wakes from the Durable Object alarm`. Evidence: `f96f2d8`.

### Lane L3: MCP `set_wake`

- [x] **W3.1 red: tool.** (aaed4db) Write `set-wake.test.ts`. The tool count is taken from the registry constant, not a literal. Expected failure: `set_wake` is missing from `tools/list`. Commit as `test(api): pin set_wake over MCP`.
- [x] **W3.2 green: tool.** (7eb923a, green after the L2 merge 90b73a5) Implement `set-wake.ts`; register it; map `wake_mode` and `effective_rung`. Errors carry the `InboxError` message and no input values. Commit as `feat(api): expose set_wake`.

### Lane L4: docs

- [x] **W4.1 pin or red: navigation.** (red, d75873f) Add the two `docs.json` entries first and run `mint broken-links`. If the two pages do not exist when the lane starts, the expected failure is two missing pages and the commit is red (`docs(wake): link the webhook wake pages`). If they already exist, the check is green on arrival and the commit is labelled `pin` in its body and the tester briefing.
- [x] **W4.2 green: pages.** (80d2123) Write both pages with placeholders only (`<routine-id>`, `<trigger-id>`, `<token>`). Commit as `docs(wake): document the webhook wake`.

### Lane L5: dev routes, E2E and bundle

- [x] **W5.1 red: dev routes.** (a39a3b1; the bundle test was corrected in a follow-up commit) Write `dev-owner-wake.test.ts` (the three routes; `404` for an unknown phone and for another account's agent) and `wake-bundle.e2e.test.ts`. Expected failure: `404` where `204` is expected. Commit as `test(api): pin the wake dev routes and the wake bundle`.
- [x] **W5.2 green: dev routes.** (0972935) Add the routes to `routes/dev-owner.ts`. Commit as `feat(api): add the wake dev routes`.
- [x] **W5.3 red: E2E.** (e939240, a pin: see the tester briefing) Write `webhook-wake.e2e.test.ts`. It runs in the default gate. Expected failure: zero recorded requests where one is expected. Commit as `test(e2e): pin the webhook wake walk`.
- [x] **W5.4 green: E2E.** (e939240) Make the walk pass. The walk moves time with `advance_ms` and runs `POST /dev/owner/:phone/wake/run`; no `sleep`. Commit as `test(e2e): run the webhook wake walk`.

### Z. Prove and ship

- [ ] **Tester briefing:** each developer wrote its section of `docs/features/webhook-wake/tester-briefing.md`.
- [x] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md`, area by area, ticking every box with evidence. Evidence: `b46d30c`, `test-results/webhook-wake/final-head.md`.
- [ ] **Reviewer:** a fresh `reviewer` returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`.
- [ ] **Security reviewer:** a fresh `security-reviewer` returned `Security verdict`.
- [ ] **Owner-run section:** the live checks are run by the owner; measured times are recorded in the PR.
- [ ] **/open-pr:** gates passed; `docs/features/README.md` row and the ADR rows 0018 and 0019 land in the same change; learnings sweep stated; PR opened.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| W0.0 (refresh) | a slice 1 name changed on `main` and the lanes build on the old one | the refresh log lists a mismatch | correct the plan and the contract before W0.2; no lane starts |
| W0.2 (core contract) | a lane builds on a changed port signature | `pnpm typecheck` names the port in another lane | new Step 0 commit; never edit `wake-ports.ts` inside a lane. **No backout for the commit itself.** |
| W0.2 (`libs/types` enums) | `WakeMode`/`WakeRung` values differ from slice 1 | `set_wake` tests fail on the `wake_mode` string | take slice 1's values; revert this lane's change |
| W1.2 (guard) | a pinned host accepts the POC path, or a decimal or IPv4 literal passes | `assert-wake-target.test.ts` cases go green unexpectedly | revert W1.2; W1.1 red stays |
| W1.4 (`set_wake`) | the token or URL is returned in the result or an error | `set-wake.test.ts` finds the token in `JSON.stringify(result)` | revert W1.4 |
| W1.6 (coalescing) | a steady stream postpones the wake forever | `schedule-wake.test.ts` shows `dueAt` moving | keep the first `dueAt` |
| W1.8 (retries) | attempt five sends again, or the backoff is not doubling | `run-due-wakes.test.ts` asserts the due time after each failure: delays of 5, 10, 20 and 40 s, then give up | revert W1.8 |
| W1.8 (fallback) | the owner notice repeats on every failed job | two notices in `run-due-wakes.test.ts` while `failing` | apply the active-to-failing rule (A6) |
| W1.8 (throwing repository) | a storage error escapes `runDueWakes` | the unit test rejects | catch per job (A9) |
| W2.2 (transport) | `Retry-After` honoured on `500`, or the bearer sent to a generic host | `fetch-wake-transport.test.ts` headers case fails | revert W2.2 |
| W2.2 (transport) | the request follows a redirect | `fetch` called twice in the `302` test | `redirect: "manual"`; revert W2.2 |
| W2.4 (alarm) | the alarm throws, so the platform retries outside the cap | `webhook-wake-delivery.test.ts` rejects `runDurableObjectAlarm` when the transport throws | catch at the top of `alarm()` and re-arm |
| W2.4 (due time) | the alarm is not re-armed after a write that adds a wake job, or ignores an earlier expiry | `webhook-wake-delivery.test.ts` (due-time test) reads `getAlarm` and gets the wrong time | run the re-arm after every write path with all providers (A23) |
| W2.4 (constructor) | the object starts without `WAKE_SECRET_KEY` | `webhook-wake-secrets.test.ts` expects construction to throw | keep the throwing constructor (A13) |
| W2.4 (sealing, AAD) | a sealed target opens under another agent | `webhook-wake-secrets.test.ts` (moved value) gets `delivered` instead of `refused` | keep `wakeAssociatedData` in the call |
| W2.4 (revocation) | a revoked agent keeps its wake and job | `webhook-wake-revocation.test.ts` finds the job after `recordRevocation` | call `clearWake` from the revocation path |
| W2.4 (locale) | the alarm falls back to a default locale | `webhook-wake-delivery.test.ts` (locale test) expects the owner's `en_US` text and gets `pt_BR` | throw when `owner_locale` is missing (A21) |
| W2.4 (migration `v2`) | the migration runs on an object whose `v3` or `v5` is already applied, or edits a deployed version | `webhook-wake-secrets.test.ts` migration case (set of applied versions) fails; `schema_versions` lists a missing `v2` | applied-set runner (A28); forward migration only |
| W2.4 (`saveWake`) | a wake write overwrites `last_polled_at` written by a poll | `webhook-wake-revocation.test.ts` (save-after-poll case) reads `last_polled_at` back changed | `saveWake` writes wake columns only (A27); revert W2.4 |
| W0.1 (Analytics Engine binding) | `wrangler deploy` fails because Analytics Engine is not enabled on the account | the deploy fails with an Analytics Engine error; the wake bundle test still passes | enable Analytics Engine on the account (owner action, `deploy-readiness` runbook) or remove the binding in the same change before deploy; **note for deploy-readiness:** list the dataset in the runbook prerequisites and in every `env` block |
| W5.2 (dev routes) | a dev route is mounted from the production entry | `wake-bundle.e2e.test.ts` finds `wake/script` in the production bundle | remove the mount; `routes/dev-owner.ts` is mounted only by `index.dev.ts` |
| W5.4 (E2E) | the walk passes on a `2xx` without a request | `webhook-wake.e2e.test.ts` checks the recorded body equals `WAKE_SIGNAL_BODY` | fix the assertion; revert W5.4 |
| W4.2 (docs) | a page link breaks after a rename | `mint broken-links` red | fix the link in the same commit |
| Z (owner-run) | a live provider call spends money or starts a real run without the owner's go-ahead | the owner-run checks are outside the gate | agents do not run them; recorded in coverage honesty |

**Steps with no backout:** W0.2 and W0.3 (contract): fix forward through a new Step 0 commit. W2.4 (migration `v2`) once deployed: the migration is immutable; the backout is a new forward migration. W0.1 (Analytics Engine binding) once deployed: the binding is removed only by a new deploy, and the dataset must already be enabled on the account.

## Z. Prove and ship

- [ ] **Tester briefing:** each developer wrote its section of `docs/features/webhook-wake/tester-briefing.md`.
- [x] **Tester run:** a fresh `tester` executed `test-plan.md` and ticked every box with evidence. Evidence: `b46d30c`, `test-results/webhook-wake/final-head.md`.
- [ ] **Reviewer:** a fresh `reviewer` returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`.
- [ ] **Security reviewer:** a fresh `security-reviewer` returned `Security verdict`.
- [ ] **Owner-run section:** the live checks are run by the owner; measured times recorded in the PR.
- [ ] **/open-pr:** gates passed; index rows and the ADR rows 0018 and 0019 in the same change; learnings sweep stated; PR opened.


## Refresh log (W0.0)

Diffed 2026-11-06 against `feat/agent-inbox-core` at `ce30912` and `origin/feat/agent-inbox-core-l1` to `-l5`.

| What the plan said | What the code is | Plan change |
|---|---|---|
| `../connection`, `../ports` imports | `libs/core/src/inbox/connection.ts`, `ports.ts`; `libs/core/src/index.ts` is `export * from './inbox'` | wake files import from `../inbox/...` |
| Adapters as classes | Factories: `createNoneWaker`, `createSqliteInboxRepository`, `createR2MediaStore`, `createFakeWhatsAppSender` | A30; every adapter and double is a `create…` factory |
| `account-inbox/wake-repository.ts` over Drizzle | `adapters/sqlite/sqlite-inbox-repository.ts` over `storage.sql` | `adapters/sqlite/sqlite-wake-repository.ts`, raw SQL |
| `libs/core/src/testing`, `@zapbip/core/testing` | Doubles live in `libs/core/src/inbox/testing/`, not exported to `apps/api`; core `package.json` has no `exports` | `libs/core/src/wake/testing/`, export `./wake-testing` (A11) |
| `DueTimeProvider` has `nextDueAt` | It has `nextDueAt()` and `runDue({now})`; `dueTimeProviders` is a protected array; `armAlarm` floors at `ALARM_MIN_DELAY_MS` (5 s) | A21, A23; the 3 s debounce is a floor, not the delay |
| `agent_wake` insert from `saveWake` | `INSERT OR IGNORE` by `registerAgent`; `last_polled_at NOT NULL` | A27; `saveWake` is an `UPDATE` |
| Tool registry in `mcp/tool-definitions.ts`, handler in `mcp/set-wake.ts` | `contract/tool-definitions.ts` (`McpToolName`, `TOOL_DEFINITIONS`) and `mcp/tool-handlers.ts` (`TOOL_HANDLERS satisfies Record<McpToolName, unknown>`) | A33; L3 adds enum, definition and handler together |
| `setWake` and dev RPCs on `AccountInboxRpc` | `AccountInbox implements AccountInboxRpc`; `DevAccountInboxRpc` has `readScreen`, `advanceClock` | A32; `wake-rpc.ts` |
| `recordRevocation` wake part in W2.4 | Slice 3 owns the RPC (`recordRevocation({agent})`) | A31 |
| E2E key in `vitest.e2e.config.mts` | `test/e2e/global-setup.ts` passes `--var` flags to `wrangler dev` | L5 owns the edit |
| `Bindings` | `ACCOUNT_INBOX, CONNECTIONS, MEDIA, MEDIA_LINK_SIGNING_KEY, UPLOAD_LINK_SIGNING_KEY, PUBLIC_ORIGIN` | additive: `WAKE_SECRET_KEY`, `WAKE_METRICS` |
| `ConnectionIdentity.ownerLocale`, `receiveOwnerMessage({ownerLocale, ...})`, `AgentWakeReason`, `WakeOutcome`, `WakeMode.None`, `WakeRung.Inbox`, `DevAccountInbox` exported as `AccountInbox` by `index.dev.ts`, `advanceClock` | Present | `(contract: confirm at build)` marks resolved |
| `WAKE_METRICS` binding in the top-level block | `wrangler.jsonc` top-level and `env.production` repeat bindings | the dataset goes in the top-level block only (cross-slice table, Wrangler environments: `deploy-readiness` repeats it per environment) |
| `spec.md` lines on `ManualClock` and `apps/api/test/support/test-account-inbox.ts` | Neither exists: the clock is `DurableClock` moved by `advanceClock`, and the test object is `DevAccountInbox` | A12 stands; the spec text is stale and is not edited here (the lead owns spec text) |
