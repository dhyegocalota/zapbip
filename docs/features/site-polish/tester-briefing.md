# Tester briefing: Site polish

## What changed and where

`apps/api/src/site`: `views/site-layout.tsx` (header, footer, wordmark), `views/thanks-panel.tsx` and `views/referral-thanks-panel.tsx`, `views/join-block.tsx`, `views/final-call.tsx`, `views/faq-section.tsx`, `views/quick-start-section.tsx`, `site-constants.ts`, `site-copy.ts`, `code-tokens.ts`, `assets/site.css`. `libs/types/src/constants.ts`: contact email. Docs snippets and feature docs carry the new address.

## How to run

- `pnpm --filter @zapbip/api exec vitest run --config vitest.integration.config.mts test/integration/site-`
- `pnpm --filter @zapbip/api exec vitest run --config vitest.unit.config.mts test/unit/code-tokens.test.ts`
- `pnpm --filter @zapbip/api exec playwright test --config playwright.landing.config.ts`

## Red today, green after

| Test | Red failure text |
|---|---|
| `site-polish.test.ts` header has no menu | `expected '<div class="container"><a class="bran…' not to contain 'lang-menu'` |
| `site-polish.test.ts` footer opens upward | `expected ':root {…' to match /\.site-footer \.lang-list …/` |
| `site-polish.test.ts` footer groups | `expected '<div class="container"><div class="fo…' to contain 'Product'` |
| `code-tokens.test.ts` url token | `expected [ 'plain', …(1) ] to deeply equal [ 'url', …(1) ]` |

## Hypotheses for the tester

- The language menu works from the footer by mouse, keyboard and with no script, and returns to the legal twin on legal pages.
- The wordmark never scrolls the page at any width from 320 to 1920.
- Copy on the quick start copies the example link exactly as shown.
- No page, in either language, offers a referral link while `REFERRAL_SHARING_OPEN` is false.

## Gaps

- The demo videos and OG images were recorded with the old "Get started free" tagline text in `scripts/record-landing-demo.ts`; they are not re-recorded here.
- The wordmark gradient was judged by screenshots only (`dev/site-polish/`).
