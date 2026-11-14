# Plan: Resend fetch illegal invocation

**Spec:** spec.md
**Tier:** 🟢 small
**Seam:** `apps/api/src/adapters/email/resend-email-sender.ts`
**Assumptions (decided, owner can override):**
- None.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/api/src/adapters/email/resend-email-sender.ts`, `apps/api/test/unit/resend-email-sender.test.ts` | `developer` |

## Sequencing

One group, one lane.

## Steps

### G1

- [x] **Step 1:** red: a `fetch` that throws when called with a receiver — evidence: `resend-email-sender.test.ts` failed with `TypeError: Illegal invocation`
- [x] **Step 2:** destructure `apiKey` and `fetchImplementation` and call the bare function — evidence: 10 of 10 green

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | The welcome still fails | `email.send_failed` in `wrangler tail`, no email in Resend | revert the commit and deploy |
