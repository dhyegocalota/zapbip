# Test plan: Access release

## The failing test first

- [ ] `libs/core/src/accounts/use-cases/release-account-access.test.ts` — input: a waitlisted account; expected: `Released`, state `active`
- [ ] Confirmed it fails for the right reason: `releaseAccountAccess is not implemented`

## Unit

- [ ] release: already active returns `AlreadyActive`; suspended returns `NotWaitlisted`; unknown id returns `NotFound`
- [ ] `invite-code.test.ts`: a code is found inside a sentence, case-insensitively; a short, long or prefix-less token is not a code
- [ ] `redeem-access-invite.test.ts`: valid code releases a waitlisted account; used, expired and unknown codes change nothing; an active or suspended account never consumes a code

## Integration

- [ ] `backoffice-access.test.ts`: release and invite need a session, CSRF and a fresh step-up code; over the limit and empty selections are `422`; one audit row per batch with counts; a repeat is a no-op; a failed delivery is reported as not notified
- [ ] `access-invite-first-message.test.ts`: valid code opens a new account active; an existing waitlisted account is released; used, expired, unknown and wrong-state codes change nothing
- [ ] `backoffice-metrics-access.test.ts`: waitlist per day and by language, invites, conversion, windows

## E2E (Playwright specs)

- [ ] `apps/api/e2e/backoffice-access.spec.ts` — steps: sign in, filter, select two accounts, release with a code; expected: the result page counts them; at 1440 and 375

## Prove it for real — Playwright MCP

- [ ] Happy path, entry to exit: Access, select, release, result
- [ ] Empty: no one waiting; expected: the empty states
- [ ] Rejected input: wrong code; expected: `401` notice and nothing changed
- [ ] Desktop width 1440 and narrow width 375

## Edge cases found during execution

## Adversarial review

- [ ] Claim 1: a code cannot be redeemed twice — attack: two simultaneous first messages
- [ ] Claim 2: release never touches a suspended account — attack: a race with a suspension
- [ ] Claim 3: no secret is stored or logged — attack: read the table and the audit rows

## Coverage honesty

- The real WhatsApp delivery is not exercised; the fake channel stands in for it.
