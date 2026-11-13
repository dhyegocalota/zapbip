# Site polish

**Status:** Shipped 2026-11-13
**Tier:** 🟡 medium
**Owner approval:** approved 2026-11-13 (owner delegated; the numbered requests are his words)
**ADRs:** none
**Not changing:** the waitlist, the referral cap, credits and `?ref` capture in the backend; the backoffice; account use cases

## Problem

The public site still sells "Get started free" while signups are closed, shows a placeholder connection link that reads like the referral link, offers referral sharing before anything is live, translates a few lines literally in Portuguese, hides the language menu in the header and ends in a plain footer.

## Goals

1. The language menu leaves the header for the footer (same `<details>` and `POST /locale`, now opening upward). The header keeps the brand, Docs and the access button.
2. The call to action reads "Request access" / "Pedir acesso" on the header, the form, both pricing cards, the quick start and the final call. The hero eyebrow says early access.
3. The quick start shows an example connection link in the real format (`https://mcp.zapbip.com/c/zb_conn_<43 characters>/mcp`, a visibly fake secret) with a caption saying it is an example. Copy copies what is shown. A URL is one highlighted token.
4. Referral is closed: the thank-you confirms the early access list and nothing else. The referral panel stays in the code behind `REFERRAL_SHARING_OPEN` (false), the FAQ entry and the final-call invite button follow the same flag, and the backend is untouched.
5. Portuguese copy: "O agente pergunta. Você responde com um toque.", "Você responde", "esperam sua resposta", and the rest of the site reviewed for literal translations.
6. Footer: product, legal and company columns, the language menu and theme icons, and a huge text wordmark that fits the container, theme-aware gradient, no image. The final call is one line and one button, no card.
7. A "Made by Logic Bit" link to `https://logicbit.com.br` with `rel="noopener"` in the company column.
8. `COMPANY.contactEmail` is `support@zapbip.com`, and the old address appears nowhere in the repository (except the open-source-readiness branch, handled by the orchestrator).

## Non-goals

- New languages (round 8, another lane). Reopening referral. Recording new demo media.

## Design

`site-layout.tsx` renders the header without the menu and a footer of three `FooterColumn` navs, the controls, the trademark line and the wordmark. `site-constants.ts` holds `REFERRAL_SHARING_OPEN` and `SITE_EXAMPLE_CONNECTION_LINK`, built with `buildConnectionLink` from the production origin and an `EXAMPLE-` secret that matches `CONNECTION_SECRET_PATTERN`. `thanks-panel.tsx` is the calm confirmation; the former panel is `referral-thanks-panel.tsx`, chosen by the flag in `join-block.tsx`. The code block wraps long lines instead of scrolling.

## Failure modes

A flag flipped on shows the referral panel without its copy being reviewed for the launch wording; the panel keeps its own tested copy keys. A wordmark wider than the container would scroll the page; the Playwright footer spec asserts it spans 80 to 100 percent of the container at 1440 and 375.
