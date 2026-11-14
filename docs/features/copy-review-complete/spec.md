# Copy review (complete)

**Status:** Building
**Tier:** 🟢 routine
**Owner approval:** approved 2026-11-14 (owner delegated; his words: "revisa tudo")
**ADRs:** none; no rule changes
**Not changing:** meanings, prices, limits, legal substance, MCP tool names

## Problem

The first review ([copy-quality](../copy-quality/)) covered the site, the client app and the install prompts. The docs, the WhatsApp replies and the register of each language were not read in full.

## Goals

1. One register per language: Korean 해요체 (합니다체 only in legal and backoffice), neutral Latin American Spanish with tú, German du, French vous, Japanese です/ます, Chinese 你.
2. The pt-BR rotate command word is `renovar`; `rotate` keeps working.
3. The WhatsApp copy and docs read as native writing in every language; each fix is in `copy-quality/review.md`.

## Non-goals

New languages, new copy, legal substance.

## Design

Wording only, plus bans in `copy-literal-translation-traps.test.ts` for the register giveaways of each language.

## Risks

A string the pass missed; the review lists what was read in full and what was scanned.
