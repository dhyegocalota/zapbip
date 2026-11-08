# Install route readiness

**Status:** Building
**Tier:** 🟢 small
**Owner approval:** approved 2026-11-08 (owner delegated 2026-11-06)
**ADRs:** none
**Not changing:** the Worker's routes, the preflight refusal wording

## Problem

`pnpm deploy:production --first-deploy` refuses with `the /i/:installCode route is not mounted`. The route is mounted with `app.all`, which Hono records with method `ALL`, and `inspectWorker` only accepts `GET`. The preflight tests use fake worker facts, so nothing ran `inspectWorker` against the real `createApp`.

## Goals

- A route serves GET when its method is `GET` or Hono's `ALL`, on the `/i/` prefix.
- A unit test runs `inspectWorker` on the real `createApp`, built as `deploy.ts` builds it, and the real Worker source root.

## Non-goals

- Other readiness checks: no other code reads `app.routes`.

## Design

### Data flow

`inspectWorker` reads `app.routes`; `mountsInstallRoute` is true when a route under the install prefix has method `GET` or `ALL`.

### Failure handling

A POST-only install route still reads as not mounted.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Accept `ALL` as serving GET | accept · change the app to `get` | accept; owner delegated | 2026-11-06 |

## Test strategy summary

Unit: the real app gives `mountsInstallRoute: true` and `exportsScheduled: true`; no `/i/` route gives false; a POST-only `/i/` route gives false.
