# 0045. An agent manages the account through MCP, with the owner approving on WhatsApp

- Status: Accepted
- Date: 2026-11-13
- Deciders: Dhyego Calota (owner, delegated 2026-11-13); Claude (advisor)
- Inspired by: [ADR 0015](0015-commands-are-bare-words-routed-before-agents.md) (commands), [ADR 0016](0016-accounts-start-on-the-first-message-and-wait-on-a-list.md) and [ADR 0017](0017-connection-secrets-are-shown-once-and-stored-as-digests.md) (accounts and secrets), [ADR 0042](0042-the-customer-web-app-signs-in-with-a-one-time-link-sent-over-whatsapp.md) (the client app), [ADR 0043](0043-access-opens-in-batches-from-the-backoffice.md)

## Context

The owner asked that the whole experience be agentic: everything a person does in the client app or with a WhatsApp command, an agent can do on the person's behalf. An agent holds one connection secret; it can already send, ask and wait. It cannot list, connect or revoke agents, read the account, or open the app, and an agent that could change the account unattended would turn one leaked connection into control of the account.

## Decision

1. Five tools join the per-connection MCP server: `list_agents` and `account_status` (read only), `connect_agent` and `revoke_agent` (change the account) and `sign_in_link`. Deleting the account stays a WhatsApp command only, and the tool list says so.
2. The tools call the same core use cases as the WhatsApp commands and the client app (`applyOwnerCommand`, one overview shared with the app). No rule is written twice.
3. `connect_agent` and `revoke_agent` ask the owner first, on WhatsApp, through the ask machinery already there: a question from the calling agent with buttons, routed back to that agent. `connect_agent` offers three buttons, Allow, Allow and send to this agent (`Allow, send to agent` on the wire, 20 characters being the button limit) and Deny; `revoke_agent` offers Allow and Deny. The tool holds up to 50 seconds (the ask ceiling), then returns `applied`, `denied`, `timed_out` or `refused`. Deny and timeout change nothing; a tap after the timeout answers a question nobody waits for and changes nothing.
4. The install prompt of a new connection goes to the owner's WhatsApp, as it does today. Only the button Allow and send to this agent returns it to the calling agent, in that one result. Any other path never puts a secret in a tool result. The tool logs carry the tool name, the agent and the status, never the prompt.
5. Each question carries a six character reference so that an old approval is never replayed by the ask retry window (the same question within four minutes returns the earlier answer): a new request is a new question.
6. Names are validated before the owner is asked (`normalizeAgentName`, reserved words); a revoke of an unknown name is refused without asking. A name taken or the agent limit are refused after the tap by the same use case the commands run.
7. `sign_in_link` sends the app sign-in link to the owner's WhatsApp, masked once sent like every sign-in link, and returns only a status. It needs no approval: the link goes to the owner, never to the agent.
8. The three tools that act (`connect_agent`, `revoke_agent`, `sign_in_link`) are limited per connection by a rate limiter of their own, three a minute, so one leaked key cannot flood the owner with prompts.
9. The client app answers `Accept: application/json` on the home page with the same overview the HTML shows (state, masked phone, plan, agents) and `401` with `sign_in_required` when signed out. Actions stay CSRF-protected forms; an agent driving a browser submits them like a person.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Account-changing tools with no approval | one call, no wait | one leaked connection controls the account | the owner stays the human in the loop |
| Approval as a link opened in the browser | no WhatsApp prompt | a second surface, a token to guard, a person leaving the chat | the chat already has buttons that route back to the agent |
| Always return the install prompt to the agent | simplest for the agent | the secret enters whatever context the agent runs in without the owner choosing | the owner chooses with the third button |
| Reuse the outbound rate limiter | no new binding | thirty a minute is no brake on prompts to a person | a limiter of its own is one binding |
| Deletion as a tool | complete parity | irreversible and a phishing target | stays a WhatsApp command |

## Consequences

- One rate limiter binding per environment (`ACCOUNT_CHANGE_RATE_LIMITER`, namespaces 1006, 2006, 3006).
- The Durable Object gains `describeAccount`, `requestAccountChange` and `sendSignInLink`; the Worker keeps no account logic.
- The tool descriptions are the contract an agent reads; the docs page "Let your agent manage zapbip" repeats it for people.
- The allowance left is not reported: the account keeps no message counter yet. `account_status` reports the plan and the free allowance of the plan.
- A late tap leaves an answered question in the agent inbox; the agent ignores it, nothing is applied from it.

## Evidence

`docs/features/agentic-account/test-plan.md`.

## Revisit when

A message counter per account exists (report the allowance left), or a second human-in-the-loop channel besides WhatsApp is added.
