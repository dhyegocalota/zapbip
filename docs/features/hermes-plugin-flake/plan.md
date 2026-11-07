# Plan: Hermes plugin flake

**Spec:** spec.md
**Tier:** 🟢 small
**Seam:** `apps/hermes-plugin/tests` and the `typecheck` script
**Assumptions (decided, owner can override):**
- Wider margins, not an injected clock.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/hermes-plugin/package.json`, `apps/hermes-plugin/tests/**` | `developer` |

## Sequencing

One group, one lane.

## Steps

### G1

- [x] **Step 1:** widen the heartbeat and backoff test margins — evidence: 6279f3a, 3634ff5
- [x] **Step 2:** red: `typecheck` covers `tests/` and reports 3 errors — evidence: 32bb021
- [x] **Step 3:** fix the 3 strict mypy errors in `tests/support` — evidence: c59548e

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 1    | A guard stops biting | a mutation check passes | revert the commit |
| 3    | A helper changes behaviour | pytest red | revert the commit |

**Steps with no backout:** none

## Z. Prove and ship

- [x] **Tester briefing:** not applicable, tooling lane; the gate and the mutation checks are the proof.
- [ ] **Tester run:** not applicable (class tooling).
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict.
- [ ] **/check-ui:** not applicable.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
