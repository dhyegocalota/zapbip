# 0006. One secret per connection in the MCP URL

- Status: Accepted
- Date: 2026-11-06
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: the client probes of 2026-11-04 to 2026-11-06 (Grok Bot, claude.ai, ChatGPT, Codex, Claude Code); the owner's requirement that installing is pasting one prompt into the AI

## Context

Every agent reaches zapbip through MCP. Grok Bot, claude.ai and ChatGPT without authentication accept a URL and nothing else, and installing must come down to pasting one prompt into the agent. A chat on the web cannot add a connector to itself, so the owner pastes the URL into its settings. One credential has to fit in that URL, name the agent, and leak no more than one agent's access if it escapes.

## Decision

1. Each connection (one agent of one account) has its own secret, `zb_conn_` followed by 32 random bytes. The MCP URL is `https://<host>/c/<secret>/mcp`.
2. The same server accepts `/mcp` with `Authorization: Bearer <secret>`, for clients that support headers.
3. The secret resolves to `{account_id, agent}`. The request never names the account or the agent.
4. Secrets are stored only as their SHA-256 digest (`connections.secret_digest`, UNIQUE) and never logged. A request resolves its secret by looking up the digest in the directory. There is no comparison of secrets across rows, so there is no constant-time comparison to make; signed links are checked with `crypto.subtle.verify`. Each one can be revoked and rotated on its own. (Amended 2026-11-06 by agent-inbox-core, which replaced the constant-time wording.)
5. There is no account-wide key on the MCP surface.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Secret per connection in the URL (chosen) | works in every client probed; one paste; leaks one agent at most | the URL is a credential and can leak through chat history | — |
| One key per account in a header, agent in the URL | one key to manage | URL-only clients cannot send the header; a leak exposes every agent | fails on Grok Bot and on web chats without auth |
| OAuth only | no secret in URLs | no client needs it today; adds a login flow before the first message | later phase |

## Consequences

- A leaked URL exposes one agent. The owner revokes that connection only.
- The connection list becomes the account's security surface, and `accounts-and-keys` shows it to the owner.
- The install prompt contains the URL, so it is a secret. The prompt says so.

## Evidence

- Grok Bot added the MCP server by URL alone and called it within 120 s.
- claude.ai and ChatGPT ran the tools with a URL and no OAuth.

## Revisit when

- OAuth becomes the default in the clients that matter.
- A connection URL is found in logs or history outside the owner's control.
