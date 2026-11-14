# 0047. The web surfaces speak eight languages through a web locale, while the WhatsApp copy stays in two

- Status: Superseded by [0051](0051-whatsapp-speaks-eight-languages-and-the-template-of-a-language-is-chosen-by-a-table.md)
- Date: 2026-11-13
- Deciders: Dhyego Calota (owner, delegated 2026-11-13); Claude (advisor)
- Inspired by: the owner's order of 2026-11-13, "translate everything to Spanish, Chinese, German, French, Japanese and Korean"; [ADR 0041](0041-the-public-site-is-served-by-the-api-worker-through-host-dispatch.md) (the site is served by path); [ADR 0042](0042-the-customer-web-app-signs-in-with-a-one-time-link-sent-over-whatsapp.md) (the app and the owner's WhatsApp words); the web shell spec (languages are data)

## Context

`OwnerLocale` (`en_US`, `pt_BR`) is two things at once: the language of a page and the language of the owner's WhatsApp conversation. The second feeds the core: inbox, account, wake and install copy in `libs/core` and `libs/agents`, the `START_PREFILLED_TEXT` and `CLIENT_APP_LOGIN_TEXT` words the owner types, the command words the account parses. The order has three phases: A the site, the legal pages, the customer app, the Open Graph tags and the backoffice; B the documentation; C the WhatsApp product copy. Phase A must not force a translation of the core copy that phase C owns, and the compiler must still name every gap.

## Decision

1. **`WebLocale`.** A new enum in `libs/types` with eight values: `en_US`, `pt_BR`, `es`, `de`, `fr`, `ja`, `ko`, `zh_CN`. Every web surface (`apps/api/src/site`, `web-shell`, `client-app`, `backoffice`) is typed `Record<WebLocale, …>` or takes a `WebLocale`, so a ninth language is a type error until its profile, flag and copy exist. `OwnerLocale` keeps its two values and stays the language of WhatsApp, the core and the stored owner identity.
2. **One explicit bridge.** `OWNER_LOCALE_OF_WEB_LOCALE` maps each web language to the owner language it is served in on WhatsApp (Portuguese to Portuguese, the other seven to English) and `WEB_LOCALE_OF_OWNER_LOCALE` goes back. The login word, the invite text, the quick-start hints from `libs/agents` and the `account.locale` sent to the account inbox go through it. It is a table, never a `??`, and phase C replaces the English rows.
3. **Paths.** English keeps `/`, Portuguese `/pt-br`, and the others take `/es`, `/de`, `/fr`, `/ja`, `/ko` and `/zh` (`WEB_LOCALE_PATH_PREFIXES`, shared by the site and the app). The legal pages keep the Portuguese slugs (`/pt-br/termos`, `/pt-br/privacidade`) and give the other six the English slugs under their prefix (`/es/terms`, `/ja/privacy`). The path decides the language; `POST /locale` returns to the twin page.
4. **Negotiation.** `/` with no cookie reads `Accept-Language` with its q-values: the highest quality among the eight languages wins, `q=0` is refused, `zh` with `Hant`, `TW`, `HK` or `MO` is not Simplified and falls through to English. A cookie still wins.
5. **Tags.** `WebLanguageTag` carries the `lang` and `hreflang` value of each language (`zh-CN` for Chinese); `LOCALE_PROFILES` also holds the Open Graph locale, the Turnstile language, the short code and the native name. The Open Graph image and the demo media exist in English and Portuguese only: `ASSET_LOCALES` in `site-paths.ts` maps the other six to the English files explicitly, and the recorder owns the follow-up.
6. **Flags.** The menu keeps country flags drawn inline, one per language: United States, Brazil, Spain, Germany, France, Japan, South Korea and China. Spanish is also spoken far from Spain, so the short code `ES` stays next to the flag and the native name `Español` carries the language, not the country.
7. **Currency.** Every language other than Portuguese prices in dollars (`PRICING_CURRENCY_BY_LOCALE`), formatted by `Intl` in the language of the page.
8. **Fonts.** No web font. `shell.css` sets the CJK system stacks per `:lang()` and `word-break: keep-all` for Korean.
9. **Copy files.** Each copy module keeps its keys in `*-copy-keys.ts` and each new language in `*-copy-<language>.ts` (`site`, `client-app`, `backoffice`, `legal`), so no file grows past what one person reads. Placeholders are the same in every language and a test pins it.
10. **Documentation.** The documentation link of each language goes to its own folder (`docsPath`: `/pt-br`, `/es`, `/de`, `/fr`, `/ja`, `/ko`, `/zh`), the folders phase B ships ([ADR 0048](0048-the-docs-speak-eight-languages-one-folder-per-language-and-the-page-language-is-a-type-of-its-own.md)).

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Add the six languages to `OwnerLocale` | One enum | Forces real translations of every WhatsApp, install and command copy now; the stored owner identity and the account parser change in the same PR | That is phase C, and it would make a sensitive PR out of a web one |
| Keep `OwnerLocale` and map unknown web languages to English at each use | Smallest diff | Silent fallbacks, the exact trap the repository forbids | A missing translation must be a type error |
| A separate copy file per surface and language folder | Tidier tree | Moves every existing import | Re-export from the existing module keeps the diff small |
| Text badges instead of flags | No geography debate | Less scannable, drops the shell's look | The code and the native name already sit next to the flag |
| Localised legal slugs for every language | Natural URLs | Twelve more hand-written routes to keep in step | The English slug under the language prefix is predictable; Portuguese keeps its existing URLs |

## Consequences

- A visitor can browse the whole public site, the legal pages, the app and the backoffice in eight languages; WhatsApp replies and the docs follow in phases B and C.
- The waitlist stores the web language (`landing_waitlist.locale` is free text); the access invite text goes through the bridge.
- `libs/core` and `libs/agents` do not change.

## Evidence

`apps/api/test/unit/{site-language,robots-and-sitemap,client-app-paths,site-copy,client-app-copy,backoffice-copy,legal-copy,locale-profiles}.test.ts`, `apps/api/test/integration/{site-language,site-language-menu,site-legal}.test.ts` and `libs/types/src/web-locale.test.ts`.

## Revisit when

- Phase C adds WhatsApp copy in a language: the matching row of `OWNER_LOCALE_OF_WEB_LOCALE` changes.
- Open Graph images and demo videos are recorded for a language: its `ASSET_LOCALES` row changes.
