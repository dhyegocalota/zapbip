# 0068. Numbers of the business that owns the Meta app connect through a system user token

- Status: Accepted
- Date: 2026-11-16
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: the owner's report of 2026-11-16 that Meta's Embedded Signup popup never lets the business portfolio that owns the app (Logic Bit, app `714836811568009`) be picked ("This Meta Business Account owns the app"); [ADR 0036](0036-one-fixed-meta-app-and-numbers-join-through-embedded-signup.md); [ADR 0032](0032-whatsapp-numbers-are-rows-in-a-sealed-registry-not-worker-secrets.md); [ADR 0067](0067-the-two-step-pin-is-optional-and-sealed-per-number.md)

## Context

[ADR 0036](0036-one-fixed-meta-app-and-numbers-join-through-embedded-signup.md) connects every number through Embedded Signup, whose popup exchanges a one-shot code for a business token. The popup refuses the business portfolio that owns the app, so the numbers that live in that portfolio's own WhatsApp Business accounts cannot join. A system user of that portfolio, with the app and those accounts assigned, can hold a token that never expires and already carries `whatsapp_business_management` over them.

## Decision

1. **A second connect path.** Numbers, "Connect a number from our own business", sits next to "Connect a WhatsApp number". It asks for the same fresh authenticator code, which opens the page for the same ten minutes and one attempt.
2. **The credential is one optional Worker secret.** `META_SYSTEM_USER_TOKEN` is the token of an admin system user of the business that owns the app. It is optional: the deploy preflight never refuses when it is absent, and the page shows a short "not configured" notice instead of the form.
3. **Discovery without typed IDs.** The Worker inspects the token (`debug_token`, the granular scopes of `whatsapp_business_management`) to find the WhatsApp Business accounts it was granted, reads `GET /{waba_id}/phone_numbers` of each, and lists the numbers that are not in the registry, by display number and verified name.
4. **One shared onboarding.** Everything after the code exchange of ADR 0036 (read the number, check the grant, refuse a webhook claimed elsewhere, subscribe the app, register with the PIN, override the webhook) is one function that both paths call. The failure steps, kinds, messages and PIN rules (ADR 0067) are the same.
5. **The system user token is the number's business token.** It is sealed in the number row as ADR 0032 seals every token, shared by every number connected this way. Replacing it for one number stays the existing "Replace access token".
6. **Its own audit action.** `number.connected_from_own_business`, succeeded or failed, so the Audit page tells the two paths apart.
7. **The server picks the account.** The form posts only the chosen phone number ID; the Worker looks the WhatsApp Business account up again from the discovery, so a posted account is never trusted.

This amends point 1 of ADR 0036: Embedded Signup stays the path for every business portfolio except the one that owns the app.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Type the phone number ID, the account ID and a token by hand | no new secret | the typing ADR 0036 removed; a pasted token reaches the browser | the owner wants no IDs typed |
| Move the app to another portfolio | Embedded Signup works for all | the app, its review and its templates move; a long, risky Meta process | the owner's numbers are in the portfolio that owns the app |
| Store the token as a registry row | rotated in the backoffice | a credential that opens every account is a Worker secret by ADR 0032 | a secret is write-only and never shown |
| Make the secret required | one code path less | a deploy refused for a feature few use | the owner asked for it optional |

## Consequences

- One token opens every number connected this way; a leak exposes them all, so it is set only at the `wrangler secret put` prompt and rotated in Meta.
- A system user needs the app and the accounts assigned with full control, or discovery lists nothing.
- No migration: the registry columns are the ones ADR 0032 created.
- Rollback: the Worker rollback is enough; connected rows keep their sealed token.

## Evidence

- `apps/api/test/integration/backoffice-own-business-numbers.test.ts` proves the not configured notice, the refused code, the listing of unregistered numbers only, the subscription, the generated and typed PIN, the sealed token and PIN, the audit rows and the failure that stores nothing.
- `apps/api/test/integration/backoffice-meta-onboarding.test.ts` still passes on the shared onboarding.

## Revisit when

- Meta lets the Embedded Signup popup pick the portfolio that owns the app.
- A second business portfolio needs its own system user token.
