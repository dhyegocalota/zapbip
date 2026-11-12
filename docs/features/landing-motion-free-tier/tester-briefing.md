# Tester briefing: Landing motion and free tier

## What changed and where

- `apps/api/src/site/views/why-section.tsx`, `views/why-scenes.tsx`: the "Why zapbip" section after the hero, six stories, each with a CSS and SVG vignette.
- `views/clients-section.tsx`: one card per install facet agent plus the any-MCP card, each with its own "Get started free with <Agent>" link.
- `views/pricing-section.tsx`: Free plan ($0 in `en_US`, R$0 in `pt_BR`) and a muted Pro card.
- `views/join-block.tsx`, `site-context.ts`, `site-agents.ts`, `site-links.ts`, `page-model.ts`, `site-env.ts`: the `?agent=<id>` hint, kept only for an install facet id.
- `libs/agents/src/install.ts`: re-exports `InstallClient`, the one agent enum the Worker may import.
- `site-copy.ts`: every new string in both locales; labels, hero eyebrow, price FAQ answer, final body and meta description now say free.
- `assets/site.css`, `site-scripts.ts`: scroll-driven keyframes with an observer fallback, reduced motion, the new components.
- `reveal` class on the existing sections for the light staggered reveal.

## How to run

- `pnpm --filter @zapbip/api test:unit -- site-agents site-motion site-copy`
- `pnpm --filter @zapbip/api test:integration -- site-page site-motion site-stylesheet`
- `pnpm --filter @zapbip/api test:landing` (all 62 landing specs, desktop 1280 and mobile 375, boots its own stack)
- Look at it: `pnpm --filter @zapbip/api dev`, open `http://site.localhost:8787/?lang=en` and `?lang=pt-BR`, light and dark, 1440 and 375 px.

## Red today, green after

| Test | Red failure text printed at c8b04181 | Green at |
|------|--------------------------------------|----------|
| `test/unit/site-agents.test.ts` (19 cases) | `siteAgentIdOf is not implemented` / `siteAgents is not implemented` | 316e401b |
| `test/unit/site-motion.test.ts` script cases | `expected '(function () {…' to contain 'animation-timeline: view()'`, `to match /function setupReveal\(\)…/` | 316e401b |
| `test/integration/site-motion.test.ts` | `expected ':root {…' to contain 'html:not(.has-reveal)'`, `expected 0 to be greater than 0` | 316e401b |
| `test/integration/site-page.test.ts` (differentiators, agent cards, hint, pricing, labels, FAQ, order) | `expected [] to deeply equal [ 'Claude Code', 'Codex', …(8) ]`, `expected 'id="clients" …' to contain 'Pergunte, espere e acorde Claude Code…'`, `expected false to be true` for the section order | 316e401b |
| `e2e/landing/landing-scroll-story.spec.ts`, `landing-free-tier.spec.ts` | not run red (they need the page); first green at 8ec0de1f | 8ec0de1f |

Pins (green when they landed): the reduced-motion and scroll-timeline-under-no-preference cases of `site-motion.test.ts` (integration) and the existing `site-stylesheet.test.ts` guards.

## Hypotheses for the tester

1. At 1440 px every story pins in the middle of the screen while its copy sits beside it, and its vignette finishes playing before the story scrolls away; at 375 px nothing pins and each vignette plays as it enters.
2. With `animation-timeline: view()` unsupported (the e2e stubs `CSS.supports`), blocks stay hidden only until the observer shows them and none stays hidden after a full scroll.
3. With reduced motion, `document.getAnimations().length` is 0, no `has-reveal` class is set, every `.scene-step` and `.reveal` is at opacity 1 and the idle label of the wake story is gone.
4. With no script, nothing is hidden: the hidden state only exists under `html.has-reveal`.
5. A card button focuses the email field, shows "You picked <Agent>" and rewrites the address to `/?agent=<id>` (keeping `ref`); without script the same link reloads the page with the hint. Any other `?agent=` value shows nothing and no error.
6. No new origin, no inline script, no `style` attribute: the CSP and the existing policy tests are unchanged. No layout shift over a full scroll (`landing-layout.spec.ts`), LCP unchanged (`landing-performance.spec.ts`).
7. pt_BR shows every new string in Portuguese, including the price `R$0`.

## Known gaps

- The agent hint is lost on a failed join (the POST re-renders without the query) and on a language or theme switch, whose return target is restricted by an existing allow-list.
- The per-card description is the same sentence for every agent with the agent's name filled in: the install facet carries no per-agent description in two languages.
- The Playwright landing suite is not part of `pnpm verify`; it runs with `pnpm --filter @zapbip/api test:landing`.
- The social images and the demo video were not re-rendered: their text does not contradict the page.
