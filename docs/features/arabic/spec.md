# Arabic, the ninth language

**Status:** Shipped 2026-11-14
**Tier:** 🔴 structural
**Owner approval:** approved 2026-11-14 (owner delegated)
**ADRs:** [0053](../../adr/0053-arabic-is-the-ninth-language-and-the-first-that-reads-right-to-left.md)
**Not changing:** prices, limits, the CSP, the template names, the existing eight languages' copy

## Problem

The owner (2026-11-14, translated): "the Arabic translation was left out."

## Goals

- `ar` (Modern Standard Arabic, path `/ar`, docs folder `ar`) on every surface the other eight reach: site, legal pages, client app, backoffice, Open Graph, setup page and twins, llms files, documentation, WhatsApp copy, commands with collision tests, the language command, the calling-code table, install prompts and the self-test text, the Meta template table and runbook, the demo and the card.
- Right to left done properly: `dir` from the locale profile, logical CSS, code, links and numbers left to right, an Arabic font stack and no letter spacing.
- Native Modern Standard Arabic in a direct, warm product voice; the glossary has the Arabic column.

## Non-goals

A web font, Hebrew or Persian, approving the Arabic templates, a mirrored terminal in the demo.

## Design

See ADR 0053. Adding the next language is the list in [visual-localization](../visual-localization/spec.md) plus the records the compiler names.

### Failure handling

A missing Arabic row is a type error; a missing file or table row is a red test (`site-assets`, `demo-copy`, `locale-profiles`, `agent-registry`, the docs shape tests).

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Israel (972) | English, Arabic | English: Hebrew is the first language there | 2026-11-14 |
| WhatsApp brand in Arabic text | WhatsApp, واتساب | `WhatsApp`, as in the other languages and the legal text | 2026-11-14 |
| Backoffice | English only, Arabic | Arabic (operator-facing, but typed per locale) | 2026-11-14 |

## Test strategy summary

Unit: every typed record, command collisions, digits, direction, media, legal, docs tables. Integration: the page in Arabic. Playwright: `/ar` at 360 px and on desktop, no horizontal scroll, mirrored layout, left to right code.
