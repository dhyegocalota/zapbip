# Plan: Agentic site

**Spec:** spec.md
**Tier:** 🔴
**Seam:** `apps/api/src/site`, `apps/api/migrations`, `libs/types` (one enum)

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/api/src/site/**` (new files; head links in `views/site-layout.tsx`; the quick-start tabs in `views/quick-start-section.tsx`), `apps/api/migrations/0013_waitlist_source.sql`, `libs/types/src/enums.ts`, `apps/api/test/**`, `apps/api/e2e/landing/**`, `docs/features/agentic-site/**`, `docs/adr/0044-*`, `.claude/rules/site.md` | `developer` |

## Steps

### G1

- [x] **Step 1:** failing unit test for the Markdown renderer and the negotiation helper — 4cc7094e
- [x] **Step 2:** failing integration tests: twins, negotiation, llms files, well-known files, robots, pricing, quick start, request access — 4cc7094e
- [x] **Step 3:** Markdown renderer, pages and llms files — 5b1436f5
- [x] **Step 4:** migration `0013`, `WaitlistSource`, `joinWaitlist` takes the source — 4cc7094e, 5b1436f5
- [x] **Step 5:** `agentic-routes.ts`, `request-access-route.ts`, robots, head links — 5b1436f5
- [x] **Step 6:** WebMCP script — 88618e5c
- [x] **Step 7:** semantic HTML fixes with tests — 9c64a65a, 00da8123
- [x] **Step 8:** Playwright spec with a stubbed `document.modelContext` — 4cc7094e (spec), 88618e5c (green)
- [x] **Step 9:** rule, READMEs and tester briefing — see the last commit

## Failure modes

| Step | What breaks | Signal | Back out |
|---|---|---|---|
| 4 | `ALTER TABLE ... ADD COLUMN` with a CHECK fails on D1 | `d1 migrations apply` error | the column is additive: drop the migration file before it is applied; after it, a new migration |
| 5 | an HTML route answers Markdown to a browser | Accept `*/*` or `text/html` gets Markdown | the negotiation helper has a test for each header |
| 6 | the script throws and breaks the theme and the form | the join and theme specs fail | the WebMCP setup is last and wrapped by a feature test |
