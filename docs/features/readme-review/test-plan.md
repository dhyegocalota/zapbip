# Test plan: README review

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts).

## The failing test first

- [x] `tools/repository-shape/src/delivery-docs.test.ts::purposeViolations` probes — input: the helper as `704f53db` landed it, already implemented, so the probes are a pin and not red; expected: green, with the red run being the real run over `apps/hermes-plugin/README.md` — evidence: R2 at 6b5d1072: the 4 original probes and the 7 reported + 2 not-reported probes are green (pin); the real red run is the hermes file link, and a planted reference link in libs/types/README.md went red with the target path, reverted
- [x] Confirmed it fails for the right reason: the real run over `apps/hermes-plugin/README.md` reports its file link, not a broken test — evidence: 704f53db README of apps/hermes-plugin held a file link (git show 704f53db:apps/hermes-plugin/README.md); fixed by 0a6e25c7

## Unit

- [x] Probe: text with an inline code span — input: ``Run `pnpm test`.``; expected: one violation — evidence: G1 probe run at 52dfa942: ['code span']
- [x] Probe: text with a fenced block — input: a README with a fenced block; expected: one violation — evidence: G1 probe run: ['fenced block']
- [x] Probe: a link to a file — input: `[page](../docs/agents/hermes.mdx)`; expected: one violation — evidence: G1 probe run: returns the target path
- [x] Probe: a link to a folder with an anchor-free path and plain prose — input: `[the core](../core)`; expected: no violation — evidence: G1 probe run: []
- [ ] Probes: a reference-style link, a link with a title, an HTML anchor to a file (double or single quotes), an inline `<code>` element (with or without an attribute), a `<pre>` element, an autolink to a file, a tilde fence, an indented block and a code span across a line break are each reported; a folder whose name contains a dot and a `//host` URL are not — expected: exactly the listed violations
- [x] Every workspace package README (`apps/*`, `libs/*`, `tools/*`) has no violation — expected: `[]` for each — evidence: R2: 9 test.each cases 'states purpose only' green, apps/hermes-plugin included
- [x] The existing link check passes for every README — expected: no broken target — evidence: R2: every relative link test green in the 705-test run
- [x] `feature-status.test.ts` and `document-indexes.test.ts` pass with the new feature row — evidence: shape suite green, 36 files / 695 tests

## README against code

One box per README, read by a fresh tester against the code on the stack over `feat/agent-registry` at 2a5cbdc2. Expected for each: every sentence is true, nothing the code does is missing from the purpose, and nothing stale remains.

- [x] `README.md` — no "Early stage"; links `apps`, `libs`, `docs/features` and `docs/runbooks`; keeps "zapbip is a product of Logic Bit" — evidence: read against AGENTS.md, docs/runbooks; no Early stage; Logic Bit line present
- [ ] `apps/api/README.md` — names the MCP tools, the per-account Durable Object, WhatsApp in and out, the install pages, the scheduled upkeep, the backoffice and the fake channel
- [ ] `apps/connector/README.md` — matches the connector commands and the runtimes the registry supplies
- [x] `apps/docs/README.md` — bilingual, agent pages sourced as the registry sources them, no product code — evidence: apps/docs/agents/*.mdx generated from libs/agents/supported/*/page.*.mdx; pt-br tree present
- [x] `apps/hermes-plugin/README.md` — no file pointer; matches the plugin behaviour — evidence: R2: adapter.py, mcp_outbound.py, connector_socket.py match; test_constants_parity.py pins the Python copy to the TypeScript sources; no file pointer; AGENTS.md Layout line true
- [x] `apps/openclaw-plugin/README.md` — matches the plugin behaviour and its location — evidence: src/channel.ts, send-message.ts; folder still apps/openclaw-plugin
- [x] `libs/agents/README.md` — matches the folders under the catalogue and the generator — evidence: R2: links supported and generate resolve; 11 agent folders; generator derives src/generated
- [x] `libs/core/README.md` — lists the rules the core owns today and holds no supported agent's install copy — evidence: R2: grep of non-test core sources: no supported agent install copy; only pinned wake providers name CLAUDE_ROUTINE/Grok (README no longer claims otherwise); no fetch or node imports, only ports
- [ ] `libs/types/README.md` — lists the vocabulary the package exports today, and says it holds no runtime dependency
- [x] `tools/repository-shape/README.md` — categories, not a list, and matches the suite — evidence: R2: categories match the 37 test files; verify-gates.tsv has the lifecycle gate; shape gate in verify.sh
- [x] `.agents/skills/README.md` — the vendored and in-house lists match the skill folders; the two invocation forms are right — evidence: 14 skill folders = 7 vendored + 7 in-house; .claude/skills symlink
- [x] `docs/adr`, `docs/features`, `docs/learnings`, `docs/runbooks`, `docs/scenarios` READMEs — indexes complete; unchanged unless the re-audit says otherwise — evidence: every ADR, learning, runbook, scenario and feature folder is indexed
- [x] Concision: each package README is one paragraph with no command, path, configuration or symbol — evidence: R2: 9 package READMEs are each one paragraph, no code span, path or symbol (purpose-only test green)

## Gate

- [x] `pnpm --filter @zapbip/repository-shape test:unit` — expected: all files pass, including the new rows — evidence: R2: 36 files, 705 tests passed at 6b5d1072

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case and a regression test for each.

- [x] Row 1 of "The failing test first" does not hold as written: 704f53db landed `purposeViolations` implemented, with no `is not implemented` stub, so the probes were green on arrival (a pin); the red run was the hermes real-run only. Fix: reword the row. — evidence: R2: the row now reads pin, not red; verified reworded
- [x] `apps/hermes-plugin/README.md` said it shares its names through the shared types, but the plugin is Python and mirrors them in its own constants, pinned by a parity check. Fix: say so in purpose terms. — evidence: R2: README now states the Python copy and the parity check; both true (test_constants_parity.py)
- [x] `libs/core/README.md` says the core "names no agent", but `libs/core/src/wake/wake-provider.ts` and `wake/constants.ts` name `CLAUDE_ROUTINE_*` and `WakeProvider.GrokRoutine`/`ClaudeRoutine` (pinned wake providers). `libs/agents/README.md` repeats "never names an agent". Fix: say the core names no supported agent's install copy, or drop the claim. — evidence: R2: claim removed from libs/core and libs/agents READMEs

R2 findings, left unticked above:

- R2: `apps/connector/README.md` line 3 "one runtime per supported agent that runs on the owner's machine" is still an overclaim: libs/agents/supported has connector.ts only for claude-code and codex; cursor, gemini-cli, hermes and openclaw also run on the owner's machine and have none (hermes/openclaw use plugins, cursor uses listen). Fix: "one runtime for each agent the connector can resume".
- R2: `apps/api/README.md` line 3 "wakes a sleeping agent through its webhook" is narrower than the code: dispatching-agent-waker.ts picks among inbox, local connector, webhook, scheduled and standby wakers (WakeRung). Fix: "wakes a sleeping agent by the way its owner chose".
- R2: `libs/types/README.md` line 3 "The vocabulary every other package shares" and "every shared name from one place" are false for apps/hermes-plugin (no dependency on @zapbip/types, by design) and for ConnectorClient, which lives in libs/agents/src/generated/ids.ts. Fix: say the TypeScript packages, and drop "every".
- R2: purposeViolations gaps beyond the listed Known gaps: `<code class="x">`, `<pre>`, `<a href='single quotes'>` and an autolink `<../docs/a.md>` are not reported; `[p](../core.v2)` without trailing slash is (documented). Fix: loosen HTML_CODE_PATTERN to /<(code|pre)\b/i, allow either quote in ANCHOR_HREF_PATTERN.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: <claim> — attack: <how>; result: <refuted | held>
- [ ] Claim 2: <claim> — attack: <how>; result: <refuted | held>
- [ ] Claim 3: <claim> — attack: <how>; result: <refuted | held>

## Coverage honesty

- Prose accuracy cannot be machine-checked; the README-against-code boxes are read by a person-equivalent tester, and the shape test pins only the form of the rule.
- No UI is touched, so no Playwright MCP walk applies.
