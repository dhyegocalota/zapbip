# 0022. A hibernatable WebSocket for the local connector

- Status: Accepted
- Date: 2026-11-06
- Deciders: Dhyego Calota (owner, delegated); Claude (advisor)
- Inspired by: [ADR 0007](0007-a-durable-inbox-and-a-wake-ladder.md) (local connector rung), [ADR 0009](0009-cloudflare-workers-with-one-durable-object-per-account.md) (duration allowance), Cloudflare Durable Object WebSocket hibernation and auto-response documentation

## Context

The local connector keeps one channel open per connection from the owner's machine to the `AccountInbox` Durable Object, so the server can push owner messages to a waiting agent. The connector stays up for days. Whatever channel carries that push decides how long the Durable Object stays awake, and Durable Object duration is billed on the Workers Free plan ([ADR 0009](0009-cloudflare-workers-with-one-durable-object-per-account.md)).

## Decision

1. The connector opens a WebSocket to `wss://<host>/c/<connection-secret>/connector`. The Worker authenticates the secret, then the Durable Object accepts the socket with the hibernation API and tags it with the agent name.
2. Heartbeat is answered by the Durable Object's auto-response (`ping` → `pong`) with no wake-up. The connector pings on a timer and treats a missing `pong` as a dead socket.
3. Owner messages go down the socket as `messages` frames. The connector answers each handled message with a `done` frame, which marks it read. Unread messages are re-sent on every connect, so nothing waits for a live socket.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Hibernatable WebSocket (chosen) | an idle socket does not keep the Durable Object awake; heartbeat answered at the edge; reconnect and re-read are the same code path | a Node client cannot set headers, so the secret travels in the path; the object is evicted between messages and rebuilds its state from SQLite | — |
| Server-Sent Events held by the Durable Object | one-way, simple, plain HTTP | a held request is billed wall-clock for as long as it is open; the connector never closes, so the object is billed around the clock | cost |
| Long-poll `check_inbox` from the connector | no held state | a poll per interval is a request each time; latency equals the interval; more allowance used than a socket | cost and latency |

## Consequences

- Duration: one always-on SSE stream at 128 MB (0.125 GB, as ADR 0009 bills it) is 86 400 s × 0.125 GB = 10 800 GB-s a day, which is 83 % of the 13 000 GB-s free daily allowance ([ADR 0009](0009-cloudflare-workers-with-one-durable-object-per-account.md)). That leaves about 2 200 GB-s, roughly 350 held MCP calls of 50 s a day, not 2 080. With the WebSocket the idle connector costs almost no duration, so the whole allowance stays available for MCP holds.
- The secret is in the URL path, as [ADR 0006](0006-one-secret-per-connection-in-the-mcp-url.md) already requires. Proxies and Cloudflare logs see it; the connector never logs it.
- A second transport now exists for the Worker's live push. The WhatsApp adapters do not touch it.

## Evidence

- Arithmetic from the figures in ADR 0009 (128 MB billed wall-clock, 13 000 GB-s a day free).
- Node 24 ships a stable WebSocket client without headers, so the secret must travel in the path.
- Cloudflare billing for hibernated sockets and auto-response pings is taken from the documentation, not measured here; re-check it on the pricing page before the first deploy (see the spec's risks).

## Revisit when

- A client needs server-initiated push that a WebSocket cannot carry.
- The Workers Paid plan is adopted, or the hibernation billing rules change.
