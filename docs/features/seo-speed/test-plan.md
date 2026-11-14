# Test plan: SEO, GEO and speed

## The failing test first

- [ ] `apps/api/test/unit/site-seo-budget.test.ts` — input: the eight languages; expected: red on the long de, fr, ja, ko and zh descriptions
- [ ] `apps/api/test/unit/structured-data.test.ts` — expected: red with `structuredDataOf is not implemented`

## Unit

- [ ] Title and description inside the budget and unique, eight languages, home, terms, privacy
- [ ] JSON-LD required properties per type, prices equal the pricing constants, FAQ text equals the page text, `</script>` escaped
- [ ] About facts equal across the JSON-LD, the twin, `llms.txt` and `llms-full.txt`
- [ ] Sitemap has one `lastmod` per URL
- [ ] `og-<locale>.png` for every `WebLocale`, 1200 by 630, under 300 KB, `siteAssetOf` maps each to its own
- [ ] `_headers` caches `/site/*`

## Integration (`--maxWorkers=2`, after "integration clear")

- [ ] Every page in eight languages: canonical without query, nine alternates, one `h1`, headings in order, one ld+json block that parses, the only inline script
- [ ] The legal `og:title` is the legal title

## E2E (Playwright specs)

- [ ] CLS 0 and LCP under 2.0 s on Slow 4G mobile
- [ ] The Turnstile script is absent until the form is touched; the submit still works
- [ ] The ld+json block raises no console error under the CSP

## Prove it for real

- [ ] `lighthouse-budget.ts` on the landing and the app, mobile and desktop, before and after; numbers in `tester-briefing.md`
