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

- [ ] **Tester run:** the `lifecycle` job of the PR's CI is green.
- [ ] **/open-pr:** opened by the lead.
