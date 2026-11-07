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

## G6 developers and concepts (branch `feat/docs-experience-g6`)

### What changed

- `apps/docs/e2e/developers.spec.ts`: per language, the twelve pages open with a title, a body and the Logic Bit footer; the local connector page names `--client`, `--cwd`, `--session` and `ZAPBIP_CONNECTION_URL`; background running names launchd, systemd and `600`; webhook wake states 5, 10, 20 and 40 seconds; the wake ladder lists every `WAKE_RUNG_LABELS` label and the delays 7, 6, 9 and 16; owner notices name both templates, the quick replies and the 5 minute / 6 hour retry; the channel page has its three sections and a table; each concept page links only to `concepts/`, `developers/` and `mcp-reference/`.
- `concepts/owner-notices` and `concepts/whatsapp-channel`: restored from `main` (the G0 skeletons had dropped them), with the template bodies, quick replies (`Open`/`Reply`, `Abrir`/`Responder`), a `Chat` example and the notice retry backoff (5 minutes doubling to 6 hours). `main`'s Portuguese table listed `Open` as the Portuguese quick reply of the question template; the page now matches `whatsapp-templates.ts`.
- `concepts/wake-ladder`: the five rungs with expected delays and the client per rung. `concepts/inbox`: the forwarded-message sentence is back.
- `developers/local-connector`: a Commands table (`connect`, `listen`, `channel`, as `apps/connector` help prints them) and the session id as a UUID. `developers/background-running` and `developers/webhook-wake`: developer wording, launchd and systemd named. Portuguese twins written natively.
- The moved-path reads from Step 33 have no test to update on this base: the local-connector and webhook-wake docs checks live on their slice branches.

### Red today, green after

| Test | Red before because | Green after |
|------|--------------------|-------------|
| `developers.spec.ts` (`5636b6f`: 8 failed, 42 passed) | `Expected substring: "zapbip_agent_notice"` / `Received string: "ConceptsOwner noticesThe notices zapbip sends you when an AI is not listening…"` (both languages); `expect(locator).toBeVisible() failed ... element(s) not found` (wake ladder rows and channel sections); `Expected substring: "launchd"` on background running | `b7dff7f`: 50 passed (the spec also gained `.first()` on the table locators, which matched two tables) |

### Hypotheses for the tester

- `pnpm --filter @zapbip/docs broken-links` reports no broken link; the shape tests (347) pass.
- Every number on the wake ladder equals `CLIENT_LISTEN_FACTS`; every template and quick-reply text equals `whatsapp-templates.ts`; the connector flags equal `apps/connector/src/cli.ts`.
- No page under `concepts/` or `developers/` names a simulator or a test double.

### Gaps

- The Scheduled and Standby rows, their `mode: scheduled` / `mode: standby` values and the 1 to 1440 minute interval come from the scheduled-wake branch (facts at the scheduled-wake merge).
- `concepts/questions` and `concepts/routing` were not reworded beyond the existing text; `developers/errors` and `developers/any-mcp-client` are unchanged.
- The Playwright Chromium for 1.65.0 (build 1254) was not installed; it was installed with `pnpm exec playwright install chromium`.
