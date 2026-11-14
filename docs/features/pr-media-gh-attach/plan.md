# Plan: PR media through the GitHub CLI

**Spec:** spec.md
**Tier:** 🟢 small
**Seam:** `scripts/pr-media.sh`, `.agents/hooks/doctor.sh`
**Assumptions (decided, owner can override):**
- Minimum `gh` 2.99.0, the release that introduced `--attach`.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `scripts/pr-media.sh`, `scripts/pr-media.test.sh`, `.agents/hooks/doctor.sh`, `.agents/hooks/hooks.test.sh`, `.agents/roles/recorder.md`, `.claude/HARNESS.md`, `docs/adr/0054*`, `docs/adr/0059*`, `docs/adr/README.md`, `scripts/README.md` | `developer` |

## Sequencing

One group, one lane.

## Steps

### G1

- [x] **Step 1:** the script runs one `gh pr edit --attach` and prints the added lines — evidence: `pr-media.test.sh` all checks passed
- [x] **Step 2:** the doctor requires `gh` 2.99.0 — evidence: `hooks.test.sh` all checks passed
- [x] **Step 3:** ADR 0059 supersedes 0054, the recorder and HARNESS link it — evidence: `pr-media-flow.test.ts` and `document-indexes.test.ts` passed

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 1 | `gh pr edit` fails on the Projects classic deprecation | the script exits non-zero with GitHub's GraphQL message | revert; ADR 0054's browser driver returns |
| 2 | The doctor refuses every older `gh` | `doctor: 1 missing required` | `brew upgrade gh` |
