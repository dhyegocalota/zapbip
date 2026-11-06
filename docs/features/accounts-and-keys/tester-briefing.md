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

## Step L5 (docs)

### What changed

- `apps/docs/guides/commands.mdx`: the command table in both languages, the menu, reserved words and the `@<agent>` escape for command words.
- `apps/docs/guides/agents-and-links.mdx`: create, list, revoke, rotate, the password warning, WhatsApp previews, the eight-agent limit.
- `apps/docs/guides/account-deletion.mdx`: the two steps, the 10-minute window, what is and is not removed, a new account after deletion.

### How to run

```bash
pnpm --filter @zapbip/docs exec mint broken-links
```

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `mint broken-links` at `7f2866b` | `found 2 broken links in 1 files`: `/guides/agents-and-links`, `/guides/account-deletion` from `guides/commands.mdx` | the three pages exist at `5ca28f1` (`success no broken links found`) |

### Hypotheses to attack

1. Hypothesis: every command word, the 8-agent limit, the 10-minute window and the `@<agent>` escape in the pages match the shipped behaviour. Break it by: comparing each page against `command-words.ts`, `constants.ts` and the simulator replies.
2. Hypothesis: the pages render in `mint dev` once the lead adds them to `docs.json`. Break it by: opening each page and following each link.

### Known gaps

- `apps/docs/docs.json` is not in L5; until the lead adds `guides/commands`, `guides/agents-and-links` and `guides/account-deletion`, the pages are reachable by link only.
