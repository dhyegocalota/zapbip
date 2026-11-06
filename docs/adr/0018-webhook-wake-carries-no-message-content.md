# 0018. A webhook wake carries no message content

- Status: Accepted
- Date: 2026-11-06
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: the POC of 2026-11-05 and 2026-11-06 (Grok Bot routine webhook answered in ~9 s; claude.ai API trigger answered in ~16 s); [ADR 0006](0006-one-secret-per-connection-in-the-mcp-url.md) and [ADR 0007](0007-a-durable-inbox-and-a-wake-ladder.md); the public `/fire` reference, which feeds a text field to the routine as untrusted data (`<routine-fire-payload>`)

## Context

A webhook wake starts a run in a third-party service: Grok Bot's cloud routines and Claude's cloud scheduled tasks. Whatever the webhook carries reaches that service and its run log. An owner's WhatsApp text, captions or file names must not travel there. A payload also becomes prompt input. Routine prompts that read it would take owner-written text as instructions, and the owner's MCP messages are the only ones marked `sender: "owner", verified: true` (ADR 0007, probes of 2026-11-04).

The agent reads its messages through `check_inbox` or `get_messages` in any case, so the webhook only needs to say that something waits.

## Decision

1. A wake request carries a constant body, `WAKE_SIGNAL_BODY`, with no owner text, no captions, no counts, no message ids and no agent name. The connection's URL already names the agent.
2. The agent pulls the messages through MCP, where they arrive with `sender: "owner", verified: true`.
3. Generic targets receive the same constant body, signed (see [the webhook-wake spec](../features/webhook-wake/spec.md#generic-signing)).

## Alternatives considered

| Option | Pros | Cons | Why not |
|---|---|---|---|
| Payload-less signal (chosen) | no owner content leaves zapbip towards a third party; no unverified text reaches a routine prompt; one code path to read messages | the agent needs one extra MCP call per wake | — |
| Message text in the body | the agent could answer without an MCP read | owner content goes to Grok and Anthropic run logs; text becomes prompt input without the verified-sender marking; large bodies for media | privacy and prompt-injection risk |
| Count and ids in the body | cheap; the agent can skip empty wakes | ids reveal conversation rhythm; still a payload a routine could treat as instructions | no gain over the empty pull that `check_inbox` already answers |

## Consequences

- Every wake costs one MCP round trip before the agent sees anything. `check_inbox` must answer `empty` at once.
- The constant body is a contract with the routine prompts: the install prompts (slice `install-skills`) tell the bot to call `check_inbox`, not to read the webhook body.

## Evidence

- POC 2026-11-05: the Grok routine got a POST, called `get_messages` at +6 s and replied at +9 s. The bot did not need the message in the webhook.
- The `/fire` reference wraps any `text` in an untrusted-data block, which confirms that third parties treat fire payloads as prompt material.

## Revisit when

- A client declares a verified push channel for owner messages (MCP Tasks, channel notifications) that makes the pull unnecessary.
- The pull round trip is measured as the dominant cost of a wake.
