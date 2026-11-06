# Test plan: Accounts and keys

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path). "Reply `X`" means the `AccountReplyIntent` `X` is rendered to the owner, in the locale of the command; the copy text is checked by the copy tests, not repeated here. Command words are shown exactly as the owner types them.

Test areas, each run by its own tester sub-agent: **Core unit: grammar**, **Core unit: state and use cases**, **Apps unit**, **Worker integration: D1** (the Durable Object purge sits here too), **Worker integration: inbound and MCP**, **E2E**, **Docs links**, **Security checks**, **Prove it for real**.

## Plan refresh (S0.0), 2026-11-06

Names below that differ from the boxes, settled against slice 1's code (`plan.md` → Plan refresh has the reasons). The boxes keep their inputs and outcomes; only the names move.

| Box text | Read as |
|---|---|
| ~~`libs/core/src/use-cases/*`~~, ~~`libs/core/src/testing/in-memory.ts`~~ | `libs/core/src/accounts/use-cases/*`; `libs/core/src/accounts/testing/in-memory-accounts.ts` (`createInMemoryAccountDependencies`) |
| ~~`deleteAccount`~~ | `finishAccountDeletion` (the request and confirm cases are `requestAccountDeletion`, `confirmAccountDeletion`) |
| ~~`mediaStore.deletePrefix`~~, ~~`R2MediaStore`~~ deletion | `accountMedia.deleteAll({accountId})`, adapter `R2AccountMedia` |
| ~~`RandomSource`~~ cases | Dropped: the generator is slice 1's `generateConnectionSecret`, already tested by its `connection-secret.test.ts` |
| ~~`receive-owner-message.test.ts`~~ (rule 0 and compensation) | `receive-account-message.test.ts`; slice 1's `receive-owner-message.test.ts` is only the pinned dedupe case |
| ~~`createInMemoryDependencies`~~ | `createInMemoryAccountDependencies` |
| ~~`isFirstMessage` stored with the reply~~ | `FirstMessageClaim.claim`, the first-message cases read the same outcomes |
| ~~`scheduled-sweep.test.ts`~~, ~~`r2-delete-prefix.test.ts`~~, ~~`account-inbox.test.ts`~~ | `deletion-sweep.test.ts`, `r2-account-media.test.ts`, `account-inbox-accounts.test.ts` |
| ~~`drizzle-kit check`~~ | Dropped: no Drizzle schema; the migration cases apply `0001` then `0002` |

## The failing test first

- [ ] S1a.1 red `libs/core/src/accounts/{command,agent-name,install-prompt-parts,account-copy}.test.ts` — input: the Core unit: grammar cases below; expected: each fails with `<name> is not implemented`.
- [ ] S1b.1 red `libs/core/src/accounts/state-gate.test.ts`, `libs/core/src/accounts/use-cases/apply-owner-command.test.ts` and the rule 0 cases of `libs/core/src/accounts/use-cases/receive-account-message.test.ts` — input: the cases below; expected: each fails with `evaluateAccountState is not implemented` or `applyOwnerCommand is not implemented`.
- [ ] S1b.2 red `libs/core/src/accounts/use-cases/{create-agent-connection,list-agent-connections,revoke-agent-connection,rotate-agent-connection,request-account-deletion,confirm-account-deletion,finish-account-deletion,open-owner-account}.test.ts` — input: the cases below; expected: each fails with its use-case stub message or `createInMemoryAccountDependencies is not implemented`.
- [ ] S2.1 red `apps/api/test/integration/{migration-0002,d1-accounts,d1-connections-lifecycle}.test.ts` — input: the D1 cases below; expected: each fails with `<method> is not implemented`, and the migration case fails on its assertion, not on a SQL syntax error.
- [ ] S2.2 red `apps/api/test/unit/{connection-secrets,generic-install-prompt,wrangler-limits}.test.ts` and `apps/api/test/integration/{sender-guard,r2-account-media,account-inbox-purge}.test.ts` — input: the cases below; expected: each fails with its stub message.
- [ ] S3.1 red `apps/api/test/integration/{owner-inbound,simulator-accounts,mcp-account-states,mcp-outbound,logs-redaction,waitlist-enabled}.test.ts` — input: the cases below; expected: each fails with `not implemented` or with a response other than the expected status.
- [ ] S3.3 red `apps/api/test/e2e/accounts.e2e.test.ts` — input: the first `novo agente` of the walk; expected: fails at the first create, not at `wrangler dev` startup.
- [ ] S5.1 red `apps/docs` — input: `mint broken-links` with the three guide pages linked and absent; expected: one broken link per missing page.
- [ ] `pin` (green on arrival, labelled in its red commit): slice 1's rules 1 to 6 cases in `routing.test.ts` and the dedupe case of `receive-owner-message.test.ts` run unchanged against the new contract; the `ReplyWaiters` existing methods still answer as before.
- [ ] `pin` `mint broken-links` on the existing skeleton pages (slice 1) is green before the three guide pages are added.
- [ ] Confirmed each red run failed for the right reason: the failure text recorded in `tester-briefing.md` matches the text above, and no test fails on a missing module or a typo.

## Core unit: grammar

Runner: `pnpm --filter @zapbip/core test:unit` (Vitest 5.0.5). No ports. Time is not used.

### Command matching (`libs/core/src/accounts/command.test.ts`)

- [ ] `parseAccountCommand` — input: text `agentes`; expected: `{kind: ListAgents, rawName: null, locale: pt-BR}`.
- [ ] `parseAccountCommand` — input: text `agents`; expected: `{kind: ListAgents, rawName: null, locale: en-US}`.
- [ ] `parseAccountCommand` — input: text `  AGENTES  `; expected: `{kind: ListAgents, locale: pt-BR}` (trim, lowercase).
- [ ] `parseAccountCommand` — input: text `Novo    Agente   Claude Code`; expected: `{kind: CreateAgent, rawName: 'Claude Code', locale: pt-BR}` (inner whitespace collapsed; the name keeps its case until normalised).
- [ ] `parseAccountCommand` — input: text `new agent Claude Code`; expected: `{kind: CreateAgent, rawName: 'Claude Code', locale: en-US}`.
- [ ] `parseAccountCommand` — input: text `agentes?`; expected: `null` (trailing punctuation does not match; the message routes on).
- [ ] `parseAccountCommand` — input: text `agentes.`; expected: `null`.
- [ ] `parseAccountCommand` — input: text `ajuda!`; expected: `null`.
- [ ] `parseAccountCommand` — input: text `ajuda`; expected: `{kind: Help, locale: pt-BR}`.
- [ ] `parseAccountCommand` — input: text `menu`; expected: `{kind: Help, locale: pt-BR}`.
- [ ] `parseAccountCommand` — input: text `help`; expected: `{kind: Help, locale: en-US}`.
- [ ] `parseAccountCommand` — input: text `apagar conta`; expected: `{kind: RequestDeletion, locale: pt-BR}`.
- [ ] `parseAccountCommand` — input: text `delete account`; expected: `{kind: RequestDeletion, locale: en-US}`.
- [ ] `parseAccountCommand` — input: text `apagar conta definitivamente`; expected: `{kind: ConfirmDeletion, locale: pt-BR}`.
- [ ] `parseAccountCommand` — input: text `Delete   Account   Permanently`; expected: `{kind: ConfirmDeletion, locale: en-US}`.
- [ ] `parseAccountCommand` — input: text `apagar conta definitivamente.`; expected: `null`.
- [ ] `parseAccountCommand` — input: text `apagar`; expected: `null` (a first word alone is not a command).
- [ ] `parseAccountCommand` — input: text `novo`; expected: `null`.
- [ ] `parseAccountCommand` — input: text `novo agente`; expected: `{kind: CreateAgent, rawName: '', locale: pt-BR}` and the service replies `Usage` (empty name).
- [ ] `parseAccountCommand` — input: text `novo agente    ` (trailing spaces); expected: `{kind: CreateAgent, rawName: '', locale: pt-BR}`.
- [ ] `parseAccountCommand` — input: text `revogar`; expected: `{kind: RevokeAgent, rawName: '', locale: pt-BR}` (the service replies `Usage`).
- [ ] `parseAccountCommand` — input: text `girar a imagem`; expected: `{kind: RotateAgent, rawName: 'a imagem', locale: pt-BR}` (item 17: free name, no agent intent).
- [ ] `receiveOwnerMessage` — input: `girar a imagem` in state `active` with agent `a-imagem` absent; expected: one `NotFound` reply, nothing rotated, the message is not routed to an agent (A11, item 17).
- [ ] `receiveOwnerMessage` — input: `@claude girar a imagem` with agent `claude` active; expected: rule 3 routes `girar a imagem` to `claude` with the prefix removed; no rotate happens (the escape, item 17).
- [ ] `parseAccountCommand` — input: text `girar   Foo`; expected: `{kind: RotateAgent, rawName: 'Foo', locale: pt-BR}`.
- [ ] `parseAccountCommand` — input: text `novo agente` quoted (`isQuoting: true`); expected: `null`.
- [ ] `parseAccountCommand` — input: text `agentes` quoted (`isQuoting: true`); expected: `null` (rule 2 routes it to the quoted agent).
- [ ] `parseAccountCommand` — input: `text: null`, `listReplyId: 'zapbip:agents'`; expected: `{kind: ListAgents, rawName: null}`.
- [ ] `parseAccountCommand` — input: `text: null`, `listReplyId: 'zapbip:help'`; expected: `{kind: Help}`.
- [ ] `parseAccountCommand` — input: `text: null`, `listReplyId: 'zapbip:bogus'`; expected: `{kind: Unknown, rawName: null}` (rule 0 consumes it; the reply is `Unknown`).
- [ ] `parseAccountCommand` — input: `text: null`, `listReplyId: 'q_abc123:1'`; expected: `null` (an answer to a question, left to rule 1).
- [ ] `parseAccountCommand` — input: `text: null`, `listReplyId: null`; expected: `null` (a reaction or media, never a command).
- [ ] `parseAccountCommand` — input: `text: 'ajuda'`, `listReplyId: 'q_abc123:1'`; expected: the list reply wins: `null` (list reply id is a question answer).

### Agent names and reserved words (`agent-name.test.ts`)

- [ ] `normalizeAgentName` — input: `Claude Code`; expected: `claude-code`.
- [ ] `normalizeAgentName` — input: `Ação`; expected: `acao` (NFD, combining marks removed).
- [ ] `normalizeAgentName` — input: `  -x-  `; expected: `x` (leading and trailing `-` trimmed).
- [ ] `normalizeAgentName` — input: `a___b`; expected: `a-b` (each run of characters outside `a-z0-9` becomes one `-`).
- [ ] `normalizeAgentName` — input: `!!!`; expected: `null` (empty after normalisation).
- [ ] `normalizeAgentName` — input: `   `; expected: `null`.
- [ ] `normalizeAgentName` — input: `Ajuda`; expected: `ajuda` (returned; `isReservedAgentName` decides the reply).
- [ ] `normalizeAgentName` — input: a name of exactly `AGENT_NAME_MAX_CHARS` characters of `a`; expected: the same name.
- [ ] `normalizeAgentName` — input: a name of `AGENT_NAME_MAX_CHARS + 1` characters of `a`; expected: `null` (edge: one more than the limit).
- [ ] `normalizeAgentName` — input: `1agent`; expected: `1agent` (a digit may lead).
- [ ] `normalizeAgentName` — input: `-agent`; expected: `agent` (edge: leading hyphen trimmed, not rejected).
- [ ] `isReservedAgentName` — input: each of `novo`, `new`, `agentes`, `agents`, `revogar`, `revoke`, `girar`, `rotate`, `ajuda`, `help`, `menu`, `apagar`, `delete`; expected: `true` for each.
- [ ] `isReservedAgentName` — input: `claude-code`; expected: `false`.
- [ ] `isReservedAgentName` — input: `agente`; expected: `false` (the reserved word is the first word of a command, `agente` is not one).

### Install prompt parts (`install-prompt-parts.test.ts`)

- [ ] `splitInstallPrompt` — input: a prompt of 100 characters and `maxChars` 4 096; expected: one part, equal to the prompt with the label `1/1` line.
- [ ] `splitInstallPrompt` — input: a prompt of exactly 4 096 characters with the label budget removed; expected: the parts each fit `WHATSAPP_TEXT_MAX_CHARS`.
- [ ] `splitInstallPrompt` — input: a prompt of 9 000 characters of mixed text; expected: three parts, each `i/3` label on its own line, each at most 4 096 characters, and removing the label lines and joining in order returns the exact prompt.
- [ ] `splitInstallPrompt` — input: a prompt whose link line would straddle the 4 096 limit; expected: the link line is intact in one part; the part with it is at most `WHATSAPP_TEXT_MAX_CHARS - PART_LABEL_BUDGET_CHARS` text characters.
- [ ] `splitInstallPrompt` — input: a link line longer than the label-reduced budget; expected: throws naming the link line (never split).
- [ ] `splitInstallPrompt` — input: a line exactly at the budget; expected: one part for it (edge: boundary inclusive).
- [ ] `splitInstallPrompt` — input: the longest agent name (`AGENT_NAME_MAX_CHARS` characters) in the create prompt; expected: every part of the rendered prompt is at most 4 096 characters.
- [ ] `splitInstallPrompt` — input: an empty prompt string; expected: an error with the message naming the empty prompt (not a single empty part).

### Copy (`account-copy.test.ts`)

- [ ] `renderAccountReply` — input: every `AccountReplyIntent` value with locale `pt-BR`; expected: a non-empty string for each.
- [ ] `renderAccountReply` — input: every `AccountReplyIntent` value with locale `en-US`; expected: a non-empty string for each.
- [ ] `renderAccountReply` — input: intent `Usage` with parameter `Usage` set to `novo agente <nome>`, locale `pt-BR`; expected: the text contains `novo agente <nome>` exactly.
- [ ] `renderAccountReply` — input: intent `Created` without the `InstallPrompt` parameter; expected: throws naming the missing parameter (no default text).
- [ ] `renderAccountReply` — input: `Menu` reply; expected: `kind` is `ReplyKind.List`, `menuRows` has the six ids `zapbip:create_agent`, `zapbip:list_agents`, `zapbip:revoke_agent`, `zapbip:rotate_agent`, `zapbip:help`, `zapbip:request_deletion` in that order.
- [ ] WhatsApp limits — input: every copy text of every intent in both locales; expected: each text is at most `WHATSAPP_TEXT_MAX_CHARS` characters (4 096).
- [ ] WhatsApp limits — input: every `menuRows[i].title`; expected: at most `LIST_ROW_TITLE_MAX_CHARS` (24) characters.
- [ ] WhatsApp limits — input: the list button text in both locales; expected: at most `LIST_BUTTON_TEXT_MAX_CHARS` (20) characters.
- [ ] WhatsApp limits — input: `Usage` and `Menu` for `Revoke` with the longest command word; expected: the `Usage` text is at most 4 096 characters.

## Core unit: state and use cases

Runner: `pnpm --filter @zapbip/core test:unit`. In-memory ports from `libs/core/src/accounts/testing/in-memory-accounts.ts` (over slice 1's `libs/core/src/inbox/testing/in-memory.ts`); fake clock; fake digests (`fake:<secret>`) and a fake `ConnectionSecrets` that returns the secrets in a queue.

### State gate (`state-gate.test.ts`)

- [ ] `evaluateAccountState` — input: state `waitlisted`, text `ajuda`; expected: `{outcome: Proceed}` (help works).
- [ ] `evaluateAccountState` — input: state `waitlisted`, command `RequestDeletion`; expected: `{outcome: Proceed}`.
- [ ] `evaluateAccountState` — input: state `waitlisted`, command `ConfirmDeletion`; expected: `{outcome: Proceed}` (A20).
- [ ] `evaluateAccountState` — input: state `active`, command `ConfirmDeletion`; expected: `{outcome: Proceed}` (A20).
- [ ] `evaluateAccountState` — input: state `suspended`, command `ConfirmDeletion`; expected: `{outcome: Reply, intent: Suspended}`.
- [ ] `evaluateAccountState` — input: state `waitlisted`, command `CreateAgent`; expected: `{outcome: Reply, intent: Waitlisted}`.
- [ ] `evaluateAccountState` — input: state `waitlisted`, plain text `oi`; expected: `{outcome: Reply, intent: Waitlisted}` (not stored, checked in the use-case test).
- [ ] `evaluateAccountState` — input: state `suspended`, text `oi`; expected: `{outcome: Reply, intent: Suspended}`.
- [ ] `evaluateAccountState` — input: state `suspended`, command `Help`; expected: `{outcome: Reply, intent: Suspended}` (nothing works).
- [ ] `evaluateAccountState` — input: state `deleting`, text `oi`; expected: `{outcome: Drop, intent: null}`.
- [ ] `evaluateAccountState` — input: state `deleting`, command `ConfirmDeletion`; expected: `{outcome: Drop, intent: null}` (the Worker resumes deletion, the state gate sends nothing).
- [ ] `evaluateAccountState` — input: state `active`, text `oi`; expected: `{outcome: Proceed}`.
- [ ] `evaluateAccountState` — input: state `active`, a first non-text message (`isFirstMessage: true`, `isText: false`); expected: `{outcome: Reply, intent: Unknown}` (A10).
- [ ] `evaluateAccountState` — input: state `waitlisted`, a first non-text message; expected: `{outcome: Reply, intent: Waitlisted}` (the waitlist reply wins over the unknown reply).
- [ ] Retry of a first non-text message (item 18) — input: the same media delivery (same `channelMessageId`) delivered twice, the second after the first committed; expected: both calls have `isFirstMessage: true`, the reply `Unknown` is sent once per committed attempt, nothing is stored, and `first_message_id` is unchanged.
- [ ] A second, different first-kind message after the first committed (item 18) — input: a media message with a new `channelMessageId`; expected: `isFirstMessage: false`, the message is routed and stored.
- [ ] `evaluateAccountState` — input: state `active`, a non-text message from an existing account (`isFirstMessage: false`, `isText: false`); expected: `{outcome: Proceed}` (media from an existing owner routes as usual).

### Rule 0 and rules 1 to 6 (`apply-owner-command.test.ts`, `receive-owner-message.test.ts`)

- [ ] `receiveOwnerMessage` — input: an agent `a1` has an open question and the owner sends `agentes`; expected: rule 0 answers with `Listed` or `EmptyList`; the question stays open; `a1` receives nothing.
- [ ] `receiveOwnerMessage` — input: `agentes` sent as a text with two agents with open questions; expected: the message is not routed; the question of the newest agent is unchanged.
- [ ] `receiveOwnerMessage` — input: `agentes` sent after an agent `a1` wrote within the window; expected: rule 5 still picks `a1` for the next plain text, so the command did not change "last agent that wrote".
- [ ] `receiveOwnerMessage` — input: the owner quotes an agent message `a1` and types `agentes`; expected: rule 2 routes the text to `a1`; no `Listed` reply; `messageId` is not `null`.
- [ ] `receiveOwnerMessage` — input: the owner taps the `Choice` `q_abc123:1` answering `a1`; expected: rule 1 answers `a1`; rule 0 does not run.
- [ ] `receiveOwnerMessage` — input: the owner taps the list row `zapbip:agents`; expected: rule 0 runs `listAgentConnections`; `messageId` is `null`; one `Listed` reply.
- [ ] `receiveOwnerMessage` — input: the same inbound message delivered twice (same `messageId`); expected: the second call returns the first result and sends nothing new (dedupe as agent-inbox-core).
- [ ] `receiveOwnerMessage` — input: `apagar conta definitivamente` in state `active` with no pending request; expected: `deletionConfirmed: false`, one `DeletionExpired` reply, nothing deleted.
- [ ] `receiveOwnerMessage` — input: `apagar conta` at T, then `apagar conta definitivamente` at T + 10 min; expected: `deletionConfirmed: true` (edge: exactly the TTL is accepted).
- [ ] `receiveOwnerMessage` — input: `apagar conta` at T, then `apagar conta definitivamente` at T + 10 min + 1 ms; expected: `deletionConfirmed: false`, `DeletionExpired` reply, `deletion_requested_at` cleared.
- [ ] `receiveOwnerMessage` — input: `apagar conta definitivamente` in state `waitlisted` after `apagar conta`; expected: `deletionConfirmed: true` (A20).
- [ ] `receiveOwnerMessage` — input: `apagar conta definitivamente` in state `suspended`; expected: one `Suspended` reply; `deletionConfirmed: false`.
- [ ] `receiveOwnerMessage` — input: the list tap `zapbip:confirm_deletion`; expected: one `Unknown` reply, `deletionConfirmed: false`, no deletion (A12).
- [ ] `receiveOwnerMessage` — input: the list tap `zapbip:request_deletion`; expected: one `DeletionRequest` reply with the phrase, `deletion_requested_at` set.
- [ ] `receiveOwnerMessage` — input: `apagar conta` in state `active`; expected: `deletionConfirmed: false`, one `DeletionRequest` reply that contains the phrase `apagar conta definitivamente`, account state unchanged.
- [ ] `receiveOwnerMessage` — input: a plain text `oi` in state `waitlisted`; expected: one `Waitlisted` reply; `repository.insertMessage` not called.
- [ ] `receiveOwnerMessage` — input: a plain text `oi` in state `suspended`; expected: one `Suspended` reply; nothing stored; no agent receives a message.
- [ ] `receiveOwnerMessage` — input: `ajuda` with a list of the commands; expected: one `Menu` reply whose list rows have ids `zapbip:create_agent`, `zapbip:list_agents`, `zapbip:revoke_agent`, `zapbip:rotate_agent`, `zapbip:help`, `zapbip:request_deletion` in that order.
- [ ] `receiveOwnerMessage` — input: `zapbip:create_agent` list tap; expected: one `Usage` reply with `novo agente <nome>`, nothing created.
- [ ] `receiveOwnerMessage` — input: `zapbip:revoke_agent` list tap; expected: one `Usage` reply with `revogar <nome>`, nothing revoked.
- [ ] `receiveOwnerMessage` — input: `zapbip:rotate_agent` list tap; expected: one `Usage` reply with `girar <nome>`, nothing rotated.
- [ ] `receiveOwnerMessage` — input: `zapbip:bogus` list tap; expected: one `Unknown` reply, `messageId` `null`.
- [ ] `receiveOwnerMessage` — input: `zapbip:confirm_deletion` list tap; expected: one `Unknown` reply (A12, only the six menu ids are commands).
- [ ] `receiveOwnerMessage` — input: the zero-agent case with a plain text in state `active`; expected: rule 6 notice, the message is held (agent-inbox-core rule 6 unchanged).
- [ ] `receiveOwnerMessage` — input: a first message from a `waId` starting with `55` in state `active`; expected: the account locale is `pt_BR` and the rule 6 question is in `pt_BR`.
- [ ] `receiveOwnerMessage` — input: a first message from a `waId` starting with `1` in state `active`; expected: the account locale is `en_US`, and `new agent x` answered in en-US, after which the account locale is still `en_US` (commands do not change it, A18).
- [ ] `receiveOwnerMessage` — input: a plain text after `novo agente x` from a `waId` starting with `55`; expected: the rule 6 question is in `pt_BR` (the account locale, not the keyword's).

## Core unit: use cases

Runner: `pnpm --filter @zapbip/core test:unit`.

### Opening the account (`open-owner-account.test.ts`)

- [ ] `openOwnerAccount` — input: no account for `waId`, `waitlistEnabled: true`; expected: an account in state `waitlisted`, `created: true`, locale `pt_BR` when the `waId` starts with `55` (A18).
- [ ] `openOwnerAccount` — input: no account for `waId`, `waitlistEnabled: false`; expected: an account in state `active`.
- [ ] `openOwnerAccount` — input: an account exists for `waId`; expected: the same `accountId`, `created: false`, no new row.
- [ ] `openOwnerAccount` — input: 50 accounts created in the last 24 h, a new `waId`; expected: `null` (daily cap), no account row added.
- [ ] `openOwnerAccount` — input: 50 accounts created 24 h and 1 ms ago, a new `waId`; expected: an account is created (the window has moved).
- [ ] `openOwnerAccount` — input: 49 accounts created in the last 24 h, a new `waId`; expected: an account is created (edge: one below the limit).
- [ ] `openOwnerAccount` — input: two calls for the same new `waId`; expected: one account row; both calls return the same `accountId`.

### Create (`create-agent-connection.test.ts`)

- [ ] `createAgentConnection` — input: `rawName: 'Claude Code'`, no agents; expected: one active connection `claude-code`, the reply `Created` with the install prompt parameter, the prompt contains the link `<publicOrigin>/c/<secret>/mcp` with the issued secret.
- [ ] `createAgentConnection` — input: `rawName: 'Ajuda'`; expected: reply `ReservedName`, no connection created.
- [ ] `createAgentConnection` — input: `rawName: '!!!'`; expected: reply `InvalidName`, no connection created.
- [ ] `createAgentConnection` — input: `rawName` of `AGENT_NAME_MAX_CHARS + 1` characters; expected: reply `InvalidName`, no connection created.
- [ ] `createAgentConnection` — input: `rawName: 'claude'` when an active `claude` exists; expected: reply `NameTaken`, the secret is not issued (the fake `ConnectionSecrets` queue is unchanged).
- [ ] `createAgentConnection` — input: `claude` is revoked and created again; expected: a second active `claude`, a different digest, `Created`.
- [ ] `createAgentConnection` — input: `AGENTS_PER_ACCOUNT_LIMIT` active agents; expected: reply `LimitReached` with the `Limit` parameter `8`, no connection created.
- [ ] `createAgentConnection` — input: `AGENTS_PER_ACCOUNT_LIMIT - 1` active agents and one revoked; expected: `Created` (edge: the revoked one does not count).
- [ ] `createAgentConnection` — input: send of the prompt fails (fake sender throws); expected: the use case returns the failure to the caller; the caller revokes the row (compensation); after the compensation `listAgentConnections` shows no active `claude`, and the secret never appears in the returned error.
- [ ] `createAgentConnection` — input: the in-memory `register` returns `NameTaken` (a race lost); expected: reply `NameTaken`, the issued secret is discarded (never sent).

### List (`list-agent-connections.test.ts`)

- [ ] `listAgentConnections` — input: no agents; expected: reply `EmptyList`.
- [ ] `listAgentConnections` — input: `a1` and `b2` active, `c3` revoked; expected: reply `Listed` with the names `a1` and `b2` and their creation dates, no secret and no digest in any parameter.
- [ ] `listAgentConnections` — input: the parameters of the list reply; expected: no value matches `zb_conn_` or a 64-character hex string.

### Revoke (`revoke-agent-connection.test.ts`)

- [ ] `revokeAgentConnection` — input: `rawName: 'claude'` active; expected: `revokedAt` set to `clock.now()`, reply `Revoked`, `resolveSecretDigest` for the old digest returns `null`.
- [ ] `revokeAgentConnection` — input: `rawName: 'claude'` already revoked; expected: reply `NotFound`, `revokedAt` unchanged.
- [ ] `revokeAgentConnection` — input: `rawName: 'nope'`; expected: reply `NotFound`.
- [ ] `revokeAgentConnection` — input: `rawName: 'agentes'` (reserved); expected: reply `NotFound` (A11), no change.
- [ ] `revokeAgentConnection` — input: `rawName: 'Claude Code'` with `claude-code` active; expected: revokes `claude-code` (normalised).
- [ ] `revokeAgentConnection` — input: `rawName: ''`; expected: reply `Usage`, no change (the command parser handles the empty name; the use case treats it as usage).
- [ ] `revokeAgentConnection` — input: `claude` active with its wake setting set; expected: `revocations.recordRevocation({accountId, agent: 'claude'})` called exactly once; `cancelWaiters` not called; the fake wake state for `claude` is cleared (A22).
- [ ] `revokeAgentConnection` — input: `claude` active with a live `wait_for_reply` held by `claude`; expected: the held call resolves at once with `ReplyStatus.Timeout`, before the revoke reply is sent.

### Rotate (`rotate-agent-connection.test.ts`)

- [ ] `rotateAgentConnection` — input: `claude` active; expected: digest changed from the old to the new, reply `Rotated` with the new `InstallPrompt`; `resolveSecretDigest` for the old digest returns `null` at once.
- [ ] `rotateAgentConnection` — input: `claude` revoked; expected: reply `NotFound`, digest unchanged.
- [ ] `rotateAgentConnection` — input: send of the new prompt fails; expected: compare-and-set back from the new digest to the old, `resolveSecretDigest` for the old digest returns the connection again, the new digest resolves to `null`.
- [ ] `rotateAgentConnection` — input: two rotations of `claude` issued from the same old digest (lost race); expected: the second `rotate` returns `false`; reply `NotFound` or a retry message; the stored digest is the first rotation's digest.
- [ ] `rotateAgentConnection` — input: `rotate` called after `revoke` in the same call sequence; expected: reply `NotFound`, digest unchanged.
- [ ] `rotateAgentConnection` — input: `claude` active with its wake setting set; expected: `revocations.cancelWaiters({accountId, agent: 'claude'})` called exactly once after the new prompt is sent; `recordRevocation` not called; the wake setting is unchanged (A22).
- [ ] `rotateAgentConnection` — input: `claude` active with a live `ask` held by `claude`; expected: the held call resolves with `ReplyStatus.Timeout` after the rotate reply is sent; the agent is not marked revoked.
- [ ] `rotateAgentConnection` — input: the new prompt send fails; expected: `cancelWaiters` not called (the waiter is still live, because the rotation was undone).

### Deletion (`delete-account.test.ts`)

- [ ] `deleteAccount` — input: account with two agents, two media objects under `accounts/<id>/`, and an inbox; expected: the calls happen in the order accounts state `deleting`, inbox `purge`, media `deleteAll`, remove; afterward the in-memory repositories hold no row for the account.
- [ ] `deleteAccount` — input: `inboxPurge.purge` throws once; expected: the call throws; account state remains `deleting`; a second `deleteAccount` call completes every step; the end state equals the single-run end state.
- [ ] `deleteAccount` — input: `accountMedia.deleteAll` throws once; expected: as above (`deleting` remains; the next call finishes).
- [ ] `deleteAccount` — input: called twice in a row on a completed deletion; expected: the second call returns without error and sends nothing.
- [ ] `deleteAccount` — input: an account with no agents and no media; expected: the account row is removed and the owner identity row is removed.
- [ ] `deleteAccount` — input: another account's connections and media; expected: unchanged (account isolation in the in-memory adapters).
- [ ] `deleteAccount` — input: deletion completes; a new owner message from the same `waId`; expected: `openOwnerAccount` creates a new account (`created: true`) in the waitlist or active state as the flag says.

### In-memory adapters (`accounts/testing/in-memory-accounts.ts`)

- [ ] `createInMemoryAccountDependencies` — input: no arguments; expected: an `AccountDependencies` whose `accounts`, `connections` and `connectionSecrets` report the same results as the Worker D1 adapters for the cases above (the mirror `describe` block of the Worker integration tests calls the same case names).

## Apps unit

Runner: `pnpm --filter @zapbip/api test:unit` (Vitest 4.1.12 in `apps/api`).

- [ ] `issue()` — input: the `ConnectionSecrets` adapter; expected: `secret` matches `CONNECTION_SECRET_PATTERN`, `secret` has the `zb_conn_` prefix and exactly 43 base64url characters after it.
- [ ] `issue()` — input: 1 000 issues; expected: 1 000 distinct secrets, all matching `CONNECTION_SECRET_PATTERN`.
- [ ] `issue()` — input: the base64url alphabet check on 1 000 secrets; expected: no `+`, `/` or `=` character.
- [ ] `issue()` — input: `digest` of an issued secret; expected: 64 lowercase hexadecimal characters equal to `hashConnectionSecret({secret})`.
- [ ] `hashConnectionSecret` — input: the same secret twice; expected: identical digests (determinism).
- [ ] `hashConnectionSecret` — input: the same secret without the `zb_conn_` prefix; expected: a different digest (the prefix is part of the hashed string).
- ~~`RandomSource.bytes` — input: `length: 32`; expected: a `Uint8Array` of length 32.~~ Struck: the `RandomSource` port is dropped (plan.md → Plan refresh).
- ~~`RandomSource.bytes` — input: `length: 0`; expected: an empty `Uint8Array` (edge).~~ Struck: same reason.
- [ ] `isWaitlistEnabled` (`apps/api/src/config/waitlist-enabled.ts`) — input: `'true'`; expected: `true`.
- [ ] `isWaitlistEnabled` — input: `'false'`; expected: `false`.
- [ ] `isWaitlistEnabled` — input: `undefined`; expected: throws naming `WAITLIST_ENABLED`.
- [ ] `isWaitlistEnabled` — input: `''`; expected: throws.
- [ ] `isWaitlistEnabled` — input: `'yes'`; expected: throws.
- [ ] `isWaitlistEnabled` — input: `'TRUE'`; expected: throws (exact values only).
- [ ] Bad flag per request (item 16) — input: `WAITLIST_ENABLED` `'yes'` in the Worker bindings; expected: `GET /health` and `POST /dev/owner/<phone>/messages` both return `500` naming `WAITLIST_ENABLED`; module import succeeds (no module-scope read).
- [ ] Durable Object does not read the flag (item 16) — input: a Durable Object instance constructed with `WAITLIST_ENABLED` `'yes'`; expected: construction succeeds and `receiveOwnerMessage` works from the state the Worker passed in.
- [ ] `wrangler-limits` — input: `apps/api/wrangler.jsonc` parsed; expected: the `OWNER_RATE_LIMITER` `simple.limit` equals `OWNER_MESSAGES_PER_MINUTE` (20), `OUTBOUND_RATE_LIMITER` equals `OUTBOUND_MESSAGES_PER_MINUTE` (30), both `simple.period` equal `RATE_LIMIT_PERIOD_MS / ONE_SECOND_MS` (60).
- [ ] `wrangler-limits` — input: the `vars.WAITLIST_ENABLED` of each environment; expected: production `"true"`; staging and top-level development `"false"`.
- [ ] `generic-install-prompt` — input: `agent: claude`, a link, `locale: en-US`, `standbyAgent: null`; expected: the text contains the link once, the password warning, and no `null` text.
- [ ] `generic-install-prompt` — input: `standbyAgent` not null; expected: throws (slice 5 supplies it, this slice never passes one).
- [ ] `logEvent` — input: an event with `fields: {accountId}` only; expected: one structured line with the event name and the id, no other keys.
- [ ] `logEvent` — input: a field whose value is a `zb_conn_` string; expected: type error at compile time (the `LogFields` type has no such key); the runtime value is not written (checked by the redaction integration test).

## Worker integration: D1

Runner: `pnpm --filter @zapbip/api test:integration` (`@cloudflare/vitest-pool-workers`, D1 applied from `apps/api/migrations`).

### Migration and schema (`migration-0002.test.ts`)

- [ ] Migration `0002` — input: an empty D1 with `0001` applied; expected: after `0002`, the tables `accounts`, `owner_identities`, `connections`, `blocked_phones` exist with the spec's columns (`PRAGMA table_info` matches).
- [ ] Migration `0002` — input: `accounts.state` set to `'banned'`; expected: the insert fails with a CHECK constraint error.
- [ ] Migration `0002` — input: two active rows with the same `(account_id, agent)`; expected: the second insert fails on `connections_active_agent`.
- [ ] Migration `0002` — input: a revoked row and an active row with the same `(account_id, agent)`; expected: both inserts succeed (the partial index ignores revoked rows).
- [ ] Migration `0002` — input: two rows with the same `secret_digest`; expected: the second insert fails on the UNIQUE constraint.
- [ ] Migration `0002` — input: a `connections` row whose `account_id` names no `accounts` row; expected: the insert fails on the foreign key.
- ~~Migration `0002` — input: `drizzle-kit check` on `schema.ts`; expected: no drift reported.~~ Struck: no Drizzle schema in slice 1. Replaced by: Migration `0002` — input: `0001` with one `message_index` row applied, then `0002`; expected: the migration applies without a foreign key error, and `message_index`, `accounts`, `owner_identities`, `connections` and `blocked_phones` exist with the spec's columns.

### Accounts directory (`d1-accounts.test.ts`)

- [ ] `findOrCreateByWaId` — input: `waId: '5511900000000'`, `initialState: waitlisted`, `createdAt: 1000`, no account; expected: `{account: {state: waitlisted, locale: pt-BR}, created: true}`; one row in `accounts`, one in `owner_identities`.
- [ ] `findOrCreateByWaId` — input: the same `waId` again; expected: `{created: false}` and the same `accountId`; no new row in either table.
- [ ] `findOrCreateByWaId` — input: 20 concurrent calls for the same new `waId`; expected: every call returns the same `accountId`; `SELECT COUNT(*) FROM accounts` is `1`; `SELECT COUNT(*) FROM owner_identities` is `1` (the A13 no-orphan rule).
- [ ] `findOrCreateByWaId` — input: 50 accounts with `created_at` 1 ms inside the window and a new `waId` with `newAccountsCap: {since, limit: 50}`; expected: `null`; no row added to either table.
- [ ] `findOrCreateByWaId` — input: 50 accounts with `created_at` before `since` and a new `waId`; expected: `{created: true}` (the window moved).
- [ ] `findOrCreateByWaId` — input: an existing `waId` while the daily cap is reached; expected: `{created: false}` (the cap does not block an existing owner).
- [ ] `findByWaId` — input: an unknown `waId`; expected: `null`.
- [ ] `setState` — input: `accountId` to `suspended`; expected: `findByWaId` returns `state: 'suspended'`; the audit `account.state_changed` log has the account id and no phone.
- [ ] `remove` — input: an account with two connections, two `message_index` rows and an owner identity; expected: the batch deletes `message_index` first, then `owner_identities`, `connections`, `accounts`; zero rows remain for that account in all four tables (A7, decision 1).
- [ ] `remove` — input: a forced failure in the batch after the `message_index` delete; expected: no row removed (atomic); the account is still in state `deleting`.
- [ ] `remove` — input: a forced failure in the second statement of the batch (the `connections` delete); expected: no row removed (the batch is atomic); the account still exists in state `deleting`.

### Connections directory and lifecycle (`d1-connections-lifecycle.test.ts`)

- [ ] `resolveSecretDigest` — input: an active connection of an active account; expected: `{accountId, agent}`.
- [ ] `resolveSecretDigest` — input: a revoked connection; expected: `null`.
- [ ] `resolveSecretDigest` — input: a digest with no row; expected: `null`.
- [ ] `resolveSecretDigest` — input: an active connection of a `suspended` account; expected: `null`.
- [ ] `resolveSecretDigest` — input: an active connection of a `deleting` account; expected: `null`.
- [ ] `resolveSecretDigest` — input: an active connection of a `waitlisted` account; expected: `null` (no agents before the sale).
- [ ] `resolveSecretDigest` — input: the account is changed to `active` after a call that returned `null`; expected: the next call returns the identity (nothing is cached).
- [ ] `register` — input: 7 active agents, `activeLimit: 8`; expected: `Registered`; 8 active rows.
- [ ] `register` — input: 8 active agents; expected: `LimitReached`; still 8 active rows.
- [ ] `register` — input: 8 active and 1 revoked; expected: `LimitReached` for a ninth active name; the revoked row is not counted.
- [ ] `register` — input: 20 concurrent `register` calls with `activeLimit: 8` and 0 active agents, distinct names; expected: exactly 8 `Registered` and 12 `LimitReached`; exactly 8 active rows.
- [ ] `register` — input: two concurrent `register` calls with the same active name; expected: one `Registered`, one `NameTaken`.
- [ ] `register` — input: a revoked `claude` and a new `claude`; expected: `Registered`.
- [ ] `findActiveByAgent` — input: an active `claude`; expected: the record with the digest; for a revoked one: `null`.
- [ ] `listActive` — input: two active and one revoked; expected: two records ordered by `created_at` ascending.
- [ ] `revoke` — input: an active `claude`; expected: `true`, `revoked_at` set; a second `revoke` returns `false`.
- [ ] `rotate` — input: `fromDigest` equal to the stored digest; expected: `true`; the stored digest is `toDigest`; `resolveSecretDigest(fromDigest)` is `null` at once.
- [ ] `rotate` — input: `fromDigest` not equal to the stored digest; expected: `false`; the stored digest is unchanged.
- [ ] `rotate` — input: 2 concurrent rotations from the same `fromDigest`; expected: exactly one `true`.
- [ ] `rotate` — input: rotation to a `toDigest` already used by another connection; expected: fails on the UNIQUE constraint and returns `false` or throws a typed error (the spec's digest UNIQUE holds).
- [ ] Owner's `wa_id` — input: a full D1 dump after the lifecycle walk (create, rotate, revoke, delete account for one `waId`); expected: the `waId` string appears only in `owner_identities` and `blocked_phones` (here: zero rows after deletion).
- [ ] Secret never stored — input: a full D1 dump after create and rotate; expected: no value matches `zb_conn_` and no `secret` value appears; only 64-character hex digests in `connections.secret_digest`.

### Blocklist and sender guard (`sender-guard.test.ts`)

- [ ] `SenderGuard.admit` — input: `waId` listed in `blocked_phones`; expected: `Blocked`; the Rate Limiting binding is called 0 times.
- [ ] `SenderGuard.admit` — input: `waId` not listed; the binding returns success; expected: `Admitted`.
- [ ] `SenderGuard.admit` — input: `waId` not listed; the binding returns failure; expected: `RateLimited`.
- [ ] `SenderGuard.admit` — input: the 21st call within a minute for the same `waId` (binding limit 20); expected: `RateLimited` on the 21st call and `Admitted` for the first 20.
- [ ] `SenderGuard.admit` — input: `waId` blocked after 5 admitted calls; expected: `Blocked` from the next call on (the blocklist is read every time).
- [ ] `OutboundGuard.admit` — input: 30 calls for one `connectionId` in a minute, then one more; expected: 30 `Admitted`, then `RateLimited`; a different `connectionId` of the same account is `Admitted` while the account total is under 120.
- [ ] `OutboundGuard.admit` — input: 120 admitted calls across three connections of one account in a minute, then one more on a fourth connection; expected: the 121st is `RateLimited` (per-account limit, A16, decision 15); another account is `Admitted`.

### R2 media prefix (`r2-account-media.test.ts`)

- [ ] `deleteAll` — input: `accountId: acc1`, 2 500 objects under `accounts/acc1/` and 3 under `accounts/acc2/`; expected: after the call, zero objects under `accounts/acc1/`, three under `accounts/acc2/`.
- [ ] `deleteAll` — input: an account with no objects; expected: no object deleted, no error.
- [ ] `deleteAll` — input: called twice; expected: the second call deletes nothing and does not throw.
- [ ] `deleteAll` — input: `accountId: acc1` while `accounts/acc10/media/x` exists; expected: the `acc10` object remains (the adapter appends the trailing `/`).
- [ ] `put` and `get` — input: a media put by the account's `R2MediaStore(accountId: acc1)`; expected: the key is `accounts/acc1/media/<mediaId>` (cross-slice R2 key).

### Durable Object purge (`account-inbox-purge.test.ts`)

- [ ] `purge` — input: an inbox with messages, questions, media rows, a `deletion_requested_at` and a scheduled alarm; expected: `ctx.storage` holds only the tombstone key after `purge`; `getAlarm()` returns `null`.
- [ ] `purge` tombstone — input: `receiveOwnerMessage`, `requestDeletion`, `recordRevocation`, `cancelWaiters` and `setState` called after `purge`; expected: each throws `AccountTombstoned`; storage unchanged.
- [ ] `purge` — input: `purge` called twice; expected: no error; the tombstone is still the only key.
- [ ] `purge` — input: called on an already purged inbox; expected: no error.
- [ ] `alarm` after `purge` — input: `runDurableObjectAlarm` on the purged instance; expected: nothing is written; no error.

### Operator script (`operator-script.test.ts`, `apps/api/scripts/operator-account.sh`)

- [ ] `operator-account.sh suspend 5511900000000` — input: a digits-only `wa_id`; expected: one `UPDATE accounts SET state = 'suspended'` statement with the digits inlined, exit 0.
- [ ] `operator-account.sh suspend 55-11-9` — input: a `wa_id` with punctuation; expected: exit non-zero, no `wrangler` call.
- [ ] `operator-account.sh block "1' OR '1'='1"` — input: an injection string; expected: exit non-zero, no `wrangler` call (A24, digits only `^[0-9]{8,15}$`).
- [ ] `operator-account.sh block 123` — input: 3 digits; expected: exit non-zero (below 8 digits).
- [ ] `operator-account.sh resume 5511900000000` — input: an account in `active`; expected: zero rows changed, the script reports `not suspended`, nothing else changes (A7).
- [ ] `operator-account.sh resume 5511900000000` — input: an account in `suspended`; expected: state `active`; `deleting` accounts are never selected by this statement.
- [ ] `operator-account.sh delete 5511900000000` — input: an `active` account; expected: state `deleting`; no R2 or Durable Object call is made by the script (the daily sweep finishes it).
- [ ] `operator-account.sh block` and `suspend` in the runbook order — input: an abusive phone; expected: `blocked_phones` row first, then `suspended`; `unblock` and `resume` reverse both.

### Daily sweep (`deletion-sweep.test.ts`)

- [ ] `finishDeletingAccounts` — input: two `deleting` accounts and one `suspended` account; expected: both `deleting` accounts finished (no rows in D1, R2 prefixes empty, storage holds only the tombstone); the `suspended` account is untouched.
- [ ] `finishDeletingAccounts` — input: a `deleting` account whose purge failed last run; expected: the sweep finishes it, the account is absent afterwards.
- [ ] `finishDeletingAccounts` — input: no `deleting` accounts; expected: no call to any port.
- [ ] `finishDeletingAccounts` — input: run twice; expected: the second run finds nothing and succeeds.

### Schema and migration path (apps)

- [ ] Migration `0002` applies after `0001` on an empty database and the seeded development data is gone (the rebuild drops development rows; spec).

## Worker integration: inbound and MCP

Runner: `pnpm --filter @zapbip/api test:integration`. The WhatsApp channel is the fake sender (slice 2 fake), the Rate Limiting binding is the test double from `apps/api/test/support/`.

### Owner inbound orchestrator (`owner-inbound.test.ts`)

- [ ] Blocked phone — input: `waId` in `blocked_phones`, text `novo agente x`; expected: the response is `200`; no `accounts` row for the phone; no DO call; log `sender.blocked` with no phone.
- [ ] Over the rate limit — input: 21 owner messages in one minute from the same `waId`; expected: messages 1 to 20 reply; message 21 is silently dropped (`200`, no reply), logged `sender.rate_limited`; the window is not opened for message 21 (checked on the DO screen).
- [ ] Daily cap — input: 50 accounts created in the window and a new `waId` sends `oi`; expected: `200`, no reply, no account row, log `account.daily_cap`.
- [ ] First message — input: a new `waId` sends `oi` with `WAITLIST_ENABLED` `'true'`; expected: one account in `waitlisted`; the reply is `Waitlisted`; nothing stored.
- [ ] First message active — input: a new `waId` sends `oi` with `WAITLIST_ENABLED` `'false'`; expected: one account in `active`; the reply is `Unknown` (no agents, plain text; rule 6 notice held per agent-inbox-core).
- [ ] Two first messages at once — input: two concurrent first messages from one new `waId`; expected: one account row; both return `200`; one DO receives both (or the second is a duplicate by message id).
- [ ] Duplicate delivery — input: the same WhatsApp message id delivered twice with `novo agente x`; expected: one connection `x`; the second delivery replies nothing new.
- [ ] Deleting account — input: an owner message `oi` to an account in `deleting`; expected: `deleteAccount` runs (idempotent); no reply sent; `200`.
- [ ] Confirmation order — input: `apagar conta definitivamente` in `active`; expected: the confirmation reply is in the fake sender log before the account state changes to `deleting`; afterwards the account row is gone.
- [ ] Media first message — input: a first message of kind image from a new `waId` in `active`; expected: the account is created; the reply is `Unknown`; no R2 object is written under `accounts/<id>/`; no `messages` row.
- [ ] Unknown phone on the webhook path (slice 2) — input: `from` with no account and the flag `false`; expected: an account is created (replaces slice 2's "no row → stop" rule from this slice on).
- [ ] D1 unavailable — input: the D1 binding throws on the account lookup; expected: `5xx`, no reply, no secret issued, no DO call.

### Simulator (`simulator-accounts.test.ts`)

- [ ] Simulator create — input: `POST /dev/owner/5511900000000/messages` with `{kind: "text", text: "novo agente claude"}` in development (`index.dev.ts`); expected: `200`; `GET /dev/owner/5511900000000/screen` lists the install prompt in one or more parts with a `1/n` label.
- [ ] Simulator list — input: after the create, `agentes`; expected: the screen lists `claude` with a date and no `zb_conn_` value.
- [ ] Simulator production entry — input: `POST /dev/owner/5511900000000/messages` against `index.ts`; expected: `404`.
- [ ] Simulator — input: the owner phone path parameter `not-a-phone`; expected: `400` with no account created.
- [ ] Simulator — input: a text on the screen after `apagar conta definitivamente`; expected: the screen shows the confirmation then no account for the phone.

### MCP account states (`mcp-account-states.test.ts`)

- [ ] MCP — input: the secret of a connection whose account is `suspended`, `tools/call` `check_inbox`; expected: `401` with `UNAUTHORIZED_BODY`.
- [ ] MCP — input: the secret of a connection whose account is `deleting`; expected: `401` with `UNAUTHORIZED_BODY`.
- [ ] MCP — input: the secret of a revoked connection; expected: `401` with `UNAUTHORIZED_BODY`, the same bytes as an unknown secret.
- [ ] MCP — input: an unknown secret with the `zb_conn_` prefix; expected: `401` with `UNAUTHORIZED_BODY`.
- [ ] MCP — input: a value without the `zb_conn_` prefix; expected: `401`, and the D1 binding call count is 0 (the prefix check precedes the read).
- [ ] MCP — input: the secret after `girar claude`, the old secret; expected: `401` on the next request.
- [ ] MCP — input: the new secret from the rotate prompt; expected: `200` and a valid `check_inbox` result.
- [ ] MCP — input: the secret of a connection after the account is set back to `active` by the operator; expected: `200` (no cache).

### MCP outbound (`mcp-outbound.test.ts`)

- [ ] `send_message` — input: 30 calls in one minute for one connection; expected: all `ok`.
- [ ] `send_message` — input: the 31st call in the same minute; expected: MCP tool error with the error code `rate_limited`; no WhatsApp send; the DO is not called.
- [ ] `send_message` — input: the 31st call for a second connection of the same account; expected: `ok` (the limit is per connection).
- [ ] `check_inbox` — input: 31 calls in one minute; expected: all `ok` (only `send_*`, `react`, `ask` count toward the outbound limit).

### Logs and redaction (`logs-redaction.test.ts`)

- [ ] Logs over the whole walk — input: the captured `console` output of: create, `agentes`, `girar`, a rotate send failure, `revogar`, a blocked phone, a rate-limited phone, deletion; expected: no captured line contains `zb_conn_`, a 64-character hex string, the owner phone digits, an agent name, or the text `novo agente`.
- [ ] MCP route log — input: a request to `/c/<secret>/mcp`; expected: the logged route is `/c/:secret/mcp`; the secret does not appear.
- [ ] `connection.auth_failed` — input: an unknown secret; expected: one log line with the event name and no secret.

## E2E

Runner: `pnpm --filter @zapbip/api test:e2e` with `ZAPBIP_E2E=1` (starts `wrangler dev src/index.dev.ts` in `globalSetup`).

- [ ] `accounts.e2e.test.ts` pt-BR walk — steps: simulator `novo agente claude-code` for a new phone; read the install prompt parts from the screen; join them; call `tools/list` with the `@modelcontextprotocol/sdk` `Client` on the printed link; call `send_message` with text `oi`; simulator `girar claude-code`; old link `tools/call` returns `401`; new link returns `200`; simulator `revogar claude-code`; new link returns `401`; simulator `apagar conta` then `apagar conta definitivamente`; expected: the screen shows the replies in pt-BR; after deletion the D1 `accounts` and `connections` rows for the phone are gone and the R2 prefix is empty.
- [ ] `accounts.e2e.test.ts` en walk — steps: the same walk with `new agent claude-code`, `rotate`, `revoke`, `delete account`, `delete account permanently`; expected: every reply is in en-US; the outcome equals the pt-BR walk.
- [ ] `accounts.e2e.test.ts` mixed locale — steps: `new agent a1` then `ajuda` then a plain text; expected: the rule 6 question for the plain text is in pt-BR (the last command was `ajuda`).
- [ ] `accounts.e2e.test.ts` limit walk — steps: create eight agents then a ninth; expected: the ninth gets the `LimitReached` reply in the owner's locale; `revogar` one agent then the ninth create succeeds.
- [ ] `accounts.e2e.test.ts` bundle — steps: `wrangler deploy --dry-run` against `wrangler.jsonc` with the production entry; expected: the bundle contains no `/dev/owner/` string and no `DevOwnerSimulator` identifier (slice 1's check still green).

## Docs links

Runner: `pnpm --filter @zapbip/docs exec mint broken-links`.

- [ ] `guides/commands` — input: the navigation entry and the page file; expected: the page is linked and resolves; no broken link.
- [ ] `guides/agents-and-links` — input: the same check; expected: no broken link.
- [ ] `guides/account-deletion` — input: the same check; expected: no broken link.
- [ ] `guides/commands` content — input: the page text; expected: the page lists every command word of `COMMAND_WORDS` in both languages and the `@<agent> girar a imagem` escape example (item 17) (checked by a docs test that reads `command-words.ts`).
- [ ] `guides/account-deletion` content — input: the page text; expected: it contains the exact phrases `apagar conta definitivamente` and `delete account permanently`, and the statement that Meta keeps the WhatsApp history.

## Security checks

- [ ] Secret format — input: 10 000 issued secrets; expected: each matches `CONNECTION_SECRET_PATTERN`; no duplicates.
- [ ] Pattern before D1 — input: `resolveSecretDigest` called from the MCP route with the value `zb_conn_short` (fails `CONNECTION_SECRET_PATTERN`); expected: `null`, and the D1 binding call count is 0 (A3; the spec explains why no timing comparison exists).
- [ ] Equality lookup — input: a well-formed secret whose digest has no row; expected: `null`, one D1 read, no application-code compare of secrets.
- [ ] No route takes an account id from the request — input: a request to `/c/<secret>/mcp` with an `accountId` query parameter of another account; expected: the call acts only on the secret's account (the parameter is ignored and not read).
- [ ] Durable Object id — input: the account id `acc1` and the DO id `idFromName('acc1')`; expected: a different account id yields a different DO id, and a request for `acc2` never reads `acc1`'s storage (isolation integration case).
- [ ] No secret in D1 — input: the D1 dump after the full walk; expected: no `zb_conn_` value and no value other than 64-character hex in `secret_digest`.
- [ ] No secret in a Durable Object row — input: the DO storage dump after `new agent x` and `girar x`; expected: no `zb_conn_` value.
- [ ] No secret in R2 — input: the R2 listing after the walk; expected: no object key or body contains `zb_conn_`.
- [ ] Owner number storage — input: a D1 dump; expected: the owner's `wa_id` appears only in `owner_identities` and `blocked_phones`.
- [ ] Blocklist first — input: a blocked phone with the rate limit already exhausted; expected: `Blocked` and the binding not called (order check).
- [ ] Unknown secret timing shape — input: an unknown secret and a revoked secret; expected: `401` with byte-identical bodies and the same headers.
- [ ] Logs — input: the logs of `logs-redaction.test.ts`; expected: the redaction case is green.
- [ ] Revocation at once — input: revoke and then the next MCP call in the same second; expected: `401` (nothing cached).
- [ ] Suspended account — input: the operator sets `suspended` and sends one owner message; expected: one `Suspended` reply, nothing routed, MCP `401`.

## Prove it for real: Playwright MCP

The docs are the only browser surface in this slice; the owner's conversation is the simulator's JSON screen.

- [ ] Happy path, docs: `mint dev` serves `guides/commands`; steps: open the page, check the command table, follow the link to `guides/agents-and-links`, then to `guides/account-deletion`; expected: each page renders, no 404, the navigation shows the three pages under the guides group.
- [ ] Desktop width: `guides/commands` at 1 280 wide; expected: the table is readable, no horizontal page scroll; screenshot at `<path>`.
- [ ] Narrow width: `guides/commands` at 375 wide; expected: the table scrolls inside its container, the page has no horizontal page scroll, 16 px side gutter; screenshot at `<path>`.
- [ ] Narrow width: `guides/account-deletion` at 375 wide; expected: the phrases are readable and not clipped; screenshot at `<path>`.
- [ ] Console and network clean: zero console errors and zero failed requests while walking the three pages; expected: no exceptions.
- [ ] Simulator walk, recorded: the walk of the E2E pt-BR case as JSON screens saved at `<path>`; expected: the screens show the install prompt parts in order and the `Listed` and `Revoked` replies.
- [ ] Browser Back mid-flow: on `guides/agents-and-links`, Back after following a link; expected: the previous page, no error.
- [ ] Reload mid-flow: reload `guides/account-deletion`; expected: the same page, the same content.

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: two first messages from one phone yield one account and no orphan account row — attack: 50 concurrent first messages for one `waId` with the daily cap at 49, checking the `accounts` count and the identity count; result: `refuted | held`.
- [ ] Claim 2: twenty concurrent creates for the last slot yield exactly `AGENTS_PER_ACCOUNT_LIMIT` connections — attack: 20 creates with distinct names interleaved with 3 revokes; result: `refuted | held`.
- [ ] Claim 3: a rotated link stops working at once and a failed send leaves the owner with the old link — attack: rotate, immediately call with the old link, then fail the send and call with the old link again; result: `refuted | held`.

## Coverage honesty

What is not tested and why.

- Meta's delivery of the install prompt parts and the owner's client display — not reproducible without a live number; covered by the owner-run section of `plan.md`.
- Cloudflare's Rate Limiting counters across locations — the binding is approximate per location (spec risk); tests use the binding double and check the configured limit, not the global count. Risk accepted.
- Cloudflare's point-in-time copies of D1 and the Durable Object after deletion — outside any test; the owner's privacy text covers them (spec).
- The LGPD text and the privacy policy — the owner's to review (spec).
- Behaviour of `wrangler d1 execute` operator commands on production — owner-run only.
- The Playwright walk of the simulator — the simulator has no browser UI; the walk is JSON screens, not a visual check.
- Install prompt content per client — owned by `install-skills`; this slice tests the generic renderer and the parts only.
- Agent name length: the tests read `AGENT_NAME_MAX_CHARS` from core, so they follow whichever value slice 1 settles (32 in the spec, 20 in the core review). The value itself is slice 1's decision and is confirmed at build.

## Delta (2026-11-06): the install-link reply

These boxes replace the install prompt parts, the generic renderer and the create and rotate cases that asserted `/c/<secret>/mcp` in a reply. The struck boxes above stay as history.

### Install lines (`account-copy.test.ts`)

- [ ] `renderInstallLines` — input: `installLink` and each locale; expected: exactly two lines, the first with the link, each under `WHATSAPP_TEXT_MAX_CHARS`, no `zb_conn_`.
- [ ] `renderAccountReply` — input: `Created` and `Rotated` in both locales; expected: the text holds the agent name, the two install lines and the rotate hint, and no `zb_conn_`.
- [ ] `renderAccountReply` — input: `Created` with the longest agent name; expected: at most `WHATSAPP_TEXT_MAX_CHARS`.

### Create and rotate (`create-agent-connection.test.ts`, `rotate-agent-connection.test.ts`)

- [ ] `createAgentConnection` — input: `claude`; expected: the reply holds `<publicOrigin>/i/zb_inst_`, not `/c/`, not the issued secret; the registered connection carries the install code digest, a sealed secret and `installCodeExpiresAt = now + INSTALL_CODE_TTL_MS`.
- [ ] `createAgentConnection` — input: the sealed secret opened with the issued install code; expected: the issued secret; opened with another code: fails.
- [ ] `rotateAgentConnection` — input: `claude` active; expected: a new install code replaces the old one; the old digest no longer resolves; the reply holds the new link.
- [ ] `rotateAgentConnection` — input: the send fails; expected: the old install code digest, sealed secret and expiry are restored.
- [ ] `receiveAccountMessage` — input: `novo agente claude`; expected: exactly one session text, no `1/n` label.

### List (`list-agent-connections.test.ts`)

- [ ] `listAgentConnections` — input: one agent with `clientName` `claude-code`, one with `null`; expected: the first line shows the client name, the second shows the empty mark; no secret or install code.

### Vault (`install-code-vault.test.ts`)

- [ ] `issue` — input: 1 000 issues; expected: distinct codes matching `zb_inst_` plus 22 base64url characters (16 bytes), digests of 64 hex characters, digest differs from the code.
- [ ] `seal` and `open` — input: a round trip; expected: the secret returns.
- [ ] `open` — input: a code differing in one character; expected: rejects.
- [ ] `seal` — input: the same code and secret twice; expected: two different sealed values (random IV).

### D1 (`d1-connections-lifecycle.test.ts`, `migration-0002.test.ts`)

- [ ] Migration `0002` — expected: `connections` has `install_code_digest`, `install_code_sealed_secret`, `install_code_expires_at` and `first_call_at`; two rows with the same install code digest are refused.
- [ ] `resolve` — input: a fresh code; expected: `Ready` with the connection link built from the opened secret, the agent, the account locale, `accountId` and `connectionId`.
- [ ] `resolve` — input: unknown code, revoked connection; expected: `Unknown`.
- [ ] `resolve` — input: `now` equal to the expiry; expected: `Expired` with the account locale.
- [ ] `resolve` — input: after `recordFirstCall`; expected: `Used`.
- [ ] `recordFirstCall` — input: called twice; expected: `first_call_at` keeps the first value; the sealed secret is null.
- [ ] `recordFirstCall` — input: two connections, one call; expected: the other connection stays `Ready`.
- [ ] `rotate` — input: a used connection rotated; expected: the new code is `Ready` and the old code is `Unknown`.
- [ ] `revoke` — expected: the install code columns are cleared.
- [ ] Secret never stored — input: a D1 dump after create; expected: no `zb_conn_` and no `zb_inst_` value.

### Sweep (`deletion-sweep.test.ts`)

- [ ] `clearExpiredInstallSecrets` — input: one expired and one live code; expected: only the expired sealed secret is cleared.

### Logs (`logs-redaction.test.ts`) and E2E

- [ ] Logs over the whole walk — expected: no captured line contains `zb_inst_`.
- [ ] `accounts.e2e.test.ts` — steps: create, read the install link from the screen, the page shows the connection URL, a real MCP call with it, the second use of the link is `410`; expected as the spec's E2E.
