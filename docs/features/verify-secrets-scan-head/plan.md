# Plan: Verify secrets scan HEAD

**Spec:** spec.md
**Tier:** 🟢 small
**Seam:** `gate_secrets` in `scripts/verify.sh`
**Assumptions (decided, owner can override):**
- CI keeps scanning all refs.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `scripts/verify.sh`, `scripts/verify.test.sh` | `developer` |

## Sequencing

One group, one lane.

## Steps

### G1

- [x] **Step 1:** red: a secret only on another branch must not fail the secrets gate — evidence: 5996b153
- [x] **Step 2:** pass `--log-opts=HEAD` to `gitleaks git` — evidence: 6e0d3ef6

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | A flag the installed gitleaks rejects | `verify: secrets failed` on every run | revert the commit |

**Steps with no backout:** none

## Z. Prove and ship

- [ ] **Tester briefing:** not applicable, tooling lane; the gate is the proof.
- [ ] **Tester run:** not applicable (class tooling).
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict.
