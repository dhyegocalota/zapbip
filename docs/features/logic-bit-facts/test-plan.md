# Test plan: Logic Bit facts

## The failing test first

- [x] `tools/repository-shape/src/company-docs.test.ts::every fact equals the value published on the official site and none is the unset sentinel` — input: `COMPANY` with five facts unset; expected: equals the published values — evidence: 96ed001
- [x] Confirmed it fails for the right reason: `toEqual` diff showed `legalName`, `cnpj`, `address`, `website`, `contactEmail` received as `COMPANY_FACT_UNSET` — evidence: 96ed001, 1 failed | 12 passed

## Unit

- [x] The same test, green — input: `COMPANY` after the change; expected: equals the published values, no sentinel — evidence: b362b6c
- [x] Both snippets show every fact, one row each, and never the sentinel — input: `apps/docs/snippets/company.mdx`, `apps/docs/snippets/pt-br/company.mdx`; expected: 8 table rows each — evidence: b362b6c, repository-shape 327/327 green
- [x] The reply copy that reads `COMPANY.tradeName` is unchanged — input: `libs/core/src/accounts`; expected: green — evidence: 272/272 green

## Docs walk (Playwright MCP was not available to this agent; a throwaway Playwright script in the scratchpad drove headless Chromium against `mint dev`)

- [x] `mint broken-links` — expected: no broken links — evidence: `success no broken links found`
- [x] `help/about` en and pt-br at 1280 and 375 — expected: all five facts visible, no sentinel, zero console errors, zero failed requests — evidence: `.pr-media/logic-bit-facts/final-about-{en,pt-br}-{1280,375}.png`, script output `missing [] sentinel false problems []` for all four
- [x] The footer line `zapbip · Logic Bit` is visible on the 375 page — evidence: `.pr-media/logic-bit-facts/final-about-pt-br-375.png`

## Edge cases found during execution

None.

## Coverage honesty

- The facts come from the owner's reading of the official site on 2026-11-07; no test checks the site itself.
