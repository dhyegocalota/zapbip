# Tester briefing: Agentic account

## What changed and where

- Core (`libs/core/src/accounts`): `requestAccountChange` (validate, ask the owner, apply), `applyAgentCommand` (same `applyOwnerCommand` as the commands, replies to the owner or to the agent), `describeAccount` and `buildAccountOverview`, `sendAccountReplies` (moved out of `receiveAccountMessage`, now returns whether the owner was reached), the approval copy in en_US and pt_BR, `maskedPhoneOf` (moved here; `apps/api/src/client-app/masked-phone.ts` re-exports it).
- API (`apps/api`): five tools in `src/mcp/account-tools.ts`, three Durable Object methods (`describeAccount`, `requestAccountChange`, `sendSignInLink`), the binding `ACCOUNT_CHANGE_RATE_LIMITER` (3 a minute, namespaces 1006, 2006, 3006), `src/accounts/overview-wire.ts` shared by the tools and the app, `Accept: application/json` on the app home page.
- Docs: `features/let-your-ai-manage-zapbip`, five `mcp-reference` pages, a web app section, in English and Portuguese; ADR 0045.

## How to run

- Core: `pnpm --filter @zapbip/core exec vitest run src/accounts`
- Integration (one file at a time, port 4012 must be free): `pnpm --filter @zapbip/api exec vitest run --config vitest.integration.config.mts test/integration/mcp-account-tools.test.ts` and `.../client-app-json.test.ts`
- Unit: `pnpm --filter @zapbip/api exec vitest run --config vitest.unit.config.mts test/unit/wrangler-limits.test.ts test/unit/wrangler-rate-limit-namespaces.test.ts`
- E2E: `pnpm --filter @zapbip/api exec vitest run --config vitest.e2e.config.mts test/e2e/mcp-client.e2e.test.ts -t "E2E-24|E2E-25"`
- Docs: `pnpm --filter @zapbip/repository-shape exec vitest run src/docs-experience.test.ts`

## Red today, green after

| Test | Red failure text |
|------|------------------|
| `account-overview.test.ts`, `describe-account.test.ts`, `apply-agent-command.test.ts`, `request-account-change.test.ts` | `<name> is not implemented` (b24dc4ea) |
| `mcp-account-tools.test.ts` | 14 of 15 failed: the tools threw `<tool> is not implemented`; the registry test is a pin (00bccff4) |
| `client-app-json.test.ts` | 6 failed: `SyntaxError: Unexpected token '<', "<html lang"... is not valid JSON` and `expected 200 to be 401` (00bccff4) |
| `wrangler-limits.test.ts`, `wrangler-rate-limit-namespaces.test.ts` | `expected undefined to deeply equal { limit: 3, period: 60 }` and `expected [ Array(5) ] to have a length of 6` (00bccff4) |

The e2e tests E2E-24 and E2E-25 were written after the implementation (green on landing, pins of the stack).

## Hypotheses for the tester

1. A tool never changes the account without a tap: Deny, no answer in 50 seconds and a tap after the timeout leave the agent list unchanged.
2. The install link reaches the result only after the button `Allow, send to agent`; every other path puts it on the owner screen only, and no log line carries it.
3. A name that exists only in another account is never revoked or listed.
4. The fourth acting call in a minute is an error starting with `rate_limited`; reads are unlimited.
5. The app home page answers JSON only to `Accept: application/json`, `401` when signed out, and the HTML is unchanged.
6. A repeated request within four minutes is a new question (the six character reference) and is not answered by the earlier tap.

## Gaps I know about

- The allowance left is not reported: the account keeps no message counter (ADR 0045 revisit).
- The pending question of a timed-out approval stays tappable and shows up in the asking agent inbox as an answered question; it applies nothing.
- `holdForAnswer` registers its waiter after one read of the answer, so a tap in the milliseconds between delivering the question and the registration is missed and the call waits its full time (existing core behaviour, only reachable by a script; a human cannot tap that fast).
- With the 24-hour window closed the question queues behind the notice and the call times out before the owner can see it.
- Real WhatsApp delivery of the three-button question is not exercised, only the fake channel.
- The docs call the page "Let your AI manage zapbip" because the docs speak of AIs, not agents (ADR 0030).
