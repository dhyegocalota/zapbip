# Test plan: Copy quality

| Behaviour | Test |
| --- | --- |
| The quick-start title names the agent, or an AI app, in eight languages, keeps the word Prompt and never says paste | `apps/api/test/unit/start-prompt-title.test.ts` |
| Both titles stay within 32 characters (one line on 360 px) | same file |
| No literal tap or click translation in the docs, agent page sources or copy modules of any language | `apps/api/test/unit/copy-literal-translation-traps.test.ts` |
| Portuguese site copy keeps "você responde" | `apps/api/test/integration/site-polish.test.ts` |
| The agent page sources and the docs agree | `pnpm agents:check` |
