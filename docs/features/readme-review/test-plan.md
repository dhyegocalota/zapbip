# Test plan: README review

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts).

## The failing test first

- [ ] `tools/repository-shape/src/delivery-docs.test.ts::purposeViolations` probes — input: the helper as `704f53db` landed it, already implemented, so the probes are a pin and not red; expected: green, with the red run being the real run over `apps/hermes-plugin/README.md`
- [x] Confirmed it fails for the right reason: the real run over `apps/hermes-plugin/README.md` reports its file link, not a broken test — evidence: 704f53db README of apps/hermes-plugin held a file link (git show 704f53db:apps/hermes-plugin/README.md); fixed by 0a6e25c7

## Unit

- [x] Probe: text with an inline code span — input: ``Run `pnpm test`.``; expected: one violation — evidence: G1 probe run at 52dfa942: ['code span']
- [x] Probe: text with a fenced block — input: a README with a fenced block; expected: one violation — evidence: G1 probe run: ['fenced block']
- [x] Probe: a link to a file — input: `[page](../docs/agents/hermes.mdx)`; expected: one violation — evidence: G1 probe run: returns the target path
- [x] Probe: a link to a folder with an anchor-free path and plain prose — input: `[the core](../core)`; expected: no violation — evidence: G1 probe run: []
- [ ] Probes: a reference-style link, a link with a title, an HTML anchor to a file, an inline `<code>` element, a tilde fence, an indented block and a code span across a line break are each reported; a folder whose name contains a dot and a `//host` URL are not — expected: exactly the listed violations
- [ ] Every workspace package README (`apps/*`, `libs/*`, `tools/*`) has no violation — expected: `[]` for each
- [ ] The existing link check passes for every README — expected: no broken target
- [x] `feature-status.test.ts` and `document-indexes.test.ts` pass with the new feature row — evidence: shape suite green, 36 files / 695 tests

## README against code

One box per README, read by a fresh tester against the code on the stack over `feat/agent-registry` at 2a5cbdc2. Expected for each: every sentence is true, nothing the code does is missing from the purpose, and nothing stale remains.

- [x] `README.md` — no "Early stage"; links `apps`, `libs`, `docs/features` and `docs/runbooks`; keeps "zapbip is a product of Logic Bit" — evidence: read against AGENTS.md, docs/runbooks; no Early stage; Logic Bit line present
- [ ] `apps/api/README.md` — names the MCP tools, the per-account Durable Object, WhatsApp in and out, the install pages, the scheduled upkeep, the backoffice and the fake channel
- [ ] `apps/connector/README.md` — matches the connector commands and the runtimes the registry supplies
- [x] `apps/docs/README.md` — bilingual, agent pages sourced as the registry sources them, no product code — evidence: apps/docs/agents/*.mdx generated from libs/agents/supported/*/page.*.mdx; pt-br tree present
- [ ] `apps/hermes-plugin/README.md` — no file pointer; matches the plugin behaviour
- [x] `apps/openclaw-plugin/README.md` — matches the plugin behaviour and its location — evidence: src/channel.ts, send-message.ts; folder still apps/openclaw-plugin
- [ ] `libs/agents/README.md` — matches the folders under the catalogue and the generator
- [ ] `libs/core/README.md` — lists the rules the core owns today and holds no supported agent's install copy
- [ ] `libs/types/README.md` — lists the vocabulary the package exports today, and says it holds no runtime dependency
- [ ] `tools/repository-shape/README.md` — categories, not a list, and matches the suite
- [x] `.agents/skills/README.md` — the vendored and in-house lists match the skill folders; the two invocation forms are right — evidence: 14 skill folders = 7 vendored + 7 in-house; .claude/skills symlink
- [x] `docs/adr`, `docs/features`, `docs/learnings`, `docs/runbooks`, `docs/scenarios` READMEs — indexes complete; unchanged unless the re-audit says otherwise — evidence: every ADR, learning, runbook, scenario and feature folder is indexed
- [ ] Concision: each package README is one paragraph with no command, path, configuration or symbol

## Gate

- [ ] `pnpm --filter @zapbip/repository-shape test:unit` — expected: all files pass, including the new rows

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case and a regression test for each.

- [ ] Row 1 of "The failing test first" does not hold as written: 704f53db landed `purposeViolations` implemented, with no `is not implemented` stub, so the probes were green on arrival (a pin); the red run was the hermes real-run only. Fix: reword the row.
- [ ] `apps/hermes-plugin/README.md` said it shares its names through the shared types, but the plugin is Python and mirrors them in its own constants, pinned by a parity check. Fix: say so in purpose terms.
- [ ] `libs/core/README.md` says the core "names no agent", but `libs/core/src/wake/wake-provider.ts` and `wake/constants.ts` name `CLAUDE_ROUTINE_*` and `WakeProvider.GrokRoutine`/`ClaudeRoutine` (pinned wake providers). `libs/agents/README.md` repeats "never names an agent". Fix: say the core names no supported agent's install copy, or drop the claim.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: <claim> — attack: <how>; result: <refuted | held>
- [ ] Claim 2: <claim> — attack: <how>; result: <refuted | held>
- [ ] Claim 3: <claim> — attack: <how>; result: <refuted | held>

## Coverage honesty

- Prose accuracy cannot be machine-checked; the README-against-code boxes are read by a person-equivalent tester, and the shape test pins only the form of the rule.
- No UI is touched, so no Playwright MCP walk applies.
