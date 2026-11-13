# Tester briefing: Agentic backoffice

Written by the developer. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

- `apps/api/src/backoffice/operator-mcp/` — key module, store, auth, the six tools, the endpoint, the Agent keys page.
- `apps/api/migrations/0014_operator_agent_keys.sql` — `backoffice_agent_keys` and `backoffice_audit.actor_key_id`.
- `apps/api/src/backoffice/access/access-audit.ts`, `access-invite.ts`, `access-routes.tsx` — the audit batch takes a recorder and the start number helper is shared with the tools.
- `wrangler.jsonc`, `env.ts` — `OPERATOR_KEY_RATE_LIMITER` (60 a minute) in the three blocks.
- `.gitleaks.toml`, `.github/scripts/secret-rules-probe.sh` — the `zapbip-operator-key` rule and its probe.
- Backoffice copy, navigation, audit labels, notice; ADR 0046; runbook step 8; the backoffice rule.
- Review fixes: one audit writer (`actorKeyId` on `AuditEntry`), the Audit page shows the agent key, `list_waitlist` audited and invitable-only, per-address limit on refused keys, bounded id lists, the endpoint mounted before the session middleware.

## How to run

```bash
pnpm --filter @zapbip/api test:unit
pnpm --filter @zapbip/api test:integration -- backoffice-agent-keys backoffice-operator-mcp
pnpm --filter @zapbip/api exec playwright test --config playwright.config.ts agent-keys
```

## Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `test/unit/operator-key.test.ts` | the module threw `<name> is not implemented` (27 failures) | the module is implemented |
| `test/unit/operator-key-gitleaks.test.ts` | `the gitleaks configuration has no operator key rule` (3 failures) | the rule exists |
| `test/integration/backoffice-agent-keys.test.ts`, `backoffice-operator-mcp.test.ts` | the routes did not exist | the routes exist |

## Hypotheses to attack

1. Hypothesis: a revoked or expired key never opens the endpoint. Break it by: revoking between two calls, expiring at the exact instant.
2. Hypothesis: the key and its digest reach no log, audit row or page after the creation page. Break it by: searching D1 and the log output.
3. Hypothesis: the tools and the Access page share their rules. Break it by: comparing the audit target of one batch run through each.
4. Hypothesis: nothing reaches a human-only action. Break it by: calling unknown tools and human routes with the key.

## Known gaps

- The integration tests were written red-first but could not run while the machine's verify held port 4012; their first run is the green run.
- `list_waitlist` reads at most 1100 not-yet-invited entries per key and audits each call; a leaked key can still read those.
