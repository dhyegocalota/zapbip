# Plan: Wake providers and channel protocol in the agent folders

**Spec:** spec.md
**Tier:** 🔴 structural
**Seam:** `libs/agents`, `libs/core/src/wake`, `libs/types`, `apps/api`, `apps/connector`
**Assumptions (decided, owner can override):**
- The stored provider ids stay `grok_routine` and `claude_routine`.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `libs/agents` | `developer` |
| G2 | `libs/core/src/wake`, `libs/types` | `developer` |
| G3 | `apps/api`, `apps/connector` | `developer` |

## Sequencing

G1 first, then G2 and G3.

## Steps

### G1

- [x] **Step 1:** the `wake` and `channel` facets, generators and exports — evidence: `pnpm agents:generate`, `pnpm agents:check` 0 violations
- [x] **Step 2:** leak literals for hosts, provider ids and channel protocol — evidence: `leak-scan.test.ts`

### G2

- [x] **Step 3:** injected `pinnedProviders`, neutral fixtures — evidence: `libs/core` suite green

### G3

- [x] **Step 4:** the Worker and the connector read the registry — evidence: api unit and integration suites, connector suite

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 3 | A pinned provider stops matching | `set_wake` refuses a routine URL it accepted | revert the pull request |
| 4 | The channel command loads no protocol | `zapbip channel` throws at start | restore the constants |
