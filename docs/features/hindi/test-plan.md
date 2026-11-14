# Test plan: Hindi

## The failing test first

- [x] `6b62ec9a`: the language list, `hi`, the Hindi command words, chandrabindu folding and the unknown-language reply failed before the enums existed
- [x] `a0650491`: templates, CSV header, list separator, start link text, sitemap, menu flag, security.txt and `hindi-copy.test.ts` failed before the web rows existed

## Unit

- [ ] `libs/types`, `libs/core`, `libs/agents` and `apps/api` unit suites green with ten languages
- [ ] `tools/repository-shape` green: docs tables, agent registry, navigation

## E2E (Playwright specs)

- [ ] `apps/api/e2e/landing/landing-hindi.spec.ts` at 360 px and on desktop: `lang="hi"`, `dir="ltr"`, no horizontal scroll, unspaced headings, Latin digits
- [ ] `apps/docs/e2e` in the `hi-IN` project against a Mintlify preview

## Prove it for real

- [ ] Open `/hi`, `/hi/terms`, `/hi/privacy` and the app in Hindi: read every screen once
- [ ] Send `भाषा बदलें hi`, `मदद`, `नया एजेंट test` to a development number and read the replies
