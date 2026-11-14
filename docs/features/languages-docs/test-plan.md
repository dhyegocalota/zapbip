# Test plan: Languages (docs)

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] `tools/repository-shape/src/docs-navigation.test.ts::every default page has its twin in %s` — input: the tree before any translated page exists; expected: one failing case per new language listing the missing twins.

## Unit

- [ ] `libs/agents/generate/render-pages.test.ts` — input: a fixture page per language; expected: copied unchanged to `apps/docs/<folder>/agents/`, and a violation naming `page.<code>.mdx` for swapped headings, a missing fact or a missing page.
- [ ] `libs/agents/generate/render-navigation.test.ts` — input: a `docs.json` with eight agent groups; expected: each group rewritten in its own language entry, a foreign page named, orphan deletions in eight folders.
- [ ] `libs/agents/generate/render-matrix.test.ts` — input: three agents; expected: header, rung label and delay in each language.
- [ ] `libs/agents/src/checks/guide-parity.test.ts`, `pages.test.ts` — input: a guide per language with an extra action or without the one-listener sentence; expected: the violation naming the language.
- [ ] `tools/repository-shape/src/docs-experience.test.ts`, `account-docs.test.ts`, `whatsapp-docs.test.ts`, `scheduled-wake-docs.test.ts`, `company-docs.test.ts`, `docs-notices.test.ts`, `docs-visual.test.ts`, `local-connector-parity.test.ts`, `agent-registry.test.ts` — input: the real tree; expected: green for eight languages.

## E2E (Playwright specs)

- [ ] `apps/docs/e2e/*.spec.ts` — steps: each spec runs per language and viewport; expected: green under `mint dev` (run by the orchestrator; needs a browser).

## Prove it for real — Playwright MCP

- [ ] Overview in each of the eight languages, then the switcher to another language on `features/whatsapp-commands`; expected: the page keeps its path and the title is in the chosen language. Not run by the developer.

## Edge cases

- [ ] A language folder name that is a prefix of an English folder (`de` against `developers`) — input: `developers/errors`; expected: `languageOfPage` returns English.
- [ ] Two languages sharing the agent group name `AI` (ja, ko, zh) — input: a `docs.json` with all three; expected: each rewritten in its own entry.
