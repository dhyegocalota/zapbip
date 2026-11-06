# Accounts and keys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the owner run the account lifecycle from WhatsApp: the first message creates the account (waitlisted or active), `novo agente`, `agentes`, `revogar`, `girar`, `ajuda` and `apagar conta` work in pt-BR and en, secrets are shown once and stored as digests, and abuse controls (blocklist, per-phone rate, per-connection and per-account outbound limits, daily cap, agent limit) protect the shared number.

**Architecture:** The core gains rule 0 (account commands) and an account-state gate in front of agent-inbox-core's routing rules 1 to 6, pure parsers and copy in `libs/core/src/accounts/`, and use cases behind ports. The Worker runs the sender guard and the account lookup before the owner's `AccountInbox` Durable Object, which applies the state gate, rule 0 or the routing rules, and keeps a tombstone after purge. D1 holds the directory and the blocklist; the Rate Limiting binding holds the counters; R2 holds media under `accounts/<accountId>/media/`.

**Tech Stack:** Node 24, TypeScript, pnpm workspaces, Vitest (`libs/core` 5.0.5, `apps/api` 4.1.12, `@cloudflare/vitest-pool-workers` 0.23.0), Cloudflare Workers, D1, R2, Durable Objects, Rate Limiting binding, Mintlify (`mint` 4.2.1207). **No new dependency.**

**Spec:** `docs/features/accounts-and-keys/spec.md` (lands with the branch by the lead). Decisions in this plan's **Assumptions** are `owner delegated 2026-11-06` and bind over the spec where they differ. Binding cross-slice rules: `SCRATCH/feature-stash/cross-slice-decisions.md`.

**Build order:** branch from `main` once `agent-inbox-core` is merged, in parallel with `whatsapp-cloud-channel`. Merge coordination is in **Sequencing**.

## Global Constraints

- Migration `0002_accounts_and_keys.sql` follows the spec's **Data model**, with the rebuild settled against slice 1's `0001_core` (it also rebuilds `message_index`, see Plan refresh). An applied migration is never edited; from the first deploy on, migrations are immutable (cross-slice).
- Secret: `zb_conn_` plus 43 base64url characters of 32 random bytes (`CONNECTION_SECRET_PATTERN`). Digest: SHA-256 hex of the full secret string (`hashConnectionSecret`, slice 1; the generator is slice 1's `generateConnectionSecret`). Secrets never reach a log, a D1 row, a Durable Object row or a fixture file.
- Time constants come from `libs/types` (`SECOND_MS`, `MINUTE_MS`, `DAY_MS`). No local copies.
- Owner-facing text is copy (`account-copy.ts`, `pt_BR` and `en_US` for every key). No inline copy.
- `WAITLIST_ENABLED` is `'true'` or `'false'`, read through `isWaitlistEnabled`, which throws on any other value, including a missing one. Workers have no environment at module scope, so the check runs per request in the Worker's fetch path only (A6); the Durable Object does not read the flag.
- Rate limits are configured in `wrangler.jsonc` `ratelimits`; a unit test ties them to the constants.
- Base URL: `PUBLIC_ORIGIN` (slice 1). `PUBLIC_BASE_URL` is never used.
- Wrangler environments: the top-level block is development; `env.production` repeats every binding (`env.staging` arrives with deploy-readiness). Tests for bundles run with `--env production`.
- Repo rules (`AGENTS.md`): no comments except `// NB ADR NNNN:`; flat `if`s; no `else`; no `??` defaults; enums over string literals; named parameters for more than one parameter; constants over literals; no `.js` import suffix; no acronyms in identifiers (`connectionLink`, not `connectionUrl` or `mcpUrl`; `waId` is kept because it is Meta's field name, A5); type everything.
- No `sleep`. Time in tests comes from the fake `Clock` (core) or `runDurableObjectAlarm` and the pool's `runInDurableObject` (Worker).
- Red-first: a red commit holds only failing tests and the stubs for new members. A test green on arrival is labelled `pin` in the test plan and in its red commit message.
- Docs ownership: the lead owns `docs/features/**`, the ADR files, both indexes and status flips. Lanes never edit them. Lanes return their tester-briefing text to the lead.
- Commits: Conventional Commits, en-US, `Co-Authored-By` trailer. Never `git add -A`, `git add .`, `--no-verify`; never on `main`.
- No test uses a real credential or a third-party network. Meta, Rate Limiting and WhatsApp are faked at their ports.

## Review Focus

1. A command word the owner quotes from an agent's message is routed to that agent, never run as a command. Owned by S1a.1 (`command.test.ts`) and S1b.1 (`receive-account-message.test.ts`).
2. Two first messages from one phone yield one account; twenty concurrent creates for the last slot yield exactly `AGENTS_PER_ACCOUNT_LIMIT` connections. Owned by S2.1 (`d1-accounts.test.ts`, `d1-connections-lifecycle.test.ts`).
3. A failed send of part 2 of 3 of a create or rotate reply runs the compensation: the new link never works, the old one works again after a rotate, and the owner gets the `SendFailed` reply. Owned by S1b.1 and S1b.3 (`receive-account-message.test.ts`).
4. A blocked phone, or an owner over `OWNER_MESSAGES_PER_MINUTE`, is dropped silently: no account change, no window opened, the D1 blocklist read first. Owned by S2.2 (`sender-guard.test.ts`) and S4.1 (`owner-inbound.test.ts`).
5. An interrupted deletion finishes through the next owner message or the daily sweep, and ends with no D1 row, no R2 object under the prefix, no Durable Object storage beyond the tombstone, and no `zb_conn_` value in D1. Owned by S1b.2 (`delete-account.test.ts`) and S3.1 (`account-inbox-purge.test.ts`).

## Assumptions (decided, owner can override)

All are `owner delegated 2026-11-06`.

- **A1 Simulator keyed by owner phone.** `POST /dev/owner/:phone/messages`, `GET /dev/owner/:phone/screen`, `POST /dev/owner/:phone/clock`, mounted only by `index.dev.ts` (they exist in slice 1's `routes/dev-owner.ts`; L4 makes an unknown phone create its account through the production inbound path instead of answering 404). This follows the consistency pass (`PROGRESS.md`) and replaces the spec's `/dev/c/:secret/...` rows: a connection cannot exist before the first message, so a secret-keyed simulator cannot bootstrap. The spec's rows and its decision table are corrected in the spec by the lead.
- **A2 `dev:seed` removed.** ~~`dev:seed` and `apps/api/scripts/create-dev-connection.ts` are deleted in S2.3.~~ Refreshed: `dev:seed`, `apps/api/scripts/dev-seed.ts`, `apps/api/scripts/build-directory-seed.ts` and `apps/api/test/integration/dev-seed.test.ts` are deleted in S2.3 (the real names). Development accounts come from the simulator's first message with `WAITLIST_ENABLED` `'false'`.
- **A3 Secret lookup.** `ConnectionDirectory.resolveSecretDigest({secretDigest})`, column `secret_digest` (slice 1). The order is fixed: (1) a value failing `CONNECTION_SECRET_PATTERN` returns `null` with no D1 read; (2) otherwise the digest is hashed and looked up by equality in D1, joined with `accounts`, returning `null` unless the account is `active` and the connection is not revoked. No `timingSafeEqual` (decision 14): the lookup is an indexed equality on a digest, and nothing compares secrets in application code.
- **A4 Agent name length.** The pattern and length are slice 1's `AGENT_NAME_PATTERN` and `AGENT_NAME_MAX_CHARS`. ~~The spec says 32; the core review says 20.~~ Settled at refresh: 20. This slice never writes a length literal.
- **A5 `wa_id`.** Digits only, as Meta sends it. `owner_identities.wa_id` and `blocked_phones.wa_id` hold it. Operator commands validate it as digits only (`^[0-9]{8,15}$`) before any SQL (A24).
- **A6 Waitlist flag (review item 16).** `isWaitlistEnabled({value})` returns `true` for `'true'`, `false` for `'false'`, and throws for anything else, including `undefined`. Workers have no environment at module scope, so a bad value does not fail at import: it makes every request throw, `/health` included, until the value is fixed. The check runs per request in the Worker's fetch handler, before routing. The Durable Object constructor does not read the flag (the Worker passes the account state in).
- **A7 Deletion and resume (decision 5).** Four states are read by the Worker. The account object keeps only a tombstone after `purge()`; write methods throw `AccountTombstoned` on a tombstone. Two different resumes exist:
  - **Un-suspend (`resumeSuspendedAccount`):** operator `resume`. Sets `suspended` to `active`. Any other state is a refusal (zero rows changed, the script reports it). It never touches `deleting`.
  - **Finish deletion (`finishAccountDeletion`):** runs the deletion steps from state `deleting`: purge (idempotent; tombstone), R2 `deletePrefix`, then the D1 batch. Triggered by an owner message to a `deleting` account, by the operator's `delete`, and by the **daily sweep**, which lists every `deleting` account and finishes each one. The sweep runs in the existing daily cron handler; no hourly fan-out (cross-slice). Each step is idempotent; a completed account is absent from D1 and is not listed.
- **A8 Suspended replies each time.** Each owner message to a `suspended` account gets one `Suspended` reply; nothing is stored or routed.
- **A9 Connection link.** The use case builds `connectionLink = PUBLIC_ORIGIN + '/c/' + secret + '/mcp'`. The install prompt renderer gets `connectionLink`.
- **A10 Non-text first message (review item 18).** A first message whose kind is not text creates the account, is not stored, and gets `Unknown`. For a `waitlisted` account the `Waitlisted` reply wins. `isFirstMessage` is durable: the account object stores `first_message_id`, the channel message id of the first message it handles, ~~in the same storage transaction that records the reply~~ (refreshed: a Durable Object transaction cannot span a use case's awaits). `FirstMessageClaim.claim` inserts the id when none is stored and returns whether the stored id equals this message's, so a retry of the same delivery is still treated as the first message and is not stored or routed. Any other message after that sees `isFirstMessage: false`.
- **A11 Partial commands (decision 12; review item 17).** Names are free text, so `girar a imagem`, meant for an agent, is read as a rotate of the name `a-imagem` and gets `NotFound`. The escape is the mention form `@<agent> girar a imagem` (rule 3), which routes the text to that agent with the prefix removed. ADR 0015 records this trade-off (the lead edits the ADR), and the `commands` guide page states it with the escape example.  `novo` alone and `agente` alone are not commands; they route as messages. `novo agente` with an empty name, and `revogar` or `girar` with an empty name (alone or with spaces), reply `Usage`. A reserved name in `revogar` or `girar` replies `NotFound`.
- **A12 Menu ids (decision 6).** Exactly six list ids are commands: `zapbip:create_agent`, `zapbip:list_agents`, `zapbip:revoke_agent`, `zapbip:rotate_agent`, `zapbip:help`, `zapbip:request_deletion`. Any other `zapbip:` id, including `zapbip:confirm_deletion`, maps to `CommandKind.Unknown` and gets `Unknown`. Question ids start with `q_`, so they never collide.
- **A13 Account creation, no orphan.** `findOrCreateByWaId` is one D1 batch: (1) `INSERT INTO accounts ... SELECT ... WHERE NOT EXISTS (SELECT 1 FROM owner_identities WHERE wa_id = ?) AND (SELECT COUNT(*) FROM accounts WHERE created_at > ?) < ?`; (2) `INSERT INTO owner_identities ... ON CONFLICT(wa_id) DO NOTHING`. A second batch for the same `wa_id` sees the identity and inserts no account.
- **A14 Window.** The window opens for every accepted owner message, including commands and the first message (agent-inbox-core).
- **A15 Logs.** `logEvent({event, fields})`. `LogFields` has only ids, kinds, locales and counts: no phone, secret, digest, agent name or text. The MCP route logs `/c/:secret/mcp`.
- **A16 Limits.** Per phone: Rate Limiting `OWNER_RATE_LIMITER` keyed by `waId`, 20 per minute. Per connection: `OUTBOUND_RATE_LIMITER` keyed by `connectionId`, 30 per minute. Per account (decision 15, new): `ACCOUNT_OUTBOUND_RATE_LIMITER` keyed by `accountId`, `ACCOUNT_OUTBOUND_MESSAGES_PER_MINUTE` = 120 (the value is a decision; the owner can change it). The outbound check admits only when both the connection and the account pass. Only `send_*`, `react` and `ask` count.
- **A17 No new dependency.**
- **A18 Locale (cross-slice).** `OwnerLocale` is an account property set at creation: `pt_BR` when `wa_id` starts with `55`, `en_US` otherwise. Commands do not change it. A command's reply uses the keyword's language (spec table); other replies use the account's locale. `setLocale` is not in the port.
- **A19 Deletion request (decision 6).** `apagar conta` (or `delete account`) stores `deletion_requested_at` in the account object's storage through `DeletionRequests.save` and replies `DeletionRequest` with the phrase. The phrase `apagar conta definitivamente` (or `delete account permanently`) is accepted only while `now - deletion_requested_at <= DELETION_CONFIRM_TTL_MS` (10 minutes). Otherwise it replies `DeletionExpired` and deletes nothing. The confirmation is the phrase or nothing else; the menu row for deletion only starts a request.
- **A20 ConfirmDeletion states (decision 2).** `ConfirmDeletion` is allowed in `waitlisted` and `active`. `suspended` gets `Suspended`; `deleting` is dropped (the Worker finishes the deletion).
- **A21 Compensation and reply parts (decision 3).** `AccountCommandResult.compensation` is `{connectionId, agent, oldDigest, newDigest}` when a connection was written, else `null`. `oldDigest` is `null` for a create (the compensation revokes the row) and the previous digest for a rotate (the compensation compare-and-sets back). `receiveOwnerMessage` sends the reply parts in order; if any part fails, it runs the compensation, then sends one `SendFailed` reply on a best-effort basis. Nothing is sent after the failure.
- **A22 Revocation (decision 4, corrected by the orchestrator).** Revoke calls `ConnectionRevocations.recordRevocation({accountId, agent})`: it clears that agent's wake state (`WakeRepository.clearWake`: setting, sealed target, jobs; slices 4 and 7 implement their parts), cancels that agent's live waiters (`ReplyWaiters.cancelAgent`, a new member: a held `ask` or `wait_for_reply` ends at once with `ReplyStatus.Timeout`), and marks the agent revoked for standby selection. Rotate does **not** call `recordRevocation`: it keeps the wake setting and calls only `ConnectionRevocations.cancelWaiters({accountId, agent})`, which cancels the agent's live waiters. Both are exposed on the account object as RPCs (`recordRevocation`, `cancelWaiters`) for the Worker. L3 adds `ReplyWaiters.cancelAgent({agent})` to slice 1's interface and `createReplyWaiters`; core never calls it.
- **A23 Install prompt parts (decision 10).** The prompt splits on line boundaries. Each part has a label line `i/n` whose length is fixed by `PART_LABEL_BUDGET_CHARS` (16, counting the newline), so a part's text is at most `WHATSAPP_TEXT_MAX_CHARS - PART_LABEL_BUDGET_CHARS`. A line never splits. The link line is one line and never splits; a link line longer than the budget throws. Empty input throws.
- **A24 Operator script (decision 15).** `apps/api/scripts/operator-account.sh <command> <wa_id>` (commands: `enable`, `suspend`, `resume`, `block`, `unblock`, `delete`). It validates `wa_id` as digits only (`^[0-9]{8,15}$`), refuses otherwise, and runs one fixed SQL statement through `wrangler d1 execute` per command. The runbook says to block and suspend together for an abusive phone. `delete` sets `deleting`; the daily sweep finishes it.
- **A25 Parallel build (cross-slice).** Built in parallel with `whatsapp-cloud-channel`. `whatsapp-cloud-channel` also plans `apps/api/src/adapters/d1/d1-account-directory.ts` (`findByWaId`, `findOwnerByAccountId`); this slice creates the same path with `D1AccountDirectory`, and the second slice to merge keeps both sets of methods (`(contract: confirm at merge)`). `OwnerLocale` is in `libs/types`, created by slice 1 (settled).
- **A26 Plan refresh (first step).** The plan is diffed against `main` and the merged slice 1 before any lane starts: paths, names, exports and migration numbers. ~~Items marked `(contract: confirm at build)` are settled then.~~ Done 2026-11-06 against slice 1's Step 0 and its lane branches; see **Plan refresh**. Remaining marks are `(contract: confirm at merge)`.

## Plan refresh (S0.0), 2026-11-06

Diffed against `feat/agent-inbox-core` (Step 0 contract, `ce30912`) and the lane branches `origin/feat/agent-inbox-core-l2`, `-l3`, `-l4a`, `-l4b` (the furthest, 129 files). `ReplyWaiters`, `CoreDependencies`, `MediaStore`, `ConnectionDirectory`, the DO and the D1 adapters are rewritten by those lanes, so this slice adds new files and new interfaces instead of editing slice 1's members. Every `(contract: confirm at build)` mark is settled below. The superseded text of the old Contract is in git history (commit `docs(accounts-and-keys): spec, plan, test plan and ADRs`).

| Old (plan as authored) | Refreshed | Why |
|---|---|---|
| ~~`libs/core/src/enums.ts`~~ | `libs/types/src/enums.ts` | Slice 1 keeps every runtime enum in `libs/types`; core imports them from `@zapbip/types` |
| ~~`libs/core/src/{constants,ports,index}.ts` (appended)~~ | `libs/core/src/accounts/{constants,ports,index}.ts` (new) plus one `export * from './accounts'` line in `libs/core/src/index.ts` | Slice 1's files are `libs/core/src/inbox/**`; new files do not collide with lanes |
| ~~`libs/core/src/use-cases/*`~~, ~~`libs/core/src/testing/in-memory.ts`~~ | `libs/core/src/accounts/use-cases/*`; `libs/core/src/accounts/testing/in-memory-accounts.ts` composes slice 1's `libs/core/src/inbox/testing/in-memory.ts` (`createInMemoryDependencies`) | Same reason; tests are colocated as `*.test.ts` beside the source (slice 1 pattern) |
| ~~`SECRET_PREFIX`, `SECRET_RANDOM_BYTES`, `CONNECTION_SECRET_PATTERN` in core~~ | Slice 1's `CONNECTION_SECRET_PREFIX`, `CONNECTION_SECRET_BYTES`, `CONNECTION_SECRET_PATTERN` in `apps/api/src/contract/constants.ts` | Already exist; no duplicate |
| ~~`Digests` and `RandomSource` ports~~ | Dropped. `ConnectionSecrets.issue()` is the adapter `apps/api/src/adapters/platform/connection-secrets.ts` over slice 1's `generateConnectionSecret` and `hashConnectionSecret` | Both helpers exist; core never hashes |
| ~~`ConnectionDirectory` extended with `register`, `revoke`, `rotate`, `listActive`~~ | New port `ConnectionRegistry` (writes) in `accounts/ports.ts`; slice 1's `ConnectionDirectory.resolveSecretDigest` keeps its shape and only its D1 body changes (`state = 'active'`, `revoked_at IS NULL`) | Slice 1's `D1ConnectionDirectory` is rewritten by its lane; an interface change would break its merge |
| ~~`MediaStore.deletePrefix`~~ | New port `AccountMediaPurge.deleteAll({accountId})`, adapter `apps/api/src/adapters/r2/r2-account-media.ts` | `createR2MediaStore` is an object literal typed `MediaStore`; the key shape `accounts/<accountId>/media/<mediaId>` is already slice 1's |
| ~~`ReplyWaiters.cancelAgent` in Step 0~~ | L3 adds `cancelAgent({agent})` to `ReplyWaiters` and `createReplyWaiters` (slice 1 files) when it implements `recordRevocation`; core use cases only see `ConnectionRevocations` | `waiters.ts` is rewritten by a slice 1 lane; Step 0 must not touch it |
| ~~`CoreDependencies` gains accounts, connections, digests, secrets, renderer, revocations~~ | `AccountDependencies = CoreDependencies & {...}` and `AccountLifecycleDependencies` in `accounts/ports.ts`; slice 1's `CoreDependencies` already carries `accountId` | No edit to slice 1's type or its in-memory builder |
| ~~`receiveOwnerMessage` changed in place (slice 1 file)~~ | New `receiveAccountMessage` in `accounts/use-cases/` runs the state gate and rule 0, then calls slice 1's `receiveOwnerMessage` for rules 1 to 6. L1b adds one additive export of `flushQueue` from `libs/core/src/inbox/index.ts` so a command can open the window and flush the queue (A14) | Slice 1's `receiveOwnerMessage` has its own input (`ownerLocale`, `channelMessageId`) and result (`duplicate`); `ReceiveResult` is reused |
| ~~`isFirstMessage` passed in, stored "in the same transaction as the reply" (A10)~~ | Port `FirstMessageClaim.claim({channelMessageId}): Promise<boolean>` (true when this id is, or becomes, the first). The DO implements it with an insert-or-ignore then a read; the ids compare equal on a retry | A Durable Object transaction cannot span the awaits of a use case |
| ~~`requestedAt` read by the caller (A19), `requestDeletion` RPC~~ | Port `DeletionRequests` (`save({requestedAt})`, `find()`) in `AccountDependencies`; the use cases read `clock.now()`. The `requestDeletion` RPC is dropped | The use case owns the TTL rule end to end |
| ~~`apps/api/src/contract/account-inbox-rpc.ts` (changes)~~ | New `apps/api/src/contract/account-owner-rpc.ts` (`AccountOwnerRpc`); L3 adds the methods to `AccountInbox` | The class is rewritten by slice 1's lane |
| ~~`apps/api/src/logging/log-event.ts`~~ | Additive `LogEvent` values and `LogFields` keys in `apps/api/src/contract/log.ts`; slice 1's `logEvent(fields: LogFields)` is called | Slice 1 has `contract/log.ts` and `src/log.ts` |
| ~~`apps/api/src/adapters/d1/schema.ts` and `drizzle-kit check`~~ | Hand-written `apps/api/migrations/0002_accounts_and_keys.sql`, prepared statements, as slice 1 does (its `no-interpolated-sql` test applies). No Drizzle schema file | Slice 1 has no Drizzle schema and no `drizzle.config` |
| ~~`0002` drops `owner_identities`, `connections`, `accounts`~~ | `0002` also drops and recreates `message_index` with its `0001` definition, first | `message_index.account_id` references `accounts`; D1 enforces foreign keys and a parent drop fails when child rows exist |
| ~~`apps/api/src/adapters/{sender-guard,outbound-guard,random-source,generic-install-prompt}.ts`, `d1-connection-directory.ts`, `r2-media-store.ts`~~ | `apps/api/src/adapters/guard/{sender-guard,outbound-guard}.ts`, `adapters/prompt/generic-install-prompt.ts`, `adapters/d1/d1-account-directory.ts`, `adapters/d1/d1-connection-registry.ts`, `adapters/d1/d1-connection-directory.ts` (body only), `adapters/r2/r2-account-media.ts`, `adapters/platform/connection-secrets.ts` | Slice 1 groups adapters by technology (`d1`, `r2`, `platform`, `fake`, `sqlite`, `wake`) |
| ~~`apps/api/src/routes/webhook.ts` (slice 2)~~ | `apps/api/src/routes/whatsapp.ts` per slice 2's plan | `(contract: confirm at merge)`: slice 2 is unmerged; the lead confirms the name when merging |
| ~~`d1-account-directory.ts` extends slice 2's file~~ | This slice creates `d1-account-directory.ts` with `D1AccountDirectory`; slice 2's plan creates the same path with `findByWaId` and `findOwnerByAccountId`. Whoever merges second keeps both sets of methods | `(contract: confirm at merge)`: a predictable add/add conflict, for the lead |
| ~~`apps/api/src/scheduled.ts` (daily sweep call)~~ | `apps/api/src/accounts/deletion-sweep.ts` exports `sweepDeletingAccounts({environment})`; the cron dispatch is deploy-readiness's `operations/scheduled.ts`. The second slice to merge adds `ScheduledJob.DeletionSweep` there | `scheduled.ts` is not in slice 1; deploy-readiness owns the dispatch. Test renamed `deletion-sweep.test.ts` |
| ~~`dev:seed`, `create-dev-connection.ts`, `connection-secret.test.ts` deleted (A2)~~ | L2 deletes `apps/api/scripts/dev-seed.ts`, `apps/api/scripts/build-directory-seed.ts`, `apps/api/test/integration/dev-seed.test.ts` and the `dev:seed` script; slice 1's `apps/api/test/unit/connection-secret.test.ts` stays (the generator is reused) | The real file names |
| ~~`apps/api/test/support/factories.ts`~~ | L3 extends slice 1's `apps/api/test/support/builders.ts` | One builder module |
| ~~`env.staging` repeats bindings~~ | The file has the development block and `env.production` only; this slice edits both. Deploy-readiness adds staging | Real `wrangler.jsonc` |
| ~~`LIST_ROW_TITLE_MAX_CHARS`, `WHATSAPP_TEXT_MAX_CHARS`, `AGENT_NAME_*` "confirm"~~ | Settled: `libs/core/src/inbox/constants.ts` has `WHATSAPP_TEXT_MAX_CHARS` 4096, `LIST_ROW_TITLE_MAX_CHARS` 24, `AGENT_NAME_MAX_CHARS` 20, `AGENT_NAME_PATTERN` `/^[a-z0-9][a-z0-9-]{0,19}$/` (A4: 20 characters, lowercase, digits and hyphen) | |
| ~~`OwnerLocale` created by whichever slice merges first~~ | Settled: slice 1's `libs/types/src/enums.ts` has it (`PortugueseBrazil` `pt_BR`, `EnglishUs` `en_US`) | |
| ~~Simulator `POST /dev/owner/:phone/messages` is new (A1)~~ | Slice 1 already has the phone-keyed routes in `apps/api/src/routes/dev-owner.ts`, 404 for an unknown phone. L4 changes that file so the first message from an unknown phone creates the account through the production inbound path | Real code |

Settled marks: `scheduled.ts` (not in slice 1), `d1-account-directory.ts` (new here, conflicts with slice 2), `ReplyWaiters` (no `cancelAgent` yet), migration numbers (`0001_core` exists; `0002` ours), `OwnerLocale` (exists). Still open until the merge: the slice 2 route name and the `ScheduledJob` wiring.

## Contract (Step 0, verbatim)

Step 0 lands these signatures and stubs in one serial lane. Stubs for **new members only** are `void input;` followed by `throw new Error('<name> is not implemented');`. No existing slice 1 member is stubbed or changed. Every later lane builds against them. A signature change after Step 0 is a new Step 0 commit that every lane merges.

### `libs/types/src/enums.ts` (appended)

```ts
export enum AccountState { Waitlisted = 'waitlisted', Active = 'active', Suspended = 'suspended', Deleting = 'deleting' }
export enum CommandKind {
  CreateAgent = 'create_agent', ListAgents = 'list_agents', RevokeAgent = 'revoke_agent', RotateAgent = 'rotate_agent',
  Help = 'help', RequestDeletion = 'request_deletion', ConfirmDeletion = 'confirm_deletion', Unknown = 'unknown',
}
export enum SenderVerdict { Admitted = 'admitted', Blocked = 'blocked', RateLimited = 'rate_limited' }
export enum RegisterOutcome { Registered = 'registered', LimitReached = 'limit_reached', NameTaken = 'name_taken' }
export enum AccountStateOutcome { Proceed = 'proceed', Reply = 'reply', Drop = 'drop' }
export enum ReplyKind { Text = 'text', List = 'list' }
export enum AccountReplyIntent {
  Waitlisted = 'waitlisted', Suspended = 'suspended', Created = 'created', InvalidName = 'invalid_name', ReservedName = 'reserved_name',
  NameTaken = 'name_taken', LimitReached = 'limit_reached', NotFound = 'not_found', Revoked = 'revoked', Rotated = 'rotated',
  Listed = 'listed', EmptyList = 'empty_list', Usage = 'usage', Menu = 'menu', DeletionRequest = 'deletion_request',
  DeletionExpired = 'deletion_expired', DeletionDone = 'deletion_done', SendFailed = 'send_failed', Unknown = 'unknown',
}
export enum AccountReplyParameter {
  AgentName = 'agent_name', Limit = 'limit', Usage = 'usage', Phrase = 'phrase', Agents = 'agents', InstallPrompt = 'install_prompt',
}
```

Additive values in existing enums: `IdPrefix.Account = 'acc'`, `IdPrefix.Connection = 'con'`, `RoutingRule.AccountCommand = 'account_command'`. (Written one member per line in the file; shown compact here.)

### `libs/core/src/accounts/constants.ts` (new; time units from `@zapbip/types`)

```ts
import { DAY_MS, MINUTE_MS } from '@zapbip/types';

export const AGENTS_PER_ACCOUNT_LIMIT = 8;
export const OWNER_MESSAGES_PER_MINUTE = 20;
export const OUTBOUND_MESSAGES_PER_MINUTE = 30;
export const ACCOUNT_OUTBOUND_MESSAGES_PER_MINUTE = 120;
export const RATE_LIMIT_PERIOD_MS = MINUTE_MS;
export const NEW_ACCOUNTS_PER_DAY_LIMIT = 50;
export const NEW_ACCOUNTS_WINDOW_MS = DAY_MS;
export const DELETION_CONFIRM_TTL_MS = 10 * MINUTE_MS;
export const PART_LABEL_BUDGET_CHARS = 16;
export const COMMAND_LIST_ID_PREFIX = 'zapbip:';
export const LIST_BUTTON_TEXT_MAX_CHARS = 20;
export const BRAZIL_COUNTRY_CODE = '55';
```

`WAITLIST_FLAG_VALUES` lives in `apps/api/src/config/waitlist-enabled.ts` (L4); it is a Worker concern. `WHATSAPP_TEXT_MAX_CHARS`, `LIST_ROW_TITLE_MAX_CHARS`, `AGENT_NAME_PATTERN` and `AGENT_NAME_MAX_CHARS` are slice 1's (`libs/core/src/inbox/constants.ts`). The media key prefix is slice 1's (`accounts/<accountId>/media/`), built in the R2 adapters.

### `libs/core/src/accounts/command-words.ts` (data, written in full)

```ts
import { CommandKind, OwnerLocale } from '@zapbip/types';

export type CommandWord = { kind: CommandKind; locale: OwnerLocale; words: string; takesName: boolean };

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
  CommandKind.CreateAgent, CommandKind.ListAgents, CommandKind.RevokeAgent,
  CommandKind.RotateAgent, CommandKind.Help, CommandKind.RequestDeletion,
];
```

### `libs/core/src/accounts/account-types.ts`

```ts
import type { AccountReplyIntent, AccountReplyParameter, AccountState, AccountStateOutcome, CommandKind, OwnerLocale, ReplyKind } from '@zapbip/types';
import type { AgentName } from '../inbox/connection';

export type AccountRecord = { accountId: string; waId: string; state: AccountState; locale: OwnerLocale };
export type AccountLookup = { account: AccountRecord; created: boolean };
export type ConnectionRecord = { connectionId: string; accountId: string; agent: AgentName; secretDigest: string; createdAt: number };
export type OwnerAccountContext = { accountId: string; waId: string; state: AccountState; locale: OwnerLocale };
export type AccountCommand = { kind: CommandKind; rawName: string | null; locale: OwnerLocale };
export type MenuRow = { id: string; title: string };
export type AccountReply = {
  intent: AccountReplyIntent;
  kind: ReplyKind;
  locale: OwnerLocale;
  parameters: Partial<Record<AccountReplyParameter, string>>;
  menuRows: MenuRow[];
};
export type AccountCompensation = { connectionId: string; agent: AgentName; oldDigest: string | null; newDigest: string };
export type AccountCommandResult = { replies: AccountReply[]; compensation: AccountCompensation | null; deletionConfirmed: boolean };
export type IssuedSecret = { secret: string; digest: string };
export type CommandInput = { text: string | null; listReplyId: string | null; isQuoting: boolean };
export type AccountStateVerdict = { outcome: AccountStateOutcome; intent: AccountReplyIntent | null };
```

### `libs/core/src/accounts/ports.ts` (new)

```ts
export interface AccountDirectory {
  findByWaId(input: { waId: string }): Promise<AccountRecord | null>;
  findOrCreateByWaId(input: {
    waId: string; accountId: string; initialState: AccountState; locale: OwnerLocale; createdAt: number;
    newAccountsCap: { since: number; limit: number };
  }): Promise<AccountLookup | null>;
  setState(input: { accountId: string; state: AccountState }): Promise<void>;
  listByState(input: { state: AccountState }): Promise<AccountRecord[]>;
  remove(input: { accountId: string }): Promise<void>;
}

export interface ConnectionRegistry {
  register(input: { connection: ConnectionRecord; activeLimit: number }): Promise<RegisterOutcome>;
  findActiveByAgent(input: { accountId: string; agent: AgentName }): Promise<ConnectionRecord | null>;
  listActive(input: { accountId: string }): Promise<ConnectionRecord[]>;
  revoke(input: { accountId: string; agent: AgentName; revokedAt: number }): Promise<boolean>;
  rotate(input: { accountId: string; agent: AgentName; fromDigest: string; toDigest: string; rotatedAt: number }): Promise<boolean>;
}

export interface ConnectionSecrets { issue(): Promise<IssuedSecret> }
export interface InstallPromptRenderer {
  render(input: { accountId: string; agent: AgentName; connectionLink: string; locale: OwnerLocale }): Promise<string>;
}
export interface SenderGuard { admit(input: { waId: string }): Promise<SenderVerdict> }
export interface OutboundGuard { admit(input: { accountId: string; connectionId: string }): Promise<SenderVerdict> }
export interface ConnectionRevocations {
  recordRevocation(input: { accountId: string; agent: AgentName }): Promise<void>;
  cancelWaiters(input: { accountId: string; agent: AgentName }): Promise<void>;
}
export interface AccountInboxPurge { purge(): Promise<void> }
export interface AccountMediaPurge { deleteAll(input: { accountId: string }): Promise<void> }
export interface FirstMessageClaim { claim(input: { channelMessageId: string }): Promise<boolean> }
export interface DeletionRequests {
  save(input: { requestedAt: number }): Promise<void>;
  find(): Promise<number | null>;
}

export type AccountDependencies = CoreDependencies & {
  accounts: AccountDirectory;
  connections: ConnectionRegistry;
  connectionSecrets: ConnectionSecrets;
  installPromptRenderer: InstallPromptRenderer;
  revocations: ConnectionRevocations;
  firstMessage: FirstMessageClaim;
  deletionRequests: DeletionRequests;
};

export type AccountLifecycleDependencies = {
  accounts: AccountDirectory;
  accountMedia: AccountMediaPurge;
  ids: IdGenerator;
};
```

`OutboundGuard` keys the connection and the account limiters; `SenderGuard` reads the D1 blocklist, then the binding. `ConnectionRevocations` is implemented by the Durable Object and passed explicitly; `AccountInboxPurge` likewise.

### `libs/core/src/accounts/*` (signatures; new files, stubs)

```ts
export function parseAccountCommand(input: CommandInput): AccountCommand | null;             // command.ts (L1a)
export function normalizeAgentName(input: { rawName: string }): string | null;               // agent-name.ts (L1a)
export function isReservedAgentName(input: { name: string }): boolean;                       // agent-name.ts (L1a)
export function splitInstallPrompt(input: { prompt: string }): string[];                     // install-prompt-parts.ts (L1a), A23
export function renderAccountReply(input: { reply: AccountReply }): string;                  // account-copy.ts (L1a)
export function buildMenuRows(input: { locale: OwnerLocale }): MenuRow[];                    // account-copy.ts (L1a)
export function evaluateAccountState(input: {
  state: AccountState; command: AccountCommand | null; isFirstMessage: boolean; isText: boolean;
}): AccountStateVerdict;                                                                      // state-gate.ts (L1b)
```

### `libs/core/src/accounts/use-cases/types.ts` (new)

```ts
export type OwnerAccountInput = { dependencies: AccountDependencies; account: OwnerAccountContext; publicOrigin: string };
export type ApplyOwnerCommandInput = OwnerAccountInput & { command: AccountCommand };
export type CreateAgentConnectionInput = OwnerAccountInput & { rawName: string };
export type RevokeAgentConnectionInput = OwnerAccountInput & { rawName: string };
export type RotateAgentConnectionInput = OwnerAccountInput & { rawName: string };
export type ListAgentConnectionsInput = OwnerAccountInput;
export type RequestAccountDeletionInput = OwnerAccountInput;
export type ConfirmAccountDeletionInput = OwnerAccountInput;
export type OpenOwnerAccountInput = { dependencies: AccountLifecycleDependencies; waId: string; waitlistEnabled: boolean; createdAt: number };
export type FinishAccountDeletionInput = { dependencies: AccountLifecycleDependencies; accountId: string; inboxPurge: AccountInboxPurge };
export type FinishDeletingAccountsInput = {
  dependencies: AccountLifecycleDependencies;
  inboxPurgeFor: (input: { accountId: string }) => AccountInboxPurge;
};
export type ResumeSuspendedAccountInput = { dependencies: AccountLifecycleDependencies; accountId: string };
export type ReceiveAccountMessageInput = {
  dependencies: AccountDependencies;
  account: OwnerAccountContext;
  channelMessageId: string;
  ownerMessage: OwnerInboundMessage;
  publicOrigin: string;
};
export type ReceiveAccountMessageResult = ReceiveResult & { deletionConfirmed: boolean };
```

### `libs/core/src/accounts/use-cases/*.ts` (signatures; stubs)

```ts
export function openOwnerAccount(input: OpenOwnerAccountInput): Promise<OwnerAccountContext | null>; // null: daily cap
export function applyOwnerCommand(input: ApplyOwnerCommandInput): Promise<AccountCommandResult>;
export function createAgentConnection(input: CreateAgentConnectionInput): Promise<AccountCommandResult>;
export function listAgentConnections(input: ListAgentConnectionsInput): Promise<AccountCommandResult>;
export function revokeAgentConnection(input: RevokeAgentConnectionInput): Promise<AccountCommandResult>;
export function rotateAgentConnection(input: RotateAgentConnectionInput): Promise<AccountCommandResult>;
export function requestAccountDeletion(input: RequestAccountDeletionInput): Promise<AccountCommandResult>;
export function confirmAccountDeletion(input: ConfirmAccountDeletionInput): Promise<AccountCommandResult>;
export function finishAccountDeletion(input: FinishAccountDeletionInput): Promise<void>;
export function finishDeletingAccounts(input: FinishDeletingAccountsInput): Promise<void>;
export function resumeSuspendedAccount(input: ResumeSuspendedAccountInput): Promise<boolean>;
export function receiveAccountMessage(input: ReceiveAccountMessageInput): Promise<ReceiveAccountMessageResult>;
```

`receiveAccountMessage` returns `messageId` `null` for a command or a state drop; the rule 1 to 6 results are slice 1's, unchanged. `ConfirmAccountDeletion` finds no pending request when `deletionRequests.find()` is `null` and replies `DeletionExpired`.

### `apps/api/src/contract/env.ts` (additions)

```ts
WAITLIST_ENABLED: string;
OWNER_RATE_LIMITER: RateLimit;
OUTBOUND_RATE_LIMITER: RateLimit;
ACCOUNT_OUTBOUND_RATE_LIMITER: RateLimit;
```

`PUBLIC_ORIGIN` is slice 1's. `RateLimit` is from `@cloudflare/workers-types`.

### `apps/api/src/contract/account-owner-rpc.ts` (new)

```ts
export interface AccountOwnerRpc {
  receiveAccountMessage(input: {
    account: OwnerAccountContext; channelMessageId: string; ownerMessage: OwnerInboundMessage; publicOrigin: string;
  }): Promise<CallOutcome<ReceiveAccountMessageResult>>;
  recordRevocation(input: { agent: AgentName }): Promise<void>;
  cancelWaiters(input: { agent: AgentName }): Promise<void>;
  purge(): Promise<void>;
  setState(input: { state: AccountState }): Promise<void>;
}
```

`setState` is for resume-suspended only (the Worker finishes a deletion, A7). `purge` leaves a tombstone key. Slice 1's `receiveOwnerMessage` RPC stays for the rules 1 to 6 path and the simulator.

### `apps/api/src/contract/log.ts` (additive)

`LogEvent` gains `AccountCreated = 'account_created'`, `AccountStateChanged`, `CommandReceived`, `ConnectionCreated`, `ConnectionRevoked`, `ConnectionRotated`, `ConnectionCompensated`, `SenderBlocked`, `SenderRateLimited`, `AccountDailyCap`, `AccountDeleted`, in slice 1's snake_case value style. `LogFields` gains `connectionId?: string`, `locale?: string`, `count?: number`, `route?: string`. Events of this slice never pass `agent`.

### `apps/api/wrangler.jsonc` (changes, development block and `env.production` repeat the bindings)

- `vars.WAITLIST_ENABLED`: `"false"` in the development block; `"true"` in `env.production`.
- `ratelimits`: `OWNER_RATE_LIMITER` `{limit: 20, period: 60}`; `OUTBOUND_RATE_LIMITER` `{limit: 30, period: 60}`; `ACCOUNT_OUTBOUND_RATE_LIMITER` `{limit: 120, period: 60}`, each with its own `namespace_id`.

### `apps/api/migrations/0002_accounts_and_keys.sql`

The spec's **Data model**, with `message_index` dropped first and recreated unchanged (see the refresh table). Written in Step 0; tested in S2.1.

## Dependencies

No new package. `libs/types` supplies `OwnerLocale`, `SECOND_MS`, `MINUTE_MS`, `DAY_MS` (slice 1 and slice 2, A25). `libs/core` has a type-only import of `@zapbip/types` (ADR 0008).

## File map (lanes)

Every path has one owner. A lane that needs a sibling's path stops and asks the lead, or notes the gap in its tester briefing text.

| Lane | Developer | Owned paths |
|---|---|---|
| L0 Contract (serial, after S0.0) | `developer-0` | `libs/types/src/enums.ts` (additions), `libs/core/src/index.ts` (one export line), `libs/core/src/accounts/{constants,command-words,account-types,ports,index}.ts`, stubs `libs/core/src/accounts/{command,agent-name,install-prompt-parts,account-copy,state-gate}.ts`, `libs/core/src/accounts/use-cases/{types,open-owner-account,apply-owner-command,create-agent-connection,list-agent-connections,revoke-agent-connection,rotate-agent-connection,request-account-deletion,confirm-account-deletion,finish-account-deletion,finish-deleting-accounts,resume-suspended-account,receive-account-message}.ts`, `libs/core/src/accounts/command-words.test.ts` (pin), `apps/api/migrations/0002_accounts_and_keys.sql`, `apps/api/src/contract/{env,log,account-owner-rpc}.ts`, `apps/api/wrangler.jsonc` |
| L1a Grammar and copy (core, pure) | `developer-1a` | bodies of `libs/core/src/accounts/{command,agent-name,install-prompt-parts,account-copy}.ts`; colocated tests of the same four names |
| L1b Rules and use cases (core) | `developer-1b` | bodies of `libs/core/src/accounts/state-gate.ts` and the use-case files in L0's list (`receive-account-message.ts` included); colocated tests; `libs/core/src/accounts/testing/in-memory-accounts.ts` (new, composes slice 1's `createInMemoryDependencies`); one additive export of `flush-queue` in `libs/core/src/inbox/index.ts` |
| L2 Storage, guards and secrets (apps/api) | `developer-2` | `apps/api/src/adapters/d1/{d1-account-directory,d1-connection-registry}.ts` (new), `apps/api/src/adapters/d1/d1-connection-directory.ts` (slice 1 file, body only), `apps/api/src/adapters/guard/{sender-guard,outbound-guard}.ts`, `apps/api/src/adapters/platform/connection-secrets.ts`, `apps/api/src/adapters/prompt/generic-install-prompt.ts`, `apps/api/src/adapters/r2/r2-account-media.ts`, `apps/api/scripts/operator-account.sh` (new, A24), `apps/api/package.json` (removes `dev:seed`), deleted: `apps/api/scripts/{dev-seed,build-directory-seed}.ts` and `apps/api/test/integration/dev-seed.test.ts`, `apps/api/test/unit/{connection-secrets,generic-install-prompt,wrangler-limits,operator-script}.test.ts`, `apps/api/test/integration/{d1-accounts,d1-connections-lifecycle,sender-guard,r2-account-media,migration-0002}.test.ts`, `apps/api/test/support/seed.ts` (slice 1 file, additive helpers) |
| L3 Durable Object, wiring, sweep (apps/api) | `developer-3` | `apps/api/src/account-inbox/**` (the new RPC methods of `AccountOwnerRpc`, purge with tombstone, `recordRevocation`, `cancelWaiters`, `setState`, ports `FirstMessageClaim` and `DeletionRequests` over SQLite, DO schema v6 registered in `migrations/index.ts`, dependency wiring from env and storage), `libs/core/src/inbox/{ports,waiters}.ts` (additive: `ReplyWaiters.cancelAgent`), `apps/api/src/accounts/deletion-sweep.ts`, `apps/api/test/support/builders.ts` (slice 1 file, additive), `apps/api/test/integration/{account-inbox-accounts,account-inbox-purge,deletion-sweep}.test.ts` |
| L4 Inbound path, routes, simulator, E2E (apps/api) | `developer-4` | `apps/api/src/inbound/owner-inbound.ts` (new orchestrator), `apps/api/src/config/waitlist-enabled.ts` (new), `apps/api/src/routes/whatsapp.ts` (slice 2 file; one change: call the orchestrator; `(contract: confirm at merge)`), `apps/api/src/routes/mcp.ts` and `apps/api/src/mcp/{resolve-connection,tool-handlers,tool-error}.ts` (slice 1 files; account-state 401, log template, outbound check and `rate_limited` tool error only), `apps/api/src/routes/dev-owner.ts` (simulator on the production inbound path), `apps/api/src/log.ts` (body, if slice 1 left it), `apps/api/test/integration/{owner-inbound,simulator-accounts,mcp-account-states,mcp-outbound,logs-redaction,waitlist-enabled}.test.ts`, `apps/api/test/e2e/accounts.e2e.test.ts` |
| L5 Docs | `developer-5` | `apps/docs/guides/{commands,agents-and-links,account-deletion}.mdx` |

Ownership notes:

- `apps/docs/docs.json` is not in any lane. The lead adds the three guide pages to the navigation after L5 merges (decision 13 gives the lead the indexes; the navigation is an index).
- `apps/api/src/index.ts`, `index.dev.ts` and `app.ts` are not changed by this slice (the cron wiring of the deletion sweep is deploy-readiness's `operations/scheduled.ts`).
- `libs/core/src/accounts/testing/in-memory-accounts.ts` belongs to L1b only; slice 1's `libs/core/src/inbox/testing/in-memory.ts` is read, never edited.
- `apps/api/src/account-inbox/**` belongs to L3 (decision 8). L2 never edits it.

## Sequencing and merge order

1. **S0.0 Plan refresh**, serial, before anything else (see step below).
2. **Step 0 (L0), serial.**
3. **Parallel after Step 0:** L1a, L1b (red only), L2 (red only), L3 (red only), L5.
4. **Green dependencies:** L1b green needs L1a. L2 green needs L1b (lifecycle integration); `d1-account-directory.ts` is created here, so no wait on slice 2. L3 green needs L1b and L2. L4 needs L2 and L3.
5. **Merge order into `feat/accounts-and-keys`:** L0 → L1a → L1b → L2 → L3 → L5 → L4.
6. **Lead merges after each lane:** `pnpm typecheck`, `pnpm test:unit`, the integration and `pnpm verify` green before the next merge.
7. **Main moves:** developers merge `main` at a task boundary, never mid-step. Lanes never rebase.

## Steps

Every box is empty when authored. A sub-agent ticks its own box. A wrong step is struck through with the reason.

### Step S0.0 (lead, serial): plan refresh against main

- [x] **S0.0 Plan refresh.** Done 2026-11-06, evidence: commit `docs(accounts-and-keys): refresh the plan against slice 1's code`. Diff this plan against `main` and the merged `agent-inbox-core` and `whatsapp-cloud-channel`: paths (`apps/api/src/adapters/`, `account-inbox/`, `routes/`), names (`resolveSecretDigest`, `PUBLIC_ORIGIN`, `OwnerLocale`, `message_index`), exports in `libs/core` and `libs/types`, migration numbers (`0001_core`, `0004` from whatsapp, `0002` ours), the existence of `scheduled.ts`, the `d1-account-directory.ts` file, and the `ReplyWaiters` interface. Correct the plan and mark each `(contract: confirm at build)` item settled or changed. No lane starts before this step is recorded. ~~On `main` today there is no product code, so this step runs after the slice 1 merge.~~ Run early on `feat/agent-inbox-core` and its lane branches; the lead re-checks the names that moved when the lanes merge.

### Step 0 (L0): contract

- [x] **S0.1 Core contract.** Evidence: `9e57b0b`, pin `2a9a5fd` (`libs/core/src/accounts/command-words.test.ts`, 12 tests). Append the enums to `libs/types`; add `libs/core/src/accounts/{constants,command-words,account-types,ports,index}.ts`, the `use-cases/types.ts`, the stubs for new members and the one export line in `libs/core/src/index.ts`; add the `command-words` pin test. Stub bodies are `void input;` and `throw new Error('<name> is not implemented');`. Run `pnpm typecheck`. Commit as `feat(core): add the accounts and keys contract`.
- [x] **S0.2 Storage contract.** Evidence: `21bfa12` (applied over a `0001` database holding rows with foreign keys on, in sqlite3 by hand; the automated case is S2.1). Write `apps/api/migrations/0002_accounts_and_keys.sql` from the spec's **Data model**, with the drop lines first (`message_index` included, recreated unchanged). ~~Write `apps/api/src/adapters/d1/schema.ts`. Run `pnpm --filter @zapbip/api exec drizzle-kit check`.~~ Slice 1 has no Drizzle schema; the migration is hand-written and S2.1 applies it. Commit as `feat(api): add the accounts and keys schema`.
- [x] **S0.3 Worker contract.** Evidence: `f1d2864`; `wrangler deploy --dry-run --env production` lists the three rate limiters and `WAITLIST_ENABLED`. Write the `env.ts` changes, `account-owner-rpc.ts`, the additive `contract/log.ts` events and fields, and the `wrangler.jsonc` changes in the development block and `env.production` (`ratelimits` and `vars`). Do not write ADRs or docs: the lead owns them. Run `pnpm typecheck`. Commit as `feat(api): add the accounts and keys worker contract`.
- [x] **S0.4 Gate.** `pnpm typecheck` and `pnpm verify` green on the Step 0 tree. Evidence: typecheck, format, doctor, shape, hooks, unit green; the `secrets` gate fails only on `origin/feat/agent-inbox-core` history (`eb984a0`, `apps/api/test/integration/account-inbox.test.ts:27`, slice 1), and `gitleaks git --log-opts=HEAD` on this branch reports no leaks.

Failure modes for Step 0 are in the table below. Step 0 has no backout: a broken contract is fixed forward in a new Step 0 commit that every lane merges.

### Step L1a (grammar and copy)

- [ ] **S1a.1 red: grammar, names, copy, prompt parts.** Write the four test files of the test plan's **Core unit: grammar** area. Run `pnpm --filter @zapbip/core test:unit`. Expected: each case fails with `<name> is not implemented`, except the labelled `pin` cases. Commit as `test(core): pin the account command grammar and copy`.
- [ ] **S1a.2 green: grammar, names, copy, prompt parts.** Implement `command.ts` (`parseAccountCommand`: trim, collapse inner whitespace, lowercase; exact match against `COMMAND_WORDS`; the name is the text after the words when `takesName`; list ids map through `COMMAND_LIST_ID_PREFIX` to one of the six menu kinds, else `Unknown`, A12; a quoting message returns `null`; `revogar` or `girar` alone return an empty `rawName`), `agent-name.ts` (A4), `install-prompt-parts.ts` (A23: line-based, label budget, a link line never splits, empty input throws), `account-copy.ts` (`renderAccountReply`, `buildMenuRows` from `MENU_COMMAND_KINDS`, every intent in both locales, WhatsApp limits from the test plan). Commit as `feat(core): parse account commands and render their replies`.

### Step L1b (state gate, rule 0, use cases)

- [x] **S1b.1 red: state gate, rule 0, receive.** Evidence: `4a24b87`. Write `state-gate.test.ts`, `apply-owner-command.test.ts`, and the rule 0 cases in `receive-account-message.test.ts` (all under `libs/core/src/accounts/`): the matrix of A20, the six menu ids, `zapbip:confirm_deletion` to `Unknown`, quoted command words to the quoted agent, rule 5 unchanged, and the compensation cases of A21 with a failure on part 2 of 3 (the test plan's **Compensation** cases). Expected: `evaluateAccountState is not implemented`, `applyOwnerCommand is not implemented`, `receiveAccountMessage is not implemented` for the compensation case. Commit as `test(core): pin the state gate, rule 0 and compensation`.
- [x] **S1b.2 red: lifecycle, deletion, revocation.** Evidence: `32524b8`. Write the use-case test files for create, list, revoke, rotate, request and confirm deletion, finish deletion, the deleting sweep, resume, and open. Include the revocation cases (A22: revoke calls `recordRevocation` and not `cancelWaiters`; rotate calls `cancelWaiters` and not `recordRevocation`, and the wake setting is unchanged), the `message_index` first-delete case, and the TTL cases (A19). The red commit adds the in-memory extension as a stub: `createInMemoryAccountDependencies is not implemented`. Commit as `test(core): pin the connection lifecycle, deletion and revocation`.
- [x] **S1b.3 green: state gate, rule 0, receive, compensation.** Evidence: `f34aa84`. Implement `state-gate.ts`, `apply-owner-command.ts` (dispatch record keyed by `CommandKind`), `receive-account-message.ts` (order: dedupe by channel receipt; first-message claim; state gate; for a command, open the window, flush the queue, apply rule 0; otherwise hand over to slice 1's `receiveOwnerMessage` for rules 1 to 6; sends each reply part in order; on failure runs `compensation` and sends `SendFailed` best-effort, A21; `deletionConfirmed` after the confirmation reply). Commit as `feat(core): gate account states, apply commands and compensate failed sends`.
- [x] **S1b.4 green: lifecycle, deletion, revocation, resume.** Evidence: `16c512f`. Implement `open-owner-account.ts` (waitlist flag; `null` at the cap), `create-agent-connection.ts`, `list-agent-connections.ts`, `revoke-agent-connection.ts` (calls `revocations.recordRevocation`) and `rotate-agent-connection.ts` (calls `revocations.cancelWaiters` only), `request-account-deletion.ts` (A19), `confirm-account-deletion.ts` (TTL check), `finish-account-deletion.ts` (A7 steps; the D1 batch order is `message_index`, `owner_identities`, `connections`, `accounts`), `finish-deleting-accounts.ts` (lists `deleting` accounts; finishes each), `resume-suspended-account.ts` (A7), and the in-memory adapters. Commit as `feat(core): create, revoke, rotate and delete accounts`.

### Step L2 (storage, guards, secrets, operator script)

- [x] **S2.1 red: D1 and migration, with adapter stubs.** The red commit adds the new adapter members as stubs (`D1AccountDirectory.findOrCreateByWaId`, `listByState`, `remove`; `D1ConnectionRegistry.register`, `rotate`, `revoke`, `listActive`, `findActiveByAgent`; `R2AccountMedia.deleteAll`; `ConnectionSecrets.issue`; `resolveSecretDigest` keeps its signature and its red case asserts the new body). Then write `migration-0002.test.ts`, `d1-accounts.test.ts`, `d1-connections-lifecycle.test.ts` (including the `message_index` case and the pattern-before-D1 case). Add helpers to slice 1's `apps/api/test/support/seed.ts` (`seedAccount` gains `state`; `seedConnection` gains `revokedAt`) and make `applyDirectoryMigration` apply `0001` then `0002`. Expected: each case fails with `<method> is not implemented`, the migration case on its assertion. Commit as `test(api): pin the accounts and keys D1 rules`. Evidence: `bd42b6d` (red, with `9c20ba4` for the seed schema fix).
- [x] **S2.2 red: secrets, guards, prompt, operator script.** Write `connection-secrets.test.ts`, `generic-install-prompt.test.ts`, `wrangler-limits.test.ts`, `operator-script.test.ts`, `sender-guard.test.ts`, `r2-account-media.test.ts`. Commit as `test(api): pin the secrets, guards and operator script`. Evidence: `bd42b6d`.
- [x] **S2.3 green: adapters and script.** Implement `d1-account-directory.ts` (A13 batch; `remove` as one batch in the A7 order), `d1-connection-registry.ts`, `d1-connection-directory.ts` (A3 order, body only), `guard/sender-guard.ts` (blocklist read, then the binding), `guard/outbound-guard.ts` (both the connection and the account binding, A16), `platform/connection-secrets.ts` (over slice 1's generator and hash), `prompt/generic-install-prompt.ts` (async, A9 shape), `r2/r2-account-media.ts` (`deleteAll` pages of 1 000 under `accounts/<accountId>/`), and `operator-account.sh` (A24). Delete the dev seed files and the `dev:seed` script. Commit as `feat(api): add the account directories, guards, secrets and operator script` and, separately, `chore(api): remove the development connection script`. Evidence: `ba3aabc`. The dev seed files, `dev:seed` and `dev-seed.test.ts` are not deleted: deferred to L4, because `apps/api/test/e2e/global-setup.ts` still seeds through them; `9c20ba4` updated the seed to 0002.

### Step L3 (Durable Object, wiring, sweep)

- [ ] **S3.1 red: Durable Object and sweep.** Write `account-inbox-accounts.test.ts`, `account-inbox-purge.test.ts` and `deletion-sweep.test.ts` (test plan **Durable Object** area). Extend `apps/api/test/support/builders.ts` (the builders the other lanes import). Expected: `not implemented`. Commit as `test(api): pin the account object, tombstone and sweep`.
- [ ] **S3.2 green: Durable Object and sweep.** Implement the `account-inbox.ts` methods of `AccountOwnerRpc` (`receiveAccountMessage`; `DeletionRequests` and `FirstMessageClaim` over the DO schema v6 (A10); `recordRevocation` (wake state, waiters, revoked flag), `cancelWaiters` (waiters only), `setState` for suspended to active only), `purge()` (clear storage, delete alarm, write the tombstone key; later writes throw `AccountTombstoned`; purge is idempotent), dependency wiring from env and the object's own id as the account id, `ReplyWaiters.cancelAgent`, and `accounts/deletion-sweep.ts`. Commit as `feat(api): add the account object, tombstone and daily sweep`.
  - Partial, lane L3 first push (owner delegated 2026-11-06): red `c4d269e`, green `1ad9c6d` (core `cancelAgent`, cancelled waits end at once) and `0b29795` (schema v6, `FirstMessageClaim`, `DeletionRequests`, `recordRevocation`, `cancelWaiters`, `setState`, `purge` with tombstone). Still open and left unticked: `receiveAccountMessage` on the object and `accounts/deletion-sweep.ts` with its test, which need L2's D1 adapters and L1b's green use cases.
  - Decision (owner delegated 2026-11-06): `ReplyWaiters` awaits return `WaiterEnd` (`libs/types`), so `waitForReply` and `holdForAnswer` (core files, owned by L3 for this change) end a cancelled wait with `Timeout` and do not re-arm.
  - Decision (owner delegated 2026-11-06): `setState` accepts only `active` and records it in `account_facts.state`; the object reads no state.

### Step L5 (docs)

- [x] (`7f2866b`) **S5.1 red.** The lead adds the three guide pages to the navigation after L5's red commit; here L5 writes the pages' skeletons only with links to the three names, so `mint broken-links` fails on the missing pages. Commit as `test(docs): link the account guides before their pages exist`.
- [x] (`5ca28f1`) **S5.2 green.** Write the three pages: `commands` (the command table in both languages, reserved words, limit, menu), `agents-and-links` (create, list, revoke, rotate, the password warning, what WhatsApp previews show, the eight-agent limit), `account-deletion` (the phrase, the 10-minute window, consequences, Meta keeps history, Cloudflare retention, a new account after deletion). `mint broken-links` green. Commit as `docs(api): write the account guides`.

### Step L4 (inbound path, routes, simulator, E2E)

- [ ] **S4.1 red: inbound, simulator, routes, outbound, logs.** Write `owner-inbound.test.ts`, `simulator-accounts.test.ts`, `mcp-account-states.test.ts`, `mcp-outbound.test.ts` (per-connection and per-account), `logs-redaction.test.ts`, `waitlist-enabled.test.ts`. Expected: `not implemented` or a non-expected status. Commit as `test(api): pin the inbound path, simulator and account states`.
- [ ] **S4.2 green: inbound, simulator, routes.** Implement `config/waitlist-enabled.ts` (with `WAITLIST_FLAG_VALUES`; called per request from the Worker's fetch path, A6), `inbound/owner-inbound.ts` (sender guard; `openOwnerAccount`; `deleting` runs `finishAccountDeletion`; the object call; `deletionConfirmed` runs `finishAccountDeletion`), the one-line change in `routes/whatsapp.ts`, `mcp/resolve-connection.ts` and `routes/mcp.ts` (A3 order), the outbound check in `mcp/tool-handlers.ts` (A16), the simulator on the inbound path, and the `logEvent` body if still a stub. Commit as `feat(api): route owner messages through the account gates`.
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
| S0.2 | `0002` fails on a database that already holds `0001` rows, or `0001_core` names differ | `migration-0002` fails | Fix the migration before merge (it is unapplied) |
| S1a.2 | A command word matches with trailing `?` or `.` | `command.test.ts` `agentes?` returns a command | Tighten the exact match |
| S1a.2 | A reserved first word is accepted as a name | `agent-name.test.ts` reserved case | Compare the normalised name with the reserved words |
| S1a.2 | A prompt part splits inside the link line | `install-prompt-parts.test.ts` link-line case | Split on lines only; throw for an over-budget link |
| S1b.3 | Rule 0 consumes a quoted command word | `receive-account-message.test.ts` quoted case routes to no agent | Check `isQuoting` before parsing |
| S1b.3 | A failed part 2 of 3 leaves the new link valid | `receive-account-message.test.ts` compensation case: `resolveSecretDigest` of the new digest is not `null` | Run `compensation` before the `SendFailed` reply; the test pins it |
| S1b.4 | Rotate overwrites a digest changed by a second rotation | `rotate-agent-connection.test.ts` lost-race case | Compare-and-set on `fromDigest` |
| S1b.4 | Rotate clears the wake setting, or calls `recordRevocation` | `rotate-agent-connection.test.ts` revocation-routing case: the fake `revocations` records `recordRevocation` or the wake setting is absent after rotate | Rotate calls `cancelWaiters` only |
| S1b.4 | Deletion removes `owner_identities` before `message_index` and a retry cannot find the wamids | `finish-account-deletion.test.ts` order case | Delete `message_index` first in the batch |
| S1b.4 | `confirmAccountDeletion` accepts a stale request | `confirm-account-deletion.test.ts` 10-minute and 10-minute-plus-1 ms cases | Compare `now - requestedAt` with `DELETION_CONFIRM_TTL_MS` |
| S2.3 | Two first messages create two accounts | `d1-accounts.test.ts` concurrency case reports two rows | The A13 batch order |
| S2.3 | Twenty concurrent creates exceed the limit | `d1-connections-lifecycle.test.ts` concurrency case returns more than 8 rows | The conditional `register` statement holds the limit |
| S2.3 | The operator script runs SQL with a non-digit `wa_id` | `operator-script.test.ts` injection cases | Validate `^[0-9]{8,15}$` before building the command |
| S2.3 | `deleteAll` stops after one page | `r2-account-media.test.ts` 2 500-key case | Loop until a listing is empty |
| S3.2 | A tombstoned object accepts a write | `account-inbox-purge.test.ts` write-after-purge case | Guard every write method with the tombstone check |
| S3.2 | The sweep finishes an account that is only `suspended` | `deletion-sweep.test.ts` suspended case | Sweep selects `deleting` only |
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
