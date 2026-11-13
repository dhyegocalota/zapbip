# Landing round seven

**Status:** Building
**Tier:** 🟡 medium
**Owner approval:** approved 2026-11-13 (owner delegated)
**ADRs:** none new; reads [0041](../../adr/0041-the-public-site-is-served-by-the-api-worker-through-host-dispatch.md); no recorded decision fixes the `?lang=` scheme, so the path scheme below changes none
**Not changing:** the join route and Turnstile, the waitlist tables and the cap, the backoffice, the docs host, the demo media, the agent registry and the quick start block

## Problem

The owner's words (2026-11-13, translated): the light theme does not work; the scroll animation is funny; replace the two language links with flags in a select and give each language its own URL; define prices in BRL and USD (free is about 5 messages to try; paid has an amount of messages, then a price for each further amount); no one can bring their own phone number yet; the site is flagged as not secure. "Make all decisions."

## Goals

- **Light theme.** Diagnosed first. On every machine the chosen theme already won over `prefers-color-scheme` (tokens, vignettes, code panel, pricing). The cause the owner met is the plain `http://` visit: the preference cookie is `Secure` and `__Host-`, so a browser drops it over HTTP and the choice never sticks. The https redirect (below) is the fix; an e2e matrix (OS scheme × choice) pins that the choice wins.
- **Calm scroll.** No scroll-scrubbed animation and no sticky pins. Each section and story reveals once at about 20 % visible: fade and a 12 px rise over 500 ms, ease-out, children staggered by 60 ms; a story vignette plays its small sequence once after its reveal and rests. Nothing reverses, jumps or shifts layout. No script and reduced motion show the final state.
- **Language by URL.** `/` is English, `/pt-br` is Portuguese; `/pt-br/` answers `301` to `/pt-br`; legacy `?lang=pt_BR|en_US|pt-BR|en` answers `301` to the path keeping `ref` and `agent`; `/` with no language cookie and a Portuguese `Accept-Language` answers `302` to `/pt-br` with `Vary: Accept-Language`; choosing a language sets the existing cookie. Canonical, hreflang (`en`, `pt-BR`, `x-default` = `/`), `og:url`, `sitemap.xml` and every internal link use the path, so the agent hint survives a language or theme switch.
- **Language select.** One disclosure in the header: a button with the current flag (inline SVG) and "EN" / "PT", opening a list of `POST /locale` buttons (they set the cookie and avoid the `302` bounce) with flag and "English" / "Português". It works without script; the script adds Escape, outside click and arrow keys. Accessible name "Language" / "Idioma".
- **Pricing.** Currency follows the locale (en: USD, pt-BR: BRL). Free: 5 messages to try it, once. Pro: US$ 9 or R$ 49 a month with 1,000 messages included, then US$ 5 or R$ 25 for each further 1,000. A message is any message an agent sends you or you send an agent through zapbip. Amounts and allowances are typed constants rendered by one formatter. Both calls to action go to the join form, with "Billing opens with the invites".
- **No own number.** Nothing on the page, in the meta text or in the docs implies a customer connects their own WhatsApp number. One new FAQ answers "not yet".
- **Secure transport.** Any `http:` request on any host the Worker serves is answered with a redirect to the same URL over `https:` (`301` for GET and HEAD, `308` otherwise) before any routing; the development environment is exempt.
- Everything in `en_US` and `pt_BR`.

## Non-goals

- Enforcing the message quota or billing anything (no billing exists): a follow-up, with its own spec. A language control in the backoffice. The docs Assistant (done in the Mintlify dashboard).

## Design

### Data flow

`siteContext` reads the locale from the path first, then (for `/` only) the cookie, then `Accept-Language`. The page model carries `locale`, `theme` and the path of the other locale; `pagePathOf` builds `/` or `/pt-br` plus `ref` and `agent`. The theme switch returns to the same path and query it was sent from.

Prices: `libs/types` holds a `PricingCurrency` enum, `PRICING` (cents per currency, included messages, overage price per 1,000 and its block size). `formatPrice` renders them with the locale's number format.

### Failure handling

No script: the language disclosure and the tab links work; reveals show the final state. A legacy or unknown `lang` value: ignored, the path decides. A malformed `ref` or `agent`: dropped, never echoed.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Why did the light theme not work? | code bug, plain-HTTP cookie loss | cookie loss over `http://`; fixed by the redirect, pinned by an e2e matrix | owner delegated 2026-11-13 |
| Pro price | any | US$ 9 / R$ 49 a month, 1,000 messages, then US$ 5 / R$ 25 per 1,000 | owner delegated 2026-11-13 |
| Free allowance | monthly, once | 5 messages, once, to test | owner delegated 2026-11-13 |
| Language URL | query, subdomain, path | path: `/`, `/pt-br` | owner delegated 2026-11-13 |

## Test strategy summary

Unit: price formatter and constants, https redirect, language path parsing, copy completeness. Integration: language routes and redirects, canonical and hreflang, sitemap, pricing text, FAQ, theme switch return paths, no own-number wording. E2E: both locales, both widths, reduced motion, both themes against both OS schemes, one-shot reveals with zero layout shift, the language menu by mouse and keyboard.

## What the diagnosis found (2026-11-13)

- **Light theme.** The tokens already followed `data-theme`, but a choice posted the form and reloaded the page at the top, and the privacy band was painted from the terminal colours, which are dark in both themes. A light page with a dark band and a jump to the top read as "light does not work". Fix: the site script applies the choice at once and saves it with a same-origin request that answers `204` (the site policy gains `connect-src 'self'`); without a script the form returns to `#theme`. The band has its own colours, light in the light theme.
- **Scroll motion.** Browsers with scroll timelines scrubbed every block and story with the scroll position and pinned each story, so motion ran backwards on scroll up and stories stuck to the screen. Fix: the scroll-timeline path and the pins are gone; every block reveals once through the observer, 500 ms, 12 px, 60 ms stagger.
- **Docs.** No docs page offered connecting your own number; the FAQ in both languages now says it is not possible yet.
