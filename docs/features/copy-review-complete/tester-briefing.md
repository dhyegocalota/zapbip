# Tester briefing: Copy review (complete)

## What changed

- `libs/core/src/accounts/command-words.ts`, `account-copy.ts` — the pt-BR rotate word
- Korean copy and docs in 해요체; Spanish docs and copy in neutral Latin American
- `docs/features/copy-quality/review.md` — the before and after of every fix

## How to run

```bash
pnpm --filter @zapbip/api exec vitest run test/unit/copy-literal-translation-traps.test.ts
pnpm --filter @zapbip/core test:unit
pnpm agents:check
```
