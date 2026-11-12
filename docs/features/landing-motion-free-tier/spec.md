# Landing motion and free tier

**Status:** Building
**Tier:** 🟡 medium
**Owner approval:** approved 2026-11-12 (owner delegated)
**ADRs:** none new; reads [0039](../../adr/0039-the-public-waitlist-is-guarded-by-turnstile-and-fails-closed.md) and [0041](../../adr/0041-the-public-site-is-served-by-the-api-worker-through-host-dispatch.md)
**Not changing:** the join route, Turnstile, the waitlist and referral tables, the cap, the backoffice, the CSP, the demo video and the social images, the hosts and their dispatch

## Problem

The shipped page explains the product but does not show why it is different, offers no per-agent entry point and says nothing about price. The owner's words (2026-11-12, translated): make it even sexier, showing the differentiators with animations while scrolling; "get started for free" with each agent; a free tier; only when it is hyper sexy and live.

## Goals

- A "Why zapbip" section right after the hero: six differentiators, each a scroll-told story with copy on one side and a small CSS and SVG vignette on the other. Every claim is already true today (ADRs and the privacy copy).
- Scroll-driven animation by `animation-timeline: view()` where supported; an `IntersectionObserver` class toggle in the existing site script where not. No new library, no new origin, the CSP is unchanged. `prefers-reduced-motion: reduce` shows the final state without motion. No layout shift, 375 px works with the 16 px gutter, nothing new loads above the fold.
- A light staggered reveal on the existing sections.
- Works-with becomes one card per agent of the install facet (in `siteAgentNames()` order) plus the "any MCP app" card, each with a snippet and "Get started free with <Agent>". The button scrolls to and focuses the join form and carries `?agent=<id>`; the form shows "You picked <Agent>". An unknown id is ignored. No database column.
- A Pricing section: a highlighted Free plan ($0 in `en_US`, R$0 in `pt_BR`, free during early access) listing only what the product does today, a muted "Pro, coming later" card with no price, and a "Get started free" button to the form.
- Hero, header and final call labels read "Get started free"; the form still joins the waitlist and the thank-you state is unchanged. One new FAQ entry, "Is it free?".
- Everything in `en_US` and `pt_BR`, including the meta description.

## Non-goals

- Checkout, accounts, plan limits, an agent column in D1, new media, new social images.
- Carrying the agent hint through the join POST.

## Design

### Data flow

`GET /?agent=claude-code` is parsed by the site context like `ref`: a value that is an install facet id becomes `model.agent`, anything else is null. The join block renders the hint when the id is known. The script turns a card click into the same hint without a reload and then scrolls and focuses the field; with no script the card is a plain link to `/?agent=<id>#join`.

Motion: each differentiator and each reveal target carries a class. In a browser with `animation-timeline: view()` the stylesheet scrubs keyframes along the track's view timeline. Otherwise the script adds `has-reveal` to the document and `is-visible` to each target as it enters, and the same keyframes run by time. With reduced motion, neither applies.

### Failure handling

No script: the page renders in its final state (the hidden state exists only under `has-reveal`). Unknown `?agent=`: ignored. Scroll timelines unsupported: the observer path.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Where does the agent choice live? | a D1 column, a hint in the URL | the URL hint; no database change | owner delegated 2026-11-12 |
| Does the Free plan have limits? | invent limits, list only what exists | list only what the product does today | owner delegated 2026-11-12 |
| Do the social images change? | re-render, keep | keep; their text does not contradict the page | owner delegated 2026-11-12 |

## Test strategy summary

Unit: copy completeness in both locales, the agent id guard, the stylesheet and script pins. Integration: the page sections, the agent cards from the registry, the hint, the pricing. E2E: both locales, desktop and 375 px, a card click focusing the form, reduced motion with no running animation.
