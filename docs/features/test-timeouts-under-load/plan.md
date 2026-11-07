# Plan: Test timeouts under load

**Spec:** spec.md
**Tier:** 🟢 small
**Seam:** Vitest and Playwright configurations, `mcp-outbound.test.ts`
**Assumptions (decided, owner can override):**
- Local constants per package.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `tools/repository-shape/src/test-timeouts.test.ts`, `tools/repository-shape/src/repository-files.ts`, every `vitest*.config.*`, `libs/core/vitest.config.mts`, `apps/api/test/integration/mcp-outbound.test.ts` | `developer` |

## Sequencing

One group, one lane.

## Steps

### G1

- [x] **Step 1:** red: the shape test over every Vitest and Playwright configuration — evidence: red commit on this branch
- [x] **Step 2:** set `testTimeout` and `hookTimeout` in every Vitest configuration and add the `libs/core` configuration — evidence: green shape test
- [x] **Step 3:** `mcp-outbound.test.ts` settles in-flight calls before `reset` — evidence: api integration inside `pnpm verify all`

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | A hung test now waits 30 s instead of 5 s | slower red runs, not wrong results | revert the commit |
| 3 | A leftover call keeps `afterEach` waiting | the hook timeout fires | revert the commit |

**Steps with no backout:** none

## Z. Prove and ship

- [x] **Tester briefing:** not applicable, tooling lane; the gate is the proof.
- [ ] **Tester run:** not applicable (class tooling).
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict.
- [ ] **/check-ui:** not applicable.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
