# Test plan: Mobile speed of the landing page

## The failing test first

- [ ] `apps/api/e2e/landing/landing-mobile-speed.spec.ts` — expected: red on `box-shadow` and `clip-path`-less `stroke-dashoffset` animations, and on sections without `content-visibility`

## E2E (Playwright, mobile and desktop)

- [ ] `/` and `/ar`: no running CSS animation outside opacity and transform
- [ ] `/` and `/ar`: every section after the hero has `content-visibility: auto`
- [ ] Long tasks under a 4x CPU slowdown stay under the budget
- [ ] The Arabic underline uses `draw-rtl`
- [ ] The existing `landing-performance`, `landing-motion`, `landing-first-fold`, `landing-arabic` and `landing-seo` specs stay green

## Prove it for real

- [ ] `lighthouse-budget.ts` mobile and desktop before and after; screenshots of `/` and `/ar` at 360 px and desktop
