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

- None open for `receiveAccountMessage` and the sweep; they landed in red `85ff9b1` and green `b0af45b`. The sweep is not wired to a cron (deploy-readiness owns the dispatch).
- The tombstone refusals are tested through `runInDurableObject`; a refusal thrown across the RPC boundary is reported by the Workers test pool as an unhandled error.
- `setState` persists the state but nothing reads it; the `revoked_agents` marker is not cleared when a name is created again (slice 7's standby selection decides).
- `libs/core/src/inbox/aiters.test.ts` and `use-cases/ait-for-reply.test.ts` are empty tracked files from slice 1 ("No test suite found" fails `pnpm --filter @zapbip/core test:unit`); not mine, not touched.

## Lane L1b (state gate, rule 0, use cases)

Changed: `libs/core/src/accounts/state-gate.ts`, `use-cases/*` (bodies plus new helpers `account-reply`, `usage-reply`, `install-prompt-reply`), `testing/{in-memory-accounts,fixtures}.ts`, colocated tests; additive: `libs/core/src/inbox/option-id.ts` (menu ids), `inbox/index.ts` (`flush-queue` export), `accounts/ports.ts` (`DeletionRequests.clear`), `accounts/constants.ts` (`ACCOUNT_MENU_QUESTION_ID`). Run: `pnpm --filter @zapbip/core test:unit` (the two empty files `aiters.test.ts` and `ait-for-reply.test.ts` of slice 1 report "No test suite"; not ours).

Red: `8efa6a0` (option-id: expected `['zapbip:create_agent','zapbip:help']`), `4a24b87` (28 + 10 + 6 cases: `receiveAccountMessage` / `evaluateAccountState` / `applyOwnerCommand is not implemented`), `32524b8` (`<use case> is not implemented`). Green `385c585`, `f34aa84`, `16c512f`. No pins.

For L3 (Durable Object): `DeletionRequests` is now `{ save({requestedAt}): Promise<void>; find(): Promise<number | null>; clear(): Promise<void> }`; `clear` is called when a confirmation arrives without a live request. `FirstMessageClaim.claim` is called before the state gate for every message, including deleting accounts. L3 also owns ending a held `wait_for_reply`/`ask` on `recordRevocation`/`cancelWaiters` (the core cannot, `ReplyWaiters` has no `cancelAgent`); the plan's revoke "held call resolves with Timeout" case therefore lives at the Durable Object level, not in core.

Decisions to attack:

1. `receiveAccountMessage` records the channel receipt itself for gate replies and commands, and leaves it to slice 1's `receiveOwnerMessage` for everything else (that use case records it too). A retry of a confirmed deletion returns `duplicate: true, deletionConfirmed: false`.
2. A menu (`List` reply) is sent as the rendered text, then a `Choice` message with question id `zapbip:menu`; `formatChoiceOptionIds` turns its options into `zapbip:<command>`.
3. `Created`/`Rotated` are one reply; the rendered text is split with `splitInstallPrompt` and sent in order. A failed part runs the compensation (create: revoke; rotate: compare-and-set back), then one best-effort `SendFailed`. A rotate calls `cancelWaiters` only after every part was delivered; a revoke calls `recordRevocation` inside the use case, before its reply.
4. Menu list taps use the account locale; typed keywords use the keyword's language (`applyOwnerCommand` overrides the reply locale with the command's).
5. `openOwnerAccount` returns the account only (the `created` flag of the lookup is not in its signature).
6. Reply messages are stored as `ToOwner` messages with no agent, so they never change "last agent that wrote". The test plan's "`insertMessage` not called" for waitlisted text is asserted as "no owner message stored".

Hypotheses: a quoted command word goes to the quoted agent; `girar a imagem` is a rotate of `a-imagem` (`NotFound`), `@claude girar a imagem` routes; a deleting account gets no reply; the 10-minute deletion window is inclusive; two concurrent opens of one number yield one account.

Gaps: no test for `ask` held across a rotate (Durable Object level); `pnpm verify` result is in the lead's report.
- `apps/docs/docs.json` is not in L5; until the lead adds `guides/commands`, `guides/agents-and-links` and `guides/account-deletion`, the pages are reachable by link only.
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
