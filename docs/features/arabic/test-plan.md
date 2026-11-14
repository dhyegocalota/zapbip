# Test plan: Arabic

## The failing test first

- [x] Adding `ar` to the enums made every parametrized test and typed record red until its Arabic row existed (`0f811682` onward)

## Unit

- [ ] `libs/core` and `apps/api` unit suites green with nine languages
- [ ] `tools/repository-shape` green: docs tables, agent registry, navigation

## E2E (Playwright specs)

- [ ] `apps/api/e2e/landing/landing-arabic.spec.ts` at 360 px and on desktop: `dir="rtl"`, no horizontal scroll, the menu and the quick-start window mirrored, `<pre>` left to right

## Prove it for real

- [ ] Open `/ar` and the app in Arabic: read every screen once
