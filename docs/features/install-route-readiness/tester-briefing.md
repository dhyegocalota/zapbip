# Tester briefing: Install route readiness

## What changed

- `apps/api/src/operations/worker-facts.ts`: `mountsInstallRoute` is true when a non-middleware route under `/i/` has method `GET` or Hono's `ALL`. Routes come from `inspectRoutes` (`hono/dev`, a public export of the pinned hono 4.13.16).
- `apps/api/test/unit/worker-facts.test.ts`: tests on the real `createApp` and the real source root, plus the negative cases.

## How to run

`pnpm --filter @zapbip/api exec vitest run test/unit/worker-facts.test.ts` and `pnpm --filter @zapbip/api typecheck`.

## Red today, green after

| Commit | Test | Red output |
|--------|------|------------|
| `88f3ad8d` | sees the install route of the app built as the deploy builds it, from the real source root | `mountsInstallRoute`: expected `true`, received `false`; 1 failed, 5 passed |
| the middleware test commit | does not count middleware on the install prefix as a page | `AssertionError: expected true to be false`; 1 failed, 7 passed |

Pins (green when they landed): no `/i/` route, POST-only `/i/` route, `all('/health')` outside the prefix.

## Hypotheses for the tester

- Accepting any method turns the POST-only test red.
- Dropping the `/i/` prefix check turns the no-route test and the `/health` test red.
- Removing `METHOD_NAME_ALL` from the accepted methods turns the real-app test red.
- Dropping the `!route.isMiddleware` filter turns the middleware test red.

## Tester mutations already run

1. Accept any method.
2. Drop the `/i/` prefix.
3. Remove `METHOD_NAME_ALL`.

## Gaps

- `isMiddleware` in Hono is `handler.length > 1`; a page handler declared with two parameters would read as middleware.
- The deploy itself is not run; `inspectWorker` is.
