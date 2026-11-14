# Plan: Hindi

**Spec:** spec.md
**Tier:** 🔴 structural
**Seam:** the `OwnerLocale`, `WebLanguageTag`, `DocsPageLanguage` and `WhatsAppLanguageCode` enums and every `Record` over them
**Assumptions (decided, owner can override):**
- Hindi ships with the English Meta template until the Hindi pair is approved.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `libs/types`, `libs/core`, `libs/agents`, `apps/api`, `apps/docs`, `tools/repository-shape`, `docs/**`, `AGENTS.md`, `.claude/rules` | `developer` |

## Sequencing

Red tests, enums and core copy, agents, web surfaces, media, docs, decision and living docs.

## Steps

### G1

- [x] **Step 1:** red tests for the types and the core (`6b62ec9a`)
- [x] **Step 2:** enums, core copy, command words and folding (`cc0d6994`)
- [x] **Step 3:** agent install copy (`1d70dde8`) and agent pages with the generated docs (`b1ee4539`)
- [x] **Step 4:** red web tests (`a0650491`), then site, legal, app, backoffice, shell, flag, WhatsApp copy and templates (`dc9bee35`)
- [x] **Step 5:** demo, posters and card (`04f0ba70`); `/hi` Playwright pin (`d36a02bd`)
- [x] **Step 6:** the documentation and its tests (`0c9f5a4b`)
- [ ] **Step 7:** ADR 0057, glossary, living docs, this folder
- [ ] **Step 8:** the docs Playwright walk against a Mintlify preview

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|---|---|---|---|
| 2 | A Hindi command word swallows ordinary chat | `command-languages.test.ts`, `command-folding.test.ts` | change the word in `command-words.ts` and the docs table |
| 4 | A Devanagari meta description exceeds the budget | `site-seo-budget.test.ts` | shorten the copy |
| 5 | Devanagari renders as boxes in the media | the poster and the card read by eye | re-record after fixing the font stack |
