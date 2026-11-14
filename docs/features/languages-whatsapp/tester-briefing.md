# Tester briefing: Languages (WhatsApp)

## What changed

- `libs/types/src/{enums,constants}.ts` — `OwnerLocale` of eight, calling-code table, tables per language, `SetLanguage` and its intents; `WebLocale` and the bridges are gone
- `libs/core/src/accounts/{owner-locale,command-words}.ts`, `use-cases/set-owner-language.ts` — language by calling code, words per language, the language command
- `libs/core/src` copy modules — six languages for inbox, wake, account, approval, usage and install page copy
- `libs/agents` — install copy of the ten agents and the fixtures, self-test texts per language
- `apps/api/src/adapters/whatsapp/whatsapp-{copy,templates,enums}.ts`, `routes/start-link-{copy,language}.ts`, `adapters/d1/d1-account-directory.ts` — copy, template table, the locale update
- `apps/docs/{es,de,fr,ja,ko,zh}`, `libs/agents/**/page.<language>.mdx`, `docs/runbooks/meta-setup.md` — docs and runbook

## How to run

```bash
pnpm --filter @zapbip/core test:unit
pnpm --filter @zapbip/api test:unit
pnpm --filter @zapbip/repository-shape exec vitest run
pnpm agents:check
pnpm --filter @zapbip/api test:integration
```

## Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `owner-locale.test.ts` | `Cannot find module './owner-locale'` | the table and the longest-code rule exist |
| `command-languages.test.ts` | a six-row menu and no `set_language` words | seven rows, words per language |
| `set-owner-language.test.ts` | `COMMAND_HANDLERS[command.kind] is not a function` | the handler stores and answers |

## Hypotheses to attack

1. Hypothesis: no ordinary message is a command. Break it by: send each language's `ok`, `yes`, `thanks`, a greeting, a short sentence that starts with a command word.
2. Hypothesis: the reply is in the language of the word. Break it by: send `help`, `ayuda`, `新規エージェント claude` from one phone.
3. Hypothesis: nothing reaches Meta in a language without an approved template. Break it by: close the window for a Japanese owner and read the template name and language of the send.
4. Hypothesis: an existing account keeps its language. Break it by: reopen an account stored as `pt_BR` from a `+34` number.
5. Hypothesis: the docs pages quote the real words. Break it by: copy a command from the Korean commands page and send it.

## Known gaps

- Translations are not reviewed by native speakers.
- The six new languages receive the English template outside the 24-hour window until Meta approves theirs.
- The agent instructions inside install prompts stay in English.
- Some chat examples in the docs of the six languages still show the English wording of other replies.
- The integration run and the docs walk were not run when this briefing was written.
