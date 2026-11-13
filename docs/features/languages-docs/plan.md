# Plan: Languages (docs)

**Spec:** spec.md
**Tier:** 🟡 medium
**Seam:** `DocsPageLanguage` in `libs/types`, the tables in `libs/agents/src/docs.ts`, the folders under `apps/docs`
**Assumptions (decided, owner can override):**
- The new languages show owner-side WhatsApp text in English.
- The start link of every new language asks for `lang=en`.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `libs/types`, `libs/agents`, `tools/repository-shape`, `apps/docs/docs.json`, `apps/docs/e2e`, `docs/` | `r8-docs-a` |
| G2 | `apps/docs/{es,de,fr}`, `apps/docs/snippets/{es,de,fr}`, `libs/agents/supported/*/page.{es,de,fr}.mdx` | `r8-docs-a` |
| G3 | `apps/docs/{ja,ko,zh}`, `apps/docs/snippets/{ja,ko,zh}`, `libs/agents/supported/*/page.{ja,ko,zh}.mdx` | `r8-docs-b` |

## Sequencing

G1 lands first (the types, the generator, the tests, the navigation). G2 and G3 run in parallel on disjoint folders; the generated pages and matrices are written once both have landed.

## Steps

### G1

- [x] **Step 1:** generalise the shape tests, the generator tests and the Playwright specs to eight languages (red). Done: 71ad4ec0.
- [x] **Step 2:** `DocsPageLanguage`, the folder and owner maps, the tables in `docs.ts`, the generator over eight languages, fixtures, `docs.json` entries. Done: 1f20eecd, 83805af6.
- [x] **Step 3:** ADR 0048, this folder, the feature index row. Done: 1f20eecd.

### G2

- [x] **Step 4:** translate every English page and snippet to es, de and fr; agent pages as `page.<code>.mdx`. Done: 7434d2bc.

### G3

- [x] **Step 5:** the same for ja, ko and zh. Done: 54ce6d32, 4e2fddec (r8-docs-b).

### Join

- [x] **Step 6:** run `pnpm agents:generate`, then the shape suite and `pnpm agents:check`. Done: 7434d2bc; `agents:check` 0 stale, 0 violations; repository-shape 40 files 1870 tests and libs/agents 48 files 840 tests green.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | a table misses a language | `pnpm typecheck` names the `Record<DocsPageLanguage, …>` | add the row |
| 4, 5 | a page misses a fixed string | the shape test names the page and the string | edit the page |
| 6 | the generator rewrites `docs.json` badly | `docs-navigation.test.ts` fails | `git checkout apps/docs/docs.json` and rerun |
