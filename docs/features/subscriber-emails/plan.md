# Plan: Subscriber emails

**Spec:** spec.md
**Tier:** 🟡
**Seam:** the two callers of `joinWaitlist` and `SCHEDULED_JOBS`
**Assumptions (decided, owner can override):**
- The referral link stays out of the welcome while `REFERRAL_SHARING_OPEN` is `false`.
- The digest copy is Portuguese only; the welcome copy is in every `OwnerLocale`.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/api/package.json`, `pnpm-lock.yaml`, `apps/api/src/emails/**`, `apps/api/src/adapters/email/**`, `apps/api/src/adapters/fake/fake-email-sender.ts`, `apps/api/src/contract/**`, `apps/api/src/operations/**`, `apps/api/src/site/**`, `apps/api/src/backoffice/host-dispatch.ts`, `apps/api/migrations/0016_welcome_emails.sql`, `apps/api/test/**`, `apps/api/.dev.vars.example`, docs | `developer-1` |

## Sequencing

One lane: the port comes first, then the templates, the welcome, the digest and the legal copy.

## Steps

### G1

- [ ] **Step 1:** React, React DOM, `@react-email/components` and `@react-email/render` pinned in `apps/api`; the dry-run bundle builds.
- [ ] **Step 2:** red tests for the Resend request and the delivery choice, then `EmailSender`, the Resend adapter, the fake and the disabled sender.
- [ ] **Step 3:** red tests for the templates and the copy parity, then the layout, the welcome and the digest templates and their copy.
- [ ] **Step 4:** red tests for the welcome after both join routes, once only and in the background, then migration `0016` and the welcome delivery.
- [ ] **Step 5:** red tests for the digest facts, content and schedule, then the `subscriber_digest` job.
- [ ] **Step 6:** the privacy policy names the welcome, access news and Resend in every language.
- [ ] **Step 7:** `RESEND_API_KEY` documented and warned by the deploy preflight; runbook, rules and README updated.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 1 | The bundle does not build for workerd | `wrangler deploy --dry-run` fails | Remove the dependencies |
| 4 | A join waits for Resend | The join integration test times out | Revert the route change |
| 4 | Migration `0016` fails | `wrangler d1 migrations apply` fails | A new forward migration; the columns are nullable |
| 5 | The digest sends twice in a day | Two emails at 11:00 | The idempotency key per day dedupes for 24 hours |

**Steps with no backout:** none

## Z. Prove and ship

- [ ] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`.
- [ ] **/check-ui:** screenshots and video recorded and uploaded (only if UI was touched).
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
