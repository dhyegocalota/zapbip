# Test plan: Legal pages

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: `.

## The failing test first

- [x] `apps/api/test/integration/site-legal.test.ts` — input: `GET /terms`; expected `200`, `lang="en"`, the title and every section heading. — evidence: red with "Cannot find module ../../src/site/legal-links" before the module existed, green after.

## Integration

- [x] `/terms`, `/privacy`, `/pt-br/termos`, `/pt-br/privacidade` answer their document in their language, with the CNPJ, the legal name and a `mailto:` contact, and no unfilled placeholder. — evidence: `site-legal.test.ts`.
- [x] Canonical, hreflang (`en`, `pt-BR`, `x-default`) and `og:url` point at the page and its twin. — evidence: `site-legal.test.ts`.
- [x] `POST /locale` from a legal page lands on its twin; `POST /theme` returns to it with `#theme`; a legal path with a query is refused. — evidence: `site-legal.test.ts`.
- [x] No captcha, no poster preload, the join button leads to `<home>#join`, the skip link to `#content`. — evidence: `site-legal.test.ts`.
- [x] The footer of `/` and `/pt-br` links both documents; the waitlist note links the privacy policy; the sitemap lists the six pages with alternates. — evidence: `site-legal.test.ts`, `site-language.test.ts`.

## E2E (Playwright)

- [x] Each legal page at 1440 and 375: no horizontal scroll; the language menu leads to the twin. The home footer leads to the privacy policy. — evidence: `landing-legal.spec.ts`, 10 green.
