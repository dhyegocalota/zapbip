# Tester briefing: Languages (web)

## What changed

- `libs/types/src/{enums,constants}.ts` — `WebLocale`, `WebLanguageTag`, path prefixes, the owner bridge, currency per web locale
- `apps/api/src/site/site-language.ts`, `legal-links.ts`, `language-redirects.ts`, `site-app.ts` — eight paths, q-value negotiation, legal twins, trailing-slash redirect
- `apps/api/src/{site,client-app,backoffice}/*-copy-<language>.ts` and `*-copy-keys.ts` — six new languages for each copy module, and `legal-copy-<language>.ts` for the two documents
- `apps/api/src/web-shell/{locale-profiles,flags,shell-copy}` and `assets/shell.css` — profiles, eight inline flags, CJK stacks
- `apps/api/src/client-app/client-app-paths.ts`, `client-app.ts` — the prefixes of the app
- `apps/api/src/site/site-paths.ts` — `ASSET_LOCALES`, the English media for the six new languages

## How to run

```bash
pnpm --filter @zapbip/api test:unit
pnpm --filter @zapbip/api test:integration
pnpm --filter @zapbip/api test:landing
pnpm --filter @zapbip/api test:client-app
```

## Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `site-language.test.ts` (unit) | `Cannot read properties of undefined (reading 'languageTag')`, `expected undefined to be '/es'` | the eight paths and the q-value reader exist |
| `robots-and-sitemap.test.ts` | six locations | twenty-four |
| `client-app-paths.test.ts` | every prefix read as English | the prefixes are read |
| the five copy tests | `Cannot read properties of undefined (reading 'skip_to_content')` | six languages added |

## Hypotheses to attack

1. Hypothesis: every language page is complete. Break it by: open each at 375 and look for English strings, clipped text or tofu glyphs.
2. Hypothesis: French typography is right. Break it by: search the French pages for a plain space before `: ; ? !`.
3. Hypothesis: the Chinese Accept-Language reading is safe. Break it by: send `zh-TW`, `zh-HK`, `zh-Hant-CN` and `zh-Hans-SG`.
4. Hypothesis: an unknown locale cookie is ignored. Break it by: send `__Host-zb_site_locale=zh-CN` and `=xx`.
5. Hypothesis: the app keeps the WhatsApp word in English or Portuguese. Break it by: read the sign-in link on `/ja`.

## Known gaps

- The Open Graph image, the demo video and the poster of the six new languages are the English files.
- The documentation link of the six new languages is the English documentation.
- The WhatsApp replies in the six languages are English until phase C.
- Translations are written by the developer, not reviewed by native speakers.

## After merging the agentic lanes

- The Markdown twins, `llms.txt` and `llms-full.txt` per language path, the `/api/*` answers, the request-access `language` field and the well-known documents follow `WebLocale`: `site-agentic-languages.test.ts` pins the six new languages (green when it landed, since those modules iterate the enum).
- 44 keys added by the agentic lanes (the agents section, the agent keys page, the audit agent-key column, the access and waitlist source columns) are translated into the six languages.
- `localeOfLanguageValue` now accepts every `WebLocale` value and language tag, so `?lang=ja` and `"language": "ja"` work.
- `docsPath` of the six new languages stays the English documentation until `feat/languages-docs` is merged.
