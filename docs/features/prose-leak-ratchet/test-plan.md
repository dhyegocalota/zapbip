# Test plan: Prose leak ratchet

## Unit

- [x] No public page names an agent more than the baseline allows — evidence: `prose-leaks.test.ts`
- [x] A page that improved must lower its number — evidence: same file
- [x] The Worker's wake facet import passes the boundaries and `wake.ts` is held to the no-node rule — evidence: `agent-registry.test.ts`, `boundaries.test.ts`

## Edge cases

- [x] The baseline holds 287 mentions in 93 files after the cleanup, down from 327 — evidence: `prose-leak-baseline.json`
- [x] The demo image is under 0.5 MB and shows the question, the buttons and the tap — evidence: `docs/media/zapbip-demo.gif`
