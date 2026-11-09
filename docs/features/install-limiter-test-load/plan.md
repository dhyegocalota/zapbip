# Plan: Install limiter test load

**Spec:** spec.md
**Tier:** 🟢 small
**Seam:** `apps/api/test/integration/install-page-attack.test.ts` and `apps/api/test/support/rate-limit-window.ts`
**Assumptions (decided, owner can override):**
- The emulated binding keeps its wall-clock fixed window.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/api/test/integration/install-page-attack.test.ts`, `apps/api/test/support/rate-limit-window.ts` | `developer` |

## Steps

### G1

- [x] **Step 1 (red):** a variant waits until 20 ms before a window boundary and runs the old sequential loop; it fails with `expected 0 to be greater than 0`.
- [x] **Step 2:** `startInFreshWindow` waits for the next window when under 10 s remain; the test sends the burst with `Promise.all`; the variant is removed.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | a margin longer than the time the burst needs | the test waits up to the margin once per run | shorten the margin |

**Steps with no backout:** none

## Z. Prove and ship

- [x] **Tester run:** a fresh tester ran the integration file three times in a row (14/14 each) and the fixed test started 20 ms before a window boundary (3/3); both mutations caught
- [x] **/open-pr:** opened by the lead — PR #28
