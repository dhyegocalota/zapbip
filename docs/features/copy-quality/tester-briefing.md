# Tester briefing: Copy quality

## What changed

- `apps/api/src/site/site-copy*.ts` — quick-start titles; reply wording in six languages and pt-BR
- `apps/api/src/site/legal-copy*.ts` — one sentence per language, wording only
- `apps/api/src/backoffice/backoffice-copy*.ts` — the access-result line
- `apps/docs/**`, `libs/agents/supported/**/page.*.mdx` — reply wording in seven folders

## How to run

```bash
pnpm --filter @zapbip/api exec vitest run test/unit/start-prompt-title.test.ts test/unit/copy-literal-translation-traps.test.ts
pnpm agents:check
pnpm --filter @zapbip/repository-shape exec vitest run
```

## Look for

Open the home page in each language: the window title reads "Prompt in …" and sits on one line at 360 px; "How it works" and the demo speak of replying, not tapping.
