# site.js init stays off the first layout

**Status:** Shipped 2026-11-14
**Tier:** 🟢 small
**Owner approval:** approved 2026-11-14 (owner delegated)
**ADRs:** none
**Not changing:** behaviour of the quick-start tabs, the CSP, the page

## Problem

`setupStartTabs` read `offsetLeft`, `clientWidth` and `scrollWidth` while `site.js` initialised. When the layout was dirty, that read forced a synchronous layout inside the script task: 140 ms under a 4x CPU slowdown, against 4 ms when the layout was clean.

## Goals

- `site.js` init runs no task over 50 ms under a 4x CPU slowdown, even when the layout is dirty at start.
- The selected quick-start tab is still centred and the scroll fade still set, one idle callback later.

## Design

`whenIdle` runs a task in `requestIdleCallback` (a 1 ms timeout where it is missing). The initial centring and fade of the tab list use it. The other setup functions read no layout; the demo, reveal and typing already start from `IntersectionObserver`.

## Measurement

On the local development Worker the score is bimodal on this machine (1.00 or about 0.85 with TBT 0 or 550 ms) and could not separate before from after in three runs each; `example.com` floors at 1.00. The proof is the spec: 140 ms before, under 5 ms after.
