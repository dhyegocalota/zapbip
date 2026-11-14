# 0056. Templates are submitted and rechecked automatically for every number

- Status: Accepted
- Date: 2026-11-14
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: the owner's request of 2026-11-14; [ADR 0051](0051-whatsapp-speaks-eight-languages-and-the-template-of-a-language-is-chosen-by-a-table.md), which left submission to the operator

## Context

Outside the 24-hour window zapbip reaches the owner only through an approved utility template, in two names and nine languages. The operator created each by hand in WhatsApp Manager (runbook steps 11 and 12), and the backoffice number check only listed the languages in use. Every new number repeated the manual work, and a forgotten language was found only when a send was refused.

## Decision

The bodies, quick replies and samples of all eighteen templates live in code. Verifying a number lists its WhatsApp Business account for all nine languages, creates every missing template as Utility through the Graph API and reports it Pending. A refused creation stays Missing and never fails the verification; a Rejected template is never resubmitted, because Meta judged its content. Nothing is submitted for a number whose display number does not match. A scheduled job at minute 30 of every hour repeats the check for each number whose stored snapshot has a template that is not Approved, so a template that was missing, refused or pending is followed until it is Approved. It records a snapshot only when the outcome is Verified and never moves `verifiedAt`, so an hourly check can never downgrade a number. The operator acts only when Meta rejects a template.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Keep submitting by hand | No code | Eighteen manual creations per account, forgotten languages | The owner wants a checklist that runs itself |
| Submit only the languages in use | Fewer requests | A language flip needs a second manual round | Approval takes up to a day; submitting all up front removes the wait |
| Submit only when the operator presses verify | No scheduler | Statuses go stale and a refused submission is never retried | The hourly check keeps the snapshot honest |

## Consequences

- A verified number has all eighteen templates Pending within one request, then Approved on Meta's schedule.
- The scheduled job opens every unfinished number's token each hour; a failing number does not stop the others, and the tick reports the first failure.
- The runbook tables stay as the reference, and a test proves bodies, quick replies and samples in code match them.

## Evidence

`apps/api/test/unit/number-verification.test.ts`, `apps/api/test/unit/template-recheck.test.ts` and `apps/api/test/unit/whatsapp-templates.test.ts`.

## Revisit when

Meta changes the template creation endpoint, or a language needs a category other than Utility.
