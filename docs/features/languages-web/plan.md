# Plan: Languages (web)

**Spec:** spec.md
**Tier:** 🟡
**Seam:** `WebLocale` in `libs/types`, consumed by `apps/api/src/{site,web-shell,client-app,backoffice}`
**Assumptions (decided, owner can override):**
- The six new languages show the English Open Graph image and demo until they are recorded.
- The documentation link of the new languages is the English documentation until phase B.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `libs/types/src`, `docs/adr/0047-*` | `developer` |
| G2 | `apps/api/src/{site,web-shell,client-app,backoffice}`, `apps/api/test`, `apps/api/e2e`, `apps/api/scripts/record-landing-demo.ts`, `.claude/rules` | `developer` |

## Sequencing

G1 first (the enum and the tables), then G2 tests red, then G2 code.

## Steps

### G1

- [x] **Step 1:** `WebLocale`, `WebLanguageTag`, path prefixes and the owner bridge in `libs/types`, with `web-locale.test.ts` (pin) and the pricing table (commit 74e43ac7)
- [x] **Step 2:** ADR 0047

### G2

- [x] **Step 3:** red unit and integration tests for the language paths, the sitemap, the copy rules, the legal copy and the profiles (commit 8210990b)
- [x] **Step 4:** type the web surfaces on `WebLocale`; paths, negotiation, legal links, profiles, flags, CJK fonts
- [x] **Step 5:** translate the shell, the site, the legal pages, the app and the backoffice into six languages
- [ ] **Step 6:** Playwright walks (`e2e/landing/landing-languages.spec.ts`, `e2e/client-app/web-shell.spec.ts`) and the screenshots under the scratchpad
- [x] **Step 7:** rules and READMEs that name the languages

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 4 | A cookie or form accepts a locale that has no page | `site-language.test.ts` integration, unknown value | restore the allow-list |
| 4 | The trailing-slash redirect catches a legal path | `site-legal.test.ts` | narrow the redirect to home paths |
| 5 | A placeholder is lost in translation | `placeholderMismatches` in the three copy tests | restore the placeholder |
| 5 | A banned phrase lands in a language | `site-copy.test.ts` | reword |
