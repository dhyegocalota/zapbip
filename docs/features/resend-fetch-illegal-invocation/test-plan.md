# Test plan: Resend fetch illegal invocation

## The failing test first

- [x] `resend-email-sender.test.ts` "calls fetch without a receiver, as workerd requires" — input: a `fetch` that throws a `TypeError` when its receiver is not `undefined`; expected: red before the change — evidence: `TypeError: Illegal invocation: function called with incorrect `this` reference`, 1 failed, 9 passed

## Unit

- [x] The Resend sender posts, authenticates, sends the idempotency key and maps a refusal and a network failure — evidence: 10 of 10 passed after the change

## Production

- [x] A join through `POST /api/request-access` with an owner-controlled address sends one welcome — evidence: recorded in the pull request after the deploy
