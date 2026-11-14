# Plan: Prose leak ratchet

**Spec:** spec.md
**Tier:** 🟡 medium
**Seam:** `libs/agents/src/checks`, `tools/repository-shape`, the README, two docs pages
**Assumptions (decided, owner can override):**
- The public prose is `apps/docs` outside the agent pages, the root README and the connector and api READMEs.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `libs/agents/src/checks`, `tools/repository-shape` | `developer` |
| G2 | `README.md`, `docs/media`, `apps/docs/**/index.mdx`, the open source docs generator | `developer` |

## Sequencing

One lane.

## Steps

### G1

- [x] **Step 1:** `registeredLeakAgents` and the ratchet test with its baseline — evidence: `prose-leaks.test.ts`
- [x] **Step 2:** the Worker may import the wake facet — evidence: `agent-registry.test.ts` boundaries

### G2

- [x] **Step 3:** the demo image and the section on the difference with a channel — evidence: README
- [x] **Step 4:** drop the product list from the home page and the plugin names from the open source table — evidence: baseline lowered from 327 to 287

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 1 | A legitimate edit fails the ratchet | the second test names the page | lower or raise the number on purpose in the same change |
