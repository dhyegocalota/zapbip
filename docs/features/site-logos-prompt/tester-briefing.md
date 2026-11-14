# Tester briefing: Site logos and the one-line setup prompt

## What changed and where

- Logos: `apps/api/site-public/site/logos/{openai,openclaw,hermes}.svg`, the `officialLogo` stems of four install facets under `libs/agents/supported/`, `NOTICE.md` (source, terms, date per file). Two agents keep initials by design.
- Prompt: `apps/api/src/site/views/quick-start-section.tsx` (prompt window with the Copy button, collapsed `<details class="start-manual">`), `quick-start-entries.ts` (`prompt`, `promptHint`), copy keys `StartPrompt*`, `StartManualSummary`, `Setup*` in all eight `site-copy*.ts`.
- Setup page: `setup-markdown.ts`, `setup-prompt.ts`, `agentic-paths.ts` (`setupPathOf`, `setupUrlOf`), routes in `agentic-routes.ts`; linked from `llms-files.ts`, `markdown-pages.ts`, `well-known-documents.ts` (skill `setup_zapbip`) and `catalog-routes.ts` (`prompt`, `setupUrl`).

## How to run

- Unit: `pnpm exec vitest run --config vitest.unit.config.mts test/unit/site-` in `apps/api`.
- Integration: `pnpm exec vitest run --config vitest.integration.config.mts --maxWorkers=2 test/integration/site-setup.test.ts test/integration/site-page.test.ts test/integration/site-agentic-discovery.test.ts test/integration/site-agentic-twins.test.ts test/integration/site-agentic-languages.test.ts`.
- Walk: `pnpm test:landing -- landing-quick-start`.

## Red today, green after

- `apps/api/test/unit/site-logos.test.ts` (b1548fb7): `expected [ Array(6) ] to have a length of 2 but got 6` and rows without a date; green at e649311e.
- `apps/api/test/integration/site-setup.test.ts` (f52bcebf): red on `setupPathOf is not implemented` and the missing routes; green at 2b924d84.

## Hypotheses for the tester

- Every tab shows the same one line, with the address of its own language's setup page, and the Copy button copies exactly that line.
- The manual section is closed on load and opens on a click or Enter on the summary, without a script too.
- `/setup.md`, `/pt-br/setup.md`, `/es/setup.md`, `/de/setup.md`, `/fr/setup.md`, `/ja/setup.md`, `/ko/setup.md`, `/zh/setup.md` answer `text/markdown`, name every registry agent and carry no connection secret.
- Portuguese names `novo agente <seu nome>`, the other seven `new agent <...>` with the placeholder word of their language.
- The OpenAI, OpenClaw and Hermes marks render on the white chip at 20 px in both themes.

## Gaps

- Grok Bot and Grok web keep initials: the xAI brand page allows its logo only exactly as downloaded from its own archive, which could not be fetched without being blocked.
- The Hermes mark is the Nous Research app icon traced from the repository's large vector to a 3.6 KB path, so it is a simplified redraw.
- The setup page names `new agent` in English for the six languages that share the English WhatsApp commands.
