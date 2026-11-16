# 0067. The two-step PIN is optional and sealed per number

- Status: Accepted
- Date: 2026-11-16
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: the owner's order of 2026-11-16 (the PIN becomes optional and is always saved, sealed, in the numbers registry); [ADR 0036](0036-one-fixed-meta-app-and-numbers-join-through-embedded-signup.md), point 5 and its rejected row "Generated PIN, sealed per number"; [ADR 0032](0032-whatsapp-numbers-are-rows-in-a-sealed-registry-not-worker-secrets.md)

## Context

[ADR 0036](0036-one-fixed-meta-app-and-numbers-join-through-embedded-signup.md) made the operator type a six-digit two-step PIN for every number and never stored it. A forgotten PIN left a number that Meta would not re-register, and the operator had to keep each PIN in a password manager.

## Decision

1. **The PIN field is optional.** Empty or exactly six digits is accepted; anything else is refused with the existing field error.
2. **An empty field generates the PIN.** The Worker draws six digits from `crypto.getRandomValues` with rejection sampling, so every value from `000000` to `999999` is equally likely, and registers the number with it. A typed PIN is used as it is: a number that already has two-step verification needs its own PIN.
3. **The PIN is always sealed on the number row.** Column `whatsapp_numbers.sealed_two_step_pin` (migration `0017`, nullable) holds it sealed with the registry key, exactly like the business token and with its own associated data (`whatsapp_numbers:<id>:two_step_pin`). Rows that existed before keep `NULL`.
4. **The PIN never travels.** It is never logged, never put in a flash, a URL or an audit text.
5. **The operator can show it.** On the number page, "Show PIN" asks for a fresh authenticator code, as every other sensitive action of the backoffice does, and answers one page with the PIN and `Cache-Control: no-store`. The attempt is audited as `number.pin_revealed`, succeeded or failed. A row with no sealed PIN shows "PIN not stored" and no button.
6. **Re-registration.** No code re-registers a number today. A future caller reads the sealed PIN from the row when it is present.

This supersedes point 5 of ADR 0036 and its rejected row "Generated PIN, sealed per number".

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Keep the typed, never stored PIN | no PIN at rest | a lost PIN blocks re-registration; the operator keeps a secret by hand | the owner ordered the PIN saved |
| Always generate, never accept a typed PIN | simplest form | fails on a number that already has two-step verification | such a number needs its own PIN |
| Store the PIN as a Worker secret per number | write-only | a secret per number, deployed by hand | rows are sealed in the registry already (ADR 0032) |
| Show the PIN with the number page alone | one click | a session theft would read the PIN | a fresh authenticator code gates every sensitive action |

## Consequences

- A D1 export plus the registry key opens every PIN, as it opens every business token today.
- The PIN is a six-digit value, so its seal protects it at rest only; the fresh code protects the reveal.
- Migration `0017` adds a nullable column and breaks no running Worker version.
- Rollback: the Worker rollback is enough; the column stays unread.

## Evidence

- `apps/api/src/numbers/number-sealing.ts` seals the business token and the PIN with their own associated data.
- `apps/api/test/integration/number-registry.test.ts` proves the stored column is not the plaintext and opens to it.
- `apps/api/test/integration/backoffice-numbers-pin.test.ts` proves the code requirement, the refusal, the `no-store` header, the audit rows and the `NULL` case.

## Revisit when

- Meta stops requiring a PIN to register a number, or a number is re-registered by code.
