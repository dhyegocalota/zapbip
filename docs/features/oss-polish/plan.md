# Plan: Open-source polish

**Spec:** spec.md
**Tier:** 🟡 medium
**Seam:** `scripts/pr-media.sh`, the harness files that mention Releases, the README, `.github/`, `docs/runbooks/release.md`
**Assumptions (decided, owner can override):**
- The contact email stays `dhyego@logicbit.com.br`.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `scripts/pr-media.sh`, `scripts/pr-media.test.sh`, `package.json`, the recorder role and adapters, `check-ui`, `open-pr`, `HARNESS.md`, `.github/pull_request_template.md`, `.agents/hooks/doctor.sh` | `developer` |
| G2 | `docs/runbooks/release.md`, `docs/runbooks/README.md`, `apps/*/CHANGELOG.md` | `developer` |
| G3 | `README.md`, `.github/CODEOWNERS`, `.github/dependabot.yml`, issue templates, the shape tests | `developer` |

## Sequencing

G1, G2 and G3 in order, one lane.

## Steps

### G1

- [x] **Step 1:** red: the script test and the harness shape test — evidence: 409ba5b4
- [x] **Step 2:** `scripts/pr-media.sh`, then every harness file stops naming Releases — evidence: `scripts/pr-media.test.sh` and `pr-media-flow.test.ts` green

### G2

- [x] **Step 3:** red: the release runbook and changelog shape test — evidence: red commit before the runbook
- [x] **Step 4:** the runbook, its index row and the changelogs

### G3

- [x] **Step 5:** red: the README essentials and `.github` files shape test
- [x] **Step 6:** README, code owners, dependency updates, templates

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | A harness file keeps a stale instruction | the harness shape test | revert the commit |
| 6 | A README link breaks | `delivery-docs.test.ts` | revert the commit |

**Steps with no backout:** none

## Z. Prove and ship

- [x] **Tester briefing:** not applicable, tooling lane; the gate is the proof.
- [ ] **Tester run:** not applicable (class tooling).
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict.
- [ ] **/check-ui:** not applicable.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
