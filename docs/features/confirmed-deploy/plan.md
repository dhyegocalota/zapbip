# Plan: Confirmed deploy

**Spec:** spec.md
**Tier:** 🟡 medium
**Seam:** `apps/api/scripts/deploy.ts`, `.agents/hooks`, the company facts
**Assumptions (decided, owner can override):**
- The venue clause says the courts of Brazil in every language.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/api/scripts/deploy.ts`, `apps/api/src/operations/deploy-preflight.ts`, their tests | `developer` |
| G2 | `.agents/hooks`, `.claude/settings.json`, `.codex/hooks.json`, `.claude/HARNESS.md` | `developer` |
| G3 | `libs/types/src/constants.ts`, `apps/api/src/site/legal-copy*.ts`, `apps/docs/**/company.mdx`, `README.md`, docs | `developer` |

## Sequencing

One lane.

## Steps

### G1

- [x] **Step 1:** `--confirm` and `canConfirm` — evidence: `deploy-entry.test.ts`, `deploy-preflight.test.ts`

### G2

- [x] **Step 2:** remove the guard, its wiring and its tests — evidence: `hooks.test.sh` all checks passed

### G3

- [x] **Step 3:** remove the street address and the city — evidence: `git grep` finds neither; typecheck and shape suites green

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 1 | A deploy runs when it should not | `--confirm` equals another environment and the run refuses | revert the pull request |
| 3 | A legal page loses a required fact | the owner reads the privacy policy | restore the constant and the placeholders |
