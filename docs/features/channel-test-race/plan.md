# Plan: Channel test race

**Spec:** spec.md
**Tier:** 🟢 small
**Seam:** `apps/connector/test/integration/channel.test.ts`
**Assumptions (decided, owner can override):**
- The same wait-on-the-pipe pattern as `listen.test.ts`.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/connector/test/integration/channel.test.ts` | `developer` |

## Steps

### G1

- [x] **Step 1 (red):** a late-read variant of the relay test fails with `expected [] to deeply equal [ { …(2) } ]`.
- [x] **Step 2:** the channel tests wait for the notifications and the connected log line before reading them.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | a wait that never resolves | the test times out with its name | revert the test file |

**Steps with no backout:** none

## Z. Prove and ship

- [x] **Tester run:** fresh `tester` sub-agents executed `test-plan.md` and ticked every row with evidence (3/3 at b799d61e, 2/2 at a8809f58); the PR's CI `lifecycle` job is the merge gate
- [x] **/open-pr:** opened by the lead — PR #27
