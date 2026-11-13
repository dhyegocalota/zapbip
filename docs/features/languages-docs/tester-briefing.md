# Tester briefing: Languages (docs)

## What changed

- `libs/types`: `DocsPageLanguage` (eight values), `DOCS_LANGUAGE_FOLDERS`, `DOCS_OWNER_LOCALES`, `DOCS_START_LINK_LANGUAGES`. `DocsLanguage` keeps its two values for the start link.
- `libs/agents`: the copy tables in `src/docs.ts`, `perLanguage`, `languageOfPage`, `twinPathOf` and `snippetPathOf`; the generator, its checks, matrices, navigation and orphan deletions over eight languages; `page.<code>.mdx` per agent and per fixture.
- `apps/docs`: `docs.json` with six more language entries and a 404 page in eight languages; `es`, `de`, `fr`, `ja`, `ko`, `zh` folders and snippets; the overview picture per language.
- `tools/repository-shape` and `apps/docs/e2e`: every docs test over eight languages.
- `apps/api/scripts/record-landing-demo.ts`: one identifier renamed to `DocsPageLanguage` so it compiles.

## How to run

- `pnpm agents:check` (0 stale, 0 violations), then in `libs/agents` and `tools/repository-shape`: `pnpm exec vitest run`.
- Playwright: `apps/docs/e2e` needs `mint dev` and a browser; not run by the developers.

## Red today, green after

- `71ad4ec0` is red against `4a598573` (it names `DocsPageLanguage` and the folders); `1f20eecd` and the content commits turn it green.

## Hypotheses for the tester

- The language switcher of Mintlify lists English, Português (BR), Español, Deutsch, Français, 日本語, 한국어 and 简体中文 in that order; the last name is unverified.
- Each language Overview opens, its first three headings match `OVERVIEW_HEADINGS` in `get-started.spec.ts`, and its picture loads.
- The French pages show a no-break space before `: ; ? !` and inside the quotation marks; Playwright text matching ignores it.
- Every link of every new page stays inside its folder (checked by script, 0 stray links).

## Gaps

- No Playwright spec was run, and `mintlify broken-links` is not available locally.
- The six new languages show WhatsApp commands, zapbip replies, notices and the self-test text in English; phase C replaces those rows.
- `apps/api` still links the docs in English for the six new languages: set `docsPath` in `locale-profiles.ts` to `/es`, `/de`, `/fr`, `/ja`, `/ko` and `/zh`.
