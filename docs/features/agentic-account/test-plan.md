# Test plan: Agentic account

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: `.

## The failing test first

- [ ] `libs/core/src/accounts/use-cases/request-account-change.test.ts` — input: a connect request with no answer from the owner; expected: fails with `requestAccountChange is not implemented`
- [ ] `apps/api/test/integration/mcp-account-tools.test.ts` — input: `tools/list`; expected: fails because the five tools are not registered

## Unit

- [ ] `request-account-change.test.ts::allow` — input: Allow tap on a connect question; expected: connection created, install prompt sent to the owner, none in the result
- [ ] `::send to agent` — input: Allow, send to agent; expected: install prompt in the result, nothing sent to the owner
- [ ] `::deny` — input: Deny tap; expected: `denied`, no connection
- [ ] `::timeout` — input: no answer after 50 seconds; expected: `timed_out`, no connection
- [ ] `::stale approval` — input: the same request twice within four minutes; expected: two questions, the second not auto-approved
- [ ] `::invalid and reserved names` — input: `!!!`, `ajuda`; expected: invalid input error, no question
- [ ] `::revoke unknown` — input: name not active; expected: `refused` `not_found`, no question
- [ ] `::send failure` — input: WhatsApp send fails after Allow; expected: connection revoked again, `refused` `send_failed`
- [ ] `account-overview.test.ts` — input: two connections and one activity row; expected: summaries with null last activity for the other, masked phone, free plan

## Integration

- [ ] `mcp-account-tools.test.ts` — each tool through the MCP client: allow, send to agent, deny, timeout, routing to the asking agent, other account untouched, rate limit on the fourth call, no secret in results except on send to agent, `sign_in_link` never returns the link and sends it to the owner
- [ ] `client-app-json.test.ts` — `Accept: application/json` signed in returns the overview; signed out returns 401; HTML unchanged
- [ ] `wrangler-limits.test.ts`, `wrangler-rate-limit-namespaces.test.ts` — the new binding in every environment

## E2E

- [ ] `apps/api/test/e2e/mcp-client.e2e.test.ts` — the five tools listed with the fake WhatsApp channel and one connect approved end to end

## Prove it for real — Playwright MCP

- [ ] Not applicable to the tools; the client app HTML is unchanged. Docs pages render in both languages.

## Edge cases found during execution

## Adversarial review

- [ ] Claim 1: a tool never changes the account without a tap — attack: timeout, deny, late tap
- [ ] Claim 2: no secret in a result or log unless the owner chose — attack: read every result, log line and stored message
- [ ] Claim 3: no cross-account access — attack: revoke a name that exists only in another account

## Coverage honesty

- The real WhatsApp delivery is not exercised; the fake channel stands in for it.
- The allowance left is not reported: no counter exists.
