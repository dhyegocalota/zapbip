# Mobile speed of the landing page

**Status:** Shipped 2026-11-14
**Tier:** 🟡 medium
**Owner approval:** approved 2026-11-14 (owner delegated)
**ADRs:** none
**Not changing:** the CSP, the page copy, the look, the motion, the right-to-left layout, the join route

## Problem

Production mobile Lighthouse (2026-11-14, idle machine) scored 0.70 with Total Blocking Time 2.25 to 2.4 s; desktop scored 0.92. Lighthouse named two non-composited animations: the hero underline (`stroke-dashoffset`) and the live dot pulse (`box-shadow`), the second repainting every frame for four seconds.

## Goals

- Every running CSS animation on the landing page animates only compositor properties (`opacity`, `transform`).
- The hero underline still draws from the reading start, in both directions.
- Mobile Lighthouse score 0.90 and Total Blocking Time 200 ms are the target; the measured numbers are recorded in the tester briefing.

## Non-goals

New fonts, a CSS minifier, inline critical CSS (the CSP forbids inline style), removing motion.

## Design

The pulse becomes a pseudo-element ring that scales and fades. The underline draws with `transform: scaleX` from the reading start (`transform-origin` flips under `html[dir='rtl']`); `clip-path` was tried and Chrome does not composite it.

`content-visibility: auto` on the sections below the hero was tried and dropped: hiding every section left Total Blocking Time unchanged, and it made the page height jump when a section rendered (the theme spec lost the reader's scroll position) and blanked `innerText` of the quick-start panels.
