# Plan: locale everywhere

Every step is written for one developer; the steps are in the order they were built.

- [x] Command parser takes the account locale for list replies and exposes the words of one locale (`libs/core/src/accounts/command.ts`, `account-types.ts`, `use-cases/receive-account-message.ts`).
- [x] The language of a new owner is one function over the written text, the calling code and English (`libs/core/src/accounts/owner-locale.ts`, `use-cases/open-owner-account.ts`, `use-cases/types.ts`).
- [x] The inbound handler and both routes pass the written text (`apps/api/src/inbound/owner-inbound.ts`, `routes/whatsapp.ts`, `routes/dev-owner.ts`).
- [x] The start link without `lang` answers in English (`apps/api/src/routes/start-link-language.ts`).
- [x] The usage reply's name placeholders move into copy (`libs/core/src/accounts/account-copy.ts`, `use-cases/usage-reply.ts`).
- [x] Tests: unit order and scripts, parser locale, start link fallback, the reply copy scan, the integration of unknown numbers in Spanish, German and Japanese.
- [x] ADR 0065 and the index row; the feature row in the features index.

## Failure modes

| Step | What breaks | Signal | Back out |
|------|-------------|--------|----------|
| Written-text pick | An existing test sends a command word from a phone of another language and expects its calling-code language | `owner-inbound-languages` or `whatsapp-onboarding-replies` goes red | Remove the command-word branch of `ownerLocaleOf`; the rest of the order stands |
| Parser locale | A list reply gets the wrong reply language | `command.test.ts` list cases and `owner-inbound-languages` go red | Restore the account-locale override in `receive-account-message.ts` |
| Start link fallback | A bare link visitor expects Portuguese | `start-link-language.test.ts` | Restore the Portuguese fallback constant |
| Copy scan | A reply builder fails the scan on a legitimate literal | `reply-copy-literals.test.ts` names the file and line | Move the literal to copy or add the line to the throw or code exceptions of the scanner |
