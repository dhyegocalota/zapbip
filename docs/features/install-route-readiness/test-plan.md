# Test plan: Install route readiness

## The failing test first

- [x] `apps/api/test/unit/worker-facts.test.ts`: input: real `createApp` and the real source root; expected: `{ exportsScheduled: true, mountsInstallRoute: true }` (red today: `mountsInstallRoute` false) — red: mountsInstallRoute false; green after the fix; tester: 88f3ad8d red (mountsInstallRoute false, 1 failed | 5 passed), e0f3a6a5 green 6/6; throwaway inspectWorker script printed {"exportsScheduled":true,"mountsInstallRoute":true}; mutation ALL removed from accepted methods turns it red (deleted script)

## Unit

- [x] An app with no `/i/` route gives `mountsInstallRoute: false` — pin: green when it landed (worker-facts.test.ts); tester: dropping the /i/ prefix check turns it red (reports a missing install route)
- [x] An app that mounts `/i/` only for POST gives `mountsInstallRoute: false` — pin: green when it landed (worker-facts.test.ts); tester: accepting any method turns it red (is not fooled by ... another method)
- [ ] NEW, unconfirmed: an app with `new Hono().all('/health', handler)` gives `mountsInstallRoute: false` (pin, green when it landed)
- [ ] NEW, unconfirmed: an app with only `use('/i/*', middleware)` gives `mountsInstallRoute: false` (red first: received `true`)

## Coverage honesty

- The deploy itself is not run; `inspectWorker` is.
