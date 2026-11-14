# Languages (WhatsApp)

**Status:** Shipped 2026-11-14
**Tier:** 🔴 structural
**Owner approval:** approved 2026-11-14 (owner delegated; the request is his word: "translate everything to Spanish, Chinese, German, French, Japanese and Korean", phase C of three)
**ADRs:** [0051](../../adr/0051-whatsapp-speaks-eight-languages-and-the-template-of-a-language-is-chosen-by-a-table.md), [0047](../../adr/0047-the-web-surfaces-speak-eight-languages-through-a-web-locale-while-whatsapp-copy-stays-in-two.md) (superseded in part)
**Not changing:** the Meta templates themselves (the owner submits them), the MCP tool names and schemas, the agent instructions inside install prompts, existing accounts' stored language

## Problem

zapbip answers on WhatsApp in English and Portuguese only. An owner in Tokyo, Munich or Madrid gets English replies, English install prompts and English docs for the commands.

## Goals

1. `OwnerLocale` has the eight languages and replaces `WebLocale`; every `Record<OwnerLocale, …>` in `libs/core`, `libs/agents` and `apps/api` is exhaustive.
2. A new owner's language comes from the calling code of the phone (explicit table, English the documented fallback); existing accounts keep theirs.
3. Every owner-facing string is in all eight languages with the same placeholders: inbox, wake, account replies, approval questions, install page and prompts, self-test text, start link, WhatsApp notices.
4. Each language has command words that collide with neither another language nor ordinary talk; English and Portuguese words keep working. A `language <code>` command changes the stored language.
5. Outside the 24-hour window the six new languages send the English template until their templates are approved; a table is the switch and the runbook lists the exact bodies to submit.
6. The six docs folders show the localized commands, replies and self-test; the start link carries the page language.

## Non-goals

Creating or submitting Meta templates. Translating the agent instructions in install prompts. Traditional Chinese. Changing the language of an existing account except by the owner's command.

## Design

### Data flow

`ownerLocaleOf({ waId })` picks the language when the account opens. `parseAccountCommand` returns the kind and the language of the word written; the handler answers in that language, `help` in the account language. `setOwnerLanguage` stores a new locale and answers in it. Replies, notices and prompts read their copy by `OwnerLocale`; the template language of a send is `OWNER_LOCALE_TO_LANGUAGE_CODE[locale]`.

### Interfaces

`OwnerLocale` (eight), `OWNER_LOCALE_BY_CALLING_CODE`, `ownerLocaleOf`, `ownerLanguageOfValue`, `CommandKind.SetLanguage`, `AccountReplyIntent.LanguageChanged` and `LanguageUnknown`, `AccountDirectory.setLocale`, `DOCS_OWNER_LOCALES`, `WhatsAppLanguageCode` (eight).

### Failure handling

An unknown calling code is English. An unknown language code answers with the list of codes and changes nothing. A language whose template is not approved sends the English template, so the owner is reached.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Belgium and Switzerland | French or German; English | French and German, the languages we have | 2026-11-14 |
| Localized words | add them; keep English and Portuguese only | add them, never colliding; old words keep working | 2026-11-14 |
| Templates | submit now; table with English until approved | table with English until approved | 2026-11-14 |

## Test strategy summary

Unit: calling-code table, language codes, command words (kinds, uniqueness, ordinary messages), the language command, copy exhaustiveness and placeholder parity per module, own-language command words inside replies, approval and install page copy, template tables and the runbook. Shape: docs pages hold the localized words, notices and self-test; `agents:check`. Integration: one owner per language through the inbound handler (onboarding reply, help, new agent, delete account, language command).
