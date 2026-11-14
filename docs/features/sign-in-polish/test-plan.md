# Test plan — sign-in polish

Tick a box only with evidence (command output, screenshot path).

- [x] Unit: `apps/api/test/unit/backoffice-copy.test.ts` and `backoffice-layout.test.ts` pass with `SignInLead` removed from every language. Evidence: `pnpm verify` gate `unit ok`, 157 files, 2654 tests passed.
- [x] Unit: `apps/api/test/unit/backoffice-design-rules.test.ts` pins `.field label` to `margin-bottom: var(--space-2)`; `apps/api/test/unit/client-app-styles.test.ts` pins `.connect-form label` the same way. Evidence: same gate run, 2654 tests passed.
- [x] Integration: `apps/api/test/integration/site-page.test.ts` — `/?email=maria+news@example.com` fills `maria+news@example.com`; a bad address stays empty. Evidence: `pnpm verify` gate `integration ok`, 171 files, 2822 tests passed.
- [x] E2E landing: `landing-join.spec.ts` — a click before the check waits, shows busy, and sends after the pass; a failed check shows the captcha notice and writes nothing; the other join cases still pass. Evidence: `pnpm test:landing e2e/landing/landing-join.spec.ts`, 14 passed (desktop and mobile).
- [x] Visual: `.pr-media/sign-in-backoffice-before.png` and `.pr-media/sign-in-backoffice-after.png` (backoffice), `.pr-media/sign-in-client-app-before.png` and `.pr-media/sign-in-client-app-after.png` (continue page), `.pr-media/sign-in-connect-before.png` and `.pr-media/sign-in-connect-after.png` (connect form), all at 1280 px.
- [ ] Narrow width: the sign-in card has no horizontal scroll at 375 px. Not walked; the card uses the existing `hero-card` and `panel-hero` widths and full-width buttons.
- [ ] Reduced motion: the entrance animation is absent under `prefers-reduced-motion: reduce`. Not walked; the animation sits under `prefers-reduced-motion: no-preference`, as the other auth animations do.
