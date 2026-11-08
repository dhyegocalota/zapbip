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
- Backoffice home: a 14-day sparkline on each card, fed by exactly three new read-only `SELECT`s (owner delegated 2026-11-06):
  - numbers registered per day: `whatsapp_numbers.created_at`;
  - messages per day: `activity_daily`, `MessagesIn` plus `MessagesOut`;
  - audit entries per day: `backoffice_audit.at`, bounded by `at >= ?`.
  They run in the same `database.batch` as the existing state counts (one round trip, four statements, no N+1), bind `since`, `GROUP BY` the day, and reuse the metrics `dailySeries` and `utcDay`. Each sparkline is `role="img"` with a `<title>` and a visible text summary, from `*-copy.ts` keys in pt_BR and en_US; an all-zero series says so in words, so a flat line is never the only signal.
- Lanes: A is the backoffice, B is the docs; they own disjoint files ([plan.md](plan.md)). Lane A starts after `feat/backoffice-metrics` is on `main`.

## Non-goals

- New pages, routes or data. Any query beyond the three read-only sparkline `SELECT`s below. Web fonts. A JavaScript bundle. A Mintlify theme switch.

## Design

[design.md](design.md) holds the screens, tokens, components, copy, accessibility and options.

The metrics page lives on `feat/backoffice-metrics`; this feature merges `main` after that branch ships and styles it in the same change. Nothing in lane A or lane B changes before the recorder has captured the `before-*.png` set on that merged `main` (owner delegated 2026-11-06).

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Visual direction | A Signal · B Console | A Signal (owner delegated 2026-11-06) | 2026-11-08 |
| The rest | design.md §13 | design.md §14 (owner delegated 2026-11-06) | 2026-11-08 |
| Home sparklines need queries, against "no new queries" | none · exactly three read-only `SELECT`s in the existing batch | three `SELECT`s, one `database.batch` (owner delegated 2026-11-06) | 2026-11-08 |
| Environment-chip live dot | all environments · staging and development only | staging and development only, never production (owner delegated 2026-11-06) | 2026-11-08 |
| Empty state | §9.8 typing bubble · §16 96 px bubble | one 96 px bubble whose dots animate once (owner delegated 2026-11-06) | 2026-11-08 |
| Hero-card border technique | `border-image` · `padding-box`/`border-box` double background | double background, with a `CanvasText` fallback under `forced-colors` (owner delegated 2026-11-06) | 2026-11-08 |

## Test strategy summary

Unit: token contrast pairs (light and dark) computed from the parsed CSS, the stylesheet source scan (no raw colour outside `:root`, every animation inside a reduced-motion guard, every light token has a dark one, a forced-colors block), the view markup hooks, the sparkline queries and component, the CSP pin. Docs: shape tests for the logos, `docs.json`, the Hero props parity and the contrast of the docs colours. E2E: the existing backoffice and docs walks stay green. Playwright MCP: every backoffice page and both Overview pages at 1280 and 375, light and dark, reduced motion on and off, compared with the before screenshots.
