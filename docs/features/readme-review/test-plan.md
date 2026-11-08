# Test plan: README review

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts).

## The failing test first

- [ ] `tools/repository-shape/src/delivery-docs.test.ts::purposeViolations` probes — input: the stub; expected: red with `purposeViolations is not implemented`
- [ ] Confirmed it fails for the right reason: the real run over `apps/hermes-plugin/README.md` reports its file link, not a broken test

## Unit

- [ ] Probe: text with an inline code span — input: ``Run `pnpm test`.``; expected: one violation
- [ ] Probe: text with a fenced block — input: a README with a fenced block; expected: one violation
- [ ] Probe: a link to a file — input: `[page](../docs/agents/hermes.mdx)`; expected: one violation
- [ ] Probe: a link to a folder with an anchor-free path and plain prose — input: `[the core](../core)`; expected: no violation
- [ ] Every workspace package README (`apps/*`, `libs/*`, `tools/*`) has no violation — expected: `[]` for each
- [ ] The existing link check passes for every README — expected: no broken target
- [ ] `feature-status.test.ts` and `document-indexes.test.ts` pass with the new feature row

## README against code

One box per README, read by a fresh tester against the code on `main` after `feat/agent-registry` merged. Expected for each: every sentence is true, nothing the code does is missing from the purpose, and nothing stale remains.

- [ ] `README.md` — no "Early stage"; links `apps`, `libs`, `docs/features` and `docs/runbooks`; keeps "zapbip is a product of Logic Bit"
- [ ] `apps/api/README.md` — names the MCP tools, the per-account Durable Object, WhatsApp in and out, the install pages, the scheduled upkeep, the backoffice and the fake channel
- [ ] `apps/connector/README.md` — matches the connector commands and the runtimes the registry supplies
- [ ] `apps/docs/README.md` — bilingual, agent pages sourced as the registry sources them, no product code
- [ ] `apps/hermes-plugin/README.md` — no file pointer; matches the plugin behaviour
- [ ] `apps/openclaw-plugin/README.md` — matches the plugin behaviour and its location
- [ ] `libs/agents/README.md` — matches the folders under the catalogue and the generator
- [ ] `libs/core/README.md` — lists the rules the core owns today and names no agent
- [ ] `libs/types/README.md` — lists the vocabulary the package exports today, and says it holds no runtime dependency
- [ ] `tools/repository-shape/README.md` — categories, not a list, and matches the suite
- [ ] `.agents/skills/README.md` — the vendored and in-house lists match the skill folders; the two invocation forms are right
- [ ] `docs/adr`, `docs/features`, `docs/learnings`, `docs/runbooks`, `docs/scenarios` READMEs — indexes complete; unchanged unless the re-audit says otherwise
- [ ] Concision: each package README is one paragraph with no command, path, configuration or symbol

## Gate

- [ ] `pnpm --filter @zapbip/repository-shape test:unit` — expected: all files pass, including the new rows

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: <claim> — attack: <how>; result: <refuted | held>
- [ ] Claim 2: <claim> — attack: <how>; result: <refuted | held>
- [ ] Claim 3: <claim> — attack: <how>; result: <refuted | held>

## Coverage honesty

- Prose accuracy cannot be machine-checked; the README-against-code boxes are read by a person-equivalent tester, and the shape test pins only the form of the rule.
- No UI is touched, so no Playwright MCP walk applies.
