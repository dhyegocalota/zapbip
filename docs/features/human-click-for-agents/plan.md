# Plan: A person presses the button

**Spec:** spec.md
**Tier:** 🔴 structural
**Seam:** `apps/api/src/site`
**Assumptions (decided, owner can override):**
- Old `agent` rows stay; only the write path goes.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/api/src/site/**`, `apps/api/test/**`, `apps/api/e2e/landing/**`, `docs/adr/0044*`, `docs/adr/0062*`, `.claude/rules/site.md` | `developer` |

## Sequencing

One lane.

## Steps

### G1

- [x] **Step 1:** remove the endpoint, its limits, its cap and its tests — evidence: typecheck clean
- [x] **Step 2:** prefill the form from `?email=` — evidence: `site-page.test.ts`
- [x] **Step 3:** twin, `llms.txt`, agent card and the ten language copies tell the agent to open the link; drop the page section — evidence: `site-agentic-twins.test.ts`
- [x] **Step 4:** WebMCP `fill_join_form` — evidence: `site-webmcp-script.test.ts`

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | A prefilled address is cached for others | `cache-control` is not `private, no-cache` | the test pins it |
| 1 | An integration still calls the removed route | a 404 in a client | revert the pull request |
