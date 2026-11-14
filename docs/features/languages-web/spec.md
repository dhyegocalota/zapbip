# Languages (web)

**Status:** Shipped 2026-11-13
**Tier:** 🟡 medium
**Owner approval:** approved 2026-11-13 (owner delegated; the request is his word: "translate everything to Spanish, Chinese, German, French, Japanese and Korean", phase A of three)
**ADRs:** [0047](../../adr/0047-the-web-surfaces-speak-eight-languages-through-a-web-locale-while-whatsapp-copy-stays-in-two.md)
**Not changing:** the WhatsApp product copy, the install pages, the command words, `OwnerLocale`, the documentation site, the Open Graph images and demo videos

## Problem

The public site, the legal pages, the customer app and the backoffice speak English and Portuguese only. The owner wants six more languages: Spanish, German, French, Japanese, Korean and Simplified Chinese.

## Goals

1. A `WebLocale` of eight languages; every web surface is typed on it, so a missing translation is a compile error.
2. Eight home pages (`/`, `/pt-br`, `/es`, `/de`, `/fr`, `/ja`, `/ko`, `/zh`) and sixteen legal pages (Portuguese slugs kept, the others `/<prefix>/terms` and `/<prefix>/privacy`), each with its own `lang`, canonical, hreflang set of eight plus `x-default`, Open Graph locale and sitemap entry.
3. `/` with no cookie follows `Accept-Language` with q-values across the eight languages; Traditional Chinese falls to English.
4. The customer app serves every language under the same prefixes and the backoffice offers every language through the shared menu.
5. Every language in the menu has a flag, a short code and its native name. CJK pages render in system fonts chosen per language.
6. Native-quality copy, not literal: French non-breaking spaces before `: ; ? !`, no space between Chinese or Japanese characters, product and agent names untranslated, Portuguese prevails in the legal pages.
7. The rules that held before hold in every language: no own number offered, no "official number", the WhatsApp command stays `login` or `delete account`.

## Non-goals

WhatsApp replies, templates and install pages (phase C). Documentation (phase B). New Open Graph images and demo videos: the six new languages show the English files through `ASSET_LOCALES` until the recorder produces them. Right-to-left languages.

## Design

### Data flow

`site-language.ts` maps a path or an `Accept-Language` header to a `WebLocale`; `site-context` sets it on the request; every view reads `copyOf({ locale })`. The app takes the locale from the path prefix. Where a web locale feeds the core (login word, invite text, quick-start hints, the account inbox command) it crosses `OWNER_LOCALE_OF_WEB_LOCALE`.

### Interfaces

- `libs/types`: `WebLocale`, `WebLanguageTag`, `WEB_LOCALE_PATH_PREFIXES`, `OWNER_LOCALE_OF_WEB_LOCALE`, `WEB_LOCALE_OF_OWNER_LOCALE`, `PRICING_CURRENCY_BY_LOCALE` per web locale.
- `apps/api/src/*/…-copy-keys.ts` hold the enums; `…-copy-<language>.ts` hold a language; the existing `…-copy.ts` keeps English, Portuguese and the lookup and re-exports the enum.
- `LOCALE_PROFILES` gains `openGraphLocale` and `turnstileLanguage`; flags are a record keyed by locale.

### Failure handling

An unknown locale in a cookie or a form is ignored as before. A language with no profile, flag or copy does not compile. A language without recorded media shows the English asset by an explicit table.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| `OwnerLocale` or a new web locale | grow `OwnerLocale`; add `WebLocale` | decided by the developer under the delegation, ADR 0047 | 2026-11-13 |
| Legal slugs | localised; English under the prefix | English under the prefix, Portuguese kept | 2026-11-13 |
| Flags or code badges | country flags; text badges | country flags with the code and the native name next to them | 2026-11-13 |

## Test strategy summary

Unit: every copy module is exhaustive for the eight languages, with the same placeholders, no blank text, nothing left in English except named cognates, French spacing and CJK spacing. Language paths, Accept-Language q-values, sitemap, client app paths and locale profiles. Integration: each language path answers 200 with its `lang`, hreflang set and Open Graph locale; legal twins; the menu lists eight languages. Playwright: the menu switches to each language at 1440 and 375; screenshots of the Japanese, Chinese, Korean and German heroes at 375.
