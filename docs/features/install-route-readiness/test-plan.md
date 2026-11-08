# Test plan: Install route readiness

## The failing test first

- [x] `apps/api/test/unit/worker-facts.test.ts`: input: real `createApp` and the real source root; expected: `{ exportsScheduled: true, mountsInstallRoute: true }` (red today: `mountsInstallRoute` false) — red: mountsInstallRoute false; green after the fix; tester: 88f3ad8d red (mountsInstallRoute false, 1 failed | 5 passed), e0f3a6a5 green 6/6; throwaway inspectWorker script printed {"exportsScheduled":true,"mountsInstallRoute":true}; mutation ALL removed from accepted methods turns it red (deleted script)

## Unit

- [x] An app with no `/i/` route gives `mountsInstallRoute: false` — pin: green when it landed (worker-facts.test.ts); tester: dropping the /i/ prefix check turns it red (reports a missing install route)
- [x] An app that mounts `/i/` only for POST gives `mountsInstallRoute: false` — pin: green when it landed (worker-facts.test.ts); tester: accepting any method turns it red (is not fooled by ... another method)
- [x] An app with `new Hono().all('/health', handler)` gives `mountsInstallRoute: false` (pin, green when it landed) — tester: head 2577eb37 8 passed; dropping the `/i/` prefix check turns it red (with the missing-route test, 2 failed | 6 passed); reverted
- [x] An app with only `use('/i/*', middleware)` gives `mountsInstallRoute: false` (red first: received `true`) — tester: red 879a176a (AssertionError: expected true to be false, 1 failed | 7 passed), green 2577eb37 8/8; removing `!route.isMiddleware` turns it red (1 failed | 7 passed), reverted; throwaway inspectWorker on the deploy.ts-built createApp printed {"exportsScheduled":true,"mountsInstallRoute":true} (deleted)

## Coverage honesty

- The deploy itself is not run; `inspectWorker` is.
