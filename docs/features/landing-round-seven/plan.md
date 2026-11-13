# Plan: Landing round seven

**Spec:** [spec.md](spec.md)
**Tier:** 🟡 medium
**Seam:** `apps/api/src/site`, `apps/api/src/index.ts` (the https redirect), `libs/types` (prices), docs pages that mention a number.

## File map

| Group | Paths owned |
|-------|-------------|
| G1 | `apps/api/src/site/**`, `apps/api/src/https-redirect.ts`, `apps/api/src/index.ts`, `libs/types/src/pricing.ts` and its export, `apps/api/test/**` for the site, `apps/api/e2e/landing/**`, the docs wording in `apps/docs/**` and `libs/agents/supported/*/page.*.mdx` that implies a customer number, this folder, `.claude/rules/site.md` |

`apps/api/src/client-app/**` belongs to another lane and is not touched.

## Steps

- [ ] **Step 1:** https redirect: red tests, then `https-redirect.ts` wired first in `index.ts`.
- [ ] **Step 2:** theme matrix e2e (the diagnosis) and the theme switch keeping path and query.
- [ ] **Step 3:** language paths: context, redirects, links, canonical, hreflang, sitemap.
- [ ] **Step 4:** the language disclosure and its flags.
- [ ] **Step 5:** prices: constants, formatter, pricing section, FAQ, meta.
- [ ] **Step 6:** own-number wording on the site and in the docs; the new FAQ.
- [ ] **Step 7:** calm reveals: stylesheet and script; the pins and scrubbing removed.
- [ ] **Step 8:** the walk updated for both locales, widths, themes and reduced motion; rule, tester briefing.

## Failure modes

| Step | What breaks | Signal | Back out |
|------|-------------|--------|----------|
| 1 | A redirect loop behind a proxy that terminates TLS | the production smoke gets `ERR_TOO_MANY_REDIRECTS` | the Worker sees the original scheme on Cloudflare; the development exemption keeps local runs plain |
| 3 | A locale loop between `/` and `/pt-br` | the redirect tests for each cookie and header | the cookie decides only on `/`; the path always wins elsewhere |
| 7 | Text hidden when the script fails | the no-script walk | the hidden state exists only under a script-set class |

**Steps with no backout:** none.
