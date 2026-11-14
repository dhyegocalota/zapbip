# Resend fetch illegal invocation

**Status:** Shipped 2026-11-14
**Tier:** 🟢 small
**Owner approval:** the owner asked on 2026-11-14 for the welcome and the digest to work in production once the Resend key exists
**ADRs:** [0058](../../adr/0058-email-is-sent-through-resend-with-react-email-templates.md)
**Not changing:** the templates, the delivery choice, the digest, the join answers

## Problem

With `RESEND_API_KEY` set in production and `zapbip.com` verified in Resend, every welcome logged `email.send_failed` with `errorCode: TypeError` and Resend listed no email. The adapter called `input.fetchImplementation(...)`, which gives the global `fetch` of workerd the options object as its receiver, and workerd answers `Illegal invocation: function called with incorrect this reference`. The error is thrown before the promise exists, so the `.catch` that maps a network failure to `Failed` never saw it. The unit tests passed a mock that ignores its receiver.

## Goals

- The adapter calls `fetch` with no receiver, so the welcome and the digest reach Resend in workerd.

## Non-goals

- Retrying a failed welcome; a repeated join already tries again.

## Design

### Data flow

`createResendEmailSender` destructures `apiKey` and `fetchImplementation` from its input once, and `send` calls the bare function.

### Failure handling

A `fetch` that throws before returning a promise is still reported by the caller of `send` as a failed welcome (`errorCode` in the log); it is the same path that exposed this defect.

## Open questions → answers

None.

## Test strategy summary

A unit test passes a `fetch` that throws when it has a receiver, red before the change and green after. Proof in production: a join through `POST /api/request-access` lists a Delivered email in Resend.
