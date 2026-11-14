# Logic Bit facts

**Status:** Shipped 2026-11-07
**Tier:** 🟢 small
**Owner approval:** approved 2026-11-07 (owner order)
**ADRs:** none
**Not changing:** the shape of `COMPANY`, the company snippets' layout, the footer and the reply copy

## Problem

Five of the six `COMPANY` facts were `COMPANY_FACT_UNSET`, so the about page, the footer link target and the legal pages showed only the trade name.

## Goals

- Every `COMPANY` fact holds the value the official site publishes, and both about pages (en and pt-br) show it.

## Non-goals

- Changing how the facts are rendered.

## Design

### Data flow

Source: https://logicbit.com.br, read on 2026-11-07. `COMPANY` in `libs/types/src/constants.ts` carries the values; the two `company.mdx` snippets list them and `company-docs.test.ts` pins both to the published values.

| Fact | Value |
|------|-------|
| tradeName | Logic Bit |
| legalName | Dhyego Fernando Rissao Calota |
| cnpj | 32.555.315/0001-91 |
| website | https://logicbit.com.br |
| contactEmail | dhyego@logicbit.com.br |

### Failure handling

The unset sentinel stays for a fact that is ever withdrawn; the docs tests keep refusing to render it.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Legal name: the site says "Logic Bit, an individual company owned by Dhyego Fernando Rissao Calota" and publishes no separate razão social | owner's name, leave unset | owner's name: an individual company's legal name is its owner's name (owner delegated 2026-11-06) | 2026-11-07 |

## Test strategy summary

Unit: `company-docs.test.ts` asserts every fact equals the published value and none is the sentinel; the existing snippet tests render every fact. Docs: `mint broken-links` and a walk of `help/about` at 1280 and 375 in both languages.
