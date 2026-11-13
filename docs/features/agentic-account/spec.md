# Agentic account

**Status:** Building
**Tier:** 🔴 structural
**Owner approval:** approved 2026-11-13 (owner delegated)
**ADRs:** [0045](../../adr/0045-an-agent-manages-the-account-through-mcp-with-the-owner-approving-on-whatsapp.md)
**Not changing:** the WhatsApp commands and their copy, the client app pages and forms, account deletion, the wake ladder, the install pages.

## Problem

The owner, 2026-11-13: "absolutely the whole experience must be agentic, everything. Use every technology on the website, app, whatever, so that an agent can do everything on behalf of a human." Today an agent can talk to the owner but cannot list, connect or revoke agents, read the account or open the app.

## Goals

1. Five MCP tools on the existing per-connection server: `list_agents`, `account_status`, `connect_agent`, `revoke_agent`, `sign_in_link`.
2. Changes ask the owner on WhatsApp with buttons and block until answered or 50 seconds; deny and timeout change nothing.
3. `connect_agent` returns the install prompt to the agent only when the owner taps Allow, send to agent; otherwise the install link goes to the owner's WhatsApp.
4. The tools run the same core use cases as the commands and the app; the three acting tools are limited to three a minute per connection.
5. The client app answers `Accept: application/json` on the home page with the data the HTML shows.
6. Docs page "Let your AI manage zapbip" (the docs say AI to people) and five tool reference pages, English and Portuguese; copy in en_US and pt_BR.

## Non-goals

Account deletion by tool, a tool to rotate keys, reporting the allowance left (no counter exists), a second approval channel.

## Design

### Data flow

```mermaid
sequenceDiagram
  participant Agent
  participant Worker as MCP server (Worker)
  participant Box as Account Durable Object
  participant Owner as Owner on WhatsApp
  Agent->>Worker: connect_agent {name}
  Worker->>Worker: rate limit per connection
  Worker->>Box: requestAccountChange
  Box->>Owner: question with buttons (reference)
  Owner-->>Box: Allow / Allow, send to agent / Deny
  Box->>Box: applyOwnerCommand (same use case as the command)
  Box-->>Owner: install link (Allow) or nothing (send to agent)
  Box-->>Worker: status, install prompt only for send to agent
  Worker-->>Agent: structured result
```

### Interfaces

`libs/core/src/accounts`: `requestAccountChange`, `applyAgentCommand`, `describeAccount`, `buildAccountOverview`, `sendAccountReplies` (moved out of `receiveAccountMessage`), `agent-approval-copy`. `apps/api`: `AccountInboxRpc.requestAccountChange`, `sendSignInLink`, `describeAccount`; tools in `apps/api/src/mcp/account-tools.ts`; binding `ACCOUNT_CHANGE_RATE_LIMITER`; `GET /` with `Accept: application/json` on the client app.

### Failure handling

| Case | Result |
|------|--------|
| Deny | `denied`, nothing changed |
| No answer in 50 seconds | `timed_out`, nothing changed; a later tap changes nothing |
| Name invalid or reserved | `refused` with `invalid_name` or `reserved_name` before any question |
| Name taken, limit reached, unknown agent after the tap | `refused` with the reason |
| WhatsApp send of the install link fails | the connection is revoked again, `refused` with `send_failed` |
| Fourth acting call in a minute | error `rate_limited` |
| Signed out JSON request on the app | `401` `{"error":"sign_in_required"}` |

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Does `sign_in_link` need approval? | yes, no | no: the link goes to the owner, never to the agent (delegated) | 2026-11-13 |
| Allowance left | report, omit | omit until a counter exists (delegated) | 2026-11-13 |

## Test strategy summary

Unit for the approval rules and the overview; integration for each tool through the MCP client against the fake channel (allow, send to agent, deny, timeout, isolation, rate limit, no secret in results, routing back); JSON twins on the app; shape tests for the docs.
