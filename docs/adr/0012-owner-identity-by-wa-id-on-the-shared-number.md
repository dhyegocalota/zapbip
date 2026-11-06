# 0012. The owner is identified by WhatsApp ID on the shared number

- Status: Accepted
- Date: 2026-11-06
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: [Webhook payload examples](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples), [Contacts webhook reference](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/contacts), [Status webhook reference](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/status); [ADR 0006](0006-one-secret-per-connection-in-the-mcp-url.md) (one shared number, secrets resolve to accounts)

## Context

Every account talks through one official WhatsApp Cloud API number. An inbound message therefore has to find its account from the sender alone, and an outbound status has to find the account that sent the message it reports. Meta sends the sender's phone as `from` (`wa_id`) and a business-scoped user id as `from_user_id` (BSUID). Meta's docs say `from` and `wa_id` may be omitted when the user has adopted a username and no phone is available, and they recommend the BSUID. The owner's phone is the proof of identity in the product ("the owner messages the number; that message proves the phone", `accounts-and-keys`).

## Decision

1. The owner's identity row, `owner_identities`, lives in D1 with `wa_id` as its primary key, the `account_id`, the owner's `locale` and the stored `from_user_id` when known. One `wa_id` belongs to one account.
2. An inbound `messages[]` entry maps to an account by its `from`. An entry without `from` is unmapped: it is logged by event name and dropped with `200`, and nothing is sent back.
3. The account of an outbound status is found through `wamid → account_id`, a D1 index written when the Cloud API returns the id of a sent message. A status whose `wamid` is not indexed is ignored with `200`. The status payload's `recipient_id` is not used, because it can be omitted.
4. The stored `from_user_id` is recorded at first contact and used for logs only. Matching uses `wa_id` in this slice.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| `wa_id` of the owner on the shared number (chosen) | matches the owner's registered phone; simple unique key; the owner already proved it | Meta's recommended identifier is the BSUID; an owner who adopts a username and hides the phone becomes unmapped | the BSUID migration is a later step, recorded under Revisit when |
| BSUID as the primary key | Meta's recommended identifier; survives phone hiding | the owner's phone is what the owner proves at signup; the BSUID is only known after the first message | the product's proof is the phone; the BSUID is kept alongside |
| One WhatsApp number per account | the number itself is the identity | the owner pays and verifies a number per account; numbers are scarce | cost and onboarding friction; a shared number is the product |
| Route statuses by `recipient_id` | no extra write | `recipient_id` can be omitted | an index written at send time is always present |

## Consequences

- `accounts-and-keys` writes `owner_identities` when the owner's phone is verified. Until then, a seed script writes it for development.
- Each outbound send writes one D1 row. D1 writes sit well inside the free allowance at owner scale.
- An owner who hides the phone stops being mapped. The failure is visible in logs, and the fix is the BSUID migration.

## Evidence

- Meta's payload example for a text message carries `from`, `from_user_id` and `id` (`wamid`) on every inbound message, and its status example carries `recipient_id` and `recipient_user_id`.
- The contacts reference says `wa_id` "is omitted if the user's phone number is unavailable" and recommends `user_id`.
- Meta's error page confirms that a send needs a `wamid` from the response, which is what the index stores.

## Revisit when

- Meta makes the BSUID the only identifier on inbound webhooks.
- An owner reports that a verified phone stops being mapped.
