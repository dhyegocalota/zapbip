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

- [ ] **Step 1:** overview and approval rules, tests first
- [ ] **Step 2:** the shared reply delivery, the agent command and the account change use cases

### G2

- [ ] **Step 3:** the Durable Object methods and the five tools, the rate limiter binding
- [ ] **Step 4:** the JSON twin on the client app

### G3

- [ ] **Step 5:** docs pages en and pt-br, tools reference, navigation, rules and READMEs

## Failure modes

| Step | What breaks | Signal | Back out |
|------|-------------|--------|----------|
| 3 | A tool approves without the owner | integration test `denied` or `timed_out` leaves the agent list unchanged | revert the tool registration |
| 3 | The binding is missing in an environment | `wrangler-limits` test | add the binding |
| 4 | JSON leaks to a signed-out caller | `401` test | revert the Accept branch |
