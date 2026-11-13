# Test plan: Agentic backoffice

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] `apps/api/test/unit/operator-key.test.ts` — input: the key module as a stub; expected: 27 tests fail with `<name> is not implemented` (`76b10b79`).
- [ ] `apps/api/test/unit/operator-key-gitleaks.test.ts` — input: no rule in `.gitleaks.toml`; expected: 3 tests fail with `the gitleaks configuration has no operator key rule`.
- [ ] `apps/api/test/integration/backoffice-agent-keys.test.ts` and `backoffice-operator-mcp.test.ts` — input: no route; expected: the page and `/mcp` answer `404` (`01db492d`).

## Unit

- [ ] A key is `zbo_` + 16 hex + `_` + 43 base64url characters; two keys differ; the same bytes give the same key.
- [ ] `zbo_`, `zb_conn_abc`, upper case, trailing text, empty: refused by `parseOperatorKey`.
- [ ] The digest is 64 hex characters and never contains the key.
- [ ] A key is live before its expiry and dead at the expiry instant and after, and when revoked.
- [ ] Lifetime `1`, `90`, `365` read; `0`, `-3`, `1.5`, `abc`, empty, `366`, `1e2` refused.
- [ ] The gitleaks rule spells the key shape, reports a fresh key (bare and in a quoted header) and ignores a `zb_conn_` secret; `secret-rules-probe.sh` reports a fresh `zbo_` key.

## Integration

- [ ] Page without a session: `303` to sign-in; both forms `401`. Empty state, navigation link and the human-only note render.
- [ ] Create: `200` with the key once, `Cache-Control: no-store`, the MCP address, one row with only the digest, default 90 days, audit `agent_key.created` naming the key id; the listing never shows the key.
- [ ] Create refusals: lifetime `0`, `-1`, `1.5`, `abc`, `366` and label empty, blank, over 60: `303` then `422`, no row; wrong code: `303` then `401`, no row, no create audit; bad csrf or foreign origin: `403`.
- [ ] Neither the key nor its digest appears in any log line, on creation or on a tool call.
- [ ] Revoke: `303` to `?notice=AgentKeyRevoked`, `revoked_at` set, audit row; unknown or repeated: `404`, no audit; no csrf: `403`.
- [ ] Endpoint refusals, same `401` bytes: no key, malformed, wrong secret, unknown id, revoked, expired at the instant, revoked between two calls, session cookie only, product connection secret. Product host `/mcp` with an operator key `401`; `/c/<key>/mcp` on the backoffice host `404`; trailing-dot host `404`.
- [ ] `GET`, `DELETE`, `PUT`, `OPTIONS`: `405`, `Allow: POST`, no `Access-Control-*` header. A JSON-RPC batch: `400`.
- [ ] `tools/list` returns exactly six tools; initialize instructions say deleting stays human; writing tools mention `confirm`.
- [ ] Rate limit: the third call of a key limited to two answers `429` with `Retry-After`, another key unaffected, the limiter keyed by key id only.
- [ ] `last_used_at` is stamped once a minute.
- [ ] `metrics_summary` matches the Metrics page figures for 7 and 30 days; `list_waitlist` pages, filters and hides the referral code; `list_waiting_accounts` masks phones.
- [ ] `release_access` and `invite_waitlist`: refuse without `confirm: true`; refuse over `ACCESS_BATCH_LIMIT`; accept exactly the limit; repeat is a no-op; counts and audit target equal the page's; `actor_key_id` is the key; the invite links appear only in the issuing call; no start number refuses and audits nothing.
- [ ] `list_waitlist` lists only not-yet-invited entries, caps the offset at 1000, and writes one `waitlist.listed` row per call with the page range under the key.
- [ ] Refused keys count against `ip:<address>`: the third bad call of a limit of two answers `429`; id lists above 100 or ids above 320 characters are refused; a throwing batch writes one `failed` row under the key; a request with a session cookie touches no `backoffice_sessions` query.
- [ ] The Audit page shows the key label and id on an agent row and nothing on a human row.
- [ ] `list_audit` returns the newest first with the actor key and no client address; a limit above the cap is refused.

## E2E (Playwright specs)

- [ ] `apps/api/e2e/backoffice/agent-keys.spec.ts::creates a key, shows it once, lets the agent in and locks it out after a revoke` — steps: open Agent keys, create, call `/mcp` with the key, list, revoke, call again; expected: `200` with six tools, then `401`, no horizontal scroll at 1440 and 375.
- [ ] `::keeps the list empty after a wrong code` — expected: the step-up message and the empty state.

## Edge cases found during execution

Empty on purpose.

## Adversarial review

- [ ] Claim 1: a revoked or expired key is refused on the very next call — attack: revoke between two calls; expire at the instant.
- [ ] Claim 2: the key is never persisted or logged in clear — attack: grep D1, audit and log output after creating and using a key.
- [ ] Claim 3: an agent cannot reach a human-only action — attack: list tools, call a made-up tool and a human route with the key.

## Coverage honesty

- A real MCP client was not driven against a deployed host; the endpoint is proven with JSON-RPC requests.
- The rate limiter binding is a fake in the integration tests; the real limiter is covered by the namespace and configuration tests.
