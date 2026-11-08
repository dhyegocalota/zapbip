# UI polish

**Status:** Approved
**Tier:** 🟡
**Owner approval:** owner delegated 2026-11-06; visual direction chosen in [design.md → Owner decisions](design.md#14-owner-decisions)
**ADRs:** none; no decision here changes an interface, a dependency or the backoffice CSP
**Not changing:** routes, forms, POST, 303, GET flows, the backoffice CSP, the copy of any existing key, the MCP contract, the Mintlify navigation and page set, the docs Playwright selectors, the favicon.

## Problem

The owner's order, 2026-11-08: "UI tem que ficar hiper sexy, se vira", meaning the UI must look stunning. Both user-facing surfaces work and pass AA, but they read as a default template: the backoffice is a flat bordered form stack with stacked cards that touch, ragged header buttons and full-width six-digit inputs, and the docs use Mintlify's stock look with a brand green that fails 4.5:1 as link text (4.14:1 on white).

## Goals

- One recognisable visual identity, "Signal", across the backoffice and the docs: the chat-bubble tail corner, a signal-green accent, rounded display type.
- Backoffice: a new token set and component styling in the one stylesheet, plus the few markup hooks listed in [design.md → Hand-off](design.md#15-hand-off-to-the-plan); no script, the CSP unchanged.
- Docs: `docs.json` theme tokens, logo, background, a hero on both Overview pages and an AA-correct chat mockup.
- Every text pair AA in light and dark; motion CSS-only and off under `prefers-reduced-motion`.

## Non-goals

- New pages, routes, data or queries. Web fonts. A JavaScript bundle. A Mintlify theme switch.

## Design

[design.md](design.md) holds the screens, tokens, components, copy, accessibility and options.

The metrics page lives on `feat/backoffice-metrics`; this feature merges `main` after that branch ships and styles it in the same change.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Visual direction | A Signal · B Console | A Signal (owner delegated 2026-11-06) | 2026-11-08 |
| The rest | design.md §13 | design.md §14 (owner delegated 2026-11-06) | 2026-11-08 |

## Test strategy summary

Unit: token contrast pairs (light and dark), the stylesheet source scan (no raw colour outside `:root`, every animation inside a reduced-motion guard), the view markup hooks. E2E: the existing backoffice and docs walks stay green. Playwright MCP: every backoffice page and both Overview pages at 1280 and 375, light and dark, reduced motion on and off, compared with the before screenshots.
