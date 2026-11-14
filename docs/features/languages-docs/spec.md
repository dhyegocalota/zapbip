# Languages (docs)

**Status:** Shipped 2026-11-14
**Tier:** 🟡 medium
**Owner approval:** approved 2026-11-13 (owner delegated; the request is his word: "translate everything to Spanish, Chinese, German, French, Japanese and Korean", phase B of three)
**ADRs:** [0048](../../adr/0048-the-docs-speak-eight-languages-one-folder-per-language-and-the-page-language-is-a-type-of-its-own.md)
**Not changing:** `apps/api` (the start link keeps `en` and `pt-BR`), the WhatsApp product copy and command words, `OwnerLocale`, the public site

## Problem

The documentation at docs.zapbip.com exists in English and Portuguese. The owner wants it in Spanish, German, French, Japanese, Korean and Simplified Chinese.

## Goals

1. Every English page and snippet exists in `es/`, `de/`, `fr/`, `ja/`, `ko/` and `zh/`, with the same file names, links inside the language folder and navigation per language in `docs.json`.
2. Every agent folder holds `page.<code>.mdx` for the six languages; the generator copies them, generates the matrices per language and keeps the navigation, checks and deletions working for eight languages.
3. Native technical writing in the voice of ADR 0030. Code, commands, tool names and product names stay untranslated; WhatsApp commands, notices and the self-test text stay in English, and a page says so where it shows a command.
4. Every shape test and Playwright spec that policed two languages polices eight: same page set per language, each page listed once, links inside the language, headings, listen tokens, retention figures, start link, company facts.

## Non-goals

- Translating the product's WhatsApp copy (phase C).
- Editing `apps/api`. The site links the documentation per language through `docsPath` in `apps/api/src/web-shell/locale-profiles.ts`; pointing it at the folders is a one-line change per language for the orchestrator.

## Design

### Data flow

`DocsPageLanguage` (eight values) is the language of a documentation page. `DOCS_LANGUAGE_FOLDERS`, `DOCS_OWNER_LOCALES` and `DOCS_START_LINK_LANGUAGES` in `libs/types` map it to the folder, to the owner language the examples are written in and to the `lang` of the start link. `libs/agents/src/docs.ts` holds the copy that the generator and the shape tests check: headings, rung labels, listen tokens, group names; `twinPathOf`, `snippetPathOf` and `languageOfPage` are the only code that knows the layout.

### Interfaces

`page.<code>.mdx` per agent; `apps/docs/<folder>/**`; `apps/docs/snippets/<folder>/**`; `docs.json` language entries in the order `en`, `pt-BR`, `es`, `de`, `fr`, `ja`, `ko`, `zh`.

### Failure handling

A missing page, snippet or table row fails a shape test naming the path. A language with no row in a `Record<DocsPageLanguage, …>` fails `pnpm typecheck`.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Mintlify code for Simplified Chinese | `zh`, `cn`, `zh-Hans` | `zh`; the schema in force lists all three, the folder is `zh` as on the site | 2026-11-13 |
| Language of WhatsApp examples in the new languages | English (the product understands it today) | English, stated on the pages that show a command | 2026-11-13 |

## Test strategy summary

Vitest: the generator and its checks over eight languages (`libs/agents`), the shape tests over the real tree (`tools/repository-shape`). Playwright: the docs specs run per language and viewport; they need `mint dev` and are run by the orchestrator.
