# 0046. An operator agent runs the backoffice through MCP with a scoped key

- Status: Accepted
- Date: 2026-11-13
- Deciders: Dhyego Calota (owner, delegated 2026-11-13); Claude (advisor)
- Inspired by: the owner's order of 2026-11-13 ("absolutely the whole experience must be agentic, so that an agent can do everything on behalf of a human"); [ADR 0043](0043-access-opens-in-batches-from-the-backoffice.md) (the batch use cases); [ADR 0038](0038-the-backoffice-signs-in-with-a-password-and-then-a-code-held-in-a-server-side-second-step.md) (sign-in and step-up); [ADR 0017](0017-connection-secrets-are-shown-once-and-stored-as-digests.md) (secrets shown once, stored as digests)

## Context

The backoffice answers only to a person: a password, an authenticator code, a cookie session. An operator who wants an agent to read the metrics, see who waits and open access in batches has no way to say so, and giving the agent the password and the authenticator would hand it every power of the backoffice, credentials and numbers included.

## Decision

1. **A key per agent, minted by the signed-in operator.** The Agent keys page (`/agent-keys`) creates a key with a label and a lifetime in days (default 90, at most 365: every key expires), behind the session, CSRF and a fresh step-up code. The key is `zbo_`, 16 hex characters of key id, `_`, and 43 base64url characters of a 256-bit secret. It is shown once on the result page; only its SHA-256 digest is stored, in `backoffice_agent_keys` (migration `0014`). The list shows label, created, last used (stamped at most once a minute), expiry and status. Revoking needs the session and CSRF but no code, because an operator in a hurry must be able to cut a leaked key off. Creating and revoking each write an audit row naming the key id.
2. **One endpoint on the backoffice host.** `POST /mcp` on the backoffice host speaks streamable HTTP like the product server, with `Authorization: Bearer <key>`. Other methods answer `405`, a JSON-RPC batch `400`, and no CORS header is ever sent. It reads no cookie and the cookie routes never read the key. The per-connection product path does not exist on this host, and a key on the product host or a product secret here is refused: the two key families share nothing but the shape of the transport.
3. **Authentication.** The key id selects one row; the digest of the presented key is compared with the stored digest in constant time; a revoked or expired key, an unknown id and a wrong secret all answer the same `401` body as the product server. A key is rate limited by its id (`OPERATOR_KEY_RATE_LIMITER`, 60 a minute) and a limited call answers `429` with `Retry-After`. A key is never logged, nor its digest; the logs carry event names and the tool name only.
4. **Six tools, the same use cases as the pages.** `metrics_summary` (the access figures of the Metrics page for the 7 and 30 day windows), `list_waitlist` (paged, filters by day and language), `list_waiting_accounts` (masked phones), `release_access`, `invite_waitlist` and `list_audit`. The two writing tools call `releaseBatch` and `issueInvites`, the same functions the Access page calls, take at most `ACCESS_BATCH_LIMIT` ids, and refuse unless `confirm: true` is explicit. Each writes one audit row of the page's shape, with the key id in `actor_key_id` and the client address. The invite links come back only in the result of the call that issued them, to the key that asked.
5. **Human-only stays human-only.** Deleting an account, connecting or changing a WhatsApp number and replacing a credential have no tool, and the server instructions and each writing tool description say so. The human interface keeps its step-up code: a key replaces neither the code nor the password.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Give the agent a session and the authenticator | no new code | the agent can do everything the operator can, secrets and numbers included; the code is a human second factor | defeats the two-factor design |
| One long-lived shared secret in a Worker secret | trivial | one key for every agent, no revocation per agent, no list, a redeploy to rotate | an operator must cut one agent off alone |
| OAuth for the backoffice | standard for MCP clients | a whole authorization server for one operator | far more surface than the need |
| Step-up on every agent write | strongest | an agent cannot supply a TOTP code; the point is unattended work | the batch limit, `confirm`, the audit row and revocation bound the risk instead |
| Lookup by digest in SQL | one query | the comparison happens in the database, not in constant time | the key id selects the row and the comparison runs in the Worker |

## Consequences

- Migration `0014` is additive: `backoffice_agent_keys` and `backoffice_audit.actor_key_id`. Rolling back means deploying the previous Worker first; the keys are then unusable, and the column is ignored.
- A leaked key is the power of the six tools until it is revoked or expires, bounded by 10 people a call and 60 calls a minute. A gitleaks rule reports a `zbo_` key in the repository and its history.
- The Access page and the tools share one set of use cases; a change to a rule changes both.

## Evidence

- Unit tests of the key format, digest and lifetime and of the gitleaks rule; integration tests of the page (CSRF, step-up, shown once, audit) and of the endpoint (every refusal, each tool, `confirm`, the batch limit, audit tagging, the rate limit and the cross-surface refusals); a Playwright walk of the page at 1440 and 375.

## Revisit when

- A second operator exists: keys then belong to an operator.
- A tool needs a read of something sensitive, or an agent needs a scope narrower than the six tools.
