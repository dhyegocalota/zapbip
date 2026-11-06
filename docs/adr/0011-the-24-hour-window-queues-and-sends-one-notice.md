# 0011. The 24-hour window queues messages and sends one notice

- Status: Accepted
- Date: 2026-11-06
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: the WhatsApp Cloud API customer-service window rule: free-form messages only within 24 h of the user's last message, approved templates outside it. Utility templates are billed per message.

## Context

Agents write to the owner at any hour, often long after the owner last wrote. Outside the 24-hour window only an approved template can be sent, and each one costs money. Media, buttons and free text cannot go out as they are.

## Decision

1. **Window per account.** The core tracks `last_owner_message_at` per account (the owner's phone). The window is open until 24 h minus `WINDOW_SAFETY_MARGIN_MS` (10 min) after it.
2. **Inside the window**, every message goes out as a session message.
3. **Outside it**, messages queue in order with `delivery: "queued"`.
4. **One notice per closed window.** The first queued message sends one utility template notice naming the agent and a short preview, with a quick reply that reopens the window. An `ask` sends the question template instead. Further messages only join the queue. When the notice send fails, the send that owns the claim raises a delivery failure naming the notice, the message stays queued, the claim is released and the alarm retries the notice every `NOTICE_RETRY_MS` (5 minutes) while owner-bound messages wait in a closed window with no notice sent.
5. **Flush.** The owner's next message opens the window and flushes the queue in order. Questions are rendered with their real buttons or list.
6. **Expiry.** Queued items expire after `QUEUE_RETENTION_MS`.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Queue and one notice per closed window (chosen) | one billed message per closed window; nothing lost; media and buttons arrive intact once the owner taps | the owner taps once before seeing content | — |
| A template per message | the owner sees each message's preview at once | one billed message each; media cannot travel in a generic template | cost |
| Refuse to send outside the window | no cost | agents cannot reach the owner, which is the product's job | defeats the purpose |

## Consequences

- `MessageSender` has two operations: `session` and `template`. The template names and parameters are approved in `whatsapp-cloud-channel`.
- Template parameters cannot hold newlines or long text. Previews are sanitised and cut at `NOTICE_PREVIEW_MAX_CHARS`.

## Evidence

- The WhatsApp Cloud API documentation on the customer-service window and template pricing.
- Two facts get confirmed in `whatsapp-cloud-channel`: whether an owner's reaction reopens the window, and the exact template parameter limits.

## Revisit when

- Meta changes window or template pricing rules.
- Owners report the extra tap as friction.
