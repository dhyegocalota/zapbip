# Test plan: Install route readiness

## The failing test first

- [x] `apps/api/test/unit/worker-facts.test.ts`: input: real `createApp` and the real source root; expected: `{ exportsScheduled: true, mountsInstallRoute: true }` (red today: `mountsInstallRoute` false) — red: mountsInstallRoute false; green after the fix

## Unit

- [x] An app with no `/i/` route gives `mountsInstallRoute: false` — pin: green when it landed (worker-facts.test.ts)
- [x] An app that mounts `/i/` only for POST gives `mountsInstallRoute: false` — pin: green when it landed (worker-facts.test.ts)

## Coverage honesty

- The deploy itself is not run; `inspectWorker` is.
