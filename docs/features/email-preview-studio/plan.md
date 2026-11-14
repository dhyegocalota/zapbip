# Plan: Email preview studio

**Spec:** spec.md
**Tier:** 🟢 small
**Seam:** `apps/api/scripts/emails/`, `scripts/`
**Assumptions (decided, owner can override):**
- Port 3100, version pinned to 6.11.13.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/api/scripts/emails/previews/`, `apps/api/scripts/emails/preview-of.ts`, `apps/api/test/unit/email-previews.test.ts`, `scripts/emails-preview.sh`, `package.json`, `scripts/README.md`, `.claude/rules/site.md`, `docs/runbooks/email.md` | `developer` |

## Sequencing

One group, one lane.

## Steps

### G1

- [x] **Step 1:** a preview per locale and for the digest, over the real templates — evidence: `email-previews.test.ts` 2 passed
- [x] **Step 2:** `scripts/emails-preview.sh` and the `emails:preview` script — evidence: the studio served `/preview/welcome-arabic` with `dir="rtl"`
- [x] **Step 3:** the rule and the runbook name the command — evidence: the diff

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | A new `react-email` major changes its CLI | the script prints a prompt or an error | change the pinned version in the script |
