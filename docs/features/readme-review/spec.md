# README review

**Status:** Building
**Tier:** 🟢 small
**Owner approval:** owner delegated 2026-11-06
**ADRs:** none
**Not changing:** product code under `apps/*/src` and `libs/*/src`, and every document that is not a README

## Problem

The owner ordered: "review all READMEs: concise but correct." The audit of origin/main at 7a55602 (2026-11-07) found 15 tracked READMEs, 7 of which need a fix:

- `README.md` still says "Early stage: the repository holds the engineering harness only". The product shipped, so the claim is false.
- `apps/api` is one 90-word sentence that omits the install pages, the usage and metrics, and the scheduled upkeep.
- `apps/hermes-plugin` breaks the purpose-only rule: its last sentence points at a file path.
- `libs/core` omits the account lifecycle, its commands and the install guides.
- `libs/types` omits the connector frames, the wake outcomes, the channel-plugin contracts and the Hermes wheel contract.
- `tools/repository-shape` lists categories that went stale; a category is shorter than a list that rots.
- `.agents/skills` restates each skill's own front matter in about 230 words.

`feat/agent-registry` rewrites the ground under several of these: it adds `libs/agents` (the catalogue of supported agents, one folder per agent holding its install copy, docs page and connector runtime) and moves install copy out of the core. A README written now would be wrong again the day that branch merges, so the README edits wait for it.

## Goals

- Every README in the repository reads true against the code on `main` after `feat/agent-registry` merges: the root, `apps/api`, `apps/connector`, `apps/docs`, `apps/hermes-plugin`, `apps/openclaw-plugin`, `libs/agents`, `libs/core`, `libs/types`, `tools/repository-shape`, `.agents/skills`, and the five index READMEs under `docs/` (`adr`, `features`, `learnings`, `runbooks`, `scenarios`).
- Every workspace package README states purpose only: no commands, configuration, file paths, symbols or code spans, and links only to folders, so a rename fails the link check.
- No stale claim survives: no "Early stage", no list that a new feature makes incomplete, no mechanism detail the code already shows.
- Each README is short: one paragraph, as many sentences as the purpose needs.
- A repository-shape test enforces the purpose-only rule on workspace package READMEs so it cannot regress.

## Non-goals

- Rewriting the `docs/*` index READMEs beyond the rows their own shape tests force; the audit found them correct.
- Moving the Hermes wheel test or parsing out of `libs/types` (noted by the audit, a separate refactor).
- Changing the `.agents/skills` README rules: it is not a workspace package, so it may name file paths, and it only gets shorter.

## Design

### Data flow

1. Re-audit against `main` once `feat/agent-registry` has merged: read every README against the code it describes and list what changed since the 2026-11-07 audit.
2. Apply the texts, one group per step, in the order of the plan.
3. The shape test reads each workspace package README through the existing `workspacePackages()` helper and reports violations.

### Interfaces

Texts to start from (the re-audit may amend them; the audit file is the source and stays in the scratchpad, the final texts land in the READMEs):

- `README.md`: replace the "Early stage" paragraph with a sentence that product code lives in `apps` and `libs` and that each part arrived as a feature under `docs/features`; add the runbooks to "Read more". The line "zapbip is a product of Logic Bit" stays (`company-docs.test.ts`).
- `apps/api`: the Worker behind zapbip, MCP tools to the owner's agents, one Durable Object per account, WhatsApp in and out, the connector channel, the install pages, the scheduled upkeep, the operator backoffice, the fake WhatsApp channel in development, ports of the core adapted to the platform.
- `apps/hermes-plugin`: purpose sentences only; the install pointer goes, because a link to a docs file breaks the rule.
- `libs/core`: validation, owner routing, the account lifecycle and its commands, the 24-hour window, questions and answers, media bookkeeping, the webhook wake, the owner-facing copy; ports only; vocabulary from the shared types. After the registry merges it drops the install guides and says it renders what the catalogue gives it.
- `libs/types`: the shared vocabulary and constants, no logic and no runtime dependency; revisit the connector, channel-plugin and wheel contracts if the agent folders take them.
- `tools/repository-shape`: tests about the repository itself: documents, indexes and links, workflows and release facts, the docs site, the install guides, the backoffice.
- `.agents/skills`: the single source of skills, how each tool reads it, the vendored and in-house lists, the two invocation forms.
- `libs/agents`: already written on the registry branch; the re-audit checks it against the final folders.
- `apps/connector`: reword "local Claude Code or Codex session" to "local agent session" if the runtimes come from the registry.
- `apps/docs`: one clause saying the agent pages come from the registry, if they do.
- `apps/openclaw-plugin`: only if its folder moves into `libs/agents`.

### The purpose-only test

Extend `tools/repository-shape/src/delivery-docs.test.ts`, which already holds "every workspace package has a README" and the link check; no new file. Add a pure `purposeViolations(text)` helper and a `test.each` over `workspacePackages()` READMEs that asserts it returns `[]`. A violation is a code span, a fenced block, or a relative link whose target is not a folder (has a file extension). Two probe cases prove the helper in both directions, as the existing link probes do. Red first: the probes fail against a stub, and the real run is red on `apps/hermes-plugin` until its README is fixed.

### Failure handling

A README that must name a file (the skills README) is not a workspace package and is outside the test. A new package that legitimately needs a code span gets the rule changed by the owner, not a silent exception.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Edit the READMEs now or after `feat/agent-registry` merges | now, after the merge | after the merge: several READMEs change twice otherwise (owner delegated) | 2026-11-06 |
| Enforce purpose-only with a test | prose rule only, extend `delivery-docs.test.ts`, new test file | extend `delivery-docs.test.ts`; the harness says a rule worth stating is a rule worth pinning (owner delegated) | 2026-11-06 |
| Shared test helper or new test file | new file, existing file | existing file, which already owns the README checks (owner delegated) | 2026-11-06 |

## Test strategy summary

Unit: the extended shape test with two probes, red first. Proof: each README read against its code by a fresh tester, links resolved, and the shape suite green.
