# Plan: Agentic account

**Spec:** spec.md
**Tier:** 🔴 structural
**Seam:** `libs/core/src/accounts`, `AccountInboxRpc`, `apps/api/src/mcp`, the client app home route.
**Assumptions (decided, owner can override):**
- The ADR number is 0045 and no migration is needed.
- The button limit of 20 characters names the third button `Allow, send to agent`.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `libs/core/src/accounts/**`, `libs/types/src/**` | `developer` |
| G2 | `apps/api/src/account-inbox/**`, `apps/api/src/contract/**`, `apps/api/src/mcp/**`, `apps/api/src/adapters/guard/**`, `apps/api/src/accounts/**`, `apps/api/wrangler.jsonc`, `apps/api/src/client-app/**` | `developer` |
| G3 | `apps/docs/**`, rules, READMEs | `developer` |

## Sequencing

G1, then G2, then G3.

## Steps

### G1

- [x] **Step 1:** overview and approval rules, tests first — evidence: red b24dc4ea, green fcf6393e
- [x] **Step 2:** the shared reply delivery, the agent command and the account change use cases — evidence: e5405da0, fcf6393e, db100a5d

### G2

- [x] **Step 3:** the Durable Object methods and the five tools, the rate limiter binding — evidence: red 00bccff4, green 2447ca7e, e2e e5d80072
- [x] **Step 4:** the JSON twin on the client app — evidence: red 00bccff4 (`client-app-json.test.ts`), green c3f23852

### G3

- [x] **Step 5:** docs pages en and pt-br, tools reference, navigation, rules and READMEs — evidence: 70691641 (`docs-experience.test.ts` 74 passed)

## Failure modes

| Step | What breaks | Signal | Back out |
|------|-------------|--------|----------|
| 3 | A tool approves without the owner | integration test `denied` or `timed_out` leaves the agent list unchanged | revert the tool registration |
| 3 | The binding is missing in an environment | `wrangler-limits` test | add the binding |
| 4 | JSON leaks to a signed-out caller | `401` test | revert the Accept branch |
