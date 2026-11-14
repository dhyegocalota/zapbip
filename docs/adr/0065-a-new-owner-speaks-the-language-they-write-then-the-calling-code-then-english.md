# 0065. A new owner's language is the language they write in, then the calling code, then English

- Status: Accepted
- Date: 2026-11-14
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: the owner's words of 2026-11-14 ("every experience, including when the person has no account, must follow the customer's i18n language, even on WhatsApp; I don't want anything hardcoded"); [ADR 0051](0051-whatsapp-speaks-eight-languages-and-the-template-of-a-language-is-chosen-by-a-table.md) (decision 2, the calling-code table, partly superseded here); [ADR 0057](0057-hindi-is-the-tenth-language-and-india-keeps-english-for-a-new-owner.md) (India keeps English); [ADR 0015](0015-commands-are-bare-words-routed-before-agents.md) (command words)

## Context

ADR 0051 chose a new owner's language from the calling code of the number the first message came from. A person writing from a US number in Spanish, or a German writing from a number they bought abroad, got English replies from the first message, although the words they typed already said their language. A number with no account also met two defaults that were not the rule: the start link without a `lang` parameter answered in Portuguese, and the closed-number refusal read only the calling code.

The language of a text is cheap to read where the product already knows it: every language has command words (`ayuda`, `hilfe`, `ヘルプ`) and a start link text, and a few scripts name their language on their own (Hangul, kana, Arabic, Devanagari). Latin text without a command word is not reliably any one language, so it must not decide.

## Decision

1. **One function picks the language of a new owner.** `ownerLocaleOf({ waId, writtenText })` in `libs/core/src/accounts/owner-locale.ts` is the only place. It answers, in this order, and stops at the first answer:
   1. the **written text**: the start link text of a language (also when followed by the invite code), then a command word that belongs to exactly one language (`commandWordLocaleOf`; a word two languages share, such as `menu`, does not count), then the script of the text (Hangul, kana, Arabic, Devanagari; Han without kana does not count, because Japanese writes Han too);
   2. the **calling code**, the table `OWNER_LOCALE_BY_CALLING_CODE` of ADR 0051 and ADR 0057;
   3. **English**, the one documented fallback.
2. **Every number with no account uses it.** The first message of a new owner, a message on a closed number, and the start link without a `lang` parameter (English, not Portuguese) all follow the same rule. An existing account keeps the language it has.
3. **A command's reply language is the account's.** A list reply has no words to read, so it takes the account locale; the parser no longer carries a default language.
4. **Copy stays in copy files.** The name placeholders of the usage reply live in `account-copy.ts`; a repository test (`apps/api/test/unit/reply-copy-literals.test.ts`) fails when a WhatsApp reply builder writes prose inline instead of copy.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Keep the calling code only | One table, no guessing | A Spanish speaker on a US number gets English from the first message | The text is the person's own statement of language |
| A statistical language detector | Covers Latin text such as "hola" and "hallo" | A dependency and a model in the Worker; wrong on short text such as `ok`, which the ADR 0051 detector rejection already noted | Not cheap, and not reliable on the short messages owners send |
| Detect Latin greetings with a word list | Covers `hola`, `hallo`, `bonjour` | Collides with ordinary talk (`hi` is an English word and a Hindi code); needs its own collision tests per language | Command words already give a reliable word list; greetings can follow if owners ask |
| Put Han-only text in Chinese | Covers Chinese owners who write without kana | Japanese kanji-only text becomes Chinese | Wrong language is worse than English |
| Keep the Portuguese start link default | Matches the first owners | A visitor without `lang` who is not Brazilian gets Portuguese | The fallback for a person with no language is English, as everywhere else |

## Consequences

- An owner who writes a command word or a start link text in a language gets that language from the first message, whatever the number.
- Latin-script text without a command word still follows the calling code, then English. Owners who write `hola` from a US number get English until they send a command word or `language es`.
- Devanagari text answers in Hindi, which also covers Marathi and Nepali writers until those languages have their own rows.
- The start link without `lang` answers in English; the site always sends `lang`, so only a bare link changes.

## Evidence

`libs/core/src/accounts/owner-locale.test.ts` (the order, the shared word, the scripts), `libs/core/src/accounts/command.test.ts` and `command-languages.test.ts` (the parser takes the account locale for list replies), `apps/api/test/integration/owner-inbound-languages.test.ts` (an unknown number writing `ayuda`, `hilfe` and `ヘルプ` gets the reply in that language), `apps/api/test/unit/start-link-language.test.ts`, `apps/api/test/unit/reply-copy-literals.test.ts`.

## Revisit when

- Owners write Latin greetings in their language from numbers of another country and ask for the greeting to count.
- A language shares its command words or start link text with another language.
- Traditional Chinese joins: Han-only text then needs a rule of its own.
