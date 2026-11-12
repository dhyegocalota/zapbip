# Test plan: Landing motion and free tier

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: `.

Walk server: `http://site.localhost:8787` in development.

## The failing test first

- [x] `apps/api/test/unit/site-agents.test.ts::accepts only install facet ids` — input: `claude-code`, `codex`; expected: accepted. Input `nope`, empty, `__proto__`; expected: refused. — evidence: unit run at 8c31f93b: 119 files, 1487 tests green
- [x] `apps/api/test/integration/site-page.test.ts::renders the differentiators after the hero` — input: `GET /`; expected: `id="why"` between `id="join"` and `id="how"`, six items. — evidence: integration run at 8c31f93b: 134 files, 1586 tests green; live DOM: six `.why-item`, `#why` between `#join` and `#how`

## Unit (Vitest)

- [x] Every new `SiteCopyKey` exists in both locales, none empty, same placeholders (existing copy test). — evidence: unit run, 1487 green; pt_BR walk shows every new string in Portuguese
- [x] The stylesheet scrubs `view()` only inside `prefers-reduced-motion: no-preference` and never applies it under `has-reveal`. — evidence: integration site-motion and site-stylesheet green; live: reduced motion gives 0 animations, no-preference gives 95
- [x] The script chooses the observer only when `animation-timeline: view()` is unsupported. — evidence: unit green; live: CSS.supports stub gives `has-reveal` on, native gives none

## Integration

- [x] One card per install facet agent, in registry order, then the any-MCP card, each with "Get started free with <Agent>" in the page locale. — evidence: live 1440 and 375, en and pt-BR: 10 agent tiles then Any MCP card, aria-label "Get started free with <Agent>" / "Comece grátis com <Agent>"; /private/tmp/claude-501/-Users-dhyegocalota-Projects-zapbip-zapbip/edbded58-c331-44d5-ac8d-6cac14247a14/scratchpad/dev/tester-shots/1440-light-clients.png, /private/tmp/claude-501/-Users-dhyegocalota-Projects-zapbip-zapbip/edbded58-c331-44d5-ac8d-6cac14247a14/scratchpad/dev/tester-shots/375-pt-light-clients.png
- [x] `GET /?agent=claude-code` shows "You picked Claude Code"; `?agent=nope` shows no hint and no error. — evidence: live: hint "You picked Claude Code" server-rendered; `agent=nope`, `<script>`, `__proto__` show no hint, HTTP 200
- [x] Pricing: Free card with `$0` in en_US and `R$0` in pt_BR; Pro card without a price. — evidence: live: $0 en_US, R$0 pt_BR, Pro card has no price; /private/tmp/claude-501/-Users-dhyegocalota-Projects-zapbip-zapbip/edbded58-c331-44d5-ac8d-6cac14247a14/scratchpad/dev/tester-shots/1440-light-pricing.png, /private/tmp/claude-501/-Users-dhyegocalota-Projects-zapbip-zapbip/edbded58-c331-44d5-ac8d-6cac14247a14/scratchpad/dev/tester-shots/375-pt-light-pricing.png
- [x] The FAQ has "Is it free?" in both locales. — evidence: live en: "Is it free?" second item, answer "Yes, during early access..."; pt_BR FAQ rendered
- [x] The page still has no inline script and no inline style attribute. — evidence: integration site-page and site-motion green; 0 console errors, 0 4xx/5xx during walk

## E2E (Playwright, `apps/api/e2e/landing`)

- [x] 1280 px and 375 px, en_US and pt_BR: scrolling reveals the six items; the vignettes reach their final state. — evidence: MCP walk at 1440 and 375 (not 1280), en/pt-BR, light/dark: 88 reveal items all opacity 1 after scroll, vignettes final; /private/tmp/claude-501/-Users-dhyegocalota-Projects-zapbip-zapbip/edbded58-c331-44d5-ac8d-6cac14247a14/scratchpad/dev/tester-shots/1440-why-pin-3.png, /private/tmp/claude-501/-Users-dhyegocalota-Projects-zapbip-zapbip/edbded58-c331-44d5-ac8d-6cac14247a14/scratchpad/dev/tester-shots/375-en-light-s04.png. Playwright `test:landing` suite not run
- [x] A card button click: the page lands on the form, the email field is focused, the hint names the agent, the URL carries `?agent=`. — evidence: live: click lands on form, `#join-email` focused, hint "You picked Codex", URL `/?agent=codex`; keyboard Enter on focused tile same; /private/tmp/claude-501/-Users-dhyegocalota-Projects-zapbip-zapbip/edbded58-c331-44d5-ac8d-6cac14247a14/scratchpad/dev/tester-shots/1440-agent-picked-claude-code.png
- [x] Reduced motion: `document.getAnimations().length` is 0 and every item is visible. — evidence: live: `getAnimations().length` 0, no `has-reveal`, 0 non-opaque items; /private/tmp/claude-501/-Users-dhyegocalota-Projects-zapbip-zapbip/edbded58-c331-44d5-ac8d-6cac14247a14/scratchpad/dev/tester-shots/1440-reduced-bottom.png
- [x] No layout shift over a full scroll; no horizontal scroll at 375 px. — evidence: live: CLS 0 and scrollWidth equals innerWidth in all 8 combinations (2 widths x 2 locales x 2 schemes)

## Edge cases

- [x] `?agent=claude-code&ref=<code>`: both the hint and the referral code are carried. — evidence: live: with a valid 12-character code the tile hrefs and URL after click keep `ref`; SSR HTML has hint and code
- [ ] BLOCKED: dev server has the join secret set, so only the form-replaced case is live-checkable; covered by `site-page.test.ts` paused test for the form, cards-with-paused not asserted. A paused waitlist: the cards still render, their button points to the paused notice and shows no hint.
- [x] Scroll timelines unsupported (script stub): items are hidden until visible, then shown; no item stays hidden. — evidence: live with CSS.supports stub: 58 of 58 `.reveal` hidden at load, 0 hidden above the fold after 600 ms, 0 hidden after a full scroll; /private/tmp/claude-501/-Users-dhyegocalota-Projects-zapbip-zapbip/edbded58-c331-44d5-ac8d-6cac14247a14/scratchpad/dev/tester-shots/1440-fallback-top-after.png

## Adversarial review

- [x] `?agent=<script>`, a 10 000 character value, a repeated parameter: no markup echoed, no error. — evidence: live: `<script>`, 10 000 characters, `__proto__`, repeated `agent` (first wins): HTTP 200, no hint for invalid, no raw markup


## Defects

- Low: at 375 px "Claude Code" wraps to two lines, so its tile is taller than its row and its "Get started free" label sits 4 px lower than the Codex tile beside it. Repro: 375 px, `/?lang=pt-BR`, `#clients`. /private/tmp/claude-501/-Users-dhyegocalota-Projects-zapbip-zapbip/edbded58-c331-44d5-ac8d-6cac14247a14/scratchpad/dev/tester-shots/375-pt-light-clients.png
- Low: the per-agent tile link is 36 px tall at 375 px, under the 44 px touch target. Repro: same page, `a.agent-pick` bounding box.
- Low: with reduced motion the wake story keeps an invisible `.status-idle` ("idle", opacity 0, 43x21 px, static) in layout; the hypothesis says it is gone. Repro: emulate reduced motion, read `getComputedStyle(".status-idle")`.
- Cosmetic, pre-existing (`.final::after` from 4514c00e): the decorative bubble in the final card pokes square past the rounded top-right corner. /private/tmp/claude-501/-Users-dhyegocalota-Projects-zapbip-zapbip/edbded58-c331-44d5-ac8d-6cac14247a14/scratchpad/dev/tester-shots/1440-final-cta-dark.png

## Edge cases found during execution

- Story vignettes at 1440: for about one viewport of scroll two vignettes sit edge to edge (1 px apart) and a blank band of about 250 px appears under the header while the previous story leaves; no overlap, no jump. /private/tmp/claude-501/-Users-dhyegocalota-Projects-zapbip-zapbip/edbded58-c331-44d5-ac8d-6cac14247a14/scratchpad/dev/tester-shots/1440-why-pin-3.png, /private/tmp/claude-501/-Users-dhyegocalota-Projects-zapbip-zapbip/edbded58-c331-44d5-ac8d-6cac14247a14/scratchpad/dev/tester-shots/1440-why-pin-6.png. Judged acceptable, noted.
- Content: story 5 title "Works with every agent" is broader than its body (Claude Code, Codex and any MCP app); the privacy band repeats the official-API claim of story 1.
- Click on a tile loads `/?agent=<id>` with `replaceState` and keeps the language; the reload keeps the hint. A tile never drops `ref` when it is a valid code.
