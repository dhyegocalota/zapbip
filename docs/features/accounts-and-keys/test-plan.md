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

- [x] S1a.1 red `libs/core/src/accounts/{command,agent-name,install-prompt-parts,account-copy}.test.ts` — input: the Core unit: grammar cases below; expected: each fails with `<name> is not implemented`. — evidence: 71999fb unit.md S1a.1 red run ffe19b2 (stub messages); install-prompt-parts file removed by the delta, its rows are struck
- [x] S1b.1 red `libs/core/src/accounts/state-gate.test.ts`, `libs/core/src/accounts/use-cases/apply-owner-command.test.ts` and the rule 0 cases of `libs/core/src/accounts/use-cases/receive-account-message.test.ts` — input: the cases below; expected: each fails with `evaluateAccountState is not implemented` or `applyOwnerCommand is not implemented`. — evidence: 71999fb unit.md S1b.1 red run 4a24b87 (46 stub failures: 28 receiveAccountMessage, 10 evaluateAccountState, 6 applyOwnerCommand)
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

- [x] `parseAccountCommand` — input: text `agentes`; expected: `{kind: ListAgents, rawName: null, locale: pt-BR}`. — evidence: 71999fb unit.md Command matching PASS (M01-M06 killed)
- [x] `parseAccountCommand` — input: text `agents`; expected: `{kind: ListAgents, rawName: null, locale: en-US}`. — evidence: 71999fb unit.md Command matching PASS (M01-M06 killed)
- [x] `parseAccountCommand` — input: text `  AGENTES  `; expected: `{kind: ListAgents, locale: pt-BR}` (trim, lowercase). — evidence: 71999fb unit.md Command matching PASS (M01-M06 killed)
- [x] `parseAccountCommand` — input: text `Novo    Agente   Claude Code`; expected: `{kind: CreateAgent, rawName: 'Claude Code', locale: pt-BR}` (inner whitespace collapsed; the name keeps its case until normalised). — evidence: 71999fb unit.md Command matching PASS (M01-M06 killed)
- [x] `parseAccountCommand` — input: text `new agent Claude Code`; expected: `{kind: CreateAgent, rawName: 'Claude Code', locale: en-US}`. — evidence: 71999fb unit.md Command matching PASS (M01-M06 killed)
- [x] `parseAccountCommand` — input: text `agentes?`; expected: `null` (trailing punctuation does not match; the message routes on). — evidence: 71999fb unit.md Command matching PASS (M01-M06 killed)
- [x] `parseAccountCommand` — input: text `agentes.`; expected: `null`. — evidence: 71999fb unit.md Command matching PASS (M01-M06 killed)
- [x] `parseAccountCommand` — input: text `ajuda!`; expected: `null`. — evidence: 71999fb unit.md Command matching PASS (M01-M06 killed)
- [x] `parseAccountCommand` — input: text `ajuda`; expected: `{kind: Help, locale: pt-BR}`. — evidence: 71999fb unit.md Command matching PASS (M01-M06 killed)
- [x] `parseAccountCommand` — input: text `menu`; expected: `{kind: Help, locale: pt-BR}`. — evidence: 71999fb unit.md Command matching PASS (M01-M06 killed)
- [x] `parseAccountCommand` — input: text `help`; expected: `{kind: Help, locale: en-US}`. — evidence: 71999fb unit.md Command matching PASS (M01-M06 killed)
- [x] `parseAccountCommand` — input: text `apagar conta`; expected: `{kind: RequestDeletion, locale: pt-BR}`. — evidence: 71999fb unit.md Command matching PASS (M01-M06 killed)
- [x] `parseAccountCommand` — input: text `delete account`; expected: `{kind: RequestDeletion, locale: en-US}`. — evidence: 71999fb unit.md Command matching PASS (M01-M06 killed)
- [x] `parseAccountCommand` — input: text `apagar conta definitivamente`; expected: `{kind: ConfirmDeletion, locale: pt-BR}`. — evidence: 71999fb unit.md Command matching PASS (M01-M06 killed)
- [x] `parseAccountCommand` — input: text `Delete   Account   Permanently`; expected: `{kind: ConfirmDeletion, locale: en-US}`. — evidence: 71999fb unit.md Command matching PASS (M01-M06 killed)
- [x] `parseAccountCommand` — input: text `apagar conta definitivamente.`; expected: `null`. — evidence: 71999fb unit.md Command matching PASS (M01-M06 killed)
- [x] `parseAccountCommand` — input: text `apagar`; expected: `null` (a first word alone is not a command). — evidence: 71999fb unit.md Command matching PASS (M01-M06 killed)
- [x] `parseAccountCommand` — input: text `novo`; expected: `null`. — evidence: 71999fb unit.md Command matching PASS (M01-M06 killed)
- [x] `parseAccountCommand` — input: text `novo agente`; expected: `{kind: CreateAgent, rawName: '', locale: pt-BR}` and the service replies `Usage` (empty name). — evidence: 71999fb unit.md Command matching PASS (M01-M06 killed)
- [x] `parseAccountCommand` — input: text `novo agente    ` (trailing spaces); expected: `{kind: CreateAgent, rawName: '', locale: pt-BR}`. — evidence: 71999fb unit.md Command matching PASS (M01-M06 killed)
- [x] `parseAccountCommand` — input: text `revogar`; expected: `{kind: RevokeAgent, rawName: '', locale: pt-BR}` (the service replies `Usage`). — evidence: 71999fb unit.md Command matching PASS (M01-M06 killed)
- [x] `parseAccountCommand` — input: text `girar a imagem`; expected: `{kind: RotateAgent, rawName: 'a imagem', locale: pt-BR}` (item 17: free name, no agent intent). — evidence: 71999fb unit.md Command matching PASS (M01-M06 killed)
- [x] `receiveOwnerMessage` — input: `girar a imagem` in state `active` with agent `a-imagem` absent; expected: one `NotFound` reply, nothing rotated, the message is not routed to an agent (A11, item 17). — evidence: 71999fb unit.md Command matching PASS (M01-M06 killed)
- [x] `receiveOwnerMessage` — input: `@claude girar a imagem` with agent `claude` active; expected: rule 3 routes `girar a imagem` to `claude` with the prefix removed; no rotate happens (the escape, item 17). — evidence: 71999fb unit.md Command matching PASS (M01-M06 killed)
- [x] `parseAccountCommand` — input: text `girar   Foo`; expected: `{kind: RotateAgent, rawName: 'Foo', locale: pt-BR}`. — evidence: 71999fb unit.md Command matching PASS (M01-M06 killed)
- [x] `parseAccountCommand` — input: text `novo agente` quoted (`isQuoting: true`); expected: `null`. — evidence: 71999fb unit.md Command matching PASS (M01-M06 killed)
- [x] `receiveAccountMessage` — input: text `revogar alpha` forwarded (`forwarded` and `frequently_forwarded`), from an active account with agent `alpha`; expected: not a command, `alpha` stays active, the message routes to an agent. — evidence: a88b0d5 retest-unit-worker.md M7 red on forwarded and frequently_forwarded
- [x] `parseAccountCommand` — input: text `agentes` quoted (`isQuoting: true`); expected: `null` (rule 2 routes it to the quoted agent). — evidence: 71999fb unit.md Command matching PASS (M01-M06 killed)
- [x] `parseAccountCommand` — input: `text: null`, `listReplyId: 'zapbip:agents'`; expected: `{kind: ListAgents, rawName: null}`. — evidence: 71999fb unit.md Command matching PASS (M01-M06 killed)
- [x] `parseAccountCommand` — input: `text: null`, `listReplyId: 'zapbip:help'`; expected: `{kind: Help}`. — evidence: 71999fb unit.md Command matching PASS (M01-M06 killed)
- [x] `parseAccountCommand` — input: `text: null`, `listReplyId: 'zapbip:bogus'`; expected: `{kind: Unknown, rawName: null}` (rule 0 consumes it; the reply is `Unknown`). — evidence: 71999fb unit.md Command matching PASS (M01-M06 killed)
- [x] `parseAccountCommand` — input: `text: null`, `listReplyId: 'q_abc123:1'`; expected: `null` (an answer to a question, left to rule 1). — evidence: 71999fb unit.md Command matching PASS (M01-M06 killed)
- [x] `parseAccountCommand` — input: `text: null`, `listReplyId: null`; expected: `null` (a reaction or media, never a command). — evidence: 71999fb unit.md Command matching PASS (M01-M06 killed)
- [x] `parseAccountCommand` — input: `text: 'ajuda'`, `listReplyId: 'q_abc123:1'`; expected: the list reply wins: `null` (list reply id is a question answer). — evidence: 71999fb unit.md Command matching PASS (M01-M06 killed)

### Agent names and reserved words (`agent-name.test.ts`)

- [x] `normalizeAgentName` — input: `Claude Code`; expected: `claude-code`. — evidence: 71999fb unit.md Agent names PASS (M30-M33 killed)
- [x] `normalizeAgentName` — input: `Ação`; expected: `acao` (NFD, combining marks removed). — evidence: 71999fb unit.md Agent names PASS (M30-M33 killed)
- [x] `normalizeAgentName` — input: `  -x-  `; expected: `x` (leading and trailing `-` trimmed). — evidence: 71999fb unit.md Agent names PASS (M30-M33 killed)
- [x] `normalizeAgentName` — input: `a___b`; expected: `a-b` (each run of characters outside `a-z0-9` becomes one `-`). — evidence: 71999fb unit.md Agent names PASS (M30-M33 killed)
- [x] `normalizeAgentName` — input: `!!!`; expected: `null` (empty after normalisation). — evidence: 71999fb unit.md Agent names PASS (M30-M33 killed)
- [x] `normalizeAgentName` — input: `   `; expected: `null`. — evidence: 71999fb unit.md Agent names PASS (M30-M33 killed)
- [x] `normalizeAgentName` — input: `Ajuda`; expected: `ajuda` (returned; `isReservedAgentName` decides the reply). — evidence: 71999fb unit.md Agent names PASS (M30-M33 killed)
- [x] `normalizeAgentName` — input: a name of exactly `AGENT_NAME_MAX_CHARS` characters of `a`; expected: the same name. — evidence: 71999fb unit.md Agent names PASS (M30-M33 killed)
- [x] `normalizeAgentName` — input: a name of `AGENT_NAME_MAX_CHARS + 1` characters of `a`; expected: `null` (edge: one more than the limit). — evidence: 71999fb unit.md Agent names PASS (M30-M33 killed)
- [x] `normalizeAgentName` — input: `1agent`; expected: `1agent` (a digit may lead). — evidence: 71999fb unit.md Agent names PASS (M30-M33 killed)
- [x] `normalizeAgentName` — input: `-agent`; expected: `agent` (edge: leading hyphen trimmed, not rejected). — evidence: 71999fb unit.md Agent names PASS (M30-M33 killed)
- [x] `isReservedAgentName` — input: each of `novo`, `new`, `agentes`, `agents`, `revogar`, `revoke`, `girar`, `rotate`, `ajuda`, `help`, `menu`, `apagar`, `delete`; expected: `true` for each. — evidence: 71999fb unit.md Agent names PASS (M30-M33 killed)
- [x] `isReservedAgentName` — input: `claude-code`; expected: `false`. — evidence: 71999fb unit.md Agent names PASS (M30-M33 killed)
- [x] `isReservedAgentName` — input: `agente`; expected: `false` (the reserved word is the first word of a command, `agente` is not one). — evidence: 71999fb unit.md Agent names PASS (M30-M33 killed)

### Install prompt parts (`install-prompt-parts.test.ts`)

- [ ] ~~`splitInstallPrompt` — input: a prompt of 100 characters and `maxChars` 4 096; expected: one part, equal to the prompt with the label `1/1` line.~~ superseded by the delta (2026-11-06): the install prompt parts and the generic renderer were removed in favour of the install code.
- [ ] ~~`splitInstallPrompt` — input: a prompt of exactly 4 096 characters with the label budget removed; expected: the parts each fit `WHATSAPP_TEXT_MAX_CHARS`.~~ superseded by the delta (2026-11-06): the install prompt parts and the generic renderer were removed in favour of the install code.
- [ ] ~~`splitInstallPrompt` — input: a prompt of 9 000 characters of mixed text; expected: three parts, each `i/3` label on its own line, each at most 4 096 characters, and removing the label lines and joining in order returns the exact prompt.~~ superseded by the delta (2026-11-06): the install prompt parts and the generic renderer were removed in favour of the install code.
- [ ] ~~`splitInstallPrompt` — input: a prompt whose link line would straddle the 4 096 limit; expected: the link line is intact in one part; the part with it is at most `WHATSAPP_TEXT_MAX_CHARS - PART_LABEL_BUDGET_CHARS` text characters.~~ superseded by the delta (2026-11-06): the install prompt parts and the generic renderer were removed in favour of the install code.
- [ ] ~~`splitInstallPrompt` — input: a link line longer than the label-reduced budget; expected: throws naming the link line (never split).~~ superseded by the delta (2026-11-06): the install prompt parts and the generic renderer were removed in favour of the install code.
- [ ] ~~`splitInstallPrompt` — input: a line exactly at the budget; expected: one part for it (edge: boundary inclusive).~~ superseded by the delta (2026-11-06): the install prompt parts and the generic renderer were removed in favour of the install code.
- [ ] ~~`splitInstallPrompt` — input: the longest agent name (`AGENT_NAME_MAX_CHARS` characters) in the create prompt; expected: every part of the rendered prompt is at most 4 096 characters.~~ superseded by the delta (2026-11-06): the install prompt parts and the generic renderer were removed in favour of the install code.
- [ ] ~~`splitInstallPrompt` — input: an empty prompt string; expected: an error with the message naming the empty prompt (not a single empty part).~~ superseded by the delta (2026-11-06): the install prompt parts and the generic renderer were removed in favour of the install code.

### Copy (`account-copy.test.ts`)

- [x] `renderAccountReply` — input: every `AccountReplyIntent` value with locale `pt-BR`; expected: a non-empty string for each. — evidence: 71999fb unit.md Copy PASS (account-copy.test.ts)
- [x] `renderAccountReply` — input: every `AccountReplyIntent` value with locale `en-US`; expected: a non-empty string for each. — evidence: 71999fb unit.md Copy PASS (account-copy.test.ts)
- [x] `renderAccountReply` — input: intent `Usage` with parameter `Usage` set to `novo agente <nome>`, locale `pt-BR`; expected: the text contains `novo agente <nome>` exactly. — evidence: 71999fb unit.md Copy PASS (account-copy.test.ts)
- [ ] `renderAccountReply` — input: intent `Created` without the `InstallPrompt` parameter; expected: throws naming the missing parameter (no default text).
- [x] `renderAccountReply` — input: `Menu` reply; expected: `kind` is `ReplyKind.List`, `menuRows` has the six ids `zapbip:create_agent`, `zapbip:list_agents`, `zapbip:revoke_agent`, `zapbip:rotate_agent`, `zapbip:help`, `zapbip:request_deletion` in that order. — evidence: 71999fb unit.md Copy PASS (account-copy.test.ts)
- [ ] WhatsApp limits — input: every copy text of every intent in both locales; expected: each text is at most `WHATSAPP_TEXT_MAX_CHARS` characters (4 096).
- [x] WhatsApp limits — input: every `menuRows[i].title`; expected: at most `LIST_ROW_TITLE_MAX_CHARS` (24) characters. — evidence: 71999fb unit.md Copy PASS (account-copy.test.ts)
- [x] WhatsApp limits — input: the list button text in both locales; expected: at most `LIST_BUTTON_TEXT_MAX_CHARS` (20) characters. — evidence: 71999fb unit.md Copy PASS (account-copy.test.ts)
- [ ] WhatsApp limits — input: `Usage` and `Menu` for `Revoke` with the longest command word; expected: the `Usage` text is at most 4 096 characters.

## Core unit: state and use cases

Runner: `pnpm --filter @zapbip/core test:unit`. In-memory ports from `libs/core/src/accounts/testing/in-memory-accounts.ts` (over slice 1's `libs/core/src/inbox/testing/in-memory.ts`); fake clock; fake digests (`fake:<secret>`) and a fake `ConnectionSecrets` that returns the secrets in a queue.

### State gate (`state-gate.test.ts`)

- [x] `evaluateAccountState` — input: state `waitlisted`, text `ajuda`; expected: `{outcome: Proceed}` (help works). — evidence: 71999fb unit.md State gate PASS (M07-M11 killed)
- [x] `evaluateAccountState` — input: state `waitlisted`, command `RequestDeletion`; expected: `{outcome: Proceed}`. — evidence: 71999fb unit.md State gate PASS (M07-M11 killed)
- [x] `evaluateAccountState` — input: state `waitlisted`, command `ConfirmDeletion`; expected: `{outcome: Proceed}` (A20). — evidence: 71999fb unit.md State gate PASS (M07-M11 killed)
- [x] `evaluateAccountState` — input: state `active`, command `ConfirmDeletion`; expected: `{outcome: Proceed}` (A20). — evidence: 71999fb unit.md State gate PASS (M07-M11 killed)
- [x] `evaluateAccountState` — input: state `suspended`, command `ConfirmDeletion`; expected: `{outcome: Reply, intent: Suspended}`. — evidence: 71999fb unit.md State gate PASS (M07-M11 killed)
- [x] `evaluateAccountState` — input: state `waitlisted`, command `CreateAgent`; expected: `{outcome: Reply, intent: Waitlisted}`. — evidence: 71999fb unit.md State gate PASS (M07-M11 killed)
- [x] `evaluateAccountState` — input: state `waitlisted`, plain text `oi`; expected: `{outcome: Reply, intent: Waitlisted}` (not stored, checked in the use-case test). — evidence: 71999fb unit.md State gate PASS (M07-M11 killed)
- [x] `evaluateAccountState` — input: state `suspended`, text `oi`; expected: `{outcome: Reply, intent: Suspended}`. — evidence: 71999fb unit.md State gate PASS (M07-M11 killed)
- [x] `evaluateAccountState` — input: state `suspended`, command `Help`; expected: `{outcome: Reply, intent: Suspended}` (nothing works). — evidence: 71999fb unit.md State gate PASS (M07-M11 killed)
- [x] `evaluateAccountState` — input: state `deleting`, text `oi`; expected: `{outcome: Drop, intent: null}`. — evidence: 71999fb unit.md State gate PASS (M07-M11 killed)
- [x] `evaluateAccountState` — input: state `deleting`, command `ConfirmDeletion`; expected: `{outcome: Drop, intent: null}` (the Worker resumes deletion, the state gate sends nothing). — evidence: 71999fb unit.md State gate PASS (M07-M11 killed)
- [x] `evaluateAccountState` — input: state `active`, text `oi`; expected: `{outcome: Proceed}`. — evidence: 71999fb unit.md State gate PASS (M07-M11 killed)
- [x] `evaluateAccountState` — input: state `active`, a first non-text message (`isFirstMessage: true`, `isText: false`); expected: `{outcome: Reply, intent: Unknown}` (A10). — evidence: 71999fb unit.md State gate PASS (M07-M11 killed)
- [x] `evaluateAccountState` — input: state `waitlisted`, a first non-text message; expected: `{outcome: Reply, intent: Waitlisted}` (the waitlist reply wins over the unknown reply). — evidence: 71999fb unit.md State gate PASS (M07-M11 killed)
- [x] Retry of a first non-text message (item 18) — input: the same media delivery (same `channelMessageId`) delivered twice, the second after the first committed; expected: both calls have `isFirstMessage: true`, the reply `Unknown` is sent once per committed attempt, nothing is stored, and `first_message_id` is unchanged. — evidence: 71999fb unit.md State gate PASS (M07-M11 killed)
- [x] A second, different first-kind message after the first committed (item 18) — input: a media message with a new `channelMessageId`; expected: `isFirstMessage: false`, the message is routed and stored. — evidence: 71999fb unit.md State gate PASS (M07-M11 killed)
- [x] `evaluateAccountState` — input: state `active`, a non-text message from an existing account (`isFirstMessage: false`, `isText: false`); expected: `{outcome: Proceed}` (media from an existing owner routes as usual). — evidence: 71999fb unit.md State gate PASS (M07-M11 killed)

### Rule 0 and rules 1 to 6 (`apply-owner-command.test.ts`, `receive-owner-message.test.ts`)

- [x] `receiveOwnerMessage` — input: an agent `a1` has an open question and the owner sends `agentes`; expected: rule 0 answers with `Listed` or `EmptyList`; the question stays open; `a1` receives nothing. — evidence: 71999fb unit.md Rule 0 and rules 1-6 PASS
- [x] `receiveOwnerMessage` — input: `agentes` sent as a text with two agents with open questions; expected: the message is not routed; the question of the newest agent is unchanged. — evidence: 71999fb unit.md Rule 0 and rules 1-6 PASS
- [x] `receiveOwnerMessage` — input: `agentes` sent after an agent `a1` wrote within the window; expected: rule 5 still picks `a1` for the next plain text, so the command did not change "last agent that wrote". — evidence: 71999fb unit.md Rule 0 and rules 1-6 PASS
- [x] `receiveOwnerMessage` — input: the owner quotes an agent message `a1` and types `agentes`; expected: rule 2 routes the text to `a1`; no `Listed` reply; `messageId` is not `null`. — evidence: 71999fb unit.md Rule 0 and rules 1-6 PASS
- [x] `receiveOwnerMessage` — input: the owner taps the `Choice` `q_abc123:1` answering `a1`; expected: rule 1 answers `a1`; rule 0 does not run. — evidence: 71999fb unit.md Rule 0 and rules 1-6 PASS
- [x] `receiveOwnerMessage` — input: the owner taps the list row `zapbip:agents`; expected: rule 0 runs `listAgentConnections`; `messageId` is `null`; one `Listed` reply. — evidence: 71999fb unit.md Rule 0 and rules 1-6 PASS
- [x] `receiveOwnerMessage` — input: the same inbound message delivered twice (same `messageId`); expected: the second call returns the first result and sends nothing new (dedupe as agent-inbox-core). — evidence: 71999fb unit.md Rule 0 and rules 1-6 PASS
- [ ] `receiveOwnerMessage` — input: `apagar conta definitivamente` in state `active` with no pending request; expected: `deletionConfirmed: false`, one `DeletionExpired` reply, nothing deleted.
- [ ] `receiveOwnerMessage` — input: `apagar conta` at T, then `apagar conta definitivamente` at T + 10 min; expected: `deletionConfirmed: true` (edge: exactly the TTL is accepted).
- [ ] `receiveOwnerMessage` — input: `apagar conta` at T, then `apagar conta definitivamente` at T + 10 min + 1 ms; expected: `deletionConfirmed: false`, `DeletionExpired` reply, `deletion_requested_at` cleared.
- [ ] `receiveOwnerMessage` — input: `apagar conta definitivamente` in state `waitlisted` after `apagar conta`; expected: `deletionConfirmed: true` (A20).
- [x] `receiveOwnerMessage` — input: `apagar conta definitivamente` in state `suspended`; expected: one `Suspended` reply; `deletionConfirmed: false`. — evidence: 71999fb unit.md Rule 0 and rules 1-6 PASS
- [x] `receiveOwnerMessage` — input: the list tap `zapbip:confirm_deletion`; expected: one `Unknown` reply, `deletionConfirmed: false`, no deletion (A12). — evidence: 71999fb unit.md Rule 0 and rules 1-6 PASS
- [x] `receiveOwnerMessage` — input: the list tap `zapbip:request_deletion`; expected: one `DeletionRequest` reply with the phrase, `deletion_requested_at` set. — evidence: 71999fb unit.md Rule 0 and rules 1-6 PASS
- [x] `receiveOwnerMessage` — input: `apagar conta` in state `active`; expected: `deletionConfirmed: false`, one `DeletionRequest` reply that contains the phrase `apagar conta definitivamente`, account state unchanged. — evidence: 71999fb unit.md Rule 0 and rules 1-6 PASS
- [x] `receiveOwnerMessage` — input: a plain text `oi` in state `waitlisted`; expected: one `Waitlisted` reply; `repository.insertMessage` not called. — evidence: 71999fb unit.md Rule 0 and rules 1-6 PASS (asserted as no owner message stored, not as an insertMessage spy)
- [x] `receiveOwnerMessage` — input: a plain text `oi` in state `suspended`; expected: one `Suspended` reply; nothing stored; no agent receives a message. — evidence: 71999fb unit.md Rule 0 and rules 1-6 PASS
- [x] `receiveOwnerMessage` — input: `ajuda` with a list of the commands; expected: one `Menu` reply whose list rows have ids `zapbip:create_agent`, `zapbip:list_agents`, `zapbip:revoke_agent`, `zapbip:rotate_agent`, `zapbip:help`, `zapbip:request_deletion` in that order. — evidence: 71999fb unit.md Rule 0 and rules 1-6 PASS
- [x] `receiveOwnerMessage` — input: `zapbip:create_agent` list tap; expected: one `Usage` reply with `novo agente <nome>`, nothing created. — evidence: 71999fb unit.md Rule 0 and rules 1-6 PASS
- [x] `receiveOwnerMessage` — input: `zapbip:revoke_agent` list tap; expected: one `Usage` reply with `revogar <nome>`, nothing revoked. — evidence: 71999fb unit.md Rule 0 and rules 1-6 PASS
- [x] `receiveOwnerMessage` — input: `zapbip:rotate_agent` list tap; expected: one `Usage` reply with `girar <nome>`, nothing rotated. — evidence: 71999fb unit.md Rule 0 and rules 1-6 PASS
- [x] `receiveOwnerMessage` — input: `zapbip:bogus` list tap; expected: one `Unknown` reply, `messageId` `null`. — evidence: 71999fb unit.md Rule 0 and rules 1-6 PASS
- [x] `receiveOwnerMessage` — input: `zapbip:confirm_deletion` list tap; expected: one `Unknown` reply (A12, only the six menu ids are commands). — evidence: 71999fb unit.md Rule 0 and rules 1-6 PASS
- [x] `receiveOwnerMessage` — input: the zero-agent case with a plain text in state `active`; expected: rule 6 notice, the message is held (agent-inbox-core rule 6 unchanged). — evidence: 71999fb unit.md Rule 0 and rules 1-6 PASS
- [x] `receiveOwnerMessage` — input: a first message from a `waId` starting with `55` in state `active`; expected: the account locale is `pt_BR` and the rule 6 question is in `pt_BR`. — evidence: 71999fb unit.md Rule 0 and rules 1-6 PASS
- [x] `receiveOwnerMessage` — input: a first message from a `waId` starting with `1` in state `active`; expected: the account locale is `en_US`, and `new agent x` answered in en-US, after which the account locale is still `en_US` (commands do not change it, A18). — evidence: 71999fb unit.md Rule 0 and rules 1-6 PASS
- [x] `receiveOwnerMessage` — input: a plain text after `novo agente x` from a `waId` starting with `55`; expected: the rule 6 question is in `pt_BR` (the account locale, not the keyword's). — evidence: 71999fb unit.md Rule 0 and rules 1-6 PASS

## Core unit: use cases

Runner: `pnpm --filter @zapbip/core test:unit`.

### Opening the account (`open-owner-account.test.ts`)

- [x] `openOwnerAccount` — input: no account for `waId`, `waitlistEnabled: true`; expected: an account in state `waitlisted`, `created: true`, locale `pt_BR` when the `waId` starts with `55` (A18). — evidence: 71999fb unit.md Open PASS (M35, M36 killed)
- [x] `openOwnerAccount` — input: no account for `waId`, `waitlistEnabled: false`; expected: an account in state `active`. — evidence: 71999fb unit.md Open PASS (M35, M36 killed)
- [x] `openOwnerAccount` — input: an account exists for `waId`; expected: the same `accountId`, `created: false`, no new row. — evidence: 71999fb unit.md Open PASS (M35, M36 killed)
- [ ] `openOwnerAccount` — input: 50 accounts created in the last 24 h, a new `waId`; expected: `null` (daily cap), no account row added.
- [ ] `openOwnerAccount` — input: 50 accounts created 24 h and 1 ms ago, a new `waId`; expected: an account is created (the window has moved).
- [ ] `openOwnerAccount` — input: 49 accounts created in the last 24 h, a new `waId`; expected: an account is created (edge: one below the limit).
- [x] `openOwnerAccount` — input: two calls for the same new `waId`; expected: one account row; both calls return the same `accountId`. — evidence: 71999fb unit.md Open PASS (M35, M36 killed)

### Create (`create-agent-connection.test.ts`)

- [ ] `createAgentConnection` — input: `rawName: 'Claude Code'`, no agents; expected: one active connection `claude-code`, the reply `Created` with the install prompt parameter, the prompt contains the link `<publicOrigin>/c/<secret>/mcp` with the issued secret.
- [x] `createAgentConnection` — input: `rawName: 'Ajuda'`; expected: reply `ReservedName`, no connection created. — evidence: 71999fb unit.md Create PASS (M12, M13, M15, M16 killed)
- [x] `createAgentConnection` — input: `rawName: '!!!'`; expected: reply `InvalidName`, no connection created. — evidence: 71999fb unit.md Create PASS (M12, M13, M15, M16 killed)
- [x] `createAgentConnection` — input: `rawName` of `AGENT_NAME_MAX_CHARS + 1` characters; expected: reply `InvalidName`, no connection created. — evidence: 71999fb unit.md Create PASS (M12, M13, M15, M16 killed)
- [x] `createAgentConnection` — input: `rawName: 'claude'` when an active `claude` exists; expected: reply `NameTaken`, the secret is not issued (the fake `ConnectionSecrets` queue is unchanged). — evidence: 71999fb unit.md Create PASS (M12, M13, M15, M16 killed)
- [x] `createAgentConnection` — input: `claude` is revoked and created again; expected: a second active `claude`, a different digest, `Created`. — evidence: 71999fb unit.md Create PASS (M12, M13, M15, M16 killed)
- [x] `createAgentConnection` — input: `AGENTS_PER_ACCOUNT_LIMIT` active agents; expected: reply `LimitReached` with the `Limit` parameter `8`, no connection created. — evidence: a88b0d5 retest-e2e-security-docs.md walk 8-agent limit pt and en (8 created, ninth refused); unit does not pin the literal 8 (M14 survived)
- [x] `createAgentConnection` — input: `AGENTS_PER_ACCOUNT_LIMIT - 1` active agents and one revoked; expected: `Created` (edge: the revoked one does not count). — evidence: 71999fb unit.md Create PASS (M16 compensation, in-memory NameTaken)
- [x] `createAgentConnection` — input: send of the prompt fails (fake sender throws); expected: the use case returns the failure to the caller; the caller revokes the row (compensation); after the compensation `listAgentConnections` shows no active `claude`, and the secret never appears in the returned error. — evidence: 71999fb unit.md Create PASS (M16 compensation, in-memory NameTaken)
- [x] `createAgentConnection` — input: the in-memory `register` returns `NameTaken` (a race lost); expected: reply `NameTaken`, the issued secret is discarded (never sent). — evidence: 71999fb unit.md Create PASS (M16 compensation, in-memory NameTaken)

### List (`list-agent-connections.test.ts`)

- [x] `listAgentConnections` — input: no agents; expected: reply `EmptyList`. — evidence: 71999fb unit.md List PASS
- [x] `listAgentConnections` — input: `a1` and `b2` active, `c3` revoked; expected: reply `Listed` with the names `a1` and `b2` and their creation dates, no secret and no digest in any parameter. — evidence: 71999fb unit.md List PASS
- [x] `listAgentConnections` — input: the parameters of the list reply; expected: no value matches `zb_conn_` or a 64-character hex string. — evidence: 71999fb unit.md List PASS

### Revoke (`revoke-agent-connection.test.ts`)

- [x] `revokeAgentConnection` — input: `rawName: 'claude'` active; expected: `revokedAt` set to `clock.now()`, reply `Revoked`, `resolveSecretDigest` for the old digest returns `null`. — evidence: 71999fb unit.md Revoke PASS for core cases (M21, M22 killed)
- [x] `revokeAgentConnection` — input: `rawName: 'claude'` already revoked; expected: reply `NotFound`, `revokedAt` unchanged. — evidence: 71999fb unit.md Revoke PASS for core cases (M21, M22 killed)
- [x] `revokeAgentConnection` — input: `rawName: 'nope'`; expected: reply `NotFound`. — evidence: 71999fb unit.md Revoke PASS for core cases (M21, M22 killed)
- [x] `revokeAgentConnection` — input: `rawName: 'agentes'` (reserved); expected: reply `NotFound` (A11), no change. — evidence: 71999fb unit.md Revoke PASS for core cases (M21, M22 killed)
- [x] `revokeAgentConnection` — input: `rawName: 'Claude Code'` with `claude-code` active; expected: revokes `claude-code` (normalised). — evidence: 71999fb unit.md Revoke PASS for core cases (M21, M22 killed)
- [x] `revokeAgentConnection` — input: `rawName: ''`; expected: reply `Usage`, no change (the command parser handles the empty name; the use case treats it as usage). — evidence: 71999fb unit.md Revoke PASS for core cases (M21, M22 killed)
- [x] `revokeAgentConnection` — input: `claude` active with its wake setting set; expected: `revocations.recordRevocation({accountId, agent: 'claude'})` called exactly once; `cancelWaiters` not called; the fake wake state for `claude` is cleared (A22). — evidence: 71999fb unit.md Revoke PASS for core cases (M21, M22 killed)
- [ ] `revokeAgentConnection` — input: `claude` active with a live `wait_for_reply` held by `claude`; expected: the held call resolves at once with `ReplyStatus.Timeout`, before the revoke reply is sent.

### Rotate (`rotate-agent-connection.test.ts`)

- [ ] `rotateAgentConnection` — input: `claude` active; expected: digest changed from the old to the new, reply `Rotated` with the new `InstallPrompt`; `resolveSecretDigest` for the old digest returns `null` at once.
- [x] `rotateAgentConnection` — input: `claude` revoked; expected: reply `NotFound`, digest unchanged. — evidence: 71999fb unit.md Rotate PASS (M17 killed)
- [x] `rotateAgentConnection` — input: send of the new prompt fails; expected: compare-and-set back from the new digest to the old, `resolveSecretDigest` for the old digest returns the connection again, the new digest resolves to `null`. — evidence: 71999fb unit.md Rotate PASS (M17 killed)
- [x] `rotateAgentConnection` — input: two rotations of `claude` issued from the same old digest (lost race); expected: the second `rotate` returns `false`; reply `NotFound` or a retry message; the stored digest is the first rotation's digest. — evidence: 71999fb unit.md Rotate PASS (M17 killed)
- [x] `rotateAgentConnection` — input: `rotate` called after `revoke` in the same call sequence; expected: reply `NotFound`, digest unchanged. — evidence: 71999fb unit.md Rotate PASS (M17 killed)
- [x] `rotateAgentConnection` — input: `claude` active with its wake setting set; expected: `revocations.cancelWaiters({accountId, agent: 'claude'})` called exactly once after the new prompt is sent; `recordRevocation` not called; the wake setting is unchanged (A22). — evidence: 71999fb unit.md Rotate PASS (M17 killed)
- [ ] `rotateAgentConnection` — input: `claude` active with a live `ask` held by `claude`; expected: the held `ask` resolves with `ReplyStatus.Pending` after the rotate reply is sent; the agent is not marked revoked.
- [x] `rotateAgentConnection` — input: the new prompt send fails; expected: `cancelWaiters` not called (the waiter is still live, because the rotation was undone). — evidence: 71999fb unit.md Rotate PASS (M17 killed)

### Deletion (`delete-account.test.ts`)

- [x] `deleteAccount` — input: account with two agents, two media objects under `accounts/<id>/`, and an inbox; expected: the calls happen in the order accounts state `deleting`, inbox `purge`, media `deleteAll`, remove; afterward the in-memory repositories hold no row for the account. — evidence: 71999fb unit.md Deletion PASS (finish-account-deletion.test.ts)
- [x] `deleteAccount` — input: `inboxPurge.purge` throws once; expected: the call throws; account state remains `deleting`; a second `deleteAccount` call completes every step; the end state equals the single-run end state. — evidence: 71999fb unit.md Deletion PASS (finish-account-deletion.test.ts)
- [x] `deleteAccount` — input: `accountMedia.deleteAll` throws once; expected: as above (`deleting` remains; the next call finishes). — evidence: 71999fb unit.md Deletion PASS (finish-account-deletion.test.ts)
- [x] `deleteAccount` — input: called twice in a row on a completed deletion; expected: the second call returns without error and sends nothing. — evidence: 71999fb unit.md Deletion PASS (finish-account-deletion.test.ts)
- [x] `deleteAccount` — input: an account with no agents and no media; expected: the account row is removed and the owner identity row is removed. — evidence: 71999fb unit.md Deletion PASS (finish-account-deletion.test.ts)
- [x] `deleteAccount` — input: another account's connections and media; expected: unchanged (account isolation in the in-memory adapters). — evidence: 71999fb unit.md Deletion PASS (finish-account-deletion.test.ts)
- [ ] `deleteAccount` — input: deletion completes; a new owner message from the same `waId`; expected: `openOwnerAccount` creates a new account (`created: true`) in the waitlist or active state as the flag says.

### In-memory adapters (`accounts/testing/in-memory-accounts.ts`)

- [x] `createInMemoryAccountDependencies` — input: no arguments; expected: an `AccountDependencies` whose `accounts`, `connections` and `connectionSecrets` report the same results as the Worker D1 adapters for the cases above (the mirror `describe` block of the Worker integration tests calls the same case names). — evidence: 71999fb unit.md In-memory adapters PASS (mirror run via suite)

## Apps unit

Runner: `pnpm --filter @zapbip/api test:unit` (Vitest 4.1.12 in `apps/api`).

- [x] `issue()` — input: the `ConnectionSecrets` adapter; expected: `secret` matches `CONNECTION_SECRET_PATTERN`, `secret` has the `zb_conn_` prefix and exactly 43 base64url characters after it. — evidence: 71999fb unit.md connection secrets and hash PASS
- [x] `issue()` — input: 1 000 issues; expected: 1 000 distinct secrets, all matching `CONNECTION_SECRET_PATTERN`. — evidence: 71999fb unit.md connection secrets and hash PASS
- [x] `issue()` — input: the base64url alphabet check on 1 000 secrets; expected: no `+`, `/` or `=` character. — evidence: 71999fb unit.md connection secrets and hash PASS
- [x] `issue()` — input: `digest` of an issued secret; expected: 64 lowercase hexadecimal characters equal to `hashConnectionSecret({secret})`. — evidence: 71999fb unit.md connection secrets and hash PASS
- [x] `hashConnectionSecret` — input: the same secret twice; expected: identical digests (determinism). — evidence: 71999fb unit.md connection secrets and hash PASS
- [x] `hashConnectionSecret` — input: the same secret without the `zb_conn_` prefix; expected: a different digest (the prefix is part of the hashed string). — evidence: 71999fb unit.md connection secrets and hash PASS
- ~~`RandomSource.bytes` — input: `length: 32`; expected: a `Uint8Array` of length 32.~~ Struck: the `RandomSource` port is dropped (plan.md → Plan refresh).
- ~~`RandomSource.bytes` — input: `length: 0`; expected: an empty `Uint8Array` (edge).~~ Struck: same reason.
- [x] `readWaitlistEnabled` (`apps/api/src/config/waitlist-enabled.ts`) — input: `'true'`; expected: `true`. — evidence: 71999fb unit.md waitlist flag PASS
- [x] `readWaitlistEnabled` — input: `'false'`; expected: `false`. — evidence: 71999fb unit.md waitlist flag PASS
- [x] `readWaitlistEnabled` — input: `undefined`; expected: throws naming `WAITLIST_ENABLED`. — evidence: 71999fb unit.md waitlist flag PASS
- [x] `readWaitlistEnabled` — input: `''`; expected: throws. — evidence: 71999fb unit.md waitlist flag PASS
- [x] `readWaitlistEnabled` — input: `'yes'`; expected: throws. — evidence: 71999fb unit.md waitlist flag PASS
- [x] `readWaitlistEnabled` — input: `'TRUE'`; expected: throws (exact values only). — evidence: 71999fb unit.md waitlist flag PASS
- [ ] Bad flag per request (item 16) — input: `WAITLIST_ENABLED` `'yes'` in the Worker bindings; expected: `GET /health` still returns `200` and `POST /dev/owner/<phone>/messages` returns `500` naming `WAITLIST_ENABLED`; module import succeeds (no module-scope read).
- [ ] Durable Object does not read the flag (item 16) — input: a Durable Object instance constructed with `WAITLIST_ENABLED` `'yes'`; expected: construction succeeds and `receiveOwnerMessage` works from the state the Worker passed in.
- [x] `wrangler-limits` — input: `apps/api/wrangler.jsonc` parsed; expected: the `OWNER_RATE_LIMITER` `simple.limit` equals `OWNER_MESSAGES_PER_MINUTE` (20), `OUTBOUND_RATE_LIMITER` equals `OUTBOUND_MESSAGES_PER_MINUTE` (30), both `simple.period` equal `RATE_LIMIT_PERIOD_MS / ONE_SECOND_MS` (60). — evidence: 71999fb unit.md wrangler-limits PASS
- [x] `wrangler-limits` — input: the `vars.WAITLIST_ENABLED` of each environment; expected: production `"true"`; staging and top-level development `"false"`. — evidence: 71999fb unit.md wrangler-limits PASS
- [ ] ~~`generic-install-prompt` — input: `agent: claude`, a link, `locale: en-US`, `standbyAgent: null`; expected: the text contains the link once, the password warning, and no `null` text.~~ superseded by the delta (2026-11-06): the install prompt parts and the generic renderer were removed in favour of the install code.
- [ ] ~~`generic-install-prompt` — input: `standbyAgent` not null; expected: throws (slice 5 supplies it, this slice never passes one).~~ superseded by the delta (2026-11-06): the install prompt parts and the generic renderer were removed in favour of the install code.
- [ ] `logEvent` — input: an event with `fields: {accountId}` only; expected: one structured line with the event name and the id, no other keys.
- [ ] `logEvent` — input: a field whose value is a `zb_conn_` string; expected: type error at compile time (the `LogFields` type has no such key); the runtime value is not written (checked by the redaction integration test).

## Worker integration: D1

Runner: `pnpm --filter @zapbip/api test:integration` (`@cloudflare/vitest-pool-workers`, D1 applied from `apps/api/migrations`).

### Migration and schema (`migration-0002.test.ts`)

- [x] Migration `0002` — input: an empty D1 with `0001` applied; expected: after `0002`, the tables `accounts`, `owner_identities`, `connections`, `blocked_phones` exist with the spec's columns (`PRAGMA table_info` matches). — evidence: 71999fb worker.md migration-0002 (7 tests, labelled pin)
- [x] Migration `0002` — input: `accounts.state` set to `'banned'`; expected: the insert fails with a CHECK constraint error. — evidence: 71999fb worker.md migration-0002 (7 tests, labelled pin)
- [x] Migration `0002` — input: two active rows with the same `(account_id, agent)`; expected: the second insert fails on `connections_active_agent`. — evidence: 71999fb worker.md migration-0002 (7 tests, labelled pin)
- [x] Migration `0002` — input: a revoked row and an active row with the same `(account_id, agent)`; expected: both inserts succeed (the partial index ignores revoked rows). — evidence: 71999fb worker.md migration-0002 (7 tests, labelled pin)
- [x] Migration `0002` — input: two rows with the same `secret_digest`; expected: the second insert fails on the UNIQUE constraint. — evidence: 71999fb worker.md migration-0002 (7 tests, labelled pin)
- [x] Migration `0002` — input: a `connections` row whose `account_id` names no `accounts` row; expected: the insert fails on the foreign key. — evidence: 71999fb worker.md migration-0002 (7 tests, labelled pin)
- ~~Migration `0002` — input: `drizzle-kit check` on `schema.ts`; expected: no drift reported.~~ Struck: no Drizzle schema in slice 1. Replaced by: Migration `0002` — input: `0001` with one `message_index` row applied, then `0002`; expected: the migration applies without a foreign key error, and `message_index`, `accounts`, `owner_identities`, `connections` and `blocked_phones` exist with the spec's columns.

### Accounts directory (`d1-accounts.test.ts`)

- [x] `findOrCreateByWaId` — input: `waId: '5511900000000'`, `initialState: waitlisted`, `createdAt: 1000`, no account; expected: `{account: {state: waitlisted, locale: pt-BR}, created: true}`; one row in `accounts`, one in `owner_identities`. — evidence: 71999fb worker.md d1-accounts (12 tests)
- [x] `findOrCreateByWaId` — input: the same `waId` again; expected: `{created: false}` and the same `accountId`; no new row in either table. — evidence: 71999fb worker.md d1-accounts (12 tests)
- [x] `findOrCreateByWaId` — input: 20 concurrent calls for the same new `waId`; expected: every call returns the same `accountId`; `SELECT COUNT(*) FROM accounts` is `1`; `SELECT COUNT(*) FROM owner_identities` is `1` (the A13 no-orphan rule). — evidence: 71999fb worker.md d1-accounts (12 tests)
- [x] `findOrCreateByWaId` — input: 50 accounts with `created_at` 1 ms inside the window and a new `waId` with `newAccountsCap: {since, limit: 50}`; expected: `null`; no row added to either table. — evidence: 71999fb worker.md d1-accounts (12 tests)
- [x] `findOrCreateByWaId` — input: 50 accounts with `created_at` before `since` and a new `waId`; expected: `{created: true}` (the window moved). — evidence: 71999fb worker.md d1-accounts (12 tests)
- [x] `findOrCreateByWaId` — input: an existing `waId` while the daily cap is reached; expected: `{created: false}` (the cap does not block an existing owner). — evidence: 71999fb worker.md d1-accounts (12 tests)
- [x] `findByWaId` — input: an unknown `waId`; expected: `null`. — evidence: 71999fb worker.md d1-accounts (12 tests)
- [ ] `setState` — input: `accountId` to `suspended`; expected: `findByWaId` returns `state: 'suspended'`; the audit `account.state_changed` log has the account id and no phone.
- [x] `remove` — input: an account with two connections, two `message_index` rows and an owner identity; expected: the batch deletes `message_index` first, then `owner_identities`, `connections`, `accounts`; zero rows remain for that account in all four tables (A7, decision 1). — evidence: 71999fb worker.md d1-accounts remove cases (atomic, failing statement, idempotent)
- [x] `remove` — input: a forced failure in the batch after the `message_index` delete; expected: no row removed (atomic); the account is still in state `deleting`. — evidence: 71999fb worker.md d1-accounts remove cases (atomic, failing statement, idempotent)
- [x] `remove` — input: a forced failure in the second statement of the batch (the `connections` delete); expected: no row removed (the batch is atomic); the account still exists in state `deleting`. — evidence: 71999fb worker.md d1-accounts remove cases (atomic, failing statement, idempotent)

### Connections directory and lifecycle (`d1-connections-lifecycle.test.ts`)

- [x] `resolveSecretDigest` — input: an active connection of an active account; expected: `{accountId, agent}`. — evidence: 71999fb worker.md d1-connections-lifecycle resolve (7 states)
- [x] `resolveSecretDigest` — input: a revoked connection; expected: `null`. — evidence: 71999fb worker.md d1-connections-lifecycle resolve (7 states)
- [x] `resolveSecretDigest` — input: a digest with no row; expected: `null`. — evidence: 71999fb worker.md d1-connections-lifecycle resolve (7 states)
- [x] `resolveSecretDigest` — input: an active connection of a `suspended` account; expected: `null`. — evidence: 71999fb worker.md d1-connections-lifecycle resolve (7 states)
- [x] `resolveSecretDigest` — input: an active connection of a `deleting` account; expected: `null`. — evidence: 71999fb worker.md d1-connections-lifecycle resolve (7 states)
- [x] `resolveSecretDigest` — input: an active connection of a `waitlisted` account; expected: `null` (no agents before the sale). — evidence: 71999fb worker.md d1-connections-lifecycle resolve (7 states)
- [x] `resolveSecretDigest` — input: the account is changed to `active` after a call that returned `null`; expected: the next call returns the identity (nothing is cached). — evidence: 71999fb worker.md d1-connections-lifecycle resolve (7 states)
- [x] `register` — input: 7 active agents, `activeLimit: 8`; expected: `Registered`; 8 active rows. — evidence: 71999fb worker.md d1-connections-lifecycle register cases
- [x] `register` — input: 8 active agents; expected: `LimitReached`; still 8 active rows. — evidence: 71999fb worker.md d1-connections-lifecycle register cases
- [x] `register` — input: 8 active and 1 revoked; expected: `LimitReached` for a ninth active name; the revoked row is not counted. — evidence: 71999fb worker.md d1-connections-lifecycle register cases
- [x] `register` — input: 20 concurrent `register` calls with `activeLimit: 8` and 0 active agents, distinct names; expected: exactly 8 `Registered` and 12 `LimitReached`; exactly 8 active rows. — evidence: 71999fb worker.md d1-connections-lifecycle register cases
- [x] `register` — input: two concurrent `register` calls with the same active name; expected: one `Registered`, one `NameTaken`. — evidence: 71999fb worker.md d1-connections-lifecycle register cases
- [x] `register` — input: a revoked `claude` and a new `claude`; expected: `Registered`. — evidence: 71999fb worker.md d1-connections-lifecycle register cases
- [x] `findActiveByAgent` — input: an active `claude`; expected: the record with the digest; for a revoked one: `null`. — evidence: 71999fb worker.md d1-connections-lifecycle findActive, listActive, revoke, rotate cases
- [x] `listActive` — input: two active and one revoked; expected: two records ordered by `created_at` ascending. — evidence: 71999fb worker.md d1-connections-lifecycle findActive, listActive, revoke, rotate cases
- [x] `revoke` — input: an active `claude`; expected: `true`, `revoked_at` set; a second `revoke` returns `false`. — evidence: 71999fb worker.md d1-connections-lifecycle findActive, listActive, revoke, rotate cases
- [x] `rotate` — input: `fromDigest` equal to the stored digest; expected: `true`; the stored digest is `toDigest`; `resolveSecretDigest(fromDigest)` is `null` at once. — evidence: 71999fb worker.md d1-connections-lifecycle findActive, listActive, revoke, rotate cases
- [x] `rotate` — input: `fromDigest` not equal to the stored digest; expected: `false`; the stored digest is unchanged. — evidence: 71999fb worker.md d1-connections-lifecycle findActive, listActive, revoke, rotate cases
- [x] `rotate` — input: 2 concurrent rotations from the same `fromDigest`; expected: exactly one `true`. — evidence: 71999fb worker.md d1-connections-lifecycle findActive, listActive, revoke, rotate cases
- [x] `rotate` — input: rotation to a `toDigest` already used by another connection; expected: fails on the UNIQUE constraint and returns `false` or throws a typed error (the spec's digest UNIQUE holds). — evidence: 71999fb worker.md d1-connections-lifecycle findActive, listActive, revoke, rotate cases
- [x] Owner's `wa_id` — input: a full D1 dump after the lifecycle walk (create, rotate, revoke, delete account for one `waId`); expected: the `waId` string appears only in `owner_identities` and `blocked_phones` (here: zero rows after deletion). — evidence: 71999fb docs-security.md account deletion D1 dump; 71999fb worker.md wa_id only in identity table
- [x] Secret never stored — input: a full D1 dump after create and rotate; expected: no value matches `zb_conn_` and no `secret` value appears; only 64-character hex digests in `connections.secret_digest`. — evidence: 71999fb worker.md Secret never stored (digests only)

### Blocklist and sender guard (`sender-guard.test.ts`)

- [x] `SenderGuard.admit` — input: `waId` listed in `blocked_phones`; expected: `Blocked`; the Rate Limiting binding is called 0 times. — evidence: 71999fb worker.md sender-guard (7 tests)
- [x] `SenderGuard.admit` — input: `waId` not listed; the binding returns success; expected: `Admitted`. — evidence: 71999fb worker.md sender-guard (7 tests)
- [x] `SenderGuard.admit` — input: `waId` not listed; the binding returns failure; expected: `RateLimited`. — evidence: 71999fb worker.md sender-guard (7 tests)
- [x] `SenderGuard.admit` — input: the 21st call within a minute for the same `waId` (binding limit 20); expected: `RateLimited` on the 21st call and `Admitted` for the first 20. — evidence: 71999fb worker.md sender-guard (7 tests)
- [x] `SenderGuard.admit` — input: `waId` blocked after 5 admitted calls; expected: `Blocked` from the next call on (the blocklist is read every time). — evidence: 71999fb worker.md sender-guard (7 tests)
- [ ] `OutboundGuard.admit` — input: 30 calls for one `connectionId` in a minute, then one more; expected: 30 `Admitted`, then `RateLimited`; a different `connectionId` of the same account is `Admitted` while the account total is under 120.
- [ ] `OutboundGuard.admit` — input: 120 admitted calls across three connections of one account in a minute, then one more on a fourth connection; expected: the 121st is `RateLimited` (per-account limit, A16, decision 15); another account is `Admitted`.

### R2 media prefix (`r2-account-media.test.ts`)

- [x] `deleteAll` — input: `accountId: acc1`, 2 500 objects under `accounts/acc1/` and 3 under `accounts/acc2/`; expected: after the call, zero objects under `accounts/acc1/`, three under `accounts/acc2/`. — evidence: a88b0d5 retest-unit-worker.md integration x3 exit 0; 71999fb worker.md r2-account-media
- [x] `deleteAll` — input: an account with no objects; expected: no object deleted, no error. — evidence: a88b0d5 retest-unit-worker.md integration x3 exit 0; 71999fb worker.md r2-account-media
- [x] `deleteAll` — input: called twice; expected: the second call deletes nothing and does not throw. — evidence: a88b0d5 retest-unit-worker.md integration x3 exit 0; 71999fb worker.md r2-account-media
- [x] `deleteAll` — input: `accountId: acc1` while `accounts/acc10/media/x` exists; expected: the `acc10` object remains (the adapter appends the trailing `/`). — evidence: a88b0d5 retest-unit-worker.md integration x3 exit 0; 71999fb worker.md r2-account-media
- [ ] `put` and `get` — input: a media put by the account's `R2MediaStore(accountId: acc1)`; expected: the key is `accounts/acc1/media/<mediaId>` (cross-slice R2 key).

### Durable Object purge (`account-inbox-purge.test.ts`)

- [x] `purge` — input: an inbox with messages, questions, media rows, a `deletion_requested_at` and a scheduled alarm; expected: `ctx.storage` holds only the tombstone key after `purge`; `getAlarm()` returns `null`. — evidence: 71999fb worker.md account-inbox-purge (7 tests)
- [x] `purge` tombstone — input: `receiveOwnerMessage`, `requestDeletion`, `recordRevocation`, `cancelWaiters` and `setState` called after `purge`; expected: each throws `AccountTombstoned`; storage unchanged. — evidence: 71999fb worker.md account-inbox-purge (7 tests)
- [x] `purge` — input: `purge` called twice; expected: no error; the tombstone is still the only key. — evidence: 71999fb worker.md account-inbox-purge (7 tests)
- [x] `purge` — input: called on an already purged inbox; expected: no error. — evidence: 71999fb worker.md account-inbox-purge (7 tests)
- [x] `alarm` after `purge` — input: `runDurableObjectAlarm` on the purged instance; expected: nothing is written; no error. — evidence: 71999fb worker.md account-inbox-purge (7 tests)

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

- [x] Migration `0002` applies after `0001` on an empty database and the seeded development data is gone (the rebuild drops development rows; spec). — evidence: 71999fb worker.md schema and migration path

## Worker integration: inbound and MCP

Runner: `pnpm --filter @zapbip/api test:integration`. The WhatsApp channel is the fake sender (slice 2 fake), the Rate Limiting binding is the test double from `apps/api/test/support/`.

### Owner inbound orchestrator (`owner-inbound.test.ts`)

- [ ] Blocked phone — input: `waId` in `blocked_phones`, text `novo agente x`; expected: the response is `200`; no `accounts` row for the phone; no DO call; log `sender.blocked` with no phone.
- [ ] Over the rate limit — input: 21 owner messages in one minute from the same `waId`; expected: messages 1 to 20 reply; message 21 is silently dropped (`200`, no reply), logged `sender.rate_limited`; the window is not opened for message 21 (checked on the DO screen).
- [ ] Daily cap — input: 50 accounts created in the window and a new `waId` sends `oi`; expected: `200`, no reply, no account row, log `account.daily_cap`.
- [x] First message — input: a new `waId` sends `oi` with `WAITLIST_ENABLED` `'true'`; expected: one account in `waitlisted`; the reply is `Waitlisted`; nothing stored. — evidence: 71999fb worker.md owner-inbound (12 tests)
- [x] First message active — input: a new `waId` sends `oi` with `WAITLIST_ENABLED` `'false'`; expected: one account in `active`; the reply is `Unknown` (no agents, plain text; rule 6 notice held per agent-inbox-core). — evidence: 71999fb worker.md owner-inbound (12 tests)
- [x] Two first messages at once — input: two concurrent first messages from one new `waId`; expected: one account row; both return `200`; one DO receives both (or the second is a duplicate by message id). — evidence: 71999fb worker.md owner-inbound (12 tests)
- [x] Duplicate delivery — input: the same WhatsApp message id delivered twice with `novo agente x`; expected: one connection `x`; the second delivery replies nothing new. — evidence: 71999fb worker.md owner-inbound (12 tests)
- [x] Deleting account — input: an owner message `oi` to an account in `deleting`; expected: `deleteAccount` runs (idempotent); no reply sent; `200`. — evidence: 71999fb worker.md owner-inbound (12 tests)
- [ ] Confirmation order — input: `apagar conta definitivamente` in `active`; expected: the confirmation reply is in the fake sender log before the account state changes to `deleting`; afterwards the account row is gone.
- [ ] Media first message — input: a first message of kind image from a new `waId` in `active`; expected: the account is created; the reply is `Unknown`; no R2 object is written under `accounts/<id>/`; no `messages` row.
- [ ] Unknown phone on the webhook path (slice 2) — input: `from` with no account and the flag `false`; expected: an account is created (replaces slice 2's "no row → stop" rule from this slice on).
- [x] D1 unavailable — input: the D1 binding throws on the account lookup; expected: `5xx`, no reply, no secret issued, no DO call. — evidence: 71999fb worker.md owner-inbound D1 unavailable

### Simulator (`simulator-accounts.test.ts`)

- [ ] Simulator create — input: `POST /dev/owner/5511900000000/messages` with `{kind: "text", text: "novo agente claude"}` in development (`index.dev.ts`); expected: `200`; `GET /dev/owner/5511900000000/screen` lists the install prompt in one or more parts with a `1/n` label.
- [x] Simulator list — input: after the create, `agentes`; expected: the screen lists `claude` with a date and no `zb_conn_` value. — evidence: 71999fb worker.md simulator-accounts (4 tests), production-entry
- [x] Simulator production entry — input: `POST /dev/owner/5511900000000/messages` against `index.ts`; expected: `404`. — evidence: 71999fb worker.md simulator-accounts (4 tests), production-entry
- [x] Simulator — input: the owner phone path parameter `not-a-phone`; expected: `400` with no account created. — evidence: 71999fb worker.md simulator-accounts (4 tests), production-entry
- [ ] Simulator — input: a text on the screen after `apagar conta definitivamente`; expected: the screen shows the confirmation then no account for the phone.

### MCP account states (`mcp-account-states.test.ts`)

- [x] MCP — input: the secret of a connection whose account is `suspended`, `tools/call` `check_inbox`; expected: `401` with `UNAUTHORIZED_BODY`. — evidence: 71999fb worker.md MCP account states (mcp-auth, suspended, deleting, revoked, prefix-less)
- [x] MCP — input: the secret of a connection whose account is `deleting`; expected: `401` with `UNAUTHORIZED_BODY`. — evidence: 71999fb worker.md MCP account states (mcp-auth, suspended, deleting, revoked, prefix-less)
- [x] MCP — input: the secret of a revoked connection; expected: `401` with `UNAUTHORIZED_BODY`, the same bytes as an unknown secret. — evidence: 71999fb worker.md MCP account states (mcp-auth, suspended, deleting, revoked, prefix-less)
- [x] MCP — input: an unknown secret with the `zb_conn_` prefix; expected: `401` with `UNAUTHORIZED_BODY`. — evidence: 71999fb worker.md MCP account states (mcp-auth, suspended, deleting, revoked, prefix-less)
- [x] MCP — input: a value without the `zb_conn_` prefix; expected: `401`, and the D1 binding call count is 0 (the prefix check precedes the read). — evidence: 71999fb worker.md MCP account states (mcp-auth, suspended, deleting, revoked, prefix-less)
- [ ] MCP — input: the secret after `girar claude`, the old secret; expected: `401` on the next request.
- [ ] MCP — input: the new secret from the rotate prompt; expected: `200` and a valid `check_inbox` result.
- [x] MCP — input: the secret of a connection after the account is set back to `active` by the operator; expected: `200` (no cache). — evidence: 71999fb worker.md MCP back-to-active 200

### MCP outbound (`mcp-outbound.test.ts`)

- [ ] `send_message` — input: 30 calls in one minute for one connection; expected: all `ok`.
- [ ] `send_message` — input: the 31st call in the same minute; expected: MCP tool error with the error code `rate_limited`; no WhatsApp send; the DO is not called.
- [ ] `send_message` — input: the 31st call for a second connection of the same account; expected: `ok` (the limit is per connection).
- [x] `check_inbox` — input: 31 calls in one minute; expected: all `ok` (only `send_*`, `react`, `ask` count toward the outbound limit). — evidence: 71999fb worker.md MCP outbound check_inbox uncounted

### Logs and redaction (`logs-redaction.test.ts`)

- [ ] Logs over the whole walk — input: the captured `console` output of: create, `agentes`, `girar`, a rotate send failure, `revogar`, a blocked phone, a rate-limited phone, deletion; expected: no captured line contains `zb_conn_`, a 64-character hex string, the owner phone digits, an agent name, or the text `novo agente`.
- [ ] MCP route log — input: a request to `/c/<secret>/mcp`; expected: no log line carries the route or the secret.
- [ ] `auth_rejected` — input: an unknown secret; expected: one log line with the event name and no secret.

## E2E

Runner: `pnpm --filter @zapbip/api test:e2e` with `ZAPBIP_E2E=1` (starts `wrangler dev src/index.dev.ts` in `globalSetup`).

- [ ] `accounts.e2e.test.ts` pt-BR walk — steps: simulator `novo agente claude-code` for a new phone; read the install prompt parts from the screen; join them; call `tools/list` with the `@modelcontextprotocol/sdk` `Client` on the printed link; call `send_message` with text `oi`; simulator `girar claude-code`; old link `tools/call` returns `401`; new link returns `200`; simulator `revogar claude-code`; new link returns `401`; simulator `apagar conta` then `apagar conta definitivamente`; expected: the screen shows the replies in pt-BR; after deletion the D1 `accounts` and `connections` rows for the phone are gone and the R2 prefix is empty.
- [ ] `accounts.e2e.test.ts` en walk — steps: the same walk with `new agent claude-code`, `rotate`, `revoke`, `delete account`, `delete account permanently`; expected: every reply is in en-US; the outcome equals the pt-BR walk.
- [ ] `accounts.e2e.test.ts` mixed locale — steps: `new agent a1` then `ajuda` then a plain text; expected: the rule 6 question for the plain text is in pt-BR (the last command was `ajuda`).
- [x] `accounts.e2e.test.ts` limit walk — steps: create eight agents then a ninth; expected: the ninth gets the `LimitReached` reply in the owner's locale; `revogar` one agent then the ninth create succeeds. — evidence: 71999fb e2e.md limit walk (9th refused, revoke frees slot); a88b0d5 retest-e2e-security-docs.md 8-agent limit walk
- [x] `accounts.e2e.test.ts` bundle — steps: `wrangler deploy --dry-run` against `wrangler.jsonc` with the production entry; expected: the bundle contains no `/dev/owner/` string and no `DevOwnerSimulator` identifier (slice 1's check still green). — evidence: 71999fb e2e.md bundle (PB-1..3, whatsapp-bundle)

## Docs links

Runner: `pnpm --filter @zapbip/docs exec mint broken-links`.

- [ ] `features/whatsapp-commands` — input: the navigation entry and the page file; expected: the page is linked and resolves; no broken link.
- [ ] `features/manage-your-agents` — input: the same check; expected: no broken link.
- [ ] `help/delete-your-account` — input: the same check; expected: no broken link.
- [ ] `features/whatsapp-commands` content — input: the page text; expected: the page lists every command word of `COMMAND_WORDS` in both languages and the `@<agent> girar a imagem` escape example (item 17) (checked by a docs test that reads `command-words.ts`).
- [ ] `help/delete-your-account` content — input: the page text; expected: it contains the exact phrases `apagar conta definitivamente` and `delete account permanently`, and the statement that Meta keeps the WhatsApp history.

## Security checks

- [ ] Secret format — input: 10 000 issued secrets; expected: each matches `CONNECTION_SECRET_PATTERN`; no duplicates.
- [x] Pattern before D1 — input: `resolveSecretDigest` called from the MCP route with the value `zb_conn_short` (fails `CONNECTION_SECRET_PATTERN`); expected: `null`, and the D1 binding call count is 0 (A3; the spec explains why no timing comparison exists). — evidence: 71999fb worker.md mcp-auth malformed secret without querying the directory
- [x] Equality lookup — input: a well-formed secret whose digest has no row; expected: `null`, one D1 read, no application-code compare of secrets. — evidence: 71999fb docs-security.md key hashing (unknown digest resolves null)
- [ ] No route takes an account id from the request — input: a request to `/c/<secret>/mcp` with an `accountId` query parameter of another account; expected: the call acts only on the secret's account (the parameter is ignored and not read).
- [ ] Durable Object id — input: the account id `acc1` and the DO id `idFromName('acc1')`; expected: a different account id yields a different DO id, and a request for `acc2` never reads `acc1`'s storage (isolation integration case).
- [x] No secret in D1 — input: the D1 dump after the full walk; expected: no `zb_conn_` value and no value other than 64-character hex in `secret_digest`. — evidence: 71999fb worker.md Secret never stored (D1 digests only)
- [x] No secret in a Durable Object row — input: the DO storage dump after `new agent x` and `girar x`; expected: no `zb_conn_` value. — evidence: a88b0d5 retest-e2e-security-docs.md walk: zb_conn_ in no D1, DO, R2 or log file
- [x] No secret in R2 — input: the R2 listing after the walk; expected: no object key or body contains `zb_conn_`. — evidence: a88b0d5 retest-e2e-security-docs.md walk: zb_conn_ in no D1, DO, R2 or log file
- [x] Owner number storage — input: a D1 dump; expected: the owner's `wa_id` appears only in `owner_identities` and `blocked_phones`. — evidence: 71999fb docs-security.md D1 dump has no wa_id after deletion; 71999fb worker.md wa_id only in identity table
- [ ] Blocklist first — input: a blocked phone with the rate limit already exhausted; expected: `Blocked` and the binding not called (order check).
- [x] Unknown secret timing shape — input: an unknown secret and a revoked secret; expected: `401` with byte-identical bodies and the same headers. — evidence: 71999fb e2e.md revoked body and content-type byte-identical to unknown; 71999fb worker.md MCP revoked same bytes
- [ ] Logs — input: the logs of `logs-redaction.test.ts`; expected: the redaction case is green.
- [x] Revocation at once — input: revoke and then the next MCP call in the same second; expected: `401` (nothing cached). — evidence: a88b0d5 retest-e2e-security-docs.md walk: revogar and revoke give 401 at once
- [x] Suspended account — input: the operator sets `suspended` and sends one owner message; expected: one `Suspended` reply, nothing routed, MCP `401`. — evidence: 71999fb unit.md State gate suspended; 71999fb worker.md MCP suspended 401

## Prove it for real: Playwright MCP

The docs are the only browser surface in this slice; the owner's conversation is the simulator's JSON screen.

- [ ] Happy path, docs: `mint dev` serves `features/whatsapp-commands`; steps: open the page, check the command table, follow the link to `features/manage-your-agents`, then to `help/delete-your-account`; expected: each page renders, no 404, the navigation shows the three pages under the guides group.
- [ ] Desktop width: `features/whatsapp-commands` at 1 280 wide; expected: the table is readable, no horizontal page scroll; screenshot at `<path>`.
- [ ] Narrow width: `features/whatsapp-commands` at 375 wide; expected: the table scrolls inside its container, the page has no horizontal page scroll, 16 px side gutter; screenshot at `<path>`.
- [ ] Narrow width: `help/delete-your-account` at 375 wide; expected: the phrases are readable and not clipped; screenshot at `<path>`.
- [ ] Console and network clean: zero console errors and zero failed requests while walking the three pages; expected: no exceptions.
- [ ] Simulator walk, recorded: the walk of the E2E pt-BR case as JSON screens saved at `<path>`; expected: the screens show the install prompt parts in order and the `Listed` and `Revoked` replies.
- [ ] Browser Back mid-flow: on `features/manage-your-agents`, Back after following a link; expected: the previous page, no error.
- [ ] Reload mid-flow: reload `help/delete-your-account`; expected: the same page, the same content.

## Edge cases found during execution

The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each. A case is ticked only when its regression test is named.

- [x] Corrupt sealed install value in D1 — input: `connections.install_code_sealed_secret` corrupted, `resolve` with its code; expected: `Unknown`, no throw (was an `OperationError`) — regression: `s3-security-attacks` (M9 red at a88b0d5) — evidence: found at 71999fb (docs-security edge 1); a88b0d5 retest-unit-worker.md
- [x] Expired install code at its expiry — input: `resolve` at `installCodeExpiresAt` with the sealed secret present; expected: `Expired` and the sealed secret nulled — regression: the resolve expiry tests (M14 red at a88b0d5) — evidence: a88b0d5 retest-unit-worker.md
- [x] Revoke with an open question — input: an agent with an open question, `revogar`; expected: the question is closed — regression: M4a red at a88b0d5 — evidence: a88b0d5 retest-unit-worker.md
- [x] Routing after revoke — input: a plain text after `revogar claude`; expected: not routed to the revoked agent — regression: M4b, M4e, M4f, M4g red at a88b0d5 — evidence: a88b0d5 retest-unit-worker.md
- [x] Re-create of a revoked name — input: `novo agente claude` after `revogar claude`; expected: a clean agent with no old message routing — regression: M4c red at a88b0d5 — evidence: a88b0d5 retest-unit-worker.md
- [ ] Re-create forgets old answered questions — input: an answered question of the old `claude`, revoke, create `claude`; expected: old answers not routed — not ticked: M4d survived every revoke test, no regression yet — evidence: a88b0d5 retest-unit-worker.md
- [x] Alarm for an account not active — input: the Durable Object alarm fires with the account suspended; expected: nothing sent — regression: M5d red at a88b0d5 — evidence: a88b0d5 retest-unit-worker.md
- [x] Purge with a held waiter — input: `purge` while a `wait_for_reply` is held; expected: the waiter ends — regression: "ends every waiter that is still held" (M6 red at a88b0d5) — evidence: a88b0d5 retest-unit-worker.md
- [x] Forwarded text as owner command — input: forwarded and frequently forwarded `revogar alpha`; expected: not a command, `alpha` stays active — regression: forwarded cases (M7 red at a88b0d5, forwarded confirmation case excluded) — evidence: a88b0d5 retest-unit-worker.md
- [x] Menu tap in the account locale — input: the `zapbip:help` tap on an `en_US` account; expected: the menu replies in en-US — regression: "a menu list tap replies in the account locale" (M8 red at a88b0d5) — evidence: a88b0d5 retest-unit-worker.md
- [x] Expiry boundary — input: `resolve` at exactly `installCodeExpiresAt`; expected: `Expired` (`<=`) — regression: two tests (M3 red at a88b0d5) — evidence: a88b0d5 retest-unit-worker.md
- [ ] A failing sweep or clear hides the other job — input: `clearExpiredInstallSecrets` throws while the sweep runs; expected: the other job still runs and the failure is rethrown — not ticked: the committed suite does not catch sequential awaits (M2 survived); the tester's own test passes but is not committed; the dispatch changed in cdfeb86 — evidence: a88b0d5 retest-unit-worker.md
- [ ] Stored reply masks the install code — input: a sent reply with an install link; expected: no clear `zb_inst_` in the stored log — not ticked: masking by id changed after a88b0d5 (cdfeb86) — evidence: a88b0d5 retest-unit-worker.md (M10 red there)
- [ ] Logic Bit line in menu, unknown and waitlist replies — not ticked: the line now comes from COMPANY.tradeName, changed after a88b0d5 — evidence: a88b0d5 retest-unit-worker.md (M11, M12, M13 red there)
- [ ] `createUpload` for a revoked agent or a suspended account — input: `createUpload` with a revoked connection; expected: `ok:false`; observed at a88b0d5: `ok:true` — not ticked: admission added in cdfeb86 with red tests in 916130b, not run at HEAD — evidence: a88b0d5 retest-unit-worker.md
- [x] Agent list with an empty client name — input: an agent with `clientName` null; expected: the list shows the empty mark, not a bare `-` (E1 at 71999fb) — regression: "list client name / empty mark" case — evidence: 71999fb e2e.md E1; a88b0d5 retest-e2e-security-docs.md walk (`cliente desconhecido`, `unknown client`)
- [x] Names with reserved words, diacritics and length — input: `novo agente ajuda`, `novo agente ÉÇÃO`, a 40-character name; expected: the reserved reply, `ecao`, the invalid-name reply — regression: `agent-name.test.ts` and the create cases `ReservedName`, `InvalidName` — evidence: 71999fb e2e.md E3
- [x] Rate limit by phone — input: 25 messages from one phone in a minute; expected: 20 handled, 5 dropped with 5 `sender_rate_limited` lines — regression: owner-inbound over the rate limit (reply count only) — evidence: a88b0d5 retest-e2e-security-docs.md walk; 71999fb e2e.md E4
- [x] Concurrent creates on one new phone — input: 10 concurrent `novo agente parN`; expected: 1 account, 8 created, 2 limit replies; 5 concurrent creates of one name: 1 created — regression: the 20-concurrent `register` and the same-name `register` cases — evidence: 71999fb e2e.md E5
- [ ] Wrangler request log prints `/c/zb_conn_<secret>/mcp` — input: a request to the MCP route in `wrangler dev`; expected: no secret in the request log — not ticked: observation, no regression, a deploy-readiness decision — evidence: 71999fb e2e.md E6; a88b0d5 retest-e2e-security-docs.md INFO
- [ ] Owner's first photo is discarded behind `Não entendi` — input: a first message of kind image on an active account; expected: the spec's failure-table outcome — not ticked: the probe is not committed and there is no regression test; the spec accepts the outcome — evidence: 71999fb worker.md probe
- [ ] Waitlisted account with a media first message — not ticked: not probed — evidence: 71999fb worker.md edge cases
- [ ] R2 `deleteAll` test timed out once — input: `deleteAll` over 2 500 objects under load; expected: the test passes — not ticked: it uses the default 5 s timeout with no headroom — evidence: 71999fb worker.md (1 of 3 runs)
- [ ] Rotate send failure restores the old install code — input: `girar` with the second send failing, then `resolve` the old code; expected: the old code is `Ready` again — not ticked: the committed tests are vacuous (M18, M19 survived); the probe goes red under both mutants — evidence: 71999fb unit.md D1
- [ ] Deletion confirm when the webhook answers 500 mid-failure — input: `apagar conta definitivamente` after a forced D1 failure, then redelivery; expected: one confirmation reply and no rows left — not ticked: the deletion confirm path changed after a88b0d5 (liveness read once); no committed regression — evidence: a88b0d5 retest-e2e-security-docs.md walk N2
- [ ] Sweeps never scheduled — input: the scheduled handler with an expired install code and a deleting account; expected: both swept — not ticked: the `*/30` cron and job record came in cdfeb86, after a88b0d5 — evidence: 71999fb docs-security.md FINDING
- [ ] Owner's first message to a rotated or seed account — input: a message after `girar` on a seed account; expected: unclear from the walk — not ticked: no regression, not diagnosed — evidence: 71999fb e2e.md E7

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: two first messages from one phone yield one account and no orphan account row — attack: 50 concurrent first messages for one `waId` with the daily cap at 49, checking the `accounts` count and the identity count; result: `refuted | held`. — result: not run at HEAD. Partial evidence: 20 concurrent `findOrCreateByWaId` (d1-accounts) and two concurrent first messages (owner-inbound). The 50-concurrent attack at cap 49 was not run.
- [ ] Claim 2: twenty concurrent creates for the last slot yield exactly `AGENTS_PER_ACCOUNT_LIMIT` connections — attack: 20 creates with distinct names interleaved with 3 revokes; result: `refuted | held`. — result: not run at HEAD. Partial evidence: 20 concurrent `register` at limit 8 (d1-connections-lifecycle). The attack with 3 interleaved revokes was not run.
- [ ] Claim 3: a rotated link stops working at once and a failed send leaves the owner with the old link — attack: rotate, immediately call with the old link, then fail the send and call with the old link again; result: `refuted | held`. — result: not run at HEAD. Partial evidence: the walk shows the old secret at 401 after `girar` (a88b0d5). The failed-send step is not run end to end; the install-code restore is vacuous in the committed tests.

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
- Head not re-run. Every tick cites 71999fb or a88b0d5. Commit cdfeb86 (with its red tests 916130b and 6a6f0e6) and the merges f141a4c (agent-inbox-core, upload stream cancel, printable-ASCII MIME) and 065ab7b (whatsapp-cloud-channel) came after a88b0d5 and change the deletion liveness read, the redaction by id, the cron dispatch, the `createUpload` admission and the outbound key helper. Rows on those paths are unticked; the other ticks rest on a88b0d5 code for paths those merges touched. Risk: a regression in those paths is not seen until a run at HEAD.
- Mutants that survive: M14 (agents limit 8 to 9) and M34 (daily cap 50 to 51) survived every unit test, so the literals are not pinned; M4d (answered questions after re-create) survived; M18 and M19 (install-code restore on a failed rotate) are vacuous; M2 (one failing job hides the other) is not caught by the committed suite.
- Not automated: the MCP, D1 and R2 steps of the two accounts E2E walks; the mixed-locale walk; the media first message; the webhook path for an unknown phone; the MCP route log and `auth_rejected` assertions (the code emits `auth_rejected`, no test names it); the operator script (`apps/api/test/unit/operator-script.test.ts`) and the `logEvent` boxes, which were not run.
- Install page: `GET /i/<code>` is not on this branch (install-skills). The second use `410`, the install-code brute-force limit and the Playwright walk of the install page cannot be tested here.
- Docs: 14 docs files changed after a88b0d5 (coming-soon removal, Logic Bit footer and company facts). Every docs row is unticked; the link check ran at a88b0d5, before that change.
- Plan drift: some rows still name `sender.blocked`, `account.daily_cap`, `InstallPrompt`, the `1/n` label, `/c/<secret>/mcp` in a reply, the guides group and the phrase "Meta keeps the WhatsApp history". The code and the spec no longer say these, so the rows stay unticked. The owner needs to strike or reword them.

## Delta (2026-11-06): the install-link reply

These boxes replace the install prompt parts, the generic renderer and the create and rotate cases that asserted `/c/<secret>/mcp` in a reply. The struck boxes above stay as history.

### Install lines (`account-copy.test.ts`)

- [x] `renderInstallLines` — input: `installLink` and each locale; expected: exactly two lines, the first with the link, each under `WHATSAPP_TEXT_MAX_CHARS`, no `zb_conn_`. — evidence: 71999fb unit.md delta renderInstallLines, Created and Rotated copy PASS (account-copy.test.ts)
- [x] `renderAccountReply` — input: `Created` and `Rotated` in both locales; expected: the text holds the agent name, the two install lines and the rotate hint, and no `zb_conn_`. — evidence: 71999fb unit.md delta renderInstallLines, Created and Rotated copy PASS (account-copy.test.ts)
- [x] `renderAccountReply` — input: `Created` with the longest agent name; expected: at most `WHATSAPP_TEXT_MAX_CHARS`. — evidence: 71999fb unit.md delta renderInstallLines, Created and Rotated copy PASS (account-copy.test.ts)

### Create and rotate (`create-agent-connection.test.ts`, `rotate-agent-connection.test.ts`)

- [x] `createAgentConnection` — input: `claude`; expected: the reply holds `<publicOrigin>/i/zb_inst_`, not `/c/`, not the issued secret; the registered connection carries the install code digest, a sealed secret and `installCodeExpiresAt = now + INSTALL_CODE_TTL_MS`. — evidence: 71999fb unit.md delta create and rotate PASS (M24-M27 killed), one session text
- [x] `createAgentConnection` — input: the sealed secret opened with the issued install code; expected: the issued secret; opened with another code: fails. — evidence: 71999fb unit.md delta create and rotate PASS (M24-M27 killed), one session text
- [x] `rotateAgentConnection` — input: `claude` active; expected: a new install code replaces the old one; the old digest no longer resolves; the reply holds the new link. — evidence: 71999fb unit.md delta create and rotate PASS (M24-M27 killed), one session text
- [ ] `rotateAgentConnection` — input: the send fails; expected: the old install code digest, sealed secret and expiry are restored.
- [x] `receiveAccountMessage` — input: `novo agente claude`; expected: exactly one session text, no `1/n` label. — evidence: 71999fb unit.md delta create and rotate PASS (M24-M27 killed), one session text

### List (`list-agent-connections.test.ts`)

- [x] `listAgentConnections` — input: one agent with `clientName` `claude-code`, one with `null`; expected: the first line shows the client name, the second shows the empty mark; no secret or install code. — evidence: 71999fb unit.md delta list client name and empty mark PASS; a88b0d5 retest-e2e-security-docs.md walk: cliente desconhecido

### Vault (`install-code-vault.test.ts`)

- [x] `issue` — input: 1 000 issues; expected: distinct codes matching `zb_inst_` plus 22 base64url characters (16 bytes), digests of 64 hex characters, digest differs from the code. — evidence: 71999fb unit.md Vault PASS (M37-M40 killed)
- [x] `seal` and `open` — input: a round trip; expected: the secret returns. — evidence: 71999fb unit.md Vault PASS (M37-M40 killed)
- [x] `open` — input: a code differing in one character; expected: rejects. — evidence: 71999fb unit.md Vault PASS (M37-M40 killed)
- [x] `seal` — input: the same code and secret twice; expected: two different sealed values (random IV). — evidence: 71999fb unit.md Vault PASS (M37-M40 killed)

### D1 (`d1-connections-lifecycle.test.ts`, `migration-0002.test.ts`)

- [x] Migration `0002` — expected: `connections` has `install_code_digest`, `install_code_sealed_secret`, `install_code_expires_at` and `first_call_at`; two rows with the same install code digest are refused. — evidence: 71999fb worker.md delta worker boxes (d1-install-codes, 14 tests)
- [x] `resolve` — input: a fresh code; expected: `Ready` with the connection link built from the opened secret, the agent, the account locale, `accountId` and `connectionId`. — evidence: 71999fb worker.md delta worker boxes (d1-install-codes, 14 tests)
- [x] `resolve` — input: unknown code, revoked connection; expected: `Unknown`. — evidence: 71999fb worker.md delta worker boxes (d1-install-codes, 14 tests)
- [x] `resolve` — input: `now` equal to the expiry; expected: `Expired` with the account locale. — evidence: 71999fb worker.md delta worker boxes (d1-install-codes, 14 tests)
- [x] `resolve` — input: after `recordFirstCall`; expected: `Used`. — evidence: 71999fb worker.md delta worker boxes (d1-install-codes, 14 tests)
- [x] `recordFirstCall` — input: called twice; expected: `first_call_at` keeps the first value; the sealed secret is null. — evidence: 71999fb worker.md delta worker boxes (d1-install-codes, 14 tests)
- [x] `recordFirstCall` — input: two connections, one call; expected: the other connection stays `Ready`. — evidence: 71999fb worker.md delta worker boxes (d1-install-codes, 14 tests)
- [x] `rotate` — input: a used connection rotated; expected: the new code is `Ready` and the old code is `Unknown`. — evidence: 71999fb worker.md delta worker boxes (d1-install-codes, 14 tests)
- [x] `revoke` — expected: the install code columns are cleared. — evidence: 71999fb worker.md delta worker boxes (d1-install-codes, 14 tests)
- [x] Secret never stored — input: a D1 dump after create; expected: no `zb_conn_` and no `zb_inst_` value. — evidence: 71999fb worker.md delta worker boxes (d1-install-codes, 14 tests)

### Sweep (`deletion-sweep.test.ts`)

- [ ] `clearExpiredInstallSecrets` — input: one expired and one live code; expected: only the expired sealed secret is cleared.

### Logs (`logs-redaction.test.ts`) and E2E

- [ ] Logs over the whole walk — expected: no captured line contains `zb_inst_`.
- [ ] `accounts.e2e.test.ts` — steps: create, read the install link from the screen, the page shows the connection URL, a real MCP call with it, the second use of the link is `410`; expected as the spec's E2E.
