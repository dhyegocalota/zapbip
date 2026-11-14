# Test plan: locale everywhere

Each row is a checkbox with the input and the exact expected outcome. Ticks carry the run that proved them.

## Unit: the language of a new owner (`libs/core/src/accounts/owner-locale.test.ts`)

- [x] `ok` from a German number (4915112345678) is German
- [x] `ayuda` from a US number (14155550100) is Spanish
- [x] `ayuda` from a German number is Spanish (text beats calling code)
- [x] the start link text of each of the ten languages from a US number is that language
- [x] the start link text followed by an invite code is that language
- [x] the help word of each language from a US number is that language
- [x] `menu` from a Spanish number (34612345678) is Spanish, and from a US number English, because English and Portuguese share it
- [x] `こんにちは` from a US number is Japanese; `안녕하세요` Korean; `مرحبا بك` Arabic; `नमस्ते` Hindi
- [x] `请帮助我` from a US number is English (Han without kana)
- [x] a Latin sentence without a command word from a German number is German
- [x] the empty, malformed and +-prefixed waIds, India (91) and Hong Kong (852) are English
- [x] `351` is Portuguese and `3999999999` English (longest calling code)

## Unit: the parser and the locale of a list reply (`command.test.ts`, `command-languages.test.ts`, `command-folding.test.ts`)

- [x] the prefilled text of each language is no command
- [x] each command word of each language parses to its kind and locale
- [x] a list reply takes the account locale it is given

## Unit: the start link without `lang` (`apps/api/test/unit/start-link-language.test.ts`)

- [x] an absent `lang` answers English
- [x] an unknown value still answers no locale

## Unit: copy only (`apps/api/test/unit/reply-copy-literals.test.ts`)

- [x] the scanner finds an inline sentence and ignores code, errors and interpolations
- [x] each of the eighteen WhatsApp reply builders has no inline prose literal

## Integration: an unknown number writes in its language (`apps/api/test/integration/owner-inbound-languages.test.ts`)

- [x] `ayuda` from a US number gets a Spanish account and the Spanish menu on the screen
- [x] `hilfe` from a US number gets a German account and the German menu
- [x] `ヘルプ` from a US number gets a Japanese account and the Japanese menu
- [x] an account created in Spanish from a US number keeps Spanish when a German help word arrives later

## Regression

- [x] every existing inbound, onboarding and command integration test stays green
- [ ] `pnpm verify` (scoped) green on the branch after merging origin/main
