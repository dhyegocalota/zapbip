# Test plan: Landing round seven

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: `.

## The failing test first

- [ ] `apps/api/test/unit/https-redirect.test.ts` — input: `http://zapbip.com/x?y=1` GET; expected `301` to `https://zapbip.com/x?y=1`; a POST gets `308`; an `https:` request and the development environment get no redirect.
- [ ] `apps/api/test/integration/site-language.test.ts` — input: `GET /pt-br`; expected a Portuguese page whose canonical is `/pt-br`.

## Unit

- [ ] Prices: each currency has the constants of the spec; the formatter prints `$9`, `R$ 49`, `1,000` and `1.000` for the locales.
- [ ] Every new copy key exists in both locales, none empty, same placeholders.

## Integration

- [ ] `/` English, `/pt-br` Portuguese, `/pt-br/` `301` to `/pt-br`; `/?lang=pt_BR&ref=<code>` `301` to `/pt-br?ref=<code>`; `/` with `Accept-Language: pt-BR` and no cookie `302` to `/pt-br` with `Vary: Accept-Language`; a bot with no header gets English.
- [ ] Canonical, hreflang (`en`, `pt-BR`, `x-default` = `/`), `og:url` and the sitemap use the paths.
- [ ] The theme switch, the join form action, the agent tabs and the referral link keep the path, `ref` and `agent`.
- [ ] Pricing shows USD in English and BRL in Portuguese with the right allowances and the billing line; no "coming later".
- [ ] The own-number FAQ and the reworded official-API story are in both languages; no page text offers connecting your own number.

## E2E (Playwright)

- [ ] OS dark × Light and OS light × Dark, both locales: body, a story vignette and the pricing card follow the choice; the code panel stays dark.
- [ ] The language disclosure opens, Escape and outside click close it, arrows move, choosing Portuguese lands on `/pt-br` and keeps `agent`.
- [ ] Reveals play once, never reverse on scroll up, never shift layout (CLS 0); no script and reduced motion show the final state.
- [ ] 375 px: no horizontal scroll, the disclosure fits the header.

## Edge cases

- [ ] `/PT-BR`, `/pt-br//`, `?lang=xx`: no loop, English or the path decides.
- [ ] A plain `http:` request to the site, the backoffice and the MCP host: redirected before any routing.
