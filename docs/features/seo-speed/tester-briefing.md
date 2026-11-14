# Tester briefing: SEO, GEO and speed

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

- `apps/api/src/site/page-meta.ts` — title, description and Open Graph title of a page; the legal pages get their own `og:title`.
- `apps/api/src/site/structured-data.ts` — the JSON-LD graph and its serializer; rendered by `views/site-layout.tsx` on every indexable page.
- `apps/api/src/site/about-facts.ts` and the six `SiteCopyKey.About*` keys in eight languages — the "About zapbip" block of `llms.txt`, `llms-full.txt` (through the home twin) and the home twin.
- `apps/api/src/site/robots-and-sitemap.ts` — `lastmod` per URL (`SITE_UPDATED_ON`, `LEGAL_UPDATED_ON`).
- The `MetaDescription` of es, de, fr and ja shortened to 160 weighted characters.
- `apps/api/scripts/render-open-graph-images.ts`, `scripts/landing-demo/open-graph-image.ts`, `open-graph-copy.ts`, and six new `og-<locale>.png`; `siteAssetOf` maps the Open Graph image to the page language.
- `apps/api/site-public/_headers` — cache for `/site/*`.
- `apps/api/src/site/site-scripts.ts` and `views/site-layout.tsx` — Turnstile injected on focus, pointer, touch or submit.
- `apps/api/scripts/lighthouse-budget.ts` — runs `npx lighthouse` per URL and form factor, names every breached budget.

## How to run

```bash
cd apps/api
pnpm exec vitest run --config vitest.unit.config.mts
pnpm exec vitest run --config vitest.integration.config.mts --maxWorkers=2 test/integration/site-seo.test.ts test/integration/site-weight.test.ts test/integration/site-page.test.ts
pnpm exec playwright test --config playwright.landing.config.ts landing-performance landing-seo
pnpm exec tsx scripts/lighthouse-budget.ts <site url> <app url>
pnpm exec tsx scripts/render-open-graph-images.ts
```

## Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `test/unit/site-seo-budget.test.ts` | `pageMetaOf is not implemented` | `page-meta.ts`; the long descriptions were shortened |
| `test/unit/structured-data.test.ts` | `structuredDataOf is not implemented` | `structured-data.ts` |
| `test/unit/site-about-facts.test.ts` | `aboutFactsOf is not implemented` | `about-facts.ts`, llms and twin |
| `test/unit/robots-and-sitemap.test.ts` (lastmod) | no `<lastmod>` in the sitemap | `lastmod` per entry |
| `test/unit/site-assets.test.ts` (social image, `_headers`) | `siteAssetOf` returned the English image; `og-es.png` and `_headers` missing | per-language map, six images, `_headers` |
| `test/unit/lighthouse-budget.test.ts` | `summaryOf is not implemented` | `lighthouse-budget.ts` |
| `test/integration/site-seo.test.ts` | stubs throw, no JSON-LD, no robots meta | the layout renders them |

Pins (green when they landed, written beside the change): `test/integration/site-weight.test.ts`, the lazy Turnstile test in `site-page.test.ts`, the CLS, Turnstile and JSON-LD specs in `e2e/landing`. The "refuses a report without the performance score" test was green against the stub.

## Hypotheses to attack

1. Hypothesis: the join form still submits in a real browser with the Turnstile script injected late. Break it by: type an email with the network throttled, submit before the widget finishes, expect the captcha notice and a working second submit.
2. Hypothesis: the JSON-LD block raises no CSP error. Break it by: open the home page in Chromium with the console open, in every language.
3. Hypothesis: the FAQ text in the JSON-LD equals the visible text. Break it by: compare the two in one language with a `{contactEmail}` answer (the data answer).
4. Hypothesis: CLS stays 0 with the lazy Turnstile widget (its slot has a fixed height). Break it by: slow 3G, focus the email field, watch the layout.
5. Hypothesis: the six new Open Graph images are the page language's. Break it by: fetch each `og:image` and view it.

## Known gaps

- Lighthouse budgets are not met in the one run I could take (see the spec, Measured): TBT is dominated by the loaded host, no baseline from `main` exists, the app host answered 500 on the development Worker (no seeded database), so the app was not measured. Re-run `lighthouse-budget.ts` on staging when idle.
- `_headers` is applied by the Cloudflare assets binding on the deployed Worker; no local test proves the header is served, only that the file says it.
- Brotli at the edge is documented, not tested.
- CSS is not minified or split (decision in the spec); the stylesheet stays under its 60 KB budget.
