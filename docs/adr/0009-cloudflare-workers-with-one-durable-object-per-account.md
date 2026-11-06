# 0009. Cloudflare Workers with one Durable Object per account

- Status: Accepted
- Date: 2026-11-06
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: the owner's requirement to host for free or as cheaply as possible; [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing), [Durable Objects limits](https://developers.cloudflare.com/durable-objects/platform/limits), [Railway plans](https://docs.railway.com/pricing/plans), [Vercel Hobby](https://vercel.com/docs/plans/hobby); the throwaway spike recorded under Evidence

## Context

The server holds MCP calls for up to 50 s, keeps a durable inbox, wakes waiting calls when the owner answers, stores media, and receives and sends webhooks. The owner prefers free hosting, then Railway, Vercel or Cloudflare by cost.

## Decision

1. The API runs as a Cloudflare Worker (Hono).
2. Each account has one `AccountInbox` Durable Object, SQLite-backed. It holds every agent's inbox, the questions, the history, the owner's window and the outbound queue. It also holds the live waiters in memory. Routing between agents of one account is therefore local and consistent.
3. Connection secrets resolve through D1. Media lives in R2.
4. Everything starts on the Workers Free plan.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Workers + one Durable Object per account (chosen) | free tier; the object is the per-account inbox and the wake point, with no Postgres, LISTEN/NOTIFY or Redis | platform lock-in behind the ports; Durable Object duration is billed while a call is held | — |
| Railway, Node + Postgres | the original design as is | $5/month with no free plan after the trial | not free |
| Vercel | 300 s functions with fluid compute | Hobby forbids commercial use; no persistent connection, so polling; an external database | cost and fit |
| One Durable Object per agent | smaller objects | routing across a single owner's agents needs cross-object coordination | complexity without a need |

## Consequences

- Moving off Cloudflare means new `InboxRepository` and `AgentWaker` adapters ([ADR 0008](0008-a-pure-core-behind-ports.md)).
- Held calls consume Durable Object duration: about 2 080 holds of 50 s a day fit in the free allowance. The first paid step is the Workers Paid plan.
- Uploads require `Content-Length` and are capped at 100 MB by the zone, the same as WhatsApp's document limit.

## Evidence

Throwaway spike of 2026-11-06, run under local `wrangler dev` (wrangler 4.158.0, `@modelcontextprotocol/sdk` 1.32.2 with `WebStandardStreamableHTTPServerTransport`, hono 4.13.16), with no deploy.

1. **A 50 s hold works in both modes.** An `ask` held inside the Durable Object completed in JSON and SSE modes:
   - timeout → `pending` at 50.0 s;
   - owner reply at 20 s → `answered` at 20.04 s.
   - SSE sends keep-alive comments while holding. Image content blocks return normally.
2. **A client abort is not visible.** After `curl --max-time 5`, neither `request.signal` nor the MCP `extra.signal` fired. The reply arriving at 10 s was handed to the dead call. Correctness therefore cannot rest on abort detection.
   - Answers stay bound to `question_id` and are returned on every `wait_for_reply(question_id)`.
   - Plain messages stay in the history `get_messages` returns.
   - Production propagation of disconnects is untested.
3. **Uploads need a known length.** A 50 MiB upload streamed into R2 in 0.42 s with a `Content-Length`. Without one, `R2.put` fails ("Provided readable stream must have a known length"), so the upload route requires `Content-Length`. The production body cap is 100 MB on Free and Pro zones ([Workers limits](https://developers.cloudflare.com/workers/platform/limits/)), which matches WhatsApp's 100 MB documents.
4. **Free allowance** ([Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)):
   - 100 000 requests/day;
   - 13 000 GB-s/day;
   - 5 M rows read/day and 100 000 rows written/day;
   - 5 GB of storage.
   - A held request is billed wall-clock at 128 MB, so a 50 s hold costs 6.25 GB-s. That is about 2 080 held calls a day on the free allowance, before any other activity.

## Revisit when

- The free allowance no longer covers the held calls of active accounts.
- A single account's traffic outgrows one Durable Object.
