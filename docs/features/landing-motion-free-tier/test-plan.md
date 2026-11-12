# Test plan: Landing motion and free tier

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: `.

Walk server: `http://site.localhost:8787` in development.

## The failing test first

- [ ] `apps/api/test/unit/site-agents.test.ts::accepts only install facet ids` — input: `claude-code`, `codex`; expected: accepted. Input `nope`, empty, `__proto__`; expected: refused.
- [ ] `apps/api/test/integration/site-page.test.ts::renders the differentiators after the hero` — input: `GET /`; expected: `id="why"` between `id="join"` and `id="how"`, six items.

## Unit (Vitest)

- [ ] Every new `SiteCopyKey` exists in both locales, none empty, same placeholders (existing copy test).
- [ ] The stylesheet scrubs `view()` only inside `prefers-reduced-motion: no-preference` and never applies it under `has-reveal`.
- [ ] The script chooses the observer only when `animation-timeline: view()` is unsupported.

## Integration

- [ ] One card per install facet agent, in registry order, then the any-MCP card, each with "Get started free with <Agent>" in the page locale.
- [ ] `GET /?agent=claude-code` shows "You picked Claude Code"; `?agent=nope` shows no hint and no error.
- [ ] Pricing: Free card with `$0` in en_US and `R$0` in pt_BR; Pro card without a price.
- [ ] The FAQ has "Is it free?" in both locales.
- [ ] The page still has no inline script and no inline style attribute.

## E2E (Playwright, `apps/api/e2e/landing`)

- [ ] 1280 px and 375 px, en_US and pt_BR: scrolling reveals the six items; the vignettes reach their final state.
- [ ] A card button click: the page lands on the form, the email field is focused, the hint names the agent, the URL carries `?agent=`.
- [ ] Reduced motion: `document.getAnimations().length` is 0 and every item is visible.
- [ ] No layout shift over a full scroll; no horizontal scroll at 375 px.

## Edge cases

- [ ] `?agent=claude-code&ref=<code>`: both the hint and the referral code are carried.
- [ ] A paused waitlist: the cards still render, their button points to the paused notice and shows no hint.
- [ ] Scroll timelines unsupported (script stub): items are hidden until visible, then shown; no item stays hidden.

## Adversarial review

- [ ] `?agent=<script>`, a 10 000 character value, a repeated parameter: no markup echoed, no error.
