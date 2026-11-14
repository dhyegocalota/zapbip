# Test plan: Copy review (complete)

| Behaviour | Test |
| --- | --- |
| `renovar <name>` rotates, `rotate` still works, no command word collides | `libs/core/src/accounts/command*.test.ts` |
| No Korean 합니다 forms, Spanish Spain-only words or Chinese 您 in the copy modules and docs | `apps/api/test/unit/copy-literal-translation-traps.test.ts` |
| Generated docs and page sources agree | `pnpm agents:check` |
