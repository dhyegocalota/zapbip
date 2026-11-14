# Prose leak ratchet

**Status:** Shipped 2026-11-14
**Tier:** 🟡 medium
**Owner approval:** the owner asked on 2026-11-14 for a demo image in the repository and for the README to say why zapbip is not a full WhatsApp channel, and that agent-specific details stop leaking out of the agent folders
**ADRs:** [0064](../../adr/0064-a-wake-provider-and-a-channel-protocol-belong-to-the-agent-folder.md)
**Not changing:** the docs pages that still name agents (counted by the baseline), the leak scan of code

## Problem

The leak scan reads code and configuration, so the public prose (the docs pages and the READMEs) could name an agent anywhere without a test noticing, and 327 such mentions already existed. The README also read like a channel, which it is not, and had no picture.

## Goals

- A test counts, per public page, how many times it names an agent outside the agent pages, and fails when a count grows or when a page improved and its number was not lowered.
- The README shows the demo as an image and explains the difference with a full WhatsApp channel near the top.
- The easy mentions go: the home page's list of products and the plugin names in the open source table.

## Non-goals

- Rewriting the pages that explain how to wake or connect a specific agent; the baseline lists them.

## Design

### Data flow

`registeredLeakAgents()` turns the registry (definitions and the runtime, wake and channel facets) into the leak scan's agents. `prose-leaks.test.ts` scans every public Markdown and MDX file with the same patterns and compares per-file counts with `tools/repository-shape/prose-leak-baseline.json`; `WRITE_PROSE_LEAK_BASELINE=1` rewrites the file.

### Failure handling

| Failure | Outcome |
|---|---|
| A new mention in a page | the page appears in the first test |
| A mention removed and the baseline not lowered | the page appears in the second test |

## Open questions → answers

None.

## Test strategy summary

The ratchet test, the unchanged shape suite, and the boundary rule that lets the Worker import the wake facet (found missing because the file was untracked when the previous change was tested).
