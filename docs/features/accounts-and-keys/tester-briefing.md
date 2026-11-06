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

## Lane L2 (storage, guards, secrets, operator script)

Commits: `9c20ba4` (fix: dev seed on the 0002 schema), `bd42b6d` (red), `ba3aabc` (green).

Changed: `apps/api/src/adapters/{d1/d1-account-directory,d1/d1-connection-registry,d1/d1-connection-directory,guard/sender-guard,guard/outbound-guard,platform/connection-secrets,prompt/generic-install-prompt,prompt/generic-install-prompt-copy,r2/r2-account-media}.ts`, `apps/api/scripts/operator-account.sh`, test support `fake-rate-limiter.ts`, `fake-pnpm.mjs`, `seed.ts`.

Run: `pnpm --filter @zapbip/api test:unit` and `test:integration`.

Red then green: the red run printed `<Class.method> is not implemented` for `D1AccountDirectory` (findOrCreateByWaId, findByWaId, remove), `D1ConnectionRegistry` (register, findActiveByAgent, revoke, rotate), `SenderGuard.admit`, `OutboundGuard.admit`, `R2AccountMedia.deleteAll`; 42 integration and 18 unit failures. The `resolveSecretDigest` cases failed on the missing revoked and account-state filters. Pins (green on arrival): `migration-0002.test.ts`, `wrangler-limits.test.ts`, the malformed-secret case, the digest-prefix case, the operator wa_id refusals.

Deviations:
- Dev seed kept (A2 deferred to L4): `global-setup.ts` seeds through `dev-seed.ts`; only its SQL was updated to 0002.
- `operator-account.sh suspend` applies to `active` only, so a waitlisted phone cannot reach `active` through suspend then resume. A refused transition exits 1 with the reason on stderr.
- The pattern-before-D1 step lives in `resolve-connection.ts`; the directory takes a digest.
- The `standbyAgent` generic-install-prompt cases are not covered: the Step 0 renderer takes no `standbyAgent`. They move to install-skills.

Hypotheses to attack:
1. Hypothesis: twenty concurrent first messages from one phone yield one account. Break it by: higher concurrency against the real D1 batch.
2. Hypothesis: the daily cap never orphans an owner identity. Break it by: cap reached, then the same phone twice.
3. Hypothesis: `register` never exceeds the limit. Break it by: concurrent creates across several accounts.
4. Hypothesis: the operator script cannot run SQL from a non-digit `wa_id`. Break it by: newlines, unicode digits, leading and trailing spaces.
5. Hypothesis: `deleteAll` empties the prefix and spares `acc10` when purging `acc1`.

Known gaps: the operator script was run only against a fake `pnpm` over `node:sqlite`, never `wrangler d1 execute` (owner-run). Real Rate Limiting bindings were not exercised; the guards are tested with a counting fake.
