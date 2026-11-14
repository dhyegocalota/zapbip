# Plan: WhatsApp onboarding replies

**Spec:** spec.md
**Tier:** 🟡
**Seam:** `receiveAccountMessage` (the `Waitlisted` verdict) and `refuseOtherNumber` in the inbound handler
**Assumptions (decided, owner can override):**
- Both cooldowns last one day.
- The request-access link is the site home of the language, where the waitlist form lives.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `libs/types/src/constants.ts`, `libs/core/src/accounts/**`, `apps/api/src/inbound/owner-inbound.ts`, `apps/api/src/adapters/d1/**`, `apps/api/src/adapters/whatsapp/whatsapp-copy.ts`, `apps/api/migrations/0015_other_number_notices.sql`, `apps/api/test/**`, `docs/features/whatsapp-onboarding-replies/**`, `docs/adr/0049-*` | `developer-1` |

## Sequencing

One lane.

## Steps

- [x] **Step 1 (red):** core test: a waitlisted phone gets one onboarding reply with both links, none inside the cooldown, commands still answered, one again after a day — evidence: 9534d264
- [x] **Step 2:** the onboarding copy, the link constants and the cooldown on the `Waitlisted` verdict — evidence: 52028896
- [x] **Step 3 (red):** integration file through the inbound handler for every case — evidence: 6b44c790
- [x] **Step 4:** migration `0015`, `D1OtherNumberNotices`, the `wa.me` link and the cooldown in `refuseOtherNumber`, the row removed with the account — evidence: 6c313e20

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | A waitlisted phone never hears back | The cooldown starts before a failed send | The cooldown starts after the send |
| 4 | The table is missing in production | `no such table: other_number_notices` on a wrong-number message | Apply migration `0015` before the deploy; roll back by deploying the previous Worker, then dropping the table |

**Steps with no backout:** none

## Z. Prove and ship

- [ ] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
