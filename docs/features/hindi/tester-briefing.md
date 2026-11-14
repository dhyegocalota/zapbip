# Tester briefing: Hindi

## What changed and where

- `libs/types`: `OwnerLocale.Hindi`, `WebLanguageTag.Hindi`, `DocsPageLanguage.Hindi` (`hi`) and every record over them; the self-test text `✅ इंस्टॉल हो गया`, the login word `लॉगिन`, the start prefilled text. India (91) has no calling-code row.
- `libs/core`: Hindi account, inbox, wake, approval and install-page copy; the Hindi command words (`नया एजेंट`, `मेरे एजेंट`, `एजेंट हटाएँ`, `लिंक बदलें`, `मदद`/`मेनू`, `लॉगिन`, `अकाउंट डिलीट करें`, `अकाउंट हमेशा के लिए डिलीट करें`, `भाषा बदलें`); `hi` in the language command; chandrabindu folded to anusvara; every unknown-language reply lists `hi`.
- `libs/agents`: install copy, quick starts, matrix, headings, wake labels, listen tokens, docs groups, `page.hi.mdx` for every agent and fixture, `install.hi.md` snapshots; generated `apps/docs/hi/agents` and `snippets/hi/agents/matrix.mdx`.
- `apps/api`: Hindi locale profile (`hi`, `hi_IN`, हिन्दी), India flag, Devanagari font stack without letter spacing, site, legal (formal), client app, backoffice, shell, start link, WhatsApp copy, templates (sent in English until approved), waitlist CSV header, demo terminal copy, demo video, posters and card.
- `apps/docs`: every page under `hi/`, Hindi snippets, `how-it-works-hi.svg`, the `hi` navigation and 404 text, the e2e tables; the Arabic commands page lists `hi` and the Arabic web app page counts ten languages.
- Docs: ADR 0057, glossary Hindi section, Meta runbook rows, `AGENTS.md`, `.claude/rules/{site,client-app,backoffice}.md`, `mintlify-publish.md` step 10.

## How to run

- `pnpm --filter @zapbip/core exec vitest run`, `pnpm --filter @zapbip/types exec vitest run`, `pnpm --filter @zapbip/agents exec vitest run`
- `pnpm --filter @zapbip/api exec vitest run test/unit --maxWorkers=2` and the integration config for `test/integration/site-*`, `install-page*`, `start-link*`, `client-app*`
- `pnpm --filter @zapbip/repository-shape exec vitest run`
- `pnpm --filter @zapbip/api exec playwright test --config playwright.landing.config.ts e2e/landing/landing-hindi.spec.ts`
- `pnpm agents:check`

## Red before, green after

| Commit | Test | Red text recorded |
|---|---|---|
| `6b62ec9a` | `docs-page-language.test.ts` | `there are ten, English first, with the Mintlify codes` failed (no `hi`) |
| `6b62ec9a` | `owner-locale.test.ts` | `reads "hi" as undefined` |
| `6b62ec9a` | `command-folding.test.ts` | `expected 'एजेंट हटाएँ' to be 'एजेंट हटाएं'` and every Hindi command `as undefined` |
| `6b62ec9a` | `account-copy.test.ts` | `expected [ 'hi' ] to deeply equal []` in every locale |
| `a0650491` | `whatsapp-templates`, `waitlist-csv`, `site-agents`, `hindi-copy` | 15 failed: missing `hi` rows and Hindi copy |
| pin | `owner-locale.test.ts` +91 English, the ordinary Hindi chat lines, `landing-hindi.spec.ts` | green when they landed |

## Hypotheses for the tester

- A new owner from +91 gets English; `भाषा बदलें hi` and `language hi` switch to Hindi and the reply is in Hindi.
- `एजेंट हटाएं claude` (anusvara) revokes like `एजेंट हटाएँ claude`; `मदद चाहिए`, `नया लिंक भेजो` and `मेरे एजेंट कहाँ हैं?` reach the agents as ordinary messages.
- `/hi` reads left to right, never scrolls sideways at 360 px, shows Latin digits and Devanagari in a system font; the language menu shows ten entries with the India flag.
- The Hindi meta title and description stay within the SEO budget; `/hi/terms` and `/hi/privacy` read formally.
- The demo video, posters and card show Hindi text in the terminal and the phone.
- The docs at `/hi` mirror every English page; the switcher label for `hi` is "Hindi".

## Known gaps

- The docs Playwright suite (`apps/docs/e2e`) was not run: it needs a Mintlify preview; its Hindi rows are filled.
- The Mintlify switcher name `Hindi` comes from the cached Mintlify client, not a live preview.
- The Hindi Meta templates are submitted by the checklist but not approved; `hi` sends English until its row is flipped.
- The copy is native-quality to the best of the developer's reading; no native Hindi reviewer has read it yet.
