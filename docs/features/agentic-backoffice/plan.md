# Plan: Agentic backoffice

**Spec:** spec.md
**Tier:** 🔴
**Seam:** `apps/api/src/backoffice/app.ts` mounts two new route groups; the Access page's audit and invite helpers become shared.
**Assumptions (decided, owner can override):**
- Revoking needs no step-up code; every key expires.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/api/src/backoffice/operator-mcp/**`, `apps/api/migrations/0014_*`, `apps/api/test/**` for these, `.gitleaks.toml`, `.github/scripts/secret-rules-probe.sh` | `developer` |
| G2 | the one-line mounts in `app.ts`, `primary-navigation.tsx`, `audit.tsx`, `backoffice-copy.ts`, `backoffice-notice.ts`, `backoffice-paths.ts`, the audit enums, `access-audit.ts`, `access-invite.ts`, `access-routes.tsx` | `developer` |
| G3 | `wrangler.jsonc`, `env.ts`, `log.ts`, ADR 0046, this folder, the runbook, the backoffice rule | `developer` |

## Sequencing

One developer, one lane: key module first, then the foundations (migration, enums, copy), then the page and the endpoint, then the gitleaks rule, the walk and the docs.

## Steps

### G1

- [x] **Step 1:** red unit test of the key format, digest, liveness and lifetime (`76b10b79`), then the module (`65501e77`).
- [x] **Step 2:** red integration tests of the page and the endpoint (`01db492d`), then the store, auth, tools, server, routes and page (`a4e3ba60`).
- [x] **Step 3:** red unit test of the gitleaks rule (`a6cc1df1`), then the rule, the probe line and the walk (`32c4e73e`).

### G2

- [x] **Step 4:** `auditedBatch` takes a recorder so the agent writes the same rows as the page; `startNumberOf` moves next to the invite use case (`a4e3ba60`).
- [x] **Step 5:** navigation link, audit labels, notice, paths and copy in en_US and pt_BR (`65501e77`).

### G3

- [x] **Step 6:** the `OPERATOR_KEY_RATE_LIMITER` binding in the three `wrangler.jsonc` blocks, `env.ts` and the namespace tests (`65501e77`).
- [x] **Step 7:** ADR 0046, this folder, the runbook step 8 and the backoffice rule (the docs commit of this lane).

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | A key authenticates after revocation | integration test `a key revoked in the middle of its use` | redeploy the previous Worker; keys are then unusable |
| 2 | A write skips the audit row | integration tests assert `actor_key_id` on each write | revert the tool, keep the page |
| 6 | The limiter binding is missing in an environment | `wrangler-config.test.ts` fails; at runtime `/mcp` answers `500` | add the binding, deploy |
| 1 | Migration `0014` not applied before the Worker | the page answers `500` on `backoffice_agent_keys` | run the migrate step of the deploy runbook |

**Steps with no backout:** none; migration `0014` is additive.

## Z. Prove and ship

- [ ] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict.
- [ ] **/check-ui:** screenshots and video recorded and uploaded.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
