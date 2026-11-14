# Tester briefing: Resend fetch illegal invocation

Not applicable: a one-file fix proven by its unit test and by a delivered email in production.

## Red today, green after

- `resend-email-sender.test.ts` "calls fetch without a receiver, as workerd requires": red before the change, green after.

## Gaps

- The mock of the other tests ignores its receiver; only this test checks it.
