# Copy quality

**Status:** Building
**Tier:** 🟢 routine
**Owner approval:** approved 2026-11-14 (owner delegated; his words: "better to say 'Prompt in ..'" and "make sure each language does not 'sound funny', like 'você toca' which should be 'você responde'")
**ADRs:** none; no rule changes
**Not changing:** meanings, prices, limits, legal substance, MCP tool names, button instructions that name a real gesture on a real button

## Problem

Two things read wrong. The quick-start window title said what the owner does with the text, not what the text is. And the six later translations carried the gesture of the English ("you tap", "your tap") where a native writer says what the person does: "you reply".

## Goals

1. The quick-start title is "Prompt in {agent}" (and "Prompt in your AI app") in all eight languages, keeping the loanword developers use there, and fits one line of a 360 px phone.
2. Every place a language described the gesture of answering now says the answer: site, legal wording, backoffice, docs in seven folders and the agent page sources.
3. A glossary fixes one word per product term per language.
4. A unit test bans the known literal translations per language in docs, agent page sources and copy modules.

## Non-goals

Rewriting strings that already read natively. Changing a button instruction that tells the person to press a real button ("tap Open"). New languages.

## Design

Wording only, plus one test. The test reads copy modules and docs from disk and fails on the listed traps of each language; a new trap is one more alternative in that language's pattern. The legal sentence about deciding from an agent message changed wording in eight languages; `LEGAL_UPDATED_ON` already carries the date of this change.

## Risks

A string the review missed. The review lists what was unsure; the test keeps the known traps out.
