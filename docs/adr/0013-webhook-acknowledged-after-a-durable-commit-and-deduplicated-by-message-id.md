# 0013. Webhooks are acknowledged after a durable commit and deduplicated by message id

- Status: Accepted
- Date: 2026-11-06
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: [Webhook getting started](https://developers.facebook.com/docs/graph-api/webhooks/getting-started) (`200` for every notification, retries, duplicates); [Webhook overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview) ("These retries can result in duplicate webhook notifications"); [Status reference](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/status) (no ordering guarantee)

## Context

Meta retries any notification that does not get a `200`, and it can deliver the same message twice. The documents disagree on how long retries last: the getting-started page says 36 hours, the overview says up to 7 days. Status webhooks can arrive out of order. The owner's inbound message must reach the account's inbox exactly once, and a status must never move a message backwards.

## Decision

1. The webhook route verifies `X-Hub-Signature-256` over the raw bytes before it parses anything.
2. The route hands the parsed entry to the account's `AccountInbox`, which, in one SQLite transaction, records the inbound message id (`wamid`) in a `channel_receipts` table, stores the message and saves the owner window. A second delivery of the same `wamid` is a no-op that returns `200`. Flush, answer, waiter and wake steps run after that transaction and never remove the receipt.
3. The route returns `200` only after the call completes. A throw before the transaction commits stores nothing, and the route returns `500`, so Meta retries and the retry stores the message once. A throw after the commit keeps the message and the receipt; the retry returns `200` with no effect.
4. Statuses are applied with the rule in the spec's status table. Applying the same status twice changes nothing.
5. There is no queue in this slice. Each webhook is processed inline, because the DO call is short and the inbox is the durable store.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Acknowledge, then process from a Cloudflare Queue | fast response; retries handled by the queue | a second durable hop; a queue consumer per account; more failure modes to test | the DO commit is already durable and fast; the queue adds a hop with no gain at owner scale |
| Process inline and dedupe by `wamid` (chosen) | one durable write decides; retries are safe by construction | the webhook waits for the DO commit | — |
| Process inline with no dedupe | simplest | duplicates reach the owner's agents | violates the core's exactly-once inbox |
| Respond `200` before any processing | Meta never retries | a failed commit is lost silently | the message would vanish |

## Consequences

- The `channel_receipts` table grows with every inbound message. Its rows are pruned after `RECEIPT_RETENTION_MS` (7 days), the longer of Meta's two stated retry windows, as the spec sets.
- A `500` makes Meta retry, so a faulty deploy produces retries and not losses.

## Evidence

- Meta's getting-started page: "Your endpoint should respond to all event notifications with `200 OK`" and "your server should handle duplicate notifications".
- The webhook overview: retries "for up to 7 days" and payloads "up to 3 MB".
- The two retry windows disagree (36 hours against 7 days). The design keeps receipts for 7 days, which covers both.

## Revisit when

- Webhook volume or DO latency makes the inline commit a measured bottleneck.
- Meta's retry window or payload limit changes.
