# Test plan: Mobile speed of the landing page

## The failing test first

- [ ] `apps/api/e2e/landing/landing-mobile-speed.spec.ts` — expected: red on the `box-shadow` pulse and the `stroke-dashoffset` underline

## E2E (Playwright, mobile and desktop)

- [ ] `/` and `/ar`: no running CSS animation outside opacity and transform
- [ ] Long tasks under a 4x CPU slowdown stay under the budget
- [ ] The Arabic underline grows from the right
- [ ] The existing `landing-performance`, `landing-motion`, `landing-first-fold`, `landing-arabic` and `landing-seo` specs stay green

## Prove it for real

- [ ] `lighthouse-budget.ts` mobile and desktop before and after; screenshots of `/` and `/ar` at 360 px and desktop
