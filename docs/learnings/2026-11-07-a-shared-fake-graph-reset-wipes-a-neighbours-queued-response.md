# A backoffice integration test passes alone and fails in a full run with the not-found copy instead of the error copy
- Date: 2026-11-07
- Inspired by: `backoffice-numbers-verify.test.ts` "a Meta 500 shows the error kind copy and never the response body" in a full `pnpm verify all`; fix ab0a9e88, red 2c8c5256
- Revisited: 2026-11-07 — still true

## Signal
The verification page shows "A Meta não conhece este ID de número de telefone." where the test expects "A Meta respondeu com erro. Tente de novo mais tarde.". The file passes 11 of 11 alone and fails only inside a full integration run.

## Cause
Five integration files that use the fake Graph share one global server on port 4012. Each called a global `reset()` in `beforeEach`, so a neighbouring file's reset wiped the queued 500 between `respondWith` and `verify`. The request then met no scripted answer, got "unknown route" 404, and the page rendered the not-found copy.

## Do
Scope the fake's queue, recorded requests, counters and reset to the resource ids each file declares, so one file's reset can never touch another file's script. A test that scripts a shared fake declares what it owns.

## Anchor
- `apps/api/test/support/fake-graph.ts`
- `apps/api/test/integration/backoffice-numbers-verify.test.ts`
- commits 2c8c5256 (red) and ab0a9e88 (green), proved with five shuffle seeds
