# Plan: Legal pages

**Spec:** [spec.md](spec.md)
**Tier:** 🟢 small
**Seam:** `apps/api/src/site`, `libs/types` (the session lifetime), the docs privacy page.

## File map

| Group | Paths owned |
|-------|-------------|
| G1 | `apps/api/src/site/**`, `apps/api/src/client-app/client-app-constants.ts` and `sessions.ts` (the moved constant), `libs/types/src/constants.ts`, `apps/api/test/integration/site-legal.test.ts`, `apps/api/test/integration/site-language.test.ts`, `apps/api/e2e/landing/landing-legal.spec.ts`, `apps/docs/help/privacy-and-security.mdx` and its `pt-br` twin, this folder, `.claude/rules/site.md` |

## Steps

- [x] **Step 1:** red integration test for the four pages, the twins, the forms, the links and the sitemap.
- [x] **Step 2:** `legal-links.ts`, `legal-copy.ts`, `views/legal-page.tsx`, the routes, the context locale, the return targets, the layout, the footer, the sitemap and the styles.
- [x] **Step 3:** the e2e walk at 1440 and 375, the docs links, the rule.
