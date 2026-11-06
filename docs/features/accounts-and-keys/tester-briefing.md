# Tester briefing: Accounts and keys

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## Step 0 (contract)

Commits: `9e57b0b` (core contract), `2a9a5fd` (pin), `21bfa12` (migration), `f1d2864` (worker contract). Plan refresh: `ed1b6ff`.

### What changed

- `libs/types/src/enums.ts` — `AccountState`, `CommandKind`, `SenderVerdict`, `RegisterOutcome`, `AccountStateOutcome`, `ReplyKind`, `AccountReplyIntent`, `AccountReplyParameter`; `IdPrefix.Account`, `IdPrefix.Connection`, `RoutingRule.AccountCommand`.
- `libs/core/src/accounts/` — constants, `COMMAND_WORDS`, types, ports (`AccountDirectory`, `ConnectionRegistry`, `ConnectionSecrets`, `SenderGuard`, `OutboundGuard`, `ConnectionRevocations`, `AccountInboxPurge`, `AccountMediaPurge`, `FirstMessageClaim`, `DeletionRequests`, `AccountDependencies`, `AccountLifecycleDependencies`), and stubs for the grammar, copy, state gate and every use case including `receiveAccountMessage`. Exported from `libs/core/src/index.ts`.
- `apps/api/migrations/0002_accounts_and_keys.sql` — rebuilds `accounts`, `owner_identities`, `connections` and `message_index`; adds `blocked_phones`.
- `apps/api/src/contract/{env,log}.ts` — rate limiter bindings, `WAITLIST_ENABLED`, new log events and fields; `account-owner-rpc.ts` is the new RPC interface (no class implements it yet).
- `apps/api/wrangler.jsonc` — three `ratelimits` and `WAITLIST_ENABLED` in the development block and `env.production`.
- `docs/features/accounts-and-keys/plan.md` and `test-plan.md` — the plan refresh against slice 1's code (see the Plan refresh sections).

### How to run

```bash
pnpm typecheck
pnpm --filter @zapbip/core test:unit
cd apps/api && npx wrangler deploy --dry-run --env production --outdir <scratch>
```

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `libs/core/src/accounts/command-words.test.ts` (pin) | Green on arrival; it pins the data the contract ships | Stays green |

No red test in Step 0: every behaviour is a stub that throws `<name> is not implemented`, and the red commits belong to L1a, L1b, L2, L3 and L4.

### Hypotheses to attack

1. Hypothesis: `0002` applies over a populated `0001` database with foreign keys on. Break it by: apply `0001`, insert an account, a connection and a `message_index` row, then apply `0002`.
2. Hypothesis: the partial unique index lets a revoked and an active connection share `(account_id, agent)`. Break it by: insert both orders, then two active rows (the second must fail).
3. Hypothesis: the production entry still bundles with the new bindings. Break it by: `wrangler deploy --dry-run --env production` and read the bindings list.

### Known gaps

- `pnpm verify` fails its `secrets` gate in this clone because `origin/feat/agent-inbox-core` carries commit `eb984a0` (`apps/api/test/integration/account-inbox.test.ts:27`, a `LOG_SECRET_FILENAME` literal flagged as `generic-api-key`). `gitleaks git --log-opts=HEAD` on this branch is clean. Slice 1 owns the fix.
- The migration was checked by hand with `sqlite3` at Step 0; the automated case is `migration-0002.test.ts`.
- Resolved later in this file: `AccountOwnerRpc` is implemented by `AccountInbox` (L3), `ReplyWaiters.cancelAgent` exists (L3), and the merges with `agent-inbox-core` and `whatsapp-cloud-channel` are done.

## Step L5 (docs)

### What changed

- The three pages were first written under `apps/docs/guides/` and moved by the inbound-path lane (L4); they now live in English and `pt-br/` as `features/whatsapp-commands` (the command table, the menu, reserved words, the `@<agent>` escape), `features/manage-your-agents` (create, list, revoke, rotate, the password warning, the eight-agent limit) and `help/delete-your-account` (the two steps, the 10-minute window, what is and is not removed, a new account after deletion). All six are in `apps/docs/docs.json`.

### How to run

```bash
pnpm --filter @zapbip/docs exec mint broken-links
```

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `mint broken-links` at `7f2866b` | `found 2 broken links in 1 files`: `/guides/agents-and-links`, `/guides/account-deletion` from `guides/commands.mdx` (the old paths) | the three pages exist at `5ca28f1` (`success no broken links found`); the paths moved afterwards with L4 |

### Hypotheses to attack

1. Hypothesis: every command word, the 8-agent limit, the 10-minute window and the `@<agent>` escape in the pages match the shipped behaviour. Break it by: comparing each page against `command-words.ts`, `constants.ts` and the simulator replies.
2. Hypothesis: the pages render in `mint dev` once the lead adds them to `docs.json`. Break it by: opening each page and following each link.

### Known gaps

- Slice-wide gaps are listed in each lane section above; the integration section at the end of this file is the current list.

## Lane L1a (grammar and copy)

Changed: `libs/core/src/accounts/{command,agent-name,account-copy}.ts` and their colocated tests (`install-prompt-parts.ts` was written here and removed by the delta; decisions 4 and 5 below are history). Run: `pnpm --filter @zapbip/core test:unit`.

Red `ffe19b2` (127 failed, 12 passed; the 12 are `command-words.test.ts`; no pins): `<name> is not implemented` for each function, and `expected [Function] to throw error matching /link line/ | /line/ | /empty/ but got '... is not implemented'`. Green `d742d49`.

Decisions to attack:

1. `parseAccountCommand` returns `DEFAULT_LOCALE` for menu list replies (an id carries no language); L1b should use the account locale for those.
2. Menu ids are `zapbip:` plus the `CommandKind` value (A12), e.g. `zapbip:list_agents`; the test-plan line saying `zapbip:agents` is outdated.
3. Added `formatMenuRowId` (`command.ts`) and `buildMenuButtonText({locale})` (`account-copy.ts`, "Comandos" / "Commands") for L4's list send.
4. ~~`Created` and `Rotated` copy embeds the install prompt between intro and warning; L1b calls `splitInstallPrompt` on the rendered text.~~ Superseded by the delta: the copy carries the install lines (`renderInstallLines`) and the reply is one message.
5. ~~`splitInstallPrompt` treats a line containing `http://` or `https://` as the link line.~~ Removed with `install-prompt-parts.ts`.
6. `renderAccountReply` has its own token fill (throws `copy: missing parameter <name>`) because `renderCopy` is tied to `InboxCopyKey`.

Hypotheses: a quoting message is never a command; trailing punctuation never matches; reserved names are the first word of every command word; names of 20 characters pass and 21 return `null`.

Gap: `pnpm verify` e2e is red from `dev-seed.ts` against migration 0002 (L2 is fixing it).

## Lane L3 (Durable Object, partial: independent parts)

Changed: `apps/api/src/account-inbox/{account-inbox,agent-revocation,first-message-claim,deletion-requests,account-tombstoned,constants}.ts`, `migrations/{v6.sql,index.ts}`; `libs/core/src/inbox/{ports,waiters}.ts` and `use-cases/{wait-for-reply,hold-for-answer}.ts`; `libs/types/src/enums.ts` (`WaiterEnd`); `apps/api/test/integration/account-inbox.test.ts` (WI-118 now expects versions 1 and 6 and the two new tables). Run: `pnpm --filter @zapbip/core test:unit`, `pnpm --filter @zapbip/api test:integration`.

Red `c4d269e` (core: 4 failures, `cancelAgent is not implemented`; Worker integration: 20 failed, 3 passed, with `purge is not implemented`, `setState is not implemented`, `createSqliteFirstMessageClaim is not implemented`, `createSqliteDeletionRequests is not implemented`, `expected [ 1 ] to include 6`; the three `setState` refusals passed for the wrong reason). Green `1ad9c6d`, `0b29795`.

Hypotheses to attack:

1. A live `wait_for_reply` or held question wait ends at once with `timeout` on `recordRevocation` and on `cancelWaiters`, and a message that arrives afterwards stays unread. Break it by: start a 20 s wait, revoke, time the return; also revoke while two agents wait.
2. `recordRevocation` removes only that agent's `agent_wake` row and adds it to `revoked_agents`; `cancelWaiters` touches neither. Break it by: revoke an agent that never had a wake row; revoke twice.
3. After `purge`, storage holds only the `tombstone` key and no alarm, also after the object restarts; every write method throws `AccountTombstoned`. Break it by: purge, evict, call each write; purge twice; run the alarm.
4. `FirstMessageClaim.claim` is true for the first id and for a retry of it, false for any other; `DeletionRequests` keeps both facts in one row without clobbering each other.

Gaps:

- None open for `receiveAccountMessage` and the sweep; they landed in red `85ff9b1` and green `b0af45b`. The sweep is not wired to a cron (deploy-readiness owns the dispatch).
- The tombstone refusals are tested through `runInDurableObject`; a refusal thrown across the RPC boundary is reported by the Workers test pool as an unhandled error.
- The `revoked_agents` marker is not cleared when a name is created again (slice 7's standby selection decides). The `setState` RPC was removed by the security fix batch.

## Lane L1b (state gate, rule 0, use cases)

Changed: `libs/core/src/accounts/state-gate.ts`, `use-cases/*` (bodies plus new helpers `account-reply`, `usage-reply`, `install-prompt-reply`), `testing/{in-memory-accounts,fixtures}.ts`, colocated tests; additive: `libs/core/src/inbox/option-id.ts` (menu ids), `inbox/index.ts` (`flush-queue` export), `accounts/ports.ts` (`DeletionRequests.clear`), `accounts/constants.ts` (`ACCOUNT_MENU_QUESTION_ID`). Run: `pnpm --filter @zapbip/core test:unit` (the two empty files `aiters.test.ts` and `ait-for-reply.test.ts` of slice 1 report "No test suite"; not ours).

Red: `8efa6a0` (option-id: expected `['zapbip:create_agent','zapbip:help']`), `4a24b87` (28 + 10 + 6 cases: `receiveAccountMessage` / `evaluateAccountState` / `applyOwnerCommand is not implemented`), `32524b8` (`<use case> is not implemented`). Green `385c585`, `f34aa84`, `16c512f`. No pins.

For L3 (Durable Object): `DeletionRequests` is now `{ save({requestedAt}): Promise<void>; find(): Promise<number | null>; clear(): Promise<void> }`; `clear` is called when a confirmation arrives without a live request. `FirstMessageClaim.claim` is called before the state gate for every message, including deleting accounts. L3 also owns ending a held `wait_for_reply`/`ask` on `recordRevocation`/`cancelWaiters` (the core cannot, `ReplyWaiters` has no `cancelAgent`); the plan's revoke "held call resolves with Timeout" case therefore lives at the Durable Object level, not in core.

Decisions to attack:

1. `receiveAccountMessage` records the channel receipt itself for gate replies and commands, and leaves it to slice 1's `receiveOwnerMessage` for everything else (that use case records it too). A retry of a confirmed deletion returns `duplicate: true, deletionConfirmed: false`.
2. A menu (`List` reply) is sent as the rendered text, then a `Choice` message with question id `zapbip:menu`; `formatChoiceOptionIds` turns its options into `zapbip:<command>`.
3. `Created`/`Rotated` are one reply of install lines, sent as one session text. A failed send runs the compensation (create: revoke; rotate: compare-and-set back), then one best-effort `SendFailed`. A rotate calls `cancelWaiters` only after every part was delivered; a revoke calls `recordRevocation` inside the use case, before its reply.
4. Menu list taps use the account locale; typed keywords use the keyword's language (`applyOwnerCommand` overrides the reply locale with the command's).
5. `openOwnerAccount` returns the account only (the `created` flag of the lookup is not in its signature).
6. Reply messages are stored as `ToOwner` messages with no agent, so they never change "last agent that wrote". The test plan's "`insertMessage` not called" for waitlisted text is asserted as "no owner message stored".

Hypotheses: a quoted command word goes to the quoted agent; `girar a imagem` is a rotate of `a-imagem` (`NotFound`), `@claude girar a imagem` routes; a deleting account gets no reply; the 10-minute deletion window is inclusive; two concurrent opens of one number yield one account.

Gaps: none open. The held `wait_for_reply` across a revoke and the held `ask` across a rotate are covered at the Durable Object level (`account-inbox-accounts.test.ts`, AK-9 and AK-10); a cancelled `ask` returns `pending`, not `timeout`, so the test-plan box that says `ReplyStatus.Timeout` for the rotated `ask` is stale.

## Lane L2 (storage, guards, secrets, operator script)

Commits: `9c20ba4` (fix: dev seed on the 0002 schema), `bd42b6d` (red), `ba3aabc` (green).

Changed: `apps/api/src/adapters/{d1/d1-account-directory,d1/d1-connection-registry,d1/d1-connection-directory,guard/sender-guard,guard/outbound-guard,platform/connection-secrets,r2/r2-account-media}.ts` (`prompt/generic-install-prompt*` was written here and removed by the delta), `apps/api/scripts/operator-account.sh`, test support `fake-rate-limiter.ts`, `fake-pnpm.mjs`, `seed.ts`.

Run: `pnpm --filter @zapbip/api test:unit` and `test:integration`.

Red then green: the red run printed `<Class.method> is not implemented` for `D1AccountDirectory` (findOrCreateByWaId, findByWaId, remove), `D1ConnectionRegistry` (register, findActiveByAgent, revoke, rotate), `SenderGuard.admit`, `OutboundGuard.admit`, `R2AccountMedia.deleteAll`; 42 integration and 18 unit failures. The `resolveSecretDigest` cases failed on the missing revoked and account-state filters. Pins (green on arrival): `migration-0002.test.ts`, `wrangler-limits.test.ts`, the malformed-secret case, the digest-prefix case, the operator wa_id refusals.

Deviations:
- Dev seed kept (A2 deferred to L4): `global-setup.ts` seeds through `dev-seed.ts`; only its SQL was updated to 0002.
- `operator-account.sh suspend` applies to `active` only, so a waitlisted phone cannot reach `active` through suspend then resume. A refused transition exits 1 with the reason on stderr.
- The pattern-before-D1 step lives in `resolve-connection.ts`; the directory takes a digest.

Hypotheses to attack:
1. Hypothesis: twenty concurrent first messages from one phone yield one account. Break it by: higher concurrency against the real D1 batch.
2. Hypothesis: the daily cap never orphans an owner identity. Break it by: cap reached, then the same phone twice.
3. Hypothesis: `register` never exceeds the limit. Break it by: concurrent creates across several accounts.
4. Hypothesis: the operator script cannot run SQL from a non-digit `wa_id`. Break it by: newlines, unicode digits, leading and trailing spaces.
5. Hypothesis: `deleteAll` empties the prefix and spares `acc10` when purging `acc1`.

Known gaps: the operator script was run only against a fake `pnpm` over `node:sqlite`, never `wrangler d1 execute` (owner-run). Real Rate Limiting bindings were not exercised; the guards are tested with a counting fake.

## Delta D0 to D9 (install link, install code store)

Commits: `6037cdb` (docs: spec, plan, test plan, ADR 0017 amendment), `ead6495` (red), `fc7f1ce` (core green), `3932a06` (api green). D8 is not done: it edits S4 files that are not on this branch.

Changed: `libs/core/src/accounts/{account-types,ports,constants,account-copy,connection-link}.ts`, `use-cases/{create,rotate}-agent-connection.ts`, `use-cases/{install-prompt-reply,seal-install-code,list-agent-connections,receive-account-message}.ts`, `testing/in-memory-accounts.ts`; `libs/types/src/{enums,constants}.ts` (`InstallCodeStatus`, the install code constants); `apps/api/migrations/0002_accounts_and_keys.sql` (rewritten in place, not deployed); `apps/api/src/adapters/{d1/d1-connection-registry,d1/d1-install-code-directory,platform/install-code-vault,platform/hash}.ts`; `apps/api/src/accounts/deletion-sweep.ts`; `apps/docs/guides/{commands,agents-and-links}.mdx`. Removed: `install-prompt-parts`, the `InstallPromptRenderer` port, `adapters/prompt/*`.

Run: `pnpm --filter @zapbip/core test:unit`, `pnpm --filter @zapbip/api test:unit`, `pnpm --filter @zapbip/api test:integration`.

Port names: the port is `InstallCodeDirectory` with `resolve({installCode, now})` and `recordFirstCall({connectionId, calledAt})`, and `InstallCodeVault` with `issue`, `seal`, `open`, exactly as the spec table says and as install-skills reads them. `resolve` returns `Ready` (link, locale, agent, accountId, connectionId), `Expired` or `Used` (locale), or `Unknown` (locale null). The MCP route must call `recordFirstCall` after the first successful call (install-skills); nothing in this slice calls it. The daily trigger that calls `clearExpiredInstallSecrets({environment, now})` is not wired (S4).

Red then green: `ead6495` printed `renderInstallLines is not implemented`, `Cannot read properties of undefined (reading 'installCode')`, `InstallCodeVault.issue is not implemented`, `table connections has no column named install_code_digest`, and `expected 'a1 (1970-01-11)' to contain 'claude-code'`; counts in the commit body. Green: core 477 passed, api unit 56 passed, api integration 251 passed.

Deviations: the directory is `d1-install-code-directory.ts`, not an addition to `d1-connection-directory.ts` (one purpose per file). `resolve` filters on the account being `active`, like the MCP lookup. The empty client mark is `-`.

Hypotheses to attack:
1. Hypothesis: no WhatsApp text, log line or D1 column ever holds a `zb_conn_` secret or a clear `zb_inst_` code. Break it by: create, rotate, a failed send and revoke, then dump D1 and the screen.
2. Hypothesis: a sealed secret opens only with its own code. Break it by: one-character codes, truncated or tampered sealed values, another connection's code.
3. Hypothesis: a failed rotate send restores the old code, the old sealed secret and the old expiry. Break it by: rotate a used connection, fail the send, resolve the old code (expect `Used`) and the new code (expect `Unknown`).
4. Hypothesis: a rotation makes the new code `Ready` even after the old one was used. Break it by: use the first code, rotate, resolve the second.
5. Hypothesis: `recordFirstCall` on one connection never touches another. Break it by: two accounts, one call.
6. Hypothesis: the sweep never clears a live code. Break it by: expiry one millisecond ahead of `now`.

Known gaps: no test calls the install page (install-skills); the E2E walk and the `zb_inst_` log redaction entry wait for S4; the HKDF salt is empty because the code carries 128 random bits.

## Integration of core and the channel, docs, and lane L4 (inbound path)

Commits: merges of `origin/feat/accounts-and-keys-delta`, `origin/feat/agent-inbox-core` and `origin/feat/whatsapp-cloud-channel`; `refactor(core): receive account messages as channel entries`; `66a251e` (red), `b3e033b` (green), `4e6f59b` (pin).

Changed: `apps/api/src/inbound/owner-inbound.ts` (sender guard, `openOwnerAccount`, deletion resume, the account object, deletion after confirmation), `apps/api/src/config/waitlist-enabled.ts`, `apps/api/src/routes/whatsapp.ts` (the webhook calls the orchestrator), `apps/api/src/routes/dev-owner.ts` (the simulator calls the same orchestrator; a new phone opens an account; a malformed phone is `400`), `apps/api/src/dev/dev-account-inbox.ts` (`channelMessageIdOf`), `apps/api/src/mcp/{outbound-admission,server,tool-handlers,types,constants}.ts` (the outbound limit answers a tool error that starts with `rate_limited`), `apps/api/src/accounts/deletion-sweep.ts` (shared lifecycle helpers), `apps/api/wrangler.jsonc` (production at the top level, `env.development` for local), docs pages under `apps/docs/{features,help}` and `apps/docs/pt-br/{features,help}` (the three old guides moved; both languages).

Run: `pnpm verify`; the new tests are `apps/api/test/integration/{owner-inbound,simulator-accounts,mcp-account-states,mcp-outbound,logs-redaction}.test.ts`, `apps/api/test/unit/waitlist-enabled.test.ts`, `apps/api/test/e2e/accounts.e2e.test.ts`.

Red then green (`66a251e`): `receiveOwnerInbound is not implemented for wamid.inbound.N` (every orchestrator and log case), `readWaitlistEnabled is not implemented for true`, `expected 404 to be 200` (simulator create), `expected undefined to be true` (outbound limit, the 31st call was not refused). Pins, green on arrival: `mcp-account-states.test.ts`, the per-connection and `check_inbox` cases of `mcp-outbound.test.ts`, and `accounts.e2e.test.ts`.

Existing tests changed because behaviour changed on purpose: `dev-owner.test.ts` WI-106 (an unknown phone opens an account) and WI-107 (a malformed phone is `400`), WI-99 (the quoted message must have been delivered, so the window is opened first), `whatsapp-webhook.test.ts` WI-28 (an unknown sender opens an account, logged as `account_created`), `route-fixtures.ts` `seedAccount` (claims the first message, so the seeded account behaves like one that wrote before), `wrangler-limits.test.ts` (production is the top level).

Hypotheses to attack:
1. Hypothesis: a blocked or over-limit phone never creates an account and never opens the window. Break it by: a blocked phone with an exhausted limiter; the 21st message in a minute; a blocked phone's first message.
2. Hypothesis: two simultaneous first messages from one phone make one account and one reply. Break it by: ten concurrent deliveries with the same and different wamids.
3. Hypothesis: media is downloaded only for a message of an active, already-existing account. Break it by: a photo as the first message, a photo from a waitlisted and from a suspended account (the R2 prefix must stay empty).
4. Hypothesis: the confirmation reply reaches the owner before the account disappears, and a crash between the two leaves `deleting` that the next message finishes. Break it by: failing `purge`, then sending any message.
5. Hypothesis: `rate_limited` is per connection for `send_*`, `react` and `ask`, and never for reads. Break it by: 31 calls of each tool; a second connection of the same account; the account limit of 120.
6. Hypothesis: no log line carries a phone, a secret, an install code, a digest, an agent name or message text. Break it by: the whole owner walk with `wrangler dev` logs (the integration test sees only Worker-side lines, not the Durable Object's).

Known gaps: the Durable Object's own log lines are not captured by `logs-redaction.test.ts` (they run outside the test isolate); the E2E cannot follow the install link because `GET /i/<code>` belongs to install-skills; a first message that is media on an active account is dropped with the `Unknown` reply and not stored, but nothing is downloaded for it; the daily trigger of the deletion sweep and of `clearExpiredInstallSecrets` waits for deploy-readiness's `runScheduled`; outbound keys use `<accountId>:<agent>` because `ConnectionIdentity` carries no connection id; the production `WHATSAPP_GRAPH_BASE_URL` is `https://graph.facebook.com` here and deploy-readiness may own it; the real Rate Limiting binding ran only inside Miniflare.

Docs: `features/whatsapp-commands`, `features/manage-your-agents` and `help/delete-your-account` exist in English and, mirrored, in `pt-br/`. They describe the install as two lines that the AI reads online; no page mentions the simulator or any fake channel.

## Security fix batch (2026-11-06)

Process notes: the L1b red commit `ead6495` printed errors that were not the assertion the plan names (it failed on missing renderer symbols), so it proves the stub, not the behaviour; no history was rewritten. Several red commits are titled `pin` because their tests were green on arrival; the tester must not count a pin as red-first.

Commits: `49f9f25` (red, pins), then the green commit of this batch.

Changed: S1 the deletion confirmation moves the account to `deleting` in D1 before the redelivery-sensitive receipt (`receive-account-message.ts`); S2 `operations/scheduled.ts`, the `scheduled` export of both entries, a daily cron (`17 3 * * *`) in `wrangler.jsonc` top level and `env.development`, and an expired install code nulls its sealed secret on resolve; S4 `account-inbox/connection-admission.ts` checks the connection and the account state in D1 at the start of every agent RPC and at every alarm, and `purge()` cancels all waiters; S6 the `account_daily_cap` alert has a test; S7 `account-inbox/account-log.ts` logs `command_received` and the connection events with ids and kinds only; V2 revoke closes the agent's open questions and routing ignores revoked agents, creating the name again forgets the old history; V6 `menu` answers in the account locale; V7 the `setState` RPC, `account_facts.state` and `resumeSuspendedAccount` are deleted; V8 option ids of rows come from `rowId` on the option, so `option-id.ts` no longer imports the accounts module; V9 the outbound guard key is `agentKey`; an unreadable sealed value resolves as unknown and logs `install_code_unreadable`; stored outbound replies keep the install link with the code masked.

Hypotheses to attack:
1. Hypothesis: a redelivered `apagar conta definitivamente` after any failure still ends in a deleted account. Break it by: failing the directory, the purge and the media delete in turn, then redelivering the same wamid.
2. Hypothesis: a revoked, suspended or deleting account gets no agent RPC and no alarm-driven send. Break it by: changing the state in D1 between two calls of a held `ask`.
3. Hypothesis: no stored message keeps a clear `zb_inst_` code. Break it by: create, rotate and a failed rotate send, then dump `inbox_messages`.
4. Hypothesis: the cron runs both jobs and either failing does not hide the other. Break it by: a deleting account whose media delete throws, with an expired code in the same run (both jobs run, and the first failure is rethrown after both).

Known gaps: `ConnectionIdentity` has no connection id, so admission and the outbound key use account and agent name; the cron trigger runs only on deployed Workers, the tests call the handler directly; D1 and R2 emptiness after deletion is asserted in integration, not in the E2E, because the E2E process cannot read the local stores; the daily trigger shares the handler deploy-readiness extends.

## Test gaps closed after the tester's first pass (pins)

All green on arrival, so each is a pin, not a red-first box. Run: `pnpm --filter @zapbip/api test:integration` and `test:unit`.

| Id | Test | Covers |
|----|------|--------|
| AK-1 | `accounts-webhook.test.ts` | an unknown phone on the real webhook route opens an active account, the first text is not stored, one `account_created` line without the phone or the text |
| AK-2, AK-3 | `mcp-rotation.test.ts` | after `girar` the old secret is `401` and the new one `200` through MCP; when the rotate reply fails to send the old secret still works |
| AK-4 | `owner-inbound.test.ts` | the 21st message logs `sender_rate_limited` once and never reaches the account object |
| AK-5 | `deletion-sweep-idle.test.ts` | a sweep with no deleting account touches no object and no bucket |
| AK-6 | `r2-media-store-key.test.ts` | put, get and delete use `accounts/<account id>/media/<media id>` |
| AK-7, AK-8 | `waitlist-binding.test.ts` | a bad `WAITLIST_ENABLED` fails the simulator request naming the flag while `/health` stays `200`; an account object built with the bad flag keeps receiving owner messages |
| AK-9, AK-10 | `account-inbox-accounts.test.ts` | a held `wait_for_reply` has no waiter by the time the revoke reply is sent; a held `ask` still has its waiter when the rotate reply is sent, then ends as `pending` and the agent is not revoked |
| (unit) | `log-event.test.ts` | `logEvent` writes one JSON line with the event and the account id; `LogFields` has no key for a secret, a digest, a phone or a text |
| (walk) | `logs-redaction.test.ts` | the whole-walk redaction now includes a failed rotate send |

Helper: `test/support/session-send-probe.ts` (fails or observes the next session send inside the account object).

Stale test-plan lines found while writing these: the bad-flag box says `/health` returns `500`, but `/health` never reads the flag; the rotated `ask` box says `Timeout`, but a cancelled `ask` returns `pending`; the box for the `connection.auth_failed` log names an event that does not exist (the code logs `auth_rejected`).
