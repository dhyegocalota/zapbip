# Test plan: Languages (WhatsApp)

## The failing test first

- [ ] `libs/core/src/accounts/owner-locale.test.ts` — input: `34612345678`, `8613812345678`, `85291234567`; expected before: the module does not exist
- [ ] `libs/core/src/accounts/command-languages.test.ts` — input: the eight languages; expected before: no words for six of them and a six-row menu
- [ ] `libs/core/src/accounts/use-cases/set-owner-language.test.ts` — input: `language ja`; expected before: no handler for `set_language`

## Unit

- [ ] Every copy record of `libs/core` holds the eight languages with the same placeholders
- [ ] Every reply names the commands of its own language
- [ ] The approval buttons and the quick reply fit their WhatsApp limits in every language
- [ ] The template bodies, quick replies and the runbook agree for all eight languages
- [ ] The start link maps every docs language to its locale

## Integration

- [ ] One owner per language: the onboarding reply, `help`, a new agent and the delete command in that language
- [ ] `language <code>` stores the language and the next reply uses it
- [ ] A phone with an unknown calling code is answered in English

## E2E and walks

- [ ] The docs gate: `mint broken-links` and the docs walk with the localized commands page and the start link of each language
- [ ] The customer app sign-in shows the login word of each language

## Edge cases

- [ ] `menu` is the only text shared by two languages
- [ ] `ログインできません` and `请帮助我` are ordinary messages
- [ ] `+34…` with a leading plus is English, not Spanish (the id has digits only)
- [ ] An owner who types `language xx` keeps the stored language
