# Test plan: site.js init stays off the first layout

## The failing test first

- [ ] `apps/api/e2e/landing/landing-script-idle.spec.ts` — expected: init takes 140 ms with a dirty layout under a 4x CPU slowdown

## E2E

- [ ] Init under 50 ms with a dirty layout
- [ ] Every other landing spec stays green (`landing-quick-start` covers the tabs)
