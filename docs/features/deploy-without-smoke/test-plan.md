# Test plan: Deploy without the smoke test

## Unit

- [x] The preflight does not refuse for a missing smoke input when `skipSmoke` is set — evidence: `deploy-preflight.test.ts`
- [x] The entry deploys production without a terminal, runs no `smoke.ts` and logs that the smoke test was skipped — evidence: `deploy-entry.test.ts`
- [x] Without the flag a missing smoke input still refuses — evidence: the existing preflight tests
