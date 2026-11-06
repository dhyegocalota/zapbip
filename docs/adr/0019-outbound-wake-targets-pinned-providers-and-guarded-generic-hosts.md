# 0019. Outbound wake targets: pinned provider hosts and guarded generic hosts

- Status: Accepted
- Date: 2026-11-06
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: the POC of 2026-11-05 and 2026-11-06 (the Grok routine webhook on `api2.cursor.sh`, the claude.ai `/fire` endpoint on `api.anthropic.com`); the owner's brief for `webhook-wake` (https only, private and link-local addresses blocked, an allowlist decision); Cloudflare Workers' `fetch`, which cannot pin the connecting IP or resolve DNS for the caller

## Context

The MCP agent sets the wake URL with `set_wake`. The agent can be steered by owner-visible text or by a leaked connection secret. So the wake URL is attacker-influenced input, and zapbip sends requests to it from its own network, with a bearer token in two of three modes. Two risks follow:

- **Token exfiltration:** a Grok or Anthropic bearer token sent to an arbitrary host.
- **Server-side request forgery:** zapbip used to reach internal or loopback addresses, or its own endpoints.

The owner's use cases need two kinds of target: two named provider endpoints, and the owner's own services (generic webhooks with HMAC signing).

## Decision

1. **Pinned providers.** `grok_routine` may only be `https://api2.cursor.sh/automations/webhook/<id>`. `claude_routine` may only be `https://api.anthropic.com/v1/claude_code/routines/<trigger_id>/fire`. Host and path pattern are exact. Only these two modes send a bearer token, and only to their pinned host.
2. **Guarded generic hosts.** `generic` accepts any `https` URL whose host passes the name guard: no IP literal of either family, no `localhost`, `.localhost`, `.local`, `.internal`, `.lan` or `.arpa` names, and not zapbip's own public host. A generic target receives no secret, only an HMAC signature.
3. **Common rules for every target.** `https` only, no userinfo, port `443` or absent, no fragment, at most `WAKE_URL_MAX_CHARS`. Redirects are not followed: a `3xx` is a permanent refusal, so a redirect cannot move a request onto a host the guard did not see.
4. The guard runs when `set_wake` is called and again before every send, on the stored URL.

## Alternatives considered

| Option | Pros | Cons | Why not |
|---|---|---|---|
| Pinned providers and guarded generic hosts (chosen) | tokens reach only their own providers; the owner's services still work; the guard is pure and testable in core | a generic host can still name a public machine the owner does not control, which the owner chooses | — |
| Allowlist of provider hosts only | the strongest form; nothing else can be reached | the owner's own services cannot be woken; the brief requires generic webhooks | fails the owner's need |
| Resolve DNS and block private address ranges before each send | blocks private ranges even under DNS rebinding | Workers' `fetch` cannot pin the connection IP, so the check and the send can disagree; no DNS API in the runtime | cannot be made reliable on this platform |
| Open `https` with no guard | simplest | private hosts and the zapbip host reachable; token leak to any host | unacceptable |

## Consequences

- Provider endpoints are constants in `libs/core`. A new provider is a new constant, a new pinned pattern and a test, not a setting.
- Generic targets are the residual SSRF surface. Its limits are the name guard, no redirects, no secret transmitted and the signed body (which carries no content).
- Pinned paths follow the providers' public contracts. A provider path change breaks the wake until a constant changes; the `/fire` contract is in beta and may change behind a new dated header.

## Evidence

- Claude's public reference: `POST https://api.anthropic.com/v1/claude_code/routines/{trigger_id}/fire` with `Authorization: Bearer`, `anthropic-beta: experimental-cc-routine-2026-04-01` and `anthropic-version: 2023-06-01`.
- POC 2026-11-05: the Grok routine webhook on `api2.cursor.sh` with `Authorization: Bearer`, answered in ~9 s.
- The POC used an internal path for claude.ai (`/v1/code/triggers/{id}/run`). That path is not public; the public `/fire` path is the contract.

## Revisit when

- Either provider changes its host or its trigger path.
- A generic-host abuse report or a leaked-target incident appears.
- Workers gain a way to resolve and pin the connecting address.
