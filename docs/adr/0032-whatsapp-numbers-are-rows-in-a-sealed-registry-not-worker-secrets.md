# 0032. WhatsApp numbers are rows in a sealed registry, not Worker secrets

- Status: Accepted
- Date: 2026-11-07
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: the owner's order of 2026-11-07 and its correction the same day (numbers are registered in the backoffice, not configured); [ADR 0012](0012-owner-identity-by-wa-id-on-the-shared-number.md); [ADR 0013](0013-webhook-acknowledged-after-a-durable-commit-and-deduplicated-by-message-id.md); [ADR 0031](0031-the-backoffice-is-a-separate-host-signed-in-with-a-key-and-totp-enrolled-from-the-owners-terminal.md)

## Context

The channel reads one WhatsApp number from three Worker secrets: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` and `META_APP_SECRET`. Every send uses that token, every webhook is verified with that app secret, and `routes/whatsapp.ts` drops any change whose `phone_number_id` is not the configured one. Adding a second number therefore means a redeploy with new secrets.

The operator must add numbers from the backoffice (ADR 0031) without a deploy. One webhook URL must serve every number, so the Worker learns each delivery's number from the payload and verifies it with that number's Meta app.

## Decision

1. Numbers and Meta apps are D1 rows. `meta_apps` holds the Meta app ID, a label and the sealed app secret. `whatsapp_numbers` holds the phone number ID, WABA ID, display number, label, sealed access token and state. `accounts.number_id` binds each account to the number its owner first wrote to.
2. Credentials are sealed with AES-256-GCM under the Worker secret `NUMBER_REGISTRY_KEY` (32 bytes, base64). The associated data names the row and the field (`whatsapp_numbers:<id>:access_token`, `meta_apps:<id>:app_secret`), so a value copied into another row does not open. A value that does not open is an error naming the row, never a silent skip. The cipher is one shared helper, extracted from the wake secret box.
3. One endpoint, `POST /webhooks/whatsapp`, attributes each delivery by `metadata.phone_number_id`, or by `entry[].id` as the WABA ID when a change has no metadata. The delivery must resolve to exactly one Meta app, and that app's secret verifies `X-Hub-Signature-256`. An unknown ID, two apps in one delivery and an unparseable body all answer `401` with the same body as a bad signature.
4. The Worker secrets `META_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` are removed from `Bindings`, `WorkerSecret`, `.env.example`, the test bindings and the deploy preflight. `WHATSAPP_VERIFY_TOKEN` stays, because the endpoint owns it and the owner types it into every Meta app.
5. The channel reads numbers only through the `NumberRegistry` port. Outbound resolves the number for each send, and no plaintext token is kept between requests.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Keep Worker secrets, one set per number | no new storage and no new cipher | a redeploy per number; secret names multiply; no operator view | the owner ruled that numbers are data |
| One webhook URL per number | attribution by path, no payload parsing | every number needs its own URL in Meta; the operator configures each one | the owner chose one endpoint |
| Plaintext tokens in D1 | simplest reads | a D1 export or an SQL read exposes every token | sealing costs one key and one shared helper |
| Registry in Workers KV | fast reads | no batch with the account write; a second store to back up | the account binding must share the D1 batch |
| Separate Worker for the registry | the key could stay out of the channel Worker | the channel needs the key for every send and every webhook, so the key ends up in both Workers | adds a deploy and a binding without removing the key from the channel |
| One verify token per Meta app in the registry | each app has its own token | the token is typed into every app; more sealed state for no gain | the endpoint owns one token (recorded in the spec) |

## Consequences

- The go-live order changes: deploy, enroll the backoffice, register the number, then point the Meta webhook at the host (runbook).
- Deleting the three secrets makes the previous Worker version unusable. The owner keeps their old values until staging has passed the smoke test (plan, "no backout").
- `NUMBER_REGISTRY_KEY` is not rotated in phase 1, because rotation means re-entering every credential. Re-sealing is phase 2.
- A missing or wrong key makes sends fail with the restricted-channel error and makes webhooks answer `401`. Meta retries deliveries for up to 7 days, so nothing is lost while the key is fixed.
- ADR 0012 still holds: `owner_identities.wa_id` stays globally unique, so one person has one account. An account now belongs to a number, and a message sent to another number is answered with the account's number and dropped.

## Evidence

- On `origin/main` at `273e1a2`, `apps/api/src/operations/worker-secret.ts` lists the three number secrets, and `apps/api/src/routes/whatsapp.ts` checks `change.phoneNumberId !== context.environment.phoneNumberId` and verifies the signature with the single `environment.appSecret`.
- `apps/api/src/adapters/wake/aes-gcm-wake-secret-box.ts` already seals wake targets with AES-GCM, a version byte, a 12-byte IV and associated data, so the cipher is an existing pattern in this repository.
- `apps/api/src/adapters/whatsapp/inbound-parser.ts` already reads `metadata.phone_number_id` as an optional field, so the routing key is part of the payload shape the fixtures use.

## Revisit when

- Numbers need their own webhook subscriptions or their own verify tokens.
- The owner wants a second operator, or the channel and the registry must be split into separate Workers.
- The registry key must be rotated, for example after a suspected leak.
- The Workers Paid plan removes the CPU limit on per-send opens, or Meta changes the signed-payload rules.
