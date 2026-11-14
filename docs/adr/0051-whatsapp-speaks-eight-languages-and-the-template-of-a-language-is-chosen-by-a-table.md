# 0051. WhatsApp speaks eight languages, and the template of a language is chosen by a table

- Status: Accepted
- Date: 2026-11-14
- Deciders: Dhyego Calota (owner, delegated 2026-11-14); Claude (advisor)
- Inspired by: the owner's order of 2026-11-13, "translate everything to Spanish, Chinese, German, French, Japanese and Korean", phase C; [ADR 0047](0047-the-web-surfaces-speak-eight-languages-through-a-web-locale-while-whatsapp-copy-stays-in-two.md) (the web locale and its bridge); [ADR 0048](0048-the-docs-speak-eight-languages-one-folder-per-language-and-the-page-language-is-a-type-of-its-own.md) (the docs languages); [ADR 0015](0015-commands-are-bare-words-routed-before-agents.md) (bare-word commands)

## Context

Phases A and B put the site, the app, the backoffice and the documentation in eight languages, with `WebLocale` for the web and `OwnerLocale` (English, Portuguese) for everything WhatsApp says. Phase C translates what zapbip says on WhatsApp: the inbox, wake and account replies, the approval questions, the install prompts and page, the self-test text, the start link, and the commands an owner types. Meta also requires an approved template per language for messages outside the 24-hour window, and templates are the owner's Meta account, not code.

## Decision

1. **One enum.** `OwnerLocale` grows to eight values (`en_US`, `pt_BR`, `es`, `de`, `fr`, `ja`, `ko`, `zh_CN`) and absorbs `WebLocale`. The bridge tables `OWNER_LOCALE_OF_WEB_LOCALE` and `WEB_LOCALE_OF_OWNER_LOCALE` and the `DocsLanguage` start-link language are gone; `DocsPageLanguage` is the language of a docs page and of `/start?lang=`, and `DOCS_OWNER_LOCALES` maps it to its locale. This supersedes the "two enums" part of ADR 0047; its paths, flags, currency and fonts stand.
2. **A new owner's language comes from the calling code.** `OWNER_LOCALE_BY_CALLING_CODE` is an explicit table (55 and 351 Portuguese; 34, 52, 54, 56, 57, 58, 51, 53, 591, 593, 595, 598 and the Central American codes Spanish; 49, 43, 41, 423 German; 33, 32, 352, 377 French; 81 Japanese; 82 Korean; 86 Simplified Chinese) and the longest code wins. Belgium is French because French is the language we have, and Switzerland German for the same reason. Hong Kong, Macau and Taiwan are Traditional Chinese, which we do not have, so they and every other code are English: the one documented fallback. Existing accounts keep their locale. The start link `?lang=` only chooses the language of the prefilled message.
3. **A language command.** `CommandKind.SetLanguage` (`language <code>`, `idioma`, `cambiar idioma`, `sprache`, `langue`, `言語`, `언어`, `语言`) stores the owner's choice through `AccountDirectory.setLocale` and answers in the new language; an unknown code lists the eight codes. It is in the menu, which grows to seven rows.
4. **Command words.** Each language has its own words and the English and Portuguese words keep working for everyone. The reply is in the language of the word the owner wrote, as before, and `help` answers in the account language. A word belongs to one language and one kind, so the reply language is never ambiguous: Spanish uses `mis agentes` and `acceder` because `agentes` and `entrar` are Portuguese, French uses `mes agents` because `agents` is English. `menu` is the single shared word. A test pins that no text has two kinds and that none of 30 ordinary messages in the eight languages parses as a command. The CJK takes-a-name commands need the space (`無効化 helper`), like every other language. The words and the placeholders of each language are in `command-words.ts` and `usage-reply.ts`.
5. **Self-test text.** One text per language that no other language contains (`✅ listo`, not `✅ instalado`), because the guide-parity check proves a page holds only its own.
6. **Templates by table.** `OWNER_LOCALE_TO_LANGUAGE_CODE` says which template language a locale sends. The six new languages send the English template until their templates are approved in WhatsApp Manager; the bodies and quick replies of all eight languages are in code and in the Meta runbook (step 12), and a test proves the runbook holds each. Flipping a row to the language's own `WhatsAppLanguageCode` is the whole switch, and the number check in the backoffice then asks for that language too. Nothing here creates or submits a template.
7. **Docs.** The six docs folders show the localized words, the localized replies and the localized self-test; the commands page lists every word of the language, and `/start?lang=` carries the page's language.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Keep `WebLocale` beside the grown `OwnerLocale` | No rename | Two enums with the same eight values and an identity bridge | The bridge no longer bridged anything |
| Detect the language from the first message text | Follows what the person writes | Needs a language detector, breaks on `ok` and emoji | The calling code is a table and a person can switch |
| Localized words only, no English or Portuguese | Cleaner | Breaks every existing owner and every doc that taught `new agent` | The old words stay valid for everyone |
| Extend `WhatsAppLanguageCode` and send the owner's language at once | Native templates now | Meta refuses the send until approval and the owner receives nothing | The table makes approval the switch |
| One shared self-test text | One string | The parity check cannot tell the guides apart | Each language gets its own |

## Consequences

- An owner in Tokyo gets Japanese replies from the first message, a Japanese install prompt and docs in Japanese; one in Hong Kong gets English and can send `language zh`.
- Outside the 24-hour window the six new languages still receive English until the owner approves their templates.
- The agent instructions inside install prompts stay in English; only what the agent says to the owner is localized.
- `libs/core`, `libs/agents` and `apps/api` carry six more entries in every locale record; the compiler lists any gap.

## Evidence

`libs/core/src/accounts/{owner-locale,command-languages}.test.ts`, `libs/core/src/accounts/use-cases/set-owner-language.test.ts`, `libs/core/src/copy-languages.test.ts`, `apps/api/test/unit/{whatsapp-templates,start-link-language}.test.ts`, `tools/repository-shape/src/{account-docs,docs-notices}.test.ts` and `pnpm agents:check`.

## Revisit when

- Meta approves the templates of a language: flip its row and say so in the runbook.
- Traditional Chinese or another language joins: one enum value, one calling-code row, and every record fails to compile until it has copy.
- An owner reports a command word that collides with ordinary talk in their language.
