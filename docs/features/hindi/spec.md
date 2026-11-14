# Hindi, the tenth language

**Status:** Building
**Tier:** 🔴 structural
**Owner approval:** approved 2026-11-14 (owner delegated)
**ADRs:** [0057](../../adr/0057-hindi-is-the-tenth-language-and-india-keeps-english-for-a-new-owner.md)
**Not changing:** prices, limits, the CSP, the template names, the existing nine languages' copy beyond the language-code lists and counts

## Problem

The owner (2026-11-14, translated): "Indian was left out, fix it."

## Goals

- `hi` (Hindi in Devanagari, path `/hi`, docs folder `hi`) on every surface the other nine reach: site, legal pages, client app, backoffice, Open Graph, setup page and twins, llms files, documentation, WhatsApp copy, commands with collision tests, the language command, install prompts and the self-test text, the Meta template table and runbook, the demo and the card.
- Left to right with a Devanagari system font stack, no letter spacing and Latin digits.
- Natural spoken Hindi with आप and the loanwords Indian developers use; formal legal pages; the glossary has a Hindi section.
- India (+91) keeps English for a new owner.

## Non-goals

A web font, other Indian languages, approving the Hindi templates, romanized Hindi commands.

## Design

See ADR 0057. The records the compiler names, plus the media through `record-landing-demo.ts --locale hi`.

### Failure handling

A missing Hindi row is a type error; a missing file or table row is a red test (`site-assets`, `demo-copy`, `locale-profiles`, `agent-registry`, the docs shape tests, `hindi-copy`).

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| India (91) | English, Hindi | English: Indian developers mostly use English and Hindi is not the first language across the country | 2026-11-14 |
| Register | Sanskritized, spoken with loanwords | Spoken Hindi with आप and the loanwords developers use; legal formal | 2026-11-14 |
| Digits | Devanagari, Latin | Latin | 2026-11-14 |

## Test strategy summary

Unit: every typed record, command words and folding, collisions with ordinary Hindi chat, the +91 row, the unknown-language reply, legal shape, SEO budgets, templates against the runbook, Hindi copy rules (no gendered first person, Latin digits, no coined terms). Integration: the site, install page and start link in Hindi. Playwright: `/hi` at 360 px and on desktop.
