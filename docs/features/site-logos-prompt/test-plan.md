# Test plan: Site logos and the one-line setup prompt

## The failing test first

- [ ] `apps/api/test/unit/site-logos.test.ts` — input: the registry stems; expected: every stem has a file, a dated source row and no forbidden mark
- [ ] `apps/api/test/integration/site-setup.test.ts` — input: GET `/setup.md`; expected: `404` before the route exists

## Unit

- [ ] Every agent with a mark has a file and a NOTICE row with an https source and a date
- [ ] No Grok or xAI file ships

## Integration

- [ ] The quick start shows one prompt per tab per language and the copy button targets it
- [ ] The manual section is a `<details>` without `open`
- [ ] `/setup.md` per language answers `text/markdown`, covers every agent and keeps the placeholder
- [ ] `llms.txt`, the Markdown twins, the agent card and `get_quick_start` link the setup URL

## Prove it for real — Playwright MCP

- [ ] Quick start at 1440 and 375 shows the prompt and the logos; the details opens and closes

## Edge cases found during execution

## Adversarial review
