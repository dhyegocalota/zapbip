# Tester briefing: Accounts and keys

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## Step 0 (contract)

Commits: `9e57b0b` (core contract), `2a9a5fd` (pin), `21bfa12` (migration), `f1d2864` (worker contract). Plan refresh: `ed1b6ff`.

### What changed

- `libs/types/src/enums.ts` — `AccountState`, `CommandKind`, `SenderVerdict`, `RegisterOutcome`, `AccountStateOutcome`, `ReplyKind`, `AccountReplyIntent`, `AccountReplyParameter`; `IdPrefix.Account`, `IdPrefix.Connection`, `RoutingRule.AccountCommand`.
- `libs/core/src/accounts/` — constants, `COMMAND_WORDS`, types, ports (`AccountDirectory`, `ConnectionRegistry`, `ConnectionSecrets`, `InstallPromptRenderer`, `SenderGuard`, `OutboundGuard`, `ConnectionRevocations`, `AccountInboxPurge`, `AccountMediaPurge`, `FirstMessageClaim`, `DeletionRequests`, `AccountDependencies`, `AccountLifecycleDependencies`), and stubs for the grammar, copy, state gate and every use case including `receiveAccountMessage`. Exported from `libs/core/src/index.ts`.
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
- The migration is checked by hand with `sqlite3`; the automated case is S2.1 (`migration-0002.test.ts`).
- `AccountOwnerRpc` has no implementation until L3; `ReplyWaiters.cancelAgent` does not exist until L3 adds it.
- Likely merge conflicts for the lead: `apps/api/src/adapters/d1/d1-account-directory.ts` (slice 2 plans the same path), `apps/api/src/contract/{env,log}.ts` and `wrangler.jsonc` (additive hunks), `libs/core/src/index.ts` (one line).

## What changed

- <file or module> — <one line>

## How to run

```bash
<commands to start the stack and open the feature>
```

## Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `<path>::<name>` |  |  |

## Hypotheses to attack

Every "it works" is a hypothesis the tester tries to break.

1. Hypothesis: <claim>. Break it by: <suggested attack>.

## Known gaps

- <what the developer knows is missing or untested>

## Lane L1a (grammar and copy)

Changed: `libs/core/src/accounts/{command,agent-name,install-prompt-parts,account-copy}.ts` and their colocated tests. Run: `pnpm --filter @zapbip/core test:unit`.

Red `ffe19b2` (127 failed, 12 passed; the 12 are `command-words.test.ts`; no pins): `<name> is not implemented` for each function, and `expected [Function] to throw error matching /link line/ | /line/ | /empty/ but got '... is not implemented'`. Green `d742d49`.

Decisions to attack:

1. `parseAccountCommand` returns `DEFAULT_LOCALE` for menu list replies (an id carries no language); L1b should use the account locale for those.
2. Menu ids are `zapbip:` plus the `CommandKind` value (A12), e.g. `zapbip:list_agents`; the test-plan line saying `zapbip:agents` is outdated.
3. Added `formatMenuRowId` (`command.ts`) and `buildMenuButtonText({locale})` (`account-copy.ts`, "Comandos" / "Commands") for L4's list send.
4. `Created` and `Rotated` copy embeds the install prompt between intro and warning; L1b calls `splitInstallPrompt` on the rendered text.
5. `splitInstallPrompt` treats a line containing `http://` or `https://` as the link line; any line over 4080 characters throws ("link line" or "line"). Parts are `i/n` + newline + slice and rejoin exactly.
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

- `receiveAccountMessage` on the object and `accounts/deletion-sweep.ts` (with `deletion-sweep.test.ts`) are not built: they need L2's `D1AccountDirectory` and `R2AccountMedia` and L1b's green use cases.
- The tombstone refusals are tested through `runInDurableObject`; a refusal thrown across the RPC boundary is reported by the Workers test pool as an unhandled error.
- `setState` persists the state but nothing reads it; the `revoked_agents` marker is not cleared when a name is created again (slice 7's standby selection decides).
- `libs/core/src/inbox/aiters.test.ts` and `use-cases/ait-for-reply.test.ts` are empty tracked files from slice 1 ("No test suite found" fails `pnpm --filter @zapbip/core test:unit`); not mine, not touched.

