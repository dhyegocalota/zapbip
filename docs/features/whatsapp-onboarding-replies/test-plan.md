# Test plan: WhatsApp onboarding replies

## The failing test first

- [ ] `libs/core/src/accounts/use-cases/receive-account-message.test.ts::the onboarding reply carries the setup and request-access links of the owner language` — input: a first text from a waitlisted phone; expected: the reply holds the get-started and site links of its language
- [ ] Confirmed it fails for the right reason: the old reply was the two-line waitlist text without links; and `a second message inside the cooldown gets no second onboarding reply` got two replies

## Unit

- [ ] `receive-account-message.test.ts::a command inside the cooldown is still answered` — input: `oi` then `ajuda` from a waitlisted phone; expected: two replies
- [ ] `receive-account-message.test.ts::the onboarding reply comes again after the cooldown` — input: a message a day and a minute later; expected: a second reply
- [ ] `receive-account-message.test.ts::a redelivered message does not start the cooldown a second time` (pin) — input: the same message id twice, then a message after the cooldown of the first; expected: two replies in all

## Integration (`apps/api/test/integration/whatsapp-onboarding-replies.test.ts`)

- [ ] New phone, twice — expected: one `waitlisted` account, one onboarding text with the pt-BR links
- [ ] English phone — expected: English links, no `/pt-br`
- [ ] Command inside the cooldown — expected: answered
- [ ] Active account on its home number — expected: no onboarding text
- [ ] Wrong number, twice — expected: one post on the other number with the `wa.me` link of the home number, no new account, nothing on the account screen
- [ ] Wrong number after the cooldown — expected: a second post
- [ ] English account on the wrong number — expected: the English copy with both tokens filled
- [ ] Suspended account, twice — expected: two suspended replies, no onboarding text

## Prove it for real — Playwright MCP

Not applicable: no screen changes. The owner flow walk of the scenario suite covers the inbound path.

## Edge cases found during execution

Empty on purpose.

## Adversarial review

- [ ] Claim 1: a failed send never starts the cooldown — attack: make the send throw; result:
- [ ] Claim 2: a deleted account leaves no `other_number_notices` row — attack: delete after a notice; result:
- [ ] Claim 3: a second phone cannot read or reset another account's cooldown — attack: keys are the account id; result:

## Coverage honesty

- The reply wording is read by the owner, not asserted beyond the links.
- A real Meta send is not exercised.
