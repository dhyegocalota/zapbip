# Mobile speed of the landing page

**Status:** Building
**Tier:** 🟡 medium
**Owner approval:** approved 2026-11-14 (owner delegated)
**ADRs:** none
**Not changing:** the CSP, the page copy, the look, the motion, the right-to-left layout, the join route

## Problem

Production mobile Lighthouse (2026-11-14, idle machine) scored 0.70 with Total Blocking Time 2.25 to 2.4 s; desktop scored 0.92. Lighthouse named two non-composited animations: the hero underline (`stroke-dashoffset`) and the live dot pulse (`box-shadow`), the second repainting every frame for four seconds.

## Goals

- Every running CSS animation on the landing page animates only compositor properties (`opacity`, `transform`).
- Every section below the first fold is skipped by the renderer until it nears the viewport (`content-visibility: auto` with an intrinsic size).
- The hero underline still draws from the reading start, in both directions.
- Mobile Lighthouse score 0.90 and Total Blocking Time 200 ms are the target; the measured numbers are recorded in the tester briefing.

## Non-goals

New fonts, a CSS minifier, inline critical CSS (the CSP forbids inline style), removing motion.

## Design

The pulse becomes a pseudo-element ring that scales and fades. The underline is revealed by `clip-path` (`draw-rtl` mirrors it under `html[dir='rtl']`). Sections after the hero carry `content-visibility: auto` and `contain-intrinsic-size: auto 48rem`.
