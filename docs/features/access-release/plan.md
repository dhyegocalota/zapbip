# Plan: Access release

**Spec:** spec.md
**Tier:** 🔴 structural
**Seam:** `AccountDirectory` in `libs/core/src/accounts`, `receiveOwnerInbound`, the backoffice routes and the metrics batch.
**Assumptions (decided, owner can override):**
- The ADR number is 0043 and the migration number is 0012.
- The release message reuses the approved notice template outside the window.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `libs/core/src/accounts/**`, `libs/types/src/**` | `developer` |
| G2 | `apps/api/migrations/0012*`, `apps/api/src/adapters/d1/**`, `apps/api/src/inbound/**`, `apps/api/src/account-inbox/**`, `apps/api/src/contract/**` | `developer` |
| G3 | `apps/api/src/backoffice/**`, `apps/api/e2e/**` | `developer` |
| G4 | docs, runbooks | `developer` |

## Sequencing

G1, then G2, then G3 and G4.

## Steps

### G1

- [ ] **Step 1:** release use case and invite code rules, tests first
- [ ] **Step 2:** the access message and its copy

### G2

- [ ] **Step 3:** migration 0012, D1 adapters, the Durable Object notice
- [ ] **Step 4:** redeem a code in the inbound handler

### G3

- [ ] **Step 5:** the Access page, both batches, the result pages
- [ ] **Step 6:** the metrics section and the answered-question counter
- [ ] **Step 7:** the Playwright walk

### G4

- [ ] **Step 8:** runbooks, ADR index, README rows

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 3 | the migration on a live database | `pnpm migrate:staging` fails | deploy the previous Worker, drop the new table and indexes |
| 4 | a valid code consumed by a state that cannot use it | an account stays waitlisted with a used code | the code was consumed only after the state check; issue a new invite |
| 5 | a batch half applied | the audit counts differ from the selection | repeat it; released accounts are no-ops |

**Steps with no backout:** none; the column `accounts.released_at` stays after a rollback and is ignored.

## Z. Prove and ship

- [ ] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict.
- [ ] **/check-ui:** screenshots and video recorded and uploaded.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
