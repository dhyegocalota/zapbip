# Tester briefing: Access release

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

- `libs/core/src/accounts/use-cases/release-account-access.ts` — the state transition `waitlisted` to `active`, one conditional update, repeat is a no-op.
- `libs/core/src/accounts/use-cases/redeem-access-invite.ts`, `invite-code.ts` — the code format, the finder and the redemption rule.
- `libs/core/src/accounts/use-cases/notice-access-opened.ts`, `account-copy.ts` — the WhatsApp message of an opened access, `pt_BR` and `en_US`.
- `apps/api/migrations/0012_access_release.sql` — `accounts.released_at`, `waitlist_invites`, six indexes.
- `apps/api/src/adapters/d1/d1-access-invites.ts`, `d1-account-directory.ts` — issue and consume codes (digest only), release and find by id.
- `apps/api/src/inbound/owner-inbound.ts` — redeems a code on the first message of a waitlisted account, then sends the access message.
- `apps/api/src/account-inbox/account-inbox.ts` — `noticeAccessOpened` RPC and the `questions_answered` activity counter.
- `apps/api/src/backoffice/access/**` — the Access page, both batch actions, the result pages and the invite CSV.
- `apps/api/src/backoffice/metrics/**` — the Access and waitlist section of the metrics page.
- `docs/adr/0043-*`, `docs/runbooks/backoffice.md` step 7, `docs/runbooks/deploy.md` migration 0012, `.claude/rules/backoffice.md`.

## How to run

```bash
pnpm --filter @zapbip/core exec vitest run
pnpm --filter @zapbip/api typecheck
pnpm --filter @zapbip/api test:unit
pnpm --filter @zapbip/api exec vitest run --config vitest.integration.config.mts test/integration/d1-access-release.test.ts test/integration/access-invite-first-message.test.ts test/integration/backoffice-access.test.ts test/integration/backoffice-metrics-access.test.ts test/integration/backoffice-metrics.test.ts
pnpm --filter @zapbip/api test:walk
```

## Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `libs/core/src/accounts/invite-code.test.ts`, `use-cases/release-account-access.test.ts`, `redeem-access-invite.test.ts`, `notice-access-opened.test.ts` | `findInviteCode is not implemented`, `releaseAccountAccess is not implemented`, `redeemAccessInvite is not implemented`, `noticeAccessOpened is not implemented` (30 failures) | the use cases exist |
| `apps/api/test/integration/d1-access-release.test.ts` | `D1AccessInvites.issue is not implemented`, `D1AccountDirectory.release is not implemented` | the adapters exist |
| `apps/api/test/integration/access-invite-first-message.test.ts` | the account stayed waitlisted (the case with the waitlist off is a pin) | the handler redeems the code |
| `apps/api/test/integration/backoffice-access.test.ts` | the routes answered `404` | the page and both batches exist |
| `apps/api/test/integration/backoffice-metrics-access.test.ts` | `cell access-waitlist-total is missing` | the section exists |

## Hypotheses to attack

1. Hypothesis: a release is idempotent and never touches a `suspended` or `deleting` account. Break it by: two simultaneous release posts for the same ids; suspend an account between the page and the post.
2. Hypothesis: an invite code works once. Break it by: two phones sending the same code at the same moment; the same phone sending it twice; a code with other letter case; a code in the middle of a longer message.
3. Hypothesis: no code or full phone number reaches a log, an audit row or a stored flash. Break it by: reading `backoffice_audit`, the log lines of a batch and `backoffice_sessions.flash` after a rejected batch.
4. Hypothesis: the batch page works without a script at 375 px. Break it by: ticking rows on a phone-width window and submitting with and without "select all".
5. Hypothesis: an owner whose 24-hour window is closed receives the access message after tapping Open on the notice template. Break it by: releasing an account that never wrote, then answering the template.
6. Hypothesis: an existing active account never consumes a code. Break it by: sending a valid code from an active and from a suspended account, then from a waitlisted one.

## Known gaps

- The invite message is stored as an ordinary owner message after redemption, so an agent connected later could read the (already spent) code.
- A batch is capped at 10 because one release costs three subrequests and the Free plan allows 50 per request; raise `ACCESS_BATCH_LIMIT` on a paid plan.
- The real WhatsApp channel and the real notice template are not exercised; the fake channel stands in for them.
- No email is sent; the operator copies the links.
- `docs/features/access-release/plan.md` steps are ticked with commit hashes; the Playwright walk screenshots are under the scratchpad folder `dev/access-release/`.
