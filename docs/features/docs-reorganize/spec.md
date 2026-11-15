# Docs reorganization

**Status:** Shipped 2026-11-14
**Lane:** docs
**Owner approval:** approved 2026-11-14 (owner order: free hand on the docs navigation)
**ADRs:** none
**Not changing:** the generated Agents pages, the content of the MCP tool pages, and every public URL not listed under Goals

## Problem

The Help and Developers menus were loose. The About page held one line and a company table, the Open source overview repeated the licenses that the License page now states, and the 24-hour window existed twice.

## Goals

- Navigation in every language: Get started, Concepts, Guides, Agents, Developers, Open source, Help.
- The About page is deleted. A License page under Open source states the AGPL and MIT licenses, the contributor agreement and the company.
- The Open source overview is renamed Self-hosting, and its licenses table moves to the License page.
- The two 24-hour window pages become one page under Concepts.
- `docs.json` redirects `/help/about`, `/open-source/overview` and `/features/the-24-hour-window` in every language, and the test suite fails when a redirect target is missing.

## Non-goals

- Merging the MCP tool pages or the agent pages.
