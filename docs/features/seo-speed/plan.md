# Plan: SEO, GEO and speed

**Spec:** spec.md
**Tier:** 🟡 medium
**Seam:** `SiteLayout` head, `robots-and-sitemap.ts`, `site-paths.ts`, `markdown-pages.ts`, `llms-files.ts`, `site-scripts.ts`
**Assumptions (decided, owner can override):**
- The meta descriptions of de, fr, ja, ko and zh are shortened to the budget; no other copy changes.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/api/src/site/**`, `apps/api/site-public/**`, `apps/api/scripts/**`, `apps/api/test/**`, `apps/api/e2e/landing/**`, `docs/features/seo-speed/**`, `docs/adr/0052-*` | `developer` |

## Sequencing

One developer, red test before each change.

## Steps

### G1

- [ ] **Step 1:** red tests for budgets, JSON-LD, About facts, sitemap lastmod, Open Graph assets and `_headers`
- [ ] **Step 2:** head fixes (legal `og:title`, `robots` max-image-preview), meta descriptions inside the budget
- [ ] **Step 3:** `structured-data.ts` and its rendering in `SiteLayout`
- [ ] **Step 4:** About facts in the llms files and the home twin
- [ ] **Step 5:** sitemap `lastmod`
- [ ] **Step 6:** Open Graph images for the six new languages and the per-language map
- [ ] **Step 7:** lazy Turnstile, `_headers`, performance specs, `lighthouse-budget.ts`
- [ ] **Step 8:** README and rules updated, tester briefing

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|---|---|---|---|
| 3 | A JSON-LD text holding `</script>` ends the block | the escaping unit test | revert the commit |
| 7 | The captcha never loads | the join Playwright spec cannot submit | revert the script change |
