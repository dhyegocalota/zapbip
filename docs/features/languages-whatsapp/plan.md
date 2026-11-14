# Plan: Languages (WhatsApp)

**Spec:** spec.md
**Tier:** 🔴
**Seam:** `OwnerLocale` in `libs/types`, consumed by `libs/core`, `libs/agents`, `apps/api` and the docs generators
**Assumptions (decided, owner can override):**
- Belgium is French and Switzerland German.
- The six new languages send the English template until Meta approves theirs.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `libs/types/src`, `libs/core/src`, `docs/adr/0051-*` | `developer` |
| G2 | `libs/agents`, `apps/api/src`, `apps/api/test`, `apps/api/scripts` | `developer` |
| G3 | `apps/docs`, `tools/repository-shape`, `docs/runbooks/meta-setup.md`, `.claude/rules` | `developer` |

## Sequencing

G1 first (enum, tables, commands, core copy), then G2 (agents, api), then G3 (docs).

## Steps

### G1

- [x] **Step 1:** red tests for the calling-code table, the command words and the language command (commit c1cf1afb)
- [x] **Step 2:** `OwnerLocale` of eight absorbs `WebLocale`; bridges and `DocsLanguage` removed; calling-code table; command words per language; `setOwnerLanguage` with its port
- [x] **Step 3:** inbox, wake, account, approval, usage and install page copy in six languages, with `copy-languages.test.ts`
- [x] **Step 4:** ADR 0051 and ADR 0047 marked superseded

### G2

- [x] **Step 5:** install copy of the ten agents and the three fixtures; self-test texts; quick starts
- [x] **Step 6:** WhatsApp copy, start link copy and language, the template table and bodies of eight languages, the verification list from the table
- [x] **Step 7:** the landing demo recorder takes only the two recorded locales

### G3

- [x] **Step 8:** commands page, delete page, notices, chat replies, start-link snippets, command words in code spans and the generated agent pages in the six folders
- [x] **Step 9:** `account-docs` reads the real command words; the registry test lists eight install files
- [x] **Step 10:** runbook step 12 with the exact template bodies; rules and `AGENTS.md`
- [ ] **Step 11:** integration through the inbound handler for one owner per language

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | A word becomes a command by accident | `command-languages.test.ts`, ordinary messages | rename the word |
| 2 | Two languages share a word | the unique-text test | give one language another word |
| 6 | A flipped template row is unapproved | Meta refuses the send, `number-verification` lists it missing | flip the row back |
| 8 | A docs page quotes English replies | `docs-notices.test.ts`, `account-docs.test.ts` | translate the quote |
