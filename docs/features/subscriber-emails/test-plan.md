# Test plan: Subscriber emails

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] `apps/api/test/unit/resend-email-sender.test.ts` — input: one welcome message and a fetch that answers `200`; expected: one POST to `https://api.resend.com/emails` with the bearer key, the JSON body and the `Idempotency-Key`
- [ ] Confirmed each red commit fails on its named assertion, with the failure text recorded in `tester-briefing.md`

## Unit

- [ ] `resend-email-sender.test.ts` — input: a `500`, a thrown fetch; expected: `Failed`, one `email.send_failed` line with the kind and status and no address
- [ ] `email-delivery.test.ts` — input: no key in production, no key in development, a key, a blank key; expected: `Disabled`, `Fake`, `Resend`, `Disabled`
- [ ] `email-delivery.test.ts` — input: the disabled sender sends one message; expected: `Disabled`, one `email.disabled` line, no fetch
- [ ] `email-templates.test.ts` — input: the welcome in each `OwnerLocale`; expected: the subject and heading of that language in the HTML and text, `dir="rtl"` only for Arabic, no `{placeholder}` left
- [ ] `email-templates.test.ts` — input: copy of every language; expected: no blank entry, the same placeholders as English
- [ ] `subscriber-digest.test.ts` — input: a day with no subscriber; expected: subject `zapbip · 0 novos inscritos (14/11)` and the "no new subscriber" line
- [ ] `subscriber-digest.test.ts` — input: a busy day; expected: each address with locale, source, referrer and time, the totals by locale, the welcome counts and the top referrers
- [ ] `scheduled.test.ts` — input: 11:00 UTC, 11:30 UTC, 10:00 UTC; expected: the digest is due only at 11:00

## Integration (workerd)

- [ ] `welcome-email.test.ts` — input: a site join; expected: one welcome to the address in the page language and `welcome_sent_at` stamped
- [ ] `welcome-email.test.ts` — input: the same address joins twice; expected: one welcome
- [ ] `welcome-email.test.ts` — input: an agent request-access; expected: one welcome in the requested language
- [ ] `welcome-email.test.ts` — input: a sender that never settles; expected: the join answers `200` before the send ends
- [ ] `welcome-email.test.ts` — input: a sender that fails; expected: the join answers `200`, `welcome_failed_at` stamped, `welcome_sent_at` empty
- [ ] `subscriber-digest-queries.test.ts` — input: rows inside and outside the 24 hours; expected: only the rows inside, the totals over all rows

## Prove it for real

- [ ] With a staging `RESEND_API_KEY`, join `staging.zapbip.com` with a real inbox in Portuguese and in Arabic; expected: one welcome each, right to left in Arabic, readable in a dark client

## Edge cases found during execution

## Adversarial review

- [ ] Claim 1: a repeated join never sends twice — attack: two concurrent joins of one address; result:
- [ ] Claim 2: a Resend outage never slows the join — attack: a sender that hangs; result:
- [ ] Claim 3: no address reaches a log line — attack: grep the captured logs of every test; result:

## Coverage honesty

- The real Resend endpoint and the rendering in real mail clients are proven only by the staging walk above.
