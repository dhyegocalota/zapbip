# Plan: README review

**Spec:** spec.md
**Tier:** 🟢 small
**Seam:** the `README.md` files and `tools/repository-shape/src/delivery-docs.test.ts`
**Assumptions (decided, owner can override):**
- The README edits are stacked on `feat/agent-registry` at 2a5cbdc2 and are re-read against `main` when the stack merges (Step 13).
- The audit texts are the starting point; the re-audit may amend them.
- The purpose-only test lives in `delivery-docs.test.ts`.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `tools/repository-shape/src/delivery-docs.test.ts` | `developer` |
| G2 | `README.md`, `.agents/skills/README.md`, `tools/repository-shape/README.md` | `developer` |
| G3 | `apps/api/README.md`, `apps/connector/README.md`, `apps/docs/README.md`, `apps/hermes-plugin/README.md`, `apps/openclaw-plugin/README.md` | `developer` |
| G4 | `libs/core/README.md`, `libs/types/README.md`, `libs/agents/README.md` | `developer` |

## Sequencing

Step 1 is first and gates the rest. G1 can run beside it. G2, G3 and G4 are disjoint and run in parallel after step 1 writes the final texts into the plan.

## Steps

Author this list with every box empty. A sub-agent ticks its own line. A wrong step is struck through with the reason, not deleted.

### Re-audit

- [x] **Step 1:** on the stack over `feat/agent-registry` at 2a5cbdc2, read every README against the code and record the findings and the final texts in this plan, one block per README. Include the READMEs the audit did not cover (`libs/agents`) and any added since. — evidence: re-audit on `feat/agent-registry` at 2a5cbdc2, findings below

### G1

- [x] ~~**Step 2:** red: `purposeViolations` probes (a code span, a fenced block and a file link are reported; folder links and plain prose are not) and the `test.each` over workspace package READMEs, with a stub that throws `purposeViolations is not implemented`; commit alone~~ — struck through: it landed implemented, so the probes are a pin; the red run is the real hermes run — evidence: 704f53db
- [x] **Step 3:** implement `purposeViolations`; the probes go green and the real run stays red only on READMEs still violating the rule — evidence: 704f53db (helper) and 0a6e25c7 (apps/hermes-plugin README)

### G2

- [x] **Step 4:** root `README.md`: replace "Early stage", add the runbooks link, keep the Logic Bit line — evidence: ae1ff151
- [x] **Step 5:** `.agents/skills/README.md`: the shortened text — evidence: ae1ff151
- [x] **Step 6:** `tools/repository-shape/README.md`: the category text — evidence: ae1ff151

### G3

- [x] **Step 7:** `apps/api/README.md` — evidence: 5eb0c522
- [x] **Step 8:** `apps/hermes-plugin/README.md`: drop the file pointer — evidence: 0a6e25c7
- [x] **Step 9:** `apps/connector/README.md`, `apps/docs/README.md`, `apps/openclaw-plugin/README.md`: only the registry-driven rewording, or confirm unchanged — evidence: 5eb0c522 (docs clause); connector and openclaw-plugin confirmed unchanged

### G4

- [x] **Step 10:** `libs/core/README.md` — evidence: 737d59c1
- [x] **Step 11:** `libs/types/README.md` — evidence: 737d59c1
- [x] **Step 12:** `libs/agents/README.md`: confirm against the final folders; amend only if wrong — evidence: reworded in bd1b529a and again in the review round; `supported/` and `generate/` exist and match
- [x] **Step 13:** when the stack merges, re-read `libs/agents`, `libs/core` and `apps/connector` against `main` and amend the READMEs that no longer match — evidence: rebased onto main at 1750a209; the diff cf2503cd..1750a209 touches `libs/agents/generate` (discovery of listed folders, source, mentions), `libs/agents/src/checks/pages.ts` and fixture pages, and nothing in `libs/core` or `apps/connector`; none of the three READMEs claims anything about discovery, scaffolding, mentions or plugin removal, and `supported/` still holds 11 folders with connector runtimes in `claude-code` and `codex`; all three unchanged

### Re-audit findings (feat/agent-registry at 2a5cbdc2, updated through the review round)

| README | Result | Why |
|--------|--------|-----|
| `README.md` | changed | "Early stage" was false; replaced, runbooks link added, Logic Bit line kept |
| `.agents/skills/README.md` | changed | shortened; all 14 listed skills exist in the folder |
| `tools/repository-shape/README.md` | changed | categories replace the stale list; adds the root entries, the agent surfaces and the registry (`agent-registry.test.ts`, `agent-surfaces.test.ts`) and says the agent lifecycle runs as its own gate (`verify-gates.tsv`) |
| `apps/api/README.md` | changed | audit text kept, plus the account directory and media storage (D1 and R2); "Hermes plugin package" became "hosted plugin packages" because `routes/package.ts` serves the `hostedArtifacts` of every plugin in the registry; install pages exist in `install/install-page-adapter.ts`; upkeep in `operations/scheduled.ts`; the wake goes by the method the connection chose (inbox, local connector, webhook, scheduled, standby), so "through its webhook" was false |
| `apps/connector/README.md` | changed | "one runtime per supported agent" was false (11 agents, 2 connector runtimes); now it wakes the local agents the registry gives a connector runtime, since cursor, gemini-cli, hermes and openclaw run locally with none |
| `apps/docs/README.md` | changed | one clause: the agent pages (`apps/docs/agents/*.mdx`) are generated from the agent folders |
| `apps/hermes-plugin/README.md` | changed | G1 dropped the file pointer; bd1b529a says the Python adapter keeps its own copy of the shared names, pinned by a parity check to the TypeScript it mirrors |
| `apps/openclaw-plugin/README.md` | unchanged | the folder did not move into `libs/agents` |
| `libs/core/README.md` | changed | audit text amended: the install guides left core (it renders the page from the sections it is given and holds no supported agent's install copy; `wake/wake-provider.ts` names pinned wake providers, so "names no agent" was false); account lifecycle, the whole wake of a sleeping agent, the connector frames (`inbox/connector-frames.ts`) and the agent rules (`agent-rules.ts`) named |
| `libs/types/README.md` | changed | audit text amended: connector and channel-plugin contracts stay (`connector.ts`, `channel-plugin.ts`); the Hermes wheel contract is no longer in `libs/types` and is not claimed; `libs/agents` joins the list of consumers; "without importing each other" was false, "every package ... one place" was false too (`apps/hermes-plugin` does not depend on it, `ConnectorClient` lives in the generated agent ids), so it says the TypeScript packages share the enums and constants |
| `libs/agents/README.md` | changed | "never names an agent" was false for the same reason; the sentence about the core is dropped and the folder brings what zapbip needs to support the agent |
| `docs/adr`, `docs/features`, `docs/learnings`, `docs/runbooks`, `docs/scenarios` | unchanged | test-pinned indexes; the runbooks list matches the folder |
| `AGENTS.md` Layout | changed | lines for `apps/hermes-plugin` and `apps/openclaw-plugin` added; the only test touching the Layout checks the client fixtures line |

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 1 | A README is checked against the branch, not `main`, and the text is wrong after the merge | the tester finds a claim with no code behind it | redo the re-audit on `main` |
| 3 | The rule is too strict and flags a legitimate README | the shape test lists a package README | the owner decides; relax the rule or fix the README, never skip the package |
| 4 | The Logic Bit line is dropped | `company-docs.test.ts` fails | restore the line |
| 7 to 12 | A link names a moved folder | `delivery-docs.test.ts` link check fails | repoint the link |

**Steps with no backout:** none

## Z. Prove and ship

- [x] **Tester briefing:** a developer wrote `tester-briefing.md`. — evidence: tester-briefing.md
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`.
- [ ] **/check-ui:** not applicable.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
