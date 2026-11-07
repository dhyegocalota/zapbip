# Tester briefing: User-first docs in two languages

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

### G0 contract (cut early from main, 2026-11-06; lanes G1 to G8 wait for install-skills and scheduled-wake)

- `libs/types/src/enums.ts`, `constants.ts` — `DocsLanguage`, `DocsOnlyClient`, `DocsRetentionKind`, `OFFICIAL_NUMBER_UNSET`, `OFFICIAL_WHATSAPP_NUMBER`, and a byte-identical copy of install-skills' `InstallClient` (the merge takes the identical hunk).
- `tools/repository-shape/src/docs-experience.ts` — the contract data and the helpers. Additions beyond the plan's list: `messageCountOf`, `missingListenTokens`, `developerLinkViolations`, `docsNavigationOf`, `navigationPagesOf`, `AGENT_PAGE_SECTIONS`. `ScheduledWakeRung` holds `scheduled` and `standby` until scheduled-wake puts them in `WakeRung`; `WakeRung` on main lacks them and adding them would break `WakerByRung` in `apps/api`.
- `tools/repository-shape/src/docs-experience.test.ts` — the T1 tests that are green in G0 and their fixtures. `docs-navigation.test.ts` reads `DocsLanguage` values and the shared navigation helpers. `docs-walk-support.test.ts` covers `docsOptionsOf`.
- `apps/docs/docs.json`, 36 skeleton pages, `snippets/install-prompt.mdx`, `snippets/official-number.mdx` (both languages), `agents/supported-agents` with the eleven-row matrix; `guides/webhook-wake` moved to `developers/webhook-wake`.
- Content edits the new guards forced on existing pages: the quickstart's install code is `zb_inst_<code>` and its chat is split in two (both languages); `send-messages-and-media` and `many-agents-on-one-number` split chats of more than four messages (both languages); `help/troubleshooting` no longer links `developers/errors`; `developers/webhook-wake` says "the routine headers" instead of "beta headers"; `set-wake` and `wake-ladder` link the new webhook-wake path.
- `apps/docs/package.json`, `tsconfig.json`, `playwright.config.ts`, `e2e/support/docs-experience.ts`; `@playwright/test` `1.65.0` exact; `pnpm-lock.yaml`.
- `scripts/verify.sh`, `scripts/verify.test.sh` — `gate_docs` runs `broken-links` then `test:walk`.

### G7 MCP reference (branch `feat/docs-experience-g7`)

- `libs/types/src/enums.ts` now holds `McpToolName`; `apps/api/src/contract/tool-definitions.ts` imports it from `@zapbip/types` and re-exports it so no other file in `apps/api` changes (`e9f5dd5`).
- `apps/docs/snippets/message-kinds.mdx` and its pt-br twin: the Kind column holds the `MessageKind` values in backticks (`choice` replaces "buttons and list", `audio` carries the `voice` note), and the row for quotes stays (`5b58b27`).
- `tools/repository-shape/src/docs-experience.test.ts`: `docs experience: mcp reference` (T1-49 registry in both languages plus two fixtures, and the message-kind coverage of both snippets). `apps/docs/e2e/mcp-reference.spec.ts`: six message-sending tool pages in both languages show a table with every kind.
- Red text at `f084e7c`: `TypeError: Cannot convert undefined or null to object` (`McpToolName` absent from `@zapbip/types`); `AssertionError: expected [ 'missing text', …(9) ] to deeply equal []` (snippets listed no kind value).
- Hypotheses: the registry test fails naming `missing`/`extra` pages when `accounts-and-keys` or `scheduled-wake` add a tool at the facts merge; the walk passes 24 of 24 in both browser locales.
- Gap: the eleven pages were not reworded beyond the tables, because their text already matched the tool contract; the facts merge should recheck the input tables against `mcp-schemas.ts`.

## How to run

```bash
pnpm --filter @zapbip/repository-shape test:unit
bash scripts/verify.test.sh
pnpm verify all
```

## Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `docs-experience.test.ts` (28 failing at `7902adb`) | `Error: agentPagePathOf is not implemented`, `twinPathOf`, `headingsOf` and the other stubs; `AssertionError: expected { duplicated: [ …(2) ], unlisted: [] } to deeply equal { duplicated: [], unlisted: [] }`; `AssertionError: expected 'import { existsSync } from …' not to match /['"](en\|pt-BR)['"]/` | helpers `0aafb88`, navigation `19e9271`, pages `b7d9a8f` |
| `docs-walk-support.test.ts::docsOptionsOf …` (4 tests) | `Error: docsOptionsOf is not implemented` (`ac724bf`) | `9d9c509` |
| `scripts/verify.test.sh::a docs site change checks the links, then runs the walk` | `FAIL … expected 'broken-links\ntest:walk', got 'broken-links'` (`8e75a90`) | `1eb0089` |

Pins (green when they landed): the fixture tests built on test-local validators and `the docs never name the test double`, in `7902adb`.

## Hypotheses for the tester

- Every page in `docs.json` exists in both languages and nothing is listed twice.
- `pnpm --filter @zapbip/docs broken-links` finds no broken link after the move of `guides/webhook-wake`.
- `pnpm --filter @zapbip/docs test:walk` passes with no specs.

## Gaps

- The agent pages are skeletons: four headings, no body. The walk, the listen tests (T1-19 to T1-26), the retention test (T1-45), the registry test (T1-49) and the copy facts test (T1-39) belong to the lanes.
- `McpToolName` lives in `apps/api/src/contract/tool-definitions.ts`; G7 moves it to `libs/types`.
- The official number is the sentinel; the sentinel is rendered by the snippets.
